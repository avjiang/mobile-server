# Multi-Outlet — What Is Still Unbuilt

**Created:** 2026-10-14 (split from `MULTI_OUTLET.md`, retired the same day after the multi-outlet release went live on
prod on 2026-10-13; see git history for the original runbook).
**As built:** FE `docs/modules/OUTLET.md` (the one allow-list rule, data model, API, FE outlet selection) and FE
`.claude/memory/reference_multi_outlet_roles.md` (POS owner vs account owner).

## Status

| Item | State |
|---|---|
| Set A — account owner (Super Admin) outlet-unrestricted | ☐ not coded |
| Set B — account owner assigns staff to outlets from the app | ☐ not coded |
| BE-2 — header-less request → 400 instead of the primary-outlet default | ☐ not coded |
| 2-outlet fixture + E2E run | ☐ not done (no prod tenant has more than one outlet) |
| Backlog (§4) | ☐ tracked |

## Triggers

- **Set A + Set B:** before onboarding the first tenant with more than one outlet, or when an owner needs to manage staff
  outlets themselves. Safe to ship any time: while every tenant is single-outlet, Set A only grants access the owner is
  meant to have and Set B is additive.
- **BE-2:** before any tenant runs more than one outlet. Needs a released app that always sends `X-Outlet-ID` and a hard
  update wall first.
- **E2E (§3):** with Set A/B, before the first multi-outlet tenant.

---

## 1. Set A — the account owner is outlet-unrestricted

Today `resolveAllowedOutletIds` (`src/api-helpers/outlet-access.ts`) bypasses only JWT `role === "admin"` (the platform
account `avjiang`). The account owner (role id 1, `permissions ['*']`, JWT `role "user"`) is scoped like staff. Intended
model (confirmed 2026-07-07): the account owner controls every outlet of their own tenant automatically; `user_outlet`
only scopes staff.

1. New helper `src/helpers/authz.ts`:
   ```ts
   import { UserInfo } from "../middleware/authorize-middleware";
   /** True when the caller may use EVERY outlet in their own tenant DB:
    *  POS owner (role "admin") or account owner / Super Admin (permissions wildcard '*').
    *  Tenant isolation is inherent (getTenantPrisma(token.databaseName)), so never cross-tenant. */
   export const isOutletUnrestricted = (user?: UserInfo): boolean =>
       !!user && (user.role === "admin" || (user.permissions?.includes("*") ?? false));
   ```
2. In `resolveAllowedOutletIds`, replace `if (user.role === "admin") return null;` with
   `if (isOutletUnrestricted(user)) return null;`. Every gate (`requireOutletAccess`, `/outlet` + `/outlet/sync`,
   `assertOutletsAllowed`) goes through it, so this is the only change.

Effect: the owner sees and uses every outlet, including ones created later, so `createOutletForTenant` needs no
auto-assign. Staff are unchanged. Rollback: revert the commit (no schema change).

## 2. Set B — the account owner assigns staff to outlets

Today assignment is `/admin`-only (`GET/POST/DELETE /admin/tenants/:tenantId/users/:userId/outlets`). Add tenant-scoped
routes to the `/user` module, gated like `src/user/user.controller.ts`'s existing `requirePermission` usage:

```ts
router.get('/:id/outlets',  requirePermission(PERMISSION.MANAGE_USERS), getUserOutlets)
router.post('/:id/outlets', requirePermission(PERMISSION.MANAGE_USERS), assignUserOutlets)
router.delete('/:id/outlets/:outletId', requirePermission(PERMISSION.MANAGE_USERS), removeUserOutlet)
```

Thin functions in `src/user/user.service.ts` working on **tenant-DB ids** from the token (`req.user.databaseName`), mirroring
the upsert in `admin.service.ts` `assignUserOutlets`; validate `outletIds` in `src/user/user.request.ts`. Keep the `/admin`
endpoints for the POS owner. FE: an outlet-assignment control on the user detail/edit screen.

Out of scope here, tracked as tech debt: replacing the `username === "avjiang"` hardcode (`auth.service.ts`) with a real
platform-owner flag; app-facing staff creation (`POST /user` does not exist; staff are created with
`/admin/createTenantUser`).

## 3. 2-outlet fixture + E2E

No fixture script exists (`create_multi_outlet_test_tenant.ts` was planned but never committed). Build one locally:
create a tenant with `src/script/create_test_tenant.ts`, add Outlet B via `POST /admin/tenants/:tenantId/outlets`, create a
cashier via `POST /admin/createTenantUser/:tenantId`, assign outlets via `POST /admin/tenants/:tenantId/users/:userId/outlets`
(owner → A+B, cashier → A only). Run against a local server, never prod:

1. Owner → `GET /outlet` returns both outlets (via Set A, even if `user_outlet` only has A).
2. Owner with `X-Outlet-ID: 2` → allowed; reads and writes in Outlet B work.
3. POS owner adds Outlet C via `/admin` → the owner sees C with no assignment.
4. Cashier → `GET /outlet` returns only A; `X-Outlet-ID: 2` → `403 Outlet access denied`.
5. Owner `POST /user/<cashierId>/outlets {outletIds:[2]}` → cashier sees A+B (Set B).
6. Regression: a single-outlet tenant behaves as before.

Then `npx tsc --noEmit` + FE `flutter analyze`.

## 4. Backlog (from the 2026-09 merge audit; not blocking while every tenant is single-outlet)

- **BE-2 — primary-outlet default.** `requireOutletAccess` (`src/middleware/outlet-authorization.middleware.ts`) defaults a
  request with no outlet (or `0`) to the caller's primary outlet. Turn it into a 400 once the released app always sends
  `X-Outlet-ID`.
- **M2** — FE `_filterByAllowed` degrades open (empty allow-list → all cached outlets). Right for the owner after Set A,
  wrong for staff: scope it to non-super-admins.
- **M3** — FE read cache on outlet switch. Largely addressed (Drift reads filter by the selected outlet; sync cursors are
  keyed per user + outlet in `sync_timestamp_manager.dart`); re-check on the 2-outlet fixture.
- **`item.getAll`** — the nested `stockBalance` filter applies only when an outlet id is present; an item sync without the
  header sums every outlet's stock. Match `getLowStockItems` or require the header.
- **Stock fallback (QA)** — a missing `StockBalances` row reads as 0 (`stockRow?.availableQuantity ?? 0`), so the POS may
  block a sale; confirm on the fixture.
- **`purchase_return`** — outlet scoping is app-layer only; no DB-level FK (not in the migration's nine tables).
- **Stale doc pointers in code comments** — `outlet-authorization.middleware.ts`, `outlet-helper.ts`, `auth.service.ts`
  cite `docs/future/OUTLET_MERGE_AUDIT.md`; `stock-transfer.service.ts` and FE `warehouse_transfer_screen.dart` cite
  `MULTI_OUTLET_BE.md §10`. Neither file exists; point them at FE `docs/modules/OUTLET.md` with the next code change there.
- Per-outlet pricing / promotions / recipes stay deferred until the business asks (FE `docs/modules/OUTLET.md` §11).
