import dotenv from "dotenv";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const execAsync = promisify(exec);

type Target = "local" | "prod" | "newprod";

const target: Target = (process.argv[2] as Target) || "local";
const backupDir = process.argv[3];
const confirmed = process.argv.includes("--yes-i-am-sure");

function usage(): never {
    console.error("Usage: node dist/script/db_restore.js <target> <backup_dir> [--yes-i-am-sure]");
    console.error("  target:     local | prod | newprod");
    console.error("  backup_dir: dir containing global.sql + one <tenant_db_name>.sql per tenant");
    console.error("");
    console.error("Restoring into 'prod' OVERWRITES live production and requires --yes-i-am-sure.");
    process.exit(1);
}

if (!backupDir) usage();

if (!fs.existsSync(backupDir) || !fs.statSync(backupDir).isDirectory()) {
    console.error(`Backup dir does not exist or is not a directory: ${backupDir}`);
    process.exit(1);
}

// Resolve credentials for the chosen target. Mirrors db_backup.ts / db_upgrade.ts.
if (target === "prod") {
    if (!process.env.PROD_GLOBAL_DB_URL || !process.env.PROD_TENANT_DATABASE_URL) {
        console.error("Missing PROD_GLOBAL_DB_URL or PROD_TENANT_DATABASE_URL in .env");
        process.exit(1);
    }
    if (!confirmed) {
        console.error("Refusing to restore into PROD without --yes-i-am-sure.");
        console.error("This overwrites the live production database.");
        process.exit(1);
    }
    process.env.GLOBAL_DB_URL = process.env.PROD_GLOBAL_DB_URL;
    process.env.TENANT_DATABASE_URL = process.env.PROD_TENANT_DATABASE_URL;
    console.log("Target: PROD  (live production — overwriting)");
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

interface ParsedUrl {
    user: string;
    password: string;
    host: string;
    port: string;
    database: string;
    requireSsl: boolean;
}

// Same parser as db_backup.ts — keep the two in sync.
function parseMysqlUrl(url: string): ParsedUrl {
    const match = url.match(/^mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)(\?.*)?$/);
    if (!match) {
        throw new Error(`Cannot parse MySQL URL: ${url.replace(/:[^@]*@/, ":****@")}`);
    }
    const [, user, password, host, port, database, query] = match;
    const requireSsl = !!query && /sslaccept=strict/i.test(query);
    return { user, password, host, port, database, requireSsl };
}

function baseArgs(p: ParsedUrl): string[] {
    return [`-h ${p.host}`, `-P ${p.port}`, `-u ${p.user}`, p.requireSsl ? "--ssl-mode=REQUIRED" : ""].filter(Boolean);
}

async function runMysql(p: ParsedUrl, sql: string): Promise<void> {
    const cmd = ["mysql", ...baseArgs(p), `-e "${sql.replace(/"/g, '\\"')}"`].join(" ");
    await execAsync(cmd, { env: { ...process.env, MYSQL_PWD: p.password }, maxBuffer: 1024 * 1024 * 64 });
}

interface ManifestEntry {
    name: string;
    file: string;
    charset: string;
    collation: string;
}

async function restoreFile(p: ParsedUrl, dbName: string, sqlFile: string, entry?: ManifestEntry): Promise<void> {
    // The dump has no CREATE DATABASE (mysqldump of a single db), so create it first —
    // with the source's charset/collation when the manifest has it. A table added later by
    // a Prisma migration inherits the DATABASE default; getting it wrong breaks joins.
    const charsetClause = entry ? ` CHARACTER SET ${entry.charset} COLLATE ${entry.collation}` : "";
    await runMysql(p, `CREATE DATABASE IF NOT EXISTS \\\`${dbName}\\\`${charsetClause}`);
    const cmd = ["mysql", ...baseArgs(p), dbName, `< "${sqlFile}"`].join(" ");
    await execAsync(cmd, { env: { ...process.env, MYSQL_PWD: p.password }, maxBuffer: 1024 * 1024 * 256 });
}

async function restore(): Promise<void> {
    const globalUrl = process.env.GLOBAL_DB_URL!;
    const globalParsed = parseMysqlUrl(globalUrl);
    const tenantUrlTemplate = process.env.TENANT_DATABASE_URL!;

    const manifestPath = path.join(backupDir, "manifest.json");
    const manifest: ManifestEntry[] = fs.existsSync(manifestPath)
        ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
        : [];
    const entryFor = (dbName: string) => manifest.find((m) => m.name === dbName);
    if (manifest.length === 0) {
        console.warn("WARNING: no manifest.json — databases will be created with the SERVER default");
        console.warn("         charset/collation, which may differ from the source. Re-take the backup");
        console.warn("         with the current db_backup.ts to get one.\n");
    }

    console.log(`Restoring from: ${backupDir}`);
    console.log(`Into server:    ${globalParsed.host}:${globalParsed.port}\n`);

    // 1) Global DB — must land first; tenant list is read from the dump filenames,
    //    not from the target (the target is empty on a fresh server).
    const globalFile = path.join(backupDir, "global.sql");
    if (!fs.existsSync(globalFile)) {
        throw new Error(`Missing global.sql in ${backupDir}`);
    }
    console.log(`Restoring global → ${globalParsed.database}`);
    await restoreFile(globalParsed, globalParsed.database, globalFile, entryFor(globalParsed.database));
    console.log(`  OK (${(fs.statSync(globalFile).size / 1024).toFixed(1)} KB)\n`);

    // 2) Every other .sql in the dir is a tenant database, named after the file.
    const tenantFiles = fs
        .readdirSync(backupDir)
        .filter((f) => f.endsWith(".sql") && f !== "global.sql")
        .sort();

    if (tenantFiles.length === 0) {
        console.warn("No tenant .sql files found — restored global only.\n");
    }

    for (const file of tenantFiles) {
        const dbName = path.basename(file, ".sql");
        const tenantUrl = tenantUrlTemplate.replace("{tenant_db_name}", dbName);
        const parsed = parseMysqlUrl(tenantUrl);
        const full = path.join(backupDir, file);
        console.log(`Restoring ${dbName}`);
        try {
            await restoreFile(parsed, dbName, full, entryFor(dbName));
            console.log(`  OK (${(fs.statSync(full).size / 1024).toFixed(1)} KB)\n`);
        } catch (err) {
            console.error(`  FAILED: ${(err as Error).message}\n`);
            throw err;
        }
    }

    console.log(`Restore complete: 1 global + ${tenantFiles.length} tenant database(s).`);
    console.log("Next: verify with db_verify.js. The dumps carry _prisma_migrations, so the migration");
    console.log("state is already the source's — do NOT run upgrade_db on a scoped restore: it walks every");
    console.log("tenant listed in `global`, including ones whose databases were deliberately not copied.");
}

async function main() {
    try {
        await restore();
    } catch (err) {
        console.error("Restore aborted:", (err as Error).message);
        console.error((err as Error).stack);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
