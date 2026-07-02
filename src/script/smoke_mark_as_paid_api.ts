/*
 * Smoke test for the "mark as fully paid" settlement API against a LOCAL tenant DB.
 * Creates throwaway PARTIAL settlements, calls service.markSettlementAsPaid, then
 * asserts the persisted rows (status, write-off amount + audit fields, real paidAmount
 * left intact). Cleans up its own rows. NEVER runs against prod (host guard below).
 *
 *   npx ts-node -T src/script/smoke_mark_as_paid_api.ts [tenant_db]
 */
import dotenv from "dotenv";
dotenv.config();

import { Decimal } from "decimal.js";

const TENANT_DB = process.argv[2] || "web_bytes_db";

// ---- safety: refuse to run against anything that isn't local ----
const url = (process.env.TENANT_DATABASE_URL || "");
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) {
    console.error("ABORT: TENANT_DATABASE_URL is not local (127.0.0.1/localhost). Refusing to run.");
    console.error("       host seen: " + (url.match(/@([^:/]+)/)?.[1] || "?"));
    process.exit(1);
}

const service = require("../invoice_settlement/invoice_settlement.service") as typeof import("../invoice_settlement/invoice_settlement.service");
const { getTenantPrisma, disconnectAllPrismaClients } = require("../db") as typeof import("../db");

const PREFIX = "SMOKE-MAP-";
let passed = 0, failed = 0;
const check = (name: string, cond: boolean, detail = "") => {
    if (cond) { passed++; console.log(`  ✔ ${name}`); }
    else { failed++; console.log(`  ✘ ${name} ${detail}`); }
};

async function makeSettlement(prisma: any, n: string, bill: string, paid: string, currency = "IDR") {
    return prisma.invoiceSettlement.create({
        data: {
            settlementNumber: `${PREFIX}${n}`,
            settlementDate: new Date(),
            settlementType: "BULK",
            settlementAmount: bill,
            currency,
            paidAmount: paid,
            paymentStatus: "PARTIAL",
            status: "COMPLETED",
        },
    });
}

