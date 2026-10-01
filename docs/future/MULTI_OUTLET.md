# Multi-Outlet — Single Source of Truth

Everything for the multi-outlet feature in one place: terminology, what's done, the account-owner-as-super-admin change to build, the BE-1 migration prod deploy, and the remaining backlog. **Refer to only this file.**

**Last updated:** 2026-10-01 · **Repo:** `bayaryuk-server` · **Branch:** merged into **`feature/sprint-008`** on 2026-09-30 (BE `d7c47f7`, FE `7ea8cc3`; built on `feature/outlet-sprint006-merge` → `feature/sprint-008-outlet`). Ships with the sprint-008 release — not on prod yet.
**Helper scripts (this folder):** `be1_prod_probe.js`, `be1_verify_post.js` (both READ-ONLY). There is no 2-outlet fixture script (`create_multi_outlet_test_tenant.ts` was referenced here but never committed) — see §4.
**Retire this doc** once §3 has run on prod and the release is verified: fold §1/§2/§5 into FE `docs/modules/OUTLET.md` (the as-built module doc) and keep only what is still unbuilt (Set A/B, BE-2) in a smaller future doc.

---

## 0. Status at a glance

| Item | State |
|---|---|
| Multi-outlet P0+P1 fixes (migration, IDOR read-scoping, FE outlet isolation, offline replay) | ✅ done + committed |
| Server-assigned procurement numbers (`src/helpers/documentNumber.ts`, `document_sequence`) | ✅ done 2026-09-28 |
| One outlet-access rule (`src/api-helpers/outlet-access.ts`) | ✅ done 2026-09-28 (`1e087c3`) |
| Merged into `feature/sprint-008` (BE `d7c47f7`, FE `7ea8cc3`) | ✅ 2026-09-30 |
| BE-1 migration dry-run (local DBs, idempotent; `npm run upgrade_db` all tenants OK after the merge) | ✅ done |
| BE-1 migration **prod deploy** (`audio_technic_db` + `web_bytes_db` — the only tenant DBs on `bayaryuk-db-v2`) | ☐ with the sprint-008 release (planned 2026-10-01) → §3 |
| **Account owner = Super Admin, outlet-unrestricted** (Set A) | ☐ not coded → §2 |
| **Account owner assigns staff to outlets** (Set B) | ☐ not coded → §2 |
| E2E test on the 2-outlet fixture | ☐ pending → §4 |
| P2/MEDIUM/LOW backlog + BE-2 cutover | ☐ tracked → §5 |

---

## 1. Terminology (canonical)

Bayaryuk is multi-tenant — **one MySQL DB per tenant**. Two distinct "owner" concepts:

| Term | Who | JWT `role` | JWT `permissions` | `/admin/*`? | Outlet access today |
|---|---|---|---|---|---|
| **POS OWNER** | `avjiang` (platform / me) | `"admin"` | `['*']` | ✅ | unrestricted, all tenants |
| **ACCOUNT OWNER** | the tenant customer; "Super Admin" role **id 1** | `"user"` | `['*']` | ❌ | scoped to `allowedOutletIds` ← the gap |
| staff | cashier etc. the owner creates | `"user"` | specific | ❌ | scoped to assigned outlets |

- `role` = `"admin"` only for `username === "avjiang"` (`src/auth/auth.service.ts:534`) — a hardcode, not a real role system.
- `permissions: ['*']` (super-admin wildcard) is granted to avjiang **and** any role-id-1 user (`src/auth/permission-cache.ts:45,66`). Every account owner has role id 1.
- **Crux:** `permissions:['*']` grants unrestricted **feature** capability, but outlet access keys off **`role`**, not `permissions` — so the Super Admin account owner is currently treated like scoped staff.
- **The one rule** (`src/api-helpers/outlet-access.ts` `resolveAllowedOutletIds`, since 2026-09-28): role `admin` → unrestricted; else the token's non-empty `allowedOutletIds`; else the user's live `user_outlet` rows (primary first); else the tenant's lowest live outlet. Used by `requireOutletAccess`, `/outlet` + `/outlet/sync` and the procurement create checks (`assertOutletsAllowed`). Login (`auth.service.ts:482-513`) fills `allowedOutletIds` with the same rows-else-primary rule, and tokens issued before the deploy (no claim) resolve through it.
- `X-Outlet-ID` and `allowedOutletIds` are **tenant-DB `outlet.id`** values (not the global `tenant_outlet.id`).

**Intended model (confirmed 2026-07-07):** the ACCOUNT OWNER has unrestricted control over **every outlet in their own tenant**, automatically. `user_outlet` assignment only *scopes regular staff*.

---

## 2. Build: account owner as Super Admin

