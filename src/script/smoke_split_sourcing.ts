/**
 * Smoke test for AD6 per-line split stock sourcing in completeNewSales.
 *
 * Runs REAL sales against the LOCAL test tenant DB (web_bytes_db) using throwaway
 * temp items, asserts the per-location FIFO split / override / combined-short
 * behaviour, then HARD-DELETES everything it created (temp item + its sales /
 * receipts / balances / movements). LOCAL ONLY — never point this at prod.
 *
 *   npx tsx src/script/smoke_split_sourcing.ts
 */
import "reflect-metadata";
import dotenv from "dotenv";
dotenv.config();

import { Decimal } from "decimal.js";
import { getTenantPrisma, disconnectAllPrismaClients } from "../db";
import service from "../sales/sales.service";

const DB = "web_bytes_db";
const TENANT_ID = 1;
const OUTLET_ID = 1;
const WAREHOUSE_ID = 1;

const results: { name: string; pass: boolean; detail: string }[] = [];
function check(name: string, pass: boolean, detail = "") {
    results.push({ name, pass, detail });
    if (!pass) console.log(`   ✗ ${name} — ${detail}`);
}
const n = (v: any) => new Decimal(v ?? 0).toNumber();

let CATEGORY_ID = 0;
let SUPPLIER_ID = 0;

async function createTempItem(prisma: any, code: string): Promise<number> {
    const it = await prisma.item.create({
        data: {
            itemName: code,
            itemCode: code,
            itemBrand: "",
            itemModel: "",
            category: { connect: { id: CATEGORY_ID } },
            supplier: { connect: { id: SUPPLIER_ID } },
            cost: new Decimal(50),
            price: new Decimal(200),
            unitOfMeasure: "Piece",
            trackStock: true,
            hasVariants: false,
        },
        select: { id: true },
    });
    return it.id;
}

async function seedOutlet(prisma: any, itemId: number, qty: number, cost: number) {
    if (qty <= 0) return;
    await prisma.stockReceipt.create({
        data: { itemId, outletId: OUTLET_ID, quantity: new Decimal(qty), cost: new Decimal(cost), receiptDate: new Date("2024-01-01T00:00:00Z") },
    });
    await prisma.stockBalance.create({
        data: { itemId, outletId: OUTLET_ID, availableQuantity: new Decimal(qty), onHandQuantity: new Decimal(qty) },
    });
}

async function seedWarehouse(prisma: any, itemId: number, qty: number, cost: number) {
    if (qty <= 0) return;
    await prisma.warehouseStockReceipt.create({
        data: { itemId, warehouseId: WAREHOUSE_ID, quantity: new Decimal(qty), cost: new Decimal(cost), receiptDate: new Date("2024-02-01T00:00:00Z") },
    });
    await prisma.warehouseStockBalance.create({
        data: { itemId, warehouseId: WAREHOUSE_ID, availableQuantity: new Decimal(qty), onHandQuantity: new Decimal(qty) },
    });
}

function buildSale(itemId: number, qty: number, opts: { stockSourceType?: string; stockSourceWarehouseId?: number } = {}) {
    const price = 200;
    const subtotal = price * qty;
    return {
        outletId: OUTLET_ID,
        businessDate: new Date(),
        salesType: "Retail",
        customerId: undefined,
        customerName: "SMOKE",
        phoneNumber: "",
        totalItemDiscountAmount: new Decimal(0),
        discountAmount: new Decimal(0),
        discountPercentage: new Decimal(0),
        serviceChargeAmount: new Decimal(0),
        taxAmount: new Decimal(0),
        roundingAmount: new Decimal(0),
        subtotalAmount: new Decimal(subtotal),
        totalAmount: new Decimal(subtotal),
        profitAmount: new Decimal(0),
        status: "Completed",
        sessionId: 4,
        eodId: 0,
        performedBy: "SMOKE",
        siteId: undefined,
        stockSourceType: opts.stockSourceType,
        stockSourceWarehouseId: opts.stockSourceWarehouseId,
        salesItems: [
            {
                id: 0,
                salesId: 0,
                itemId,
                itemVariantId: null,
                itemCode: "SMOKE",
                itemName: "SMOKE",
                itemBrand: "",
                itemModel: "",
                quantity: new Decimal(qty),
                cost: new Decimal(50),
                price: new Decimal(price),
                priceBeforeTax: new Decimal(price),
                profit: new Decimal(0),
                discountAmount: new Decimal(0),
                serviceChargeAmount: new Decimal(0),
                taxAmount: new Decimal(0),
                subtotalAmount: new Decimal(subtotal),
                remark: "",
            },
        ],
    } as any;
}

