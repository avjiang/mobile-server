# Voucher System — Implementation Plan

## Overview

A voucher module that issues one-time discount rewards to customers when they hit configurable spending milestones. Integrates with the existing loyalty and sales systems.

Two core entities:

1. **Reward Rule** — Tenant-configurable trigger (e.g., "Spend RM 1,000 → earn 10% voucher")
2. **Voucher** — The actual discount instrument issued to a customer

---

## 1. Schema Design

### 1.1 RewardRule (Milestone Configuration)

```prisma
model RewardRule {
  id                 Int       @id @default(autoincrement()) @map("ID")
  name               String    @map("NAME")                                    // "Spend RM 1,000 Reward"
  triggerType         String    @default("SPEND_MILESTONE") @map("TRIGGER_TYPE") // SPEND_MILESTONE (future: BIRTHDAY, POINTS_THRESHOLD)
  spendThreshold     Decimal   @map("SPEND_THRESHOLD") @db.Decimal(15, 4)      // Cumulative spend to trigger
  isRepeatable       Boolean   @default(false) @map("IS_REPEATABLE")           // Can earn multiple times?
  discountType       String    @map("DISCOUNT_TYPE")                            // PERCENTAGE or FIXED
  discountPercentage Decimal?  @map("DISCOUNT_PERCENTAGE") @db.Decimal(15, 4)
  discountAmount     Decimal?  @map("DISCOUNT_AMOUNT") @db.Decimal(15, 4)
  expiryDays         Int       @map("EXPIRY_DAYS")                              // Days until voucher expires after issuance
  minPurchaseAmount  Decimal?  @map("MIN_PURCHASE_AMOUNT") @db.Decimal(15, 4)  // Optional: min sale amount to use voucher
  isActive           Boolean   @default(true) @map("IS_ACTIVE")
  deleted            Boolean   @default(false) @map("IS_DELETED")
  deletedAt          DateTime? @map("DELETED_AT")
  createdAt          DateTime? @default(now()) @map("CREATED_AT")
  updatedAt          DateTime? @updatedAt @map("UPDATED_AT")
  version            Int?      @default(1) @map("VERSION")
  vouchers           Voucher[]

  @@map("reward_rule")
}
```

### 1.2 Voucher (Issued Reward)

```prisma
model Voucher {
  id                     Int             @id @default(autoincrement()) @map("ID")
  rewardRuleId           Int?            @map("REWARD_RULE_ID")                   // Optional: null for manually-issued vouchers
  customerId             Int             @map("CUSTOMER_ID")
  loyaltyAccountId       Int?            @map("LOYALTY_ACCOUNT_ID")               // Optional: customer may not be enrolled in loyalty
  discountType           String          @map("DISCOUNT_TYPE")                    // Copied from rule at issuance time
  discountPercentage     Decimal?        @map("DISCOUNT_PERCENTAGE") @db.Decimal(15, 4)
  discountAmount         Decimal?        @map("DISCOUNT_AMOUNT") @db.Decimal(15, 4)
  minPurchaseAmount      Decimal?        @map("MIN_PURCHASE_AMOUNT") @db.Decimal(15, 4)
  status                 String          @default("ACTIVE") @map("STATUS")        // ACTIVE, REDEEMED, EXPIRED
  milestoneSpendSnapshot Decimal?        @map("MILESTONE_SPEND_SNAPSHOT") @db.Decimal(15, 4) // totalSpend when earned; null for manual
  label                  String          @map("LABEL")                            // "Spend RM 1,000 reward — 10% off"
  expiresAt              DateTime        @map("EXPIRES_AT")
  redeemedAt             DateTime?       @map("REDEEMED_AT")
  redeemedInSalesId      Int?            @unique @map("REDEEMED_IN_SALES_ID")     // @unique enforces one-voucher-per-sale
  deleted                Boolean         @default(false) @map("IS_DELETED")
  deletedAt              DateTime?       @map("DELETED_AT")
  createdAt              DateTime?       @default(now()) @map("CREATED_AT")
  updatedAt              DateTime?       @updatedAt @map("UPDATED_AT")
  version                Int?            @default(1) @map("VERSION")

  rewardRule             RewardRule?     @relation(fields: [rewardRuleId], references: [id])
  customer               Customer        @relation(fields: [customerId], references: [id])
  loyaltyAccount         LoyaltyAccount? @relation(fields: [loyaltyAccountId], references: [id])
  redeemedInSale         Sales?          @relation(fields: [redeemedInSalesId], references: [id])

  @@index([customerId, status])
  @@index([expiresAt])
  @@map("voucher")
}
```

