/**
 * E2E test for gap-sale profit restatement (run: npx ts-node src/script/test_restatement_e2e.ts)
 *
 * Flow on web_bytes_db using the REAL services:
 *   1. PO (unitPrice 50,000) → DO (qty 10, deliveryFee 25,000 total → receipt cost 52,500/unit)
 *   2. Sale of 2 units at 100,000 → line cost 105,000, profit 95,000, STOCK_RECEIPT_ID stamped
 *   3. Invoice with 15,000/unit supplier discount → receipt re-priced to 37,500
 *      → sale line restated: cost 75,000, profit 125,000; Sales.PROFIT_AMOUNT re-summed
 *   4. Cleanup of all created rows.
 */
import 'reflect-metadata';
import { PrismaClient } from "../../prisma/client/generated/client";
import { getTenantPrisma } from '../db';
import { Decimal as PrismaDecimal } from "../../prisma/client/generated/client/runtime/library";

const DB = 'web_bytes_db';
const OUTLET_ID = 1;
const TAG = `RESTATE_E2E_${Date.now()}`;

const poService = require('../purchase_order/purchase-order.service');
const doService = require('../delivery_order/delivery-order.service');
const salesService = require('../sales/sales.service');
const invoiceService = require('../invoice/invoice.service');
const transferService = require('../stock/stock-transfer.service');

const D = (n: number) => new PrismaDecimal(n);

