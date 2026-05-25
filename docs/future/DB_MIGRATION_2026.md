# MySQL DB Migration — Free Tier Rerun (2026)

**Goal:** Move the production MySQL data from the current Azure subscription (free tier expires **Fri 4 Sep 2026**) to a fresh Azure subscription on a new account, claiming another 12 months of free MySQL Flexible Server B1ms.

**App Service stays put** on the current subscription. Only MySQL moves.

**Target cutover window:** late August 2026 (~Mon 25 Aug) — gives ~10 days running on the new DB with old still alive as fallback before deleting old on ~Wed 3 Sep.

**Total expected downtime during cutover:** ~10-15 minutes.

---

## Status (2026-05-25)

- [x] Plan written (this doc)
- [ ] Phase 0: tooling additions in `flutter-server/`
- [ ] New Azure account created
- [ ] Phase 1: new MySQL server provisioned + firewall rules
- [ ] Phase 2: dry-run restore + smoke test
- [ ] Phase 3: cutover executed
- [ ] Phase 4: soak (10 days) + old server deleted

---

## Decisions locked in (do not re-litigate)

| Decision | Value | Rationale |
|---|---|---|
| App Service migration | **Stays on current subscription** | Not on free tier anyway — moving it just adds DNS/deploy risk for no cost saving |
| New MySQL region | **Southeast Asia** | Match App Service region; sub-ms cross-service latency |
| New MySQL SKU | **B1ms Burstable** | Same as current, eligible for free tier |
| Migration approach | **`mysqldump` + restore** | Single tenant + global = ~tens of MB. DMS / replication overkill |
| Cutover target | **~Mon 25 Aug 2026** | 10-day fallback buffer before old free tier expires Fri 4 Sep |
| Rollback path | **Repoint App Service env vars back to old DB** | Old server stays running through Phase 4 |

---

## Open items to fill in at execution time

| Item | When discovered | Where to record |
|---|---|---|
| New Azure account email | Phase 1 | Inline in this doc + memory |
| New subscription ID | Phase 1 | Inline + memory |
| New resource group name | Phase 1 | Inline (suggest `bayar-yuk-v2`) |
| New MySQL server hostname | Phase 1 | `.env` as `NEWPROD_GLOBAL_DB_URL` / `NEWPROD_TENANT_DATABASE_URL` |
| New MySQL admin username | Phase 1 | `.env` |
| New MySQL admin password | Phase 1 | `.env` (secret) |
| Current App Service outbound IPs (for new MySQL firewall) | Phase 1 | Inline (output of `az webapp show --name BayarYuk --resource-group bayar-yuk --query outboundIpAddresses -o tsv`) |
| Tenant DB name on new server | Phase 2 | Should match current — `web_bytes_db` (tenant ID 11) |

---

## Phase 0 — Tooling additions (do BEFORE Phase 1)

All zero-cost code changes to `flutter-server/`. Roughly 30 min of work.

### 0.1 — Update `src/script/db_upgrade.ts` to accept `newprod` target

Add a third branch to the existing target switch:

```ts
type Target = "local" | "prod" | "newprod";

if (target === "prod") {
    // ... existing block ...
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
```

### 0.2 — Update `src/script/db_backup.ts` identically

Same `newprod` branch as above, same env var reads. Pattern is identical — copy the block in.

### 0.3 — Create `src/script/db_restore.ts` (new file)

Reverse of `db_backup.ts`. Restores a backup directory into a target server.

