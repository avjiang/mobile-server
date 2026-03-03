# Loyalty Program & Subscription Packages — Implementation Plan

> Technical implementation spec for the engineering team. For product overview, see [loyalty-product-overview.md](loyalty-product-overview.md).

### Prerequisite: Custom Tenant Pricing

**[custom-tenant-pricing.md](custom-tenant-pricing.md) MUST be implemented BEFORE Phase 0 of this plan.**

Both plans modify the same cost calculation functions (`getTenantCost`, `buildCostSnapshot`, `getAllTenantCost`, `getUpcomingPayments`, `changeTenantPlan`) and the `CostSnapshot` type. Custom pricing is a simpler, contained change — implementing it first means Phase 0 writes the final merged version in one pass instead of refactoring already-modified code twice.

After custom pricing is in place, Phase 0H/0I in this plan will produce the **merged** result that includes both `customPrice ??` logic and `TenantAddOn` refactoring.

---

## Design Decisions (Agreed)

| Decision | Choice |
|---|---|
| Pricing model | Basic loyalty free in Pro plan; Advanced loyalty Rp 150,000 add-on |
| Validation | Server validates everything inside sales transaction |
| Point expiry | Batch FIFO (each earn has its own expiry date) |
| Subscription scope | Linked to product categories |
| Discount stacking | Sequential: existing discounts → tier % → point redemption → earn on final amount |
| Feature gating | JWT-based `loyaltyTier: 'none' | 'basic' | 'advanced'` |
| Loyalty scope | Tenant-wide (customers shared across outlets, points work at any outlet) |
| Points base | Earned on `totalAmount` (after ALL discounts including tier + point redemption) |
| Partial payment | Points awarded ONLY when sale status becomes "Completed", not on partial payment |
| Tier evaluation | Configurable: all-time cumulative OR rolling period (e.g., 365 days). Period-based enables auto-downgrade via monthly cron |
| Package purchase | Separate flow via `POST /subscription/subscribe` (not POS checkout). Earn points configurable via `earnPointsOnPackagePurchase` |
| Package stacking | One subscription per sale. Tier discount + one subscription + point redemption can coexist |
| Duplicate subscription | Same package cannot be active twice for same customer. Re-subscribe after expiry/cancellation allowed |
| Multiple programs | NOT allowed. One tenant = one loyalty program. Enforced at service level |
| Transaction archival | Monthly cron moves records older than 12 months to LoyaltyTransactionArchive table |
| Batch cleanup | Weekly cron soft-deletes depleted batches (remainingPoints = 0) older than 90 days |
| Add-on architecture | Tenant-scoped add-ons via `TenantAddOn` table (decoupled from per-outlet subscriptions) |
| Add-on discounts | Discounts do NOT apply to tenant add-ons (always full price) |
| Cost snapshot format | Separate `tenantAddOns` array alongside existing per-outlet `subscriptions` |
| Legacy junction table | Keep `TenantSubscriptionAddOn` table (empty, for future per-outlet add-ons), remove from all includes/queries |
| Concurrency control | Row-level lock via raw SQL `FOR UPDATE` on LoyaltyAccount reads during sales + optimistic locking (version field) as secondary guard |
| Point data type | Points are **integers** (whole points only). Fractional results from earn calculation use `Math.floor()`. Avoids dust accumulation |
| Loyalty monetary fields | All new Decimal fields on Sales use `@db.Decimal(15, 4)` to match existing Sales fields |
| Edit/delete locked sales | Sales with loyalty data (`pointsEarned > 0` OR `pointsRedeemed > 0` OR `subscriptionId != null`) cannot be edited or soft-deleted. Must void → recreate |
| Promotion vs loyalty | Promotions and loyalty are independent systems. Promotion `EXCLUSIVE` means "not with other promotions", NOT "not with loyalty". Tier discount always applies after promotions |
| Customer deletion cascade | Soft-deleting a customer also soft-deletes their LoyaltyAccount and cancels active CustomerSubscriptions |
| Timezone | All cron jobs run in UTC. `createdAt` on Sales is UTC. Period evaluation tolerance is ~1 day |
| JWT staleness | Loyalty tier in JWT may be stale up to 24h after add-on changes. Acceptable for V1 (takes effect on next login) |
| Custom pricing prerequisite | Custom tenant pricing (customPrice on TenantSubscription) implemented FIRST. Phase 0 assumes `customPrice` field already exists. Cost functions use `customPrice ?? subscriptionPlan.price` pattern |

## Gating Model

```
Basic/Trial plan  → loyaltyTier = 'none'     → +0 queries per sale
Pro, no add-on    → loyaltyTier = 'basic'    → +3 queries per sale
Pro + add-on      → loyaltyTier = 'advanced' → +4-6 queries per sale
```

**Basic loyalty** (Pro plan): Points earn, redeem, history, manual adjust, FIFO expiry
**Advanced loyalty** (add-on): Everything basic + membership tiers, auto-upgrade, tier discounts, point multipliers, subscription packages

---

## Phase 0: Add-On Architecture Refactor (TenantAddOn)

**Why this comes first**: The existing add-on system attaches tenant-scoped add-ons (user quota, device quota, warehouse) to a per-outlet `TenantSubscription` via the `TenantSubscriptionAddOn` junction table. This is architecturally wrong for tenant-wide resources — which outlet "owns" the extra user? The loyalty add-on (also tenant-wide) would compound this problem. With only 1 user in production, there's zero regression risk to fix this properly now.

### 0A. New Global DB Schema — `TenantAddOn`

Add to `prisma/global-client/schema.prisma`:

```prisma
model TenantAddOn {
  id        Int               @id @default(autoincrement()) @map("ID")
  tenantId  Int               @map("TENANT_ID")
  addOnId   Int               @map("ADD_ON_ID")
  quantity  Int               @default(1) @map("QUANTITY")
  createdAt DateTime          @default(now()) @map("CREATED_AT")
  updatedAt DateTime          @updatedAt @map("UPDATED_AT")
  tenant    Tenant            @relation(fields: [tenantId], references: [id])
  addOn     SubscriptionAddOn @relation(fields: [addOnId], references: [id])

  @@unique([tenantId, addOnId])
  @@index([tenantId])
  @@map("tenant_add_on")
}
```

Add relations to existing models:
- `Tenant`: add `tenantAddOns TenantAddOn[]`
- `SubscriptionAddOn`: add `tenantAddOns TenantAddOn[]`

### 0B. Add-On Constants

New file: `src/constants/add-on-ids.ts`

```typescript
export const ADD_ON_IDS = {
    EXTRA_USER: 1,
    EXTRA_DEVICE: 2,
    EXTRA_WAREHOUSE: 3,
    ADVANCED_LOYALTY: 4,
} as const;
```

Replaces all hardcoded add-on IDs scattered across 8+ places in the codebase.

### 0C. Seed Update — Add Loyalty Add-On

File: `src/script/subscription_add_on_seed.ts`

Add 4th add-on:
```typescript
{
    name: "Advanced Loyalty",
    addOnType: "feature",
    pricePerUnit: 150000,
    maxQuantity: 1,
    scope: "tenant",
    description: "Advanced loyalty features: tiers, multipliers, subscription packages"
}
```

### 0D. Data Migration Script

New file: `src/script/migrate_addon_to_tenant.ts`

Migrates existing `TenantSubscriptionAddOn` records to `TenantAddOn`:
```
1. Query all TenantSubscriptionAddOn records with their TenantSubscription (to get tenantId)
2. For each record:
   - Upsert into TenantAddOn (tenantId, addOnId, quantity)
   - If same tenantId+addOnId exists from multiple outlets, SUM the quantities
3. Log migration results
4. Do NOT delete TenantSubscriptionAddOn records (table kept for future)
```

### 0E. Refactor `getPrimarySubscription()`

File: `src/admin/admin.service.ts` (lines 33-70)

Current: Loads all outlets with subscriptions + `subscriptionAddOn` includes.
After: Remove `subscriptionAddOn: true` from the include. The function still returns primary subscription (needed for plan info), but add-ons are no longer attached to it.

```typescript
// BEFORE
include: {
    subscriptionPlan: true,
    subscriptionAddOn: true    // REMOVE
}

// AFTER
include: {
    subscriptionPlan: true
}
```

### 0F. Refactor Admin Add-On Functions (7 functions)

All in `src/admin/admin.service.ts`. Each function currently operates on `TenantSubscriptionAddOn` via primary subscription. Refactor to operate on `TenantAddOn` directly by `tenantId`.