async function main() {
    const prisma: PrismaClient = getTenantPrisma(DB);
    const created: { [k: string]: number } = {};

    const fail = (msg: string) => { throw new Error(`ASSERTION FAILED: ${msg}`); };
    const expect = (label: string, actual: any, expected: number) => {
        const a = Number(actual);
        if (Math.abs(a - expected) > 0.0001) fail(`${label}: expected ${expected}, got ${a}`);
        console.log(`  ✓ ${label} = ${a}`);
    };

    try {
        // ── Setup master data ──
        const category = await prisma.category.findFirstOrThrow({ select: { id: true } });
        const supplier = await prisma.supplier.create({ data: { companyName: TAG, hasTax: false } });
        created.supplier = supplier.id;
        const item = await prisma.item.create({
            data: {
                itemName: TAG, itemCode: TAG,
                category: { connect: { id: category.id } },
                supplier: { connect: { id: supplier.id } },
                cost: 0, price: 100000, trackStock: true,
            }
        });
        created.item = item.id;
        console.log(`Setup: item ${item.id}, supplier ${supplier.id}`);

        // ── 1. PO + DO (qty 10 @ 50,000, delivery fee 25,000 total) ──
        const [po] = await poService.createMany(DB, {
            purchaseOrders: [{
                purchaseOrderNumber: TAG, outletId: OUTLET_ID, supplierId: supplier.id,
                subtotalAmount: D(500000), totalAmount: D(500000), status: 'CONFIRMED',
                purchaseOrderItems: [{
                    itemId: item.id, quantity: D(10), unitPrice: D(50000),
                    discountAmount: D(0), subtotal: D(500000),
                }],
            }]
        });
        created.po = po.id;

        const [deliveryOrder] = await doService.createMany(DB, {
            deliveryOrders: [{
                outletId: OUTLET_ID, purchaseOrderId: po.id, supplierId: supplier.id,
                status: 'DELIVERED',
                deliveryOrderItems: [{
                    itemId: item.id, orderedQuantity: 10, receivedQuantity: 10,
                    unitPrice: D(50000), deliveryFee: D(25000),
                }],
            }]
        });
        created.do = deliveryOrder.id;

        const receipt = await prisma.stockReceipt.findFirstOrThrow({
            where: { deliveryOrderId: deliveryOrder.id, deleted: false }
        });
        created.receipt = receipt.id;
        console.log(`\nStep 1 — DO received, receipt ${receipt.id}:`);
        expect('receipt cost (50,000 + 25,000/10)', receipt.cost, 52500);

        // ── 2. Sale of 2 units (gap sale, before invoice) ──
        const sale = await salesService.completeNewSales(
            DB, 11, { userId: 1, username: 'restate_e2e' },
            {
                outletId: OUTLET_ID, businessDate: new Date(), salesType: 'Retail',
                status: 'Completed', sessionId: 1, eodId: 1, remark: TAG,
                profitAmount: D(0), subtotalAmount: D(200000), totalAmount: D(200000),
                paidAmount: D(200000),
                salesItems: [{
                    itemId: item.id, itemCode: TAG, itemName: TAG, itemBrand: '', itemModel: '',
                    quantity: D(2), cost: D(0), price: D(100000), priceBeforeTax: D(100000),
                    profit: D(0), subtotalAmount: D(200000),
                }],
            },
            [{ method: 'CASH', tenderedAmount: D(200000), paidAmount: D(200000), businessDate: new Date(), sessionId: 1, eodId: 1, status: 'Completed', outletId: OUTLET_ID }]
        );
        created.sale = sale.id;

        const lineBefore = await prisma.salesItem.findFirstOrThrow({ where: { salesId: sale.id } });
        const headerBefore = await prisma.sales.findUniqueOrThrow({ where: { id: sale.id } });
        console.log(`\nStep 2 — sale ${sale.id} created (gap sale):`);
        expect('line cost (2 × 52,500)', lineBefore.cost, 105000);
        expect('line profit (200,000 − 105,000)', lineBefore.profit, 95000);
        expect('header profitAmount', headerBefore.profitAmount, 95000);
        if (lineBefore.stockReceiptId !== receipt.id) fail(`provenance link: expected ${receipt.id}, got ${lineBefore.stockReceiptId}`);
        console.log(`  ✓ STOCK_RECEIPT_ID stamped = ${lineBefore.stockReceiptId}`);

        // ── 3. Invoice with 15,000/unit supplier discount ──
        const [invoice] = await invoiceService.createMany(DB, {
            invoices: [{
                invoiceNumber: TAG, outletId: OUTLET_ID, supplierId: supplier.id,
                purchaseOrderId: po.id, deliveryOrderIds: [deliveryOrder.id],
                subtotalAmount: 500000, taxAmount: 0, discountAmount: 150000,
                discountType: 'FIXED', totalAmount: 350000, status: 'COMPLETED',
                invoiceItems: [{
                    itemId: item.id, quantity: 10, unitPrice: 50000,
                    discountAmount: 150000, discountType: 'FIXED', subtotal: 500000,
                }],
            }]
        });
        created.invoice = invoice.id;

        const receiptAfter = await prisma.stockReceipt.findUniqueOrThrow({ where: { id: receipt.id } });
        const lineAfter = await prisma.salesItem.findUniqueOrThrow({ where: { id: lineBefore.id } });
        const headerAfter = await prisma.sales.findUniqueOrThrow({ where: { id: sale.id } });
        console.log(`\nStep 3 — invoice ${invoice.id} with discount keyed in:`);
        expect('receipt re-priced (35,000 + 2,500)', receiptAfter.cost, 37500);
        expect('line cost restated (2 × 37,500)', lineAfter.cost, 75000);
        expect('line profit restated (200,000 − 75,000)', lineAfter.profit, 125000);
        expect('header profitAmount re-summed', headerAfter.profitAmount, 125000);
        if ((lineAfter.version ?? 0) <= (lineBefore.version ?? 0)) fail('line version not bumped (delta sync would miss it)');
        console.log(`  ✓ line version bumped ${lineBefore.version} → ${lineAfter.version}`);

        console.log('\n✅ SCENARIO A (outlet DO, gap sale) PASSED');

        // ════════════════════════════════════════════════════════════════════
        // SCENARIO B — warehouse-destination DO → transfer to outlet → gap sale
        //              → discounted invoice re-prices BOTH locations + restates
        // ════════════════════════════════════════════════════════════════════
        const warehouse = await prisma.warehouse.create({
            data: { tenantWarehouseId: 999, warehouseName: TAG, warehouseCode: TAG }
        });
        created.warehouse = warehouse.id;

        const itemB = await prisma.item.create({
            data: {
                itemName: `${TAG}_B`, itemCode: `${TAG}_B`,
                category: { connect: { id: category.id } },
                supplier: { connect: { id: supplier.id } },
                cost: 0, price: 100000, trackStock: true,
            }
        });
        created.itemB = itemB.id;

        // PO + warehouse-destination DO: 10 @ 50,000 + 25,000 fee → 52,500/unit
        const [poB] = await poService.createMany(DB, {
            purchaseOrders: [{
                purchaseOrderNumber: `${TAG}_B`, outletId: OUTLET_ID, supplierId: supplier.id,
                subtotalAmount: D(500000), totalAmount: D(500000), status: 'CONFIRMED',
                purchaseOrderItems: [{
                    itemId: itemB.id, quantity: D(10), unitPrice: D(50000),
                    discountAmount: D(0), subtotal: D(500000),
                }],
            }]
        });
        created.poB = poB.id;

        const [doB] = await doService.createMany(DB, {
            deliveryOrders: [{
                outletId: OUTLET_ID, purchaseOrderId: poB.id, supplierId: supplier.id,
                status: 'DELIVERED', destinationLocationType: 'WAREHOUSE', warehouseId: warehouse.id,
                deliveryOrderItems: [{
                    itemId: itemB.id, orderedQuantity: 10, receivedQuantity: 10,
                    unitPrice: D(50000), deliveryFee: D(25000),
                }],
            }]
        });
        created.doB = doB.id;

        const whReceipt = await prisma.warehouseStockReceipt.findFirstOrThrow({
            where: { warehouseId: warehouse.id, itemId: itemB.id, deleted: false }
        });
        console.log(`\nStep B1 — warehouse DO received, wh receipt ${whReceipt.id}:`);
        expect('warehouse receipt cost', whReceipt.cost, 52500);
        if (whReceipt.deliveryOrderId !== doB.id) fail(`wh receipt deliveryOrderId: expected ${doB.id}, got ${whReceipt.deliveryOrderId}`);
        console.log(`  ✓ wh receipt carries deliveryOrderId = ${whReceipt.deliveryOrderId}`);

        // Transfer 4 units warehouse → outlet (provenance must survive the move)
        await transferService.transferStock(DB, {
            sourceType: 'WAREHOUSE', sourceId: warehouse.id,
            destType: 'OUTLET', destId: OUTLET_ID,
            items: [{ itemId: itemB.id, quantity: 4 }],
            performedBy: 'restate_e2e',
        });
        const transferredReceipt = await prisma.stockReceipt.findFirstOrThrow({
            where: { outletId: OUTLET_ID, itemId: itemB.id, deleted: false }
        });
        console.log(`\nStep B2 — transferred 4 units to outlet, receipt ${transferredReceipt.id}:`);
        expect('transferred receipt cost preserved', transferredReceipt.cost, 52500);
        if (transferredReceipt.deliveryOrderId !== doB.id) fail(`transferred receipt deliveryOrderId: expected ${doB.id}, got ${transferredReceipt.deliveryOrderId}`);
        console.log(`  ✓ provenance survived transfer: deliveryOrderId = ${transferredReceipt.deliveryOrderId}`);

        // Gap sale at the OUTLET from the transferred layer (2 units @ 100,000)
        const saleB = await salesService.completeNewSales(
            DB, 11, { userId: 1, username: 'restate_e2e' },
            {
                outletId: OUTLET_ID, businessDate: new Date(), salesType: 'Retail',
                status: 'Completed', sessionId: 1, eodId: 1, remark: TAG,
                profitAmount: D(0), subtotalAmount: D(200000), totalAmount: D(200000),
                paidAmount: D(200000),
                salesItems: [{
                    itemId: itemB.id, itemCode: `${TAG}_B`, itemName: `${TAG}_B`, itemBrand: '', itemModel: '',
                    quantity: D(2), cost: D(0), price: D(100000), priceBeforeTax: D(100000),
                    profit: D(0), subtotalAmount: D(200000),
                }],
            },
            [{ method: 'CASH', tenderedAmount: D(200000), paidAmount: D(200000), businessDate: new Date(), sessionId: 1, eodId: 1, status: 'Completed', outletId: OUTLET_ID }]
        );
        created.saleB = saleB.id;
        const lineB = await prisma.salesItem.findFirstOrThrow({ where: { salesId: saleB.id } });
        console.log(`\nStep B3 — gap sale ${saleB.id} at outlet from transferred layer:`);
        expect('line profit (pre-invoice)', lineB.profit, 95000);
        if (lineB.stockReceiptId !== transferredReceipt.id) fail(`line link: expected ${transferredReceipt.id}, got ${lineB.stockReceiptId}`);
        console.log(`  ✓ line linked to transferred receipt ${lineB.stockReceiptId}`);

        // Discounted invoice (15,000/unit) → must re-price warehouse AND outlet layers + restate
        const [invB] = await invoiceService.createMany(DB, {
            invoices: [{
                invoiceNumber: `${TAG}_B`, outletId: OUTLET_ID, supplierId: supplier.id,
                purchaseOrderId: poB.id, deliveryOrderIds: [doB.id],
                subtotalAmount: 500000, taxAmount: 0, discountAmount: 150000,
                discountType: 'FIXED', totalAmount: 350000, status: 'COMPLETED',
                invoiceItems: [{
                    itemId: itemB.id, quantity: 10, unitPrice: 50000,
                    discountAmount: 150000, discountType: 'FIXED', subtotal: 500000,
                }],
            }]
        });
        created.invB = invB.id;

        const whReceiptAfter = await prisma.warehouseStockReceipt.findUniqueOrThrow({ where: { id: whReceipt.id } });
        const trReceiptAfter = await prisma.stockReceipt.findUniqueOrThrow({ where: { id: transferredReceipt.id } });
        const lineBAfter = await prisma.salesItem.findUniqueOrThrow({ where: { id: lineB.id } });
        const headerBAfter = await prisma.sales.findUniqueOrThrow({ where: { id: saleB.id } });
        console.log(`\nStep B4 — discounted invoice ${invB.id} keyed in:`);
        expect('warehouse receipt re-priced', whReceiptAfter.cost, 37500);
        expect('TRANSFERRED outlet receipt re-priced', trReceiptAfter.cost, 37500);
        expect('gap-sale line cost restated', lineBAfter.cost, 75000);
        expect('gap-sale line profit restated', lineBAfter.profit, 125000);
        expect('header profitAmount re-summed', headerBAfter.profitAmount, 125000);

        console.log('\n✅ SCENARIO B (warehouse DO → transfer → gap sale) PASSED');
        console.log('\n✅ ALL ASSERTIONS PASSED');
    } finally {
        // ── Cleanup (hard delete everything this test created) ──
        console.log('\nCleanup…');
        for (const saleId of [created.sale, created.saleB]) {
            if (!saleId) continue;
            await prisma.payment.deleteMany({ where: { salesId: saleId } });
            await prisma.salesItem.deleteMany({ where: { salesId: saleId } });
            await prisma.sales.delete({ where: { id: saleId } }).catch(() => { });
        }
        for (const invId of [created.invoice, created.invB]) {
            if (!invId) continue;
            await prisma.invoiceItem.deleteMany({ where: { invoiceId: invId } });
            await prisma.invoice.delete({ where: { id: invId } }).catch(() => { });
        }
        for (const itemId of [created.item, created.itemB]) {
            if (!itemId) continue;
            await prisma.stockMovement.deleteMany({ where: { itemId } });
            await prisma.stockReceipt.deleteMany({ where: { itemId } });
            await prisma.stockBalance.deleteMany({ where: { itemId } });
            await prisma.warehouseStockMovement.deleteMany({ where: { itemId } });
            await prisma.warehouseStockReceipt.deleteMany({ where: { itemId } });
            await prisma.warehouseStockBalance.deleteMany({ where: { itemId } });
        }
        for (const doId of [created.do, created.doB]) {
            if (!doId) continue;
            await prisma.deliveryOrderItem.deleteMany({ where: { deliveryOrderId: doId } });
            await prisma.deliveryOrder.delete({ where: { id: doId } }).catch(() => { });
        }
        for (const poId of [created.po, created.poB]) {
            if (!poId) continue;
            await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: poId } });
            await prisma.purchaseOrder.delete({ where: { id: poId } }).catch(() => { });
        }
        for (const itemId of [created.item, created.itemB]) {
            if (itemId) await prisma.item.delete({ where: { id: itemId } }).catch(() => { });
        }
        if (created.warehouse) await prisma.warehouse.delete({ where: { id: created.warehouse } }).catch(() => { });
        if (created.supplier) await prisma.supplier.delete({ where: { id: created.supplier } }).catch(() => { });
        console.log('Cleanup done.');
        await prisma.$disconnect();
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
