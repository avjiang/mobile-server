# Multi-Outlet — Single Source of Truth

Everything for the multi-outlet feature in one place: terminology, what's done, the account-owner-as-super-admin change to build, the BE-1 migration prod deploy, and the remaining backlog. **Refer to only this file.**

**Last updated:** 2026-07-07 · **Repo:** `bayaryuk-server` · **Branch:** `feature/outlet-sprint006-merge`
**Helper scripts (this folder):** `be1_prod_probe.js`, `be1_verify_post.js` (both READ-ONLY), `../../src/script/create_multi_outlet_test_tenant.ts` (test fixture builder).

---

## 0. Status at a glance

| Item | State |
|---|---|
| Multi-outlet P0+P1 fixes (migration, IDOR read-scoping, FE outlet isolation, offline replay) | ✅ done + committed |
| BE-1 migration dry-run (local `web_bytes_db`, all 7 doc tables, idempotent) | ✅ done |
| BE-1 migration **prod deploy** (13 tenant DBs) | ☐ pending → §3 |
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

- `role` = `"admin"` only for `username === "avjiang"` (`src/auth/auth.service.ts:506`) — a hardcode, not a real role system.
- `permissions: ['*']` (super-admin wildcard) is granted to avjiang **and** any role-id-1 user (`src/auth/permission-cache.ts:44-45,65-66`). Every account owner has role id 1.
- **Crux:** `permissions:['*']` grants unrestricted **feature** capability, but the outlet gates key off **`role`**, not `permissions` — so the Super Admin account owner is currently treated like scoped staff.
- `X-Outlet-ID` and `allowedOutletIds` are **tenant-DB `outlet.id`** values (not the global `tenant_outlet.id`), built from `user_outlet` rows at login (`auth.service.ts:485-489`).

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

