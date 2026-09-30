import dotenv from "dotenv";
import { exec } from "child_process";
import { promisify } from "util";

dotenv.config();
const execAsync = promisify(exec);

// Compares two servers database-by-database: default charset/collation, the set of tables,
// and an EXACT row count per table (COUNT(*), not the information_schema estimate).
// Used to prove a restore is complete. Read-only on both sides.
//
//   node dist/script/db_verify.js prod newprod --only=audio_technic_db,web_bytes_db
//
// `global` is always included. Exit code 1 on any difference.

type Target = "local" | "prod" | "newprod";

function urlsFor(target: Target): { global: string; tenant: string } {
    const pick = (g?: string, t?: string) => {
        if (!g || !t) throw new Error(`Missing DB URLs for target "${target}" in .env`);
        return { global: g, tenant: t };
    };
    if (target === "prod") return pick(process.env.PROD_GLOBAL_DB_URL, process.env.PROD_TENANT_DATABASE_URL);
    if (target === "newprod") return pick(process.env.NEWPROD_GLOBAL_DB_URL, process.env.NEWPROD_TENANT_DATABASE_URL);
    if (target === "local") return pick(process.env.GLOBAL_DB_URL, process.env.TENANT_DATABASE_URL);
    throw new Error(`Unknown target "${target}"`);
}

interface ParsedUrl { user: string; password: string; host: string; port: string; database: string; requireSsl: boolean }

// Same parser as db_backup.ts / db_restore.ts.
function parseMysqlUrl(url: string): ParsedUrl {
    const match = url.match(/^mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)(\?.*)?$/);
    if (!match) throw new Error(`Cannot parse MySQL URL: ${url.replace(/:[^@]*@/, ":****@")}`);
    const [, user, password, host, port, database, query] = match;
    return { user, password, host, port, database, requireSsl: !!query && /sslaccept=strict/i.test(query) };
}

async function query(p: ParsedUrl, sql: string): Promise<string[][]> {
    const cmd = ["mysql", `-h ${p.host}`, `-P ${p.port}`, `-u ${p.user}`,
        p.requireSsl ? "--ssl-mode=REQUIRED" : "", "-N", "-B", `-e "${sql.replace(/"/g, '\\"').replace(/`/g, "\\`")}"`]
        .filter(Boolean).join(" ");
    const { stdout } = await execAsync(cmd, { env: { ...process.env, MYSQL_PWD: p.password }, maxBuffer: 1024 * 1024 * 64 });
    return stdout.split("\n").filter(Boolean).map((l) => l.split("\t"));
}

interface DbSnapshot { collation: string | null; counts: Map<string, number> }

async function snapshot(p: ParsedUrl, db: string): Promise<DbSnapshot> {
    const sch = await query(p, `SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='${db}'`);
    if (sch.length === 0) return { collation: null, counts: new Map() };
    const tables = (await query(p, `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='${db}' AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME`)).map((r) => r[0]);
    const counts = new Map<string, number>();
    // Batch the COUNT(*)s to keep each command line a sane length.
    for (let i = 0; i < tables.length; i += 40) {
        const chunk = tables.slice(i, i + 40);
        const sql = chunk.map((t) => `SELECT '${t}', COUNT(*) FROM \`${db}\`.\`${t}\``).join(" UNION ALL ");
        for (const [t, c] of await query(p, sql)) counts.set(t, Number(c));
    }
    return { collation: `${sch[0][0]} / ${sch[0][1]}`, counts };
}

async function main() {
    const [a, b] = [process.argv[2] as Target, process.argv[3] as Target];
    if (!a || !b) {
        console.error("Usage: node dist/script/db_verify.js <targetA> <targetB> [--only=a_db,b_db]");
        process.exit(1);
    }
    const onlyArg = process.argv.find((x) => x.startsWith("--only="));
    const tenants = onlyArg ? onlyArg.slice(7).split(",").map((s) => s.trim()).filter(Boolean) : [];

    const ua = urlsFor(a), ub = urlsFor(b);
    const ga = parseMysqlUrl(ua.global), gb = parseMysqlUrl(ub.global);
    const dbs = [ga.database, ...tenants];
    let problems = 0;

    console.log(`Comparing ${a} (${ga.host}) vs ${b} (${gb.host})\n`);
    for (const db of dbs) {
        const pa = db === ga.database ? ga : parseMysqlUrl(ua.tenant.replace("{tenant_db_name}", db));
        const pb = db === gb.database ? gb : parseMysqlUrl(ub.tenant.replace("{tenant_db_name}", db));
        const [sa, sb] = await Promise.all([snapshot(pa, db), snapshot(pb, db)]);

        const names = new Set([...sa.counts.keys(), ...sb.counts.keys()]);
        const rowsA = [...sa.counts.values()].reduce((x, y) => x + y, 0);
        const rowsB = [...sb.counts.values()].reduce((x, y) => x + y, 0);
        const diffs: string[] = [];
        if (sa.collation !== sb.collation) diffs.push(`  collation: ${a}=${sa.collation}  ${b}=${sb.collation}`);
        for (const t of [...names].sort()) {
            const ca = sa.counts.get(t), cb = sb.counts.get(t);
            if (ca !== cb) diffs.push(`  ${t}: ${a}=${ca ?? "MISSING"}  ${b}=${cb ?? "MISSING"}`);
        }
        const ok = diffs.length === 0;
        if (!ok) problems += diffs.length;
        console.log(`${ok ? "OK  " : "DIFF"} ${db.padEnd(20)} ${String(names.size).padStart(3)} tables  ` +
            `${rowsA.toLocaleString().padStart(9)} rows (${a})  ${rowsB.toLocaleString().padStart(9)} rows (${b})  [${sa.collation}]`);
        diffs.forEach((d) => console.log(d));
    }
    console.log(problems === 0 ? "\nIDENTICAL." : `\n${problems} difference(s).`);
    process.exit(problems === 0 ? 0 : 1);
}

main().catch((err) => {
    console.error("Verify aborted:", (err as Error).message.replace(/MYSQL_PWD=\S+/g, "MYSQL_PWD=****"));
    process.exit(2);
});
