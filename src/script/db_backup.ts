import dotenv from "dotenv";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const execAsync = promisify(exec);

type Target = "local" | "prod" | "newprod";

const target: Target = (process.argv[2] as Target) || "local";

// Optional scope: `--only=a_db,b_db` dumps just these tenant databases (global is always
// included). Without it, every tenant in the global `tenant` table is dumped.
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const onlyDbs: string[] | null = onlyArg
    ? onlyArg.slice("--only=".length).split(",").map((d) => d.trim()).filter(Boolean)
    : null;

if (target === "prod") {
    if (!process.env.PROD_GLOBAL_DB_URL || !process.env.PROD_TENANT_DATABASE_URL) {
        console.error("Missing PROD_GLOBAL_DB_URL or PROD_TENANT_DATABASE_URL in .env");
        process.exit(1);
    }
    process.env.GLOBAL_DB_URL = process.env.PROD_GLOBAL_DB_URL;
    process.env.TENANT_DATABASE_URL = process.env.PROD_TENANT_DATABASE_URL;
    console.log("Target: PROD");
} else if (target === "newprod") {
    if (!process.env.NEWPROD_GLOBAL_DB_URL || !process.env.NEWPROD_TENANT_DATABASE_URL) {
        console.error("Missing NEWPROD_GLOBAL_DB_URL or NEWPROD_TENANT_DATABASE_URL in .env");
        process.exit(1);
    }
    process.env.GLOBAL_DB_URL = process.env.NEWPROD_GLOBAL_DB_URL;
    process.env.TENANT_DATABASE_URL = process.env.NEWPROD_TENANT_DATABASE_URL;
    console.log("Target: NEWPROD");
} else if (target === "local") {
    console.log("Target: LOCAL");
} else {
    console.error(`Unknown target "${target}". Use "local", "prod", or "newprod".`);
    process.exit(1);
}

// Load db.ts AFTER env override so the global Prisma client points at the chosen DB.
const { getGlobalPrisma, disconnectAllPrismaClients } = require("../db") as typeof import("../db");

interface ParsedUrl {
    user: string;
    password: string;
    host: string;
    port: string;
    database: string;
    requireSsl: boolean;
}

function parseMysqlUrl(url: string): ParsedUrl {
    const match = url.match(/^mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)(\?.*)?$/);
    if (!match) {
        throw new Error(`Cannot parse MySQL URL: ${url.replace(/:[^@]*@/, ":****@")}`);
    }
    const [, user, password, host, port, database, query] = match;
    const requireSsl = !!query && /sslaccept=strict/i.test(query);
    return { user, password, host, port, database, requireSsl };
}

async function dumpDatabase(url: string, outputFile: string): Promise<void> {
    const parsed = parseMysqlUrl(url);
    const sslFlag = parsed.requireSsl ? "--ssl-mode=REQUIRED" : "";
    const cmd = [
        "mysqldump",
        `-h ${parsed.host}`,
        `-P ${parsed.port}`,
        `-u ${parsed.user}`,
        sslFlag,
        "--single-transaction",
        "--routines",
        "--triggers",
        "--set-gtid-purged=OFF",
        parsed.database,
        `> "${outputFile}"`,
    ]
        .filter(Boolean)
        .join(" ");

    // Pass password via MYSQL_PWD so special chars don't break shell escaping.
    await execAsync(cmd, {
        env: { ...process.env, MYSQL_PWD: parsed.password },
        maxBuffer: 1024 * 1024 * 64,
    });
}

