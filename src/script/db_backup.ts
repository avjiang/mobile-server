import dotenv from "dotenv";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const execAsync = promisify(exec);

type Target = "local" | "prod";

const target: Target = (process.argv[2] as Target) || "local";

if (target === "prod") {
    if (!process.env.PROD_GLOBAL_DB_URL || !process.env.PROD_TENANT_DATABASE_URL) {
        console.error("Missing PROD_GLOBAL_DB_URL or PROD_TENANT_DATABASE_URL in .env");
        process.exit(1);
    }
    process.env.GLOBAL_DB_URL = process.env.PROD_GLOBAL_DB_URL;
    process.env.TENANT_DATABASE_URL = process.env.PROD_TENANT_DATABASE_URL;
    console.log("Target: PROD");
} else if (target === "local") {
    console.log("Target: LOCAL");
} else {
    console.error(`Unknown target "${target}". Use "local" or "prod".`);
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

    for (const t of tenants) {
        if (!t.databaseName) {
            console.warn(`Skipping tenant #${t.id}: databaseName missing`);
            continue;
        }
        const url = tenantUrlTemplate.replace("{tenant_db_name}", t.databaseName);
        const file = path.join(backupDir, `${t.databaseName}.sql`);
        console.log(`Dumping ${t.databaseName} → ${path.basename(file)}`);
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