| # | Function | Lines | Current Behavior | New Behavior |
|---|---|---|---|---|
| 1 | `createTenantUser()` | ~676-732 | Create/update `TenantSubscriptionAddOn` (ID 1) on primary subscription | Upsert `TenantAddOn` (tenantId, ADD_ON_IDS.EXTRA_USER) |
| 2 | `deleteTenantUser()` | ~829-889 | Update/delete `TenantSubscriptionAddOn` (ID 1) | Update/delete `TenantAddOn` (tenantId, ADD_ON_IDS.EXTRA_USER) |
| 3 | `addDeviceQuotaForTenant()` | ~932-991 | Create/update `TenantSubscriptionAddOn` (ID 2) | Upsert `TenantAddOn` (tenantId, ADD_ON_IDS.EXTRA_DEVICE) |
| 4 | `reduceDeviceQuotaForTenant()` | ~995-1117 | Update/delete `TenantSubscriptionAddOn` (ID 2) | Update/delete `TenantAddOn` (tenantId, ADD_ON_IDS.EXTRA_DEVICE) |
| 5 | `createWarehouseForTenant()` | ~1312-1384 | Create/update `TenantSubscriptionAddOn` (ID 3) in transaction | Upsert `TenantAddOn` (tenantId, ADD_ON_IDS.EXTRA_WAREHOUSE) |
| 6 | `deleteWarehouseForTenant()` | ~1454-1516 | Update/delete `TenantSubscriptionAddOn` (ID 3) | Update/delete `TenantAddOn` (tenantId, ADD_ON_IDS.EXTRA_WAREHOUSE) |
| 7 | `handleDowngradeToBasic()` | ~1564-1629 | Deletes device (ID 2) + warehouse (ID 3) `TenantSubscriptionAddOn` records | Delete `TenantAddOn` records for (tenantId, [ID 2, ID 3, ID 4]) — also removes loyalty add-on on downgrade |

**Bug fix in `changeTenantPlan()`** (~lines 1636-1830): Upgrade path creates/reactivates warehouse but doesn't create the warehouse add-on record. Fix by adding `TenantAddOn` upsert alongside warehouse creation.

**Integration with custom pricing** in `changeTenantPlan()`: The custom pricing plan already adds `customPrice: null, customPriceNote: null` clearing + `CustomPriceLog` audit entry in the subscription update loop (~line 1774). Phase 0F adds the `TenantAddOn` cleanup for downgrade. Both happen in the same function but in different parts:
- Custom pricing: inside the subscription update loop (per-outlet)
- Loyalty: after the loop, at tenant level (TenantAddOn deleteMany for downgrade)

### 0G. Refactor Device Service (3 functions)

File: `src/pushy/device.service.ts`

| # | Function | Lines | Current Behavior | New Behavior |
|---|---|---|---|---|
| 1 | `checkDeviceLimit()` | ~25-116 | Multi-outlet loop: sums `maxDevices` from each outlet's subscription + `TenantSubscriptionAddOn` (ID 2) | Single query: plan `maxDevices` × outlet count + `TenantAddOn` quantity for (tenantId, ADD_ON_IDS.EXTRA_DEVICE) |
| 2 | `purchaseAdditionalDevice()` | ~230-332 | Searches add-on by **name** (inconsistent). Creates `TenantSubscriptionAddOn` on primary subscription | Upsert `TenantAddOn` (tenantId, ADD_ON_IDS.EXTRA_DEVICE) — uses constant, not name |
| 3 | `removeAdditionalDevice()` | ~334-402 | Searches by hardcoded ID 2. Reduces/deletes `TenantSubscriptionAddOn` | Update/delete `TenantAddOn` (tenantId, ADD_ON_IDS.EXTRA_DEVICE) |

**Bug fix**: `purchaseAdditionalDevice()` searches by name `'Push Notification Device'` but `removeAdditionalDevice()` uses hardcoded ID 2. Standardize to `ADD_ON_IDS.EXTRA_DEVICE`.

**Bug fix**: `checkDeviceLimit()` checks status `['Active', 'active', 'trial']` but `allocateDevice()` checks only `'Active'`. Standardize status checks.

### 0H. Refactor Cost Calculation (merged with Custom Pricing)

File: `src/admin/admin.service.ts`

**Assumes custom pricing is already implemented** — `customPrice` and `customPriceNote` fields exist on `TenantSubscription`. All functions below already use `customPrice ?? subscriptionPlan.price` for base plan cost. Phase 0H only changes the **add-on cost source** (TenantSubscriptionAddOn → TenantAddOn).

**`getTenantCost()`** (~lines 283-454):
- Before Phase 0: `basePlanCost = subscription.customPrice ?? subscription.subscriptionPlan.price` (custom pricing already applied) + add-on costs from `subscription.subscriptionAddOn`
- After Phase 0: Same `basePlanCost` formula (unchanged). Add-ons queried separately via `TenantAddOn` with `include: { addOn: true }`. Add-on cost = `SUM(quantity × addOn.pricePerUnit)`. Discounts do NOT apply to add-ons.

**`getAllTenantCost()`** (~lines 456-609):
- Before Phase 0: Raw SQL already uses `COALESCE(ts.CUSTOM_PRICE, sp.PRICE)` (custom pricing) + 6 correlated subqueries on `TENANT_SUBSCRIPTION_ADD_ON`
- After Phase 0: Keep `COALESCE(ts.CUSTOM_PRICE, sp.PRICE)`. Replace `TENANT_SUBSCRIPTION_ADD_ON` subqueries with `TENANT_ADD_ON` join grouped by `TENANT_ID`.

**`getUpcomingPayments()`** (~lines 2371-2456):
- Before Phase 0: Raw SQL already uses `COALESCE(ts.CUSTOM_PRICE, sp.PRICE)` + subquery on `tenant_subscription_add_on`
- After Phase 0: Keep `COALESCE(ts.CUSTOM_PRICE, sp.PRICE)`. Replace `tenant_subscription_add_on` subquery with `tenant_add_on` join.

**`getTenantBillingSummary()`** (~lines 2187-2274):
- Before Phase 0: Already uses `customPrice ?? subscriptionPlan.price` + per-subscription add-on costs
- After Phase 0: Same base formula. Add-on costs from `TenantAddOn` instead.

### 0I. Refactor Cost Snapshot (merged with Custom Pricing)

File: `src/admin/admin.service.ts`

**`buildCostSnapshot()`** (~lines 1855-1900) and **`recordPayment()`** (~lines 1933-2055):

**Merged** `CostSnapshot` format (update `admin.response.ts`) — includes BOTH custom pricing audit fields AND tenantAddOns restructure:
```typescript
interface CostSnapshot {
    subscriptions: Array<{
        outletId: number
        outletName: string
        planName: string
        planPrice: number                // effective price = customPrice ?? standardPrice
        isCustomPrice: boolean           // from custom pricing
        standardPlanPrice: number        // from custom pricing (always the plan's base price)
        customPriceNote?: string         // from custom pricing (admin-entered reason)
        discountPercentage?: number
        discountedPrice?: number
    }>
    tenantAddOns: Array<{                // from loyalty Phase 0 (replaces old per-subscription addOns)
        addOnId: number
        addOnName: string
        quantity: number
        pricePerUnit: number
        totalPrice: number               // quantity × pricePerUnit (no discount)
    }>
    totalAmount: number
}
```

**Note**: The old `CostSnapshot` had a flat structure with a single `basePlanCost` + `addOns` array. The new structure has:
- `subscriptions[]` — per-outlet breakdown (supports multi-outlet mixed pricing)
- `tenantAddOns[]` — tenant-wide add-ons (decoupled from per-outlet subscriptions)
- Custom pricing fields (`isCustomPrice`, `standardPlanPrice`, `customPriceNote`) inside each subscription entry

Historical cost snapshots (pre-migration) have the old format. Payment display code must handle both formats (check for `subscriptions` array presence).

### 0J. Remove `subscriptionAddOn` from All Includes/Queries

Remove `subscriptionAddOn: true` or `subscriptionAddOn: { include: { addOn: true } }` from every Prisma query that includes it. The `TenantSubscriptionAddOn` table stays in the schema but is no longer queried.

Files to check:
- `src/admin/admin.service.ts` — `getPrimarySubscription()`, `getTenantCost()`, `buildCostSnapshot()`, `recordPayment()`, `getTenantBillingSummary()`
- `src/auth/auth.service.ts` — `getTenantSubscriptionInfo()`
- Any other file that includes `subscriptionAddOn` in Prisma queries

### 0K. Existing Bugs to Fix During Refactor

