/*
 * DEV SEED — reproduces the production purchase-return failure locally.
 *
 * Rebuilds the exact shape found on audio_technic_db (2026-07-27): a PAID invoice
 * that received 6 units, of which 3 were later SOLD, leaving 3 on hand. Attempting
 * to return 4 then trips the stock guard in purchase-return.service.ts, which now
 * answers HTTP 400 + errorCode STOCK_INSUFFICIENT_RETURN (it used to be a 500
 * rendered to the user as "Internal server error").
 *
 * Builds: PurchaseOrder -> DeliveryOrder -> Invoice (Paid, settled) -> StockReceipt
 *         + StockBalance at 3 + the 3 "Sales" stock movements that explain the gap.
 *
 * In the app, returns are created FROM THE INVOICE, not from the Purchase Return
 * menu (that screen is a read-only list). Function -> Invoice -> open
 * SEED-RET-INV-001 -> orange "Retur" FAB -> quantity 4 -> save. The FAB only
 * renders when invoice.status == 'paid' && !hasFullyReturnedItems, which is why
 * this seed seals the invoice as Paid + settled.
 * Expected (ID): "Stok SEED Return Test Item (SEED-RET-ITEM) tidak cukup.
 * Tersedia: 3, diminta retur: 4. ..."   Returning 3 or fewer succeeds.
 *
 * ALWAYS re-run this immediately before testing. It owns a dedicated item
 * (SEED-RET-ITEM) so other scripts can't move its stock, but a previous test run
 * of your own will have consumed the 3 units.
 *
 * Re-running replaces the previous seed. NEVER runs against prod (host guard).
 * Run:  npx tsx src/script/seed_return_stock_shortfall.ts
 */
import dotenv from "dotenv";
dotenv.config();

const TENANT_DB = "web_bytes_db";
const url = process.env.TENANT_DATABASE_URL || "";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) {
    console.error("ABORT: TENANT_DATABASE_URL is not local. Refusing to run.");
    process.exit(1);
}

const { getTenantPrisma, disconnectAllPrismaClients } = require("../db") as typeof import("../db");

const PO_NUMBER = "SEED-RET-PO-001";
const INV_NUMBER = "SEED-RET-INV-001";
const SETTLEMENT_NUMBER = "SEED-RET-SET-001";

const OUTLET_ID = 1;
const RECEIVED = 6;   // units the invoice/DO brought in
const SOLD = 3;       // units consumed afterwards -> only 3 remain returnable
const UNIT_COST = 100000;

