/**
 * QA HANDOVER smoke run — WAREHOUSE_TEST_HANDOVER.md §4.2 / §4.3 / §4.4 (backend logic).
 *
 * Adapted from smoke_split_sourcing.ts to run against the QA handover tenant
 * (demo_retail_db / tenant 22) instead of the reference dev's web_bytes_db.
 *
 * Uses THROWAWAY temp items and hard-deletes them afterwards, so the pre-loaded
 * RTL0006 / RTL0009 fixtures are left completely untouched for the UI pass.
 *
 * LOCAL ONLY.
 *   npx tsx src/script/smoke_warehouse_qa.ts
 */
import "reflect-metadata";
import dotenv from "dotenv";
dotenv.config();

import { Decimal } from "decimal.js";
import { getTenantPrisma, disconnectAllPrismaClients } from "../db";
import service from "../sales/sales.service";

const DB = "demo_retail_db";
const TENANT_ID = 22;
const OUTLET_ID = 1;
const WAREHOUSE_ID = 1;
const SESSION_ID = 1;

const results: { name: string; pass: boolean; detail: string }[] = [];
function check(name: string, pass: boolean, detail = "") {
    results.push({ name, pass, detail });
    if (!pass) console.log(`   x ${name} — ${detail}`);
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

/** Seeds an outlet balance row. qty === 0 still creates the row (mirrors RTL0006). */
async function seedOutlet(prisma: any, itemId: number, qty: number, cost: number) {
    if (qty > 0) {
        await prisma.stockReceipt.create({
            data: { itemId, outletId: OUTLET_ID, quantity: new Decimal(qty), cost: new Decimal(cost), receiptDate: new Date("2024-01-01T00:00:00Z") },
        });
    }
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
        sessionId: SESSION_ID,
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
            sessionId: SESSION_ID,
            eodId: 0,
            performedBy: "SMOKE",
            deleted: false,
        } as any,
    ];
}

