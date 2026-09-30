# MySQL DB Migration — Free Tier Rerun (2026)

> ✅ **DONE — cutover 2026-09-26 22:33:18 → 22:38:32 (≈5 min).** Production MySQL is **`bayaryuk-db-v2`**
> (RG `bayar-yuk-v2`, subscription `3bbc4892-5a45-4680-95b3-64bf43d35d4c`). Still open: confirm the free
> meter on the new bill, delete the old server on/after 2026-09-29 (3-day keep, user decision), then
> **retire this doc** per the `docs/future/` rule. Jump to §Status and §Phase 3 result.

**Goal:** Move the production MySQL data from the current Azure subscription to a fresh Azure subscription on a new account, claiming another 12 months of free MySQL Flexible Server B1ms.

**App Service stays put** on the current subscription, and stays paid. Only MySQL moves.

**Total expected downtime during cutover:** ~10-15 minutes.

---

## ⚠️ Status update 2026-09-21 — the original deadline was MISSED

This runbook was written 2026-05-25 targeting cutover ~25 Aug 2026, ahead of the free tier
expiring Fri 4 Sep 2026. **It was never executed.** The free tier duly expired.

**Verified live 2026-09-21 (Azure Cost Management):**

| | Aug 2026 | Sep 2026 (from 09-05) |
|---|---|---|
| MySQL B1ms compute | $0.00 (`B1MS Compute - Free`) | **$0.6240/day** |
| MySQL storage 20 GB | $0.00 (`Storage Data Stored - Free`) | **$0.0920/day** |
| App Service B1 Linux | $0.4320/day | $0.4320/day |
| **Monthly total** | **$13.39** | **$34.88** |

Free-tier meters stopped on **2026-09-04**; paid meters begin **2026-09-05**. Migrating still
recovers **$21.74/mo** ($13.14/mo App Service remains).

**What this changes about the plan: nothing except the schedule — for the better.**
The original timeline existed to preserve a 10-day fallback buffer *before the old server
disappeared*. The old server is not disappearing; it is merely billing. That removes all time
pressure: dry-run, cut over, and soak at whatever pace suits, and roll back freely.

**Set a calendar reminder 11 months after Phase 1 provisioning.** Missing that date is exactly
what caused this situation.

---

## Status

- [x] Plan written (2026-05-25)
- [x] **Phase 0: tooling additions in `flutter-server/` — DONE 2026-09-21**
- [x] **New Azure account created** — `alvinn.jiang.yt@gmail.com`, subscription `3bbc4892-5a45-4680-95b3-64bf43d35d4c` (2026-09-26)
- [x] **Upgraded FreeTrial → Pay-As-You-Go** — verified `quotaId=PayAsYouGo_2014-09-01`, `spendingLimit=Off` (2026-09-26)
- [x] **Full config audit of the old server** — see §Audit 2026-09-26 (2026-09-26)
- [x] Registered `Microsoft.DBforMySQL` + `Microsoft.Insights`; resource group `bayar-yuk-v2` (southeastasia) created (2026-09-26)
- [x] Admin password generated (32 chars, `[A-Za-z0-9-_]`, URL-safe) straight into `.env` `NEWPROD_*` — never printed (2026-09-26)
- [x] **Phase 1: server `bayaryuk-db-v2` provisioned and verified (2026-09-26)** — see §Phase 1 result
- [x] **Phase 2: practice run passed (2026-09-26 22:28–22:32)** — backup, restore, `db_verify` IDENTICAL, local backend login OK
- [x] **Phase 3: CUTOVER DONE 2026-09-26 22:33:18 → 22:38:32 (≈5 min downtime)** — see §Phase 3 result ✅ **PRODUCTION IS ON `bayaryuk-db-v2`**
- [x] Recreated `bayaryuk-alerts` + `byk-mysql-connections-high` on the new subscription (2026-09-26)
- [ ] **Confirm the free meter** — new subscription must show `B1MS Compute - Free`, not `B1MS` (billing lags ~24h → check 2026-09-27/28) ← **NEXT**
- [ ] User phone test on `audio_technic` (log in, items, sales history)
- [ ] **Phase 4: 3-day soak (user decision) → delete old server `bayaryuk-server` on/after 2026-09-29.** Also remove its alert `byk-mysql-connections-high` (old sub) and the `migration_2026-09-26` firewall rule; drop `OLDPROD_*` from `.env`
- [ ] Phase 1: new MySQL server provisioned + firewall rules
- [ ] Phase 2: dry-run restore + smoke test
- [ ] Phase 3: cutover executed (night window — see §3.0)
- [ ] Phase 4: soak + old server deleted

---

## Phase 4 prep — post-cutover fixes (2026-09-26, same night)