async function main() {
    const prisma: any = getTenantPrisma(TENANT_DB);

    // ---- dedicated item, NOT a shared one -----------------------------------
    // web_bytes_db ships with a single stock-tracked item, so reusing it means
    // every other seed/smoke script fights this one over the same StockBalance
    // row. That actually happened: a DO-cancel smoke script ran 21 ms after this
    // seed, cancelled its delivery order and left the balance at 4 instead of 3,
    // so a return of 4 was legitimately allowed and the scenario silently
    // stopped reproducing. Own the item and nothing else can move it.
    const ITEM_CODE = "SEED-RET-ITEM";
    const supplier = await prisma.supplier.findFirst({ where: { deleted: false }, select: { id: true, companyName: true } });
    if (!supplier) throw new Error("No supplier in " + TENANT_DB);
    const category = await prisma.category.findFirst({ where: { deleted: false }, select: { id: true } });
    if (!category) throw new Error("No item category in " + TENANT_DB);

    let item = await prisma.item.findFirst({
        where: { itemCode: ITEM_CODE },
        select: { id: true, itemName: true, itemCode: true },
    });
    if (!item) {
        item = await prisma.item.create({
            data: {
                itemName: "SEED Return Test Item",
                itemCode: ITEM_CODE,
                categoryId: category.id,
                supplierId: supplier.id,
                cost: UNIT_COST,
                price: UNIT_COST,
                trackStock: true,
                hasVariants: false,
            },
            select: { id: true, itemName: true, itemCode: true },
        });
    }

    // ---- clean up a previous run (children first) ---------------------------
    const oldInvoice = await prisma.invoice.findFirst({ where: { invoiceNumber: INV_NUMBER } });
    if (oldInvoice) {
        const oldDOs = await prisma.deliveryOrder.findMany({ where: { invoiceId: oldInvoice.id }, select: { id: true } });
        const doIds = oldDOs.map((d: any) => d.id);
        if (doIds.length) {
            // Purchase returns created against the seed must go before their receipts.
            const prs = await prisma.purchaseReturn.findMany({ where: { invoiceId: oldInvoice.id }, select: { id: true } });
            const prIds = prs.map((p: any) => p.id);
            if (prIds.length) {
                await prisma.purchaseReturnItem.deleteMany({ where: { purchaseReturnId: { in: prIds } } });
                await prisma.purchaseReturn.deleteMany({ where: { id: { in: prIds } } });
            }
            await prisma.stockReceipt.deleteMany({ where: { deliveryOrderId: { in: doIds } } });
            await prisma.deliveryOrderItem.deleteMany({ where: { deliveryOrderId: { in: doIds } } });
            await prisma.deliveryOrder.deleteMany({ where: { id: { in: doIds } } });
        }
        await prisma.invoiceItem.deleteMany({ where: { invoiceId: oldInvoice.id } });
        await prisma.invoice.delete({ where: { id: oldInvoice.id } });
    }
    await prisma.invoiceSettlement.deleteMany({ where: { settlementNumber: SETTLEMENT_NUMBER } });
    await prisma.purchaseOrder.deleteMany({ where: { purchaseOrderNumber: PO_NUMBER } });
    await prisma.stockMovement.deleteMany({ where: { reason: { startsWith: "SEED-RET" } } });

    const total = RECEIVED * UNIT_COST;

    // ---- 1. purchase order --------------------------------------------------
    const po = await prisma.purchaseOrder.create({
        data: {
            purchaseOrderNumber: PO_NUMBER,
            outletId: OUTLET_ID,
            supplierId: supplier.id,
            status: "Completed",
            purchaseOrderDate: new Date(),
            subtotalAmount: total,
            totalAmount: total,
            currency: "IDR",
        },
    });

    // ---- 2. settlement + paid invoice --------------------------------------
    // The return guard requires invoice.status === PAID, so the invoice must be settled.
    const settlement = await prisma.invoiceSettlement.create({
        data: {
            settlementNumber: SETTLEMENT_NUMBER,
            settlementDate: new Date(),
            settlementType: "INVOICE",
            settlementAmount: total,
            currency: "IDR",
            status: "COMPLETED",
            paymentStatus: "PAID",
            paidAmount: total,
            totalInvoiceCount: 1,
            totalInvoiceAmount: total,
        },
    });

    const invoice = await prisma.invoice.create({
        data: {
            invoiceNumber: INV_NUMBER,
            taxInvoiceNumber: INV_NUMBER,
            outletId: OUTLET_ID,
            supplierId: supplier.id,
            purchaseOrderId: po.id,
            invoiceSettlementId: settlement.id,
            subtotalAmount: total,
            taxAmount: 0,
            discountAmount: 0,
            totalAmount: total,
            currency: "IDR",
            status: "Paid",
            invoiceDate: new Date(),
            invoiceItems: {
                create: [{
                    itemId: item.id,
                    quantity: RECEIVED,
                    unitPrice: UNIT_COST,
                    subtotal: total,
                }],
            },
        },
    });

    // ---- 3. delivery order + goods receipt ---------------------------------
    const deliveryOrder = await prisma.deliveryOrder.create({
        data: {
            trackingNumber: "SEED-RET-DO-001",
            outletId: OUTLET_ID,
            supplierId: supplier.id,
            purchaseOrderId: po.id,
            invoiceId: invoice.id,
            status: "DELIVERED",
            deliveryDate: new Date(),
            deliveryOrderItems: {
                create: [{
                    itemId: item.id,
                    orderedQuantity: RECEIVED,
                    receivedQuantity: RECEIVED,
                    unitPrice: UNIT_COST,
                }],
            },
        },
    });

    // The return shrinks THIS receipt layer, so it must exist and still hold the
    // remaining units (production had 3 left of the original 6 for the same reason).
    await prisma.stockReceipt.create({
        data: {
            itemId: item.id,
            outletId: OUTLET_ID,
            deliveryOrderId: deliveryOrder.id,
            quantity: RECEIVED - SOLD,
            cost: UNIT_COST,
            receiptDate: new Date(),
        },
    });

    // ---- 4. stock balance: received 6, sold 3, 3 left ----------------------
    const remaining = RECEIVED - SOLD;
    const existing = await prisma.stockBalance.findFirst({
        where: { itemId: item.id, outletId: OUTLET_ID, itemVariantId: null, deleted: false },
    });
    if (existing) {
        await prisma.stockBalance.update({
            where: { id: existing.id },
            data: { availableQuantity: remaining, onHandQuantity: remaining, updatedAt: new Date() },
        });
    } else {
        await prisma.stockBalance.create({
            data: { itemId: item.id, outletId: OUTLET_ID, availableQuantity: remaining, onHandQuantity: remaining },
        });
    }

    // ---- 5. the movements that explain the gap (audit realism) -------------
    await prisma.stockMovement.create({
        data: {
            itemId: item.id, outletId: OUTLET_ID,
            previousAvailableQuantity: 0, previousOnHandQuantity: 0,
            availableQuantityDelta: RECEIVED, onHandQuantityDelta: RECEIVED,
            movementType: "Delivery Receipt", documentId: deliveryOrder.id,
            reason: `SEED-RET goods receipt from delivery order #${deliveryOrder.id}`,
        },
    });
    for (let i = 0; i < SOLD; i++) {
        const prev = RECEIVED - i;
        await prisma.stockMovement.create({
            data: {
                itemId: item.id, outletId: OUTLET_ID,
                previousAvailableQuantity: prev, previousOnHandQuantity: prev,
                availableQuantityDelta: -1, onHandQuantityDelta: -1,
                movementType: "Sales", documentId: 0,
                reason: "SEED-RET sales transaction",
            },
        });
    }

    console.log(`
Seeded in ${TENANT_DB}:
  item        ${item.itemName}${item.itemCode ? ` (${item.itemCode})` : ""}  [id ${item.id}]
  supplier    ${supplier.companyName}  [id ${supplier.id}]
  PO          ${PO_NUMBER}            [id ${po.id}]
  invoice     ${INV_NUMBER}  status Paid  [id ${invoice.id}]
  DO          SEED-RET-DO-001         [id ${deliveryOrder.id}]
  received ${RECEIVED}  sold ${SOLD}  ->  ON HAND ${remaining}

Now: Purchase Return -> invoice ${INV_NUMBER} -> return quantity 4 -> Save
  expect HTTP 400, errorCode STOCK_INSUFFICIENT_RETURN
  returning ${remaining} or fewer should succeed
`);
}

main()
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(async () => { await disconnectAllPrismaClients(); });