```ts
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

if (!backupDir) {
    console.error("Usage: node db_restore.js <target> <backup_dir>");
    console.error("  target:     local | prod | newprod");
    console.error("  backup_dir: path to dir containing global.sql + tenant <name>.sql files");
    process.exit(1);
}

if (!fs.existsSync(backupDir)) {
    console.error(`Backup dir does not exist: ${backupDir}`);
    process.exit(1);
}

// Resolve env vars based on target (copy from db_backup.ts)
if (target === "prod") {
    process.env.GLOBAL_DB_URL = process.env.PROD_GLOBAL_DB_URL;
    process.env.TENANT_DATABASE_URL = process.env.PROD_TENANT_DATABASE_URL;
    console.log("Target: PROD");
} else if (target === "newprod") {
    process.env.GLOBAL_DB_URL = process.env.NEWPROD_GLOBAL_DB_URL;
    process.env.TENANT_DATABASE_URL = process.env.NEWPROD_TENANT_DATABASE_URL;
    console.log("Target: NEWPROD");
} else {
    console.log("Target: LOCAL");
}

if (!process.env.GLOBAL_DB_URL || !process.env.TENANT_DATABASE_URL) {
    console.error(`Missing DB URLs for target "${target}"`);
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

function parseMysqlUrl(url: string): ParsedUrl {
    const match = url.match(/^mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)(\?.*)?$/);
    if (!match) throw new Error(`Cannot parse URL: ${url.replace(/:[^@]*@/, ":****@")}`);
    const [, user, password, host, port, database, query] = match;
    const requireSsl = !!query && /sslaccept=strict/i.test(query);
    return { user, password, host, port, database, requireSsl };
}

async function restoreDatabase(url: string, sqlFile: string): Promise<void> {
    const parsed = parseMysqlUrl(url);
    const sslFlag = parsed.requireSsl ? "--ssl-mode=REQUIRED" : "";
    const env = { ...process.env, MYSQL_PWD: parsed.password };

    // 1) Ensure DB exists (server-level CREATE, no DB context)
    const createCmd = `mysql -h ${parsed.host} -P ${parsed.port} -u ${parsed.user} ${sslFlag} -e "CREATE DATABASE IF NOT EXISTS \\\`${parsed.database}\\\`"`;
    await execAsync(createCmd, { env });

    // 2) Pipe the SQL file into that DB
    const restoreCmd = `mysql -h ${parsed.host} -P ${parsed.port} -u ${parsed.user} ${sslFlag} -D ${parsed.database} < "${sqlFile}"`;
    await execAsync(restoreCmd, { env, maxBuffer: 1024 * 1024 * 256 });
}

async function main() {
    // 1) Global DB
    const globalFile = path.join(backupDir, "global.sql");
    if (!fs.existsSync(globalFile)) {
        console.error(`Missing global.sql in ${backupDir}`);
        process.exit(1);
    }
    console.log(`Restoring global ← ${path.basename(globalFile)}`);
    await restoreDatabase(process.env.GLOBAL_DB_URL!, globalFile);
    console.log("  OK");

    // 2) Each tenant DB — every <name>.sql in the dir except global.sql
    const tenantUrlTemplate = process.env.TENANT_DATABASE_URL!;
    const files = fs.readdirSync(backupDir).filter((f) => f.endsWith(".sql") && f !== "global.sql");
    for (const file of files) {
        const tenantName = file.replace(/\.sql$/, "");
        const url = tenantUrlTemplate.replace("{tenant_db_name}", tenantName);
        console.log(`Restoring ${tenantName} ← ${file}`);
        await restoreDatabase(url, path.join(backupDir, file));
        console.log("  OK");
    }
    console.log(`All databases restored to ${target}.`);
}

main().catch((err) => {
    console.error("Restore failed:", err);
    process.exit(1);
});
```

### 0.4 — Update `package.json` scripts section

Add five new scripts:

```json
"upgrade_db_newprod": "node dist/script/db_upgrade.js newprod",
"backup_db_newprod": "node dist/script/db_backup.js newprod",
"restore_db_local": "node dist/script/db_restore.js local",
"restore_db_prod": "node dist/script/db_restore.js prod",
"restore_db_newprod": "node dist/script/db_restore.js newprod"
```

Note: `restore_db_*` scripts need the backup dir passed as arg via `--`:
```bash
npm run restore_db_newprod -- backups/prod_2026-08-25_03-00-00
```