| # | Bug | Location | Fix |
|---|---|---|---|
| 1 | Upgrade creates warehouse but no add-on record | `changeTenantPlan()` ~L1694-1771 | Add `TenantAddOn` upsert for warehouse |
| 2 | `purchaseAdditionalDevice()` searches by name, others use ID | `device.service.ts` L269 | Use `ADD_ON_IDS.EXTRA_DEVICE` constant |
| 3 | Status filter inconsistency: `['Active', 'active', 'trial']` vs `'Active'` | `device.service.ts` L37 vs L127 | Standardize to `['Active', 'active', 'trial']` |
| 4 | `maxQuantity` on SubscriptionAddOn never validated | All add-on creation functions | Add validation: `if (addOn.maxQuantity && newQty > addOn.maxQuantity) → reject` |
| 5 | Hardcoded add-on IDs in 8+ places | Multiple files | Replace with `ADD_ON_IDS` constants |

---

## Phase 1: Database Schema

### 1A. Tenant DB — New Tables

Add to `prisma/client/schema.prisma`:

**LoyaltyProgram** (1 per tenant — enforce single program at service level)
```
- id, name
- pointsPerCurrency    Decimal @db.Decimal(15, 4)  — earn rate (e.g., 0.0001 = 1 point per Rp 10,000)
- currencyPerPoint     Decimal @db.Decimal(15, 4)  — redeem rate (e.g., 1000 = 1 point = Rp 1,000)
- pointsExpiryDays     Int?    — null = no expiry
- minRedeemPoints      Int     @default(0)
- earnPointsOnPackagePurchase Boolean @default(true) — configurable: do package purchases earn points?
- tierEvaluationPeriodDays    Int?    — rolling window for tier evaluation (null = all-time cumulative, 365 = annual)
- isActive             Boolean @default(true)
- Cached in SimpleCacheService (5-min TTL)
```

**LoyaltyTier** (0-N per program) — ADVANCED ONLY
```
- id, loyaltyProgramId, name
- minSpend             Decimal @db.Decimal(15, 4)  — minimum spend threshold
- discountPercentage   Decimal @db.Decimal(15, 4)  — tier discount %
- pointsMultiplier     Decimal @db.Decimal(15, 4)  — earn rate multiplier (e.g., 1.5)
- sortOrder            Int
- Cached with program config
```

**LoyaltyAccount** (1 per customer per program)
```
- id, customerId, loyaltyProgramId
- currentPoints  Int @default(0)  — denormalized sum (whole points only)
- totalEarned    Int @default(0)  — lifetime points earned
- totalRedeemed  Int @default(0)  — lifetime points redeemed
- totalSpend     Decimal @default(0) @db.Decimal(15, 4) — lifetime spend
- periodSpend    Decimal @default(0) @db.Decimal(15, 4) — spend within current evaluation window
- periodStartDate DateTime?  — when the current evaluation window started
- loyaltyTierId (nullable), isManualTier Boolean @default(false)
- joinedAt DateTime @default(now())
- version  Int @default(1)  — for optimistic locking (used in concurrent redemption guard)
- UNIQUE(customerId, loyaltyProgramId)
- INDEX(loyaltyTierId)
```

**LoyaltyPointBatch** (for FIFO expiry)
```
- id, loyaltyAccountId
- originalPoints   Int  — points when batch was created
- remainingPoints  Int  — current remaining (decremented on redeem/expire)
- expiresAt        DateTime?  — null = never expires (restored points)
- earnedAt         DateTime @default(now())
- salesId          Int?  — null for manual adjustments or restored points
- INDEX(loyaltyAccountId, expiresAt) — for FIFO redemption queries
- INDEX(expiresAt, remainingPoints) — for expiry cron job
```

**LoyaltyTransaction** (audit log)
```
- id, loyaltyAccountId
- type: EARN / REDEEM / EARN_REVERSAL / REDEEM_REVERSAL / ADJUST / EXPIRE
  (6 types — EARN_REVERSAL and REDEEM_REVERSAL replace generic REFUND,
   because a void needs TWO reversals: undo the earn AND undo the redeem)
- points         Int       — positive for earn/restore, negative for redeem/expire
- balanceAfter   Int       — account.currentPoints after this transaction
- salesId (nullable), pointBatchId (nullable), description, performedBy
- deleted, deletedAt (soft delete)
- UNIQUE(salesId, type) — idempotency (allows EARN + REDEEM + EARN_REVERSAL + REDEEM_REVERSAL per sale)
- INDEX(loyaltyAccountId, createdAt)
```

**LoyaltyTransactionArchive** (same schema as LoyaltyTransaction, minimal indexes)
```
- Identical columns to LoyaltyTransaction
- Only index: PRIMARY KEY (id)
- No UNIQUE constraints (already validated when originally inserted)
- Populated by monthly archival cron (Phase 6E)
```

**SubscriptionPackage** (package definitions) — ADVANCED ONLY
```
- id, name, packageType (USAGE/TIME), price, totalQuota, quotaUnit
- durationDays, discountPercentage, discountAmount, validityDays, isActive
```

**SubscriptionPackageCategory** (junction) — ADVANCED ONLY
```
- id, subscriptionPackageId, categoryId
- UNIQUE(subscriptionPackageId, categoryId)
```

**CustomerSubscription** (customer enrollments) — ADVANCED ONLY
```
- id, customerId, subscriptionPackageId, status (ACTIVE/PAUSED/EXPIRED/CANCELLED)
- startDate, endDate, remainingQuota, usedQuota, paidAmount, packageSnapshot (JSON)
- version (optimistic locking)
- INDEX(customerId, status)
```

**SubscriptionUsage** (audit log) — ADVANCED ONLY
```
- id, customerSubscriptionId, salesId, quantityUsed, remainingAfter, performedBy
- UNIQUE(salesId, customerSubscriptionId) — idempotency
- INDEX(customerSubscriptionId, createdAt)
```

**Sales table modifications:**
```
+ loyaltyPointsEarned          Int?                          (whole points earned from this sale)
+ loyaltyPointsRedeemed        Int?                          (whole points redeemed in this sale)
+ loyaltyPointsRedemptionValue Decimal? @db.Decimal(15, 4)   (cash value of redeemed points)
+ loyaltyTierDiscountPercent   Decimal? @db.Decimal(15, 4)   (tier discount % applied)
+ loyaltyTierDiscountAmount    Decimal? @db.Decimal(15, 4)   (tier discount cash value)
+ customerSubscriptionId       Int?                          (subscription used, if any)
+ subscriptionDiscountAmount   Decimal? @db.Decimal(15, 4)   (subscription discount value, if time-based)

+ @@index([customerId])  — MISSING INDEX: needed for periodSpend recalculation and customer loyalty queries
```

**All new models must include standard fields:**
```
- deleted     Boolean @default(false)
- deletedAt   DateTime?
- createdAt   DateTime @default(now())
- updatedAt   DateTime @updatedAt
- version     Int? @default(1)
```

### 1B. Permission Seed

Add loyalty permissions to global Permission table:
```
- Manage Loyalty Program (create/edit program + tiers)
- View Loyalty Accounts (see balances & history)
- Adjust Loyalty Points (manual add/remove)
- Manage Subscription Packages (create/edit/delete packages)
- View Customer Subscriptions (see active subs)
- Manage Customer Subscriptions (subscribe/cancel)
```

---

## Phase 2: Infrastructure (JWT + Gating + Caching)

### 2A. Extend UserInfo Interface

File: `src/middleware/authorize-middleware.ts`
```typescript
export interface UserInfo {
    // ... existing fields
    loyaltyTier?: 'none' | 'basic' | 'advanced'
}
```

### 2B. Extend JWT Generation

File: `src/auth/auth.service.ts`

Modify `getTenantSubscriptionInfo()` to also return loyalty tier:
- Query `TenantAddOn` for the tenant: `WHERE tenantId = ? AND addOnId = ADD_ON_IDS.ADVANCED_LOYALTY`
- If planName !== 'Pro' → `'none'`
- If Pro + TenantAddOn exists for loyalty → `'advanced'`
- Otherwise Pro → `'basic'`
- Set on UserInfo in `generateJwtToken()`

This adds **1 simple query** (indexed by `@@unique([tenantId, addOnId])`) — no multi-outlet subscription scanning needed.

**JWT staleness note**: JWT has 1-day expiry (`auth.service.ts` line ~418). If admin adds/removes the loyalty add-on, users won't see the change until next login. Acceptable for V1 — admin UI should note: "Changes take effect when users log in again."

### 2C. Gating Middleware

New file: `src/middleware/loyalty-gate.middleware.ts`

```typescript
// requireLoyalty('basic') — requires at least basic loyalty (Pro plan)
// requireLoyalty('advanced') — requires advanced loyalty (add-on)
```

Applied to route groups in `src/index.ts`:
- `/loyalty/program`, `/loyalty/enroll`, `/loyalty/account/*` → requireLoyalty('basic')
- `/loyalty/tier/*` → requireLoyalty('advanced')
- `/subscription/*` → requireLoyalty('advanced')

### 2D. Caching

Use existing `SimpleCacheService` (file: `src/cache/simple-cache.service.ts`):