**Trigger:** before onboarding the first genuinely multi-outlet tenant, or when the owner needs self-service. Safe anytime — while all tenants are single-outlet, Set A is a no-op observationally (only *grants* the owner intended access); Set B is additive.

### Set A — Super Admin is outlet-unrestricted (3 gates)

**A1. New helper `src/helpers/authz.ts`:**
```ts
import { UserInfo } from "../middleware/authorize-middleware";
/** True when the caller may access EVERY outlet in their own tenant DB:
 *  POS owner (role "admin") OR account owner / Super Admin (permissions wildcard '*').
 *  Tenant isolation is inherent (getTenantPrisma(token.databaseName)), so never cross-tenant. */
export const isOutletUnrestricted = (user?: UserInfo): boolean =>
    !!user && (user.role === "admin" || (user.permissions?.includes("*") ?? false));
```

**A2. One change, since the 2026-09-28 refactor:** the three gates (`outlet.service.ts` `getAll` + `getOutletSync`, `requireOutletAccess`) and the procurement checks all call `resolveAllowedOutletIds` (`src/api-helpers/outlet-access.ts`). Swap its first line:

```diff
-    if (user.role === "admin") return null;
+    if (isOutletUnrestricted(user)) return null;
```
(Add `import { isOutletUnrestricted } from "../helpers/authz"`.)

**Effect:** the account owner auto-sees/uses every outlet in their tenant — including newly created ones — so **no change to `createOutletForTenant` needed** (auto-assign gap dissolves). Staff behavior unchanged.

### Set B — Account owner assigns staff to outlets (app-facing)