function buildPayment(qty: number) {
    const amount = 200 * qty;
    return [
        {
            method: "Cash",
            tenderedAmount: new Decimal(amount),
            paidAmount: new Decimal(amount),
            currencySymbol: "Rp",
            reference: "",
            remark: "",
            businessDate: new Date(),
            status: "PAID",
            outletId: OUTLET_ID,
            sessionId: 4,
            eodId: 0,
            performedBy: "SMOKE",
            deleted: false,
        } as any,
    ];
}

async function cleanupItem(prisma: any, itemId: number) {
    // Find sales that reference this item (via sales_item), then hard-delete the chain.
    const saleItems = await prisma.salesItem.findMany({ where: { itemId }, select: { salesId: true } });
    const saleIds = [...new Set(saleItems.map((s: any) => s.salesId))];
    if (saleIds.length) {
        await prisma.payment.deleteMany({ where: { salesId: { in: saleIds } } });
        await prisma.salesItem.deleteMany({ where: { salesId: { in: saleIds } } });
        await prisma.sales.deleteMany({ where: { id: { in: saleIds } } });
    }
    await prisma.stockMovement.deleteMany({ where: { itemId } });
    await prisma.warehouseStockMovement.deleteMany({ where: { itemId } });
    await prisma.stockReceipt.deleteMany({ where: { itemId } });
    await prisma.warehouseStockReceipt.deleteMany({ where: { itemId } });
    await prisma.stockBalance.deleteMany({ where: { itemId } });
    await prisma.warehouseStockBalance.deleteMany({ where: { itemId } });
    await prisma.item.deleteMany({ where: { id: itemId } });
}

const performedBy = (permissions: string[] = []) => ({ userId: 1, username: "SMOKE", loyaltyTier: "none" as const, permissions });

async function outletBal(prisma: any, itemId: number) {
    const b = await prisma.stockBalance.findFirst({ where: { itemId, outletId: OUTLET_ID, itemVariantId: null, deleted: false }, select: { availableQuantity: true } });
    return n(b?.availableQuantity);
}
async function whBal(prisma: any, itemId: number) {
    const b = await prisma.warehouseStockBalance.findFirst({ where: { itemId, warehouseId: WAREHOUSE_ID, itemVariantId: null, deleted: false }, select: { availableQuantity: true } });
    return n(b?.availableQuantity);
}

async function scenarioSplitMixed(prisma: any) {
    const itemId = await createTempItem(prisma, "SMOKE_SPLIT");
    try {
        await seedOutlet(prisma, itemId, 2, 100);
        await seedWarehouse(prisma, itemId, 4, 120);
        const created = await service.completeNewSales(DB, TENANT_ID, performedBy(), buildSale(itemId, 5), buildPayment(5));
        const sale = await prisma.sales.findUnique({ where: { id: created.id }, select: { stockSourceType: true, stockSourceOutletId: true, stockSourceWarehouseId: true } });
        check("split: outlet drained to 0", (await outletBal(prisma, itemId)) === 0, `outlet=${await outletBal(prisma, itemId)}`);
        check("split: warehouse 4 → 1", (await whBal(prisma, itemId)) === 1, `wh=${await whBal(prisma, itemId)}`);
        check("split: sale type MIXED", sale?.stockSourceType === "MIXED", `got ${sale?.stockSourceType}`);
        check("split: outletId recorded", sale?.stockSourceOutletId === OUTLET_ID, `got ${sale?.stockSourceOutletId}`);
        check("split: warehouseId recorded", sale?.stockSourceWarehouseId === WAREHOUSE_ID, `got ${sale?.stockSourceWarehouseId}`);
        const om = await prisma.stockMovement.findFirst({ where: { itemId, outletId: OUTLET_ID, movementType: "Sales" }, select: { availableQuantityDelta: true } });
        const wm = await prisma.warehouseStockMovement.findFirst({ where: { itemId, warehouseId: WAREHOUSE_ID, movementType: "Sales" }, select: { availableQuantityDelta: true } });
        check("split: outlet movement -2", n(om?.availableQuantityDelta) === -2, `got ${om?.availableQuantityDelta}`);
        check("split: warehouse movement -3", n(wm?.availableQuantityDelta) === -3, `got ${wm?.availableQuantityDelta}`);
        const items = await prisma.salesItem.findMany({ where: { salesId: created.id }, select: { quantity: true, cost: true } });
        const totalQty = items.reduce((s: number, r: any) => s + n(r.quantity), 0);
        check("split: sales_item qty sums to 5", totalQty === 5, `got ${totalQty}`);
        // COGS: 2@100 + 3@120 = 560 → per-unit cost rows present
        const costSum = items.reduce((s: number, r: any) => s + n(r.cost), 0);
        check("split: COGS = 2*100 + 3*120 = 560", costSum === 560, `got ${costSum}`);
    } finally {
        await cleanupItem(prisma, itemId);
    }
}