**Scripts now tolerate tenant rows without a database.** `global.tenant` holds **15** tenants; only **2** have
databases on the new server. `db_backup.ts` and `src/db.ts updateAllTenantDatabases()` read
`information_schema.SCHEMATA` and **skip absent databases with a printed list** instead of aborting / pointing
`prisma migrate deploy` at a missing DB. Verified: plain `npm run backup_db_prod` → global + 2 tenants dumped,
`WARNING: 13 tenant(s) … skipped`. `prisma migrate status` (read-only) on the new server: `global` 17
migrations, both tenants 48 — **"Database schema is up to date!"** on all three.

**Optional cleanup — remove the 13 test tenants from `global` (NOT done).** Attempted 2026-09-26 23:10 at the
user's request; **blocked by the auto-mode permission guard as a production mass delete — nothing was
deleted.** The user can run it, or approve it for a session. Take `npm run backup_db_prod` first. Dry run on
2026-09-26 (rows to delete / rows kept for tenants 2 + 3): tenant 13/2, tenant_user 14/17, refresh_token
485/25,047, pushy_device 5/3, pushy_device_allocation 4/3, tenant_outlet 12/2, tenant_subscription 12/2,
tenant_warehouse 6/1; payment, add-on, custom-price tables empty; **0 kept rows reference a doomed
outlet/subscription.** Live FKs are RESTRICT on every `TENANT_ID`, so the order below matters; the guards
abort the transaction (and roll back) if any kept count moves.

```sql
-- global DB on bayaryuk-db-v2. Keeps tenant 2 (Web Bytes) and 3 (Audio Technic).
SET @del := '1,4,6,7,8,9,12,13,15,16,18,19,20';
START TRANSACTION;
DELETE rt FROM refresh_token rt JOIN tenant_user u ON u.ID = rt.TENANT_USER_ID WHERE FIND_IN_SET(u.TENANT_ID, @del);
DELETE d  FROM pushy_device d  JOIN tenant_user u ON u.ID = d.TENANT_USER_ID  WHERE FIND_IN_SET(u.TENANT_ID, @del);  -- cascades pushy_subscription + allocation
DELETE FROM pushy_device_allocation WHERE FIND_IN_SET(TENANT_ID, @del);
DELETE FROM tenant_user             WHERE FIND_IN_SET(TENANT_ID, @del);
DELETE FROM tenant_payment          WHERE FIND_IN_SET(TENANT_ID, @del);
DELETE FROM custom_price_log        WHERE FIND_IN_SET(TENANT_ID, @del);
DELETE FROM tenant_subscription     WHERE FIND_IN_SET(TENANT_ID, @del);                                             -- cascades tenant_subscription_add_on
DELETE FROM tenant_warehouse        WHERE FIND_IN_SET(TENANT_ID, @del);
DELETE FROM tenant_outlet           WHERE FIND_IN_SET(TENANT_ID, @del);
DELETE FROM tenant_add_on           WHERE FIND_IN_SET(TENANT_ID, @del);
DELETE FROM tenant                  WHERE FIND_IN_SET(ID, @del);
-- Guards: a failure raises "Subquery returns more than 1 row"; the client stops and the transaction rolls back.
-- Re-check the 17 / 25047 / 3 / 2 / 1 figures against a fresh dry run first — refresh tokens grow daily.
SELECT IF((SELECT COUNT(*) FROM tenant) = 2 AND (SELECT COUNT(*) FROM tenant WHERE ID IN (2,3)) = 2, 'ok', (SELECT 1 UNION SELECT 2)) AS guard_tenants;
SELECT IF((SELECT COUNT(*) FROM tenant_user) = 17, 'ok', (SELECT 1 UNION SELECT 2)) AS guard_users;
SELECT IF((SELECT COUNT(*) FROM refresh_token rt JOIN tenant_user u ON u.ID=rt.TENANT_USER_ID WHERE u.TENANT_ID IN (2,3)) >= 25047, 'ok', (SELECT 1 UNION SELECT 2)) AS guard_tokens;
SELECT IF((SELECT COUNT(*) FROM pushy_device) = 3 AND (SELECT COUNT(*) FROM pushy_device_allocation) = 3, 'ok', (SELECT 1 UNION SELECT 2)) AS guard_devices;
SELECT IF((SELECT COUNT(*) FROM tenant_outlet) = 2 AND (SELECT COUNT(*) FROM tenant_subscription) = 2 AND (SELECT COUNT(*) FROM tenant_subscription_add_on) = 2 AND (SELECT COUNT(*) FROM tenant_warehouse) = 1, 'ok', (SELECT 1 UNION SELECT 2)) AS guard_billing;
COMMIT;
```

Why it's optional now: with the skip logic, the 13 rows only cost a skipped-list line in each script run, one
error line per missing DB in the nightly loyalty/subscription/idempotency crons (each tenant is its own
try/catch), and a failed login if someone uses a test account. **Correction:** earlier notes tonight said
"17 tenants / 15 test" — the true figures are **15 tenants / 13 test**; the other two databases on the old
server (`bayaryuk-database`, a Prisma shadow DB) were never tenants.

