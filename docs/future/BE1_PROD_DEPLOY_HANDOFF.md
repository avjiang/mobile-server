# BE-1 Multi-Outlet Migration — Production Deploy Runbook (single source of truth)

**One-stop execution doc.** On the deploy machine, tell Claude Code:
> *"Read `docs/future/BE1_PROD_DEPLOY_HANDOFF.md` and execute it end-to-end."*

Everything needed is in this file. The two helper scripts it calls (`be1_prod_probe.js`, `be1_verify_post.js`) live in this same folder and are pulled with the repo. Delete all three once BE-1 is live and verified.

**Written:** 2026-07-07 (author dev machine — dry-run already passed here) · **Target branch:** `feature/outlet-sprint006-merge` · **Target DB:** Azure prod MySQL, 13 tenant DBs.

---

## 0. Situation

- **Multi-outlet audit fixes (P0+P1, both repos) are done + committed** on `feature/outlet-sprint006-merge`.
- **Migration `20260702000000_multi_outlet_fks_and_user_outlet` (BE-1)** was rewritten prod-safe + idempotent and **dry-run-tested on a populated tenant** — see §3.
- **Only remaining work = deploy BE-1 to prod.** Prod's 13 tenant DBs still have BE-1 **pending** (`user_outlet` absent).
- **The deploy machine is an identical setup to the author machine.** It already has the repo, worktrees, `.env` (with `PROD_*` URLs), and `mysql-client@8.4`. The only difference — it has **no local dev MySQL schema — which does not matter here**: this deploy targets Azure prod through `PROD_GLOBAL_DB_URL` / `PROD_TENANT_DATABASE_URL`, never local. Do **not** try to set up local DBs.

---

## 1. Sync the code (deploy machine)

```bash
cd /path/to/bayaryuk-server
git fetch origin
git checkout feature/outlet-sprint006-merge
git pull origin feature/outlet-sprint006-merge
git log --oneline -4        # expect: docs BE-1 handoff · fix(multi-outlet): prod-safe migration... (6bd6c64) · +2 more

npm ci                      # only changes if deps moved; safe to run
npm run generate_prisma     # REQUIRED — Prisma schema gained the user_outlet model
npx tsc --noEmit            # sanity; should be clean
```

Confirm `.env` has (same file as the author machine — never committed):
```
PROD_GLOBAL_DB_URL="mysql://<user>:<pw>@bayaryuk-server.mysql.database.azure.com:3306/global?sslaccept=strict"
PROD_TENANT_DATABASE_URL="mysql://<user>:<pw>@bayaryuk-server.mysql.database.azure.com:3306/{tenant_db_name}?sslaccept=strict"
```

