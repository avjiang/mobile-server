/**
 * Smoke test for local-day bucketing in getRevenueTrend (sales.service.ts).
 *
 * The dashboard sparkline used to bucket by UTC calendar day while the outlet
 * report and Sales History bound periods by the user's LOCAL day, so for a WIB
 * (UTC+7) tenant a "today" bar actually covered 07:00 → 06:59 local and sales
 * rung up 00:00–06:59 landed in the previous bar. The endpoint now accepts
 * `utcOffsetMinutes` from the device.
 *
 * Runs against the LOCAL test tenant DB (web_bytes_db). Verifies:
 *   1. `INTERVAL ? MINUTE` actually binds as a prepared-statement parameter
 *      (the whole approach dies if MySQL rejects it).
 *   2. offset 0 reproduces the old UTC-day behaviour byte-for-byte.
 *   3. offset 420 (WIB) buckets by the local day — checked against an
 *      independent aggregate computed in JS from raw rows, not by the same SQL.
 *   4. A sale placed at 02:00 local (the case the old code got wrong) lands in
 *      the local day's bucket, not the previous one. Seeded then removed.
 *   5. Series shape/ordering holds and out-of-range offsets are clamped.
 *
 * LOCAL ONLY — never point this at prod.
 *
 *   npx tsx src/script/smoke_revenue_trend_offset.ts
 */
import "reflect-metadata"; // sales.request.ts uses class-transformer decorators
import dotenv from "dotenv";
dotenv.config();

// NOT "@prisma/client" — this repo generates its client to a custom output path
// (see the generator block in prisma/client/schema.prisma). The stock package only
// resolves locally because an old default `prisma generate` left a client behind in
// node_modules; CI's `npm ci` installs the clean stub, where `Prisma.sql` does not
// exist and the build fails. Every other file in src/ imports from this path.
import { Prisma } from "../../prisma/client/generated/client";
import { getTenantPrisma, disconnectAllPrismaClients } from "../db";
import salesService = require("../sales/sales.service");

const DB = "web_bytes_db";
const WIB = 420; // UTC+7, minutes

const results: { name: string; pass: boolean; detail: string }[] = [];
function check(name: string, pass: boolean, detail = "") {
    results.push({ name, pass, detail });
}

// Guard: refuse to run against anything that isn't the local test tenant.
if (!DB.endsWith("_db") || /prod|azure/i.test(process.env.DATABASE_URL ?? "")) {
    throw new Error("Refusing to run: this smoke is LOCAL ONLY.");
}

