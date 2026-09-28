#!/usr/bin/env node
/**
 * BE-1 PRE-DEPLOY PROBE — READ-ONLY. Runs zero writes (SELECT only).
 *
 * Enumerates every tenant DB and reports the three things that decide whether
 * the multi-outlet migration (20260702000000_multi_outlet_fks_and_user_outlet)
 * is safe to deploy:
 *   1. Is there a resolvable primary outlet?  (@primary_outlet = MIN(ID) WHERE IS_DELETED=false)
 *   2. Are there orphan OUTLET_ID rows the backfill must repoint before the RESTRICT FKs?
 *   3. Is BE-1 already applied (user_outlet present)?
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

  const be1 = tryq(url, `SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA="${db}" AND TABLE_NAME="user_outlet";`);
  const alreadyApplied = be1 === "1";
  console.log("  BE-1 already applied (user_outlet exists): "+(be1.startsWith("ERR")?be1:(alreadyApplied?"YES":"no")));

  const outlets = tryq(url, "SELECT ID, OUTLET_NAME, IS_DELETED FROM outlet ORDER BY ID;");
  const outletLines = (outlets && !outlets.startsWith("ERR")) ? outlets.split("\n").filter(Boolean) : [];
  console.log("  outlets: "+(outlets.startsWith("ERR")?outlets:outletLines.length));
  outletLines.forEach(l => console.log("    "+l.replace(/\t/g," | ")));

  const primary = tryq(url, "SELECT ID FROM outlet WHERE IS_DELETED=false ORDER BY ID ASC LIMIT 1;");
  const primaryOk = primary && !primary.startsWith("ERR");
  console.log("  @primary_outlet -> "+(primaryOk?primary:"NULL"));

  let orphanTotal = 0, orphanErr = false, multiOutlet = outletLines.filter(l=>l.split("\t")[2]==="0").length > 1;
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
    console.log(`    ${t}: total=${total} null=${nul} unresolved=${bad}${n>0?"  <-- backfill target":""}`);
  }

  // Verdict for this tenant.
  let go = true, reasons = [];
  if (alreadyApplied){ go = null; reasons.push("already applied — will be skipped by migrate deploy"); }
  else {
    // A zero-outlet DB is only safe if it has NO scoped rows (nothing to FK).
    if (!primaryOk && orphanTotal === 0) reasons.push("no outlet but no scoped rows — FK add on empty tables is safe; user_outlet seed skips");
    if (!primaryOk && orphanTotal > 0){ go = false; reasons.push("NO primary outlet BUT scoped rows exist — backfill skips, RESTRICT FK WILL ABORT"); }
    if (orphanErr){ go = false; reasons.push("orphan probe errored — investigate before deploy"); }
    if (multiOutlet) reasons.push("MULTI-OUTLET tenant — backfill repoints orphans to lowest outlet; confirm that's desired (see BE-2 caveat)");
    if (go && orphanTotal > 0) reasons.push(`${orphanTotal} orphan row(s) will be repointed to outlet ${primary}`);
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