---

## Phase 3 result — CUTOVER 2026-09-26 (done the same night, at the user's call)

The user chose to cut over at 22:24 local instead of waiting a night. Practice run first as a gate,
then the real switch immediately. Free-meter confirmation deliberately deferred (billing lag); worst
case is ~$0.72/day until checked.

| Local time | Step |
|---|---|
| 22:25 | Rehearsal backup failed #1: **old server firewall** had only stale laptop IPs → added `migration_2026-09-26` (161.142.138.37) on `bayaryuk-server` |
| 22:27 | Rehearsal backup failed #2: **mysqldump 9.2 vs server 8.0** — see Gotcha |
| 22:28–22:29 | Rehearsal backup OK with `mysql-client@8.4`; manifest has `global` = `utf8mb4_unicode_ci` |
| 22:29–22:31 | Rehearsal restore (1m34s) → `db_verify`: **IDENTICAL** |
| 22:32 | Local backend on :8099 against new server: `/health` 200, `web_bytes` login 200 + token |
| **22:33:18** | **App Service stopped** (rollback anchor saved: the two DB app settings, 600-perm scratch file) |
| 22:33:32–22:34:32 | Final backup (app stopped → exact) |
| 22:34:51–22:36:24 | Practice copy dropped on new server; final restore |
| 22:36:30 | `db_verify` prod-vs-new: **IDENTICAL** — global 20 tables / 25,716 rows; audio_technic_db 87 / 70,902; web_bytes_db 87 / 3,019 |
| 22:36:54 | App settings `GLOBAL_DB_URL` / `TENANT_DATABASE_URL` → new server (same params incl. `connection_limit=3`); App Service started |
| **22:38:32** | **`/health` 200 — live on the new database** |
| 22:39 | Production `POST /auth/login` (`web_bytes`) 200 + token; new server PROCESSLIST shows App Service outbound IP `20.197.114.123` on `global` + `web_bytes_db`; 0 × 5xx |

**Rollback (still valid until the old server is deleted):** set the App Service's `GLOBAL_DB_URL` /
`TENANT_DATABASE_URL` back to `OLDPROD_*` in `.env` (or the saved anchor) and restart. **But the old
database is frozen at 22:33** — any sale written to the new server after cutover is NOT on the old one.
A clean rollback exists only for the first hours; after that, rolling back means copying post-cutover
writes back by hand. The 3-day keep is a data safety net, not a free undo.

**`.env` swapped at cutover:** `PROD_*` now points at the **new** server (so `backup_db_prod` /
`upgrade_db_prod` hit the live DB, not the frozen one); the old server is `OLDPROD_*`.

**Open question from 2026-09-21 — ANSWERED.** With App Service stopped and then moved to the new
server, the **old** server (22:36–22:38, zero app connections, `active_connections` 6 → 4) still ran
**44 queries/minute**. The constant ~2,830/hour floor is Azure's own platform activity, not the app.

**Gotchas (all hit tonight):**
- **mysqldump 9.2 cannot dump an 8.0 server with `--routines`** — it queries
  `INFORMATION_SCHEMA.LIBRARIES` (a MySQL 9 table) and aborts with error 1109. The default `mysql` /
  `mysqldump` on this Mac is 9.2 (`/usr/local/mysql`). **Always prefix:**
  `export PATH=/opt/homebrew/opt/mysql-client@8.4/bin:$PATH` before `backup_db_*` / `restore_db_*` / `verify_db_*`.
- **The old server's firewall only knows past laptop IPs.** Error 2003 (60) = timeout = firewall, not credentials.
- **After a scoped restore, `upgrade_db_*` was not needed** — the dumps carry `_prisma_migrations`. (At the
  time, it would also have walked the 13 test tenants whose databases were not copied; since the
  post-cutover fix it skips absent databases, see §Phase 4 prep.)
- `az webapp log tail` returns **403** on this app (Kudu/SCM auth) — use the `Http5xx` metric instead.
- With two subscriptions, `az monitor metrics list --resource <full id>` still needs `--subscription`.

---

## Phase 1 result — 2026-09-26

`bayaryuk-db-v2.mysql.database.azure.com` in `bayar-yuk-v2`, created via `az mysql flexible-server create`
(B1ms Burstable, 8.0.21, 20 GB, auto-grow on, auto-IO off, backup 7d, geo off, HA off, public access).

- **Server-level diff vs old: 1** — `fullVersion` 8.0.46 vs 8.0.45 (newer patch in the same 8.0 line; Azure
  patches the old server the same way). Everything else identical, **including `availabilityZone: 2`**.
- **Parameters: 448 vs 448, zero differences** after setting `event_scheduler=OFF` (excluding host-specific
  paths/ids). `lower_case_table_names=1`, `time_zone=+00:00`, utf8mb4 / `utf8mb4_0900_ai_ci` server default,
  `max_connections=171`, buffer pool 512 MiB — all match.