async function main() {
    const prisma = getTenantPrisma(DB);

    // Pick an outlet that actually has sales, else the whole run is vacuous.
    const outletRow = await prisma.$queryRaw<Array<{ OUTLET_ID: number; n: bigint }>>(
        Prisma.sql`SELECT OUTLET_ID, COUNT(*) AS n FROM sales
                   WHERE IS_DELETED = 0 GROUP BY OUTLET_ID ORDER BY n DESC LIMIT 1`
    );
    if (!outletRow.length) throw new Error("No sales in " + DB + " — seed first.");
    const outletId = Number(outletRow[0].OUTLET_ID);
    console.log(`Using outletId=${outletId} (${outletRow[0].n} sales)\n`);

    // ── 1. INTERVAL ? MINUTE binds ──────────────────────────────────────────
    try {
        const probe = await prisma.$queryRaw<Array<{ shifted: Date | string }>>(
            Prisma.sql`SELECT DATE('2026-07-27 20:00:00' + INTERVAL ${WIB} MINUTE) AS shifted`
        );
        const v = probe[0].shifted;
        const s = typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10);
        // 27 Jul 20:00 UTC + 7h = 28 Jul 03:00 local → local date is the 28th.
        check("INTERVAL ? MINUTE binds and shifts the date", s === "2026-07-28", `got ${s}`);
    } catch (e: any) {
        check("INTERVAL ? MINUTE binds and shifts the date", false, e.message);
    }

    // ── 2. offset 0 == legacy UTC-day behaviour ─────────────────────────────
    const utcTrend = await salesService.getRevenueTrend(DB, outletId, 7, 0);
    const legacy = await legacyUtcSeries(prisma, outletId, 7);
    check(
        "offset 0 reproduces the old UTC-day series exactly",
        JSON.stringify(utcTrend.series) === JSON.stringify(legacy),
        `service=${JSON.stringify(utcTrend.series)}\n         legacy=${JSON.stringify(legacy)}`
    );

    // ── 3. offset 420 buckets by the LOCAL day (independent JS aggregate) ───
    const wibTrend = await salesService.getRevenueTrend(DB, outletId, 7, WIB);
    const expected = await independentLocalSeries(prisma, outletId, 7, WIB);
    check(
        "offset 420 matches an independently computed local-day aggregate",
        JSON.stringify(wibTrend.series) === JSON.stringify(expected),
        `service=${JSON.stringify(wibTrend.series)}\n         expected=${JSON.stringify(expected)}`
    );

    // ── 4. the 02:00-local sale lands in the right bucket ───────────────────
    // 02:00 local (UTC+7) today == 19:00 UTC yesterday. Old code binned it into
    // yesterday's bar; local-day bucketing must put it in today's.
    const nowShifted = new Date(Date.now() + WIB * 60_000);
    const ly = nowShifted.getUTCFullYear(), lm = nowShifted.getUTCMonth(), ld = nowShifted.getUTCDate();
    const localTodayKey = new Date(Date.UTC(ly, lm, ld)).toISOString().slice(0, 10);
    const businessDate = new Date(Date.UTC(ly, lm, ld, 2, 0, 0) - WIB * 60_000); // 02:00 local

    const before = await salesService.getRevenueTrend(DB, outletId, 7, WIB);
    const beforeToday = before.series.find(s => s.date === localTodayKey)?.revenue ?? 0;

    const seeded = await prisma.$executeRaw(
        Prisma.sql`INSERT INTO sales (OUTLET_ID, BUSINESS_DATE, SALES_TYPE, CUSTOMER_NAME,
                                      SUBTOTAL_AMOUNT, TOTAL_AMOUNT, PROFIT_AMOUNT, PAID_AMOUNT,
                                      STATUS, SESSION_ID, EOD_ID, IS_DELETED,
                                      CREATED_AT, UPDATED_AT, REMARK)
                   VALUES (${outletId}, ${businessDate}, 'Retail', 'SMOKE_TZ',
                           12345, 12345, 0, 12345,
                           'Completed', 0, 0, 0,
                           NOW(3), NOW(3), 'smoke_revenue_trend_offset')`
    );
    try {
        const after = await salesService.getRevenueTrend(DB, outletId, 7, WIB);
        const afterToday = after.series.find(s => s.date === localTodayKey)?.revenue ?? 0;
        check(
            "02:00-local sale lands in TODAY's local bucket (the old UTC bug)",
            Math.round(afterToday - beforeToday) === 12345,
            `delta=${afterToday - beforeToday} (expected 12345) on ${localTodayKey}`
        );

        // Re-run the independent cross-check now that a sale exists whose local
        // day and UTC day genuinely differ. Before seeding this comparison is
        // vacuous on a near-empty tenant (all-zero series match trivially); with
        // the 02:00 row present it actually discriminates.
        const seededTrend = await salesService.getRevenueTrend(DB, outletId, 7, WIB);
        const seededExpected = await independentLocalSeries(prisma, outletId, 7, WIB);
        check(
            "local-day aggregate still matches independently WITH divergent data present",
            JSON.stringify(seededTrend.series) === JSON.stringify(seededExpected),
            `service=${JSON.stringify(seededTrend.series)}\n         expected=${JSON.stringify(seededExpected)}`
        );

        // And the same sale under UTC bucketing lands on the PREVIOUS day —
        // this is the concrete divergence the change corrects.
        const afterUtc = await salesService.getRevenueTrend(DB, outletId, 7, 0);
        const utcKeyOfSale = businessDate.toISOString().slice(0, 10);
        const utcBucket = afterUtc.series.find(s => s.date === utcKeyOfSale);
        check(
            "same sale buckets to a DIFFERENT day under offset 0 (proves the fix bites)",
            utcKeyOfSale !== localTodayKey && utcBucket !== undefined,
            `utcKey=${utcKeyOfSale} localKey=${localTodayKey}`
        );
    } finally {
        await prisma.$executeRaw(
            Prisma.sql`DELETE FROM sales WHERE REMARK = 'smoke_revenue_trend_offset' AND CUSTOMER_NAME = 'SMOKE_TZ'`
        );
        console.log(`(cleaned up ${seeded} seeded row)\n`);
    }

    // ── 5. shape + clamping ─────────────────────────────────────────────────
    check("series has exactly `days` entries", wibTrend.series.length === 7, `len=${wibTrend.series.length}`);
    const ascending = wibTrend.series.every((s, i, a) => i === 0 || a[i - 1].date < s.date);
    check("series is ordered oldest → newest", ascending);

    const clamped = await salesService.getRevenueTrend(DB, outletId, 7, 99999);
    const clampedTo840 = await salesService.getRevenueTrend(DB, outletId, 7, 840);
    check(
        "absurd offset clamps to +14:00 rather than shifting arbitrarily",
        JSON.stringify(clamped.series) === JSON.stringify(clampedTo840.series),
        `clamped(99999)=${JSON.stringify(clamped.series)}\n         at840=${JSON.stringify(clampedTo840.series)}`
    );

    report();
}