Add tenant-scoped routes in the existing `/user` module, gated by `requirePermission(PERMISSION.MANAGE_USERS)` (Super Admin passes via `'*'`; staff don't — pattern already at `src/user/user.controller.ts:88`):
```ts
router.get('/:id/outlets',  requirePermission(PERMISSION.MANAGE_USERS), getUserOutlets)
router.post('/:id/outlets', requirePermission(PERMISSION.MANAGE_USERS), assignUserOutlets)
router.delete('/:id/outlets/:outletId', requirePermission(PERMISSION.MANAGE_USERS), removeUserOutlet)
```
New thin fns in `src/user/user.service.ts` operate on **tenant-DB ids** from the token (`req.user.databaseName`) — no global-id resolution (that's the `/admin` portal's job). Mirror the upsert shape of `admin.service.ts:2942`. Validate `outletIds` exist + are positive ints (`src/user/user.request.ts`). Keep the `/admin` assignment endpoints for the POS owner.

### Out of scope (track, don't do here)
- **BE-2 cutover** (§5) — a request with no outlet context (or `0`) defaults to the caller's primary outlet. Force the released app to always send `X-Outlet-ID` and turn the default into a 400 before any tenant goes multi-outlet. _(The old "empty allow-list allows any outlet" fall-through is gone since 2026-09-28: an empty/absent list now resolves through `user_outlet` / the primary outlet.)_
- **Replace the `username === "avjiang"` hardcode** with a real platform-owner flag — tech debt.
- **App-facing staff *creation*** — no `POST /user` today (staff created via `/admin createTenantUser`). Add if the owner should create staff, not just assign.

### Rollback
Pure code change, no schema/data migration — revert the commit.

---

## 3. BE-1 migration — prod deploy runbook

The migration `20260930120000_multi_outlet_fks_and_user_outlet` (adds `user_outlet` + outlet FKs across 9 tables + the `document_sequence` table behind server-assigned procurement numbers) is **rewritten prod-safe + idempotent** and dry-run-verified locally. It was re-stamped twice (`20260702000000_…` → `20260928120000_…` → `20260930120000_…`) so it sorts after the sprint's other two tenant migrations, `20260928120000_widen_setting_value_to_text` and `20260928130000_add_sales_payment_client_ref` — one `upgrade_db_prod` run applies all three, in that order. It never reached prod under any name.

**Prod state (read-only pre-flight 2026-10-01):** nothing applied; `audio_technic_db` and `web_bytes_db` at `20260813120000`, no failed rows; they are the only tenant DBs on `bayaryuk-db-v2`. It ships with the sprint-008 backend, deployed **before** the new app; the released `1.1.0+16` app is **not** kept compatible (it still generates procurement numbers the server now overwrites, and has no outlet selection), so testers update/reinstall and the minimum app version is raised right after the deploy. The authoritative checklist is FE `docs/sprints/SPRINT_008.md` §3 (steps 0–10); this section holds the multi-outlet detail.

**Azure client gotcha:** Azure MySQL needs the `mysql_native_password` plugin, dropped by Homebrew `mysql` 9.x (`ERROR 2059`). Use the 8.4 client:
```bash
export MYSQL_BIN=/opt/homebrew/opt/mysql-client@8.4/bin/mysql
export PATH="/opt/homebrew/opt/mysql-client@8.4/bin:$PATH"   # so backup_db_prod's mysqldump authenticates too
```

**Release order (from repo root, `.env` with `PROD_*` URLs present; Node 22; `npm run build` first — the db scripts run from `dist/`):**
```bash
# 0. Firewall: this Mac's public IP must be in the bayaryuk-db-v2 rules (curl api.ipify.org)
# 1. Backup prod (mandatory rollback point) — dumps global + every tenant DB on the server
npm run backup_db_prod                        # verify backups/prod_<ts>/ has all dumps
# 2. READ-ONLY probe — GO/NO-GO gate (per-tenant outlet + orphan report)
node docs/future/be1_prod_probe.js            # proceed only on "OVERALL: GO"
# 3. Migrate (prisma migrate deploy per tenant; all three sprint-008 tenant migrations)
npm run upgrade_db_prod                        # lists failed DBs + exits 1 on any failure (since e8e686e)
# 4. READ-ONLY verify — user_outlet seeded, document_sequence + FKs present, 0 orphans per tenant
node docs/future/be1_verify_post.js            # PASS for audio_technic_db + web_bytes_db
# 5. git push origin feature/sprint-008:main   (CI/CD → App Service; production, owner's go)
# 6. curl …/health until uptime resets
# 7. PUT /admin/versions {platform:"android", minVersion:"1.2.0", latestVersion:"1.2.0", storeUrl} (admin token) — src/version/APP_VERSION_CONTROL.md
# 8. Distribute the 1.2.0 APK
```
**Tenants missing from the server:** `global.tenant` still lists test tenants whose database was not carried to `bayaryuk-db-v2`. `upgrade_db_prod` skips and lists them. The probe shows them as connection errors with a "no live outlet … safe" GO note; the verify script does **not** skip them, so they print `FAIL` and the summary reads "SOME TENANTS FAILED" — judge `audio_technic_db` and `web_bytes_db`, not the summary line.
**Probe verdicts:** GO = safe · SKIP = already applied (per `_prisma_migrations`: finished and not rolled back) · NO-GO = no live outlet while the tenant has scoped rows or live users, >1 live outlet, a FAILED migration record, or a probe error → stop. Dangling `menu_profile_outlet` rows (menu profile gone) are reported as auto-cleaned: the migration deletes them before adding the FK.

**Rollback / failed run:** BE-1 is idempotent. If the probe says NO-GO, stop before step 3 — nothing has changed. If Prisma records it FAILED for a tenant, `migrate deploy` refuses to continue for that DB until the record is resolved: run `npx prisma migrate resolve --rolled-back 20260930120000_multi_outlet_fks_and_user_outlet --schema=prisma/client/schema.prisma` against that tenant's URL, fix the cause, then redeploy (`upgrade_db_prod`) — the guards make already-applied statements no-ops. If a tenant is corrupted, restore its dump first.

If the BE deploy itself must be rolled back after the migration: the migration is additive (new tables, FKs, seeded rows) and the previous BE binary does not read `user_outlet` / `document_sequence`, so redeploying the old `main` works without undoing it; restore a dump only for data damage.

> ⚠️ Author-machine only (not prod): local DBs that applied an older name (`20260702000000_…` / `20260928120000_multi…` / `20260928130000_multi…`) keep that record; `migrate deploy` then applies `20260930120000_…` as a new migration, which is a no-op re-run apart from creating `document_sequence`. Prod never had any of them, so it can't hit this.

---

## 4. Test fixture + E2E plan

Build a real 2-outlet tenant locally (no prod tenant has >1 outlet, so multi-outlet has never run with real data). **No fixture script exists** (`create_multi_outlet_test_tenant.ts` was planned but never committed): create a tenant with `src/script/create_test_tenant.ts`, add Outlet B via `POST /admin/tenants/:tenantId/outlets`, create a `cashier` via `POST /admin/createTenantUser/:tenantId`, and assign outlets via `POST /admin/tenants/:tenantId/users/:userId/outlets` (owner → A+B, cashier → A only).

**Scenarios (run against a locally-started server — never prod):**
1. **Owner** → `GET /outlet` returns **both** outlets (via Set A, even if `user_outlet` only had A).
2. Owner `X-Outlet-ID: 2` → allowed; read/write in Outlet B works.
3. POS owner adds "Outlet C" via `/admin` → owner sees C automatically, no assignment.
4. **Cashier** → `GET /outlet` returns **only A**; `X-Outlet-ID: 2` → **403 "Outlet access denied"**.
5. Owner `POST /user/<cashierId>/outlets {outletIds:[2]}` → cashier now sees A+B (Set B).
6. Regression: a single-outlet tenant (`web_bytes`) behaves exactly as before.

After: `npx tsc --noEmit` + FE `flutter analyze` clean.

---

## 5. Remaining backlog (from the merge audit)

Findings from the peer's multi-outlet merge that are **tracked but not blocking**. P0+P1 were all fixed; these remain:

- **BE-2 (the big one) — primary-outlet default cutover.** The `requireOutletAccess` middleware defaults a header-less request to the caller's primary outlet, and (since 2026-09-28) resolves a token without `allowedOutletIds` from `user_outlet` / the tenant's primary outlet (`api-helpers/outlet-access.ts`) instead of allowing any outlet. **Safe only while every tenant is single-outlet.** Before any tenant goes multi-outlet: force the released app to always send `X-Outlet-ID` (hard update wall) and turn the fallback into a 400. This is the "out of scope" note in §2.
- **M2** — FE `_filterByAllowed` degrades open (empty allow-list → all cached outlets). Under the new model this is *desired for the Super Admin owner* but a *bug for staff*; scope it to non-super-admins.
- **M3** — FE read-cache not outlet-keyed → stale rows on outlet switch. _Largely addressed by the 2026-09-30 merge: Drift reads filter by the selected outlet and sync cursors are keyed per user + outlet (`sync_timestamp_manager.dart`); re-check on the 2-outlet fixture._
- ~~**M4** — settlement `validateDocumentNumber` skips outlet cross-check.~~ Resolved 2026-09-28: procurement numbers are server-assigned (`src/helpers/documentNumber.ts`, table `document_sequence`); `validateDocumentNumber` is gone.
- **item.getAll** — nested `stockBalance` filter only applied when an outletId is present; item-sync without a header sums every outlet's stock. Match `getLowStockItems` rigor, or require the header.
- **Stock-fallback (QA)** — his branch returns `stockRow?.availableQuantity ?? 0` (was `stockRow ?? itemRow.stockQuantity ?? 0`); a missing `StockBalances` row now reads 0 → POS may block a sale.
- ~~**FE Drift v17** — also backfills-to-1~~ Resolved: the backfill is Drift **v18** and uses the device's saved outlet (`AppDatabase.legacyOutletId`), not 1. Still open: `purchase_return` has app-layer outlet scoping but **no DB-level FK** (not in the migration's 9 tables).
- **Per-outlet pricing / promotions / recipes** — deferred until the business asks (carried from the retired FE `docs/outlet_impact_analysis.md`, removed 2026-10-01).
- **Stale doc pointers in code comments** — `outlet-authorization.middleware.ts`, `outlet-helper.ts`, `auth.service.ts` cite `docs/future/OUTLET_MERGE_AUDIT.md`, and `stock-transfer.service.ts` / FE `warehouse_transfer_screen.dart` cite `MULTI_OUTLET_BE.md §10`; neither file exists — point them at this doc / FE `docs/modules/OUTLET.md` on the next code change.