- **Firewall:** `AllowAllAzureServicesAndResourcesWithinAzureIps` (0.0.0.0) + `ClientIPAddress_2026-09-26`
  (161.142.138.37, the laptop — needed for restore; **re-add if the laptop IP changes** before the dry run).
- **Login verified** with the `.env` credentials: `CURRENT_USER()=bayar_yuk_v2@%`, `8.0.46-azure`, TLS 1.3.
- **Removed `flexibleserverdb`** — an empty default database the Azure CLI creates on its own (0 tables,
  0 routines); the portal-created old server never had one. The new server now holds only the four system
  schemas, ready for the restore.

**Gotcha:** `az mysql flexible-server create` echoes the admin password and full connection strings in
its JSON output. The create was run through a wrapper that scrubbed them and deleted the one-shot
password file; never run it bare in a shared terminal or CI log.

---

## Audit 2026-09-26 — the target configuration, verified live

Everything on the old subscription (`82334397-…`, `bayaryukofficial@gmail.com`) was inventoried
so the new server matches exactly, minus the App Service. **11 resources total; only 3 move.**

### What moves / what stays

| Resource | Type | Moves? | Why |
|---|---|---|---|
| `bayaryuk-server` | MySQL Flexible Server | **YES** | the point of the exercise |
| `byk-mysql-connections-high` | metric alert | **YES — recreate** | watches the MySQL server |
| `bayaryuk-alerts` | action group | **YES — recreate** | the alert above emails through it |
| `BayarYuk`, `ASP-bayaryuk-8705` | App Service + plan | no | stays, stays paid |
| `vnet-tnfgbina` | VNet | no | **belongs to the App Service**, not MySQL (see below) |
| `BayarYuk-id-9656` | managed identity | no | GitHub Actions OIDC deploy identity for the App Service (`repo:avjiang/mobile-server:ref:refs/heads/main`) |
| `NetworkWatcher_southeastasia` | Network Watcher | no | auto-created by Azure alongside the VNet |
| `bayar-yuk-guides` | Static Web App (Free) | no | unrelated |
| `byk-appservice-memory-high`, `byk-appservice-5xx` | metric alerts | no | watch the App Service |

**Confirmed absent (count 0):** private DNS zones, private endpoints, NAT gateways, NSGs, public
IPs, route tables, storage accounts, key vaults, Log Analytics workspaces, resource locks, MySQL
diagnostic settings, Entra (AAD) admins on MySQL, read replicas. Advanced Threat Protection:
Disabled. No hidden infrastructure.

### The VNet — why it does NOT need recreating

`vnet-tnfgbina` (10.0.0.0/16) has two subnets:
- `subnet-qruhnvcq` 10.0.1.0/24 — **delegated to `Microsoft.Web/serverfarms`; the App Service is
  VNet-integrated into it** (`virtualNetworkSubnetId` points here, `vnetRouteAllEnabled: true`).
- `subnet-7x5g4zfhaisx6` 10.0.2.0/24 — unused: no delegation, no IP configs, no endpoints.

MySQL is **public access** (`publicNetworkAccess: Enabled`, `delegatedSubnetResourceId: null`,
`privateDnsZoneResourceId: null`, `privateEndpointConnections: []`). No subnet has a
`Microsoft.Sql` service endpoint, and there is no NAT gateway — so despite route-all, the App
Service reaches MySQL over the public endpoint from its ordinary outbound IPs. The
`AllowAllAzureServicesAndResourcesWithinAzureIps` rule admits those regardless of subscription,
so **the cross-account connection works identically.** (Trade-off to know: that rule admits *any*
Azure-originated IP, not just yours — the same exposure you have today.)

### New server — exact settings

| Setting | Old (live) | New | Note |
|---|---|---|---|
| SKU / tier | Standard_B1ms / Burstable | **same** | only compute size the free tier covers (`B1MS Compute - Free`) |
| Version | 8.0.21 (patched to 8.0.45) | **8.0.21** | Azure applies the same minor patching |
| Region | Southeast Asia | **same** | |
| Availability zone | 2 | **no preference** | zone numbers are per-subscription logical labels — "2" on another subscription is not the same datacenter, so matching it gains nothing |
| Storage | 20 GB, Premium_LRS, LRS | **same** | free tier covers ≤32 GB |
| IOPS | 360 (storage-derived) | **same** | |
| Storage auto-grow | Enabled | **same** | ⚠ growth past 32 GB would start billing — years away at 0.93 GB used |
| Auto IO scaling | Disabled | **same** | |
| Backup retention / geo | 7 days / Disabled | **same** | |
| High availability | Disabled | **same** | |
| Public access | Enabled | **same** | |
| Firewall | AllowAllAzure + 6 stale laptop IPs | **AllowAllAzure + current laptop IP** | old laptop IPs are not carried over |
| Data encryption | service-managed | **same** | |
| Maintenance window | system-managed, `Regular` patching | **same** | |
| Admin login | `azvvyqzsum` | **new name + password** | App connects as the admin — there are **no other MySQL users to recreate** |