```
Key pattern: `loyalty:program:{tenantDb}:config` → LoyaltyProgram + tiers
Key pattern: `loyalty:packages:{tenantDb}:list` → SubscriptionPackage list
TTL: 5 minutes
Invalidate: on program/tier/package CRUD — use EXACT key delete, not pattern/substring match
```

**Important**: Cache keys must use a unique suffix (`:config`, `:list`) to prevent substring-based invalidation from accidentally clearing keys for other tenants (e.g., `tenant_1` vs `tenant_10`). Verify that `SimpleCacheService.invalidateByPattern()` uses exact prefix match, not substring contains.

---

## Phase 3: Basic Loyalty (points earn/redeem)

### 3A. Loyalty Module

New files:
- `src/loyalty/loyalty.controller.ts` — route handlers
- `src/loyalty/loyalty.service.ts` — business logic
- `src/loyalty/loyalty.request.ts` — request DTOs
- `src/loyalty/loyalty.response.ts` — response DTOs

### 3B. Endpoints (Basic — gated on Pro plan)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/loyalty/program` | Get program config (cached) |
| POST | `/loyalty/program` | Create program |
| PUT | `/loyalty/program/:id` | Update program (invalidate cache) |
| POST | `/loyalty/enroll` | Enroll customer |
| GET | `/loyalty/account/customer/:id` | Get customer points & balance |
| POST | `/loyalty/account/:id/earn` | Record points earned |
| POST | `/loyalty/account/:id/redeem` | Redeem points (FIFO batch deduction) |
| POST | `/loyalty/account/:id/adjust` | Manual adjustment |
| POST | `/loyalty/account/:id/refund` | Refund points (on void) |
| GET | `/loyalty/account/:id/transactions` | Point history (cursor-paginated) |

### 3C. FIFO Point Redemption Logic

```
1. Fetch point batches: WHERE loyaltyAccountId = ? AND remainingPoints > 0
   ORDER BY expiresAt ASC NULLS LAST, earnedAt ASC
2. Deduct from oldest batch first
3. If batch depleted (remainingPoints → 0), move to next
4. Update each touched batch
5. Update account.currentPoints via atomic decrement
6. Create REDEEM transaction
```

---

## Phase 4: Advanced Loyalty (tiers + subscriptions)

### 4A. Tier Management — gated on advanced add-on

Additional endpoints:
| Method | Endpoint | Description |
|---|---|---|
| POST | `/loyalty/tier` | Create tier |
| PUT | `/loyalty/tier/:id` | Update tier (invalidate cache) |
| DELETE | `/loyalty/tier/:id` | Soft-delete tier (reassign customers) |
| GET | `/loyalty/tier/program/:programId` | List tiers |
| PUT | `/loyalty/account/:id/tier` | Manual tier assignment |

### 4B. Tier Auto-Upgrade Logic

After each earn (fire-and-forget, post-transaction):
```
1. If account.isManualTier === true → skip
2. Fetch program config (cached) + tiers sorted by minSpend DESC
3. Determine qualifying spend:
   - If tierEvaluationPeriodDays is null → use account.totalSpend (all-time)
   - If tierEvaluationPeriodDays is set → use account.periodSpend (rolling window)
4. Find highest tier where qualifyingSpend >= minSpend
5. If higher than current tier → upgrade loyaltyTierId (immediate)
6. If lower than current tier → do NOT downgrade here (cron handles downgrades)
```

**Upgrade**: Immediate after sale (only upward).
**Downgrade**: Monthly cron only (see Phase 6C). Never downgrades in real-time — customer keeps their tier for the rest of the month.

**periodSpend maintenance**:
- On EARN: increment periodSpend
- On void/return/refund: decrement periodSpend
- Monthly cron recalculates periodSpend from Sales table to correct any drift

### 4C. Subscription Package Module — gated on advanced add-on

New files:
- `src/subscription-package/subscription-package.controller.ts`
- `src/subscription-package/subscription-package.service.ts`
- `src/subscription-package/subscription-package.request.ts`
- `src/subscription-package/subscription-package.response.ts`

Endpoints:
| Method | Endpoint | Description |
|---|---|---|
| GET | `/subscription/package` | List packages (cached) |
| POST | `/subscription/package` | Create package + link categories |
| PUT | `/subscription/package/:id` | Update package |
| DELETE | `/subscription/package/:id` | Soft-delete |
| POST | `/subscription/subscribe` | Subscribe customer (save packageSnapshot) |
| GET | `/subscription/customer/:id` | Get customer's subscriptions |
| POST | `/subscription/usage` | Record usage (with category validation) |
| PUT | `/subscription/cancel/:id` | Cancel subscription |

### 4D. Subscribe Endpoint — Duplicate Check + Point Earning

`POST /subscription/subscribe` handles:
```
1. Validate customer exists + is enrolled in loyalty
2. Duplicate check: Does customer have existing CustomerSubscription
   WHERE subscriptionPackageId = requested AND status IN ('ACTIVE', 'PAUSED') AND deleted = false?
   → If yes: reject with DuplicateSubscriptionError
3. Create CustomerSubscription (paidAmount, packageSnapshot, etc.)
4. If earnPointsOnPackagePurchase === true AND customer is enrolled:
   → Calculate points: paidAmount × pointsPerCurrency × tierMultiplier
   → Create LoyaltyPointBatch
   → Create EARN LoyaltyTransaction
   → Increment account.currentPoints, totalEarned, totalSpend, periodSpend
```

### 4E. Subscription Category Validation

When recording usage:
```
1. Read subscription + packageSnapshot + linked categories
2. Verify sale item's category is in applicableCategories
3. If not → reject with error
4. Verify remainingQuota >= 1 (with version check for optimistic locking)
5. Deduct quota atomically
```

---

## Phase 5: Sales Integration

### 5A. Sales Request Extension

File: `src/sales/sales.request.ts`

Add optional loyalty fields to sale request:
```typescript
loyaltyPointsToRedeem?: number         // Points customer wants to redeem
loyaltyPointsRedemptionValue?: number  // Cash value of redeemed points (client-calculated)
loyaltyTierDiscountPercentage?: number // Tier discount % applied
loyaltyTierDiscountAmount?: number     // Tier discount cash value (client-calculated)
customerSubscriptionId?: number        // Subscription to use
subscriptionQuantityUsed?: number      // Quota to deduct (usually 1)
subscriptionDiscountAmount?: number    // Time-based subscription discount value
```

Note: Package purchases go through `POST /subscription/subscribe` (separate flow, not POS checkout).
Point earning on package purchase is handled in the subscribe endpoint, gated by `earnPointsOnPackagePurchase`.

### 5B. Full Discount Stacking Order

```
Item-level discounts (existing, per-item)
    ↓
Promotion discounts (existing Promotion system — DAILY/HOURLY/GENERIC/CUSTOMER types)
    ↓
Sales-level manual discount (existing, % or fixed on subtotal)
    ↓
+ Service charge, tax, rounding (existing)
    ↓
= totalBeforeLoyalty (this is what the client sends as base)
    ↓
Tier discount % (advanced only, applied to totalBeforeLoyalty)
    ↓
Point redemption cash value (deducted after tier discount)
    ↓
= finalTotalAmount (customer pays this)
    ↓
Points earned on finalTotalAmount × pointsPerCurrency × tierMultiplier
    ↓
Point rounding: Math.floor() — customer earns whole points only
```

**Promotion vs Loyalty stacking rule**: The existing Promotion system (Promotion, PromotionItem, PromotionCustomer, PromotionUsage tables) has a `combinationRule` field (`STACKABLE` / `EXCLUSIVE`). This controls whether promotions stack with **other promotions** — it does NOT affect loyalty. Loyalty tier discounts and point redemption are a separate system and always apply on top of whatever the promotion engine produces. The two systems are independent.

