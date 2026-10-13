/**
 * Backfill: take sale-level deductions off Sales.PROFIT_AMOUNT for sales stored
 * before the 2026-09-28 fix.
 *
 * WHY: PROFIT_AMOUNT used to be the plain sum of line profits, so the cart
 * discount and the whole loyalty chain (tier discount / voucher / prepaid-package
 * subscription discount / point redemption) lowered TOTAL_AMOUNT but not profit.
 * Laundry tenants hit it hardest — a wash fully covered by a prepaid package had
 * revenue 0 and full profit — and a session could show profit above revenue.
 * New sales are stored correctly; this repairs the ones already written.
 * Definition: src/sales/sale-profit.ts.
 *
 *   npx ts-node src/script/backfill_sale_net_profit.ts <local|prod> [databaseName] [--confirm]
 *
 * Without --confirm it is a DRY RUN (counts + a sample, no writes). No
 * databaseName = every tenant in the global db. Idempotent: only rows whose
 * PROFIT_AMOUNT differs from SUM(line PROFIT) − deductions are touched, and only
 * rows that HAVE a deduction, so sales without one are never rewritten.
 * Bumps UPDATED_AT + VERSION so delta sync ships the corrected rows.
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
    console.error("Usage: npx ts-node src/script/backfill_sale_net_profit.ts <local|prod> [databaseName] [--confirm]");
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
const { getGlobalPrisma, getTenantPrisma, disconnectAllPrismaClients, databasesOnServer } =
    require("../db") as typeof import("../db");
const { Prisma } = require("../../prisma/client/generated/client") as typeof import("../../prisma/client/generated/client");
const { SALE_LEVEL_DEDUCTIONS_SQL } = require("../sales/sale-profit") as typeof import("../sales/sale-profit");

const DEDUCTIONS = Prisma.raw(SALE_LEVEL_DEDUCTIONS_SQL);

// Line-profit sum per sale, joined to the header. Shared by the preview and the update.
const staleJoin = Prisma.sql`
    FROM sales s
    JOIN (
        SELECT SALES_ID, SUM(PROFIT) AS LINE_PROFIT
        FROM sales_item
        WHERE IS_DELETED = 0
        GROUP BY SALES_ID
    ) li ON li.SALES_ID = s.ID
    WHERE ${DEDUCTIONS} > 0
      AND s.PROFIT_AMOUNT <> li.LINE_PROFIT - ${DEDUCTIONS}`;

async function backfill(dbName: string): Promise<number> {
    const prisma = getTenantPrisma(dbName);
    const stale = await prisma.$queryRaw<Array<{ ID: number; STATUS: string; TOTAL_AMOUNT: any; PROFIT_AMOUNT: any; NET_PROFIT: any }>>(Prisma.sql`
        SELECT s.ID, s.STATUS, s.TOTAL_AMOUNT, s.PROFIT_AMOUNT, li.LINE_PROFIT - ${DEDUCTIONS} AS NET_PROFIT
        ${staleJoin}
        ORDER BY s.ID`);
    if (stale.length === 0) {
        console.log(`· ${dbName}: nothing to fix`);
        return 0;
    }
    console.log(`· ${dbName}: ${stale.length} sale(s) ${confirm ? "fixed" : "would be fixed"}`);
    for (const r of stale.slice(0, 10)) {
        console.log(`    #${r.ID} ${r.STATUS}: revenue ${Number(r.TOTAL_AMOUNT)} · profit ${Number(r.PROFIT_AMOUNT)} → ${Number(r.NET_PROFIT)}`);
    }
    if (stale.length > 10) console.log(`    … and ${stale.length - 10} more`);
    if (!confirm) return stale.length;

    await prisma.$executeRaw(Prisma.sql`
        UPDATE sales s
        JOIN (
            SELECT SALES_ID, SUM(PROFIT) AS LINE_PROFIT
            FROM sales_item
            WHERE IS_DELETED = 0
            GROUP BY SALES_ID
        ) li ON li.SALES_ID = s.ID
        SET s.PROFIT_AMOUNT = li.LINE_PROFIT - ${DEDUCTIONS},
            s.UPDATED_AT = NOW(),
            s.VERSION = COALESCE(s.VERSION, 1) + 1
        WHERE ${DEDUCTIONS} > 0
          AND s.PROFIT_AMOUNT <> li.LINE_PROFIT - ${DEDUCTIONS}`);
    return stale.length;
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
        const onServer = await databasesOnServer();
        const all = tenants.map((t) => t.databaseName!);
        dbNames = all.filter((n) => onServer.has(n));
        const absent = all.filter((n) => !onServer.has(n));
        if (absent.length) console.log(`Skipped ${absent.length} tenant(s) with no database on this server: ${absent.join(", ")}\n`);
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
    console.log(`\n${total} sale(s) ${confirm ? "fixed" : "to fix"} across ${dbNames.length} tenant(s)${failed ? `, ${failed} skipped` : ""}.`);
    if (!confirm && total > 0) console.log("Re-run with --confirm to apply.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(() => disconnectAllPrismaClients());