### Server parameters

448 parameters; 7 report `user-override`, of which **one is a real change**:

| Parameter | Value | Action on new server |
|---|---|---|
| **`event_scheduler`** | **OFF** (Azure default ON) | **set to OFF** — the only real deviation |
| `sql_mode` | `ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO` | none — identical to default |
| `require_secure_transport` | ON | none — equals default |
| `log_bin`, `server_id`, `general_log_file`, `slow_query_log_file` | — | none — Azure-managed housekeeping |

Values that must end up identical (all defaults, verify after provisioning):
`lower_case_table_names=1` (**cannot be changed after creation**), `time_zone=+00:00`,
`character_set_server=utf8mb4`, `collation_server=utf8mb4_0900_ai_ci`, `max_connections=171`,
`innodb_buffer_pool_size=536870912`, `sql_generate_invisible_primary_key=ON`,
`default_authentication_plugin=mysql_native_password`, `tls_version=TLSv1.2,TLSv1.3`.

### Databases — scope decided 2026-09-26

The old server holds **18 non-system databases**. Migrating only:

| Database | Charset / collation | Why |
|---|---|---|
| `global` | utf8mb4 / **`utf8mb4_unicode_ci`** | not a tenant — logins, tenant list, plans, subscriptions. Nothing works without it |
| `audio_technic_db` | utf8mb4 / `utf8mb4_0900_ai_ci` | live tenant |
| `web_bytes_db` | utf8mb4 / `utf8mb4_0900_ai_ci` | kept by decision |

**Not migrated** (declared test accounts): `bayaryuk-database` (utf8mb3, unreferenced anywhere in
`src/`/`prisma/`), `alvin_jiang_db`, `test_db_db`, `wonder_cafe_db`, `real_mart_db`,
`aneka_musik_db`, `ah_han_db`, `joni_setiawan_db`, `nanggroe_wash_db`, `aceh_wash_db`,
`bintang_terang_db`, `aceh_wash_test_db`, `demo_retail_db`, `demo_laundry_db`, and the leftover
`prisma_migrate_shadow_db_f0a025e6-…`.

> ✅ **Resolved 2026-09-26:** `aceh_wash` was flagged because `.claude/memory/reference_create_tenant_user.md`
> describes it as a prod Laundry Pro tenant. **The user confirmed it is a test account** — not migrated.
> (That memory file is now stale on this point.)

**Consequence of scoping — accepted, harmless:** `global` still lists every tenant, so the test
tenants' rows point at databases that won't exist on the new server. Logging in as one fails;
nightly crons (`loyalty-expiry`, `subscription-expiry`, `idempotency-cleanup`) wrap **each tenant in
its own try/catch** and log one error per missing DB, then continue. `upgrade_db_newprod` likewise
catches per tenant. Nothing crashes. Deleting those `global` rows would be cleaner but touches
foreign keys (tenant users, add-ons, subscriptions) — deferred, not required.

**Collation is load-bearing.** `global` is `utf8mb4_unicode_ci`, not the server default. A
restore that ran a bare `CREATE DATABASE` would give it `utf8mb4_0900_ai_ci`: existing tables keep
their own collation from the dump, but any table a **future Prisma migration** adds inherits the
database default, and joins between old and new tables then fail with "Illegal mix of
collations". `db_backup.ts` now writes a `manifest.json` of each database's charset/collation and
`db_restore.ts` recreates each database from it.

### Tooling changes for this scope (2026-09-26)

- `db_backup.ts` — new `--only=a_db,b_db` flag (global always included; unknown names fail fast),
  and writes `manifest.json`.
- `db_restore.ts` — reads `manifest.json` and issues `CREATE DATABASE … CHARACTER SET … COLLATE …`;
  warns loudly if a backup has no manifest.
- The scoped backup command used from now on:

```bash
npm run backup_db_prod -- --only=audio_technic_db,web_bytes_db
```

### Also removed 2026-09-26: the `demo-reset` cron

`src/cron/demo-reset.cron.ts` deleted and unscheduled from `cron-manager.ts` at the user's request
(the Coba Demo login is flag-gated OFF in general builds; no one uses it). `demo-seed.service.ts`
is kept, so the demo can still be reseeded by hand. **Takes effect on prod only after the next BE
deploy.** Its absence also means the demo databases not being migrated produces no nightly noise.

---

## Findings from the 2026-09-21 infra review (read before Phase 1)

Two things measured on the live server that bear on this migration.

