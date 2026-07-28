/*
 * Smoke test: procurement stock arithmetic, against a LOCAL tenant DB.
 *
 * Guards the 2026-07-28 change that converted the purchase-return stock writes
 * from pre-computed absolute values to relative increment/decrement. Absolute
 * writes silently clobber any concurrent change to the same balance (a lost
 * update); relative writes push the arithmetic into the UPDATE statement itself.
 *
 * Checks:
 *   1. a return still decrements by exactly N   (conversion is faithful)
 *   2. cancelling it still restores exactly N   (conversion is faithful)
 *   3. a return racing an independent stock change no longer loses either one
 *      — this is the behaviour the change exists for, and it FAILS on the old
 *      absolute-write code.
 *
 * Builds on seed_return_stock_shortfall.ts, which lays down the full
 * PO → DO → Invoice → StockReceipt chain a purchase return requires.
 * NEVER runs against prod (host guard below).
 *
 *   npx tsx src/script/smoke_procurement_stock_math.ts [tenant_db]
 */
import "reflect-metadata";
import dotenv from "dotenv";
import { execFileSync } from "child_process";
dotenv.config();

const TENANT_DB = process.argv[2] || "web_bytes_db";

const url = process.env.TENANT_DATABASE_URL || "";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) {
    console.error("ABORT: TENANT_DATABASE_URL is not local (127.0.0.1/localhost). Refusing to run.");
    process.exit(1);
}

const prService = require("../purchase_return/purchase-return.service") as any;
const { getTenantPrisma, disconnectAllPrismaClients } = require("../db") as typeof import("../db");

const INV_NUMBER = "SEED-RET-INV-001"; // must match seed_return_stock_shortfall.ts
const MARKER = "SMOKE-PROC-MATH";
let passed = 0,
    failed = 0;
const check = (name: string, cond: boolean, detail = "") => {
    if (cond) {
        passed++;
        console.log(`  ✔ ${name}`);
    } else {
        failed++;
        console.log(`  ✘ ${name} ${detail}`);
    }
};

const onHand = async (prisma: any, itemId: number, outletId: number) =>
    Number((await prisma.stockBalance.findFirst({ where: { itemId, outletId } })).onHandQuantity);

async function dropSmokeReturns(prisma: any) {
    const prs = await prisma.purchaseReturn.findMany({
        where: { returnNumber: { startsWith: MARKER } },
        select: { id: true },
    });
    const ids = prs.map((p: any) => p.id);
    if (ids.length) {
        await prisma.purchaseReturnItem.deleteMany({ where: { purchaseReturnId: { in: ids } } });
        await prisma.purchaseReturn.deleteMany({ where: { id: { in: ids } } });
    }
}

async function makeReturn(prisma: any, n: string, invoice: any, itemId: number, outletId: number, qty: number) {
    return prService.createMany(TENANT_DB, {
        purchaseReturns: [
            {
                returnNumber: `${MARKER}-${n}`,
                invoiceId: invoice.id,
                outletId,
                supplierId: invoice.supplierId,
                returnDate: new Date(),
                performedBy: "smoke",
                purchaseReturnItems: [{ itemId, quantity: qty, unitPrice: 100000, returnReason: "DEFECT" }],
            },
        ],
    });
}

async function main() {
    console.log(`Target tenant DB: ${TENANT_DB} (LOCAL)`);

    // Lay down the PO → DO → Invoice → StockReceipt chain (also resets stock).
    console.log("Seeding PO/DO/Invoice chain…");
    execFileSync("npx", ["tsx", "src/script/seed_return_stock_shortfall.ts", TENANT_DB], { stdio: "pipe" });

    const prisma: any = getTenantPrisma(TENANT_DB);
    await dropSmokeReturns(prisma);

    const invoice = await prisma.invoice.findFirst({ where: { invoiceNumber: INV_NUMBER } });
    if (!invoice) throw new Error("seed did not produce " + INV_NUMBER);
    const invItem = await prisma.invoiceItem.findFirst({ where: { invoiceId: invoice.id } });
    const itemId = invItem.itemId;
    const outletId = invoice.outletId;

    const START = await onHand(prisma, itemId, outletId);
    console.log(`item ${itemId} @ outlet ${outletId} — on hand ${START}\n`);

    try {
        // ── 1. Return 2 → stock must drop by exactly 2 ────────────────────
        const created = await makeReturn(prisma, "1", invoice, itemId, outletId, 2);
        const afterReturn = await onHand(prisma, itemId, outletId);
        check(`return of 2 decrements exactly (${START} → ${START - 2})`, afterReturn === START - 2, `(got ${afterReturn})`);

        // ── 2. Cancel → stock must come back to exactly START ─────────────
        await prService.cancel(created[0].id, { performedBy: "smoke", cancelReason: "smoke" }, TENANT_DB);
        const afterCancel = await onHand(prisma, itemId, outletId);
        check(`cancel restores exactly (${START - 2} → ${START})`, afterCancel === START, `(got ${afterCancel})`);

        // ── 3. THE POINT OF THE CHANGE ────────────────────────────────────
        // A return racing an independent change to the same balance. With the
        // old absolute write, whichever committed second overwrote the other.
        const balanceId = (await prisma.stockBalance.findFirst({ where: { itemId, outletId } })).id;
        await Promise.all([
            makeReturn(prisma, "2", invoice, itemId, outletId, 1),
            // Stands in for a concurrent sale of 1 unit.
            prisma.stockBalance.update({
                where: { id: balanceId },
                data: { availableQuantity: { decrement: 1 }, onHandQuantity: { decrement: 1 } },
            }),
        ]);
        const afterBoth = await onHand(prisma, itemId, outletId);
        check(
            `concurrent return(1) + sale(1) — both applied (${START} → ${START - 2})`,
            afterBoth === START - 2,
            `(got ${afterBoth} — a lost update shows ${START - 1})`
        );
        // ── 4. Concurrent CANCEL of one return must reverse stock once ────
        // PR cancel's "already cancelled?" check lives outside the transaction,
        // so it cannot serialise two callers on its own; the conditional
        // update inside the transaction is what does.
        {
            const r = await makeReturn(prisma, "3", invoice, itemId, outletId, 1);
            const prId = r[0].id;
            const before = await onHand(prisma, itemId, outletId);
            const results = await Promise.allSettled([
                prService.cancel(prId, { performedBy: "smoke", cancelReason: "a" }, TENANT_DB),
                prService.cancel(prId, { performedBy: "smoke", cancelReason: "b" }, TENANT_DB),
            ]);
            const ok = results.filter((x) => x.status === "fulfilled").length;
            const after = await onHand(prisma, itemId, outletId);
            check(`concurrent cancel: exactly one succeeds`, ok === 1, `(got ${ok})`);
            check(
                `concurrent cancel: stock restored once (${before} → ${before + 1})`,
                after === before + 1,
                `(got ${after} — double reversal shows ${before + 2})`
            );
        }
    } finally {
        await dropSmokeReturns(prisma);
    }

    console.log(`\n${failed === 0 ? "PASS" : "FAIL"} — ${passed} passed, ${failed} failed`);
    await disconnectAllPrismaClients();
    process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
    console.error(e);
    await disconnectAllPrismaClients();
    process.exit(1);
});
