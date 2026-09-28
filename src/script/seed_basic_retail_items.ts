/**
 * TEMP QA helper — seeds a minimal retail catalogue into `basic_retail_db` so the
 * item list has rows to inspect for WAREHOUSE_TEST_HANDOVER.md §4.1 point 3
 * ("Warehouse chip does NOT appear for Basic/Trial tenants").
 *
 * create_test_tenant.ts produces a bare tenant (no categories/suppliers/items), so
 * without this the item list is empty and there are no chips to check at all.
 *
 * Outlet stock only — this tenant has NO warehouse (Basic plan), which is the point.
 *
 * LOCAL ONLY.  npx tsx src/script/seed_basic_retail_items.ts
 */
import "reflect-metadata";
import dotenv from "dotenv";
dotenv.config();

import { Decimal } from "decimal.js";
import { getTenantPrisma, disconnectAllPrismaClients } from "../db";

const DB = "basic_retail_db";
const OUTLET_ID = 1;

const ITEMS = [
    { code: "BAS0001", name: "Aqua Botol 600ml", cost: 2000, price: 3500, qty: 48 },
    { code: "BAS0002", name: "Indomie Goreng", cost: 2500, price: 3500, qty: 120 },
    { code: "BAS0003", name: "Kopi Kapal Api Sachet", cost: 1000, price: 1500, qty: 75 },
    { code: "BAS0004", name: "Minyak Goreng Bimoli 1L", cost: 14000, price: 18000, qty: 20 },
    { code: "BAS0005", name: "Beras Pandan Wangi 5kg", cost: 58000, price: 68000, qty: 12 },
];

async function main() {
    const prisma: any = getTenantPrisma(DB);

    let category = await prisma.category.findFirst({ select: { id: true } });
    if (!category) {
        category = await prisma.category.create({ data: { name: "Sembako" }, select: { id: true } });
        console.log(`Created category id=${category.id}`);
    }

    let supplier = await prisma.supplier.findFirst({ select: { id: true } });
    if (!supplier) {
        supplier = await prisma.supplier.create({
            data: { companyName: "Supplier Umum", hasTax: false },
            select: { id: true },
        });
        console.log(`Created supplier id=${supplier.id}`);
    }

    for (const it of ITEMS) {
        const existing = await prisma.item.findFirst({ where: { itemCode: it.code }, select: { id: true } });
        if (existing) {
            console.log(`  = ${it.code} already exists (id=${existing.id}) — skipped`);
            continue;
        }

        const created = await prisma.item.create({
            data: {
                itemName: it.name,
                itemCode: it.code,
                itemBrand: "",
                itemModel: "",
                category: { connect: { id: category.id } },
                supplier: { connect: { id: supplier.id } },
                cost: new Decimal(it.cost),
                price: new Decimal(it.price),
                unitOfMeasure: "Piece",
                trackStock: true,
                hasVariants: false,
            },
            select: { id: true },
        });

        // FIFO layer + balance, outlet only (no warehouse on a Basic tenant).
        await prisma.stockReceipt.create({
            data: {
                itemId: created.id,
                outletId: OUTLET_ID,
                quantity: new Decimal(it.qty),
                cost: new Decimal(it.cost),
                receiptDate: new Date("2026-08-01T00:00:00Z"),
            },
        });
        await prisma.stockBalance.create({
            data: {
                itemId: created.id,
                outletId: OUTLET_ID,
                availableQuantity: new Decimal(it.qty),
                onHandQuantity: new Decimal(it.qty),
            },
        });

        console.log(`  + ${it.code} ${it.name} — outlet qty ${it.qty}`);
    }

    const total = await prisma.item.count();
    console.log(`\nDone. ${DB} now has ${total} items (outlet stock only, no warehouse).`);
}

main()
    .then(() => disconnectAllPrismaClients())
    .then(() => process.exit(0))
    .catch(async (e) => {
        console.error("SEED ERROR:", e);
        await disconnectAllPrismaClients().catch(() => {});
        process.exit(1);
    });