### 0.5 — Update `.env` with `NEWPROD_*` placeholders

Append to current `.env` (values filled in Phase 1):

```
# New prod (Azure free tier rerun, target Sep 2026) — filled in Phase 1
NEWPROD_GLOBAL_DB_URL=""
NEWPROD_TENANT_DATABASE_URL=""
```

Mirror in `.env.example`:

```
NEWPROD_GLOBAL_DB_URL="mysql://user:password@new-host:3306/global?sslaccept=strict"
NEWPROD_TENANT_DATABASE_URL="mysql://user:password@new-host:3306/{tenant_db_name}?sslaccept=strict"
```

### 0.6 — Verify build

```bash
cd /Users/alvinjiang/Developments/flutter-server
npm run build
```

Must complete clean before moving to Phase 1.

---

## Phase 1 — Provision new MySQL server

Triggered when: new Azure account is created.

### 1.1 — Create resources on new Azure account

Via Azure Portal (CLI requires `az login` against the new account — easier in portal for one-off):

1. Sign in to new Azure account.
2. Create resource group: `bayar-yuk-v2` (or whatever — record below).
3. Create MySQL Flexible Server:
   - **Region:** Southeast Asia (MUST match — cross-region latency would kill the app)
   - **SKU:** Burstable B1ms (free tier)
   - **Version:** MySQL 8.0 (match current — current is 8.0.21)
   - **Storage:** 20 GiB (free tier covers up to 32 GiB)
   - **Backup retention:** 7 days (free tier default)
   - **High availability:** Disabled (paid feature)
   - **Admin username:** pick + record
   - **Admin password:** strong, record in `.env`
   - **Public access:** Enabled (we use IP allowlist)
4. Wait ~5-10 min for provisioning.

### 1.2 — Configure firewall on new MySQL

Two rules needed:

**Rule 1: your local dev machine IP** — for migration ops, ad-hoc queries:
```bash
# Find your current public IP
curl -s ifconfig.me
# Then add via portal: MySQL server → Networking → Add firewall rule
```

**Rule 2: current App Service outbound IPs** — for runtime (after cutover):
```bash
# From old subscription (already logged in)
az webapp show --name BayarYuk --resource-group bayar-yuk \
  --query "outboundIpAddresses" -o tsv | tr ',' '\n'
```
Take that output (10-15 IPs typically), and add each as a firewall rule on the new MySQL via portal. Or use "Allow Azure services" toggle — slightly less secure but eliminates IP rot.

### 1.3 — Smoke test connection from local

```bash
mysql -h <new-server>.mysql.database.azure.com -P 3306 \
  -u <admin_user> -p --ssl-mode=REQUIRED \
  -e "SELECT VERSION(), NOW()"
```

Expect MySQL 8.x version + current timestamp. If you see SSL errors, append `--ssl-mode=REQUIRED` (already shown above).

### 1.4 — Fill in `.env` `NEWPROD_*` values

Edit `flutter-server/.env`:
```
NEWPROD_GLOBAL_DB_URL="mysql://<admin>:<pass>@<new-server>.mysql.database.azure.com:3306/global?sslaccept=strict"
NEWPROD_TENANT_DATABASE_URL="mysql://<admin>:<pass>@<new-server>.mysql.database.azure.com:3306/{tenant_db_name}?sslaccept=strict"
```

### 1.5 — Record discovered values back into this doc

| Item | Value |
|---|---|
| New Azure account email | _fill in_ |
| New subscription ID | _fill in_ |
| New resource group | _fill in_ |
| New MySQL server FQDN | _fill in_ |
| New MySQL admin user | _fill in_ |
| Current App Service outbound IPs | _fill in (paste output of `az webapp show` query)_ |

---

## Phase 2 — Dry run (1-2 weeks before cutover, ~mid Aug 2026)

Purpose: prove the pipeline works without touching production.