Client calculates the full chain and sends `totalAmount` (= finalTotalAmount).
Server validates the loyalty parameters are legitimate but trusts the arithmetic
(consistent with how manual discounts work today — server stores, doesn't recalculate).

### 5C. Sales Service Integration — Hook Point 1: `completeNewSales()`

File: `src/sales/sales.service.ts` — inside `completeNewSales()` transaction (line ~649)

Insert loyalty block AFTER sale record creation, BEFORE stock updates.
**Only executes if sale status = "Completed"** (fully paid). Partially paid sales skip loyalty.

```
// ── Loyalty Block ──
const isFullyPaid = salesStatus === 'Completed'

if (user.loyaltyTier === 'none' || !customerId || !isFullyPaid) {
    // SKIP ENTIRELY — 0 extra queries
    // Partially Paid sales: loyalty deferred until full payment
} else {
    // 1. Fetch loyalty account WITH ROW LOCK (prevents concurrent double-spend)
    //    Prisma does not support SELECT ... FOR UPDATE natively.
    //    Use raw SQL inside the transaction:
    const [account] = await tx.$queryRaw`
        SELECT la.*, lt.discountPercentage, lt.pointsMultiplier, lt.name AS tierName
        FROM loyalty_account la
        LEFT JOIN loyalty_tier lt ON la.LOYALTY_TIER_ID = lt.ID AND lt.IS_DELETED = false
        WHERE la.CUSTOMER_ID = ${customerId} AND la.IS_DELETED = false
        FOR UPDATE
    `
    // FOR UPDATE locks the row until transaction commits/rollbacks.
    // A second concurrent sale for the same customer will WAIT here until the first completes.

    if (!account) → skip loyalty (customer not enrolled)

    // 2. VALIDATE tier discount (advanced only)
    if (user.loyaltyTier === 'advanced' && requestedTierDiscount > 0) {
        const program = getCached('loyalty:program:' + db)
        const tier = program.tiers.find(t => t.id === account.loyaltyTierId)
        if (!tier || tier.discountPercentage !== requestedTierDiscount) {
            → reject sale (tier discount mismatch)
        }
    }

    // 3. VALIDATE + EXECUTE point redemption
    if (pointsToRedeem > 0) {
        if (account.currentPoints < pointsToRedeem) → reject (InsufficientPointsError)
        → FIFO deduction from point batches
        → Create REDEEM transaction
        → Atomic decrement with version guard:
          UPDATE loyalty_account
          SET currentPoints = currentPoints - ?,
              totalRedeemed = totalRedeemed + ?,
              version = version + 1
          WHERE id = ? AND version = ? AND currentPoints >= ?
          // If affectedRows = 0 → concurrent modification detected → throw error
    }

    // 4. VALIDATE + EXECUTE subscription usage (advanced only)
    if (user.loyaltyTier === 'advanced' && subscriptionId) {
        → Read subscription with version check
        → Validate sale items' categories against subscription's linked categories
        → Validate remainingQuota >= quantityUsed
        → Atomic decrement quota (with version WHERE clause)
        → Create usage record
        → If remainingQuota hits 0 → set status = EXPIRED
    }

    // 5. EARN points (on finalTotalAmount, after ALL discounts)
    if (totalAmount > 0) {
        const program = getCached('loyalty:program:' + db)
        let pointsMultiplier = 1.0
        if (user.loyaltyTier === 'advanced' && account.loyaltyTier) {
            pointsMultiplier = account.loyaltyTier.pointsMultiplier
        }
        const pointsEarned = totalAmount * program.pointsPerCurrency * pointsMultiplier

        → Create point batch (with expiresAt = now + expiryDays if expiryDays set)
        → Create EARN transaction
        → Atomic increment with version guard:
          UPDATE loyalty_account
          SET currentPoints = currentPoints + ?,
              totalEarned = totalEarned + ?,
              totalSpend = totalSpend + ?,
              periodSpend = periodSpend + ?,
              version = version + 1
          WHERE id = ? AND version = ?
    }
}
// ── End Loyalty Block ──

// Post-transaction (fire-and-forget, non-blocking):
if (user.loyaltyTier === 'advanced' && customerId && isFullyPaid) {
    → Check tier auto-upgrade (compare totalSpend vs tier thresholds)
}
```

### 5D. Sales Service Integration — Hook Point 2: `addPaymentToPartiallyPaidSales()`

File: `src/sales/sales.service.ts` — line ~1202

When a "Partially Paid" sale becomes "Completed":
```
if (newStatus === 'Completed' && previousStatus === 'Partially Paid') {
    // Now run the SAME loyalty earn logic as Hook Point 1
    // Award points on the full totalAmount (not just the new payment)
    // Note: No point REDEMPTION here (that only happens at initial checkout)
    // Only EARNING — the customer gets points for the completed sale
}
```

### 5E. Sales Record — Store Loyalty Data

Save on the Sales record at creation time (even for partially paid):
```
loyaltyPointsEarned = pointsEarned (0 if partially paid, filled when completed)
loyaltyPointsRedeemed = pointsRedeemed
loyaltyPointsRedemptionValue = cashValueRedeemed
loyaltyTierDiscountPercent = tierDiscountPercentage
loyaltyTierDiscountAmount = tierDiscountCashValue
customerSubscriptionId = subscriptionId (if used)
subscriptionDiscountAmount = subDiscountValue (if time-based)
```

### 5F. Void / Return / Refund — Loyalty Reversal (THREE hooks)

Three separate flows need loyalty reversal. All follow the same pattern:

| Flow | Function | Line | New Status |
|---|---|---|---|
| Void | `voidSales()` | ~1280 | "Voided" |
| Return | `returnSales()` | ~1408 | "Returned" |
| Refund | `refundSales()` | ~1537 | "Refunded" |

**Common reversal logic (add to all three):**
```
if (user.loyaltyTier === 'none' || !sale.customerId) → skip

// 1. Reverse EARNED points
if (sale.loyaltyPointsEarned > 0) {
    → Find point batch by salesId
    → Deduct remainingPoints from batch (clamp to 0 if partially spent)
    → Create EARN_REVERSAL transaction (idempotent via UNIQUE salesId+type)
    → Atomic decrement account.currentPoints (clamp to 0)
    → Atomic decrement account.totalSpend by sale amount
}

// 2. Restore REDEEMED points
if (sale.loyaltyPointsRedeemed > 0) {
    → Create NEW point batch (no expiry — restored points don't expire)
    → Create REDEEM_REVERSAL transaction (idempotent via UNIQUE salesId+type)
    → Atomic increment account.currentPoints
}

// 3. Restore subscription quota (advanced only)
if (sale.customerSubscriptionId) {
    → Atomic increment remainingQuota on CustomerSubscription
    → If status was EXPIRED and quota now > 0 → set status = ACTIVE
    → Create negative SubscriptionUsage record for audit
}
```

**Cannot void/return/refund "Delivered" sales** — existing validation already prevents this (line ~1267).

### 5G. Block Edit/Delete of Loyalty-Processed Sales

Two existing functions can silently corrupt loyalty data. Both must be guarded:

**`update()` — sales.service.ts line ~998**

The `update()` function blindly writes whatever fields the client sends — no status check, no loyalty validation. A manager could change `totalAmount` or zero out `loyaltyPointsRedeemed` after points have been deducted from the customer's account.

**Guard logic (add at top of `update()`):**
```
const existingSale = await tx.sales.findUnique({ where: { id: sales.id } })
if (existingSale.loyaltyPointsEarned > 0
    || existingSale.loyaltyPointsRedeemed > 0
    || existingSale.customerSubscriptionId != null) {
    throw new BusinessLogicError(
        'Cannot edit a sale with loyalty data. Void and recreate instead.'
    )
}
```

**`remove()` — sales.service.ts line ~1025**

The `remove()` function soft-deletes a sale without any loyalty reversal. Points earned from a deleted sale remain on the customer's account. Also has a pre-existing bug: sets `deleted: true` but not `deletedAt`.

**Guard logic (add at top of `remove()`):**
```
const existingSale = await tx.sales.findUnique({ where: { id } })
if (existingSale.loyaltyPointsEarned > 0
    || existingSale.loyaltyPointsRedeemed > 0
    || existingSale.customerSubscriptionId != null) {
    throw new BusinessLogicError(
        'Cannot delete a sale with loyalty data. Void instead.'
    )
}

// Also fix pre-existing bug: set deletedAt
await tx.sales.update({
    where: { id },
    data: { deleted: true, deletedAt: new Date() }
})
```

**Why block instead of adding reversal logic?**
- `void()` / `return()` / `refund()` already have full reversal logic
- `update()` and `remove()` are generic operations with no reversal semantics
- Forcing users through void → recreate ensures consistent audit trail
- Simpler, fewer code paths, fewer bugs

### 5H. Split Bill — NOT SUPPORTED IN V1

SplitBill schema exists but has no service implementation.
For V1: Only the primary customer on `Sales.customerId` earns/redeems loyalty.
Future: Split proportional points based on SplitBill.amount per customer.

---

## Phase 6: Background Jobs

**Infrastructure**: `node-cron` already installed (package.json). No active crons exist.
Create `src/cron/cron-manager.ts` to initialize all cron jobs, called from `src/index.ts` after server starts.

**Timezone**: All cron schedules run in **UTC**. Pass `{ timezone: 'UTC' }` to `node-cron`. The global schema uses `UTC_TIMESTAMP()` and the tenant schema uses Prisma `now()` (which maps to MySQL `NOW()`). Period evaluation has ~1 day tolerance, so hour-level timezone offset is acceptable. Document that `Sales.createdAt` is server-local time.

### 6A. Point Expiry Cron (Daily, e.g., 2:00 AM)

```
1. Query global DB: Get tenant DBs where planName = 'Pro' AND status = 'Active'
   (Skip all Basic/Trial tenants — zero processing)

2. For each tenant DB:
   → Find batches WHERE expiresAt < NOW() AND remainingPoints > 0 AND deleted = false
   → For each batch (process in batches of 100):
     - Create EXPIRE transaction
     - Set remainingPoints = 0
     - Decrement account.currentPoints (atomic, clamp to 0)
   → Use cursor-based pagination to avoid loading all into memory
```

### 6B. Subscription Expiry Check (Daily, e.g., 2:30 AM)

Gated: Only tenant DBs with advanced loyalty add-on (check `TenantAddOn` for ADD_ON_IDS.ADVANCED_LOYALTY).

```
1. Find time-based subscriptions WHERE endDate < NOW() AND status = 'ACTIVE' AND deleted = false
2. Set status = 'EXPIRED'
```

### 6C. Tier Re-evaluation (Monthly, 1st of month, 3:00 AM)

**Mandatory for tenants with period-based tiers** (tierEvaluationPeriodDays is set).
Skip for tenants using all-time cumulative (tierEvaluationPeriodDays is null).

```
1. For each tenant with advanced loyalty + period-based evaluation:
   → Find accounts WHERE isManualTier = false AND deleted = false
   → For each account:
     a. Recalculate periodSpend = SUM(Sales.totalAmount)
        WHERE customerId = account.customerId
        AND status = 'Completed'
        AND deleted = false              ← IMPORTANT: exclude soft-deleted sales
        AND createdAt > NOW() - INTERVAL tierEvaluationPeriodDays DAY
     b. Update account.periodSpend with recalculated value (corrects any drift from void/return/refund)
     c. Compare against tier thresholds
     d. Upgrade OR downgrade to matching tier
   → Process in batches of 100 accounts
   → Log tier changes: "Customer 42: Gold → Silver (periodSpend: 2,100,000)"

NOTE: The query MUST filter `status = 'Completed' AND deleted = false`.
Voided/returned/refunded/deleted sales must NOT count toward periodSpend.
This recalculation also corrects any drift from inline periodSpend increments/decrements.
```

### 6D. Point Batch Cleanup (Weekly, e.g., Sunday 3:00 AM)

Keeps `LoyaltyPointBatch` table lean. Depleted batches have zero operational value — the audit trail is in `LoyaltyTransaction`.

```
1. For each tenant DB (Pro plan):
   → Soft-delete batches WHERE remainingPoints = 0
     AND deleted = false
     AND updatedAt < NOW() - INTERVAL 90 DAY
   → Process in batches of 500
   → Log: "Cleaned X depleted batches for tenant Y"

2. Table growth estimate (with cleanup):
   - Active rows: ~365 per customer (1 per purchase day, 365-day expiry)
   - Soft-deleted rows excluded from all operational queries
   - Further hard-delete of soft-deleted rows > 1 year old (optional, future)
```

### 6E. Transaction Archival (Monthly, 1st of month, 4:00 AM)

Moves old `LoyaltyTransaction` records to `LoyaltyTransactionArchive` to keep the main table lean.

```
Schema: LoyaltyTransactionArchive — identical to LoyaltyTransaction, minimal indexes

1. For each tenant DB (Pro plan):
   → INSERT INTO LoyaltyTransactionArchive
     SELECT * FROM LoyaltyTransaction
     WHERE createdAt < NOW() - INTERVAL archiveAfterDays DAY (default: 365)
   → DELETE FROM LoyaltyTransaction
     WHERE createdAt < NOW() - INTERVAL archiveAfterDays DAY
   → Process in batches of 1000
   → Log: "Archived X transactions for tenant Y"

2. Impact:
   - Main table: only holds last 12 months (~365K rows max for busy tenant)
   - Archive table: no indexes except primary key (cheap storage)
   - Customer-facing point history API queries main table only (fast)
   - Admin audit queries can optionally include archive (rare, slower is OK)
```

---

## Phase 7: Customer Lookup + Deletion Integration

File: `src/customer/customer.service.ts`

### 7A. Customer Lookup (cashier selects customer)

```
if (loyaltyTier === 'none') {
    // Return customer as-is. No loyalty joins.
} else if (loyaltyTier === 'basic') {
    // Include: loyaltyAccount { currentPoints, totalEarned, totalSpend }
} else {
    // Include: loyaltyAccount { currentPoints, loyaltyTier, totalSpend }
    //        + activeSubscriptions with packageSnapshot
}
```

This is a separate API call, not in the sales transaction.

**Pre-existing bug fix**: `getAll()` currently returns deleted customers (no `deleted: false` filter). Add `WHERE deleted = false` to customer list queries.

### 7B. Customer Deletion Cascade

When a customer is soft-deleted (`customer.service.ts` `remove()` function):

```
// Inside the same transaction that soft-deletes the customer:

if (user.loyaltyTier !== 'none') {
    // 1. Soft-delete their LoyaltyAccount
    await tx.loyaltyAccount.updateMany({
        where: { customerId, deleted: false },
        data: { deleted: true, deletedAt: new Date() }
    })

    // 2. Cancel active subscriptions (advanced only)
    if (user.loyaltyTier === 'advanced') {
        await tx.customerSubscription.updateMany({
            where: {
                customerId,
                status: { in: ['ACTIVE', 'PAUSED'] },
                deleted: false
            },
            data: { status: 'CANCELLED', updatedAt: new Date() }
        })
    }

    // 3. Do NOT delete LoyaltyTransaction or LoyaltyPointBatch records
    //    (audit trail must survive customer deletion)
}

// Also fix pre-existing bug: set deletedAt on customer
await tx.customer.update({
    where: { id: customerId },
    data: { deleted: true, deletedAt: new Date() }
})
```

**Why soft-delete, not hard-delete?** Loyalty transactions reference the account. Hard-deleting the account would orphan audit records. Soft-deleted accounts are excluded from all operational queries by the standard `deleted = false` filter. Cron jobs (expiry, tier re-evaluation) also skip `deleted = true` accounts.

---

## Phase 8: Session Reporting Integration

File: `src/sales/sales.service.ts` — `getTotalSalesData()` (line ~1052)

Add loyalty metrics to session summary (used at session close):
```
- totalLoyaltyPointsEarned: SUM(loyaltyPointsEarned) for active sales in session
- totalLoyaltyPointsRedeemed: SUM(loyaltyPointsRedeemed) for active sales in session
- totalLoyaltyDiscountAmount: SUM(loyaltyTierDiscountAmount) for active sales in session
- totalSubscriptionUsages: COUNT where customerSubscriptionId is not null
```

Gated: Only compute these SUMs if `user.loyaltyTier !== 'none'`.

---

## File Change Summary

### New Files (19)
```
src/constants/add-on-ids.ts                      — Centralized add-on ID constants
src/script/migrate_addon_to_tenant.ts            — Data migration: TenantSubscriptionAddOn → TenantAddOn
src/script/loyalty_permission_seed.ts            — Loyalty permission seed
src/script/loyalty_add_on_seed.ts                — (merged into subscription_add_on_seed.ts update)
src/loyalty/loyalty.controller.ts                — Loyalty route handlers
src/loyalty/loyalty.service.ts                   — Loyalty business logic
src/loyalty/loyalty.request.ts                   — Loyalty request DTOs
src/loyalty/loyalty.response.ts                  — Loyalty response DTOs
src/subscription-package/subscription-package.controller.ts
src/subscription-package/subscription-package.service.ts
src/subscription-package/subscription-package.request.ts
src/subscription-package/subscription-package.response.ts
src/middleware/loyalty-gate.middleware.ts         — Feature gating middleware
src/cron/cron-manager.ts                         — Cron job initialization
src/cron/loyalty-expiry.cron.ts                  — Daily point expiry
src/cron/subscription-expiry.cron.ts             — Daily subscription expiry
src/cron/batch-cleanup.cron.ts                   — Weekly depleted batch cleanup
src/cron/tier-evaluation.cron.ts                 — Monthly tier re-evaluation (upgrade + downgrade)
src/cron/transaction-archival.cron.ts            — Monthly transaction archival
```

### Modified Files (15)
```
prisma/global-client/schema.prisma               — New TenantAddOn table + Tenant/SubscriptionAddOn relations (custom pricing already added customPrice/CustomPriceLog)
prisma/client/schema.prisma                      — New loyalty/subscription tables + Sales fields + @@index([customerId]) on Sales
src/admin/admin.service.ts                       — Phase 0 refactor (7 add-on functions + cost calc + snapshot + remove subscriptionAddOn includes). Merges with custom pricing changes already in place
src/admin/admin.controller.ts                    — (custom pricing already added setCustomPrice route)
src/admin/admin.response.ts                      — CostSnapshot type update: merged tenantAddOns array + custom pricing audit fields (isCustomPrice, standardPlanPrice, customPriceNote)
src/account/account.service.ts                   — (custom pricing already added isCustomPrice/standardPlanPrice to account details)
src/account/account.response.ts                  — (custom pricing already added optional fields to OutletDetailsResponse)
src/pushy/device.service.ts                      — Phase 0 refactor (3 functions: checkDeviceLimit, purchase, remove)
src/auth/auth.service.ts                         — JWT generation with loyaltyTier (via TenantAddOn query)
src/middleware/authorize-middleware.ts            — UserInfo interface + loyaltyTier
src/sales/sales.service.ts                       — Loyalty in completeNewSales(), addPayment(), void, return, refund, getTotalSalesData() + block edit/delete of loyalty sales + fix deletedAt bug
src/sales/sales.request.ts                       — Loyalty fields on sale request
src/customer/customer.service.ts                 — Include loyalty data on customer fetch + deletion cascade to loyalty + fix getAll() deleted filter + fix deletedAt bug
src/index.ts                                     — Register loyalty + subscription routes + cron init
src/script/subscription_add_on_seed.ts           — Add 4th add-on (Advanced Loyalty)
src/api-helpers/error.ts                         — Add LoyaltyError classes (InsufficientPointsError, TierMismatchError, SubscriptionExpiredError, DuplicateSubscriptionError)
```

**Note**: Files marked "(custom pricing already added ...)" are modified by the custom pricing prerequisite. Phase 0 builds on those changes.

---

## Gaps Identified & Addressed (Deep Analysis)

| # | Gap Found | Resolution |
|---|---|---|
| 1 | **Partial payment sales** — plan didn't address when points are awarded for credit sales | Points ONLY awarded when sale status = "Completed". Added Hook Point 2 in `addPaymentToPartiallyPaidSales()` |
| 2 | **3 reversal flows, not 1** — plan only mentioned void, but return + refund also need reversal | All three (void/return/refund) now have loyalty reversal. Same logic, three hook points |
| 3 | **REFUND transaction type collision** — a single sale can have both EARN and REDEEM, so voiding needs TWO reversal records. UNIQUE(salesId, 'REFUND') only allows one | Split into 6 types: EARN, REDEEM, EARN_REVERSAL, REDEEM_REVERSAL, ADJUST, EXPIRE |
| 4 | **Discount stacking with existing discounts** — plan didn't account for item-level + manual sales-level discounts that already exist | Clarified full chain: item discounts → sales discount → service/tax → tier % → point redemption |
| 5 | **Delivered sales** — can't void/return/refund "Delivered" sales | Existing validation already blocks this. No loyalty hook needed for delivery confirmation |
| 6 | **Split bill** — schema exists, no implementation | Explicitly scoped out of V1. Only primary customer earns loyalty |
| 7 | **Customer is tenant-wide** — not outlet-scoped | Confirmed. Loyalty accounts are also tenant-wide. Points work at any outlet |
| 8 | **No cron infrastructure** — node-cron installed but unused | Added cron-manager.ts setup, initialized from index.ts |
| 9 | **Session reporting** — needs loyalty metrics for session close | Added Phase 8: loyalty aggregation in getTotalSalesData() |
| 10 | **Soft delete fields missing** — plan didn't specify deleted/deletedAt/version on all new models | Added standard fields requirement for all new models |
| 11 | **No customer search endpoint** — cashiers fetch all customers, search client-side | Defer to existing pattern. Customer list with loyalty data included via Phase 7 |
| 12 | **Sales amount for point calculation** — "final paid amount" vs "totalAmount" ambiguity | Clarified: earn on `totalAmount` (after ALL discounts), only when status = "Completed" |
| 13 | **Missing loyalty fields on Sales** — needed more fields than initially planned | Added: loyaltyPointsRedemptionValue, loyaltyTierDiscountPercent, loyaltyTierDiscountAmount, subscriptionDiscountAmount |
| 14 | **Error types missing** — no loyalty-specific error classes | Added to modified files: InsufficientPointsError, TierMismatchError, SubscriptionExpiredError |
| 15 | **No test framework exists** — verification plan mentioned unit tests but codebase has zero tests | Changed verification plan to manual API testing |
| 16 | **Add-on architecture mismatch** — tenant-scoped add-ons attached to per-outlet subscriptions via fragile "primary subscription" pattern | Phase 0: New `TenantAddOn` table directly links tenantId to addOnId, eliminating primary subscription dependency |
| 17 | **JWT auth doesn't load add-ons** — `getTenantSubscriptionInfo()` never queries add-ons, only returns planName | Phase 2B: Query `TenantAddOn` for loyalty add-on (single indexed lookup) |
| 18 | **Plan downgrade skips loyalty cleanup** — `handleDowngradeToBasic()` only removes device + warehouse add-ons | Phase 0F: Add `ADD_ON_IDS.ADVANCED_LOYALTY` to downgrade cleanup |
| 19 | **"feature" addOnType is new** — existing add-ons are "user", "device", "warehouse" | Seed handles this. No code changes needed beyond seed |
| 20 | **No admin endpoint for feature add-ons** — admin module has no UI for toggling feature add-ons | Defer to Phase 0F: toggle via TenantAddOn create/delete, admin UI can be added later |
| 21 | **Upgrade creates warehouse without add-on record** — `changeTenantPlan()` bug | Phase 0F: Fix by adding TenantAddOn upsert alongside warehouse creation |
| 22 | **Inconsistent add-on lookup** — `purchaseAdditionalDevice()` uses name, others use hardcoded ID | Phase 0B: Centralized `ADD_ON_IDS` constants replace all hardcoded references |
| 23 | **Status filter inconsistency** — different functions check different subscription status values | Phase 0G: Standardize to `['Active', 'active', 'trial']` |
| 24 | **maxQuantity never validated** — `SubscriptionAddOn.maxQuantity` field exists but is never checked | Phase 0F: Add validation in all add-on creation functions |
| 25 | **Race condition on concurrent redemptions** — Prisma `findFirst()` does not support `FOR UPDATE`. Two concurrent sales for same customer could double-spend points | Phase 5C: Use raw SQL `SELECT ... FOR UPDATE` on LoyaltyAccount + optimistic locking (version field) as secondary guard |
| 26 | **`update()` can corrupt loyalty data** — `sales.service.ts` line ~998 blindly updates any field including loyalty fields, no status check | Phase 5G: Block edits on sales with `loyaltyPointsEarned > 0` OR `loyaltyPointsRedeemed > 0` OR `customerSubscriptionId != null` |
| 27 | **`remove()` doesn't reverse loyalty** — `sales.service.ts` line ~1025 soft-deletes without loyalty reversal | Phase 5G: Block deletion of loyalty-processed sales. Force void → recreate instead |
| 28 | **Promotion system conflict** — Existing Promotion tables (Promotion, PromotionItem, PromotionCustomer, PromotionUsage) have `EXCLUSIVE` combination rule. Interaction with loyalty tier discounts undefined | Phase 5B: Clarified — promotions and loyalty are independent systems. `EXCLUSIVE` only applies between promotions, not loyalty |
| 29 | **Customer deletion cascade** — Soft-deleting a customer doesn't cascade to loyalty data. Orphaned accounts, cron still processes them | Phase 7B: Soft-delete LoyaltyAccount + cancel active CustomerSubscriptions when customer is deleted |
| 30 | **Decimal precision unspecified** — Plan didn't specify `@db.Decimal(X,Y)` for loyalty fields. Points as Int vs Decimal unclear | Phase 1A: Points as `Int` (whole points, floor rounding). Monetary fields as `@db.Decimal(15, 4)`. Rate fields as `@db.Decimal(15, 4)` |
| 31 | **Fractional point rounding** — If earn calculation produces 2.7 points, do we round or floor? | Design decision: `Math.floor()` — customer earns 2 points. Avoids dust accumulation |
| 32 | **`periodSpend` recalculation ignores voided/deleted sales** — Phase 6C query didn't filter by status or deleted flag | Phase 6C: Updated query to filter `status = 'Completed' AND deleted = false` |
| 33 | **Stale JWT after add-on change** — 1-day JWT expiry means loyalty tier change not visible for up to 24h | Phase 2B: Documented as V1 limitation. Admin UI note: "Changes take effect on next login" |
| 34 | **Timezone inconsistency** — Global schema uses `UTC_TIMESTAMP()`, tenant uses `now()`. Cron timezone unspecified | Phase 6: All crons run in UTC. Document that `Sales.createdAt` is server-local time. Period evaluation has ~1 day tolerance |
| 35 | **Cache key substring collision** — `SimpleCacheService` pattern invalidation could match `tenant_1` when clearing `tenant_10` | Phase 2D: Use unique suffixes (`:config`, `:list`). Verify cache uses exact prefix match |
| 36 | **Missing `Sales.customerId` index** — No index on `customerId` FK. Tier recalculation query `SUM(totalAmount) WHERE customerId = ?` would full-table scan | Phase 1A: Add `@@index([customerId])` to Sales model in migration |
| 37 | **`getAll()` returns deleted customers** — Pre-existing bug: customer list includes soft-deleted records | Phase 7A: Add `deleted: false` filter to customer queries |
| 38 | **Missing `deletedAt` on soft-delete** — `remove()` in `sales.service.ts` line ~1034 and `customer.service.ts` set `deleted: true` but not `deletedAt` | Fix alongside implementation: set `deletedAt: new Date()` wherever `deleted: true` |
| 39 | **Custom pricing overlaps Phase 0** — Both plans modify the same 6 functions in admin.service.ts: `getTenantCost`, `buildCostSnapshot`, `getAllTenantCost`, `getUpcomingPayments`, `changeTenantPlan`, `getTenantBillingSummary` + same `CostSnapshot` type | Custom pricing implemented FIRST as prerequisite. Phase 0H/0I produce merged result. CostSnapshot includes both `isCustomPrice`/`standardPlanPrice` fields and `tenantAddOns` array |

---

## Verification Plan (Manual API Testing)

No test framework exists in the codebase. Use Postman/curl for verification:

**Phase 0 verification:**
1. **Data migration**: Run migration script → verify TenantAddOn records match expected quantities
2. **User add-on**: Create tenant user → verify TenantAddOn created (not TenantSubscriptionAddOn)
3. **Device add-on**: Purchase device quota → verify TenantAddOn upserted
4. **Device limit**: Verify checkDeviceLimit() returns correct total (plan max × outlets + TenantAddOn quantity)
5. **Cost calculation**: Verify tenant cost shows plan costs per outlet + tenant add-on costs separately
6. **Cost snapshot**: Record payment → verify snapshot has `tenantAddOns` array with correct format
7. **Downgrade**: Downgrade Pro → Basic → verify device, warehouse, loyalty TenantAddOn records deleted
8. **Upgrade bug fix**: Upgrade Basic → Pro → verify warehouse TenantAddOn record created alongside warehouse

**Loyalty verification:**
9. **Gating**: Call `/loyalty/program` as Basic tenant → verify 403 rejected
10. **Gating**: Call `/loyalty/program` as Pro tenant → verify 200 success
11. **Gating**: Call `/loyalty/tier` as Pro (no add-on) → verify 403 rejected
12. **Points earn**: Create completed sale with Pro tenant + enrolled customer → verify points earned, point batch created with correct expiresAt
13. **Points redeem (FIFO)**: Create 2 earn batches with different dates → redeem partial → verify oldest batch deducted first
14. **Partial payment**: Create partially paid sale → verify 0 points earned → complete payment → verify points now awarded on full totalAmount
15. **Tier discount validation**: Send sale with 5% tier discount but customer has 2% tier → verify sale rejected with TierMismatchError
16. **Race condition**: Send 2 concurrent redemption requests for same customer → verify only one succeeds, other gets InsufficientPointsError
17. **Subscription quota**: Use last quota → verify subscription status = EXPIRED
18. **Subscription category**: Apply wash subscription to dry-cleaning item → verify rejection
19. **Void reversal**: Complete sale with earn+redeem → void → verify EARN_REVERSAL + REDEEM_REVERSAL records + points restored correctly
20. **Return reversal**: Same as void but via return endpoint
21. **Refund reversal**: Same as void but via refund endpoint
22. **Delivered sale**: Try to void a delivered sale → verify existing validation blocks it (no loyalty code reached)
23. **Point expiry cron**: Create batch with expiresAt in the past → trigger cron → verify EXPIRE transaction + points deducted
24. **JWT refresh**: Add loyalty add-on to tenant → refresh token → verify loyaltyTier changes from 'basic' to 'advanced'
25. **Session report**: Close session → verify loyalty metrics appear in session summary
26. **Idempotency**: Submit same earn request twice (same salesId) → verify UNIQUE constraint prevents double-earning
27. **Performance**: Run 100 sales as Basic tenant → measure average response time → compare with 100 sales as Pro tenant → verify <50ms difference

**New tests from critical review:**
28. **Edit blocked**: Complete sale with loyalty → call `PUT /sales/update` to change `totalAmount` → verify 400 rejected with "Cannot edit a sale with loyalty data"
29. **Delete blocked**: Complete sale with loyalty → call `DELETE /sales/:id` → verify 400 rejected with "Cannot delete a sale with loyalty data"
30. **Concurrent redemption**: Send 2 concurrent redemption requests for same customer (both trying to redeem full balance) → verify only one succeeds, other waits then fails (FOR UPDATE serialization)
31. **Customer deletion cascade**: Delete customer with loyalty account + active subscription → verify LoyaltyAccount soft-deleted + CustomerSubscription set to CANCELLED + LoyaltyTransaction records preserved
32. **Promotion + loyalty stacking**: Create EXCLUSIVE promotion on item + tier discount → complete sale → verify both promotion discount AND tier discount applied (exclusive only blocks other promotions)
33. **Point rounding**: Create sale for Rp 25,000 with pointsPerCurrency = 0.0001 (1 per 10,000) → verify 2 points earned (Math.floor(2.5) = 2), not 3
34. **periodSpend after void**: Complete 3 sales → void 1 → trigger tier cron → verify periodSpend excludes voided sale
35. **Deleted sale excluded**: Soft-delete a sale → trigger tier cron → verify periodSpend excludes deleted sale

---

## Implementation Order

**Prerequisite — Custom Tenant Pricing** (see [custom-tenant-pricing.md](custom-tenant-pricing.md))
0. Implement custom pricing FIRST: schema migration (customPrice + CustomPriceLog), setCustomPrice endpoint, update cost functions with `customPrice ??` pattern, update CostSnapshot with audit fields, changeTenantPlan auto-clear

**Phase 0 — Add-On Architecture Refactor** (builds on custom pricing)
1. Global DB schema migration (TenantAddOn table + relations)
2. Add-on constants file (`src/constants/add-on-ids.ts`)
3. Seed update (4th add-on: Advanced Loyalty)
4. Data migration script (TenantSubscriptionAddOn → TenantAddOn)
5. Refactor `getPrimarySubscription()` (remove subscriptionAddOn include)
6. Refactor admin add-on functions (7 functions → use TenantAddOn)
7. Fix `changeTenantPlan()` upgrade bug (warehouse add-on record)
8. Refactor device service (3 functions → use TenantAddOn)
9. Refactor cost calculation (`getTenantCost`, `getAllTenantCost`, `getUpcomingPaymentsByStatus`)
10. Refactor cost snapshot (`buildCostSnapshot`, `recordPayment` → tenantAddOns array)
11. Update `CostSnapshot` type in `admin.response.ts`
12. Remove `subscriptionAddOn` from all remaining includes/queries
13. Verify Phase 0 (tests 1-8)

**Phase 1-8 — Loyalty System**
14. Tenant DB schema migration (loyalty tables + Sales fields + `@@index([customerId])` on Sales)
15. Permission seed (loyalty permissions)
16. Error classes (InsufficientPointsError, TierMismatchError, DuplicateSubscriptionError, etc.)
17. JWT extension (UserInfo + auth.service via TenantAddOn query)
18. Gating middleware (loyalty-gate.middleware.ts)
19. Route registration (index.ts — loyalty + subscription routes)
20. Loyalty program CRUD + caching
21. Loyalty account + customer enrollment
22. Points earn/redeem with FIFO batches (raw SQL `FOR UPDATE` + version guard)
23. Sales integration — Hook 1: completeNewSales() (basic loyalty, with row lock)
24. Sales integration — Hook 2: addPaymentToPartiallyPaidSales()
25. Sales integration — Block edit/delete of loyalty-processed sales (Phase 5G)
26. Tier CRUD + auto-upgrade logic
27. Subscription package CRUD + category linking
28. Customer subscription management (subscribe/cancel/pause)
29. Sales integration — Advanced: tier discount + subscription usage validation
30. Sales integration — Void/Return/Refund reversal (3 hooks)
31. Customer lookup integration (include loyalty data + fix getAll() deleted filter)
32. Customer deletion cascade (soft-delete loyalty account + cancel subscriptions)
33. Cron manager + point expiry cron (UTC timezone)
34. Cron: subscription expiry
35. Cron: tier re-evaluation (with corrected periodSpend query)
36. Session reporting integration (loyalty metrics)
37. Fix pre-existing bugs (deletedAt on remove(), getAll() deleted filter)
38. Manual API testing & verification (tests 9-35)
