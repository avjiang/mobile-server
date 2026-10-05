/**
 * Backfill: put loyalty members on the tier their total spend qualifies for.
 *
 * WHY: before the 2026-10-02 fix a loyalty account was created with no tier and
 * only got one after a sale, so a member of a program with a min-spend-0 tier
 * (e.g. "Basic") had no tier discount on their first sale; deleting a tier also
 * left its members with none. New accounts and tier changes now run
 * `syncAccountTiers` (src/loyalty/loyalty.service.ts); this repairs the
 * accounts already written. Same rule: highest qualifying tier, upward only,
 * manual tiers untouched.
 *
 *   npx tsx src/script/backfill_loyalty_tiers.ts <local|prod> [databaseName] [--confirm]
 *
 * Without --confirm it is a DRY RUN (counts per tier, no writes). No
 * databaseName = every tenant in the global db. Idempotent: a second run finds
 * nothing to do. Prisma bumps UPDATED_AT on every changed account.
 * On prod, take a backup first (`npm run backup_db_prod`).
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

type Target = "local" | "prod";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const target = (args[0] || "local") as Target;
const onlyDb = args[1];
const confirm = process.argv.includes("--confirm");

if (!["local", "prod"].includes(target)) {
    console.error("Usage: npx tsx src/script/backfill_loyalty_tiers.ts <local|prod> [databaseName] [--confirm]");
    process.exit(1);
}
if (target === "prod") {
    if (!process.env.PROD_GLOBAL_DB_URL || !process.env.PROD_TENANT_DATABASE_URL) {
        console.error("Refusing: target is prod but PROD_GLOBAL_DB_URL / PROD_TENANT_DATABASE_URL is unset");
        process.exit(1);
    }
    process.env.GLOBAL_DB_URL = process.env.PROD_GLOBAL_DB_URL;
    process.env.TENANT_DATABASE_URL = process.env.PROD_TENANT_DATABASE_URL;
}
console.log(`Target: ${target.toUpperCase()} · mode: ${confirm ? "APPLY" : "DRY RUN"}\n`);

// Load AFTER the env override so the clients resolve to the chosen target.
const { getGlobalPrisma, getTenantPrisma, disconnectAllPrismaClients } =
    require("../db") as typeof import("../db");
const loyaltyService = (require("../loyalty/loyalty.service") as typeof import("../loyalty/loyalty.service")).default;

async function backfill(dbName: string): Promise<number> {
    const prisma: any = getTenantPrisma(dbName);
    const programs = await prisma.loyaltyProgram.findMany({
        where: { deleted: false },
        select: { id: true, name: true, tiers: { select: { id: true, name: true } } },
    });
    let changed = 0;
    for (const program of programs) {
        const plan = await loyaltyService.syncAccountTiers(prisma, program.id, { dryRun: !confirm });
        for (const [tierId, ids] of plan) {
            const tierName = tierId === null ? "(no tier)" : program.tiers.find((t: any) => t.id === tierId)?.name ?? `#${tierId}`;
            console.log(`· ${dbName} / ${program.name}: ${ids.length} member(s) ${confirm ? "→" : "would move →"} ${tierName}`);
            changed += ids.length;
        }
    }
    if (changed === 0) console.log(`· ${dbName}: nothing to fix`);
    return changed;
}

async function main() {
    let dbNames: string[];
    if (onlyDb) {
        dbNames = [onlyDb];
    } else {
        const tenants = await getGlobalPrisma().tenant.findMany({
            where: { databaseName: { not: null } },
            select: { databaseName: true },
        });
        dbNames = tenants.map((t) => t.databaseName!);
    }

    let total = 0;
    let failed = 0;
    for (const dbName of dbNames) {
        try {
            total += await backfill(dbName);
        } catch (error: any) {
            // A tenant without a database (e.g. prod test tenants) — list and move on.
            failed++;
            console.log(`✗ ${dbName}: ${error?.message?.split("\n").pop() ?? error}`);
        }
    }
    console.log(`\n${total} member(s) ${confirm ? "moved" : "to move"} across ${dbNames.length} tenant(s)${failed ? `, ${failed} skipped` : ""}.`);
    if (!confirm && total > 0) console.log("Re-run with --confirm to apply.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(() => disconnectAllPrismaClients());