async function cleanupItem(prisma: any, itemId: number) {
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

// NOTE: completeNewSales resolves the override permission LIVE from the tenant DB
// (sales.service.ts ~1500) and ignores the array above except as a DB-error fallback.
// So the §4.4 scenarios must use REAL seeded users to be meaningful:
//   userId 1 = demo_retail (Super Admin, '*')
//   userId 2 = qa_cashier  (NO  'Override Stock Source')
//   userId 3 = qa_manager  (HAS 'Override Stock Source')
const asUser = (userId: number, username: string) => ({ userId, username, loyaltyTier: "none" as const, permissions: [] as string[] });

async function outletBal(prisma: any, itemId: number) {
    const b = await prisma.stockBalance.findFirst({ where: { itemId, outletId: OUTLET_ID, itemVariantId: null, deleted: false }, select: { availableQuantity: true } });
    return n(b?.availableQuantity);
}
async function whBal(prisma: any, itemId: number) {
    const b = await prisma.warehouseStockBalance.findFirst({ where: { itemId, warehouseId: WAREHOUSE_ID, itemVariantId: null, deleted: false }, select: { availableQuantity: true } });
    return n(b?.availableQuantity);
}

/** §4.2 — outlet qty 0, warehouse qty > 0: must be sellable, sourced from warehouse. */
async function scenarioWarehouseOnly(prisma: any) {
    const itemId = await createTempItem(prisma, "SMOKE_WH_ONLY");
    try {
        await seedOutlet(prisma, itemId, 0, 100);   // balance row exists, qty 0 (mirrors RTL0006)
        await seedWarehouse(prisma, itemId, 10, 120);
        const created = await service.completeNewSales(DB, TENANT_ID, performedBy(), buildSale(itemId, 4), buildPayment(4));
        const sale = await prisma.sales.findUnique({ where: { id: created.id }, select: { stockSourceType: true, stockSourceWarehouseId: true } });
        check("§4.2 outlet-0 item IS sellable (sale created)", !!created?.id, `id=${created?.id}`);
        check("§4.2 sale type WAREHOUSE", sale?.stockSourceType === "WAREHOUSE", `got ${sale?.stockSourceType}`);
        check("§4.2 warehouseId recorded", sale?.stockSourceWarehouseId === WAREHOUSE_ID, `got ${sale?.stockSourceWarehouseId}`);
        check("§4.2 outlet stays 0", (await outletBal(prisma, itemId)) === 0, `outlet=${await outletBal(prisma, itemId)}`);
        check("§4.2 warehouse 10 → 6", (await whBal(prisma, itemId)) === 6, `wh=${await whBal(prisma, itemId)}`);
        const wm = await prisma.warehouseStockMovement.findFirst({ where: { itemId, warehouseId: WAREHOUSE_ID, movementType: "Sales" }, select: { availableQuantityDelta: true } });
        check("§4.2 warehouse movement -4", n(wm?.availableQuantityDelta) === -4, `got ${wm?.availableQuantityDelta}`);
        const om = await prisma.stockMovement.findFirst({ where: { itemId, outletId: OUTLET_ID, movementType: "Sales" } });
        check("§4.2 NO outlet movement row", !om, `got ${om ? "a movement row" : "none"}`);
    } finally {
        await cleanupItem(prisma, itemId);
    }
}

/** §4.3 — outlet-first then warehouse, MIXED. */
async function scenarioSplitMixed(prisma: any) {
    const itemId = await createTempItem(prisma, "SMOKE_SPLIT");
    try {
        await seedOutlet(prisma, itemId, 2, 100);
        await seedWarehouse(prisma, itemId, 3, 120);
        const created = await service.completeNewSales(DB, TENANT_ID, performedBy(), buildSale(itemId, 5), buildPayment(5));
        const sale = await prisma.sales.findUnique({ where: { id: created.id }, select: { stockSourceType: true, stockSourceOutletId: true, stockSourceWarehouseId: true } });
        check("§4.3 split: outlet 2 → 0", (await outletBal(prisma, itemId)) === 0, `outlet=${await outletBal(prisma, itemId)}`);
        check("§4.3 split: warehouse 3 → 0", (await whBal(prisma, itemId)) === 0, `wh=${await whBal(prisma, itemId)}`);
        check("§4.3 split: sale type MIXED", sale?.stockSourceType === "MIXED", `got ${sale?.stockSourceType}`);
        check("§4.3 split: outletId recorded", sale?.stockSourceOutletId === OUTLET_ID, `got ${sale?.stockSourceOutletId}`);
        check("§4.3 split: warehouseId recorded", sale?.stockSourceWarehouseId === WAREHOUSE_ID, `got ${sale?.stockSourceWarehouseId}`);
        const om = await prisma.stockMovement.findFirst({ where: { itemId, outletId: OUTLET_ID, movementType: "Sales" }, select: { availableQuantityDelta: true } });
        const wm = await prisma.warehouseStockMovement.findFirst({ where: { itemId, warehouseId: WAREHOUSE_ID, movementType: "Sales" }, select: { availableQuantityDelta: true } });
        check("§4.3 split: outlet movement -2", n(om?.availableQuantityDelta) === -2, `got ${om?.availableQuantityDelta}`);
        check("§4.3 split: warehouse movement -3", n(wm?.availableQuantityDelta) === -3, `got ${wm?.availableQuantityDelta}`);
        const items = await prisma.salesItem.findMany({ where: { salesId: created.id }, select: { quantity: true, cost: true } });
        const totalQty = items.reduce((s: number, r: any) => s + n(r.quantity), 0);
        check("§4.3 split: sales_item qty sums to 5", totalQty === 5, `got ${totalQty}`);
        const costSum = items.reduce((s: number, r: any) => s + n(r.cost), 0);
        check("§4.3 split: COGS = 2*100 + 3*120 = 560", costSum === 560, `got ${costSum}`);
    } finally {
        await cleanupItem(prisma, itemId);
    }
}

/** §4.3 — combined short: rejected up front, NO partial deduction. */
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
            check("§4.3 short: error mentions '(outlet + warehouse)'", /outlet \+ warehouse/.test(e?.message ?? ""), `msg: ${e?.message}`);
        }
        check("§4.3 short: sale rejected", threw, "expected BusinessLogicError");
        check("§4.3 short: outlet untouched (2)", (await outletBal(prisma, itemId)) === 2, `outlet=${await outletBal(prisma, itemId)}`);
        check("§4.3 short: warehouse untouched (1)", (await whBal(prisma, itemId)) === 1, `wh=${await whBal(prisma, itemId)}`);
        const saleCount = await prisma.salesItem.count({ where: { itemId } });
        check("§4.3 short: no sale persisted", saleCount === 0, `got ${saleCount}`);
    } finally {
        await cleanupItem(prisma, itemId);
    }
}

