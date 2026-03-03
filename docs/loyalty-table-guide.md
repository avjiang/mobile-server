# Loyalty System — Table Guide & Visual Flow

> Visual explanation of every table, their relationships, and real-world scenarios.

---

## Table Overview (10 tables)

```
BASIC LOYALTY (Pro plan — free)          ADVANCED LOYALTY (paid add-on)
================================         ================================
LoyaltyProgram  (1 per tenant)           LoyaltyTier         (N per program)
LoyaltyAccount  (1 per customer)         SubscriptionPackage  (N per tenant)
LoyaltyPointBatch (N per account)        SubscriptionPackageCategory (junction)
LoyaltyTransaction (audit log)           CustomerSubscription (N per customer)
                                         SubscriptionUsage    (audit log)
```

---

## Table Relationships

```
                            ┌─────────────────────┐
                            │   LoyaltyProgram     │
                            │   (1 per tenant)     │
                            │                      │
                            │ pointsPerCurrency    │
                            │ currencyPerPoint     │
                            │ pointsExpiryDays     │
                            │ minRedeemPoints      │
                            │ earnPointsOnPkg      │
                            │ tierEvalPeriodDays   │
                            └──────────┬───────────┘
                                       │ 1:N
                          ┌────────────┼────────────┐
                          ▼                         ▼
                 ┌─────────────────┐      ┌─────────────────┐
                 │  LoyaltyTier    │      │ LoyaltyAccount  │
                 │  (ADVANCED)     │◄─────│ (1 per customer)│
                 │                 │      │                 │
                 │ name            │      │ customerId ─────┼──► Customer table
                 │ minSpend        │      │ currentPoints   │
                 │ discountPct     │      │ totalEarned     │
                 │ pointsMultiply  │      │ totalRedeemed   │
                 │ sortOrder       │      │ totalSpend      │
                 │                 │      │ periodSpend     │
                 └─────────────────┘      │ periodStartDate │
                                          │ loyaltyTierId   │
                                          │ isManualTier    │
                                          └────────┬────────┘
                                                   │ 1:N
                                    ┌──────────────┼──────────────┐
                                    ▼                             ▼
                          ┌──────────────────┐          ┌──────────────────┐
                          │ LoyaltyPointBatch│          │LoyaltyTransaction│
                          │                  │          │   (audit log)    │
                          │ originalPoints   │          │                  │
                          │ remainingPoints  │          │ type (6 types)   │
                          │ expiresAt        │          │ points (+/-)     │
                          │ earnedAt         │          │ balanceAfter     │
                          │ salesId          │          │ salesId          │
                          │ deleted (soft)   │          │ pointBatchId     │
                          └──────────────────┘          │ description      │
                                                        │ performedBy      │
                                                        └──────────────────┘


         ┌─────────────────────┐         ┌─────────────────────────┐
         │ SubscriptionPackage │────────►│SubscriptionPkgCategory  │
         │ (ADVANCED)          │  1:N    │  (junction)             │
         │                     │         │                         │
         │ name                │         │ subscriptionPackageId   │
         │ packageType         │         │ categoryId ─────────────┼──► Category table
         │  (USAGE / TIME)     │         └─────────────────────────┘
         │ price               │
         │ totalQuota           │
         │ quotaUnit           │
         │ durationDays        │
         │ discountPercentage  │
         │ discountAmount      │
         │ validityDays        │
         └──────────┬──────────┘
                    │ 1:N
                    ▼
         ┌──────────────────────┐        ┌─────────────────────┐
         │ CustomerSubscription │───────►│  SubscriptionUsage   │
         │                      │  1:N   │  (audit log)         │
         │ customerId           │        │                      │
         │ subscriptionPkgId    │        │ customerSubId        │
         │ status               │        │ salesId              │
         │  (ACTIVE/PAUSED/     │        │ quantityUsed         │
         │   EXPIRED/CANCELLED) │        │ remainingAfter       │
         │ startDate            │        │ performedBy          │
         │ endDate              │        └─────────────────────┘
         │ remainingQuota       │
         │ usedQuota            │
         │ paidAmount           │
         │ packageSnapshot(JSON)│
         └──────────────────────┘


         ┌─────────────────────────────────────────────┐
         │              Sales table                     │
         │          (EXISTING — modified)               │
         │                                              │
         │ + loyaltyPointsEarned        Decimal?        │
         │ + loyaltyPointsRedeemed      Decimal?        │
         │ + loyaltyPointsRedemptionValue Decimal?      │
         │ + loyaltyTierDiscountPercent  Decimal?       │
         │ + loyaltyTierDiscountAmount   Decimal?       │
         │ + customerSubscriptionId      Int?           │
         │ + subscriptionDiscountAmount  Decimal?       │
         └─────────────────────────────────────────────┘
```