async function scenarioCombinedShort(prisma: any) {
    const itemId = await createTempItem(prisma, "SMOKE_SHORT");
    try {
        await seedOutlet(prisma, itemId, 2, 100);
        await seedWarehouse(prisma, itemId, 1, 120);
        let threw = false;
        try {
            await service.completeNewSales(DB, TENANT_ID, performedBy(), buildSale(itemId, 5), buildPayment(5));
        } catch (e: any) {
            threw = true;
            check("short: error mentions combined availability", /outlet \+ warehouse/.test(e?.message ?? ""), `msg: ${e?.message}`);
        }
        check("short: sale rejected", threw, "expected BusinessLogicError");
        check("short: outlet untouched (2)", (await outletBal(prisma, itemId)) === 2, `outlet=${await outletBal(prisma, itemId)}`);
        check("short: warehouse untouched (1)", (await whBal(prisma, itemId)) === 1, `wh=${await whBal(prisma, itemId)}`);
        const saleCount = await prisma.salesItem.count({ where: { itemId } });
        check("short: no sale persisted", saleCount === 0, `got ${saleCount}`);
    } finally {
        await cleanupItem(prisma, itemId);
    }
}

async function scenarioOverrideWarehouse(prisma: any) {
    const itemId = await createTempItem(prisma, "SMOKE_OVR");
    try {
        await seedOutlet(prisma, itemId, 5, 100);
        await seedWarehouse(prisma, itemId, 5, 120);
        const created = await service.completeNewSales(
            DB, TENANT_ID, performedBy(["*"]),
            buildSale(itemId, 3, { stockSourceType: "WAREHOUSE", stockSourceWarehouseId: WAREHOUSE_ID }),
            buildPayment(3)
        );
        const sale = await prisma.sales.findUnique({ where: { id: created.id }, select: { stockSourceType: true } });
        check("override: outlet UNTOUCHED (5)", (await outletBal(prisma, itemId)) === 5, `outlet=${await outletBal(prisma, itemId)}`);
        check("override: warehouse 5 → 2", (await whBal(prisma, itemId)) === 2, `wh=${await whBal(prisma, itemId)}`);
        check("override: sale type WAREHOUSE", sale?.stockSourceType === "WAREHOUSE", `got ${sale?.stockSourceType}`);
    } finally {
        await cleanupItem(prisma, itemId);
    }
}

async function scenarioOverrideIgnoredNoPerm(prisma: any) {
    const itemId = await createTempItem(prisma, "SMOKE_NOPERM");
    try {
        await seedOutlet(prisma, itemId, 5, 100);
        await seedWarehouse(prisma, itemId, 5, 120);
        const created = await service.completeNewSales(
            DB, TENANT_ID, performedBy([]), // no override permission
            buildSale(itemId, 3, { stockSourceType: "WAREHOUSE", stockSourceWarehouseId: WAREHOUSE_ID }),
            buildPayment(3)
        );
        const sale = await prisma.sales.findUnique({ where: { id: created.id }, select: { stockSourceType: true } });
        check("no-perm: explicit source IGNORED → outlet 5 → 2", (await outletBal(prisma, itemId)) === 2, `outlet=${await outletBal(prisma, itemId)}`);
        check("no-perm: warehouse untouched (5)", (await whBal(prisma, itemId)) === 5, `wh=${await whBal(prisma, itemId)}`);
        check("no-perm: sale type OUTLET", sale?.stockSourceType === "OUTLET", `got ${sale?.stockSourceType}`);
    } finally {
        await cleanupItem(prisma, itemId);
    }
}

async function main() {
    const prisma: any = getTenantPrisma(DB);
    const cat = await prisma.category.findFirst({ select: { id: true } });
    const sup = await prisma.supplier.findFirst({ select: { id: true } });
    if (!cat || !sup) throw new Error("Test DB missing a category or supplier");
    CATEGORY_ID = cat.id;
    SUPPLIER_ID = sup.id;
    console.log("Running split-sourcing smoke scenarios against", DB);
    await scenarioSplitMixed(prisma);
    await scenarioCombinedShort(prisma);
    await scenarioOverrideWarehouse(prisma);
    await scenarioOverrideIgnoredNoPerm(prisma);
}

main()
    .then(() => {
        const passed = results.filter((r) => r.pass).length;
        console.log("\n──────── SPLIT-SOURCING SMOKE RESULTS ────────");
        for (const r of results) console.log(`${r.pass ? "✅" : "❌"} ${r.name}${r.pass ? "" : `  (${r.detail})`}`);
        console.log(`\n${passed}/${results.length} checks passed. (Temp items hard-deleted — DB clean.)`);
        return disconnectAllPrismaClients();
    })
    .then(() => process.exit(results.every((r) => r.pass) ? 0 : 1))
    .catch(async (e) => {
        console.error("SMOKE TEST ERROR:", e);
        await disconnectAllPrismaClients().catch(() => {});
        process.exit(1);
    });