### 2.1 — Backup current prod

```bash
cd /Users/alvinjiang/Developments/flutter-server
npm run backup_db_prod
```

Output lands in `flutter-server/backups/prod_<timestamp>/`. Note the path.

### 2.2 — Restore into new server

```bash
npm run restore_db_newprod -- backups/prod_<timestamp>
```

Expected output: "Restoring global ← global.sql / OK", then one per tenant, then "All databases restored to newprod."

### 2.3 — Apply Prisma migrations on new server

```bash
npm run upgrade_db_newprod
```

Should be a no-op if backup was taken from a fully-migrated source. Read the per-tenant lines — every one must say "Successfully migrated X".

### 2.4 — Spot-check data integrity

Compare row counts between old and new:

```bash
# Old prod
mysql -h bayaryuk-server.mysql.database.azure.com -P 3306 \
  -u azvvyqzsum -p --ssl-mode=REQUIRED web_bytes_db \
  -e "SELECT 'sales' AS t, COUNT(*) FROM sales UNION ALL SELECT 'items', COUNT(*) FROM items UNION ALL SELECT 'customers', COUNT(*) FROM customers"

# New prod (paste output of NEWPROD_TENANT_DATABASE_URL parsed values)
mysql -h <new-server>.mysql.database.azure.com -P 3306 \
  -u <new-admin> -p --ssl-mode=REQUIRED web_bytes_db \
  -e "SELECT 'sales' AS t, COUNT(*) FROM sales UNION ALL SELECT 'items', COUNT(*) FROM items UNION ALL SELECT 'customers', COUNT(*) FROM customers"
```

Counts must match. If not, abort and investigate.

### 2.5 — Smoke test from a local server pointed at new DB

```bash
# Temporarily override env to point local dev server at new DB
GLOBAL_DB_URL="$(grep ^NEWPROD_GLOBAL_DB_URL .env | cut -d'"' -f2)" \
TENANT_DATABASE_URL="$(grep ^NEWPROD_TENANT_DATABASE_URL .env | cut -d'"' -f2)" \
  npm start
```

Hit a few endpoints from a real device or curl. Verify nothing screams.

### 2.6 — Clean up dry-run data

After dry run, the new DB has stale data from when you did the dump. Either:
- Leave it (will be overwritten at real cutover anyway), or
- Drop and recreate the databases (cleaner but extra step)

Recommended: **leave it**. At real cutover, the restore re-runs with fresher data and `--add-drop-table` in mysqldump output handles the overwrite.

### 2.7 — Document any surprises here

| Surprise | Mitigation |
|---|---|
| _fill in as you hit them_ | |

---

## Phase 3 — Real cutover (~Mon 25 Aug 2026)

### 3.1 — Pre-flight (T-1 hour)

- [ ] Confirm low-traffic window
- [ ] Notify any active users (if applicable — single tenant likely OK)
- [ ] Re-verify firewall: new MySQL accepts App Service outbound IPs
- [ ] `npm run build` in flutter-server (no uncommitted changes blocking)
- [ ] Take a screenshot of current App Service app settings as recovery anchor: `az webapp config appsettings list --name BayarYuk --resource-group bayar-yuk > pre_cutover_appsettings.json`

### 3.2 — Cutover sequence (~T+0)

Run these in order. Expected total time ~13 min.