**Key design decisions:**

- `rewardRuleId Int?` — Optional because `POST /voucher/issue` creates vouchers without a rule (manual issuance).
- `loyaltyAccountId Int?` — Optional because admin might issue a voucher to a customer who isn't enrolled in loyalty yet.
- `@unique` on `redeemedInSalesId` — Enforces one-voucher-per-sale at DB level. The reverse relation on Sales becomes `Voucher?` (singular), not `Voucher[]`.
- `milestoneSpendSnapshot Decimal?` — Optional because manual vouchers have no milestone.

### 1.3 Sales Model — New Fields

Add to the existing `Sales` model (after `subscriptionDiscountAmount`, ~line 465):

```prisma
  // Voucher fields
  voucherId                 Int?     @map("VOUCHER_ID")                                       // Plain field, NO Prisma relation
  voucherDiscountPercentage Decimal? @map("VOUCHER_DISCOUNT_PERCENTAGE") @db.Decimal(15, 4)
  voucherDiscountAmount     Decimal? @map("VOUCHER_DISCOUNT_AMOUNT") @db.Decimal(15, 4)
```

Add reverse relation in Sales relations block (~line 476):

```prisma
  redeemedVoucher      Voucher?   // Reverse of Voucher.redeemedInSalesId; Voucher? because @unique
```

**Why `voucherId` is a plain `Int?` with NO Prisma relation:** Both `Sales.voucherId → Voucher` and `Voucher.redeemedInSalesId → Sales` would create dual FK between the same two models. Prisma requires named relations for this, adding complexity. Instead, only `Voucher.redeemedInSalesId` gets a Prisma relation. `Sales.voucherId` is a plain data field used for display/sync — lookups go through `Voucher.redeemedInSalesId`.

### 1.4 Relations to Add

- **Customer** model (~line 276): add `vouchers Voucher[]`
- **LoyaltyAccount** model (~line 1848): add `vouchers Voucher[]`

### 1.5 Why Copy Discount Fields to Voucher

If the reward rule changes after a voucher is issued, the voucher should keep its original value. Copying at issuance time ensures:

- No surprise value changes for the customer
- No join needed at checkout (voucher row has everything)
- Clear audit trail of what was promised vs what was redeemed

---

## 2. Module Structure

```
src/voucher/
├── voucher.controller.ts      (Routes + validation)
├── voucher.service.ts         (Business logic)
├── voucher.request.ts         (Request DTOs)
└── voucher.response.ts        (Response DTOs)
```

### 2.1 Feature Gating

Vouchers are gated at **`basic`** level (same as points). Available to all Pro plan tenants, not just advanced.

Reward rule management (CRUD) also requires `basic` or above.

### 2.2 Route Registration

In `src/index.ts`, add after the subscription route (~line 72):

```typescript
app.use("/voucher", require("./voucher/voucher.controller"));
```

---

## 3. API Endpoints

### 3.1 Reward Rule CRUD (Tenant Admin)

#### GET `/voucher/rules`

List all reward rules for this tenant.

**Response:** `{ success: true, data: [...] }`

```json
[
  {
    "id": 1,
    "name": "Spend RM 1,000 Reward",
    "triggerType": "SPEND_MILESTONE",
    "spendThreshold": 1000,
    "isRepeatable": false,
    "discountType": "PERCENTAGE",
    "discountPercentage": 10,
    "discountAmount": null,
    "expiryDays": 30,
    "minPurchaseAmount": null,
    "isActive": true
  },
  {
    "id": 2,
    "name": "Every RM 500 Reward",
    "triggerType": "SPEND_MILESTONE",
    "spendThreshold": 500,
    "isRepeatable": true,
    "discountType": "FIXED",
    "discountPercentage": null,
    "discountAmount": 25,
    "expiryDays": 14,
    "minPurchaseAmount": 100,
    "isActive": true
  }
]
```

#### POST `/voucher/rule`

Create a reward rule.

**Request:**

```json
{
  "name": "Spend RM 1,000 Reward",
  "spendThreshold": 1000,
  "isRepeatable": false,
  "discountType": "PERCENTAGE",
  "discountPercentage": 10,
  "expiryDays": 30,
  "minPurchaseAmount": null
}
```

**Validation:**

