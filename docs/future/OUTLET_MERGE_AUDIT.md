# Multi-Outlet Merge Audit — `feature/outlet-sprint006-merge` (FE + BE)

**Audit date:** 2026-07-04 · **Recovered/rewritten:** 2026-07-07
**Scope:** peer's multi-outlet feature merged onto sprint-006 — FE ~137 files/~6.9k lines, BE ~48 files/~1.75k lines incl. a Prisma migration.
**Method:** 6 parallel review agents; every CRITICAL/HIGH claim verified in-code (not taken on an agent's word).
**Decision on record (2026-07-04):** *Fix P0+P1 (ours + his)*. Merge `main` in first — **done** (`main` merged into both repos, semantic `outletID`→`outletId` collision fixed, FE `analyze` 0 / BE `tsc` clean).

> **Status: all P0 + P1 fixed (2026-07-07)** on branch `fix/multi-outlet-audit-p0p1` (both repos), merged into `feature/outlet-sprint006-merge`. BE `tsc --noEmit` clean; FE `flutter analyze` 0 errors. Remaining P2/MEDIUM/LOW items (below) are tracked, not yet done. ⚠️ The rewritten migration (BE-1) still needs a dry-run against a copy of a real prod tenant DB before deploy.

---

## Did it mess up our work?

**No — the merge is clean.** All sprint-006 changes survived intact and additive (contact resolution + per-sale contact edit, supply cascade cleanup, editable consumption + iOS push, BE supply→recipe cascade, `PUT /sales/:salesId/contact`). No dropped changes, no reverts-via-conflict, no double-execution. Only two of his changes reach into our code — **BE nothing; FE H1 (offline replay) and M1 (dead-code revert)** below.

---

## 🔴 P0 — CRITICAL (must fix before any deploy)

### BE-1. Migration not prod-safe — `prisma/client/migrations/20260702000000_multi_outlet_fks_and_user_outlet/migration.sql`
- **Hardcoded `OUTLET_ID = 1`** seed behind a RESTRICT FK (lines 27–31). Each tenant DB's outlet has an **auto-increment local `ID`, not guaranteed 1** → FK error 1452 → whole migration aborts for any tenant whose primary outlet ≠ 1.
- **9 RESTRICT FKs over already-populated tables** (`sales`, `payment`, `session`, `invoice`, `delivery_order`, `quotation`, `purchase_order`, `register_log`, `menu_profile_outlet`), **no orphan pre-check** (lines 50–88). Any historical row whose `OUTLET_ID` doesn't resolve → abort.
- **Not idempotent** — no `IF NOT EXISTS`/existence guards on constraints → a retry after partial failure dies on "duplicate constraint."
- **Fix:** resolve real primary outlet per tenant (`SELECT MIN(ID) … WHERE IS_DELETED=false`), seed against it; repair-or-fail orphans before FKs; add idempotency guards. **DECISION NEEDED: orphan strategy — fail-loud vs auto-repoint to primary.**

### BE-2. Outlet enforcement breaks the *currently-released* app on deploy
- Controllers hard-require `X-Outlet-ID` via `requireOutletHeader()` on `role`, `session`, `item`, `stock`, `invoice`, `PO`, `PR`, `quotation`, `delivery`, several sales mutations (400 if absent). His FE sends it; the **released binary does not** → 400s role sync, session open, checkout, stock, doc edits for every not-yet-updated user.
- **Fix: DECISION NEEDED — hard force-update wall, OR make header optional server-side defaulting to the tenant's primary outlet on pre-outlet endpoints (safer, no lockstep).**

### BE-3. `/account/accountDetails` silently reinterprets the `outletId` id-space (`account.service.ts`, `0582ce5`)
- Now treats request `outletId` as tenant-local `outlet.id`, 404s if unmatched; released app sends the **global** `tenant_outlet` id → account/subscription screen breaks. **Fix: version-gate or revert the id-space change.**

### BE-4. 7 cross-outlet IDOR read leaks (`findUnique({where:{id}})` — no outletId; write paths already scoped)
Fix each: `findUnique`→`findFirst({where:{id, outletId: req.outletId}})` + thread outletId through controller.
1. `sales.getById` — `sales.service.ts:1411`
2. `session.getSessionByID` (+`getDeclarationsBySessionID`) — `session.service.ts:29,6`
3. `invoice.getById` — `invoice.service.ts:413`
4. `purchaseOrder.getById` — `purchase-order.service.ts:425`
5. `quotation.getById` — `quotation.service.ts:431`
6. `deliveryOrder.getById` — `delivery-order.service.ts:234`
7. `purchaseReturn.getById` — `purchase-return.service.ts:145`

### FE-5. Laundry pickup queue leaks across outlets — `sales_repository.dart:238,262,278`
`listPendingPickups`/`searchLocalForPickup` filter only on `collectedAt`/`orderRef` (no `outletId`); `upsertSalesHistoryFromSale` writes no `outletId`. Multi-outlet laundry: outlet B sees outlet A's uncollected orders → wrong customer's laundry handed out. (Single-outlet unaffected.)

---

## 🟠 P1 — HIGH

- **H1 (ours). Offline contact-edit replays to the WRONG outlet** — `sync_worker.dart:212–217`. The `salesContact` outbox branch omits `outletId` (generic drain includes it). Queued in outlet A, drained in outlet B → replays as `X-Outlet-ID: B`. On our `30b636b` feature. **Fix: add `outletId: entry.outletId` to the salesContact replay.**
- **H2. `base_repository.dart` outlet getter uses `!`** — `getInt(SharedPrefsKeys.outletId)!` throws for any repo call before outlet selection (subscription/account screens ungated). **Fix: `…OrNull()` + graceful fail.**
- **H3. Stock sync not outlet-filtered** — `stock-balance.service.ts:30-41` `getAllStock` where is version/timestamp only, no `outletId` → FE pulls all outlets' `stock_balance`; if FE assumes one row/item → wrong/merged quantities. **Fix: scope to `req.outletId` (or confirm FE syncs-all-then-filters).**
- **H4. Pushy outlet-topic regression** — `auth.service.ts`/`role.service.ts` topic `outlet_1`→`outlet_{allowedOutletId}`; empty allow-list emits nothing; real id≠1 while old devices listen on `outlet_1` → silent notification loss.
- **H5. Duplicate imports** — `invoice_settlement_repository.dart:9,13` & `:7,14` (`starter_handler`, `constants`) → `duplicate_import` fails clean `flutter analyze`. Trivial.

---

## 🟡 P2 — MEDIUM / LOW (track, not blocking)

- **M1 (ours). Resurrected dead code** — `stock_repository.dart:55` re-adds `getStockMovementList()` + `Module.getStockCheckList` deleted in our `30e59e8`. Orphaned, would 404. Signal to diff his non-repo files for other stale reverts.
- **M2. `_filterByAllowed` degrades open** — empty allow-list returns all cached outlets (UI-only; server guards writes).
- **M3. Read-cache scoping asymmetry** — lists send `outletId` but local Drift master-data isn't outlet-keyed → stale rows until overwritten. Needs clear-on-switch or outlet-keyed cache decision.
- **M4. Settlement skips outlet cross-check** — `validateDocumentNumber(settlementNumber)` without `outletId` (`invoice_settlement.controller.ts:27,135`).
- **item.getAll unfiltered stock** — nested `stockBalance` filter applied only when outletId present; item-sync without header → sums every outlet's stock into virtual `stockQuantity`. Match `getLowStockItems` rigor or FE must always send header.
- **MEDIUM (QA). Stock-fallback removed** — his branch returns `stockRow?.availableQuantity ?? 0` (baseline: `stockRow ?? itemRow.stockQuantity ?? 0`); a missing `StockBalances` row now reads **0 stock** → POS may block sale. Active QA item.
- **L. FE Drift v17 migration** also backfills-to-1 (mis-attributes if real id≠1); `taxInvoiceNumber`/`friendlyNumber` non-unique. **`purchase_return`** got app-layer outletId scoping but **no DB-level FK** (omitted from the 10-table list).

---

## Pre-existing — NOT his fault, don't block
- `getTenantPrisma().$disconnect()` on shared cached client (agent "C6") — caching + 4 such calls already on sprint-006 baseline; Prisma reconnects. Latent debt.
- Client-minted document-number / TOCTOU and non-unique `friendlyNumber`/`taxInvoiceNumber` predate this feature (see H3 doc-number note).
- `sales.getByRef`/`collect` cross-outlet by design (QR pickup).

## Dangling reference
`MULTI_OUTLET_BE.md` is cited in many code comments but **not committed** to the branch.