---

## Each Table Explained

### 1. LoyaltyProgram — "The rules of the game"

**What**: Stores the tenant's loyalty configuration. One row per tenant.
**Who creates it**: Tenant admin, once, during loyalty setup.

| Field | Purpose | Example |
|---|---|---|
| pointsPerCurrency | How many points per unit of currency spent | 0.0001 (= 1 point per Rp 10,000) |
| currencyPerPoint | Cash value of 1 point when redeeming | 1000 (= 1 point = Rp 1,000) |
| pointsExpiryDays | How long points last before expiring | 365 (1 year) |
| minRedeemPoints | Minimum points customer must have to redeem | 10 |
| earnPointsOnPackagePurchase | Do package purchases earn points? | true |
| tierEvaluationPeriodDays | Rolling window for tier evaluation (null = all-time) | 365 (annual) |

**Scenario**: Tenant "Warung Kopi" sets up: 1 point per Rp 10,000 spent, points expire after 1 year, minimum 10 points to redeem. Tiers evaluated on rolling 12-month spend.

---

### 2. LoyaltyTier — "Membership levels" (ADVANCED)

**What**: Defines membership levels with spending thresholds and benefits.
**Who creates it**: Tenant admin, during loyalty setup.

| Field | Purpose | Example |
|---|---|---|
| name | Display name | "Gold Member" |
| minSpend | Minimum spend to qualify (within evaluation period) | 5,000,000 |
| discountPercentage | Automatic discount at checkout | 5 (= 5% off) |
| pointsMultiplier | Bonus points multiplier | 1.5 (= 50% more points) |
| sortOrder | Display ordering | 3 |

**Scenario**: Tenant creates 4 tiers:

```
Member   → spend Rp 0+        → 0% discount, 1.0x points
Silver   → spend Rp 1,000,000 → 3% discount, 1.2x points
Gold     → spend Rp 5,000,000 → 5% discount, 1.5x points
Platinum → spend Rp 15,000,000 → 10% discount, 2.0x points
```

Customer "Budi" has spent Rp 6,200,000 in the last 12 months → auto-upgraded to Gold.
Gold perks: 5% off every purchase + earns 1.5x points.

---

### 3. LoyaltyAccount — "Customer's loyalty wallet"

**What**: Links a customer to the loyalty program. Tracks their points balance and tier.
**Who creates it**: System, when cashier enrolls a customer.

| Field | Purpose | Example |
|---|---|---|
| customerId | Which customer | 42 (FK to Customer) |
| currentPoints | Live point balance (denormalized) | 150 |
| totalEarned | All-time points earned | 500 |
| totalRedeemed | All-time points redeemed | 300 |
| totalSpend | All-time monetary spend | 8,500,000 |
| periodSpend | Spend within current evaluation window | 6,200,000 |
| periodStartDate | When the current evaluation window started | 2025-03-01 |
| loyaltyTierId | Current membership tier | 3 (= Gold) |
| isManualTier | Was tier manually assigned? | false |

**Scenario**: Customer "Budi" has 150 points, Gold tier, has spent Rp 6.2M in the last year. He can redeem 150 points for Rp 150,000 discount at checkout.

---

### 4. LoyaltyPointBatch — "Point expiry tracking"

**What**: Each time a customer earns points, a batch is created with its own expiry date. When redeeming, oldest batches are consumed first (FIFO).
**Who creates it**: System, automatically when points are earned.

