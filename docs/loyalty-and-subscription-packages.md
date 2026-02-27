# Loyalty Program & Subscription Packages

> **POS System Feature Specification**
> Applicable to: Laundry, Retail, and F&B tenants

---

## Table of Contents

1. [Why These Features?](#1-why-these-features)
2. [Feature Overview](#2-feature-overview)
3. [Loyalty Program](#3-loyalty-program)
4. [Subscription Packages](#4-subscription-packages)
5. [How It Fits Into the Current System](#5-how-it-fits-into-the-current-system)
6. [User Flows](#6-user-flows)
7. [Data Model](#7-data-model)
8. [API Reference](#8-api-reference)
9. [Permissions & Access Control](#9-permissions--access-control)
10. [Business Scenarios](#10-business-scenarios)
11. [Loyalty Use Cases & Flexible Configurations](#11-loyalty-use-cases--flexible-configurations)
12. [Edge Cases & Race Conditions](#12-edge-cases--race-conditions)
13. [Performance Considerations](#13-performance-considerations)

---

## 1. Why These Features?

```
 Problem                              Solution
 ──────────────────────────────       ──────────────────────────────
 Customers have no reason             Loyalty Program rewards
 to come back consistently    ──>     repeat visits with points
                                      they can redeem for discounts

 Tenants have unpredictable           Subscription Packages let
 revenue month-to-month       ──>     customers prepay, giving
                                      tenants guaranteed income
```

**Expected Impact:**

- Higher customer retention and repeat visits
- Increased average spend per customer
- Predictable recurring revenue for tenants
- Competitive advantage over shops without loyalty/subscription programs

---

## 2. Feature Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         POS SYSTEM                              │
│                                                                 │
│  ┌──────────────────────┐     ┌──────────────────────────────┐  │
│  │   LOYALTY PROGRAM    │     │   SUBSCRIPTION PACKAGES      │  │
│  │                      │     │                              │  │
│  │  - Points per spend  │     │  - Usage-based packages      │  │
│  │  - Redeem for        │     │    (e.g. 10 washes)          │  │
│  │    discounts         │     │                              │  │
│  │  - Point history     │     │  - Time-based packages       │  │
│  │  - Manual adjustment │     │    (e.g. monthly plan)       │  │
│  │  - Refund on void    │     │                              │  │
│  │                      │     │  - Usage tracking            │  │
│  │                      │     │  - Auto-expire when used up  │  │
│  └──────────┬───────────┘     └──────────────┬───────────────┘  │
│             │                                │                  │
│             └──────────┐   ┌─────────────────┘                  │
│                        ▼   ▼                                    │
│               ┌────────────────────┐                            │
│               │   SALES MODULE     │                            │
│               │  (existing)        │                            │
│               │                    │                            │
│               │  Points earned &   │                            │
│               │  redeemed are      │                            │
│               │  recorded per sale │                            │
│               └────────────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Loyalty Program

### 3.1 How It Works

```
  TENANT SETS UP                  CUSTOMER JOURNEY
  ═══════════════                 ════════════════

  ┌─────────────────┐
  │ Create Loyalty   │
  │ Program          │
  │                  │
  │ - 1 pt per RM1   │
  │ - 100 pts = RM1  │
  │ - Expiry: 365d   │
  │ - Min redeem: 100 │
  └────────┬─────────┘
           │
           ▼
  ┌─────────────────┐        ┌─────────────────┐
  │ Enroll Customer  │───────>│ Customer gets    │
  │ in Program       │        │ Loyalty Account  │
  └─────────────────┘        │ (0 points)       │
                              └────────┬─────────┘
                                       │
                              ┌────────▼─────────┐
                              │ Makes a purchase  │
                              │ RM50.00           │
                              └────────┬─────────┘
                                       │
                              ┌────────▼─────────┐
                              │ EARNS 50 points   │
                              │ Balance: 50 pts   │
                              └────────┬─────────┘
                                       │
                                  (repeats...)
                                       │
                              ┌────────▼─────────┐
                              │ Balance: 200 pts  │
                              │                   │
                              │ Wants to redeem   │
                              │ 100 pts = RM1 off │
                              └────────┬─────────┘
                                       │
                              ┌────────▼─────────┐
                              │ Next purchase:    │
                              │ RM30 - RM1 = RM29 │
                              │                   │
                              │ Balance: 100 pts  │
                              │ + 29 pts earned   │
                              │ = 129 pts         │
                              └──────────────────┘
```

### 3.2 Point Transaction Types

| Type       | When                               | Points       | Example                       |
| ---------- | ---------------------------------- | ------------ | ----------------------------- |
| **EARN**   | Customer completes a purchase      | + (positive) | Spent RM50 -> +50 pts         |
| **REDEEM** | Customer uses points for discount  | - (negative) | Used 100 pts -> -100 pts      |
| **ADJUST** | Staff manually adds/removes points | +/-          | Manager grants bonus +500 pts |
| **REFUND** | Sale is voided or returned         | + (positive) | Void sale -> +50 pts returned |
| **EXPIRE** | Points pass their expiry date      | - (negative) | 365 days passed -> -200 pts   |

### 3.3 Loyalty Program Configuration

| Setting             | Description                       | Example                     |
| ------------------- | --------------------------------- | --------------------------- |
| `pointsPerCurrency` | Points earned per RM1 spent       | `1.0` = 1 point per RM1     |
| `currencyPerPoint`  | Cash value of each point          | `0.01` = 100 pts = RM1      |
| `pointsExpiryDays`  | Days before points expire         | `365` or `null` (no expiry) |
| `minRedeemPoints`   | Minimum points required to redeem | `100`                       |

### 3.4 Membership Tiers (Configurable by Tenant)

Tenants can create any number of tiers with custom names, discounts, and earn multipliers.
Customers can be **manually assigned** to a tier or **automatically upgraded** when their cumulative spending reaches the tier threshold.

```
  TENANT SETS UP TIERS:
  ═════════════════════════════════════════════════════════════

  ┌──────────────────────────────────────────────────────────────────────┐
  │                        MEMBERSHIP TIERS                             │
  │                                                                     │
  │  Tier Name    Min Spend    Discount    Points Multiplier            │
  │  ─────────    ─────────    ────────    ─────────────────            │
  │                                                                     │
  │  (No Tier)    RM0          0% off      1.0x (base rate)             │
  │      │                                                              │
  │      ▼                                                              │
  │  Silver       RM500        2% off      1.2x points                  │
  │      │                                                              │
  │      ▼                                                              │
  │  Gold         RM2,000      5% off      1.5x points                  │
  │      │                                                              │
  │      ▼                                                              │
  │  VIP          RM5,000      10% off     2.0x points                  │
  │                                                                     │
  └──────────────────────────────────────────────────────────────────────┘

  Each tier is fully customizable:
  - Tenant chooses how many tiers (2, 3, 5... any number)
  - Tenant names them anything ("Bronze", "Platinum", "Diamond"...)
  - Tenant sets the spend threshold for auto-upgrade
  - Tenant sets the discount % and points multiplier per tier
```

#### How Auto-Upgrade Works

```
  CUSTOMER JOURNEY THROUGH TIERS:
  ═══════════════════════════════════════════════════════════

  Customer total spend: RM0                     Tier: (none)
  ┌──────────────────────────────────────────────────────────┐
  │  Purchase: RM100                                         │
  │  Discount: 0%    -> Pays RM100                           │
  │  Points:   100 x 1.0 = 100 pts                          │
  │  Total spend: RM100                                      │
  └──────────────────────────────────────────────────────────┘
                              │
                         (keeps spending...)
                              │
  Customer total spend: RM500                   Tier: Silver!
  ┌──────────────────────────────────────────────────────────┐
  │  AUTO-UPGRADE: Total spend hit RM500 -> Silver tier      │
  │                                                          │
  │  Purchase: RM80                                          │
  │  Discount: 2%    -> Pays RM78.40                         │
  │  Points:   80 x 1.2 = 96 pts (20% bonus!)               │
  │  Total spend: RM580                                      │
  └──────────────────────────────────────────────────────────┘
                              │
                         (keeps spending...)
                              │
  Customer total spend: RM2,000                 Tier: Gold!
  ┌──────────────────────────────────────────────────────────┐
  │  AUTO-UPGRADE: Total spend hit RM2,000 -> Gold tier      │
  │                                                          │
  │  Purchase: RM120                                         │
  │  Discount: 5%    -> Pays RM114                           │
  │  Points:   120 x 1.5 = 180 pts (50% bonus!)             │
  │  Total spend: RM2,120                                    │
  └──────────────────────────────────────────────────────────┘
                              │
                         (keeps spending...)
                              │
  Customer total spend: RM5,000                 Tier: VIP!
  ┌──────────────────────────────────────────────────────────┐
  │  AUTO-UPGRADE: Total spend hit RM5,000 -> VIP tier       │
  │                                                          │
  │  Purchase: RM200                                         │
  │  Discount: 10%   -> Pays RM180                           │
  │  Points:   200 x 2.0 = 400 pts (double!)                │
  │  Total spend: RM5,200                                    │
  └──────────────────────────────────────────────────────────┘
```

#### Manual Tier Assignment

```
  Managers can also manually assign any customer to any tier:

  USE CASES:
  ─────────────────────────────────────────────────────────
  1. VIP guest / business partner
     -> Assign directly to VIP tier regardless of spend

  2. Corporate account / bulk customer
     -> Assign to Gold tier as part of a deal

  3. Downgrade for abuse
     -> Move customer from VIP back to Silver

  4. New shop migration
     -> Import existing loyal customers at their earned tier
```

#### Tier Configuration Examples by Business Type

```
  LAUNDRY SHOP (3 tiers):
  ┌───────────┬────────────┬──────────┬────────────────┐
  │ Tier      │ Min Spend  │ Discount │ Points         │
  ├───────────┼────────────┼──────────┼────────────────┤
  │ Member    │ RM200      │ 3%       │ 1.2x           │
  │ Gold      │ RM1,000    │ 7%       │ 1.5x           │
  │ VIP       │ RM3,000    │ 12%      │ 2.0x           │
  └───────────┴────────────┴──────────┴────────────────┘

  RETAIL SHOP (4 tiers):
  ┌───────────┬────────────┬──────────┬────────────────┐
  │ Tier      │ Min Spend  │ Discount │ Points         │
  ├───────────┼────────────┼──────────┼────────────────┤
  │ Bronze    │ RM300      │ 2%       │ 1.0x           │
  │ Silver    │ RM1,000    │ 5%       │ 1.3x           │
  │ Gold      │ RM3,000    │ 8%       │ 1.5x           │
  │ Platinum  │ RM10,000   │ 15%      │ 2.5x           │
  └───────────┴────────────┴──────────┴────────────────┘

  CAFE / F&B (2 tiers - simple):
  ┌───────────┬────────────┬──────────┬────────────────┐
  │ Tier      │ Min Spend  │ Discount │ Points         │
  ├───────────┼────────────┼──────────┼────────────────┤
  │ Regular   │ RM100      │ 5%       │ 1.5x           │
  │ VIP       │ RM500      │ 10%      │ 2.0x           │
  └───────────┴────────────┴──────────┴────────────────┘
```

#### How Tier Discount Works at Checkout

```
  CASHIER SCREEN (during sale):
  ═══════════════════════════════════════════════

  ┌──────────────────────────────────────────────────────────┐
  │  Customer: John Doe                                      │
  │  Tier:     ★ Gold (5% discount)                          │
  │  Points:   1,250 pts                                     │
  │                                                          │
  │  ┌────────────────────────────────────────────────────┐  │
  │  │  Items:                                            │  │
  │  │  - Wash & Fold 5kg      RM25.00                    │  │
  │  │  - Dry Clean Jacket     RM30.00                    │  │
  │  │                         ────────                   │  │
  │  │  Subtotal:              RM55.00                    │  │
  │  │  Gold Discount (5%):   -RM2.75                     │  │
  │  │  Redeem 200 pts:       -RM2.00                     │  │
  │  │                         ────────                   │  │
  │  │  TOTAL:                 RM50.25                    │  │
  │  │                                                    │  │
  │  │  Points earned: 50.25 x 1.5 = 75 pts              │  │
  │  │  New balance: 1,125 pts                            │  │
  │  └────────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────────┘

  Both tier discount AND point redemption can apply in the same sale!
```

---

## 4. Subscription Packages

### 4.1 Package Types

```
  ┌─────────────────────────────────────────────────────────────────┐
  │                    SUBSCRIPTION PACKAGES                        │
  │                                                                 │
  │   ┌───────────────────────┐     ┌───────────────────────────┐   │
  │   │    USAGE-BASED        │     │      TIME-BASED           │   │
  │   │                       │     │                           │   │
  │   │  Customer buys a      │     │  Customer subscribes to   │   │
  │   │  fixed number of      │     │  a plan for a period      │   │
  │   │  uses upfront         │     │  with ongoing benefits    │   │
  │   │                       │     │                           │   │
  │   │  Examples:             │     │  Examples:                │   │
  │   │  - 10 washes @ RM80   │     │  - Monthly @ RM99        │   │
  │   │    (save RM20)        │     │    (10% off all washes)   │   │
  │   │  - 20 drinks @ RM60   │     │  - Annual @ RM899        │   │
  │   │    (save RM40)        │     │    (RM5 off every sale)   │   │
  │   │  - 5 haircuts @ RM100 │     │                           │   │
  │   │                       │     │                           │   │
  │   │  ┌─────────────────┐  │     │  ┌─────────────────────┐  │   │
  │   │  │ Tracks: remaining│  │     │  │ Tracks: start date, │  │   │
  │   │  │ quota (count)    │  │     │  │ end date, discount  │  │   │
  │   │  └─────────────────┘  │     │  └─────────────────────┘  │   │
  │   └───────────────────────┘     └───────────────────────────┘   │
  └─────────────────────────────────────────────────────────────────┘
```

### 4.2 Subscription Lifecycle

```
  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
  │          │     │          │     │          │     │          │
  │  ACTIVE  │────>│  PAUSED  │────>│  ACTIVE  │────>│ EXPIRED  │
  │          │     │          │     │          │     │          │
  └──────────┘     └──────────┘     └──────────┘     └──────────┘
       │                                                   ▲
       │                                                   │
       │           ┌──────────┐                            │
       └──────────>│CANCELLED │              Usage-based: quota = 0
                   │          │              Time-based: end date passed
                   └──────────┘
```

### 4.3 Usage-Based Flow

```
  Customer buys "10 Washes Pack" (RM80)
  ═══════════════════════════════════════

  Purchase         After       After       After         After
  ─────────       Wash 1      Wash 5      Wash 9       Wash 10

  Remaining:      Remaining:  Remaining:  Remaining:   Remaining:
  ┌────────┐     ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐
  │████████│     │███████ │  │█████   │  │█       │  │        │
  │  10/10 │     │  9/10  │  │  5/10  │  │  1/10  │  │  0/10  │
  │████████│     │███████ │  │█████   │  │█       │  │EXPIRED │
  └────────┘     └────────┘  └────────┘  └────────┘  └────────┘
  Status:         Status:     Status:     Status:      Status:
  ACTIVE          ACTIVE      ACTIVE      ACTIVE       EXPIRED
```

### 4.5 Multi-Device Concurrency Protection

> **Why this matters:** Multiple cashiers on different devices may try to use
> the same customer's subscription at the same time. The server MUST validate
> remaining quota to prevent double usage.

```
  THE PROBLEM: Race Condition
  ═══════════════════════════════════════════════════════════

  Customer has 1 wash remaining on their subscription.
  Two cashiers serve this customer's family at the same time.

  Device A (Cashier 1)              Device B (Cashier 2)
  ────────────────────              ────────────────────
  Sees: 1 wash remaining           Sees: 1 wash remaining
  Applies subscription              Applies subscription
  Completes sale (RM0)              Completes sale (RM0)

  WITHOUT server validation:
  ┌─────────────────────────────────────────────────────────┐
  │  Both devices deduct 1 wash                            │
  │  Remaining goes to -1 (impossible!)                    │
  │  Tenant gives away a FREE wash = lost revenue          │
  └─────────────────────────────────────────────────────────┘


  THE SOLUTION: Server-Side Validation with Optimistic Locking
  ═══════════════════════════════════════════════════════════

  Device A (Cashier 1)              Device B (Cashier 2)
  ────────────────────              ────────────────────
  Completes sale (RM0)              Completes sale (RM0)
  Calls server: use 1 wash         Calls server: use 1 wash
       │                                 │
       ▼                                 ▼
  ┌──────────────────┐             ┌──────────────────┐
  │ Server TX starts │             │ Server TX starts │
  │ Read quota = 1   │             │ Read quota = 1   │
  │ 1 >= 1 ? YES     │             │ Version check... │
  │ Deduct, ver 1→2  │             │ Version changed! │
  │ ──── SUCCESS ──── │             │ ──── REJECT ──── │
  └──────────────────┘             └──────────────────┘
       │                                 │
       ▼                                 ▼
  Quota = 0                        Error returned to app
  Status = EXPIRED                 App shows: "Subscription
                                   fully used. Charging
                                   normal price: RM10"

  RESULT: Only 1 wash is consumed. No free rides!
```

This same protection applies to **loyalty point redemption** — if two devices try to redeem the same points simultaneously, only one succeeds.

```
  HOW THE SERVER VALIDATES (for developers):
  ═══════════════════════════════════════════════════════════

  1. All quota/balance changes happen inside a database TRANSACTION
  2. Server re-reads the current balance INSIDE the transaction
     (not trusting the client's cached data)
  3. Uses VERSION field for optimistic locking:
     - Read current version number
     - Update with condition: WHERE version = readVersion
     - If another device changed it first → version won't match
     - 0 rows updated = conflict detected → reject and return error
  4. Flutter app handles the error gracefully:
     - Shows user-friendly message
     - Reverts to normal pricing
     - Refreshes subscription data from server
```

### 4.4 Time-Based Flow

```
  Customer subscribes to "Monthly Plan" (RM99, 10% off)
  ══════════════════════════════════════════════════════

  Mar 1            Mar 15            Mar 31           Apr 1
  Subscribe        Makes sale        Last day         Expired
  ─────────        ──────────        ─────────        ─────────

  ┌──────────┐    ┌──────────┐     ┌──────────┐    ┌──────────┐
  │ ACTIVE   │    │ RM50 sale│     │ ACTIVE   │    │ EXPIRED  │
  │          │    │ -10% off │     │          │    │          │
  │ Start:   │    │ = RM45   │     │ End date │    │ Needs    │
  │ Mar 1    │    │          │     │ tomorrow │    │ renewal  │
  │ End:     │    │ Discount │     │          │    │          │
  │ Mar 31   │    │ applied! │     │          │    │          │
  └──────────┘    └──────────┘     └──────────┘    └──────────┘
```

---

## 5. How It Fits Into the Current System

### 5.1 Architecture Overview

```
  ┌──────────────────────────────────────────────────────────┐
  │                    FLUTTER APP (Client)                   │
  │                                                          │
  │   Calculates:                                            │
  │   - Points to earn (totalAmount x pointsPerCurrency)     │
  │   - Points to redeem (points x currencyPerPoint)         │
  │   - Subscription discount (% or fixed amount)            │
  │   - Remaining quota after usage                          │
  └──────────────────────┬───────────────────────────────────┘
                         │
                    API Calls
                         │
  ┌──────────────────────▼───────────────────────────────────┐
  │                    SERVER (Backend)                       │
  │                                                          │
  │   Responsibilities:                                      │
  │   - Store loyalty program config & membership tiers      │
  │   - Manage customer accounts, balances & tier status     │
  │   - Validate & record point transactions                 │
  │   - Manage subscription packages                         │
  │   - Track subscription usage & quotas                    │
  │   - VALIDATE quota/points before deducting               │
  │     (prevents race conditions across devices)            │
  │   - Record everything on Sales for reporting             │
  └──────────────────────┬───────────────────────────────────┘
                         │
  ┌──────────────────────▼───────────────────────────────────┐
  │                  TENANT DATABASE                          │
  │                                                          │
  │   New tables:                                            │
  │   - loyalty_program        (config)                      │
  │   - loyalty_account        (per customer)                │
  │   - loyalty_transaction    (audit trail)                 │
  │   - subscription_package   (package definitions)         │
  │   - customer_subscription  (customer enrollments)        │
  │   - subscription_usage     (usage audit trail)           │
  │                                                          │
  │   Modified tables:                                       │
  │   - customer  (new relations)                            │
  │   - sales     (loyalty/subscription tracking fields)     │
  └──────────────────────────────────────────────────────────┘
```

### 5.2 Sales Flow — Before vs After

```
  BEFORE (current):
  ═══════════════════════════════════════════════

  Customer ──> Select Items ──> Pay ──> Done


  AFTER (with loyalty + subscription):
  ═══════════════════════════════════════════════

  Customer ──> Select Items ──┬──> Has subscription?
                              │     │
                              │     ├── Yes (usage-based): Deduct from quota
                              │     ├── Yes (time-based): Apply discount
                              │     └── No: Normal pricing
                              │
                              ├──> Redeem loyalty points?
                              │     │
                              │     ├── Yes: Apply points as discount
                              │     └── No: Skip
                              │
                              ├──> Pay ──> Complete Sale
                              │
                              └──> Post-sale (server validates):
                                    ├── Earn loyalty points
                                    ├── Record subscription usage
                                    │   (server checks quota is
                                    │    still available before
                                    │    deducting — prevents
                                    │    double-use across devices)
                                    └── Update all balances
```

---

## 6. User Flows

### 6.1 Cashier — Sale with Loyalty Points

```
  ┌─────────┐   ┌───────────────┐   ┌────────────────┐   ┌───────────────┐
  │  Scan/   │   │ Select        │   │ Customer has   │   │ Customer      │
  │  Select  │──>│ Customer      │──>│ 500 points     │──>│ wants to      │
  │  Items   │   │ (optional)    │   │ (shown on      │   │ redeem 200    │
  │          │   │               │   │  screen)       │   │ points        │
  └─────────┘   └───────────────┘   └────────────────┘   └───────┬───────┘
                                                                  │
  ┌─────────────────────────────────────────────────────────────────┘
  │
  ▼
  ┌────────────────┐   ┌────────────────┐   ┌────────────────────────┐
  │ App calculates │   │ Customer pays  │   │ After payment:         │
  │ discount:      │──>│ RM48 (after    │──>│ - Earn 48 points       │
  │ 200 pts = RM2  │   │ RM2 discount)  │   │ - Deduct 200 pts      │
  │ off RM50       │   │                │   │ - New balance: 348 pts │
  └────────────────┘   └────────────────┘   └────────────────────────┘
```

### 6.2 Manager — Setting Up Loyalty

```
  ┌────────────────┐   ┌─────────────────────┐   ┌─────────────────┐
  │ Go to Settings │   │ Configure:          │   │ Program goes    │
  │ > Loyalty      │──>│ - 1 pt per RM1      │──>│ LIVE            │
  │   Program      │   │ - 100 pts = RM1 off │   │                 │
  │                │   │ - Expiry: 1 year    │   │ All customers   │
  │                │   │ - Min redeem: 100   │   │ can be enrolled │
  └────────────────┘   └─────────────────────┘   └─────────────────┘
```

### 6.3 Manager — Creating a Subscription Package

```
  ┌────────────────┐   ┌─────────────────────┐   ┌─────────────────┐
  │ Go to Settings │   │ Create Package:     │   │ Package is      │
  │ > Subscription │──>│                     │──>│ available for   │
  │   Packages     │   │ "10 Washes Pack"    │   │ customers to    │
  │                │   │ Type: Usage-based   │   │ purchase        │
  │                │   │ Price: RM80         │   │                 │
  │                │   │ Quota: 10 washes    │   │                 │
  │                │   │ Valid for: 90 days  │   │                 │
  └────────────────┘   └─────────────────────┘   └─────────────────┘
```

### 6.4 Cashier — Sale with Subscription

```
  ┌─────────┐   ┌───────────────┐   ┌────────────────┐   ┌───────────────┐
  │  Select  │   │ Select        │   │ Customer has   │   │ Apply         │
  │  "Wash   │──>│ Customer      │──>│ active sub:    │──>│ subscription: │
  │  Service"│   │               │   │ "10 Washes"    │   │ No charge for │
  │          │   │               │   │ 7/10 remaining │   │ this wash     │
  └─────────┘   └───────────────┘   └────────────────┘   └───────┬───────┘
                                                                  │
  ┌─────────────────────────────────────────────────────────────────┘
  │
  ▼
  ┌────────────────┐   ┌────────────────────────────────────────────┐
  │ Complete Sale   │   │ After sale:                               │
  │ Total: RM0.00  │──>│ - Remaining washes: 6/10                  │
  │ (covered by    │   │ - Usage recorded with timestamp           │
  │  subscription) │   │ - If last wash: subscription -> EXPIRED   │
  └────────────────┘   └────────────────────────────────────────────┘
```

---

## 7. Data Model

### 7.1 Entity Relationship Diagram

```
  ┌──────────────────┐
  │  LoyaltyProgram  │
  │──────────────────│
  │  id              │
  │  name            │        ┌──────────────────────┐
  │  pointsPerCurr.  │        │    LoyaltyTier       │
  │  currencyPerPt.  │        │──────────────────────│
  │  expiryDays      │  1   * │  id                  │
  │  minRedeemPts    ├────────►  name (Silver/Gold..)│
  │  isActive        │        │  minSpend            │
  └────────┬─────────┘        │  discountPercentage  │
           │ 1                │  pointsMultiplier    │
           │                  │  sortOrder           │
           │ many             └──────────┬───────────┘
  ┌────────▼─────────┐                   │
  │  LoyaltyAccount  │ 1 (optional)      │
  │──────────────────├───────────────────┘
  │  id              │
  │  currentPoints   │        ┌──────────────────────┐
  │  totalEarned     │        │  LoyaltyTransaction  │
  │  totalRedeemed   │        │──────────────────────│
  │  totalSpend      │ 1    * │  id                  │
  │  loyaltyTierId   ├────────►  type (EARN/REDEEM   │
  │  isManualTier    │        │        /ADJUST/...)  │
  │  joinedAt        │        │        (idempotent)  │
  └────────▲─────────┘        │  points              │
           │ *                │  balanceAfter        │
           │                  │  salesId (optional)  │
           │ 1                │  performedBy         │
  ┌────────┴──────────────────┴──────────────────────────────────┐
  │                          Customer                             │
  │───────────────────────────────────────────────────────────────│
  │  id  │  firstName  │  lastName  │  mobile  │  email          │
  └────────┬──────────────────────────────────────────────────────┘
           │ 1
           │
           │ *
  ┌────────▼──────────────┐        ┌──────────────────────┐
  │ CustomerSubscription  │ 1    * │  SubscriptionUsage   │
  │───────────────────────├────────►──────────────────────│
  │  id                   │        │  id                  │
  │  status (ACTIVE/...)  │        │  salesId             │
  │  startDate            │        │  quantityUsed        │
  │  endDate              │        │  remainingAfter      │
  │  remainingQuota       │        │  performedBy         │
  │  usedQuota            │        │  (idempotent)        │
  │  paidAmount           │        └──────────────────────┘
  │  packageSnapshot      │
  └────────▲──────────────┘
           │ *
           │
           │ 1
  ┌────────┴──────────────┐
  │ SubscriptionPackage   │
  │───────────────────────│
  │  id                   │
  │  name                 │
  │  packageType          │
  │  (USAGE / TIME)       │
  │  price                │
  │  totalQuota           │
  │  quotaUnit            │
  │  durationDays         │
  │  discountPercentage   │
  │  discountAmount       │
  │  validityDays         │
  │  isActive             │
  └───────────────────────┘


  ┌──────────────────────────────────────────────────────────────┐
  │                       Sales (modified)                       │
  │──────────────────────────────────────────────────────────────│
  │  ...existing fields...                                       │
  │  + loyaltyPointsEarned    (Decimal, optional)                │
  │  + loyaltyPointsRedeemed  (Decimal, optional)                │
  │  + subscriptionId         (Int, optional)                    │
  └──────────────────────────────────────────────────────────────┘
```

### 7.2 New Database Tables Summary

| Table                   | Purpose                                             | Key Fields                                                          |
| ----------------------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| `loyalty_program`       | Tenant-level config for the loyalty program         | points rates, expiry, min redeem                                    |
| `loyalty_tier`          | Membership tiers (Silver, Gold, VIP...)             | name, minSpend, discountPercentage, pointsMultiplier                |
| `loyalty_account`       | One per customer, tracks their point balance & tier | currentPoints, totalEarned, totalSpend, loyaltyTierId, isManualTier |
| `loyalty_transaction`   | Audit log of every point change                     | type, points, balanceAfter, salesId                                 |
| `subscription_package`  | Package definitions created by tenant               | type, price, quota, duration, discount                              |
| `customer_subscription` | Links a customer to a purchased package             | status, remainingQuota, usedQuota, dates, packageSnapshot           |
| `subscription_usage`    | Audit log of every subscription use                 | quantityUsed, remainingAfter, salesId                               |

---

## 8. API Reference

### 8.1 Loyalty Endpoints

| Method   | Endpoint                            | Description                                     | Who Uses It         |
| -------- | ----------------------------------- | ----------------------------------------------- | ------------------- |
| `GET`    | `/loyalty/program`                  | Get loyalty program config (includes tiers)     | App (to show rates) |
| `POST`   | `/loyalty/program`                  | Create loyalty program                          | Manager             |
| `PUT`    | `/loyalty/program/:id`              | Update loyalty program                          | Manager             |
| `POST`   | `/loyalty/tier`                     | Create a membership tier                        | Manager             |
| `PUT`    | `/loyalty/tier/:id`                 | Update a membership tier                        | Manager             |
| `DELETE` | `/loyalty/tier/:id`                 | Remove a membership tier                        | Manager             |
| `GET`    | `/loyalty/tier/program/:programId`  | List all tiers for a program                    | App / Manager       |
| `POST`   | `/loyalty/enroll`                   | Enroll customer in loyalty                      | Cashier / Auto      |
| `GET`    | `/loyalty/account/customer/:id`     | Get customer's points, tier, & balance          | Cashier             |
| `POST`   | `/loyalty/account/:id/earn`         | Record points earned (auto-checks tier upgrade) | App (post-sale)     |
| `POST`   | `/loyalty/account/:id/redeem`       | Record points redeemed in sale                  | App (during sale)   |
| `POST`   | `/loyalty/account/:id/adjust`       | Manual point adjustment                         | Manager             |
| `POST`   | `/loyalty/account/:id/refund`       | Return points (void/return)                     | App (on void)       |
| `PUT`    | `/loyalty/account/:id/tier`         | Manually assign customer to a tier              | Manager             |
| `GET`    | `/loyalty/account/:id/transactions` | Point history (paginated)                       | Manager / Customer  |

### 8.2 Subscription Endpoints

| Method   | Endpoint                     | Description                      | Who Uses It       |
| -------- | ---------------------------- | -------------------------------- | ----------------- |
| `GET`    | `/subscription/package`      | List all packages                | Cashier / Manager |
| `GET`    | `/subscription/package/:id`  | Get package details              | Cashier           |
| `POST`   | `/subscription/package`      | Create a package                 | Manager           |
| `PUT`    | `/subscription/package/:id`  | Update a package                 | Manager           |
| `DELETE` | `/subscription/package/:id`  | Remove a package                 | Manager           |
| `POST`   | `/subscription/subscribe`    | Subscribe customer to a package  | Cashier           |
| `GET`    | `/subscription/customer/:id` | Get customer's subscriptions     | Cashier           |
| `POST`   | `/subscription/usage`        | Record usage from a sale         | App (post-sale)   |
| `PUT`    | `/subscription/cancel/:id`   | Cancel a subscription            | Manager           |
| `GET`    | `/subscription/usage/:id`    | Usage history for a subscription | Manager           |

---

## 9. Permissions & Access Control

New permissions are grouped into two categories:

```
  LOYALTY                              SUBSCRIPTIONS
  ═══════                              ═════════════

  ┌────────────────────────────┐       ┌──────────────────────────────────┐
  │ Manage Loyalty Program     │       │ Manage Subscription Packages     │
  │ (create/edit program)      │       │ (create/edit/delete packages)    │
  ├────────────────────────────┤       ├──────────────────────────────────┤
  │ View Loyalty Accounts      │       │ View Customer Subscriptions      │
  │ (see balances & history)   │       │ (see active subs & usage)        │
  ├────────────────────────────┤       ├──────────────────────────────────┤
  │ Adjust Loyalty Points      │       │ Manage Customer Subscriptions    │
  │ (manual add/remove points) │       │ (subscribe/cancel customers)     │
  └────────────────────────────┘       └──────────────────────────────────┘
```

**Typical role assignments:**

| Role              | Loyalty Permissions   | Subscription Permissions    |
| ----------------- | --------------------- | --------------------------- |
| **Owner / Admin** | All                   | All                         |
| **Manager**       | All                   | All                         |
| **Cashier**       | View Loyalty Accounts | View Customer Subscriptions |
| **Staff**         | None                  | None                        |

---

## 10. Business Scenarios

### Scenario 1: Laundry Shop

```
  LOYALTY SETUP:
  - 1 point per RM1 spent
  - 100 points = RM1 discount
  - Points expire after 1 year

  SUBSCRIPTION PACKAGES:
  ┌─────────────────────────────────────────────────────┐
  │  "Basic Wash Pack"    │ 10 washes  │ RM80  (RM8/ea) │  save RM20
  │  "Premium Wash Pack"  │ 20 washes  │ RM140 (RM7/ea) │  save RM60
  │  "Monthly Unlimited"  │ 30 days    │ RM99  (15% off)│  high-value customers
  └─────────────────────────────────────────────────────┘
```

### Scenario 2: Retail Shop

```
  LOYALTY SETUP:
  - 1 point per RM1 spent
  - 200 points = RM1 discount (lower redemption rate)
  - No expiry

  SUBSCRIPTION PACKAGES:
  ┌──────────────────────────────────────────────────────┐
  │  "VIP Monthly"   │ 30 days  │ RM29/mo │ 5% off all  │
  │  "VIP Annual"    │ 365 days │ RM249/yr│ 10% off all │
  └──────────────────────────────────────────────────────┘
```

### Scenario 3: F&B / Restaurant

```
  LOYALTY SETUP:
  - 1 point per RM1 spent
  - 50 points = RM1 discount (higher redemption rate, more rewards)
  - Points expire after 6 months

  SUBSCRIPTION PACKAGES:
  ┌─────────────────────────────────────────────────────────┐
  │  "Coffee Lover"   │ 20 drinks │ RM60  (RM3/ea)  │ save RM40
  │  "Lunch Pass"     │ 30 days   │ RM199 │ RM3 off/meal │
  └─────────────────────────────────────────────────────────┘
```

### Combined Example: Customer Journey at a Laundry Shop

```
  DAY 1 ─────────────────────────────────────────────────────────

    Customer: "I wash here often, any deals?"
    Cashier: Enrolls customer in loyalty + sells "10 Wash Pack" (RM80)

    Result:
    - Loyalty account created (0 points)
    - Subscription: 10 washes remaining
    - Payment: RM80 collected

  DAY 5 ─────────────────────────────────────────────────────────

    Customer brings laundry (normal wash)
    Cashier selects customer -> sees 10/10 washes remaining
    Applies subscription -> RM0 charge

    Result:
    - Subscription: 9 washes remaining
    - Loyalty: 0 points (no spend, so no points earned)

  DAY 12 ────────────────────────────────────────────────────────

    Customer brings laundry + buys detergent (RM15)
    Cashier applies subscription for wash (RM0) + charges RM15 for detergent

    Result:
    - Subscription: 8 washes remaining
    - Loyalty: +15 points earned (from detergent purchase)

  DAY 60 ────────────────────────────────────────────────────────

    Customer has used all 10 washes (subscription expired)
    Customer has accumulated 200 loyalty points from additional purchases
    Customer redeems 100 points = RM1 off next wash

    Normal wash RM10 - RM1 loyalty = RM9
    Earns 9 more points

    Result:
    - Subscription: EXPIRED (can buy new pack)
    - Loyalty: 109 points (200 - 100 + 9)

    Cashier: "Would you like to buy another 10 Wash Pack?"
```

---

## Summary

| Feature                   | Purpose                             | Revenue Impact                  |
| ------------------------- | ----------------------------------- | ------------------------------- |
| **Loyalty Program**       | Reward repeat customers with points | Increases visit frequency       |
| **Subscription Packages** | Let customers prepay for services   | Guarantees upfront revenue      |
| **Combined**              | Lock customers into your ecosystem  | Higher retention + higher spend |

Both features are **tenant-configurable** — each laundry shop, retail store, or restaurant can set their own rates, packages, and rules to fit their business.

---

## 11. Loyalty Use Cases & Flexible Configurations

> Every tenant configures their own loyalty program through the POS settings.
> Below are real-world use cases showing how different businesses can tailor the system.

### Use Case 1: Aggressive Customer Acquisition (New Shop)

**Scenario:** A newly opened laundry shop wants to build a customer base fast.

```
  TENANT CONFIGURATION:
  ┌──────────────────────────────────────────────────────────┐
  │  pointsPerCurrency:  2.0     (2 points per RM1 - 2x!)   │
  │  currencyPerPoint:   0.01    (100 pts = RM1)             │
  │  pointsExpiryDays:   null    (no expiry - generous)      │
  │  minRedeemPoints:    50      (low threshold - easy wins)  │
  └──────────────────────────────────────────────────────────┘

  WHY THIS WORKS:
  ┌─────────────────────────────────────────────────────────────┐
  │  Customer spends RM50 -> earns 100 points (normally 50)    │
  │  Can redeem after just RM25 of spending (50 points)        │
  │  Points never expire -> customers feel safe accumulating   │
  │                                                            │
  │  RESULT: Faster rewards = customers choose this shop       │
  │          over competitors without loyalty programs          │
  └─────────────────────────────────────────────────────────────┘

  CUSTOMER EXPERIENCE:
  ─────────────────────────────────────────────────────────
  Visit 1:  Spend RM50  -> Earn 100 pts   (Balance: 100)
  Visit 2:  Spend RM30  -> Earn 60 pts    (Balance: 160)
            Redeem 100 pts = RM1 off
            Pay RM29    -> Earn 58 pts    (Balance: 118)
  Visit 3:  Already hooked as a regular!
```

---

### Use Case 2: High-Value Rewards (Premium Retail)

**Scenario:** A boutique retail shop wants to reward big spenders with meaningful discounts.

```
  TENANT CONFIGURATION:
  ┌──────────────────────────────────────────────────────────┐
  │  pointsPerCurrency:  1.0     (1 point per RM1)           │
  │  currencyPerPoint:   0.05    (20 pts = RM1 - high value) │
  │  pointsExpiryDays:   365     (1 year expiry)             │
  │  minRedeemPoints:    200     (meaningful threshold)       │
  └──────────────────────────────────────────────────────────┘

  WHY THIS WORKS:
  ┌─────────────────────────────────────────────────────────────┐
  │  Points have real value: 200 pts = RM10 off!               │
  │  Encourages larger purchases to hit the 200 pt threshold   │
  │  1-year expiry creates urgency to visit again              │
  │                                                            │
  │  RESULT: Bigger basket sizes + annual retention cycle      │
  └─────────────────────────────────────────────────────────────┘

  CUSTOMER EXPERIENCE:
  ─────────────────────────────────────────────────────────
  Purchase 1:  RM120 jacket  -> 120 pts  (Balance: 120)
               "80 more points to unlock RM10 off!"
  Purchase 2:  RM85 shoes    -> 85 pts   (Balance: 205)
               "You can redeem RM10 off today!"
  Purchase 3:  RM60 shirt - RM10 = RM50  (saves money!)
```

---

### Use Case 3: Frequent Small Purchases (Coffee Shop / F&B)

**Scenario:** A cafe wants to reward daily coffee buyers.

```
  TENANT CONFIGURATION:
  ┌──────────────────────────────────────────────────────────┐
  │  pointsPerCurrency:  1.0     (1 point per RM1)           │
  │  currencyPerPoint:   0.10    (10 pts = RM1 - fast!)      │
  │  pointsExpiryDays:   90      (3 months - stay active)    │
  │  minRedeemPoints:    50      (achievable in ~1 week)      │
  └──────────────────────────────────────────────────────────┘

  WHY THIS WORKS:
  ┌─────────────────────────────────────────────────────────────┐
  │  Daily RM7 coffee = 7 pts/day                              │
  │  After 8 days -> 56 pts -> can redeem RM5 off              │
  │  Short expiry (90 days) prevents stale accounts            │
  │  Fast rewards match the "daily habit" buying pattern       │
  │                                                            │
  │  RESULT: Daily visits become habitual, high frequency      │
  └─────────────────────────────────────────────────────────────┘

  CUSTOMER EXPERIENCE:
  ─────────────────────────────────────────────────────────
  Mon-Fri:   RM7/day x 5 days = 35 pts   (Balance: 35)
  Next week: RM7/day x 3 days = 21 pts   (Balance: 56)
             Redeem 50 pts = RM5 off!
             Pay RM2 for a RM7 coffee     (Balance: 8)
             "Free coffee feeling" -> keeps coming back
```

---

### Use Case 4: Seasonal Campaigns (Any Business)

**Scenario:** A tenant wants to run a double-points event during a slow month.

```
  NORMAL CONFIGURATION:
  ┌──────────────────────────────────────────────────────────┐
  │  pointsPerCurrency:  1.0     (1 point per RM1)           │
  └──────────────────────────────────────────────────────────┘

  CAMPAIGN PERIOD (tenant updates config):
  ┌──────────────────────────────────────────────────────────┐
  │  pointsPerCurrency:  2.0     (DOUBLE POINTS!)            │
  │                                                          │
  │  "February Double Points Festival"                       │
  │  Tenant changes rate -> announces to customers           │
  │  End of Feb -> changes back to 1.0                       │
  └──────────────────────────────────────────────────────────┘

  TIMELINE:
  ─────────────────────────────────────────────────────────

  Jan (normal)         Feb (campaign)       Mar (normal)
  ┌──────────┐        ┌──────────────┐     ┌──────────┐
  │ 1 pt/RM  │  ───>  │ 2 pts/RM !!! │ ──> │ 1 pt/RM  │
  │          │        │              │     │          │
  │ Slow     │        │ Customers    │     │ Back to  │
  │ month    │        │ rush in for  │     │ normal   │
  │          │        │ double pts   │     │          │
  └──────────┘        └──────────────┘     └──────────┘
```

---

### Use Case 5: Conservative / Low-Cost Loyalty (Budget-Conscious Tenant)

**Scenario:** A small laundry shop wants loyalty but can't afford big discounts.

```
  TENANT CONFIGURATION:
  ┌──────────────────────────────────────────────────────────┐
  │  pointsPerCurrency:  1.0     (1 point per RM1)           │
  │  currencyPerPoint:   0.005   (200 pts = RM1 - low cost)  │
  │  pointsExpiryDays:   180     (6 months)                  │
  │  minRedeemPoints:    500     (high threshold)             │
  └──────────────────────────────────────────────────────────┘

  WHY THIS WORKS:
  ┌─────────────────────────────────────────────────────────────┐
  │  Cost to tenant is very low: RM500 spent = RM2.50 reward   │
  │  That's only 0.5% of revenue given as discount             │
  │  Still gives customers a reason to come back               │
  │  High threshold = fewer redemptions = lower cost           │
  │                                                            │
  │  RESULT: Minimal cost to tenant, still drives retention    │
  └─────────────────────────────────────────────────────────────┘

  COST ANALYSIS FOR TENANT:
  ─────────────────────────────────────────────────────────
  If 100 customers spend RM100 each = RM10,000 revenue
  Points issued: 10,000
  Points redeemed (est 60%): 6,000 pts = RM30

  Loyalty cost: RM30 / RM10,000 = 0.3% of revenue
  That's RM30 to retain 100 customers!
```

---

### Use Case 6: Point Adjustment Scenarios

**Scenario:** Manager needs to handle special situations.

```
  SITUATION 1: Customer Complaint Resolution
  ─────────────────────────────────────────────────────────
  Customer received damaged laundry, not happy.
  Manager adds 500 bonus points as apology.

  Action: POST /loyalty/account/:id/adjust
  { points: 500, description: "Compensation - damaged item #1234" }

  Result: Customer feels valued, stays loyal.


  SITUATION 2: Voided/Returned Sale
  ─────────────────────────────────────────────────────────
  Customer returns a RM80 purchase (earned 80 pts from it).
  System automatically refunds 80 points on void.

  Action: POST /loyalty/account/:id/refund
  { salesId: 456, points: 80 }

  Result: Points balance corrected fairly.


  SITUATION 3: Data Correction
  ─────────────────────────────────────────────────────────
  Cashier accidentally processed sale under wrong customer.
  Manager deducts wrongly earned points.

  Action: POST /loyalty/account/:id/adjust
  { points: -50, description: "Correction - wrong customer on sale #789" }

  Result: Clean audit trail of the correction.
```

---

### Use Case 7: Subscription + Loyalty Combined Strategy

**Scenario:** Tenant wants to maximize customer lock-in using both features together.

```
  STRATEGY: "Subscribe & Earn"
  ═══════════════════════════════════════════════════════════

  Step 1: Sell subscription package
  ┌─────────────────────────────────────────────────────┐
  │  "20 Wash Super Pack" - RM160 (normally RM200)      │
  │  Customer pays RM160 upfront                        │
  │  -> Earns 160 loyalty points from the purchase!     │
  └─────────────────────────────────────────────────────┘

  Step 2: Customer uses subscription washes
  ┌─────────────────────────────────────────────────────┐
  │  Each wash = RM0 (covered by subscription)          │
  │  No loyalty points earned (no new spend)            │
  │                                                     │
  │  BUT customer buys add-ons:                         │
  │  - Fabric softener RM5 -> earns 5 pts               │
  │  - Express service RM8 -> earns 8 pts               │
  │  - Ironing RM10 -> earns 10 pts                     │
  └─────────────────────────────────────────────────────┘

  Step 3: Subscription runs out
  ┌─────────────────────────────────────────────────────┐
  │  Customer has 300+ loyalty points accumulated       │
  │  Can redeem points on next subscription purchase!   │
  │                                                     │
  │  "Buy another 20 Wash Pack at RM160"                │
  │  Redeem 300 pts = RM3 off -> pays RM157             │
  │  Earns 157 points from purchase                     │
  │                                                     │
  │  CYCLE CONTINUES -> customer is locked in!          │
  └─────────────────────────────────────────────────────┘


  CUSTOMER RETENTION CYCLE:
  ─────────────────────────────────────────────────────────

       ┌──────────┐
       │ Buy Pack │
       │ (earn    │
       │  points) │
       └────┬─────┘
            │
            ▼
       ┌──────────┐
       │ Use Pack │
       │ (buy     │──── add-ons earn more points
       │  washes) │
       └────┬─────┘
            │
            ▼
       ┌──────────┐
       │ Pack     │
       │ Runs Out │
       └────┬─────┘
            │
            ▼
       ┌──────────┐
       │ Redeem   │
       │ points   │──── discount on next pack
       │ on new   │
       │ pack     │
       └────┬─────┘
            │
            └──────── loops back to "Buy Pack"
```

---

### Configuration Flexibility Summary

Tenants can customize every aspect to match their business:

```
  ┌─────────────────────────────────────────────────────────────────────┐
  │                    WHAT TENANTS CAN CONFIGURE                      │
  │                                                                    │
  │  EARN RATE                        REDEMPTION VALUE                 │
  │  ──────────                       ────────────────                 │
  │  "How fast do                     "How much is                    │
  │   customers earn?"                 each point worth?"              │
  │                                                                    │
  │  0.5 pts/RM = slow earn           0.005 RM/pt = low cost to tenant│
  │  1.0 pts/RM = standard            0.01  RM/pt = standard          │
  │  2.0 pts/RM = aggressive          0.05  RM/pt = generous          │
  │  5.0 pts/RM = very generous       0.10  RM/pt = very generous     │
  │                                                                    │
  │                                                                    │
  │  EXPIRY                           MINIMUM REDEMPTION              │
  │  ──────                           ──────────────────              │
  │  "How long do                     "How many points before         │
  │   points last?"                    customer can redeem?"           │
  │                                                                    │
  │  null    = never expire           0   = redeem any amount         │
  │  90 days = 3 months               50  = low bar (easy)            │
  │  180     = 6 months               100 = standard                  │
  │  365     = 1 year                 500 = high bar (big rewards)    │
  │                                                                    │
  └─────────────────────────────────────────────────────────────────────┘
```

**Quick Reference — Choosing the Right Config:**

| Business Goal             | Earn Rate      | Point Value     | Expiry    | Min Redeem  |
| ------------------------- | -------------- | --------------- | --------- | ----------- |
| Build customer base fast  | High (2.0+)    | Standard (0.01) | None      | Low (50)    |
| Reward big spenders       | Standard (1.0) | High (0.05)     | 1 year    | High (200+) |
| Drive daily visits (F&B)  | Standard (1.0) | High (0.10)     | 90 days   | Low (50)    |
| Minimize cost to business | Standard (1.0) | Low (0.005)     | 6 months  | High (500)  |
| Seasonal promotion        | Temporary 2x   | Keep same       | Keep same | Keep same   |

---

## 12. Edge Cases & Race Conditions

> **For Developers:** This section documents all known edge cases and the strategies
> to handle them. Every concurrent scenario has been analyzed for data integrity.

### 12.1 Loyalty Point Race Conditions

```
  EDGE CASE: Concurrent Point Earning (Two Devices, Same Customer)
  ═══════════════════════════════════════════════════════════════════

  Customer walks into shop. Cashier A rings up RM50 detergent,
  Cashier B rings up RM30 dry cleaning. Both complete at the same time.

  Device A                               Device B
  ────────                               ────────
  Sale: RM50                             Sale: RM30
  POST /earn (50 pts)                    POST /earn (30 pts)
       │                                      │
       ▼                                      ▼
  ┌──────────────────────────────────────────────────────────┐
  │  Server uses ATOMIC INCREMENT (not read-then-write)      │
  │                                                          │
  │  UPDATE loyalty_account                                  │
  │  SET current_points = current_points + 50                │
  │  (Database handles the lock internally)                  │
  │                                                          │
  │  UPDATE loyalty_account                                  │
  │  SET current_points = current_points + 30                │
  │                                                          │
  │  RESULT: current_points = 80 ✓ (correct!)                │
  └──────────────────────────────────────────────────────────┘

  WHY read-then-write is DANGEROUS:
  ┌──────────────────────────────────────────────────────────┐
  │  Device A reads balance = 0                              │
  │  Device B reads balance = 0  (STALE!)                    │
  │  Device A writes: 0 + 50 = 50                            │
  │  Device B writes: 0 + 30 = 30  (OVERWRITES 50!)          │
  │  RESULT: current_points = 30 ✗ (LOST 50 points!)         │
  └──────────────────────────────────────────────────────────┘
```

```
  EDGE CASE: Duplicate Request (Network Retry)
  ═══════════════════════════════════════════════════════════════════

  Flutter sends "earn 50 pts for Sale #123" but network times out.
  Flutter retries the same request.

  Request 1                              Request 2 (retry)
  ─────────                              ─────────────────
  POST /earn                             POST /earn
  { salesId: 123, points: 50 }          { salesId: 123, points: 50 }
       │                                      │
       ▼                                      ▼
  ┌────────────────────┐             ┌────────────────────┐
  │ Creates transaction │             │ UNIQUE constraint   │
  │ salesId=123, EARN   │             │ violation!          │
  │ ──── SUCCESS ────── │             │ (salesId+type       │
  └────────────────────┘             │  already exists)    │
                                      │                    │
                                      │ Server returns:    │
                                      │ "Already processed"│
                                      │ ──── SUCCESS ──── │
                                      └────────────────────┘

  RESULT: Points only earned ONCE. Idempotent! ✓
```

```
  EDGE CASE: Void Sale After Points Already Spent
  ═══════════════════════════════════════════════════════════════════

  Timeline:
  1. Customer buys RM100 → earns 100 pts      (balance: 100)
  2. Customer redeems 80 pts on next sale      (balance: 20)
  3. Manager voids the original RM100 sale     → refund 100 pts?

  Problem: Refunding 100 pts would give balance = 120,
           but customer only earned 100 and spent 80.
           Creating 20 pts from thin air!

  Solution: CLAMP the refund
  ┌──────────────────────────────────────────────────────────┐
  │  Original earn: 100 pts                                  │
  │  Refund amount: 100 pts                                  │
  │  Current balance: 20 pts                                 │
  │                                                          │
  │  Server refunds 100 pts → balance = 120                  │
  │  (This is acceptable — the customer DID earn them)       │
  │                                                          │
  │  Alternative: If balance would go negative, clamp to 0   │
  │  and log: "Refund clamped: requested 100, applied 20"    │
  │                                                          │
  │  Audit trail always tracks the discrepancy ✓             │
  └──────────────────────────────────────────────────────────┘
```

### 12.2 Subscription Edge Cases

```
  EDGE CASE: Package Terms Changed After Purchase
  ═══════════════════════════════════════════════════════════════════

  Tenant sells "10 Wash Pack" for RM80 with 10 washes.
  Later, tenant edits the package to "8 washes for RM80".

  WITHOUT packageSnapshot:
  ┌──────────────────────────────────────────────────────────┐
  │  Existing customers who paid for 10 washes               │
  │  now only get 8! That's unfair and potentially illegal.   │
  └──────────────────────────────────────────────────────────┘

  WITH packageSnapshot:
  ┌──────────────────────────────────────────────────────────┐
  │  At purchase time, the server saves a SNAPSHOT:          │
  │  {                                                       │
  │    name: "10 Wash Pack",                                 │
  │    totalQuota: 10,                                       │
  │    price: 80.00,                                         │
  │    quotaUnit: "wash"                                     │
  │  }                                                       │
  │                                                          │
  │  This customer KEEPS their original 10 washes.           │
  │  Only NEW subscribers get the updated 8-wash terms.      │
  │                                                          │
  │  RESULT: Existing customers are protected ✓              │
  └──────────────────────────────────────────────────────────┘
```

```
  EDGE CASE: Void Sale That Used Subscription Quota
  ═══════════════════════════════════════════════════════════════════

  Customer uses 1 wash from subscription (remaining: 5 → 4).
  Manager voids that sale.

  Server action (inside transaction):
  ┌──────────────────────────────────────────────────────────┐
  │  1. Find SubscriptionUsage for this salesId              │
  │  2. Restore quota: remainingQuota += quantityUsed        │
  │     (atomically: { increment: quantityUsed })            │
  │  3. If status was EXPIRED → revert to ACTIVE             │
  │  4. Create negative usage record for audit trail:        │
  │     { quantityUsed: -1, remainingAfter: 5 }              │
  │                                                          │
  │  RESULT: Quota restored, audit trail clean ✓             │
  └──────────────────────────────────────────────────────────┘
```

```
  EDGE CASE: Time-Based Subscription Expires Mid-Sale
  ═══════════════════════════════════════════════════════════════════

  Customer's monthly plan ends at 11:59 PM March 31.
  Cashier starts checkout at 11:58 PM, completes at 12:01 AM April 1.

  ┌──────────────────────────────────────────────────────────┐
  │  Server checks: endDate > NOW()                          │
  │  At 12:01 AM → endDate (Mar 31 23:59) < NOW → EXPIRED   │
  │                                                          │
  │  Server rejects subscription usage.                      │
  │  Flutter falls back to normal pricing.                   │
  │                                                          │
  │  RESULT: No free rides past expiry ✓                     │
  └──────────────────────────────────────────────────────────┘
```

### 12.3 Membership Tier Edge Cases

```
  EDGE CASE: Manual vs Auto Tier Conflict
  ═══════════════════════════════════════════════════════════════════

  Manager manually assigns Customer X to "Silver" tier.
  (isManualTier = true)

  Later, Customer X's total spend crosses the "Gold" threshold.

  WITHOUT isManualTier flag:
  ┌──────────────────────────────────────────────────────────┐
  │  Auto-upgrade overwrites manager's manual assignment!    │
  │  Manager's intent is lost.                               │
  └──────────────────────────────────────────────────────────┘

  WITH isManualTier flag:
  ┌──────────────────────────────────────────────────────────┐
  │  checkAndUpgradeTier() runs after each sale:             │
  │                                                          │
  │  if (account.isManualTier === true) {                    │
  │    // Skip auto-upgrade — manager assigned this tier     │
  │    return;                                               │
  │  }                                                       │
  │                                                          │
  │  // Only auto-upgrade accounts that were NOT manually    │
  │  // assigned. Manager's decision is preserved.           │
  │                                                          │
  │  RESULT: Manual assignments are respected ✓              │
  └──────────────────────────────────────────────────────────┘

  To re-enable auto-upgrade for this customer:
  Manager manually assigns a new tier → can choose to set isManualTier = false
```

```
  EDGE CASE: Tier Deleted While Customers Assigned
  ═══════════════════════════════════════════════════════════════════

  Tenant deletes "Gold" tier. 50 customers are on Gold.

  Server action (inside transaction):
  ┌──────────────────────────────────────────────────────────┐
  │  1. Soft-delete the tier (deleted = true)                │
  │                                                          │
  │  2. For auto-tier customers (isManualTier = false):      │
  │     → Re-run checkAndUpgradeTier to find next best tier  │
  │     → e.g., if spend = RM3000 and Silver = RM500,        │
  │       customer moves to Silver                           │
  │                                                          │
  │  3. For manual-tier customers (isManualTier = true):     │
  │     → Set loyaltyTierId = null                           │
  │     → Set isManualTier = false                           │
  │     → Manager can re-assign manually later               │
  │                                                          │
  │  RESULT: No orphaned tier references ✓                   │
  └──────────────────────────────────────────────────────────┘
```

```
  EDGE CASE: Customer Soft-Deleted
  ═══════════════════════════════════════════════════════════════════

  Manager deletes a customer from the system (soft delete).

  Server action (inside transaction):
  ┌──────────────────────────────────────────────────────────┐
  │  1. Soft-delete Customer (existing behavior)             │
  │                                                          │
  │  2. Soft-delete all LoyaltyAccount records               │
  │     (deleted = true, preserves history)                  │
  │                                                          │
  │  3. Cancel all active CustomerSubscription records       │
  │     (status = CANCELLED, deleted = true)                 │
  │                                                          │
  │  RESULT: Clean cascade, data preserved for audit ✓       │
  └──────────────────────────────────────────────────────────┘
```

---

## 13. Performance Considerations

> **For Developers:** Key performance strategies for keeping the system fast
> as data grows over time.

### 13.1 Atomic Database Operations

```
  RULE: Always use atomic increments for balance/quota changes
  ═══════════════════════════════════════════════════════════════════

  ┌──────────────────────────────────────────────────────────┐
  │  ✓ GOOD (Atomic — handles concurrency):                  │
  │                                                          │
  │    UPDATE loyalty_account                                │
  │    SET current_points = current_points + 50              │
  │                                                          │
  │    (Prisma: { currentPoints: { increment: 50 } })        │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  ✗ BAD (Read-then-write — race condition):               │
  │                                                          │
  │    SELECT current_points FROM loyalty_account  → 100     │
  │    UPDATE SET current_points = 150                       │
  │                                                          │
  │    (Another device may have changed it between           │
  │     the SELECT and UPDATE!)                              │
  └──────────────────────────────────────────────────────────┘
```

### 13.2 Transaction Scope

```
  Keep transactions SMALL — only the critical atomic operations
  ═══════════════════════════════════════════════════════════════════

  ┌──────────────────────────────────────────────────────────┐
  │  ✓ GOOD: Minimal transaction                             │
  │                                                          │
  │  TRANSACTION START ───────────────────────────────────   │
  │  │  1. Read account (with version)                       │
  │  │  2. Check balance >= requested amount                 │
  │  │  3. Update with version check                         │
  │  │  4. Create transaction record                         │
  │  TRANSACTION END ─────────────────────────────────────   │
  │                                                          │
  │  // Outside transaction (non-critical):                  │
  │  5. Check tier upgrade                                   │
  │  6. Send notification                                    │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  ✗ BAD: Overly broad transaction                         │
  │                                                          │
  │  TRANSACTION START ───────────────────────────────────   │
  │  │  1. Read account                                      │
  │  │  2. Check balance                                     │
  │  │  3. Update account                                    │
  │  │  4. Create transaction record                         │
  │  │  5. Check tier upgrade                                │
  │  │  6. Send push notification (SLOW!)                    │
  │  │  7. Update customer statistics                        │
  │  TRANSACTION END ─────────────────────────────────────   │
  │                                                          │
  │  (Holds DB locks while waiting for push notification!)   │
  └──────────────────────────────────────────────────────────┘
```

### 13.3 Caching Strategy

```
  LoyaltyProgram & LoyaltyTier data rarely changes.
  Cache it in-memory to avoid repeated DB queries.
  ═══════════════════════════════════════════════════════════════════

  ┌──────────────────────────────────────────────────────────┐
  │                                                          │
  │  Request 1: GET /loyalty/program                         │
  │  → Cache MISS → Query DB → Store in cache (5 min TTL)    │
  │  → Response: 50ms                                        │
  │                                                          │
  │  Request 2-100: GET /loyalty/program                     │
  │  → Cache HIT → Return cached data                        │
  │  → Response: <1ms                                        │
  │                                                          │
  │  Manager updates program: PUT /loyalty/program/:id       │
  │  → Invalidate cache → Next request reloads from DB       │
  │                                                          │
  └──────────────────────────────────────────────────────────┘

  WHAT TO CACHE:
  ┌───────────────────────┬───────────┬────────────────────────┐
  │ Data                  │ TTL       │ Invalidate On          │
  ├───────────────────────┼───────────┼────────────────────────┤
  │ LoyaltyProgram + Tiers│ 5 min     │ Program/Tier CRUD      │
  │ SubscriptionPackages  │ 5 min     │ Package CRUD           │
  ├───────────────────────┼───────────┼────────────────────────┤
  │ LoyaltyAccount        │ NO CACHE  │ Changes too frequently │
  │ CustomerSubscription  │ NO CACHE  │ Changes too frequently │
  └───────────────────────┴───────────┴────────────────────────┘
```

### 13.4 Database Indexes

```
  Key indexes for query performance:
  ═══════════════════════════════════════════════════════════════════

  loyalty_transaction:
  ┌──────────────────────────────────────────────────────────────┐
  │  UNIQUE (salesId, type)       → Idempotency check            │
  │  INDEX  (loyaltyAccountId)    → Fast history lookup           │
  │  INDEX  (createdAt)           → Pagination & archival         │
  └──────────────────────────────────────────────────────────────┘

  subscription_usage:
  ┌──────────────────────────────────────────────────────────────┐
  │  UNIQUE (salesId, customerSubscriptionId) → Idempotency      │
  │  INDEX  (customerSubscriptionId)          → Usage history     │
  │  INDEX  (createdAt)                       → Archival          │
  └──────────────────────────────────────────────────────────────┘

  customer_subscription:
  ┌──────────────────────────────────────────────────────────────┐
  │  INDEX  (customerId)          → Customer's subscriptions      │
  │  INDEX  (status)              → Filter active only            │
  └──────────────────────────────────────────────────────────────┘

  loyalty_account:
  ┌──────────────────────────────────────────────────────────────┐
  │  UNIQUE (customerId, loyaltyProgramId)  → One account each   │
  │  INDEX  (loyaltyTierId)                 → Tier assignment     │
  └──────────────────────────────────────────────────────────────┘
```

### 13.5 Data Archival (Long-Term Growth)

```
  Problem: loyalty_transaction and subscription_usage grow forever.
  ═══════════════════════════════════════════════════════════════════

  After 1 year with 1000 customers, 10 sales/day:
  - loyalty_transaction: ~3,650,000 rows
  - subscription_usage:    ~500,000 rows

  Solution: Archive old records periodically
  ═══════════════════════════════════════════════════════════════════

  ┌────────────────────┐                ┌──────────────────────────┐
  │ loyalty_transaction │  ── archive ──> │ loyalty_transaction      │
  │ (active, recent)    │    monthly      │ _archive                 │
  │ < 12 months old     │                │ (older records,          │
  │                     │                │  read-only, for reports) │
  └────────────────────┘                └──────────────────────────┘

  Process (monthly cron job):
  1. SELECT records older than 12 months (batch of 500)
  2. INSERT INTO archive table
  3. DELETE from source table
  4. Repeat until done
  5. Use cursor-based pagination to avoid locking

  Benefits:
  - Active tables stay small → fast queries
  - Historical data preserved → compliance & reports
  - Archive tables can be on slower/cheaper storage
```

### 13.6 Query Optimization

```
  Use Prisma `include` to prevent N+1 queries:
  ═══════════════════════════════════════════════════════════════════

  ✓ GOOD: 1 query with includes
  ┌──────────────────────────────────────────────────────────┐
  │  prisma.loyaltyAccount.findUnique({                      │
  │    where: { customerId_loyaltyProgramId: { ... } },      │
  │    include: {                                            │
  │      loyaltyTier: true,                                  │
  │      loyaltyProgram: true,                               │
  │      transactions: {                                     │
  │        take: 10,                                         │
  │        orderBy: { createdAt: 'desc' }                    │
  │      }                                                   │
  │    }                                                     │
  │  })                                                      │
  │  → 1 SQL query with JOINs                                │
  └──────────────────────────────────────────────────────────┘

  ✗ BAD: 3 separate queries (N+1)
  ┌──────────────────────────────────────────────────────────┐
  │  const account = await prisma.loyaltyAccount.find(...)   │
  │  const tier = await prisma.loyaltyTier.find(...)         │
  │  const txns = await prisma.loyaltyTransaction.find(...)  │
  │  → 3 separate SQL queries (slow!)                        │
  └──────────────────────────────────────────────────────────┘

  Use cursor-based pagination for transaction history:
  ┌──────────────────────────────────────────────────────────┐
  │  prisma.loyaltyTransaction.findMany({                    │
  │    where: { loyaltyAccountId: accountId },               │
  │    orderBy: { createdAt: 'desc' },                       │
  │    take: 21,  // fetch 1 extra to detect "has more"      │
  │    cursor: lastId ? { id: lastId } : undefined,          │
  │    skip: lastId ? 1 : 0,                                 │
  │  })                                                      │
  │  → Efficient for large datasets (no OFFSET)              │
  └──────────────────────────────────────────────────────────┘
```