```bash
cd /Users/alvinjiang/Developments/flutter-server

# T+0:00 — Stop App Service (prevents new writes during the dump)
az webapp stop --name BayarYuk --resource-group bayar-yuk

# T+0:01 — Final fresh backup
npm run backup_db_prod
# Note the backup dir name in stdout
BACKUP_DIR=backups/prod_<timestamp_from_stdout>

# T+0:05 — Restore into new server
npm run restore_db_newprod -- $BACKUP_DIR

# T+0:09 — Switch App Service env vars to point at new DB
NEW_GLOBAL=$(grep ^NEWPROD_GLOBAL_DB_URL .env | cut -d'"' -f2)
NEW_TENANT=$(grep ^NEWPROD_TENANT_DATABASE_URL .env | cut -d'"' -f2)

az webapp config appsettings set \
  --name BayarYuk --resource-group bayar-yuk \
  --settings GLOBAL_DB_URL="$NEW_GLOBAL" TENANT_DATABASE_URL="$NEW_TENANT"

# T+0:11 — Start App Service
az webapp start --name BayarYuk --resource-group bayar-yuk

# T+0:12 — Verify
curl https://bayaryuk-c2c8d5acg8chaqfm.southeastasia-01.azurewebsites.net/health
# Expect: {"status":"ok","uptime":<small>,"tenants":0}

# T+0:13 — Tail logs for 2 min, watch for errors
az webapp log tail --name BayarYuk --resource-group bayar-yuk
```

### 3.3 — Smoke tests from a real device

- Open Flutter app, log in (`web_bytes/web_bytes`)
- View item list — must load
- Create a sale — must save (this also exercises outbox/sync)
- View sales history — must show recent
- Tail logs throughout; no `PrismaClient` connection errors

### 3.4 — If anything is wrong (rollback)

```bash
# Read pre-cutover app settings back in
OLD_GLOBAL=$(grep ^PROD_GLOBAL_DB_URL .env | cut -d'"' -f2)
OLD_TENANT=$(grep ^PROD_TENANT_DATABASE_URL .env | cut -d'"' -f2)

az webapp config appsettings set \
  --name BayarYuk --resource-group bayar-yuk \
  --settings GLOBAL_DB_URL="$OLD_GLOBAL" TENANT_DATABASE_URL="$OLD_TENANT"

az webapp restart --name BayarYuk --resource-group bayar-yuk
```

Back on old DB in ~30 sec. Old server is untouched and still has all data (since we only READ from it via mysqldump).

**Data loss window during rollback:** any writes that landed on the new DB between cutover and rollback are stranded. Acceptable for single-tenant POS at low-traffic — likely zero writes in that 5-15 min window. If it matters, dump the new DB before rollback to preserve.

---

## Phase 4 — Soak + cleanup (T+10 days, ~Wed 3 Sep 2026)

### 4.1 — Daily monitoring (during soak)

- Once a day, `curl /health` and check `az webapp log tail` for new errors
- Watch Azure Portal MySQL metrics on new server: CPU, connections, storage
- Make sure free-tier compute hours aren't blowing past 750/month (probably won't)

### 4.2 — Verify free-tier eligibility on new server

In new Azure Portal → Cost Management — confirm MySQL line item is $0.

### 4.3 — Cleanup (after 10 days stable, before Sep 4)

Hard cutoff: **must complete before Fri 4 Sep 2026** to avoid old MySQL billing on the original subscription.

```bash
# Delete old MySQL server (via OLD subscription's az login or portal)
az mysql flexible-server delete \
  --name bayaryuk-server --resource-group bayar-yuk --yes

# Optional: delete the rest of the old RG if nothing else is in it
# (keep App Service! it stays.)
```

### 4.4 — `.env` cleanup post-migration

After old server is deleted:

```
# Old PROD_* lines — DELETE
# (was pointing at bayaryuk-server.mysql.database.azure.com)

# Rename NEWPROD_* → PROD_* so existing scripts (`upgrade_db_prod`, `backup_db_prod`) just work
PROD_GLOBAL_DB_URL="mysql://<new>..."
PROD_TENANT_DATABASE_URL="mysql://<new>..."
```

### 4.5 — Memory + doc cleanup

- Update `reference_db_migration_workflow.md` if any details changed
- Update `reference_azure_app_service.md` to note new MySQL location
- Mark Phase 4 complete at top of this doc
- Set a calendar reminder for the next free-tier expiry (~Sep 2027)

---

## Risks / things that could go wrong