- `discountType === 'PERCENTAGE'` → `discountPercentage` required, must be 1–100
- `discountType === 'FIXED'` → `discountAmount` required, must be > 0
- `spendThreshold` must be > 0
- `expiryDays` must be > 0

#### PUT `/voucher/rule/:id`

Update a reward rule. Partial update supported — send only changed fields. Changes do NOT affect already-issued vouchers.

#### DELETE `/voucher/rule/:id`

Soft-delete. Already-issued vouchers remain valid.

---

### 3.2 Voucher Endpoints (Customer-Facing)

#### GET `/voucher/customer/:customerId`

List all vouchers for a customer. Default: active only (filters `status = 'ACTIVE' AND expiresAt > now()`). Query param `?status=ALL` to include redeemed/expired.

**Response:** `{ success: true, data: [...] }` — flat array, NOT wrapped in `{ vouchers: [...], total }`.

```json
[
  {
    "id": 42,
    "rewardRuleId": 1,
    "discountType": "PERCENTAGE",
    "discountPercentage": 10,
    "discountAmount": null,
    "minPurchaseAmount": null,
    "status": "ACTIVE",
    "label": "Spend RM 1,000 reward — 10% off",
    "expiresAt": "2026-06-01T00:00:00.000Z",
    "createdAt": "2026-03-01T00:00:00.000Z"
  }
]
```

**Important:** Active voucher listing must also filter `expiresAt > now()` because there is no cron job in V1 to transition status from ACTIVE to EXPIRED. A voucher with `status = 'ACTIVE'` but `expiresAt` in the past is effectively expired and must not be shown.

#### POST `/voucher/issue`

Manual voucher issuance by admin (not tied to a milestone). Returns `{ success: true, data: VoucherDO }`.

**Request:**

```json
{
  "customerId": 42,
  "discountType": "FIXED",
  "discountAmount": 50,
  "expiryDays": 30,
  "label": "Customer appreciation gift"
}
```