| Field | Purpose | Example |
|---|---|---|
| originalPoints | Points earned in this batch | 50 |
| remainingPoints | Points not yet redeemed or expired | 30 |
| expiresAt | When this batch expires (null = never) | 2026-03-01 |
| earnedAt | When points were earned | 2025-03-01 |
| salesId | Which sale generated these points | 1234 |

**Scenario — FIFO Redemption**:

```
Batch A: earned Jan 1,  remaining 20 pts, expires Dec 31
Batch B: earned Feb 15, remaining 50 pts, expires Feb 14 next year
Batch C: earned Mar 1,  remaining 30 pts, expires Feb 28 next year

Customer redeems 60 points:
  → Batch A: 20 pts consumed (now 0 remaining) ← oldest first
  → Batch B: 40 pts consumed (now 10 remaining)
  → Batch C: untouched (still 30 remaining)
  → Total redeemed: 60 ✓
```

**Why not just track a single balance?** Because points expire at different times. Without batches, we can't know WHICH points expire when.

---

### 5. LoyaltyTransaction — "Complete audit trail"

**What**: Every point movement is recorded here. This is the source of truth for auditing.
**Who creates it**: System, on every loyalty operation.

6 transaction types:

| Type | When | points value | Example |
|---|---|---|---|
| EARN | Customer makes a purchase | +50 | "Earned 50 pts on Sale #1234" |
| REDEEM | Customer uses points at checkout | -60 | "Redeemed 60 pts on Sale #1567" |
| EARN_REVERSAL | Sale is voided/returned/refunded | -50 | "Reversed earn from voided Sale #1234" |
| REDEEM_REVERSAL | Voided sale had redeemed points → restored | +60 | "Restored redeemed pts from voided Sale #1567" |
| ADJUST | Admin manually adds/removes points | +100 | "Goodwill adjustment by Manager" |
| EXPIRE | Daily cron expires old point batches | -20 | "Batch #45 expired" |

**Scenario — Full lifecycle**:

```
Mar 1:  EARN +50 pts (Sale #100)        balance: 50
Mar 5:  EARN +30 pts (Sale #105)        balance: 80
Mar 10: REDEEM -40 pts (Sale #110)      balance: 40
Mar 12: Sale #100 voided:
        EARN_REVERSAL -50 pts           balance: -10 → clamped to 0
Mar 15: ADJUST +20 pts (goodwill)       balance: 20
Apr 1:  EXPIRE -10 pts (batch expired)  balance: 10
```

Each row has `balanceAfter` so you can reconstruct the full timeline.

---

### 6. SubscriptionPackage — "Package templates" (ADVANCED)

**What**: Defines subscription packages that tenants offer to their customers. Template, not enrollment.
**Who creates it**: Tenant admin.

Two types:

```
USAGE-BASED                              TIME-BASED
─────────────────────────                ─────────────────────────
"Wash & Fold 10 kg"                      "Monthly Coffee Club"
price: Rp 150,000                        price: Rp 200,000
totalQuota: 10                           durationDays: 30
quotaUnit: "kg"                          discountPercentage: 15
linked to: [Laundry category]           linked to: [Beverages category]

Customer buys → gets 10 kg quota         Customer buys → gets 15% off
Each visit deducts from quota            beverages for 30 days
Quota hits 0 → package expired           30 days pass → package expired
```

---

### 7. SubscriptionPackageCategory — "Which products the package applies to"

**What**: Links a package to product categories. A laundry package only works on laundry items.
**Who creates it**: System, when tenant creates a package with `categoryIds`.

**Scenario**: "Wash & Fold 10 kg" package is linked to categories:
- Category 5: "Wash & Fold"
- Category 12: "Dry Cleaning"

Customer tries to use this package on a "Coffee" item → **rejected** (category mismatch).

---

### 8. CustomerSubscription — "Customer's active packages"

**What**: Records that a specific customer has purchased/subscribed to a specific package.
**Who creates it**: Cashier, when customer buys a package.

