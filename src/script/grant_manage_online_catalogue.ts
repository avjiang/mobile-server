/**
 * Backward-compat default-grant for the new "Manage Online Catalogue" permission.
 *
 * WHY: catalogue (settings + storage) used to be UNGATED in the Flutter app —
 * every role could open the screens. The BE write endpoints, however, were
 * already gated by "Manage Inventory", so the roles that could actually *operate*
 * the catalogue are exactly those holding "Manage Inventory". Introducing the new
 * "Manage Online Catalogue" permission would otherwise hide catalogue from every
 * custom role on upgrade (only super-admins bypass). To avoid that regression,
 * this script grants "Manage Online Catalogue" to every non-deleted role that
 * already holds "Manage Inventory", across all tenant databases.
 *
 *   node dist/script/grant_manage_online_catalogue.js <local|prod> [--confirm]
 *
 * Without --confirm it is a DRY RUN: prints what it WOULD grant, no writes.
 * Idempotent: re-running skips roles that already have the permission.
 *
 * Permissions live in the GLOBAL db (Permission table); role→permission mappings
 * (RolePermission) live PER-TENANT and reference Permission.id by value (no FK).
 *
 * ⚠️ Runs permission_seed first so "Manage Online Catalogue" exists globally
 * before we resolve its id. On prod, take a backup first (`npm run backup_db_prod`).
 */
import dotenv from "dotenv";

dotenv.config();

type Target = "local" | "prod";

const target: Target = (process.argv[2] as Target) || "local";
const confirm = process.argv.includes("--confirm");

if (!["local", "prod"].includes(target)) {
    console.error(
        "Usage: node dist/script/grant_manage_online_catalogue.js <local|prod> [--confirm]"
    );
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

// Load AFTER env override so the clients resolve to the chosen target.
const { getGlobalPrisma, getTenantPrisma, disconnectAllPrismaClients } =
    require("../db") as typeof import("../db");
const { seedPermissions } = require("./permission_seed") as typeof import("./permission_seed");

const CATALOGUE_PERMISSION = "Manage Online Catalogue";
const PROXY_PERMISSION = "Manage Inventory"; // roles holding this already operated the catalogue

async function main() {
    console.log(`mode: ${confirm ? "APPLY" : "DRY RUN"}\n`);

    // 0) Ensure the permission exists globally before we resolve its id.
    if (confirm) {
        await seedPermissions();
    } else {
        console.log("(dry run) skipping permission_seed — assuming it has been/ will be run\n");
    }

    const globalPrisma = getGlobalPrisma();

    const cataloguePerm = await globalPrisma.permission.findUnique({
        where: { name: CATALOGUE_PERMISSION },
        select: { id: true },
    });
    const proxyPerm = await globalPrisma.permission.findUnique({
        where: { name: PROXY_PERMISSION },
        select: { id: true },
    });

    if (!cataloguePerm) {
        console.error(
            `"${CATALOGUE_PERMISSION}" not found in global Permission table. Run permission_seed first (or pass --confirm).`
        );
        process.exit(1);
    }
    if (!proxyPerm) {
        console.error(`"${PROXY_PERMISSION}" not found in global Permission table — cannot resolve grant set.`);
        process.exit(1);
    }

    const cataloguePermId = cataloguePerm.id;
    const proxyPermId = proxyPerm.id;
    console.log(
        `Permission ids → "${CATALOGUE_PERMISSION}"=${cataloguePermId}, proxy "${PROXY_PERMISSION}"=${proxyPermId}\n`
    );

    const tenants = await globalPrisma.tenant.findMany({
        where: { databaseName: { not: null } },
        select: { id: true, tenantName: true, databaseName: true },
        orderBy: { id: "asc" },
    });

    let totalGranted = 0;
    let totalSkipped = 0;

    for (const tenant of tenants) {
        const dbName = tenant.databaseName!;
        let prisma;
        try {
            prisma = getTenantPrisma(dbName);

            // Roles that already hold the proxy permission and don't yet hold catalogue.
            const proxyRoleLinks = await prisma.rolePermission.findMany({
                where: { permissionId: proxyPermId, deleted: false },
                select: { roleId: true },
            });
            const candidateRoleIds = [...new Set(proxyRoleLinks.map((r) => r.roleId))];

            if (candidateRoleIds.length === 0) {
                console.log(`· ${dbName}: no roles with "${PROXY_PERMISSION}" — nothing to grant`);
                continue;
            }

            // Which of those already have catalogue (so we skip / re-activate idempotently)?
            const existing = await prisma.rolePermission.findMany({
                where: { permissionId: cataloguePermId, roleId: { in: candidateRoleIds } },
                select: { roleId: true, deleted: true },
            });
            const existingByRole = new Map(existing.map((e) => [e.roleId, e.deleted]));

            const toGrant = candidateRoleIds.filter((id) => existingByRole.get(id) !== false);

            if (toGrant.length === 0) {
                console.log(`· ${dbName}: all ${candidateRoleIds.length} eligible role(s) already granted — skip`);
                totalSkipped += candidateRoleIds.length;
                continue;
            }

            console.log(
                `· ${dbName}: granting "${CATALOGUE_PERMISSION}" to ${toGrant.length} role(s) [${toGrant.join(", ")}]`
            );
            totalGranted += toGrant.length;

            if (confirm) {
                for (const roleId of toGrant) {
                    // upsert by the @@unique([roleId, permissionId]); un-delete if soft-deleted.
                    await prisma.rolePermission.upsert({
                        where: { roleId_permissionId: { roleId, permissionId: cataloguePermId } },
                        update: { deleted: false, deletedAt: null },
                        create: { roleId, permissionId: cataloguePermId },
                    });
                }
            }
        } catch (error) {
            console.error(`  ! ${dbName}: failed — ${(error as Error).message}`);
        }
    }

    console.log(
        `\n${confirm ? "Granted" : "Would grant"} ${totalGranted} role-permission link(s); ${totalSkipped} already present.`
    );
    if (!confirm) console.log("DRY RUN — re-run with --confirm to apply.");
}

if (require.main === module) {
    main()
        .catch((error) => {
            console.error("Error:", error);
            process.exit(1);
        })
        .finally(() => disconnectAllPrismaClients());
}

export default main;