**A2. Swap `role !== "admin"` → `!isOutletUnrestricted(user)` in all 3 gates:**
- `src/outlet/outlet.service.ts:11` (`getAll` — the app's outlet switcher)
- `src/outlet/outlet.service.ts:61` (`getOutletSync`)
- `src/middleware/outlet-authorization.middleware.ts:51` (per-request `X-Outlet-ID` authz)

```diff
-        if (user.role !== "admin") {
+        if (!isOutletUnrestricted(user)) {
             whereClause.id = { in: user.allowedOutletIds || [] };
         }
```
(Add `import { isOutletUnrestricted } from "../helpers/authz"` to each.)

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
- **Tighten staff empty-allow-list fall-through** — `outlet-authorization.middleware.ts:57` allows any outlet when `allowedOutletIds` is empty. This is the **BE-2 cutover** (§5): force the released app to always send `X-Outlet-ID`, turn the fallback into a 400. Doing it now breaks the released app.
- **Replace the `username === "avjiang"` hardcode** with a real platform-owner flag — tech debt.
- **App-facing staff *creation*** — no `POST /user` today (staff created via `/admin createTenantUser`). Add if the owner should create staff, not just assign.

### Rollback
Pure code change, no schema/data migration — revert the commit.

---

## 3. BE-1 migration — prod deploy runbook

The migration `20260702000000_multi_outlet_fks_and_user_outlet` (adds `user_outlet` + outlet FKs across 9 tables) is **rewritten prod-safe + idempotent** and dry-run-verified locally. It is still **pending on prod** (13 tenant DBs). Deploy touches prod **DB only** (no app release needed — the released binary keeps working via the BE-2 primary-outlet default).

**Azure client gotcha:** Azure MySQL needs the `mysql_native_password` plugin, dropped by Homebrew `mysql` 9.x (`ERROR 2059`). Use the 8.4 client:
```bash
export MYSQL_BIN=/opt/homebrew/opt/mysql-client@8.4/bin/mysql
export PATH="/opt/homebrew/opt/mysql-client@8.4/bin:$PATH"   # so backup_db_prod's mysqldump authenticates too
```

**Sequence (from repo root, `.env` with `PROD_*` URLs present):**
```bash
# 1. READ-ONLY probe — GO/NO-GO gate (per-tenant outlet + orphan report)
node docs/future/be1_prod_probe.js            # proceed only on "OVERALL: GO"
# 2. Backup prod (mandatory rollback point) — dumps global + every tenant DB
npm run backup_db_prod                        # verify backups/prod_<ts>/ has all dumps
# 3. Deploy (prisma migrate deploy per tenant)
npm run upgrade_db_prod                        # expect "successfully applied"
# 4. READ-ONLY verify — user_outlet seeded, FKs present, 0 orphans per tenant
node docs/future/be1_verify_post.js            # expect "ALL TENANTS PASS ✅"
```
**Probe verdicts:** GO = safe · SKIP = already applied · NO-GO = scoped rows but no resolvable outlet, or probe errored → stop. A **MULTI-OUTLET** note = a tenant has >1 live outlet (none expected today) → pause and confirm.

**Rollback:** BE-1 is idempotent → first re-run `upgrade_db_prod` (guards make applied statements no-ops). If a tenant is corrupted, restore its dump; if Prisma marks it FAILED, `npx prisma migrate resolve --rolled-back 20260702000000_multi_outlet_fks_and_user_outlet --schema=prisma/client/schema.prisma` then re-run.

> ⚠️ Author-machine only (not prod): BE-1's SQL was rewritten after it was applied to local `demo_laundry_db`/`demo_retail_db`, so their Prisma checksum drifts → the author machine's next local `upgrade_db` errors on those two. Fix by re-seeding them or `prisma migrate resolve`. The deploy machine has no local DBs, so it can't hit this.

---

## 4. Test fixture + E2E plan

Build a real 2-outlet tenant (no prod tenant has >1 outlet, so multi-outlet has never run with real data):
```bash
npx ts-node src/script/create_multi_outlet_test_tenant.ts local
```
Produces tenant `multi_outlet_test`: Outlet A (dbId 1) + Outlet B (dbId 2); `owner` = Super Admin (assigned A+B), `cashier` = staff (assigned A only). Login creds = username/username.

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

- **BE-2 (the big one) — primary-outlet default cutover.** The `requireOutletAccess` middleware defaults a header-less request to the caller's primary outlet, and allows any outlet when `allowedOutletIds` is empty (`outlet-authorization.middleware.ts:57,61-64`). **Safe only while every tenant is single-outlet.** Before any tenant goes multi-outlet: force the released app to always send `X-Outlet-ID` (hard update wall) and turn the fallback into a 400. This is the "out of scope" note in §2.
- **M2** — FE `_filterByAllowed` degrades open (empty allow-list → all cached outlets). Under the new model this is *desired for the Super Admin owner* but a *bug for staff*; scope it to non-super-admins.
- **M3** — FE read-cache not outlet-keyed → stale rows on outlet switch; needs clear-on-switch or outlet-keyed cache.
- **M4** — settlement `validateDocumentNumber` skips outlet cross-check (`invoice_settlement.controller.ts`).
- **item.getAll** — nested `stockBalance` filter only applied when an outletId is present; item-sync without a header sums every outlet's stock. Match `getLowStockItems` rigor, or require the header.
- **Stock-fallback (QA)** — his branch returns `stockRow?.availableQuantity ?? 0` (was `stockRow ?? itemRow.stockQuantity ?? 0`); a missing `StockBalances` row now reads 0 → POS may block a sale.
- **FE Drift v17** — also backfills-to-1 (mis-attributes if real outlet id ≠ 1); `purchase_return` got app-layer outlet scoping but **no DB-level FK**.

---

## 6. Key files / evidence

| Purpose | File:line |
|---|---|
| JWT role (avjiang→admin) | `src/auth/auth.service.ts:506` |
| Super-admin `['*']` (avjiang + role id 1) | `src/auth/permission-cache.ts:44-45,65-66` |
| `/admin` role gate | `src/middleware/authorize-middleware.ts:39` |
| Outlet list/sync scoping (Set A targets) | `src/outlet/outlet.service.ts:11,61` |
| Outlet per-request authz (Set A target) | `src/middleware/outlet-authorization.middleware.ts:51,57` |
| allowedOutletIds source | `src/auth/auth.service.ts:485-489` |
| Create outlet (no auto-assign) | `src/admin/admin.service.ts:2680-2762` |
| Assign user↔outlet (admin-only today) | `src/admin/admin.service.ts:2942`; route `admin.controller.ts:773` |
| Permission-gate pattern (Set B) | `src/middleware/require-permission.middleware.ts`; usage `src/user/user.controller.ts:88` |
| Migration | `prisma/client/migrations/20260702000000_multi_outlet_fks_and_user_outlet/migration.sql` |
| Test fixture builder | `src/script/create_multi_outlet_test_tenant.ts` |

FE companion memory: `bayaryuk-frontend/.claude/memory/reference_multi_outlet_roles.md`.