### Azure MySQL client gotcha
Azure negotiates the `mysql_native_password` plugin, which Homebrew `mysql` 9.x **dropped** → `ERROR 2059 auth plugin cannot be loaded`. Use the 8.4 client (already installed on the identical setup) for both the probe scripts and `mysqldump`:
```bash
export MYSQL_BIN=/opt/homebrew/opt/mysql-client@8.4/bin/mysql       # probe scripts read this
export PATH="/opt/homebrew/opt/mysql-client@8.4/bin:$PATH"          # so backup_db_prod's mysqldump also authenticates
```
(Prisma's own driver is pure-JS and unaffected; this is only for the CLI-based probe + backup steps.)

---

## 2. What BE-1 does (`prisma/client/migrations/20260702000000_multi_outlet_fks_and_user_outlet/migration.sql`, 147 lines)

Runs **once per tenant DB** (each tenant = its own database). Six phases:

1. **Resolve the real primary outlet** (line 20):
   ```sql
   SET @primary_outlet := (SELECT ID FROM outlet WHERE IS_DELETED = false ORDER BY ID ASC LIMIT 1);
   ```
   `outlet.ID` is auto-increment, **not guaranteed to be 1**. The original migration hardcoded `OUTLET_ID = 1` and would abort on any tenant whose outlet ≠ 1. This resolves the actual lowest live outlet; `NULL` if the tenant has none (handled everywhere downstream).

2. **Create `user_outlet`** (lines 23–35) — composite PK `(USER_ID, OUTLET_ID)` + `IS_PRIMARY`. `CREATE TABLE IF NOT EXISTS`. This join table powers per-user outlet access; the JWT `allowedOutletIds` is built from it at login.

3. **Add its two FKs** (lines 37–45) — `user_outlet → user`, `user_outlet → outlet`, each guarded by an `information_schema` existence check via `PREPARE/EXECUTE` (MySQL has no `ADD CONSTRAINT IF NOT EXISTS`).

4. **Seed `user_outlet`** (lines 49–53) — every non-deleted user → `@primary_outlet` as primary.
   - `WHERE IS_DELETED = false` → soft-deleted users get no access.
   - `AND @primary_outlet IS NOT NULL` → skips entirely on a zero-outlet DB.
   - `ON DUPLICATE KEY UPDATE` → idempotent.

5. **Backfill orphan `OUTLET_ID` rows** (lines 57–67) on all 9 scoped tables **before** adding RESTRICT FKs — repoints any row whose `OUTLET_ID` matches no outlet to `@primary_outlet`, so FK creation can't abort on a dangling value. Each guarded `AND @primary_outlet IS NOT NULL`. `STOCK_SOURCE_OUTLET_ID` is nullable → its orphans are nulled instead (it gets a `SET NULL` FK).

6. **Create indexes + 11 FKs** (lines 69–144), every one guarded. The 9 `*_OUTLET_ID_fkey` are `ON DELETE RESTRICT`; `sales_STOCK_SOURCE_OUTLET_ID_fkey` is `SET NULL`; plus `menu_profile_outlet → menu_profile`.

**9 RESTRICT-FK tables:** `sales, payment, session, invoice, delivery_order, quotation, purchase_order, register_log, menu_profile_outlet`.

**Why prod-safe:** dynamic primary resolution (no hardcoded id) · orphans repaired before RESTRICT FKs · every DDL guarded so a **retry after partial failure is a clean no-op** · zero-outlet DBs skip seed/backfill gracefully.

---

## 3. Dry-run evidence (already done on the author machine — for confidence, no action)

Applied via `prisma migrate deploy` onto local `web_bytes_db` (real dev tenant: 89 sales, 95 payments, 42 sessions, 50 invoices, 53 DOs, 33 quotations, 49 POs). Also already clean on `demo_laundry_db` (103 sales) and `demo_retail_db` (146 sales). Results:

- ✅ Applied clean, recorded `ok` in `_prisma_migrations`.
- ✅ `@primary_outlet` resolved to the real outlet id (not hardcoded).
- ✅ `user_outlet` seeded 8 rows = the 8 non-deleted users (2 soft-deleted excluded), all `IS_PRIMARY`.
- ✅ All 9 RESTRICT FKs + `sales_STOCK_SOURCE_OUTLET_ID` SET-NULL FK created; row counts unchanged; 0 orphans after.
- ✅ **Idempotent**: re-ran the raw SQL on the migrated DB → 0 errors, no dupes.
- Data-shape survey: every populated tenant is single-outlet id=1, zero orphans → backfill is a no-op on this fleet.

Local ≠ prod, which is why §4 Step 1 re-probes prod directly before deploying.

---

## 4. Execute the deploy

Run from the `bayaryuk-server` repo root, with `.env` present and `MYSQL_BIN`/`PATH` set per §1.

### Step 1 — READ-ONLY prod probe (GO / NO-GO gate)
```bash
node docs/future/be1_prod_probe.js          # PROD by default; zero writes
```
Reads every prod tenant, prints per-tenant + overall verdict. **Proceed only on `OVERALL: GO`.**
- **GO** — outlet resolvable; any orphans are backfillable. Safe.
- **SKIP** — BE-1 already applied there (deploy will skip it).
- **NO-GO** — a tenant has scoped rows but no resolvable outlet (backfill skips → RESTRICT FK would abort), or the probe errored. **Stop, report, do not deploy.**
- **MULTI-OUTLET note** — a tenant has >1 live outlet; backfill would repoint orphans to the lowest outlet id. Local fleet is all single-outlet; if prod shows this, pause and confirm intent (BE-2 caveat in [OUTLET_MERGE_AUDIT.md](OUTLET_MERGE_AUDIT.md)).

### Step 2 — Back up prod (mandatory — this is the rollback)
```bash
npm run backup_db_prod
```
`mysqldump --single-transaction` of `global` + every tenant DB → `backups/prod_<timestamp>/`. Verify the dir exists and each `*.sql` is non-trivial before continuing. **Do not skip.**

### Step 3 — Deploy
```bash
npm run upgrade_db_prod
```
Runs `prisma migrate deploy` per tenant (global schema, then each tenant from `global.tenant`). Success = `All migrations have been successfully applied`, no error stack.

### Step 4 — READ-ONLY post-deploy verify
```bash
node docs/future/be1_verify_post.js         # PROD by default; zero writes
```
Per tenant: migration recorded `ok`, `user_outlet` seeded = non-deleted user count (all primary), all 9 `*_OUTLET_ID_fkey` present, 0 residual orphans. **Expect `ALL TENANTS PASS ✅`.**

### Step 5 — App smoke test
Against prod: login, open a session, do a checkout, open a doc (invoice/PO). The released binary (no `X-Outlet-ID`) should still work — the middleware defaults to the primary outlet (BE-2).

### Rollback (only if Step 3/4 fails)
BE-1 is idempotent → first try **re-running** `upgrade_db_prod` (guards make applied statements no-ops, resumes cleanly). If a tenant is genuinely corrupted, restore its dump:
```bash
mysql -h bayaryuk-server.mysql.database.azure.com -P 3306 -u <user> --ssl-mode=REQUIRED <tenant_db> < backups/prod_<ts>/<tenant_db>.sql
```
If Prisma marks the migration FAILED and refuses to continue, with `TENANT_DATABASE_URL` pointed at that tenant:
```bash
npx prisma migrate resolve --rolled-back 20260702000000_multi_outlet_fks_and_user_outlet --schema=prisma/client/schema.prisma
```
then re-run deploy.

---

## 5. Go / No-Go quick reference

| Signal (from probe) | Verdict |
|---|---|
| Every tenant GO or SKIP | ✅ deploy |
| Any tenant: scoped rows + no resolvable outlet | ❌ stop, investigate |
| Any tenant flagged MULTI-OUTLET | ⏸ confirm backfill-to-lowest-outlet is intended |
| Probe errors (auth/network) | ❌ fix access first (§1 Azure gotcha) |
| Backup dir missing / empty dumps | ❌ never deploy without a good backup |

---

## 6. Known landmines

- **App lockstep (BE-2):** after deploy, the released mobile binary that omits `X-Outlet-ID` still works — middleware defaults to the tenant's primary outlet. Safe **only while every tenant is single-outlet**. Revisit when a real multi-outlet tenant onboards ([OUTLET_MERGE_AUDIT.md](OUTLET_MERGE_AUDIT.md), BE-2).
- **Author-machine checksum drift (NOT prod, informational):** BE-1's SQL was rewritten after it was applied to the author machine's local `demo_laundry_db`/`demo_retail_db`, so their Prisma checksum mismatches → the author machine's next local `upgrade_db` errors on those two. Fix there via re-seed or `prisma migrate resolve`. **Prod is unaffected** and the deploy machine has no local DBs, so this cannot occur during deploy.

---

## 7. Checklist

- [ ] `git checkout feature/outlet-sprint006-merge && git pull`
- [ ] `npm ci && npm run generate_prisma && npx tsc --noEmit` (clean)
- [ ] `.env` has `PROD_GLOBAL_DB_URL` + `PROD_TENANT_DATABASE_URL`
- [ ] `export MYSQL_BIN=.../mysql-client@8.4/bin/mysql` + prepend it to `PATH`
- [ ] **Step 1** `node docs/future/be1_prod_probe.js` → **OVERALL: GO**
- [ ] **Step 2** `npm run backup_db_prod` → dumps present in `backups/prod_<ts>/`
- [ ] **Step 3** `npm run upgrade_db_prod` → applied, no errors
- [ ] **Step 4** `node docs/future/be1_verify_post.js` → **ALL TENANTS PASS ✅**
- [ ] **Step 5** app smoke test against prod
- [ ] Delete this doc + `be1_prod_probe.js` + `be1_verify_post.js`

---

### Appendix — reference copy of the probe scripts
The runnable versions are the committed files `docs/future/be1_prod_probe.js` and `docs/future/be1_verify_post.js` (pulled with the repo — just run them). Both are **SELECT-only**, auto-detect the mysql client (honor `MYSQL_BIN`), read `PROD_*` URLs from `.env` by default, and accept `--local` to target local dev DBs instead. If either file is ever missing, re-create it from git history: `git show HEAD:docs/future/be1_prod_probe.js`.
