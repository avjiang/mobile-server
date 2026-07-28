/*
 * Smoke test: delivery-order cancellation stock arithmetic, LOCAL tenant DB.
 *
 * Guards the 2026-07-28 change to reverseStockOperationsForCancellation, which
 * replaced a pre-computed absolute write with an atomic
 *   GREATEST(0, QTY - n)
 * raw UPDATE. Raw SQL is invisible to tsc, so this exercises it for real:
 *   1. cancelling a received DO removes exactly the received quantity
 *   2. the clamp still holds — it floors at 0 rather than going negative
 *   3. a cancellation racing an independent change no longer loses either one
 *
 * Builds on seed_return_stock_shortfall.ts for the PO → DO → Invoice chain.
 * NEVER runs against prod (host guard below).
 *
 *   npx tsx src/script/smoke_do_cancel_stock_math.ts [tenant_db]
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

const doService = require("../delivery_order/delivery-order.service") as any;
const { getTenantPrisma, disconnectAllPrismaClients } = require("../db") as typeof import("../db");

const INV_NUMBER = "SEED-RET-INV-001";
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

async function seedChain() {
    execFileSync("npx", ["tsx", "src/script/seed_return_stock_shortfall.ts", TENANT_DB], { stdio: "pipe" });
}

/** Re-seed and return the seeded DO + its item/outlet, with stock set to `startQty`. */
async function freshDO(prisma: any, startQty: number) {
    await seedChain();
    const invoice = await prisma.invoice.findFirst({ where: { invoiceNumber: INV_NUMBER } });
    const deliveryOrder = await prisma.deliveryOrder.findFirst({
        where: { invoiceId: invoice.id },
        include: { deliveryOrderItems: true },
    });
    const item = deliveryOrder.deliveryOrderItems[0];
    await prisma.stockBalance.updateMany({
        where: { itemId: item.itemId, outletId: deliveryOrder.outletId },
        data: { availableQuantity: startQty, onHandQuantity: startQty },
    });
    return { deliveryOrder, itemId: item.itemId, outletId: deliveryOrder.outletId, received: Number(item.receivedQuantity) };
}

const cancel = (id: number) =>
    doService.update({ id, status: "CANCELLED", performedBy: "smoke" }, TENANT_DB);

async function main() {
    console.log(`Target tenant DB: ${TENANT_DB} (LOCAL)`);
    const prisma: any = getTenantPrisma(TENANT_DB);

    // ── 1. Plain cancellation removes exactly the received quantity ────────
    {
        const START = 10;
        const { deliveryOrder, itemId, outletId, received } = await freshDO(prisma, START);
        console.log(`\nDO #${deliveryOrder.id} received ${received}, stock set to ${START}`);
        await cancel(deliveryOrder.id);
        const after = await onHand(prisma, itemId, outletId);
        check(
            `cancel removes exactly the received qty (${START} → ${START - received})`,
            after === START - received,
            `(got ${after})`
        );
    }

    // ── 2. The clamp still floors at zero ─────────────────────────────────
    {
        const START = 1; // less than received → naive subtraction would go negative
        const { deliveryOrder, itemId, outletId, received } = await freshDO(prisma, START);
        console.log(`\nDO #${deliveryOrder.id} received ${received}, stock set to ${START} (under-stocked)`);
        await cancel(deliveryOrder.id);
        const after = await onHand(prisma, itemId, outletId);
        check(`clamp floors at 0 instead of going negative`, after === 0, `(got ${after})`);
    }

    // ── 3. A racing change is no longer lost ──────────────────────────────
    {
        const START = 10;
        const { deliveryOrder, itemId, outletId, received } = await freshDO(prisma, START);
        const balanceId = (await prisma.stockBalance.findFirst({ where: { itemId, outletId } })).id;
        console.log(`\nDO #${deliveryOrder.id} received ${received}, stock ${START} — cancel racing a sale of 1`);
        await Promise.all([
            cancel(deliveryOrder.id),
            prisma.stockBalance.update({
                where: { id: balanceId },
                data: { availableQuantity: { decrement: 1 }, onHandQuantity: { decrement: 1 } },
            }),
        ]);
        const after = await onHand(prisma, itemId, outletId);
        const expected = START - received - 1;
        check(
            `concurrent cancel(${received}) + sale(1) — both applied (${START} → ${expected})`,
            after === expected,
            `(got ${after} — a lost update shows ${START - received} or ${START - 1})`
        );
    }

    // ── 4. Two concurrent cancels must reverse stock exactly once ─────────
    // The old `wasAlreadyCancelled` flag came from a read taken before the
    // transaction opened, so both callers saw NOT-cancelled and both reversed.
    {
        const START = 10;
        const { deliveryOrder, itemId, outletId, received } = await freshDO(prisma, START);
        console.log(`\nDO #${deliveryOrder.id} received ${received}, stock ${START} — two concurrent cancels`);
        await Promise.allSettled([cancel(deliveryOrder.id), cancel(deliveryOrder.id)]);
        const after = await onHand(prisma, itemId, outletId);
        check(
            `concurrent cancels reverse stock once (${START} → ${START - received})`,
            after === START - received,
            `(got ${after} — double reversal shows ${START - received * 2})`
        );
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