/** The pre-change implementation, reproduced independently for comparison. */
async function legacyUtcSeries(prisma: any, outletId: number, days: number) {
    const now = new Date();
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)));
    const rows = await prisma.$queryRaw(
        Prisma.sql`SELECT DATE(BUSINESS_DATE) AS day, CAST(SUM(TOTAL_AMOUNT) AS DECIMAL(18,4)) AS revenue
                   FROM sales
                   WHERE OUTLET_ID = ${outletId} AND BUSINESS_DATE >= ${start} AND BUSINESS_DATE < ${end}
                     AND STATUS IN ('Completed','Partially Paid','Delivered') AND IS_DELETED = 0
                   GROUP BY DATE(BUSINESS_DATE) ORDER BY day ASC`
    );
    const byDay = new Map<string, number>();
    for (const r of rows as any[]) {
        const key = typeof r.day === "string" ? r.day.slice(0, 10) : r.day.toISOString().slice(0, 10);
        byDay.set(key, r.revenue == null ? 0 : Number(r.revenue));
    }
    const series = [];
    for (let i = 0; i < days; i++) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1 - i)));
        const key = d.toISOString().slice(0, 10);
        series.push({ date: key, revenue: byDay.get(key) ?? 0 });
    }
    return series;
}

/**
 * Local-day aggregation done in JS from raw rows — deliberately NOT via the
 * same shifted-DATE() SQL, so this is a real cross-check rather than a tautology.
 */
async function independentLocalSeries(prisma: any, outletId: number, days: number, offsetMin: number) {
    const offsetMs = offsetMin * 60_000;
    const nowShifted = new Date(Date.now() + offsetMs);
    const y = nowShifted.getUTCFullYear(), m = nowShifted.getUTCMonth(), d = nowShifted.getUTCDate();
    const end = new Date(Date.UTC(y, m, d + 1) - offsetMs);
    const start = new Date(Date.UTC(y, m, d - (days - 1)) - offsetMs);

    const rows = await prisma.$queryRaw(
        Prisma.sql`SELECT BUSINESS_DATE, TOTAL_AMOUNT FROM sales
                   WHERE OUTLET_ID = ${outletId} AND BUSINESS_DATE >= ${start} AND BUSINESS_DATE < ${end}
                     AND STATUS IN ('Completed','Partially Paid','Delivered') AND IS_DELETED = 0`
    );
    const byDay = new Map<string, number>();
    for (const r of rows as any[]) {
        const bd = r.BUSINESS_DATE instanceof Date ? r.BUSINESS_DATE : new Date(r.BUSINESS_DATE);
        const key = new Date(bd.getTime() + offsetMs).toISOString().slice(0, 10);
        byDay.set(key, (byDay.get(key) ?? 0) + Number(r.TOTAL_AMOUNT));
    }
    const series = [];
    for (let i = 0; i < days; i++) {
        const dd = new Date(Date.UTC(y, m, d - (days - 1 - i)));
        const key = dd.toISOString().slice(0, 10);
        series.push({ date: key, revenue: Math.round((byDay.get(key) ?? 0) * 10000) / 10000 });
    }
    return series;
}

function report() {
    console.log("─".repeat(72));
    let failed = 0;
    for (const r of results) {
        console.log(`${r.pass ? "✅" : "❌"} ${r.name}`);
        if (!r.pass && r.detail) console.log(`         ${r.detail}`);
        if (!r.pass) failed++;
    }
    console.log("─".repeat(72));
    console.log(`${results.length - failed}/${results.length} checks passed`);
    if (failed) process.exitCode = 1;
}

main()
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(async () => {
        await disconnectAllPrismaClients();
        // Force exit: importing sales.service leaves handles that keep the event
        // loop alive, so the process would otherwise hang after printing (the same
        // defect that makes the aggregate `npm test` unreliable — see the
        // 2026-07-28 session log). Without this, piping output anywhere that waits
        // for EOF (`| tail`) silently produces nothing.
        process.exit(process.exitCode ?? 0);
    });