/** §4.4 — override WITH permission forces warehouse. */
async function scenarioOverrideWarehouse(prisma: any) {
    const itemId = await createTempItem(prisma, "SMOKE_OVR");
    try {
        await seedOutlet(prisma, itemId, 5, 100);
        await seedWarehouse(prisma, itemId, 5, 120);
        const created = await service.completeNewSales(
            DB, TENANT_ID, asUser(3, "qa_manager"),
            buildSale(itemId, 3, { stockSourceType: "WAREHOUSE", stockSourceWarehouseId: WAREHOUSE_ID }),
            buildPayment(3)
        );
        const sale = await prisma.sales.findUnique({ where: { id: created.id }, select: { stockSourceType: true } });
        check("§4.4 qa_manager(HAS perm): outlet UNTOUCHED (5)", (await outletBal(prisma, itemId)) === 5, `outlet=${await outletBal(prisma, itemId)}`);
        check("§4.4 qa_manager(HAS perm): warehouse 5 → 2", (await whBal(prisma, itemId)) === 2, `wh=${await whBal(prisma, itemId)}`);
        check("§4.4 qa_manager(HAS perm): sale type WAREHOUSE", sale?.stockSourceType === "WAREHOUSE", `got ${sale?.stockSourceType}`);
    } finally {
        await cleanupItem(prisma, itemId);
    }
}

/** §4.4 — override WITHOUT permission is ignored (server-side enforcement). */
async function scenarioOverrideIgnoredNoPerm(prisma: any) {
    const itemId = await createTempItem(prisma, "SMOKE_NOPERM");
    try {
        await seedOutlet(prisma, itemId, 5, 100);
        await seedWarehouse(prisma, itemId, 5, 120);
        const created = await service.completeNewSales(
            DB, TENANT_ID, asUser(2, "qa_cashier"), // NO override permission
            buildSale(itemId, 3, { stockSourceType: "WAREHOUSE", stockSourceWarehouseId: WAREHOUSE_ID }),
            buildPayment(3)
        );
        const sale = await prisma.sales.findUnique({ where: { id: created.id }, select: { stockSourceType: true } });
        check("§4.4 qa_cashier(NO perm): forced source IGNORED → outlet 5 → 2", (await outletBal(prisma, itemId)) === 2, `outlet=${await outletBal(prisma, itemId)}`);
        check("§4.4 qa_cashier(NO perm): warehouse untouched (5)", (await whBal(prisma, itemId)) === 5, `wh=${await whBal(prisma, itemId)}`);
        check("§4.4 qa_cashier(NO perm): sale type OUTLET", sale?.stockSourceType === "OUTLET", `got ${sale?.stockSourceType}`);
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
    console.log("Running WAREHOUSE QA smoke scenarios against", DB, "(tenant", TENANT_ID + ")");
    await scenarioWarehouseOnly(prisma);
    await scenarioSplitMixed(prisma);
    await scenarioCombinedShort(prisma);
    await scenarioOverrideWarehouse(prisma);
    await scenarioOverrideIgnoredNoPerm(prisma);
}

main()
    .then(() => {
        const passed = results.filter((r) => r.pass).length;
        console.log("\n──────── WAREHOUSE QA SMOKE RESULTS ────────");
        for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.pass ? "" : `  (${r.detail})`}`);
        console.log(`\n${passed}/${results.length} checks passed. (Temp items hard-deleted — RTL0006/RTL0009 untouched.)`);
        return disconnectAllPrismaClients();
    })
    .then(() => process.exit(results.every((r) => r.pass) ? 0 : 1))
    .catch(async (e) => {
        console.error("SMOKE TEST ERROR:", e);
        await disconnectAllPrismaClients().catch(() => {});
        process.exit(1);
    });