---

## 6. Key files / evidence

| Purpose | File:line |
|---|---|
| JWT role (avjiang→admin) | `src/auth/auth.service.ts:534` |
| Super-admin `['*']` (avjiang + role id 1) | `src/auth/permission-cache.ts:45,66` |
| `/admin` role gate | `src/middleware/authorize-middleware.ts:39` |
| **The outlet-access rule (Set A target)** | `src/api-helpers/outlet-access.ts` (`resolveAllowedOutletIds`, `assertOutletsAllowed`) |
| Outlet list/sync scoping | `src/outlet/outlet.service.ts` (`getAll`, `getOutletSync`) |
| Outlet per-request authz + primary-outlet default (BE-2) | `src/middleware/outlet-authorization.middleware.ts` |
| allowedOutletIds source (login) | `src/auth/auth.service.ts:482-513` |
| Server-assigned procurement numbers | `src/helpers/documentNumber.ts` (`document_sequence`) |
| Create outlet (no auto-assign) | `src/admin/admin.service.ts:2689` (`createOutletForTenant`) |
| Assign user↔outlet (admin-only today) | `src/admin/admin.service.ts` (`getUserOutlets` ~2925 / assign ~2967); routes `admin.controller.ts:731-734` |
| Permission-gate pattern (Set B) | `src/middleware/require-permission.middleware.ts`; usage `src/user/user.controller.ts:88` |
| Migration | `prisma/client/migrations/20260930120000_multi_outlet_fks_and_user_outlet/migration.sql` |

FE companions: as-built module doc `flutter-front-end/docs/modules/OUTLET.md`; memory `flutter-front-end/.claude/memory/reference_multi_outlet_roles.md`; release checklist `flutter-front-end/docs/sprints/SPRINT_008.md` §3.
