/**
 * Trial→live conversion reset: wipe a tenant DB's TRANSACTIONAL data while
 * keeping all master/setup data (users, roles, settings, items, services,
 * categories, prices, suppliers, outlets, warehouses, menu, loyalty programs/
 * tiers, packages, reward rules, promotions, devices).
 *
 * TRUNCATE is used so every auto-increment counter (receipt numbers = sales.ID)
 * restarts at 1 — no jumping numbers after conversion.
 *
 *   node dist/script/reset_tenant_transactional_data.js <local|prod> <databaseName> [--confirm] [--keep-customers]
 *
 * Without --confirm it is a DRY RUN: prints current row counts and exits.
 * BACKUP FIRST on prod (npm run backup_db_prod or a targeted mysqldump).
 *
 * After running: the merchant's device(s) must log out + clear app data
 * (or reinstall) — the local Drift cache still holds the old synced rows and
 * delta sync never deletes them.
 */
import dotenv from "dotenv";

dotenv.config();

type Target = "local" | "prod";

const target: Target = (process.argv[2] as Target) || "local";
const databaseName = process.argv[3];
const confirm = process.argv.includes("--confirm");
const keepCustomers = process.argv.includes("--keep-customers");

if (!databaseName || !["local", "prod"].includes(target)) {
    console.error("Usage: node dist/script/reset_tenant_transactional_data.js <local|prod> <databaseName> [--confirm] [--keep-customers]");
    process.exit(1);
}

if (target === "prod") {
    if (!process.env.PROD_GLOBAL_DB_URL || !process.env.PROD_TENANT_DATABASE_URL) {
        console.error("Missing PROD_GLOBAL_DB_URL or PROD_TENANT_DATABASE_URL in .env");
        process.exit(1);
    }
    process.env.GLOBAL_DB_URL = process.env.PROD_GLOBAL_DB_URL;
    process.env.TENANT_DATABASE_URL = process.env.PROD_TENANT_DATABASE_URL;
    console.log("Target: PROD");
} else {
    console.log("Target: LOCAL");
}

// Load AFTER env override so Prisma clients resolve to the chosen target.
const { getGlobalPrisma, getTenantPrisma, disconnectAllPrismaClients } =
    require("../db") as typeof import("../db");

// Transactional tables, grouped for readability. Master/setup tables are
// deliberately ABSENT: role, role_permission, user, setting, supplier, company,
// outlet, item, item_consumable, item_category, item_variant*, variant_attribute_value,
// menu_*, table, recipe, station, order_routing, registered_device, warehouse,
// loyalty_program, loyalty_tier, subscription_package*, reward_rule,
// promotion, promotion_item, notification_preference + lookup tables.
const transactionalTables: string[] = [
    // sales + documents
    "sales", "sales_photo", "sales_item", "sales_item_modifier",
    "invoice", "invoice_item", "invoice_settlement",
    "delivery_order", "delivery_order_item",
    "quotation", "quotation_item",
    "purchase_order", "purchase_order_item",
    "purchase_return", "purchase_return_item",
    // payments + cash register
    "payment", "card_info", "register_log", "session", "declaration",
    // outlet stock
    "stock_balance", "stock_receipt", "stock_receipt_archive",
    "stock_movement", "stock_movement_archive", "stock_snapshot",
    // warehouse stock
    "warehouse_stock_balance", "warehouse_stock_receipt",
    "warehouse_stock_movement", "warehouse_stock_movement_archive",
    // loyalty + packages (balances/ledgers — programs & tiers are kept)
    "loyalty_account", "loyalty_point_batch", "loyalty_transaction",
    "customer_subscription", "subscription_usage", "voucher",
    // F&B flow
    "reservation", "waitlist", "split_bill",
    // misc transaction history
    "promotion_usage", "override_log", "referral", "idempotency_record",
];

const customerTables: string[] = ["customer", "promotion_customer"];

async function run() {
    const globalPrisma = getGlobalPrisma();
    const tenant = await globalPrisma.tenant.findFirst({ where: { databaseName } });
    if (!tenant) {
        throw new Error(`No tenant with DATABASE_NAME="${databaseName}" in global DB — aborting.`);
    }
    console.log(`Tenant: ${tenant.tenantName} (ID ${tenant.id}), DB: ${databaseName}`);

    const tables = keepCustomers ? transactionalTables : [...transactionalTables, ...customerTables];
    if (keepCustomers) console.log("--keep-customers: keeping customer + promotion_customer");

    const prisma = getTenantPrisma(databaseName);

    console.log("\nRow counts:");
    let totalRows = 0;
    for (const table of tables) {
        const rows: Array<{ c: bigint }> =
            await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS c FROM \`${table}\``);
        const count = Number(rows[0].c);
        totalRows += count;
        if (count > 0) console.log(`  ${table}: ${count}`);
    }
    if (totalRows === 0) console.log("  (all transactional tables already empty)");

    if (!confirm) {
        console.log("\nDRY RUN — no data touched. Re-run with --confirm to truncate.");
        return;
    }

    console.log(`\nTruncating ${tables.length} tables...`);
    await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");
    try {
        for (const table of tables) {
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\``);
        }
    } finally {
        await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
    }
    console.log(`Done — ${totalRows} rows removed, auto-increment counters reset to 1.`);
    console.log("REMINDER: merchant device(s) must log out + clear app data (or reinstall) before first live use.");
}

if (require.main === module) {
    run()
        .catch((error) => {
            console.error("Failed:", error);
            process.exit(1);
        })
        .finally(() => disconnectAllPrismaClients());
}