**1. MySQL memory is climbing monotonically — a fresh server resets it.**
`memory_percent` rose 37.17% → 46.91% over 31 days (+1.07 pp/week early, +1.67 pp/week recently,
≈ +200 MB/month on 2 GiB), with **zero dips — `Uptime` is 44.5 days continuous**. It is not
buffer-pool warming (`innodb_buffer_pool_size` is fixed at 512 MiB, allocated at startup) and not
data growth (`storage_percent` flat at 4.6%). Most likely per-tenant table/dictionary cache
(one DB per tenant; `table_open_cache`/`table_definition_cache` both 600) or `performance_schema`.

A `mysqldump` + restore gives a fresh `mysqld`, which resets this. **Treat that as a free
diagnostic:** if it climbs again at the same rate on the new server it is genuine growth tied to
tenant/table count and needs a real fix; if it stays flat it was accumulated cache.
Record `memory_percent` weekly through Phase 4.

**2. ~90% of MySQL query volume is NOT the application, and will not follow you.**
Least-squares over 4,032 five-minute buckets (14 days):

```
Queries/5min = 278.2 + 3.395 × Requests/5min      Pearson r = 0.484
```

- Constant floor **278/5min (≈2.4M queries/month)** independent of app traffic.
- In the 4 buckets with **zero** App Service requests, MySQL still ran **245 queries/5min**.
- Flat straight through 02:00 / 02:30 / 03:00 / 04:00 WIB — **the crons are not responsible.**
- App-attributable share of 1,240,069 queries over 14 days: **9.5%**.
- App cost is **3.4 queries per HTTP request** — healthy; the application is not inefficient.

The floor is the managed platform's own telemetry, not something to fix in code. It also accounts
for most of the ~50 GiB/month `network_bytes_egress`, which is why that number looks absurd against
a 0.93 GB database.

**Open question — cheap to settle during this migration.** That the floor is *not the app* is
proven (it survives zero-request buckets and App Service restarts). That it is *Azure's telemetry
agent* is an inference, not a measurement. Azure exposes ~55 metrics including `storage_used`,
`data_storage_used`, `ibdata1_storage_used` and `others_storage_used`, which require polling
`information_schema` — expensive queries returning one row per table across every tenant database.
That would explain both the egress volume and the dictionary-cache memory climb in finding #1.

Two ways to confirm, both available during the Phase 3 night window:

- **Free, decisive, needs no credentials:** with App Service already stopped at T+0:00, watch
  `Queries` for 5 minutes. If the floor holds at ~278/5min with the app down, it is unambiguously
  server-side. (The original runbook already stops App Service — this costs nothing extra.)
- **Attributes it exactly, needs DB access:** `SHOW GLOBAL STATUS LIKE 'Com_%'` twice 60s apart,
  and check whether the delta lands in `Com_show_status` / `Com_select` on `information_schema`
  (platform) or `Com_stmt_execute` (Prisma, i.e. the app). Metrics cannot distinguish these —
  neither counter is exported.

Record the answer here. If it turns out to be the app after all, finding #2 becomes a real bug.

---

## Decisions locked in (do not re-litigate)

| Decision | Value | Rationale |
|---|---|---|
| App Service migration | **Stays on current subscription** | Not on free tier anyway — moving it just adds DNS/deploy risk for no cost saving |
| New MySQL region | **Southeast Asia** | Match App Service region; sub-ms cross-service latency |
| New MySQL SKU | **B1ms Burstable** | Same as current, eligible for free tier |
| Migration approach | **`mysqldump` + restore** | Single tenant + global = ~tens of MB. DMS / replication overkill |
| Cutover target | **A night window, date TBD** | Deadline already passed (see status block); no time pressure. Night = zero impact on the single live tenant `audio_technic_db` |
| New account identity | **Separate personal account + separate payment method** (confirmed 2026-09-21) | Azure's free offer is one-per-customer; a distinct account/payment instrument is what the offer keys on |
| Rollback path | **Repoint App Service env vars back to old DB** | Old server stays running through Phase 4 |

---

## Open items to fill in at execution time

| Item | When discovered | Where to record |
|---|---|---|
| New Azure account email | ✅ `alvinn.jiang.yt@gmail.com` | |
| New subscription ID | ✅ `3bbc4892-5a45-4680-95b3-64bf43d35d4c` (display name "Azure subscription 1" — **same as the old one**; always use the ID) | |
| New resource group name | ✅ `bayar-yuk-v2` | |
| New MySQL server hostname | ✅ `bayaryuk-db-v2.mysql.database.azure.com` | `.env` `NEWPROD_*` |
| New MySQL admin username | ✅ `bayar_yuk_v2` | `.env` |
| New MySQL admin password | ✅ generated, in `.env` only | `.env` (secret, gitignored) |
| Current App Service outbound IPs (for new MySQL firewall) | Phase 1 | Inline (output of `az webapp show --name BayarYuk --resource-group bayar-yuk --query outboundIpAddresses -o tsv`) |
| Tenant DB name on new server | Phase 2 | Should match current — `web_bytes_db` (tenant ID 11) |

---

## Phase 0 — Tooling additions — ✅ DONE 2026-09-21