| Field | Purpose | Example |
|---|---|---|
| customerId | Which customer | 42 |
| subscriptionPackageId | Which package template | 1 (Wash & Fold 10 kg) |
| status | Current state | ACTIVE |
| startDate | When subscription started | 2025-03-01 |
| endDate | When it expires (time-based) | 2025-03-31 (or null for usage) |
| remainingQuota | How much quota is left | 7 (started at 10, used 3) |
| usedQuota | How much has been used | 3 |
| paidAmount | What customer paid | 150,000 |
| packageSnapshot | Frozen copy of package rules at purchase time | {name, price, quota...} |

**Why packageSnapshot?** If the tenant changes the package price from Rp 150K to Rp 180K, existing subscribers should keep their original terms. The snapshot freezes the rules at purchase time.

**Scenario**:

```
Mar 1:  Budi buys "Wash & Fold 10 kg" → CustomerSubscription created
        status=ACTIVE, remainingQuota=10, usedQuota=0

Mar 5:  Budi brings 2 kg laundry → quota deducted
        remainingQuota=8, usedQuota=2

Mar 12: Budi brings 3 kg laundry → quota deducted
        remainingQuota=5, usedQuota=5

...

Mar 28: Budi uses last 1 kg → remainingQuota=0
        status auto-changes to EXPIRED

Budi can now buy a new package if he wants.
```

---

### 9. SubscriptionUsage — "Package usage history"

**What**: Records every time a customer uses their package quota. Audit trail for packages.
**Who creates it**: System, during checkout when package is applied.

| Field | Purpose | Example |
|---|---|---|
| customerSubscriptionId | Which subscription | 1 |
| salesId | Which sale used it | 1234 |
| quantityUsed | How much was deducted | 2 (kg) |
| remainingAfter | Quota left after this usage | 8 |

**Scenario**: Budi's usage history for his "Wash & Fold 10 kg" package:

```
Mar 5:  Sale #200, used 2 kg, remaining 8
Mar 12: Sale #215, used 3 kg, remaining 5
Mar 20: Sale #230, used 4 kg, remaining 1
Mar 28: Sale #245, used 1 kg, remaining 0 → EXPIRED
```

---

### 10. Sales table (modified) — "Loyalty data on each sale"

**What**: Existing Sales table gets new columns to record what loyalty actions happened on each sale.
**Why on Sales?** So when you void/return/refund a sale, you know exactly what to reverse.

| New Field | What it records | Example |
|---|---|---|
| loyaltyPointsEarned | Points customer earned | 50 |
| loyaltyPointsRedeemed | Points customer used | 30 |
| loyaltyPointsRedemptionValue | Cash value of redeemed points | 30,000 |
| loyaltyTierDiscountPercent | Tier discount % applied | 5 |
| loyaltyTierDiscountAmount | Tier discount cash value | 25,000 |
| customerSubscriptionId | Package used (if any) | 1 |
| subscriptionDiscountAmount | Package discount value (time-based) | 15,000 |

---

## End-to-End Scenario: "Budi buys coffee"

