/*
 * DEV SEED — fills the LOCAL web_bytes test tenant (web_bytes_db, tenant 11) with a realistic
 * retail catalogue so list/grid screens (e.g. the Sales item grid) have enough items to judge.
 *
 *   npx tsx src/script/seed_web_bytes_catalogue.ts
 *
 * Additive and idempotent: categories are matched by name, items by ITEM_CODE (prefix "WB-");
 * anything that already exists is skipped, and nothing is ever deleted. Each stocked item gets
 * the same rows as the demo seeder (item_supplier + opening stock_receipt + stock_movement +
 * stock_balance), so stock screens and FIFO agree. Names deliberately mix short and long so
 * 2-line clamping shows up; a few are tracked with 0 stock so the out-of-stock card shows.
 * NEVER runs against prod (host guard).
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

const OUTLET_ID = 1;

const CATEGORIES: { name: string; description: string }[] = [
    { name: "Minuman", description: "Air, teh, kopi, dan susu siap minum" },
    { name: "Makanan Ringan", description: "Keripik, biskuit, dan wafer" },
    { name: "Sembako", description: "Kebutuhan pokok harian" },
    { name: "Bahan Kue", description: "Tepung, mentega, coklat, dan bahan baking" },
    { name: "Perawatan Diri", description: "Sabun, sampo, dan pasta gigi" },
    { name: "Rumah Tangga", description: "Kebutuhan kebersihan rumah" },
];

// [code, name, categoryIndex, cost, price, opening stock, brand]
type Def = [string, string, number, number, number, number, string];
const ITEMS: Def[] = [
    // Minuman
    ["WB-MIN-01", "Air Mineral 600ml", 0, 2400, 4000, 175, "Segar"],
    ["WB-MIN-02", "Air Mineral 1500ml", 0, 4200, 6500, 90, "Segar"],
    ["WB-MIN-03", "Teh Kotak 250ml", 0, 3500, 5500, 180, "Sosro"],
    ["WB-MIN-04", "Teh Melati Botol Kaca 220ml", 0, 3000, 5000, 60, "Sosro"],
    ["WB-MIN-05", "Kopi Sachet 20g", 0, 1200, 2000, 210, "Kapal Api"],
    ["WB-MIN-06", "Kopi Susu Gula Aren Siap Minum 200ml", 0, 6500, 9500, 48, "Kenangan"],
    ["WB-MIN-07", "Susu UHT Coklat 250ml", 0, 5000, 7500, 120, "Ultra"],
    ["WB-MIN-08", "Susu UHT Full Cream 1L", 0, 16500, 19900, 36, "Ultra"],
    ["WB-MIN-09", "Minuman Isotonik 500ml", 0, 5200, 7500, 0, "Pocari"],
    // Makanan Ringan
    ["WB-SNK-01", "Keripik Singkong 100g", 1, 6000, 10000, 96, "Qtela"],
    ["WB-SNK-02", "Keripik Kentang Rasa Rumput Laut 68g", 1, 8500, 12500, 40, "Chitato"],
    ["WB-SNK-03", "Biskuit Kelapa 120g", 1, 5500, 9000, 84, "Roma"],
    ["WB-SNK-04", "Wafer Coklat 50g", 1, 2500, 4000, 118, "Tango"],
    ["WB-SNK-05", "Kacang Garuda 100g", 1, 7000, 11000, 52, "Garuda"],
    ["WB-SNK-06", "Mi Instan Goreng", 1, 2800, 3500, 240, "Indomie"],
    ["WB-SNK-07", "Mi Instan Kuah Rasa Ayam Bawang", 1, 2700, 3500, 200, "Indomie"],
    ["WB-SNK-08", "Roti Tawar Kupas", 1, 13000, 17000, 0, "Sari Roti"],
    // Sembako
    ["WB-SMB-01", "Beras Premium 5kg", 2, 62000, 75000, 40, "Ramos"],
    ["WB-SMB-02", "Beras Pandan Wangi Super 10kg", 2, 128000, 149000, 18, "Topi Koki"],
    ["WB-SMB-03", "Minyak Goreng 2L", 2, 32000, 38000, 60, "Bimoli"],
    ["WB-SMB-04", "Gula Pasir 1kg", 2, 14000, 17500, 72, "Gulaku"],
    ["WB-SMB-05", "Telur Ayam 1kg", 2, 25000, 30000, 55, ""],
    ["WB-SMB-06", "Garam Beryodium 250g", 2, 2000, 3200, 80, "Dolphin"],
    ["WB-SMB-07", "Kecap Manis 520ml", 2, 19000, 23500, 44, "Bango"],
    ["WB-SMB-08", "Saus Sambal 340ml", 2, 11000, 14500, 38, "ABC"],
    // Bahan Kue
    ["WB-BHK-01", "Tepung Terigu Protein Sedang 1kg", 3, 11500, 14500, 70, "Segitiga Biru"],
    ["WB-BHK-02", "Tepung Maizena 150g", 3, 4500, 6500, 50, "Maizenaku"],
    ["WB-BHK-03", "Mentega Margarin Serbaguna 200g", 3, 7500, 9800, 64, "Blue Band"],
    ["WB-BHK-04", "Coklat Bubuk Premium 165g", 3, 26000, 32500, 22, "Van Houten"],
    ["WB-BHK-05", "Keju Cheddar Blok 165g", 3, 20000, 24500, 30, "Kraft"],
    ["WB-BHK-06", "Baking Powder Double Acting 45g", 3, 6500, 8900, 40, "Hercules"],
    ["WB-BHK-07", "Ragi Instan 11g", 3, 3200, 4500, 90, "Fermipan"],
    ["WB-BHK-08", "Santan Kelapa 65ml", 3, 2800, 3800, 120, "Kara"],
    ["WB-BHK-09", "Meses Coklat Warna-Warni Rainbow Sprinkle 250g", 3, 14000, 18500, 0, "Ceres"],
    // Perawatan Diri
    ["WB-PRW-01", "Sabun Mandi Batang", 4, 3500, 5500, 110, "Lifebuoy"],
    ["WB-PRW-02", "Sampo Sachet 12ml", 4, 800, 1500, 155, "Sunsilk"],
    ["WB-PRW-03", "Pasta Gigi 75g", 4, 11000, 15000, 64, "Pepsodent"],
    ["WB-PRW-04", "Sikat Gigi Soft", 4, 6000, 9000, 48, "Formula"],
    ["WB-PRW-05", "Sabun Cair Antiseptik Refill 450ml", 4, 19000, 25500, 26, "Dettol"],
    // Rumah Tangga
    ["WB-RMT-01", "Sabun Cuci Piring 800ml", 5, 14000, 19000, 58, "Sunlight"],
    ["WB-RMT-02", "Deterjen Bubuk 800g", 5, 17000, 23000, 52, "Rinso"],
    ["WB-RMT-03", "Pewangi Pakaian Sachet", 5, 900, 1500, 160, "Molto"],
    ["WB-RMT-04", "Tisu Wajah 250 Lembar", 5, 11000, 15500, 45, "Paseo"],
    ["WB-RMT-05", "Kantong Sampah Hitam Besar Isi 10", 5, 7000, 10000, 70, ""],
];

async function main() {
    const prisma: any = getTenantPrisma(TENANT_DB);

    const owner = await prisma.user.findFirst({ orderBy: { id: "asc" } });
    const performedBy = owner
        ? [owner.firstName, owner.lastName].filter(Boolean).join(" ") || owner.username
        : "Seed";

    // Names are @unique, so match regardless of IS_DELETED and restore a soft-deleted match.
    let supplier = await prisma.supplier.findFirst({ where: { companyName: "Toko Grosir Seed" } });
    if (supplier?.deleted) {
        supplier = await prisma.supplier.update({ where: { id: supplier.id }, data: { deleted: false, deletedAt: null } });
    }
    if (!supplier) {
        supplier = await prisma.supplier.create({
            data: { companyName: "Toko Grosir Seed", hasTax: false, companyCountry: "Indonesia" },
        });
    }

    const categoryIds: number[] = [];
    for (const c of CATEGORIES) {
        let row = await prisma.category.findFirst({ where: { name: c.name } });
        if (row?.deleted) {
            row = await prisma.category.update({ where: { id: row.id }, data: { deleted: false, deletedAt: null } });
        }
        row ??= await prisma.category.create({ data: { name: c.name, description: c.description } });
        categoryIds.push(row.id);
    }

    let created = 0;
    let skipped = 0;
    const now = new Date();
    for (const [code, name, cat, cost, price, opening, brand] of ITEMS) {
        if (await prisma.item.findFirst({ where: { itemCode: code } })) {
            skipped++;
            continue;
        }
        const item = await prisma.item.create({
            data: {
                itemName: name,
                itemCode: code,
                itemType: "",
                itemBrand: brand,
                itemDescription: "",
                categoryId: categoryIds[cat],
                cost: 0, // FIFO owns cost for stocked items
                price,
                unitOfMeasure: "Piece",
                supplierId: supplier.id,
                trackStock: true,
                hasTax: false,
            },
        });
        await prisma.itemSupplier.create({
            data: { itemId: item.id, supplierId: supplier.id, isPreferred: true, cost, version: 1 },
        });
        if (opening > 0) {
            const receipt = await prisma.stockReceipt.create({
                data: { itemId: item.id, outletId: OUTLET_ID, quantity: opening, cost, receiptDate: now },
            });
            await prisma.stockMovement.create({
                data: {
                    itemId: item.id, outletId: OUTLET_ID,
                    previousAvailableQuantity: 0, previousOnHandQuantity: 0,
                    availableQuantityDelta: opening, onHandQuantityDelta: opening,
                    movementType: "Create Item", documentId: receipt.id,
                    reason: "Stok awal", remark: "", performedBy,
                },
            });
        }
        // Tracked items always carry a balance row; 0 = out of stock on the Sales grid.
        await prisma.stockBalance.create({
            data: {
                itemId: item.id, outletId: OUTLET_ID,
                availableQuantity: opening, onHandQuantity: opening,
                reorderThreshold: Math.max(5, Math.round(opening * 0.2)),
                lastRestockDate: opening > 0 ? now : null,
            },
        });
        created++;
    }

    console.log(`web_bytes_db: ${created} items created, ${skipped} already present (supplier #${supplier.id}).`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(() => disconnectAllPrismaClients());
