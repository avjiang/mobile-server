/**
 * Backward-compat default grants for the anomaly-alerts permissions (Sprint 010).
 *
 *   "Void & Refund Sales"                 → every role holding "View Sales History"
 *       WHY: void / return / refund now require it (PUT /sales/void|return|refund).
 *       Before, anyone who could open sales history could reverse a sale, so the
 *       backfill keeps exactly those people able to; owners can take it away after.
 *   "Receive Security Alert Notification" → every role holding "View Financial Reports"
 *   "Manage Security Alerts"              → every role holding "View Financial Reports"
 *       WHY: alerts go to the owner (Super Admin gets them through '*') and the
 *       managers — the roles that already see the money.
 *
 *   npx ts-node src/script/grant_anomaly_permissions.ts <local|prod> [--confirm]
 *
 * Without --confirm it is a DRY RUN: prints what it WOULD grant, no writes.
 * Idempotent: re-running skips roles that already have the permission.
 *
 * Permissions live in the GLOBAL db (Permission table); role→permission mappings
 * (RolePermission) live PER-TENANT and reference Permission.id by value (no FK).
 *
 * ⚠️ With --confirm it runs permission_seed first so the new names exist before
 * their ids are resolved (a dry run needs the seed to have run already). On prod,
 * take a backup first (`npm run backup_db_prod`).
 */
import dotenv from "dotenv";

dotenv.config();

type Target = "local" | "prod";

const target: Target = (process.argv[2] as Target) || "local";
const confirm = process.argv.includes("--confirm");

if (!["local", "prod"].includes(target)) {
    console.error("Usage: npx ts-node src/script/grant_anomaly_permissions.ts <local|prod> [--confirm]");
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
const { getGlobalPrisma, getTenantPrisma, disconnectAllPrismaClients, databasesOnServer } =
    require("../db") as typeof import("../db");
const { seedPermissions } = require("./permission_seed") as typeof import("./permission_seed");

/** target permission → the permission whose holders get it. */
export const GRANTS: { target: string; proxy: string }[] = [
    { target: "Void & Refund Sales", proxy: "View Sales History" },
    { target: "Receive Security Alert Notification", proxy: "View Financial Reports" },
    { target: "Manage Security Alerts", proxy: "View Financial Reports" },
];

async function permissionId(name: string): Promise<number> {
    const perm = await getGlobalPrisma().permission.findUnique({ where: { name }, select: { id: true } });
    if (!perm) {
        console.error(`"${name}" not found in global Permission table. Run permission_seed first (or pass --confirm).`);
        process.exit(1);
    }
    return perm.id;
}

async function main() {
    console.log(`mode: ${confirm ? "APPLY" : "DRY RUN"}\n`);

    if (confirm) {
        await seedPermissions();
    } else {
        console.log("(dry run) skipping permission_seed — assuming it has been / will be run\n");
    }

    const resolved: { target: string; proxy: string; targetId: number; proxyId: number }[] = [];
    for (const g of GRANTS) {
        resolved.push({ ...g, targetId: await permissionId(g.target), proxyId: await permissionId(g.proxy) });
    }
    for (const r of resolved) console.log(`"${r.target}"=${r.targetId} ← holders of "${r.proxy}"=${r.proxyId}`);
    console.log("");

    const tenants = await getGlobalPrisma().tenant.findMany({
        where: { databaseName: { not: null } },
        select: { id: true, databaseName: true },
        orderBy: { id: "asc" },
    });
    const onServer = await databasesOnServer();

    let totalGranted = 0;
    let totalSkipped = 0;

    for (const tenant of tenants) {
        const dbName = tenant.databaseName!;
        if (!onServer.has(dbName)) {
            console.log(`· ${dbName}: no database on this server — skipped`);
            continue;
        }
        try {
            const prisma = getTenantPrisma(dbName);
            for (const r of resolved) {
                const proxyLinks = await prisma.rolePermission.findMany({
                    where: { permissionId: r.proxyId, deleted: false },
                    select: { roleId: true },
                });
                const candidates = [...new Set(proxyLinks.map((l) => l.roleId))];
                if (candidates.length === 0) continue;

                const existing = await prisma.rolePermission.findMany({
                    where: { permissionId: r.targetId, roleId: { in: candidates } },
                    select: { roleId: true, deleted: true },
                });
                const deletedByRole = new Map(existing.map((e) => [e.roleId, e.deleted]));
                const toGrant = candidates.filter((id) => deletedByRole.get(id) !== false);
                totalSkipped += candidates.length - toGrant.length;
                if (toGrant.length === 0) continue;

                console.log(`· ${dbName}: "${r.target}" → role(s) [${toGrant.join(", ")}]`);
                totalGranted += toGrant.length;
                if (confirm) {
                    for (const roleId of toGrant) {
                        await prisma.rolePermission.upsert({
                            where: { roleId_permissionId: { roleId, permissionId: r.targetId } },
                            update: { deleted: false, deletedAt: null },
                            create: { roleId, permissionId: r.targetId },
                        });
                    }
                }
            }
        } catch (error) {
            console.error(`  ! ${dbName}: failed — ${(error as Error).message}`);
        }
    }

    console.log(`\n${confirm ? "Granted" : "Would grant"} ${totalGranted} role-permission link(s); ${totalSkipped} already present.`);
    console.log("Super Admin roles hold '*' and need no rows.");
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