async function backup(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
    const backupDir = path.join(__dirname, "..", "..", "backups", `${target}_${timestamp}`);
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`Backup dir: ${backupDir}\n`);

    // 1) Global DB
    const globalUrl = process.env.GLOBAL_DB_URL!;
    const globalFile = path.join(backupDir, "global.sql");
    console.log(`Dumping global → ${path.basename(globalFile)}`);
    try {
        await dumpDatabase(globalUrl, globalFile);
        const size = (fs.statSync(globalFile).size / 1024).toFixed(1);
        console.log(`  OK (${size} KB)\n`);
    } catch (err) {
        console.error(`  FAILED: ${(err as Error).message}\n`);
        throw err;
    }

    // 2) Each tenant DB
    const globalPrisma = getGlobalPrisma();
    const tenants = await globalPrisma.tenant.findMany();
    const tenantUrlTemplate = process.env.TENANT_DATABASE_URL!;

    let dbNames = tenants
        .map((t) => t.databaseName)
        .filter((n): n is string => !!n);
    // What actually exists on this server. A tenant row can outlive its database (e.g. test
    // tenants deliberately not carried over in the 2026-09-26 server move): there is nothing to
    // dump, so skip it loudly rather than abort the backup of every real tenant after it.
    const onServer = new Set(
        (await globalPrisma.$queryRawUnsafe<{ name: string }[]>(
            "SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA",
        )).map((r) => r.name),
    );
    if (onlyDbs) {
        const notTenants = onlyDbs.filter((d) => !dbNames.includes(d));
        if (notTenants.length) {
            throw new Error(`--only names not found in the tenant table: ${notTenants.join(", ")}`);
        }
        const notOnServer = onlyDbs.filter((d) => !onServer.has(d));
        if (notOnServer.length) {
            throw new Error(`--only names not present on this server: ${notOnServer.join(", ")}`);
        }
        dbNames = onlyDbs;
        console.log(`Scoped to: global + ${dbNames.join(", ")}\n`);
    } else {
        const absent = dbNames.filter((d) => !onServer.has(d));
        if (absent.length) {
            console.warn(`WARNING: ${absent.length} tenant(s) in the tenant table have NO database on this server — skipped:`);
            console.warn(`         ${absent.join(", ")}\n`);
            dbNames = dbNames.filter((d) => onServer.has(d));
        }
    }

    // Each database's default charset/collation, so the restore recreates it exactly.
    // Not cosmetic: a table added later by a Prisma migration inherits the DATABASE
    // default, and a mismatch with existing tables breaks joins ("Illegal mix of collations").
    const globalDbName = parseMysqlUrl(globalUrl).database;
    const schemaNames = [globalDbName, ...dbNames];
    const schemata = await globalPrisma.$queryRawUnsafe<
        { name: string; charset: string; collation: string }[]
    >(
        `SELECT SCHEMA_NAME AS name, DEFAULT_CHARACTER_SET_NAME AS charset, DEFAULT_COLLATION_NAME AS collation
         FROM information_schema.SCHEMATA WHERE SCHEMA_NAME IN (${schemaNames.map(() => "?").join(",")})`,
        ...schemaNames,
    );
    const manifest = schemata.map((r) => ({
        name: r.name,
        file: r.name === globalDbName ? "global.sql" : `${r.name}.sql`,
        charset: r.charset,
        collation: r.collation,
    }));
    fs.writeFileSync(path.join(backupDir, "manifest.json"), JSON.stringify(manifest, null, 2));
    console.log(`Wrote manifest.json (${manifest.length} databases with charset/collation)\n`);

    for (const dbName of dbNames) {
        const url = tenantUrlTemplate.replace("{tenant_db_name}", dbName);
        const file = path.join(backupDir, `${dbName}.sql`);
        console.log(`Dumping ${dbName} → ${path.basename(file)}`);
        try {
            await dumpDatabase(url, file);
            const size = (fs.statSync(file).size / 1024).toFixed(1);
            console.log(`  OK (${size} KB)\n`);
        } catch (err) {
            console.error(`  FAILED: ${(err as Error).message}\n`);
            throw err;
        }
    }

    console.log(`All backups complete. Location: ${backupDir}`);
}

async function main() {
    try {
        await backup();
    } catch (err) {
        console.error("Backup aborted:", (err as Error).message);
        console.error((err as Error).stack);
        process.exit(1);
    } finally {
        await disconnectAllPrismaClients();
    }
}

if (require.main === module) {
    main();
}
