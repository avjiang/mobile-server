/**
 * Seeds (and RESETS) the local shop the wholesale tutorial is captured from:
 * "Toko Grosir Sinar Jaya" — login `toko_grosir` / `toko_grosir`, Basic Retail,
 * DB `toko_grosir_db`. FE docs/tutorials/wholesale/README.md has the whole recipe.
 *
 *   npx ts-node src/script/create_test_tenant.ts local toko_grosir Basic Retail   # once
 *   npx ts-node src/script/seed_wholesale_tutorial.ts                           # before every capture
 *
 * Every run wipes the shop back to the tutorial's starting point, because the
 * tutorial itself creates the "Grosir" level, gives Indomie its Dus unit and
 * bulk price, sets Toko Budi's level and rings up sales:
 *   - TRUNCATEs the sales/stock/session tables and the catalogue (items, units,
 *     price tiers, price levels, categories, suppliers, customers);
 *   - 8 grocery items with stock and cost (Indomie Goreng Rp 3.500, 400 pcs,
 *     cost 2.800 — NO units, NO bulk price);
 *   - customers Toko Budi and Bu Sari (no level);
 *   - one OPEN session for the owner (the app resumes it on login);
 *   - store name "Toko Grosir Sinar Jaya" (receipts + outlet), owner "Hendra", language id.
 *
 * LOCAL ONLY, and only this one database: it refuses anything else.
 */
import "reflect-metadata";
import dotenv from "dotenv";
dotenv.config();

import { Decimal } from "decimal.js";
import { getGlobalPrisma, getTenantPrisma, disconnectAllPrismaClients } from "../db";

const TENANT = "toko_grosir";
const DB = "toko_grosir_db";
const STORE_NAME = "Toko Grosir Sinar Jaya";
const OUTLET_ID = 1;
const OWNER_USER_ID = 1;

const ITEMS = [
    { code: "SJ0002", name: "Aqua 600ml", brand: "Aqua", category: "Minuman", cost: 3000, price: 4000, qty: 240 },
    { code: "SJ0003", name: "Gula Pasir 1kg", brand: "Gulaku", category: "Bahan Pokok", cost: 15500, price: 17500, qty: 60 },
    { code: "SJ0004", name: "Minyak Goreng 1L", brand: "Bimoli", category: "Bahan Pokok", cost: 16500, price: 19000, qty: 48 },
    { code: "SJ0005", name: "Kopi Kapal Api Sachet", brand: "Kapal Api", category: "Minuman", cost: 1100, price: 1500, qty: 300 },
    { code: "SJ0006", name: "Teh Pucuk Harum 350ml", brand: "Teh Pucuk", category: "Minuman", cost: 3100, price: 4000, qty: 96 },
    { code: "SJ0007", name: "Beras Pandan Wangi 5kg", brand: "Pandan Wangi", category: "Bahan Pokok", cost: 64000, price: 72000, qty: 20 },
    { code: "SJ0008", name: "Sabun Lifebuoy 85g", brand: "Lifebuoy", category: "Kebutuhan Rumah", cost: 3200, price: 4500, qty: 72 },
    // Last = newest: the item list (sorted "Terbaru") shows it on top.
    { code: "SJ0001", name: "Indomie Goreng", brand: "Indomie", category: "Bahan Pokok", cost: 2800, price: 3500, qty: 400 },
];

const CUSTOMERS = [
    { firstName: "Toko", lastName: "Budi", mobile: "081234560101" },
    { firstName: "Bu", lastName: "Sari", mobile: "081234560202" },
];

// Everything the tutorial (or an earlier capture) can have written.
const WIPE = [
    // sales + documents
    "sales", "sales_photo", "sales_item", "sales_item_modifier",
    "invoice", "invoice_item", "invoice_settlement", "invoice_settlement_payment",
    "delivery_order", "delivery_order_item", "quotation", "quotation_item",
    "purchase_order", "purchase_order_item", "purchase_order_payment",
    "purchase_return", "purchase_return_item",
    "payment", "card_info", "register_log", "session", "declaration",
    // stock
    "stock_balance", "stock_receipt", "stock_receipt_archive",
    "stock_movement", "stock_movement_archive", "stock_snapshot",
    // loyalty ledgers, misc history
    "loyalty_account", "loyalty_point_batch", "loyalty_transaction", "voucher",
    "promotion_usage", "override_log", "idempotency_record", "document_sequence",
    // catalogue + customers (the tutorial edits these)
    "item_price_tier", "item_unit", "price_level", "item_supplier", "item_variant",
    "item_variant_attribute", "variant_attribute_value", "item", "item_category", "supplier",
    "customer", "promotion_customer",
];

