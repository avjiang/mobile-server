/*
 * Smoke test: concurrent sale-reversal double-submit, against a LOCAL tenant DB.
 *
 * Reproduces the production incident of 2026-07-26 (audio_technic_db, sale
 * #6068): two PUT /sales/return/:id requests 197ms apart, distinct idempotency
 * keys, both admitted by the old `if (sales.status !== "Completed")` check —
 * stock restored twice.
 *
 * Unlike the unit tests (which model conditional-update semantics with a fake
 * tx), this drives the REAL service against REAL MySQL, so it exercises actual
 * transaction isolation and row locking. It is the check that proves the fix.
 *
 * Asserts, for each of return/void/refund:
 *   - exactly one of two concurrent calls succeeds, the other throws
 *   - stock is restored EXACTLY once
 *   - exactly one reversal stock movement is written
 *
 * Seeds and cleans up its own rows. NEVER runs against prod (host guard below).
 *
 *   npx tsx src/script/smoke_concurrent_sale_reversal.ts [tenant_db]
 */
import "reflect-metadata"; // sales.request.ts uses class-transformer decorators
import dotenv from "dotenv";
dotenv.config();

const TENANT_DB = process.argv[2] || "web_bytes_db";

// ---- safety: refuse to run against anything that isn't local ----
const url = process.env.TENANT_DATABASE_URL || "";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) {
    console.error("ABORT: TENANT_DATABASE_URL is not local (127.0.0.1/localhost). Refusing to run.");
    console.error("       host seen: " + (url.match(/@([^:/]+)/)?.[1] || "?"));
    process.exit(1);
}

// sales.service uses `export =`, so the module object IS the service.
const service = require("../sales/sales.service") as any;
const { getTenantPrisma, disconnectAllPrismaClients } = require("../db") as typeof import("../db");

const MARKER = "SMOKE-CONCURRENT-REVERSAL";
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

const performedBy = { userId: 1, username: "smoke", loyaltyTier: "none" as const, permissions: ["*"] };

async function cleanup(prisma: any, itemId?: number) {
    const sales = await prisma.sales.findMany({ where: { remark: MARKER }, select: { id: true } });
    const salesIds = sales.map((s: any) => s.id);
    if (salesIds.length) {
        await prisma.stockMovement.deleteMany({ where: { documentId: { in: salesIds } } });
        await prisma.payment.deleteMany({ where: { salesId: { in: salesIds } } });
        await prisma.salesItem.deleteMany({ where: { salesId: { in: salesIds } } });
        await prisma.sales.deleteMany({ where: { id: { in: salesIds } } });
    }
    if (itemId) {
        await prisma.stockBalance.deleteMany({ where: { itemId } });
        await prisma.stockMovement.deleteMany({ where: { itemId } });
        await prisma.item.deleteMany({ where: { id: itemId } });
    } else {
        const stale = await prisma.item.findMany({ where: { itemCode: MARKER }, select: { id: true } });
        for (const it of stale) await cleanup(prisma, it.id);
    }
}

/** Seed a Completed sale for 1 unit of a throwaway item that has `startQty` on hand. */
async function seedSale(prisma: any, itemId: number, outletId: number, startQty: number) {
    await prisma.stockBalance.updateMany({
        where: { itemId, outletId },
        data: { availableQuantity: startQty, onHandQuantity: startQty },
    });
    const sale = await prisma.sales.create({
        data: {
            outletId,
            businessDate: new Date(),
            salesType: "Retail",
            status: "Completed",
            remark: MARKER,
            profitAmount: 0,
            subtotalAmount: 100,
            totalAmount: 100,
            paidAmount: 100,
            sessionId: 0,
            eodId: 0,
            salesItems: {
                create: [
                    {
                        itemId,
                        itemName: "Smoke Item",
                        itemCode: MARKER,
                        itemBrand: "",
                        quantity: 1,
                        cost: 50,
                        price: 100,
                        priceBeforeTax: 100,
                        profit: 50,
                        subtotalAmount: 100,
                    },
                ],
            },
        },
    });
    return sale.id;
}

async function runCase(
    prisma: any,
    label: string,
    fn: (salesId: number) => Promise<any>,
    itemId: number,
    outletId: number,
    movementType: string
) {
    const START = 3;
    const salesId = await seedSale(prisma, itemId, outletId, START);
    console.log(`\n${label} — sale #${salesId}, stock starts at ${START}`);

    // Fire both concurrently — the production failure mode.
    const results = await Promise.allSettled([fn(salesId), fn(salesId)]);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const rejected = results.filter((r) => r.status === "rejected");

    check(`${label}: exactly one call succeeds`, ok === 1, `(got ${ok} successes)`);
    check(
        `${label}: the loser is rejected with a business error`,
        rejected.length === 1 && /completed sales can be/i.test((rejected[0] as any)?.reason?.message ?? ""),
        `(got: ${(rejected[0] as any)?.reason?.message ?? "none"})`
    );

    const balance = await prisma.stockBalance.findFirst({ where: { itemId, outletId } });
    const onHand = Number(balance.onHandQuantity);
    check(`${label}: stock restored exactly once (${START} → ${START + 1})`, onHand === START + 1, `(got ${onHand})`);

    const movements = await prisma.stockMovement.count({ where: { documentId: salesId, movementType } });
    check(`${label}: exactly one '${movementType}' movement`, movements === 1, `(got ${movements})`);
}

async function main() {
    const prisma: any = getTenantPrisma(TENANT_DB);
    console.log(`Target tenant DB: ${TENANT_DB} (LOCAL)`);

    await cleanup(prisma);

    const outlet = await prisma.outlet.findFirst({ where: { deleted: false }, select: { id: true } });
    if (!outlet) throw new Error("no outlet in tenant DB");
    const outletId = outlet.id;

    // Item requires a category + supplier — reuse whatever the tenant already has.
    const category = await prisma.category.findFirst({ where: { deleted: false }, select: { id: true } });
    const supplier = await prisma.supplier.findFirst({ where: { deleted: false }, select: { id: true } });
    if (!category || !supplier) throw new Error("tenant DB needs at least one category + supplier");

    const item = await prisma.item.create({
        data: {
            itemName: "Smoke Concurrency Item",
            itemCode: MARKER,
            categoryId: category.id,
            supplierId: supplier.id,
            cost: 50,
            price: 100,
            trackStock: true,
        },
    });
    await prisma.stockBalance.create({
        data: { itemId: item.id, outletId, availableQuantity: 0, onHandQuantity: 0 },
    });

    try {
        await runCase(
            prisma,
            "RETURN",
            (id) => service.returnSales(TENANT_DB, 1, performedBy, id, null),
            item.id,
            outletId,
            "Sales Return"
        );
        await runCase(
            prisma,
            "VOID",
            (id) => service.voidSales(TENANT_DB, 1, performedBy, id, null),
            item.id,
            outletId,
            "Sales Void"
        );
        await runCase(
            prisma,
            "REFUND",
            (id) => service.refundSales(TENANT_DB, 1, performedBy, id, null),
            item.id,
            outletId,
            "Sales Refund"
        );
    } finally {
        await cleanup(prisma, item.id);
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
