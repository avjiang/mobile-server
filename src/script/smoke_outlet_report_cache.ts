/**
 * Smoke test for the outlet-report fingerprint-validated cache + businessDate
 * period filter (generateOutletReport in report.service.ts).
 *
 * Runs against the LOCAL test tenant DB (web_bytes_db). Verifies:
 *   1. A closed-period (last month) report MISSES the cache on first call.
 *   2. A second identical call HITS the cache and returns equal period data,
 *      with live sections (todayOps / stockBalance) still present.
 *   3. Mutating a sale inside the period (UPDATED_AT bump) invalidates the
 *      fingerprint → next call rebuilds. The mutation is reverted afterwards.
 *   4. An open-period (this month, includes today) request never caches.
 *   5. The period filter is businessDate-based: report totals match a direct
 *      businessDate-range aggregate, not a createdAt-range one.
 *
 * LOCAL ONLY — never point this at prod.
 *
 *   npx tsx src/script/smoke_outlet_report_cache.ts
 */
import dotenv from "dotenv";
dotenv.config();

import { getTenantPrisma, disconnectAllPrismaClients } from "../db";
import reportService = require("../report/report.service");

const DB = "web_bytes_db";

const results: { name: string; pass: boolean; detail: string }[] = [];
function check(name: string, pass: boolean, detail = "") {
    results.push({ name, pass, detail });
}

// Strip the live sections, then compare the period-scoped remainder.
function periodData(payload: any) {
    const { todayPurchaseOrders, todayDeliveryOrders, todayInvoices, stockBalance, ...rest } = payload;
    return rest;
}

async function main() {
    const prisma: any = getTenantPrisma(DB);

    const outlet = await prisma.outlet.findFirst({ where: { deleted: false }, select: { id: true } });
    if (!outlet) throw new Error("Test DB missing an outlet");

    // Last month, UTC bounds (mirrors the FE "Specific month" computation).
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 1000);

    const stats0 = reportService.getOutletReportCacheStats();

    // ── 1. first call = miss ──
    const r1 = await reportService.generateOutletReport(DB, outlet.id, start, end, null);
    const stats1 = reportService.getOutletReportCacheStats();
    check("first closed-period call is a cache miss",
        stats1.misses === stats0.misses + 1 && stats1.hits === stats0.hits,
        `misses ${stats0.misses}→${stats1.misses}, hits ${stats0.hits}→${stats1.hits}`);
    check("cache stores the entry", stats1.entries >= 1, `entries=${stats1.entries}`);

    // ── 1b. per-sale entries carry the address/amount/tax fields ──
    const firstSale = (r1 as any).sales?.[0];
    check("sales entries expose shipStreet/subtotalAmount/taxAmount/totalDiscountAmount",
        !firstSale || ('shipStreet' in firstSale && 'subtotalAmount' in firstSale && 'taxAmount' in firstSale && 'totalDiscountAmount' in firstSale),
        firstSale ? `sample: street='${firstSale.shipStreet}', subtotal=${firstSale.subtotalAmount}, tax=${firstSale.taxAmount}` : "no sales in period");

    // ── 2. second call = hit, identical period data, live sections present ──
    const r2 = await reportService.generateOutletReport(DB, outlet.id, start, end, null);
    const stats2 = reportService.getOutletReportCacheStats();
    check("second identical call is a cache hit",
        stats2.hits === stats1.hits + 1 && stats2.misses === stats1.misses,
        `hits ${stats1.hits}→${stats2.hits}`);
    check("hit returns identical period data",
        JSON.stringify(periodData(r1)) === JSON.stringify(periodData(r2)));
    check("hit payload still has live sections",
        'todayPurchaseOrders' in r2 && 'todayInvoices' in r2 && Array.isArray((r2 as any).stockBalance));

    // ── 3. a write inside the period invalidates the fingerprint ──
    const saleInPeriod = await prisma.sales.findFirst({
        where: { outletId: outlet.id, businessDate: { gte: start, lte: end } },
        select: { id: true, remark: true },
    });
    if (saleInPeriod) {
        await prisma.sales.update({ where: { id: saleInPeriod.id }, data: { remark: saleInPeriod.remark } });
        const r3 = await reportService.generateOutletReport(DB, outlet.id, start, end, null);
        const stats3 = reportService.getOutletReportCacheStats();
        check("write in period invalidates (miss + rebuild)",
            stats3.misses === stats2.misses + 1 && stats3.hits === stats2.hits,
            `misses ${stats2.misses}→${stats3.misses}`);
        check("rebuilt report still equals original period data",
            JSON.stringify(periodData(r1)) === JSON.stringify(periodData(r3)),
            "no-op update must not change report content");
    } else {
        check("write-invalidation (skipped — no sales in last month)", true, "no rows to touch");
    }

    // ── 4. open period (this month, includes today) never caches ──
    const statsBefore = reportService.getOutletReportCacheStats();
    const openStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const openEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) - 1000);
    await reportService.generateOutletReport(DB, outlet.id, openStart, openEnd, null);
    await reportService.generateOutletReport(DB, outlet.id, openStart, openEnd, null);
    const statsOpen = reportService.getOutletReportCacheStats();
    check("open period bypasses the cache entirely",
        statsOpen.hits === statsBefore.hits && statsOpen.misses === statsBefore.misses,
        `hits/misses unchanged: ${statsOpen.hits}/${statsOpen.misses}`);

    // ── 5. businessDate is the period filter ──
    const agg = await prisma.sales.aggregate({
        where: { outletId: outlet.id, businessDate: { gte: start, lte: end }, status: "Completed", deleted: false },
        _count: { id: true },
    });
    check("completed-sales count matches direct businessDate aggregate",
        (r1 as any).completedSales.count === agg._count.id,
        `report=${(r1 as any).completedSales.count}, direct=${agg._count.id}`);

    // ── report ──
    let failed = 0;
    for (const r of results) {
        console.log(`${r.pass ? "✅" : "❌"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
        if (!r.pass) failed++;
    }
    console.log(failed === 0 ? `\nALL ${results.length} CHECKS PASSED` : `\n${failed}/${results.length} CHECKS FAILED`);
    process.exitCode = failed === 0 ? 0 : 1;
}

main()
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => disconnectAllPrismaClients());
