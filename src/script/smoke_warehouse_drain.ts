/**
 * Smoke test for the set-based raw-SQL warehouse drain (drainAllWarehousesToOutlet).
 *
 * Runs against the LOCAL test tenant DB (web_bytes_db). Seeds FIFO warehouse stock,
 * runs the real drain, asserts the outcome, then ROLLS BACK everything (throws a
 * sentinel) so the DB is left pristine. LOCAL ONLY — never point this at prod.
 *
 *   npx tsx src/script/smoke_warehouse_drain.ts
 */
import dotenv from "dotenv";
dotenv.config();

import { Decimal } from "decimal.js";
import { getTenantPrisma, disconnectAllPrismaClients } from "../db";
import { drainAllWarehousesToOutlet } from "../stock/stock-transfer.service";

const DB = "web_bytes_db";

class Rollback extends Error {}

const results: { name: string; pass: boolean; detail: string }[] = [];
function check(name: string, pass: boolean, detail = "") {
    results.push({ name, pass, detail });
}
const n = (v: any) => new Decimal(v ?? 0).toNumber();

async function main() {
    const prisma: any = getTenantPrisma(DB);

    const item = await prisma.item.findFirst({
        where: { deleted: false, hasVariants: false },
        select: { id: true, itemName: true, cost: true },
    });
    const outlet = await prisma.outlet.findFirst({ where: { deleted: false }, select: { id: true } });
    let warehouse = await prisma.warehouse.findFirst({ where: { deleted: false }, select: { id: true } });
    if (!item || !outlet) throw new Error("Test DB missing an item or outlet");

    console.log(`Using item ${item.id} (${item.itemName}), outlet ${outlet.id}, warehouse ${warehouse?.id ?? "(will create)"}`);

    try {
        await prisma.$transaction(async (tx: any) => {
            // Ensure a warehouse exists (temp row, rolled back).
            let warehouseId = warehouse?.id as number | undefined;
            if (!warehouseId) {
                const w = await tx.warehouse.create({
                    data: { tenantWarehouseId: 0, warehouseName: "SMOKE_WH", warehouseCode: "SMOKE_WH" },
                });
                warehouseId = w.id;
            }

            // Outlet balance BEFORE (may be null → 0).
            const outBefore = await tx.stockBalance.findFirst({
                where: { itemId: item.id, outletId: outlet.id, itemVariantId: null, deleted: false },
                select: { availableQuantity: true, onHandQuantity: true },
            });
            const beforeAvail = outBefore ? n(outBefore.availableQuantity) : 0;

            // Seed warehouse FIFO stock: 10@100 (older) + 5@120 (newer) = 15 units, value 1600.
            await tx.warehouseStockReceipt.create({
                data: { itemId: item.id, warehouseId, quantity: new Decimal(10), cost: new Decimal(100), receiptDate: new Date("2024-01-01T00:00:00Z") },
            });
            await tx.warehouseStockReceipt.create({
                data: { itemId: item.id, warehouseId, quantity: new Decimal(5), cost: new Decimal(120), receiptDate: new Date("2024-02-01T00:00:00Z") },
            });
            await tx.warehouseStockBalance.create({
                data: { itemId: item.id, warehouseId, availableQuantity: new Decimal(15), onHandQuantity: new Decimal(15) },
            });

            // ── Run the real drain ──
            const result = await drainAllWarehousesToOutlet(tx, outlet.id, "SMOKE_TEST");
            console.log("drain result:", result);

            check("itemsDrained == 1", result.itemsDrained === 1, `got ${result.itemsDrained}`);
            check("totalQuantity == 15", n(result.totalQuantity) === 15, `got ${result.totalQuantity}`);
            check("totalValue == 1600", n(result.totalValue) === 1600, `got ${result.totalValue}`);

            // Warehouse balance zeroed
            const whBal = await tx.warehouseStockBalance.findFirst({
                where: { itemId: item.id, warehouseId },
                select: { availableQuantity: true, onHandQuantity: true },
            });
            check("warehouse balance available == 0", n(whBal?.availableQuantity) === 0, `got ${whBal?.availableQuantity}`);
            check("warehouse balance onHand == 0", n(whBal?.onHandQuantity) === 0, `got ${whBal?.onHandQuantity}`);

            // Warehouse receipts soft-deleted + zeroed
            const whReceiptsLive = await tx.warehouseStockReceipt.count({
                where: { itemId: item.id, warehouseId, deleted: false, quantity: { gt: 0 } },
            });
            check("warehouse receipts all consumed (0 live)", whReceiptsLive === 0, `got ${whReceiptsLive}`);

            // Outlet balance merged (+15)
            const outAfter = await tx.stockBalance.findFirst({
                where: { itemId: item.id, outletId: outlet.id, itemVariantId: null, deleted: false },
                select: { availableQuantity: true, onHandQuantity: true },
            });
            check("outlet balance += 15", n(outAfter?.availableQuantity) === beforeAvail + 15, `before ${beforeAvail}, after ${outAfter?.availableQuantity}`);

            // Outlet receipts: 2 new rows preserving cost + receiptDate
            const outReceipts = await tx.stockReceipt.findMany({
                where: { itemId: item.id, outletId: outlet.id, itemVariantId: null, deleted: false, cost: { in: [new Decimal(100), new Decimal(120)] } },
                orderBy: { receiptDate: "asc" },
                select: { quantity: true, cost: true, receiptDate: true },
            });
            const r100 = outReceipts.find((r: any) => n(r.cost) === 100);
            const r120 = outReceipts.find((r: any) => n(r.cost) === 120);
            check("outlet receipt 10@100 copied", !!r100 && n(r100.quantity) === 10, JSON.stringify(r100));
            check("outlet receipt 5@120 copied", !!r120 && n(r120.quantity) === 5, JSON.stringify(r120));
            check("FIFO receiptDate preserved (100 older than 120)",
                !!r100 && !!r120 && new Date(r100.receiptDate) < new Date(r120.receiptDate),
                `${r100?.receiptDate} < ${r120?.receiptDate}`);

            // Movements: Transfer Out (warehouse) + Transfer In (outlet)
            const outMove = await tx.warehouseStockMovement.findFirst({
                where: { itemId: item.id, warehouseId, movementType: "Transfer Out" },
                select: { availableQuantityDelta: true },
            });
            check("warehouse 'Transfer Out' movement (-15)", !!outMove && n(outMove.availableQuantityDelta) === -15, `got ${outMove?.availableQuantityDelta}`);

            const inMove = await tx.stockMovement.findFirst({
                where: { itemId: item.id, outletId: outlet.id, movementType: "Transfer In" },
                orderBy: { id: "desc" },
                select: { availableQuantityDelta: true, previousAvailableQuantity: true },
            });
            check("outlet 'Transfer In' movement (+15)", !!inMove && n(inMove.availableQuantityDelta) === 15, `got ${inMove?.availableQuantityDelta}`);
            check("outlet 'Transfer In' previous == before", !!inMove && n(inMove.previousAvailableQuantity) === beforeAvail, `got ${inMove?.previousAvailableQuantity}, expected ${beforeAvail}`);

            // Always roll back — leave the DB pristine.
            throw new Rollback();
        });
    } catch (e) {
        if (!(e instanceof Rollback)) throw e;
    }
}

main()
    .then(() => {
        const passed = results.filter((r) => r.pass).length;
        console.log("\n──────── SMOKE TEST RESULTS ────────");
        for (const r of results) console.log(`${r.pass ? "✅" : "❌"} ${r.name}${r.pass ? "" : `  (${r.detail})`}`);
        console.log(`\n${passed}/${results.length} checks passed. (DB rolled back — no data persisted.)`);
        return disconnectAllPrismaClients();
    })
    .then(() => process.exit(results.every((r) => r.pass) ? 0 : 1))
    .catch(async (e) => {
        console.error("SMOKE TEST ERROR:", e);
        await disconnectAllPrismaClients().catch(() => {});
        process.exit(1);
    });