Shipped in `flutter-server/`, `tsc --noEmit` clean and `npm run build` green:

| Change | File | Note |
|---|---|---|
| `newprod` target branch | `src/script/db_upgrade.ts` | reads `NEWPROD_GLOBAL_DB_URL` / `NEWPROD_TENANT_DATABASE_URL` |
| `newprod` target branch | `src/script/db_backup.ts` | same pattern |
| **new** restore script | `src/script/db_restore.ts` | 157 lines; reuses `db_backup.ts`'s URL parser and `MYSQL_PWD` handling |
| npm scripts | `package.json` | `upgrade_db_newprod`, `backup_db_newprod`, `restore_db`, `restore_db_newprod` |
| env placeholders | `.env`, `.env.example` | `NEWPROD_*`, values filled at Phase 1 |

**Two deliberate deviations from the original plan below:**

1. **`db_restore.ts` enumerates tenants from the backup directory's `.sql` filenames, not from
   `globalPrisma.tenant.findMany()`.** The target server is empty on a fresh provision, so there is
   no tenant table to read yet. It restores `global.sql` first, then every other `*.sql`, issuing
   `CREATE DATABASE IF NOT EXISTS` before each (the dumps are single-database and carry no
   `CREATE DATABASE`).
2. **There is deliberately no `restore_db_prod` npm script.** Restoring *into* prod overwrites live
   production. That direction requires the full command plus an explicit `--yes-i-am-sure` flag, so
   it cannot happen via tab-completion or a mistyped script name.

Guard behaviour verified 2026-09-21 (no DB contact):

```
db_restore.js                      -> usage, exit 1
db_restore.js prod <dir>           -> "Refusing to restore into PROD without --yes-i-am-sure."
db_restore.js banana <dir>         -> "Unknown target ..."
db_restore.js newprod /nope        -> "Backup dir does not exist ..."
db_restore.js local <empty dir>    -> "Missing global.sql in <dir>"
```

<details>
<summary>Original Phase 0 spec (superseded — kept for reference)</summary>

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

</details>

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

> **Shortcut verified 2026-09-21.** The *current* prod server already has
> `AllowAllAzureServicesAndResourcesWithinAzureIps` (the `0.0.0.0` rule) enabled, and MySQL is on
> **public access** (`publicNetworkAccess: Enabled`, `delegatedSubnetResourceId: null`, no private
> DNS zone — the `vnet-tnfgbina` in the RG is unrelated to it). Set the same toggle on the new
> server and the manual outbound-IP allowlisting below becomes unnecessary. That also removes the
> "App Service outbound IPs change" risk permanently, rather than needing periodic re-allowlisting.
> The IP-by-IP route below remains the tighter option if preferred.

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

## Phase 2 — Dry run (any time after Phase 1; no deadline)

Purpose: prove the pipeline works without touching production.

### 2.1 — Backup current prod

```bash
cd /Users/alvinjiang/Developments/flutter-server
npm run backup_db_prod -- --only=audio_technic_db,web_bytes_db
```

Output lands in `flutter-server/backups/prod_<timestamp>/`. Note the path. **Check that
`manifest.json` is in it and lists `global` as `utf8mb4_unicode_ci`** — that file is what makes
the restore recreate the collation correctly.

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

## Phase 3 — Real cutover (night window, date TBD)

### 3.0 — Choosing the window

Single live tenant: **`audio_technic_db`**. Measured traffic 2026-09-21 over 30 days, in WIB:

```
00:00-07:00   12-18 req/hr   <- background sync + health only, no human activity
08:00         41 req/hr      <- first humans
17:00        331 req/hr      <- daily peak
```

**Pick any hour between 00:00 and 05:00 WIB.** Zero user-facing impact; the only traffic is device
background sync, and those writes go through the device outbox (`OfflineWriteHelper`) which retries
on reconnect by design. Avoid **02:00-04:30 WIB** — the four daily crons fire at 02:00, 02:30,
03:00 and 04:00 (`src/cron/cron-manager.ts`). **01:00 WIB is the cleanest slot.**

Do NOT schedule on a night before a business day the tenant cares about, so there is a full working
day of observation before the next one.

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
npm run backup_db_prod -- --only=audio_technic_db,web_bytes_db
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
# Expect: {"status":"ok","uptime":<small>,...} — uptime resets, confirming the restart took

