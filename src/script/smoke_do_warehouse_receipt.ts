/**
 * Smoke test for Delivery Order goods-receipt routing to a WAREHOUSE destination.
 *
 * Runs a REAL delivery-order create against the LOCAL test tenant DB (web_bytes_db)
 * with a throwaway temp item, asserts the stock landed in the WAREHOUSE (not the
 * outlet), then HARD-DELETES everything it created. LOCAL ONLY — never prod.
 *
 *   npx tsx src/script/smoke_do_warehouse_receipt.ts
 */
import "reflect-metadata";
import dotenv from "dotenv";
dotenv.config();

import { Decimal } from "decimal.js";
import { getTenantPrisma, disconnectAllPrismaClients } from "../db";
import service from "../delivery_order/delivery-order.service";

const DB = "web_bytes_db";
const OUTLET_ID = 1;
const WAREHOUSE_ID = 1;

const results: { name: string; pass: boolean; detail: string }[] = [];
function check(name: string, pass: boolean, detail = "") {
  results.push({ name, pass, detail });
  if (!pass) console.log(`   ✗ ${name} — ${detail}`);
}
const n = (v: any) => new Decimal(v ?? 0).toNumber();

async function main() {
  const prisma: any = getTenantPrisma(DB);
  const cat = await prisma.category.findFirst({ select: { id: true } });
  const sup = await prisma.supplier.findFirst({ select: { id: true } });
  const item = await prisma.item.create({
    data: {
      itemName: "SMOKE_DOWH",
      itemCode: "SMOKE_DOWH",
      itemBrand: "",
      itemModel: "",
      category: { connect: { id: cat.id } },
      supplier: { connect: { id: sup.id } },
      cost: new Decimal(50),
      price: new Decimal(200),
      unitOfMeasure: "Piece",
      trackStock: true,
      hasVariants: false,
    },
    select: { id: true },
  });

  try {
    const created = await service.createMany(DB, {
      deliveryOrders: [
        {
          outletId: OUTLET_ID,
          status: "Received",
          performedBy: "SMOKE",
          destinationLocationType: "WAREHOUSE",
          warehouseId: WAREHOUSE_ID,
          deliveryOrderItems: [
            {
              itemId: item.id,
              orderedQuantity: 10,
              receivedQuantity: 10,
              unitPrice: new Decimal(120) as any,
              deliveryFee: new Decimal(0) as any,
            },
          ],
        },
      ],
    } as any);

    const doId = created[0].id;
    check("DO created with WAREHOUSE destination",
      created[0].destinationLocationType === "WAREHOUSE" && created[0].warehouseId === WAREHOUSE_ID,
      JSON.stringify({ t: created[0].destinationLocationType, w: created[0].warehouseId }));

    // Warehouse balance should be +10
    const whBal = await prisma.warehouseStockBalance.findFirst({
      where: { itemId: item.id, warehouseId: WAREHOUSE_ID, itemVariantId: null, deleted: false },
      select: { availableQuantity: true, onHandQuantity: true },
    });
    check("warehouse balance available == 10", n(whBal?.availableQuantity) === 10, `got ${whBal?.availableQuantity}`);
    check("warehouse balance onHand == 10", n(whBal?.onHandQuantity) === 10, `got ${whBal?.onHandQuantity}`);

    // Warehouse receipt @120
    const whReceipt = await prisma.warehouseStockReceipt.findFirst({
      where: { itemId: item.id, warehouseId: WAREHOUSE_ID, deleted: false },
      select: { quantity: true, cost: true },
    });
    check("warehouse receipt 10@120", !!whReceipt && n(whReceipt.quantity) === 10 && n(whReceipt.cost) === 120, JSON.stringify(whReceipt));

    // Warehouse movement 'Delivery Receipt' +10
    const whMove = await prisma.warehouseStockMovement.findFirst({
      where: { itemId: item.id, warehouseId: WAREHOUSE_ID, movementType: "Delivery Receipt" },
      select: { availableQuantityDelta: true },
    });
    check("warehouse 'Delivery Receipt' movement +10", n(whMove?.availableQuantityDelta) === 10, `got ${whMove?.availableQuantityDelta}`);

    // Outlet must be UNTOUCHED (no balance/receipt for this item)
    const outBal = await prisma.stockBalance.findFirst({
      where: { itemId: item.id, outletId: OUTLET_ID, itemVariantId: null, deleted: false },
      select: { availableQuantity: true },
    });
    check("outlet balance untouched (none)", outBal == null || n(outBal.availableQuantity) === 0, `got ${outBal?.availableQuantity}`);
    const outReceipts = await prisma.stockReceipt.count({ where: { itemId: item.id, outletId: OUTLET_ID } });
    check("no outlet receipts created", outReceipts === 0, `got ${outReceipts}`);

    // Cleanup the DO chain
    await prisma.deliveryOrderItem.deleteMany({ where: { deliveryOrderId: doId } });
    await prisma.deliveryOrder.deleteMany({ where: { id: doId } });
  } finally {
    // Cleanup item + all its stock rows
    await prisma.warehouseStockMovement.deleteMany({ where: { itemId: item.id } });
    await prisma.warehouseStockReceipt.deleteMany({ where: { itemId: item.id } });
    await prisma.warehouseStockBalance.deleteMany({ where: { itemId: item.id } });
    await prisma.stockMovement.deleteMany({ where: { itemId: item.id } });
    await prisma.stockReceipt.deleteMany({ where: { itemId: item.id } });
    await prisma.stockBalance.deleteMany({ where: { itemId: item.id } });
    await prisma.item.deleteMany({ where: { id: item.id } });
  }
}

main()
  .then(() => {
    const passed = results.filter((r) => r.pass).length;
    console.log("\n──────── DO→WAREHOUSE SMOKE RESULTS ────────");
    for (const r of results) console.log(`${r.pass ? "✅" : "❌"} ${r.name}${r.pass ? "" : `  (${r.detail})`}`);
    console.log(`\n${passed}/${results.length} checks passed. (Temp item hard-deleted — DB clean.)`);
    return disconnectAllPrismaClients();
  })
  .then(() => process.exit(results.every((r) => r.pass) ? 0 : 1))
  .catch(async (e) => {
    console.error("SMOKE TEST ERROR:", e);
    await disconnectAllPrismaClients().catch(() => {});
    process.exit(1);
  });