async function main() {
    if (process.argv.includes("prod")) throw new Error("Local only.");
    const global = getGlobalPrisma();
    const tenant = await global.tenant.findFirst({ where: { tenantName: TENANT } });
    if (!tenant || tenant.databaseName !== DB) {
        throw new Error(`Local tenant ${TENANT} (${DB}) not found — create it first:\n` +
            `  npx ts-node src/script/create_test_tenant.ts local ${TENANT} Basic Retail`);
    }
    const prisma: any = getTenantPrisma(DB);

    console.log(`Resetting ${DB}…`);
    // One connection for all of it: FOREIGN_KEY_CHECKS is per connection.
    await prisma.$transaction(async (tx: any) => {
        await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");
        try {
            for (const t of WIPE) await tx.$executeRawUnsafe(`TRUNCATE TABLE \`${t}\``);
        } finally {
            await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
        }
    }, { timeout: 60000 });

    // Store name: receipts (company_name setting) and the outlet.
    await prisma.$executeRawUnsafe("DELETE FROM setting WHERE SETTING_DEFINITION_ID IN (2, 5, 7)");
    // No printer in this shop: auto-print off (on the emulator, which has no Bluetooth
    // adapter, an auto-print never finishes and the success screen reads "Mencetak...").
    await prisma.$executeRawUnsafe(
        "INSERT INTO setting (USER_ID, VALUE, SETTING_DEFINITION_ID, UPDATED_AT) VALUES (?, 'false', 2, NOW())",
        OWNER_USER_ID);
    await prisma.$executeRawUnsafe(
        "INSERT INTO setting (TENANT_ID, VALUE, SETTING_DEFINITION_ID, UPDATED_AT) VALUES (?, ?, 7, NOW())",
        tenant.id, STORE_NAME);
    await prisma.$executeRawUnsafe(
        "INSERT INTO setting (USER_ID, VALUE, SETTING_DEFINITION_ID, UPDATED_AT) VALUES (?, 'id', 5, NOW())",
        OWNER_USER_ID);
    await prisma.$executeRawUnsafe("UPDATE outlet SET OUTLET_NAME = ?, UPDATED_AT = NOW() WHERE ID = ?", STORE_NAME, OUTLET_ID);
    // The owner's name, for the dashboard greeting ("Selamat Pagi, Hendra!").
    await prisma.$executeRawUnsafe("UPDATE user SET FIRST_NAME = 'Hendra', UPDATED_AT = NOW() WHERE ID = ?", OWNER_USER_ID);
    await global.$executeRawUnsafe("UPDATE tenant_outlet SET OUTLET_NAME = ? WHERE TENANT_ID = ?", STORE_NAME, tenant.id);

    const supplier = await prisma.supplier.create({
        data: { companyName: "PT Sumber Rezeki", hasTax: false }, select: { id: true },
    });
    const categories = new Map<string, number>();
    for (const name of new Set(ITEMS.map((i) => i.category))) {
        const c = await prisma.category.create({ data: { name }, select: { id: true } });
        categories.set(name, c.id);
    }

    for (const it of ITEMS) {
        const item = await prisma.item.create({
            data: {
                itemName: it.name,
                itemCode: it.code,
                itemBrand: it.brand, // the item form requires a brand to save
                itemModel: "",
                category: { connect: { id: categories.get(it.category)! } },
                supplier: { connect: { id: supplier.id } },
                cost: new Decimal(it.cost),
                price: new Decimal(it.price),
                unitOfMeasure: "Piece",
                trackStock: true,
                hasVariants: false,
            },
            select: { id: true },
        });
        await prisma.stockReceipt.create({
            data: {
                itemId: item.id, outletId: OUTLET_ID, quantity: new Decimal(it.qty),
                cost: new Decimal(it.cost), receiptDate: new Date("2026-10-01T00:00:00Z"),
            },
        });
        await prisma.stockBalance.create({
            data: {
                itemId: item.id, outletId: OUTLET_ID,
                availableQuantity: new Decimal(it.qty), onHandQuantity: new Decimal(it.qty),
            },
        });
        console.log(`  + ${it.name} — Rp ${it.price} · stok ${it.qty} · modal ${it.cost}`);
    }

    for (const c of CUSTOMERS) {
        await prisma.customer.create({ data: { salutation: "", ...c } });
        console.log(`  + pelanggan ${c.firstName} ${c.lastName}`);
    }

    // An open session for the owner: the app resumes it on login, so the sales
    // screen adds straight to the cart.
    const now = new Date();
    await prisma.session.create({
        data: {
            outletId: OUTLET_ID, businessDate: now, openingDateTime: now, openingAmount: new Decimal(0),
            totalSalesCount: 0, openByUserID: OWNER_USER_ID, closeByUserID: 0,
        },
    });
    console.log(`  + open session\n\nDone: ${STORE_NAME} is at the tutorial's starting point.`);
}

main()
    .then(() => disconnectAllPrismaClients())
    .then(() => process.exit(0))
    .catch(async (e) => {
        console.error("SEED ERROR:", e);
        await disconnectAllPrismaClients().catch(() => {});
        process.exit(1);
    });