# T+0:13 — Tail logs for 2 min, watch for errors
az webapp log tail --name BayarYuk --resource-group bayar-yuk
```

### 3.3 — Smoke tests from a real device

- Open Flutter app, log in as a **`audio_technic`** user (the live prod tenant — `web_bytes` is the *local* test tenant and does not exist in prod)
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

## Phase 4 — Soak + cleanup (T+10 days)

### 4.1 — Daily monitoring (during soak)

> Add two readings from the 2026-09-21 findings, once a day:
> - `memory_percent` — is the climb back? (finding #1). Flat ⇒ it was accumulated cache; rising at
>   ~+1.6 pp/week ⇒ genuine growth, open a separate investigation.
> - `Queries` floor at an idle hour — did ~278/5min follow to the new server? It should, if it is
>   platform telemetry.

- Once a day, `curl /health` and check `az webapp log tail` for new errors
- Watch Azure Portal MySQL metrics on new server: CPU, connections, storage
- Make sure free-tier compute hours aren't blowing past 750/month (probably won't)

### 4.2 — Verify free-tier eligibility on new server

In new Azure Portal → Cost Management — confirm MySQL line item is $0.

### 4.3 — Cleanup (after 10 days stable)

~~Hard cutoff: must complete before Fri 4 Sep 2026~~ — **superseded.** That date passed; the old
server is billing $21.74/mo *now*. Every day of soak costs ~$0.72, so do not rush it, but do not
forget it either: deleting the old server is what actually realises the saving.

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
| New free tier not granted | Medium | **Decided 2026-09-21: separate personal account + separate payment method.** If denied, fall back to paying $21.74/mo on the existing server — nothing is lost but the effort |
| Free-tier subscription later suspended with prod DB on it | Low-Medium | The offer is one-per-customer. Keep the old server alive through the full Phase 4 soak, keep `PROD_*` in `.env`, and keep taking `backup_db_newprod` dumps after cutover — rollback stays one appsettings change away |
| **Second expiry missed, exactly as the first was** | **Medium** | Calendar reminder at **11 months after Phase 1 provisioning**, set the same day the server is created. This is the failure that already happened once |
| App Service outbound IPs change after firewall is set | Low | Re-allowlist via `az webapp show`. Or use "Allow Azure services" toggle |
| Cross-subscription firewall complications | Low | We use SQL auth, not Azure AD. No subscription boundary in cred plane |
| Schema mismatch between old and new (if migrations were applied at different times) | Low | `npm run upgrade_db_newprod` after restore ensures both are at the same Prisma migration revision |
| mysqldump too slow / times out | Very Low | Data set is small; in tests should be seconds. If somehow huge, mysqldump supports `--single-transaction` (already on) — restore can also be chunked |
| App tries to write during the 10-15 min window | Low | App Service is stopped, so no traffic ingress. The outbox on devices will retry — by design |
| Forgot to delete old MySQL after soak | Medium | The saving is only realised on deletion — until then you pay for both. Delete command is in Phase 4.3 |

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

# PROD — the live server since the 2026-09-26 cutover (swapped in at cutover)
PROD_GLOBAL_DB_URL="mysql://bayar_yuk_v2:****@bayaryuk-db-v2.mysql.database.azure.com:3306/global?sslaccept=strict"
PROD_TENANT_DATABASE_URL="mysql://bayar_yuk_v2:****@bayaryuk-db-v2.mysql.database.azure.com:3306/{tenant_db_name}?sslaccept=strict&connection_limit=3"

# NEWPROD — same server as PROD now; kept so the *_newprod scripts still resolve. Remove in Phase 4.
NEWPROD_GLOBAL_DB_URL="(same as PROD_GLOBAL_DB_URL)"
NEWPROD_TENANT_DATABASE_URL="(same as PROD_TENANT_DATABASE_URL)"

# OLDPROD — the retired bayaryuk-server, FROZEN at 22:33 on 2026-09-26. Rollback only. Remove with the server.
OLDPROD_GLOBAL_DB_URL="mysql://azvvyqzsum:****@bayaryuk-server.mysql.database.azure.com:3306/global?sslaccept=strict"
OLDPROD_TENANT_DATABASE_URL="mysql://azvvyqzsum:****@bayaryuk-server.mysql.database.azure.com:3306/{tenant_db_name}?sslaccept=strict"
```

**Current state (2026-09-26, post-cutover).** The original plan swapped `PROD_*` only at Phase 4; it was
done **at cutover** instead, so that `backup_db_prod` / `upgrade_db_prod` run during the soak hit the live
database rather than the frozen one. Phase 4 cleanup = delete `OLDPROD_*` and `NEWPROD_*` (and the
`*_newprod` npm scripts if no longer wanted).

---

## Appendix B — Command quick reference

```bash
# Anywhere in the flow
cd /Users/alvinjiang/Developments/flutter-server

# Backup any target
npm run backup_db_prod -- --only=audio_technic_db,web_bytes_db   # current Azure
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

Last reviewed: **2026-09-21** — deadline-missed status recorded, live costs re-verified against Azure
Cost Management, Phase 0 tooling implemented and build-verified, night cutover window chosen from
measured traffic, 2026-09-21 infra findings folded in.

Next review: when the new Azure account is created (Phase 1 trigger).

**Blocking next action: create the new Azure account** (separate personal account + separate payment
method). Everything from Phase 1 onward is gated on it; nothing else can proceed.