Creates a voucher with `rewardRuleId: null` and `loyaltyAccountId: null` (if customer isn't enrolled in loyalty).

---

### 3.3 Sales Integration — No New Endpoints

Voucher redemption happens inside the existing sale creation flow. Flutter sends new fields in the sale payload:

```json
{
  "voucherId": 42,
  "voucherDiscountPercentage": 10.0,
  "voucherDiscountAmount": 50.0
}
```

All 3 fields are accepted. Backend cross-validates that `voucherDiscountPercentage` matches the voucher's actual percentage (same pattern as tier discount validation).

When voucher is applied, tier discount fields should be zeroed out (best deal wins, handled by Flutter).

---

## 4. Business Logic

### 4.1 Auto-Issuance After Sale (Milestone Check)

**Where:** Fire-and-forget after `completeNewSales` and `addPaymentToPartiallyPaidSales` in `src/sales/sales.service.ts` — both locations increment `totalSpend`.

**Logic (fire-and-forget):**

```
1. Fetch all active reward rules (cached per tenant)
2. Read customer's current totalSpend from DB (fresh read, since this runs post-transaction via setImmediate)
3. For each rule where triggerType === 'SPEND_MILESTONE':
   a. If NOT repeatable:
      - Check if customer already has a voucher from this rule
      - If yes → skip
      - If no → check if totalSpend >= spendThreshold → issue voucher
   b. If repeatable:
      - Count how many vouchers customer has from this rule
      - Calculate: expectedCount = floor(totalSpend / spendThreshold)
      - If expectedCount > existingCount → issue (expectedCount - existingCount) vouchers
4. Issue voucher = create Voucher row with fields copied from RewardRule
```

**Performance:** Reward rules are cached (same pattern as `getCachedProgram`). Only one DB query per rule to check existing vouchers. Runs fire-and-forget so it never slows down checkout.

**Cumulative spend behavior:** `totalSpend` keeps climbing — no reset. `floor(totalSpend / threshold)` determines how many vouchers should exist for repeatable rules. Multiple active rules can all fire independently — customer gets all triggered vouchers.

### 4.2 Voucher Redemption in Sale

**Where:** Inside `processLoyaltyForSale` in `src/sales/sales.service.ts`, as a new **Step 0** that runs BEFORE the existing tier discount logic (Step 1).

**Execution order:**

```
Step 0 (NEW): Voucher validation — runs first
  If voucherId present → validate + redeem → SKIP Step 1 (tier discount)
  If no voucherId → fall through to Step 1

Step 1 (EXISTING): Tier discount validation — only runs if no voucher
Step 2 (EXISTING): Point redemption
Step 3 (EXISTING): Subscription usage
Step 4 (EXISTING): Point earning
```

**Step 0 Logic:**

```
1. If salesBody.voucherId is present:
   a. Fetch voucher from DB (inside transaction)
   b. Validate:
      - Voucher exists, not deleted, status === 'ACTIVE'
      - Voucher belongs to this customer
      - Voucher not expired (expiresAt > now)
      - If minPurchaseAmount set: totalAmount >= minPurchaseAmount
      - discountType is PERCENTAGE → validate voucherDiscountAmount matches calculation
      - discountType is FIXED → validate voucherDiscountAmount matches discountAmount (capped at totalAmount)
   c. Mark voucher as redeemed (inside transaction):
      - status = 'REDEEMED'
      - redeemedAt = now
      - redeemedInSalesId = salesId
   d. Set result fields:
      - voucherId = voucher.id
      - voucherDiscountPercentage = voucher.discountPercentage
      - voucherDiscountAmount = validated amount
   e. SKIP Step 1 (tier discount) entirely — voucher and tier are mutually exclusive
2. If no voucherId: existing tier discount logic (Step 1) runs unchanged
```

### 4.3 Voucher Restoration on Void/Return

**Where:** Inside `reverseLoyaltyForSale` in `src/sales/sales.service.ts`, before Step 3 (subscription restore).

**Logic:**

```
1. If sale.voucherId is not null:
   a. Find voucher by redeemedInSalesId = sale.id (uses the @unique index)
   b. If voucher exists and status === 'REDEEMED':
      - If voucher.expiresAt > now → restore to ACTIVE (clear redeemedAt, redeemedInSalesId)
      - If voucher.expiresAt <= now → set status to EXPIRED (clear redeemedInSalesId, don't restore)
```

**Verified safe:** All three void/return/refund functions fetch the full Sales record using `include` (not restrictive `select`). `reverseLoyaltyForSale` receives the complete `sale` object typed as `any`. New `voucherId` field will be automatically available. No changes needed to those fetch queries.

### 4.4 Reward Rule Caching

Same pattern as `getCachedProgram`:

```typescript
const CACHE_PREFIX = "voucher:rules:";

const getCachedRewardRules = async (db: string) => {
  const cacheKey = CACHE_PREFIX + db;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const prisma = getTenantPrisma(db);
  const rules = await prisma.rewardRule.findMany({
    where: { deleted: false, isActive: true },
    orderBy: { spendThreshold: "asc" },
  });

  cache.set(cacheKey, rules);
  return rules;
};
```

Invalidate on rule create/update/delete.

### 4.5 Program Deactivation Impact

When the loyalty program is deactivated:

- No new vouchers are issued (milestone check skipped because `getCachedProgram` returns null)
- Existing voucher expiry timers should be paused — extend `expiresAt` on reactivation, same pattern as point batches

Add to `updateProgram` reactivation block in `loyalty.service.ts` (~line 216), after point batch extension:

```sql
UPDATE voucher
SET EXPIRES_AT = DATE_ADD(EXPIRES_AT, INTERVAL ? DAY)
WHERE STATUS = 'ACTIVE' AND EXPIRES_AT IS NOT NULL AND IS_DELETED = false
```

---

## 5. Sales Service Changes — Detail

### 5.1 CreateSalesRequest — New Fields

**File:** `src/sales/sales.request.ts` (~line 66, after `subscriptionDiscountAmount`)

```typescript
@Expose() voucherId?: number;
@Expose() voucherDiscountPercentage?: number;
@Expose() voucherDiscountAmount?: number;
```

### 5.2 processLoyaltyForSale — Return Type

**File:** `src/sales/sales.service.ts` (~line 104)

Add to return type:

```typescript
voucherId: number | null;
voucherDiscountPercentage: Decimal;
voucherDiscountAmount: Decimal;
```

Initialize as `null`/`zero` in the `result` object (~line 115).

### 5.3 completeNewSales — Sales Update + Milestone Check

**File:** `src/sales/sales.service.ts` (~line 1134)

Add voucher fields to the sales update after `processLoyaltyForSale`:

```typescript
voucherId: loyaltyResult.voucherId,
voucherDiscountPercentage: loyaltyResult.voucherDiscountPercentage,
voucherDiscountAmount: loyaltyResult.voucherDiscountAmount,
```

Add fire-and-forget milestone check (~line 1156, next to existing `checkTierUpgrade`):

```typescript
if (loyaltyResult.loyaltyAccountId) {
    const custId = salesBody.customerId!;
    setImmediate(() => {
        voucherService.checkMilestones(databaseName, custId).catch(err =>
            console.error('Voucher milestone check failed:', err)
        );
    });
}
```

### 5.4 Sales Sync — `getAll` and `getByDateRange` (PRE-EXISTING BUG FIX)

**Problem:** Both `getAll()` (~line 537) and `getByDateRange()` (~line 647) use explicit `select {}` that returns only a subset of fields. **All 6 existing loyalty fields are already excluded**, and new voucher fields would also be excluded. The Flutter app cannot see loyalty/voucher data on synced sales.

Additionally, both functions have **manual transformation objects** (~lines 573-595 and ~lines 681-703) that explicitly map each field. Adding fields to `select` alone is insufficient — the transformation silently drops any field not explicitly mapped.

**Fix:** Add loyalty + voucher fields to BOTH the `select` AND the transformation in both functions:

```typescript
// In select:
loyaltyPointsEarned: true,
loyaltyPointsRedeemed: true,
loyaltyPointsRedemptionValue: true,
loyaltyTierDiscountPercent: true,
loyaltyTierDiscountAmount: true,
customerSubscriptionId: true,
subscriptionDiscountAmount: true,
voucherId: true,
voucherDiscountPercentage: true,
voucherDiscountAmount: true,

// In transformation object:
loyaltyPointsEarned: sale.loyaltyPointsEarned,
loyaltyPointsRedeemed: sale.loyaltyPointsRedeemed,
loyaltyPointsRedemptionValue: sale.loyaltyPointsRedemptionValue,
loyaltyTierDiscountPercent: sale.loyaltyTierDiscountPercent,
loyaltyTierDiscountAmount: sale.loyaltyTierDiscountAmount,
customerSubscriptionId: sale.customerSubscriptionId,
subscriptionDiscountAmount: sale.subscriptionDiscountAmount,
voucherId: sale.voucherId,
voucherDiscountPercentage: sale.voucherDiscountPercentage,
voucherDiscountAmount: sale.voucherDiscountAmount,
```

**Note:** `getPartiallyPaidSales` (~line 744) does NOT need these fields — partially paid sales never have loyalty data processed.

### 5.5 getTotalSalesData — Voucher Metrics

**File:** `src/sales/sales.service.ts` (~line 1506)

`getTotalSalesData` conditionally includes loyalty fields in its `select` (~lines 1524-1529) and aggregates them into `loyaltyMetrics` (~lines 1576-1597). Voucher discount is not included.

**Fix:** Add `voucherDiscountAmount: true` to the conditional select, aggregate a new metric:

```typescript
// In conditional select:
...(includeLoyalty ? {
    loyaltyPointsEarned: true,
    loyaltyPointsRedeemed: true,
    loyaltyTierDiscountAmount: true,
    customerSubscriptionId: true,
    voucherDiscountAmount: true,  // NEW
} : {}),

// In aggregation:
let totalVoucherDiscount = new Decimal(0);
// In forEach:
if (sale.voucherDiscountAmount) totalVoucherDiscount = totalVoucherDiscount.plus(sale.voucherDiscountAmount);
// In loyaltyMetrics result:
totalVoucherDiscountAmount: totalVoucherDiscount,
```

### 5.6 addPaymentToPartiallyPaidSales — Milestone Check

**File:** `src/sales/sales.service.ts` (~line 1631)

When a partially paid sale becomes completed, it increments `totalSpend` (~line 1733) and fires `checkTierUpgrade` (~line 1757). This is the **second location** that increments `totalSpend` — milestone vouchers from partially-paid-to-completed sales would be missed without a milestone check here.

**Fix:** Add fire-and-forget milestone check after existing `checkTierUpgrade` (~line 1763):

```typescript
setImmediate(() => {
    voucherService.checkMilestones(databaseName, sales.customerId!).catch(err =>
        console.error('Voucher milestone check failed:', err)
    );
});
```

---

## 6. Milestone Check — Detailed Flow

### 6.1 Where It Runs

Two locations:

1. `completeNewSales` — after `processLoyaltyForSale` completes and `totalSpend` has been incremented
2. `addPaymentToPartiallyPaidSales` — after partial payment becomes complete and `totalSpend` has been incremented

Both run fire-and-forget via `setImmediate` (`.catch(err => console.error(...))`).

### 6.2 Non-Repeatable Milestone Example

**Rule:** "Spend RM 1,000 → earn 10% voucher" (non-repeatable)

| Customer totalSpend | Has voucher from this rule? | Action                |
| ------------------- | --------------------------- | --------------------- |
| RM 800 → RM 950     | No                          | No (below threshold)  |
| RM 950 → RM 1,100   | No                          | Issue voucher         |
| RM 1,100 → RM 1,500 | Yes                         | Skip (already earned) |

### 6.3 Repeatable Milestone Example

**Rule:** "Every RM 500 → earn RM 25 voucher" (repeatable)

| Customer totalSpend | Expected vouchers   | Already issued | Action                |
| ------------------- | ------------------- | -------------- | --------------------- |
| RM 400 → RM 600     | floor(600/500) = 1  | 0              | Issue 1 voucher       |
| RM 600 → RM 800     | floor(800/500) = 1  | 1              | Skip (already have 1) |
| RM 800 → RM 1,200   | floor(1200/500) = 2 | 1              | Issue 1 more voucher  |
| RM 1,200 → RM 1,600 | floor(1600/500) = 3 | 2              | Issue 1 more voucher  |

### 6.4 Edge Case: Void Reduces totalSpend

When a sale is voided, `totalSpend` is decremented. But **already-issued vouchers are NOT revoked**. The customer keeps vouchers they've already earned. The next milestone check will simply not issue new ones because `expectedCount` won't exceed `existingCount`.

---

## 7. Discount Stacking — Updated Order

```
1. Item-level discounts (per item, set by cashier)
2. Sale-level manual discount (%, fixed, or amount)
3. + Service charge, tax, rounding
   = totalBeforeLoyalty
4. Tier discount OR Voucher (whichever is bigger — never both)
5. Subscription discount (on matching category items only)
6. Points redemption (converted to cash value)
   = totalAmount (what customer pays)
7. Points earned on totalAmount (calculated server-side)
8. Milestone check → auto-issue vouchers if threshold crossed
```

Step 4 is the key change: Flutter compares tier vs voucher, sends the winner. Backend validates whichever one is sent. Voucher validation runs as Step 0 (before tier discount) — if voucher is present, tier discount logic is skipped entirely.

---

## 8. Error Handling

Use existing error classes from `src/api-helpers/error.ts`. No new error classes needed.

| Scenario                                         | Error Class                             | Status |
| ------------------------------------------------ | --------------------------------------- | ------ |
| Voucher ID doesn't exist or is deleted           | `NotFoundError('Voucher')`              | 404    |
| Voucher has expired                              | `BusinessLogicError('Voucher expired')` | 400    |
| Voucher status is not ACTIVE                     | `BusinessLogicError('...')`             | 400    |
| Voucher doesn't belong to this customer          | `BusinessLogicError('...')`             | 400    |
| Sale total below voucher's minimum purchase      | `BusinessLogicError('...')`             | 400    |
| Discount amount doesn't match voucher's value    | `BusinessLogicError('...')`             | 400    |
| PERCENTAGE rule missing `discountPercentage`     | `RequestValidateError('...')`           | 400    |
| FIXED rule missing `discountAmount`              | `RequestValidateError('...')`           | 400    |

---

## 9. Files to Create

| File                                | Description                                                    |
| ----------------------------------- | -------------------------------------------------------------- |
| `src/voucher/voucher.controller.ts` | Routes + validation                                            |
| `src/voucher/voucher.service.ts`    | Business logic (rule CRUD, voucher listing, issuance, caching) |
| `src/voucher/voucher.request.ts`    | Request DTOs                                                   |
| `src/voucher/voucher.response.ts`   | Response DTOs                                                  |

### Service Pattern

Follow `loyalty.service.ts` pattern: `export default { ... }` with all functions.

```typescript
import cache from '../cache/simple-cache.service';
import { getTenantPrisma } from '../db';
```

Functions:
- **Rule CRUD**: `getRewardRules`, `createRewardRule`, `updateRewardRule`, `deleteRewardRule`
- **Caching**: `getCachedRewardRules` (pattern: `voucher:rules:{db}`), `invalidateRulesCache`
- **Listing**: `getVouchersByCustomerId` — filter `status='ACTIVE' AND expiresAt > now()` for active queries
- **Manual issuance**: `issueVoucher` — creates with `rewardRuleId: null`
- **Milestone check**: `checkMilestones(db, customerId)` — reads `totalSpend` from DB (fresh, since it runs post-transaction via `setImmediate`), uses cached rules, issues vouchers

### Controller Routes

All gated with `requireLoyalty('basic')`:

```
GET    /voucher/rules                 — list reward rules
POST   /voucher/rule                  — create reward rule
PUT    /voucher/rule/:id              — update reward rule
DELETE /voucher/rule/:id              — soft-delete reward rule
GET    /voucher/customer/:customerId  — list vouchers (?status=ACTIVE|ALL)
POST   /voucher/issue                 — manual voucher issuance
```

---

## 10. Files to Modify

| File                             | Change                                                                                                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/client/schema.prisma`    | Add `RewardRule`, `Voucher` models + Sales voucher fields (plain `Int?`, no relation) + `redeemedVoucher Voucher?` reverse + Customer/LoyaltyAccount relations   |
| `src/index.ts`                   | Register `/voucher` route                                                                                                                                        |
| `src/sales/sales.request.ts`     | Add `voucherId`, `voucherDiscountPercentage`, `voucherDiscountAmount` fields                                                                                     |
| `src/sales/sales.service.ts`     | 8 changes: return type, Step 0 validation, reversal, milestone checks (2 locations), sales sync select+transform (2 functions), session summary metrics           |
| `src/loyalty/loyalty.service.ts` | Add voucher expiry extension in `updateProgram` reactivation block                                                                                                |
| `docs/LOYALTY.md`                | Update sales integration section, add voucher section                                                                                                             |

---

## 11. Implementation Order

| Step | Task                                                                                              | Depends On |
| ---- | ------------------------------------------------------------------------------------------------- | ---------- |
| 1    | Schema: add RewardRule, Voucher models, Sales voucher fields, reverse relations                    | —          |
| 2    | Create `voucher.request.ts` + `voucher.response.ts`                                               | —          |
| 3    | Create `voucher.service.ts` (rule CRUD, caching, listing, manual issuance, milestone check)       | 1, 2       |
| 4    | Create `voucher.controller.ts` (routes + validation)                                              | 3          |
| 5    | Add voucher fields to `CreateSalesRequest`                                                        | 1          |
| 6    | Add voucher validation (Step 0) + return type in `processLoyaltyForSale`                          | 3, 5       |
| 7    | Add voucher restoration in `reverseLoyaltyForSale`                                                | 6          |
| 8    | Add milestone fire-and-forget + sales update fields in `completeNewSales`                         | 3, 6       |
| 9    | Fix sales sync: add loyalty + voucher fields to `getAll`/`getByDateRange` select AND transform    | 1          |
| 10   | Add voucher metrics to `getTotalSalesData` session summary                                        | 1          |
| 11   | Add milestone check to `addPaymentToPartiallyPaidSales`                                           | 3          |
| 12   | Add voucher expiry extension in `updateProgram`                                                   | 1          |
| 13   | Register `/voucher` route in `index.ts`                                                           | 4          |
| 14   | Create Flutter briefing doc + update `docs/LOYALTY.md`                                            | All        |

---

## 12. Verification Checklist

1. **Prisma validate** — confirm no relation ambiguity errors after schema changes
2. **Rule CRUD** — create PERCENTAGE rule (reject missing `discountPercentage`), create FIXED rule, update, soft-delete, verify cache invalidation
3. **Manual issuance** — issue to customer without loyalty account → `loyaltyAccountId` null, `rewardRuleId` null
4. **Listing with expiry filter** — create voucher with past `expiresAt` + status ACTIVE → verify it does NOT appear in active listing
5. **Sale with voucher** — complete sale with `voucherId` → verify tier discount skipped, voucher marked REDEEMED, Sales record has voucher fields
6. **Void with voucher** — void sale → verify non-expired voucher restored to ACTIVE, expired voucher stays EXPIRED
7. **One-per-sale** — `@unique` on `redeemedInSalesId` prevents duplicate redemption at DB level
8. **Milestone auto-issuance** — complete sale pushing `totalSpend` past threshold → verify voucher issued (check DB after brief delay)
9. **Program deactivation/reactivation** — deactivate → voucher can't be redeemed; reactivate after N days → `expiresAt` extended by N days
10. **Sales sync** — call `getAll` for a sale with voucher data → verify loyalty + voucher fields appear in response (not dropped by transformation)
11. **Session summary** — call `getTotalSalesData` with loyalty enabled → verify `totalVoucherDiscountAmount` appears in `loyaltyMetrics`
12. **Partial payment completion** — create partially paid sale → add final payment → verify milestone check fires (check DB for new voucher after brief delay)

---

## 13. Verified Safe — No Changes Needed

These were explicitly reviewed and confirmed to NOT require voucher changes:

- **`calculateSales`** — uses separate `CalculateSalesObject` DTO, no loyalty/voucher involvement
- **`getById`** — uses `include` (full record), new fields auto-included
- **`update`** — uses raw Prisma `Sales` type via `SalesRequestBody`, auto-supports new fields
- **`remove`** — just soft-deletes
- **`getPartiallyPaidSales`** — partially paid sales never have loyalty data processed; select + transformation does NOT need voucher fields
- **`voidSales` / `returnSales` / `refundSales`** — fetch with `include`, pass full `sale` object to `reverseLoyaltyForSale`
- **Delivery functions** (`getDeliveryList`, `getDeliveredList`, `confirmDeliveryBatch`) — delivery-specific, no voucher fields needed
- **`DeliveryListItemResponse`** — not used in runtime code (documentation-only DTO)
- **Sales controller** — `completeNewSales` and `addPaymentToPartiallyPaidSales` already pass `loyaltyTier` in `performedBy`; no controller changes needed
- **`sales.response.ts`** — `SalesResponseBody` uses Prisma `Sales` type (auto-includes new fields); other DTOs are delivery/analytics-specific

---

## 14. Flutter Team Alignment

Decisions confirmed with Flutter team (from `voucher_briefing.md`):

| # | Question | Answer |
|---|----------|--------|
| 1 | Feature gating | `basic` (all Pro tenants, same as points) |
| 2 | Endpoint path | `GET /voucher/customer/:customerId?status=ACTIVE` |
| 3 | Model fields | Backend field names used directly (`discountType`, `label`). No mapping needed. |
| 4 | Redemption flow | Flutter sends `voucherId` + `voucherDiscountPercentage` + `voucherDiscountAmount` in `completeNewSales` payload |
| 5 | Sale payload | All 3 fields accepted. Backend cross-validates percentage matches voucher record. |
| 6 | Validation | Same as tier discount — Flutter calculates, backend validates. `BusinessLogicError` on mismatch. |
| 7 | Multiple active vouchers | Yes. Flutter shows dropdown/selector. |
| 8 | Expiry warning | Frontend decision (suggest 7 days). Backend provides `expiresAt`, Flutter calculates. |
| 9 | Milestone management UI | Yes — tenant admin CRUD via `/voucher/rule(s)`. Flutter needs management UI. |
| 10 | Void/return handling | Non-expired voucher → ACTIVE. Expired → EXPIRED. |
| 11 | Cumulative spend | Keeps climbing, no reset. `floor(totalSpend / threshold)` for repeatable rules. |
| 12 | Rule gating level | `basic` (same as voucher usage) |
| 13 | Multiple rules | Yes, multiple active rules. Customer gets all triggered vouchers. |
| 14 | Manual issue response | `{ success: true, data: VoucherDO }` |
| 15 | Expiry filtering | Server-side. Backend excludes expired from active listing. |
| 16 | Trigger types | V1 is `SPEND_MILESTONE` only. Flutter can ignore `triggerType`. |
| 17 | Rule update behavior | Partial update — send only changed fields. |

---

## 15. Commands to Run After Implementation

```bash
npm run generate_prisma    # Regenerate Prisma clients
npm run upgrade_db         # Run migration for new tables + Sales fields
npm run dev                # Restart dev server
```

---

## 16. Open Design Decisions

| Decision                      | Recommendation                                   | Alternative                                                                         |
| ----------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Voucher vs Tier: who decides? | Flutter picks (best deal wins), server validates | Server auto-picks (more control, but less flexibility for customer to save voucher) |
| Voucher category restriction? | Not in V1 — voucher applies to total             | V2: add categoryIds to RewardRule for category-specific vouchers                    |
| Expired voucher cleanup job?  | Not in V1 — query filters by expiresAt           | V2: scheduled job to bulk-update ACTIVE → EXPIRED where expiresAt < now             |
| Multiple trigger types?       | V1: SPEND_MILESTONE only                         | V2: BIRTHDAY, POINTS_THRESHOLD, MANUAL_CAMPAIGN                                     |
