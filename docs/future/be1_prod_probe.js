#!/usr/bin/env node
/**
 * BE-1 PRE-DEPLOY PROBE — READ-ONLY. Runs zero writes (SELECT only).
 *
 * Enumerates every tenant DB and reports the three things that decide whether
 * the multi-outlet migration (20260928120000_multi_outlet_fks_and_user_outlet)
 * is safe to deploy:
 *   1. Is there a resolvable primary outlet?  (@primary_outlet = MIN(ID) WHERE IS_DELETED=false)
 *      A tenant with NO live outlet is NO-GO when it has any outlet-scoped rows
 *      or any live users (the user_outlet seed would skip them → nobody has an outlet).
 *   2. Are there orphan OUTLET_ID rows the backfill must repoint before the RESTRICT FKs?
 *   3. Dangling menu_profile_outlet rows (menu profile gone) — the migration deletes
 *      them before the MENU_PROFILE_ID FK; reported as "auto-cleaned".
 *   4. More than one live outlet → NO-GO (the backfill + seed assume single-outlet).
 *   5. Is BE-1 already applied? Decided from `_prisma_migrations` (finished, not
 *      rolled back) — NOT from whether user_outlet exists, since a partial/failed
 *      run can leave the table behind.
 *
 * Prints a per-tenant report and an overall GO / NO-GO verdict.
 *
 * Usage (from the bayaryuk-server repo root, with .env present):
 *   node docs/future/be1_prod_probe.js            # targets PROD (default)
 *   node docs/future/be1_prod_probe.js --local    # targets local dev DBs
 *   MYSQL_BIN=/path/to/mysql node docs/future/be1_prod_probe.js
 *
 * Azure gotcha: Azure MySQL negotiates the mysql_native_password auth plugin,
 * which Homebrew mysql 9.x DROPPED. If you get "ERROR 2059 auth plugin cannot
 * be loaded", install a client that still ships it and point MYSQL_BIN at it:
 *   brew install mysql-client@8.4
 *   MYSQL_BIN=/opt/homebrew/opt/mysql-client@8.4/bin/mysql node docs/future/be1_prod_probe.js
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const LOCAL = process.argv.includes("--local");
const ENV_PATH = path.resolve(__dirname, "..", "..", ".env");
const env = fs.readFileSync(ENV_PATH, "utf8");
function g(k){ const m = env.match(new RegExp("^"+k+"\\s*=\\s*\"?([^\"\n]+)","m")); return m ? m[1].trim() : null; }

// Pick a mysql client that can auth to Azure (native_password plugin).
function findMysql(){
  if (process.env.MYSQL_BIN) return process.env.MYSQL_BIN;
  const candidates = [
    "/opt/homebrew/opt/mysql-client@8.4/bin/mysql",
    "/usr/local/opt/mysql-client@8.4/bin/mysql",
    "mysql",
  ];
  for (const c of candidates){ try { execFileSync(c, ["--version"], {stdio:"ignore"}); return c; } catch(_){} }
  throw new Error("No mysql client found. Set MYSQL_BIN. For Azure: brew install mysql-client@8.4");
}
const MC = findMysql();

const GLOBAL_URL = LOCAL ? g("GLOBAL_DB_URL")        : g("PROD_GLOBAL_DB_URL");
const TENANT_TMPL = LOCAL ? g("TENANT_DATABASE_URL") : g("PROD_TENANT_DATABASE_URL");
if (!GLOBAL_URL || !TENANT_TMPL) throw new Error("Missing DB URLs in .env for target "+(LOCAL?"local":"prod"));

function parse(url){
  const m = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)(\?.*)?$/);
  if(!m) throw new Error("Cannot parse URL");
  return { user:m[1], pw:m[2], host:m[3], port:m[4], db:m[5], ssl:/sslaccept=strict/i.test(m[6]||"") };
}
function q(url, sql){
  const p = parse(url);
  const args = ["-h",p.host,"-P",p.port,"-u",p.user,"-N"];
  if (p.ssl) args.push("--ssl-mode=REQUIRED");
  args.push("-D", p.db, "-e", sql);
  return execFileSync(MC, args, {env:{...process.env, MYSQL_PWD:p.pw}, timeout:30000}).toString().trim();
}
function tryq(url, sql){ try { return q(url, sql); } catch(e){ return "ERR:"+String(e.message).split(/\n/).find(l=>/ERROR/.test(l)||l); } }

// The 9 tables that receive a RESTRICT FK on OUTLET_ID.
const FK_TABLES = ["sales","payment","session","invoice","delivery_order","quotation","purchase_order","register_log","menu_profile_outlet"];
const MIGRATION = "20260928120000_multi_outlet_fks_and_user_outlet";

console.log("=".repeat(60));
console.log("BE-1 PRE-DEPLOY PROBE  (READ-ONLY)  target="+(LOCAL?"LOCAL":"PROD"));
console.log("mysql client: "+MC);
console.log("=".repeat(60)+"\n");

const tenants = q(GLOBAL_URL, "SELECT ID, TENANT_NAME, DATABASE_NAME FROM tenant ORDER BY ID;")
  .split("\n").filter(Boolean).map(l => l.split("\t"));
console.log("tenants: "+tenants.length+"\n");

const verdicts = [];
for (const [id, name, db] of tenants){
  const url = TENANT_TMPL.replace("{tenant_db_name}", db);
  console.log("-".repeat(60));
  console.log(`#${id}  ${name}  /  ${db}`);
  if (!db){ console.log("  (no DATABASE_NAME) — SKIP"); verdicts.push({db:name, go:null, reason:"no db name"}); continue; }

  // Applied-ness comes from Prisma's own ledger. finished + not rolled back = applied;
  // a row with finished_at NULL (and not rolled back) = a FAILED run that blocks
  // `migrate deploy` until it is resolved.
  const rec = tryq(url, `SELECT IF(finished_at IS NULL,'FAILED','ok') FROM _prisma_migrations WHERE migration_name='${MIGRATION}' AND rolled_back_at IS NULL ORDER BY started_at DESC LIMIT 1;`);
  const alreadyApplied = rec === "ok";
  const failedRun = rec === "FAILED";
  console.log("  BE-1 in _prisma_migrations: "+(rec.startsWith("ERR")?rec:(rec||"not applied")));
  const userOutletTable = tryq(url, `SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA="${db}" AND TABLE_NAME="user_outlet";`);
  if (!alreadyApplied && userOutletTable === "1") console.log("  note: user_outlet table exists without an applied migration record (partial/manual run) — migration is idempotent");

  const outlets = tryq(url, "SELECT ID, OUTLET_NAME, IS_DELETED FROM outlet ORDER BY ID;");
  const outletLines = (outlets && !outlets.startsWith("ERR")) ? outlets.split("\n").filter(Boolean) : [];
  console.log("  outlets: "+(outlets.startsWith("ERR")?outlets:outletLines.length));
  outletLines.forEach(l => console.log("    "+l.replace(/\t/g," | ")));

  const primary = tryq(url, "SELECT ID FROM outlet WHERE IS_DELETED=false ORDER BY ID ASC LIMIT 1;");
  const primaryOk = primary && !primary.startsWith("ERR");
  console.log("  @primary_outlet -> "+(primaryOk?primary:"NULL"));

  const liveOutlets = outletLines.filter(l=>l.split("\t")[2]==="0").length;
  let orphanTotal = 0, orphanErr = false, scopedRows = 0, multiOutlet = liveOutlets > 1;
  const liveUsers = parseInt(tryq(url, "SELECT COUNT(*) FROM user WHERE IS_DELETED=false;"),10) || 0;
  console.log("  live outlets: "+liveOutlets+"   live users: "+liveUsers);
  console.log("  orphans (rows whose OUTLET_ID resolves to no outlet):");
  for (const t of FK_TABLES){
    const ex = tryq(url, `SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA="${db}" AND TABLE_NAME="${t}";`);
    if (ex !== "1"){ console.log(`    ${t}: (absent)`); continue; }
    const hasCol = tryq(url, `SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA="${db}" AND TABLE_NAME="${t}" AND COLUMN_NAME="OUTLET_ID";`);
    const total = tryq(url, `SELECT COUNT(*) FROM ${t};`);
    if (hasCol !== "1"){ console.log(`    ${t}: total=${total} (no OUTLET_ID col yet)`); continue; }
    const nul = tryq(url, `SELECT COUNT(*) FROM ${t} WHERE OUTLET_ID IS NULL;`);
    const bad = tryq(url, `SELECT COUNT(*) FROM ${t} x LEFT JOIN outlet o ON o.ID=x.OUTLET_ID WHERE x.OUTLET_ID IS NOT NULL AND o.ID IS NULL;`);
    if (nul.startsWith("ERR")||bad.startsWith("ERR")) orphanErr = true;
    const n = (parseInt(nul,10)||0) + (parseInt(bad,10)||0);
    orphanTotal += n;
    scopedRows += parseInt(total,10) || 0;
    console.log(`    ${t}: total=${total} null=${nul} unresolved=${bad}${n>0?"  <-- backfill target":""}`);
  }

  // menu_profile_outlet rows whose menu profile is gone — deleted by the migration.
  let mpoDangling = 0;
  const mpoEx = tryq(url, `SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA="${db}" AND TABLE_NAME="menu_profile_outlet";`);
  if (mpoEx === "1"){
    const d = tryq(url, "SELECT COUNT(*) FROM menu_profile_outlet mpo LEFT JOIN menu_profile mp ON mp.ID=mpo.MENU_PROFILE_ID WHERE mp.ID IS NULL;");
    if (d.startsWith("ERR")) orphanErr = true;
    mpoDangling = parseInt(d,10) || 0;
    console.log("  menu_profile_outlet rows with no menu_profile: "+d+(mpoDangling>0?"  <-- auto-cleaned (DELETE) by the migration":""));
  }

  // Verdict for this tenant.
  let go = true, reasons = [];
  if (alreadyApplied){ go = null; reasons.push("already applied — will be skipped by migrate deploy"); }
  else {
    if (failedRun){ go = false; reasons.push(`FAILED run recorded — resolve first: npx prisma migrate resolve --rolled-back ${MIGRATION} --schema=prisma/client/schema.prisma`); }
    // A zero-outlet DB is only safe if it is completely empty: no scoped rows (nothing
    // to FK) AND no live users (the user_outlet seed skips → they would have no outlet).
    if (!primaryOk && scopedRows === 0 && liveUsers === 0) reasons.push("no live outlet but no scoped rows and no live users — safe; user_outlet seed skips");
    if (!primaryOk && (scopedRows > 0 || liveUsers > 0)){ go = false; reasons.push(`NO live outlet BUT ${scopedRows} scoped row(s) / ${liveUsers} live user(s) — backfill + user_outlet seed skip; create/restore an outlet first`); }
    if (orphanErr){ go = false; reasons.push("orphan probe errored — investigate before deploy"); }
    if (multiOutlet){ go = false; reasons.push(`MULTI-OUTLET tenant (${liveOutlets} live outlets) — backfill repoints orphans to the lowest outlet and every user is seeded to it only; decide per tenant before deploying`); }
    if (go && orphanTotal > 0) reasons.push(`${orphanTotal} orphan row(s) will be repointed to outlet ${primary}`);
    if (mpoDangling > 0) reasons.push(`${mpoDangling} dangling menu_profile_outlet row(s) will be auto-cleaned`);
  }
  const tag = go === null ? "SKIP" : (go ? "GO" : "NO-GO");
  console.log("  VERDICT: "+tag+(reasons.length?" — "+reasons.join("; "):""));
  verdicts.push({db, go, tag, reasons});
}

console.log("\n"+"=".repeat(60));
console.log("SUMMARY");
console.log("=".repeat(60));
for (const v of verdicts) console.log(`  ${(v.tag||"?").padEnd(6)} ${v.db}`);
const blockers = verdicts.filter(v => v.go === false);
console.log("");
if (blockers.length === 0) console.log("OVERALL: GO — no blockers. Back up prod, then run upgrade_db_prod.");
else { console.log("OVERALL: NO-GO — "+blockers.length+" tenant(s) blocked. DO NOT DEPLOY. Report:"); blockers.forEach(b=>console.log("  - "+b.db+": "+b.reasons.join("; "))); }