| Risk | Likelihood | Mitigation |
|---|---|---|
| New free tier not granted (Azure changes policy / detects same person) | Medium | Use a different email + payment method that's never been on Azure free tier. If denied, fall back to paying $22/mo on existing — start from same plan, just skip the move |
| App Service outbound IPs change after firewall is set | Low | Re-allowlist via `az webapp show`. Or use "Allow Azure services" toggle |
| Cross-subscription firewall complications | Low | We use SQL auth, not Azure AD. No subscription boundary in cred plane |
| Schema mismatch between old and new (if migrations were applied at different times) | Low | `npm run upgrade_db_newprod` after restore ensures both are at the same Prisma migration revision |
| mysqldump too slow / times out | Very Low | Data set is small; in tests should be seconds. If somehow huge, mysqldump supports `--single-transaction` (already on) — restore can also be chunked |
| App tries to write during the 10-15 min window | Low | App Service is stopped, so no traffic ingress. The outbox on devices will retry — by design |
| Forgot to delete old MySQL before Sep 4 | Medium | Set calendar reminder + put delete command in Phase 4 |

---

## Appendix A — Exact env var matrix

After Phase 1 fills values, your `.env` should look like:

```
# Local dev
TENANT_DATABASE_URL="mysql://root:rootroot@127.0.0.1:3306/{tenant_db_name}"
GLOBAL_DB_URL="mysql://root:rootroot@127.0.0.1:3306/global"

NODE_ENV=development
PORT=8081
PUSHY_SECRET_API_KEY="..."

# OLD prod (Azure, expires 4 Sep 2026 — use until Phase 3 cutover)
PROD_GLOBAL_DB_URL="mysql://azvvyqzsum:****@bayaryuk-server.mysql.database.azure.com:3306/global?sslaccept=strict"
PROD_TENANT_DATABASE_URL="mysql://azvvyqzsum:****@bayaryuk-server.mysql.database.azure.com:3306/{tenant_db_name}?sslaccept=strict"

# NEW prod (Azure free tier rerun, fresh 12-month window starting Phase 1)
NEWPROD_GLOBAL_DB_URL="mysql://<new_admin>:****@<new-server>.mysql.database.azure.com:3306/global?sslaccept=strict"
NEWPROD_TENANT_DATABASE_URL="mysql://<new_admin>:****@<new-server>.mysql.database.azure.com:3306/{tenant_db_name}?sslaccept=strict"
```

After Phase 4 cleanup, `PROD_*` will be replaced with the `NEWPROD_*` values and `NEWPROD_*` will be removed.

---

## Appendix B — Command quick reference

```bash
# Anywhere in the flow
cd /Users/alvinjiang/Developments/flutter-server

# Backup any target
npm run backup_db_prod                            # current Azure
npm run backup_db_newprod                         # new Azure

# Restore any target (positional: target + backup dir)
npm run restore_db_local -- backups/<dir>         # local MySQL
npm run restore_db_prod -- backups/<dir>          # back to current Azure (rare; rollback only)
npm run restore_db_newprod -- backups/<dir>       # new Azure

# Apply Prisma migrations to any target
npm run upgrade_db                                # local
npm run upgrade_db_prod                           # current Azure
npm run upgrade_db_newprod                        # new Azure

# App Service control
az webapp stop    --name BayarYuk --resource-group bayar-yuk
az webapp start   --name BayarYuk --resource-group bayar-yuk
az webapp restart --name BayarYuk --resource-group bayar-yuk
az webapp log tail --name BayarYuk --resource-group bayar-yuk

# App settings
az webapp config appsettings list --name BayarYuk --resource-group bayar-yuk
az webapp config appsettings set  --name BayarYuk --resource-group bayar-yuk --settings KEY=value
```

---

## Sign-off

Last reviewed: 2026-05-25 (initial draft, awaiting execution)
Next review: when new Azure account is created (Phase 1 trigger)