```
SETUP (tenant admin did this once):
  Program: 1 pt per Rp 10,000 | 1 pt = Rp 1,000 | expire 365 days
  Tiers: Member(0), Silver(1M), Gold(5M), Platinum(15M)
  Budi: enrolled, Gold tier, 150 pts, periodSpend=6.2M

═══════════════════════════════════════════════════════════
CHECKOUT:
═══════════════════════════════════════════════════════════

1. Cashier selects Budi
   → App shows: Gold Member | 150 pts (= Rp 150,000) | no active package

2. Cashier adds items:
   Coffee Latte        Rp 45,000
   Croissant           Rp 35,000
                      ──────────
   Subtotal            Rp 80,000

3. Existing discounts:
   (none today)

4. Loyalty discounts:
   Gold tier 5%:       -Rp 4,000
   Budi redeems 20 pts: -Rp 20,000
                      ──────────
   Total               Rp 56,000    ← customer pays this

5. Payment: Budi pays Rp 56,000 (cash)

6. Points earned:
   Rp 56,000 × 0.0001 × 1.5 (Gold multiplier) = 8.4 → 8 pts

   New balance: 150 - 20 + 8 = 138 pts

═══════════════════════════════════════════════════════════
WHAT HAPPENED IN THE DATABASE:
═══════════════════════════════════════════════════════════

Sales record:
  totalAmount: 56,000
  loyaltyPointsEarned: 8
  loyaltyPointsRedeemed: 20
  loyaltyPointsRedemptionValue: 20,000
  loyaltyTierDiscountPercent: 5
  loyaltyTierDiscountAmount: 4,000

LoyaltyPointBatch:
  → Oldest batch: remainingPoints reduced by 20 (FIFO)
  → New batch created: originalPoints=8, expiresAt=2027-03-01

LoyaltyTransaction (2 records):
  → REDEEM: -20 pts, balanceAfter=130, salesId=500
  → EARN:   +8 pts, balanceAfter=138, salesId=500

LoyaltyAccount:
  currentPoints: 138 (was 150)
  totalEarned: 508 (was 500)
  totalRedeemed: 320 (was 300)
  totalSpend: 8,556,000 (was 8,500,000)
  periodSpend: 6,256,000 (was 6,200,000)

═══════════════════════════════════════════════════════════
IF THIS SALE IS VOIDED:
═══════════════════════════════════════════════════════════

LoyaltyPointBatch:
  → Earn batch (salesId=500): remainingPoints set to 0
  → New restoration batch: 20 pts, no expiry

LoyaltyTransaction (2 records):
  → EARN_REVERSAL: -8 pts, balanceAfter=130
  → REDEEM_REVERSAL: +20 pts, balanceAfter=150

LoyaltyAccount:
  currentPoints: 150 (restored)
  totalSpend: 8,500,000 (reversed)
  periodSpend: 6,200,000 (reversed)
```

---

## End-to-End Scenario: "Budi uses laundry package"

```
SETUP:
  Budi has "Wash & Fold 10 kg" package, remainingQuota=5

═══════════════════════════════════════════════════════════
CHECKOUT:
═══════════════════════════════════════════════════════════

1. Cashier selects Budi
   → App shows: Gold Member | 138 pts | Active: Wash & Fold (5 kg left)

2. Cashier adds items:
   Wash & Fold 3 kg    Rp 45,000

3. Cashier applies package:
   → customerSubscriptionId = 1
   → subscriptionQuantityUsed = 3

4. Server validates:
   → Is "Wash & Fold" category in package's linked categories? ✓
   → Is remainingQuota (5) >= quantityUsed (3)? ✓
   → Deduct: remainingQuota = 5 - 3 = 2

5. Payment: Rp 0 (fully covered by package)
   → Points earned on Rp 0 = 0 pts

═══════════════════════════════════════════════════════════
DATABASE:
═══════════════════════════════════════════════════════════

CustomerSubscription:
  remainingQuota: 2 (was 5)
  usedQuota: 8 (was 5)

SubscriptionUsage:
  quantityUsed: 3, remainingAfter: 2, salesId: 501

Sales:
  customerSubscriptionId: 1
  loyaltyPointsEarned: 0 (nothing to earn on Rp 0)
```

---

## Period-Based Tier Evaluation

```
Program config: tierEvaluationPeriodDays = 365

═══════════════════════════════════════════════════════════
SCENARIO: Budi's annual tier review
═══════════════════════════════════════════════════════════

Last 12 months spend: Rp 6,200,000
Gold threshold: Rp 5,000,000
→ Budi qualifies for Gold ✓ (stays Gold)

═══════════════════════════════════════════════════════════
6 months later... Budi stopped visiting
═══════════════════════════════════════════════════════════

Rolling 12-month spend now: Rp 2,100,000  (old sales fell out of window)
Silver threshold: Rp 1,000,000
Gold threshold: Rp 5,000,000
→ Budi no longer qualifies for Gold
→ Monthly cron downgrades Budi to Silver

LoyaltyAccount:
  loyaltyTierId: 2 (Silver, was 3 Gold)
  periodSpend: 2,100,000

Next visit: Budi gets 3% discount (Silver) instead of 5% (Gold)
```
