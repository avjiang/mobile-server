/**
 * Repair items wrongly flagged HAS_VARIANTS=1 with zero live variant rows.
 *
 * WHY: the item `update` path used to enter the variants block on a round-tripped
 * empty `variants: []` (truthy) and auto-set HAS_VARIANTS=true. A variant item's
 * stock is derived from its variants, so a variant-less item flagged this way
 * reads as 0 base stock → "out of stock" in the sales grid / online catalogue.
 * The BE fix (error guarded with `variants.length > 0`) is deployed (SPRINT_004);
 * this script repairs the data the bug already corrupted.
 *
 *   node dist/script/fix_orphan_has_variants.js <local|prod> [databaseName] [--confirm]
 *
 * Without --confirm it is a DRY RUN: prints every item it WOULD reset, no writes.
 * Default databaseName = audio_technic_db.
 *
 * Safe: only flips HAS_VARIANTS 1→0 on items with ZERO live (IS_DELETED=0)
 * variant rows; their base stock_balance is untouched, so resetting the flag
 * restores correct stock. Bumps UPDATED_AT so clients re-sync the corrected row.
 *
 * ⚠️ BACKUP FIRST on prod: `npm run backup_db_prod` before running with --confirm.
 */
import dotenv from "dotenv";

dotenv.config();

type Target = "local" | "prod";

const target: Target = (process.argv[2] as Target) || "local";
const positional = process.argv[3];
const databaseName =
    positional && !positional.startsWith("--") ? positional : "audio_technic_db";
const confirm = process.argv.includes("--confirm");

if (!["local", "prod"].includes(target)) {
    console.error(
        "Usage: node dist/script/fix_orphan_has_variants.js <local|prod> [databaseName] [--confirm]"
    );
    process.exit(1);
}

if (target === "prod") {
    if (!process.env.PROD_TENANT_DATABASE_URL) {
        console.error("Missing PROD_TENANT_DATABASE_URL in .env");
        process.exit(1);
    }
    process.env.TENANT_DATABASE_URL = process.env.PROD_TENANT_DATABASE_URL;
    console.log("Target: PROD");
} else {
    console.log("Target: LOCAL");
}

// Load AFTER env override so the tenant client resolves to the chosen target.
const { getTenantPrisma, disconnectAllPrismaClients } =
    require("../db") as typeof import("../db");

const WHERE = `
    i.HAS_VARIANTS = 1 AND i.IS_DELETED = 0
    AND NOT EXISTS (
        SELECT 1 FROM item_variant v
        WHERE v.ITEM_ID = i.ID AND v.IS_DELETED = 0
    )`;

async function main() {
    console.log(
        `DB: ${databaseName} · mode: ${confirm ? "APPLY" : "DRY RUN"}\n`
    );
    const prisma = getTenantPrisma(databaseName);

    const affected = (await prisma.$queryRawUnsafe(
        `SELECT i.ID as id, i.ITEM_CODE as code, i.ITEM_NAME as name
         FROM item i WHERE ${WHERE} ORDER BY i.ID`
    )) as Array<{ id: number; code: string; name: string }>;

    if (affected.length === 0) {
        console.log("No orphan-variant items found. Nothing to repair.");
        return;
    }

    console.log(`Found ${affected.length} item(s) flagged HAS_VARIANTS=1 with no live variants:\n`);
    for (const r of affected) {
        console.log(`  #${r.id}  [${r.code}]  ${r.name}`);
    }
    console.log("");

    if (!confirm) {
        console.log("DRY RUN — no changes written. Re-run with --confirm to apply.");
        return;
    }

    const count = await prisma.$executeRawUnsafe(
        `UPDATE item i SET i.HAS_VARIANTS = 0, i.UPDATED_AT = NOW() WHERE ${WHERE}`
    );
    console.log(`APPLIED — reset HAS_VARIANTS on ${count} item(s).`);

    const remaining = (await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as n FROM item i WHERE ${WHERE}`
    )) as Array<{ n: bigint | number }>;
    console.log(`Verification — orphan-variant items remaining: ${Number(remaining[0].n)}`);
}

main()
    .catch((err) => {
        console.error("Aborted:", (err as Error).message);
        console.error((err as Error).stack);
        process.exit(1);
    })
    .finally(async () => {
        await disconnectAllPrismaClients();
    });
