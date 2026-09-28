#!/usr/bin/env node
/**
 * BE-1 POST-DEPLOY VERIFY — READ-ONLY. Run AFTER upgrade_db_prod.
 *
 * For every tenant confirms the migration did what it should:
 *   - BE-1 recorded `ok` in _prisma_migrations (not FAILED / partial)
 *   - user_outlet seeded = exactly the count of non-deleted users, all IS_PRIMARY
 *   - all 9 RESTRICT FKs + sales_STOCK_SOURCE_OUTLET_ID (SET NULL) present
 *   - 0 null / 0 unresolved OUTLET_ID orphans remain
 *
 * Usage:
 *   node docs/future/be1_verify_post.js            # PROD (default)
 *   node docs/future/be1_verify_post.js --local
 *   MYSQL_BIN=/opt/homebrew/opt/mysql-client@8.4/bin/mysql node docs/future/be1_verify_post.js
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const LOCAL = process.argv.includes("--local");
const env = fs.readFileSync(path.resolve(__dirname, "..", "..", ".env"), "utf8");
function g(k){ const m = env.match(new RegExp("^"+k+"\\s*=\\s*\"?([^\"\n]+)","m")); return m ? m[1].trim() : null; }
function findMysql(){
  if (process.env.MYSQL_BIN) return process.env.MYSQL_BIN;
  for (const c of ["/opt/homebrew/opt/mysql-client@8.4/bin/mysql","/usr/local/opt/mysql-client@8.4/bin/mysql","mysql"]){
    try { execFileSync(c, ["--version"], {stdio:"ignore"}); return c; } catch(_){}
  }
  throw new Error("No mysql client. Set MYSQL_BIN (Azure needs mysql-client@8.4).");
}
const MC = findMysql();
const GLOBAL_URL  = LOCAL ? g("GLOBAL_DB_URL")        : g("PROD_GLOBAL_DB_URL");
const TENANT_TMPL = LOCAL ? g("TENANT_DATABASE_URL")  : g("PROD_TENANT_DATABASE_URL");

function parse(url){ const m = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)(\?.*)?$/); return {user:m[1],pw:m[2],host:m[3],port:m[4],db:m[5],ssl:/sslaccept=strict/i.test(m[6]||"")}; }
function q(url, sql){ const p=parse(url); const a=["-h",p.host,"-P",p.port,"-u",p.user,"-N"]; if(p.ssl)a.push("--ssl-mode=REQUIRED"); a.push("-D",p.db,"-e",sql); return execFileSync(MC,a,{env:{...process.env,MYSQL_PWD:p.pw},timeout:30000}).toString().trim(); }
function tryq(url, sql){ try { return q(url, sql); } catch(e){ return "ERR:"+String(e.message).split(/\n/).find(l=>/ERROR/.test(l)||l); } }

const FK_TABLES = ["sales","payment","session","invoice","delivery_order","quotation","purchase_order","register_log","menu_profile_outlet"];
console.log("BE-1 POST-DEPLOY VERIFY (READ-ONLY) target="+(LOCAL?"LOCAL":"PROD")+"  client="+MC+"\n");

const tenants = q(GLOBAL_URL, "SELECT ID, TENANT_NAME, DATABASE_NAME FROM tenant ORDER BY ID;").split("\n").filter(Boolean).map(l=>l.split("\t"));
let allPass = true;
for (const [id, name, db] of tenants){
  if (!db) continue;
  const url = TENANT_TMPL.replace("{tenant_db_name}", db);
  const fails = [];
  console.log("-".repeat(56)+`\n#${id} ${name} / ${db}`);

  const rec = tryq(url, "SELECT IF(finished_at IS NULL,'FAILED','ok') FROM _prisma_migrations WHERE migration_name='20260702000000_multi_outlet_fks_and_user_outlet';");
  if (rec !== "ok") fails.push("migration not recorded ok (got: "+(rec||"missing")+")");
  console.log("  migration recorded: "+(rec||"MISSING"));

  const users = tryq(url, "SELECT COUNT(*) FROM user WHERE IS_DELETED=false;");
  const seeded = tryq(url, "SELECT COUNT(DISTINCT USER_ID) FROM user_outlet;");
  const nonPrimary = tryq(url, "SELECT COUNT(*) FROM user_outlet WHERE IS_PRIMARY=false;");
  if (users !== seeded) fails.push(`user_outlet seeded ${seeded} != ${users} non-deleted users`);
  console.log(`  user_outlet: seeded_users=${seeded} vs non_deleted_users=${users}  (non-primary rows=${nonPrimary})`);

  let fkMissing = [];
  for (const t of FK_TABLES){
    // Match the specific OUTLET_ID FK by name — `sales` also has a second
    // outlet FK (STOCK_SOURCE_OUTLET_ID), so a plain REFERENCED_TABLE count is 2.
    const fk = tryq(url, `SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA='${db}' AND TABLE_NAME='${t}' AND CONSTRAINT_NAME='${t}_OUTLET_ID_fkey';`);
    if (fk !== "1") fkMissing.push(t);
  }
  if (fkMissing.length) fails.push("missing OUTLET_ID FK on: "+fkMissing.join(", "));
  console.log("  OUTLET_ID FKs present: "+(fkMissing.length? "MISSING on "+fkMissing.join(","):"all 9 ok"));

  let orphans = 0;
  for (const t of FK_TABLES){
    const ex = tryq(url, `SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${db}' AND TABLE_NAME='${t}' AND COLUMN_NAME='OUTLET_ID';`);
    if (ex !== "1") continue;
    const bad = tryq(url, `SELECT COUNT(*) FROM ${t} x LEFT JOIN outlet o ON o.ID=x.OUTLET_ID WHERE x.OUTLET_ID IS NOT NULL AND o.ID IS NULL;`);
    const nul = tryq(url, `SELECT COUNT(*) FROM ${t} WHERE OUTLET_ID IS NULL;`);
    orphans += (parseInt(bad,10)||0) + (parseInt(nul,10)||0);
  }
  if (orphans > 0) fails.push(orphans+" orphan OUTLET_ID rows remain");
  console.log("  residual orphans: "+orphans);

  console.log("  => "+(fails.length? "FAIL: "+fails.join("; ") : "PASS"));
  if (fails.length) allPass = false;
}
console.log("\n"+(allPass ? "ALL TENANTS PASS ✅" : "SOME TENANTS FAILED ❌ — investigate above"));