async function main() {
    const prisma = getTenantPrisma(TENANT_DB);
    console.log(`Target tenant DB: ${TENANT_DB} (LOCAL)`);

    // clean any leftovers from a previous run
    await prisma.invoiceSettlement.deleteMany({ where: { settlementNumber: { startsWith: PREFIX } } });

    // ---- Scenario A: the real PO#425 case — 4 short, within cap ----
    const a = await makeSettlement(prisma, "A", "31925404", "31925400");
    const aRes: any = await service.markSettlementAsPaid(TENANT_DB, a.id, { performedBy: "smoke_user", siteId: 7, reason: "ROUNDING" });
    const aRow: any = await prisma.invoiceSettlement.findUnique({ where: { id: a.id } });
    console.log("\n[A] bill 31,925,404 / paid 31,925,400 (4 short):");
    check("status flipped to PAID", aRow.paymentStatus === "PAID", `got ${aRow.paymentStatus}`);
    check("writeOffAmount == 4", new Decimal(aRow.writeOffAmount).equals(4), `got ${aRow.writeOffAmount}`);
    check("paidAmount UNCHANGED (real cash 31,925,400)", new Decimal(aRow.paidAmount).equals(31925400), `got ${aRow.paidAmount}`);
    check("audit: writeOffBy recorded", aRow.writeOffBy === "smoke_user", `got ${aRow.writeOffBy}`);
    check("audit: writeOffAt recorded", !!aRow.writeOffAt);
    check("audit: writeOffReason recorded", aRow.writeOffReason === "ROUNDING", `got ${aRow.writeOffReason}`);
    check("audit: siteId attributed", aRow.siteId === 7, `got ${aRow.siteId}`);
    check("version incremented", (aRow.version ?? 0) >= 2, `got ${aRow.version}`);
    check("paid + writeOff == bill", new Decimal(aRow.paidAmount).plus(aRow.writeOffAmount).equals(31925404));
    check("DTO canMarkAsPaid now false", aRes.canMarkAsPaid === false, `got ${aRes.canMarkAsPaid}`);
    check("DTO outstandingAmount == 0", new Decimal(aRes.outstandingAmount).equals(0), `got ${aRes.outstandingAmount}`);

    // ---- Scenario B: shortfall over the cap -> blocked, nothing written ----
    const b = await makeSettlement(prisma, "B", "10000000", "9989999"); // 10,001 short > cap 10,000
    let bThrew = false, bMsg = "";
    try { await service.markSettlementAsPaid(TENANT_DB, b.id, { performedBy: "smoke_user" }); }
    catch (e: any) { bThrew = true; bMsg = e.message; }
    const bRow: any = await prisma.invoiceSettlement.findUnique({ where: { id: b.id } });
    console.log("\n[B] bill 10,000,000 / paid 9,989,999 (10,001 short > cap):");
    check("rejected", bThrew, "(did not throw)");
    check("error mentions limit/rebate", /limit|rebate/i.test(bMsg), `msg: ${bMsg}`);
    check("still PARTIAL", bRow.paymentStatus === "PARTIAL");
    check("no write-off persisted", new Decimal(bRow.writeOffAmount).equals(0) && bRow.writeOffBy === null);

    // ---- Scenario C: tiny-bill floor boundary ----
    const c1 = await makeSettlement(prisma, "C1", "50000", "49100"); // 900 short <= floor 1000 -> allowed
    const c2 = await makeSettlement(prisma, "C2", "50000", "48000"); // 2000 short > floor 1000 -> blocked
    await service.markSettlementAsPaid(TENANT_DB, c1.id, { performedBy: "smoke_user" });
    let c2Threw = false;
    try { await service.markSettlementAsPaid(TENANT_DB, c2.id, { performedBy: "smoke_user" }); } catch { c2Threw = true; }
    const c1Row: any = await prisma.invoiceSettlement.findUnique({ where: { id: c1.id } });
    const c2Row: any = await prisma.invoiceSettlement.findUnique({ where: { id: c2.id } });
    console.log("\n[C] tiny-bill floor (cap=1,000):");
    check("900 short allowed -> PAID, writeOff 900", c1Row.paymentStatus === "PAID" && new Decimal(c1Row.writeOffAmount).equals(900));
    check("2,000 short blocked -> PARTIAL", c2Threw && c2Row.paymentStatus === "PARTIAL");

    // ---- Scenario D: already-paid is rejected (idempotency) ----
    let dThrew = false;
    try { await service.markSettlementAsPaid(TENANT_DB, a.id, { performedBy: "smoke_user" }); } catch { dThrew = true; }
    console.log("\n[D] re-mark an already-paid settlement:");
    check("rejected (idempotent)", dThrew);

    // ---- Scenario E: MYR sub-cent phantom is already paid (rounding, no action) ----
    const e = await makeSettlement(prisma, "E", "1500.0000", "1499.9970", "MYR");
    let eStatus = "";
    try { await service.markSettlementAsPaid(TENANT_DB, e.id, { performedBy: "smoke_user" }); }
    catch (err: any) { eStatus = err.message; }
    const eRow: any = await prisma.invoiceSettlement.findUnique({ where: { id: e.id } });
    console.log("\n[E] MYR 1500.00 / paid 1499.997 (sub-cent):");
    check("rejected as already-paid (sub-unit rounds away)", /already fully paid/i.test(eStatus), `msg: ${eStatus}`);

    // ---- cleanup ----
    await prisma.invoiceSettlement.deleteMany({ where: { settlementNumber: { startsWith: PREFIX } } });
    console.log("\nCleaned up test rows.");

    console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
    await disconnectAllPrismaClients();
    process.exit(failed ? 1 : 0);
}

main().catch(async (e) => { console.error(e); await disconnectAllPrismaClients().catch(() => {}); process.exit(1); });
