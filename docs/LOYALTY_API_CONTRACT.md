# Loyalty & Subscription Package — Flutter Integration Contract

This document describes all API endpoints, request/response shapes, and integration patterns the Flutter team needs to implement the loyalty feature.

---

## Table of Contents

1. [Feature Gating](#1-feature-gating)
2. [JWT Token Changes](#2-jwt-token-changes)
3. [Loyalty Program Endpoints](#3-loyalty-program-endpoints)
4. [Customer Enrollment & Account](#4-customer-enrollment--account)
5. [Points Operations](#5-points-operations)
6. [Tier Management (Advanced)](#6-tier-management-advanced)
7. [Subscription Packages (Advanced)](#7-subscription-packages-advanced)
8. [Customer Subscriptions (Advanced)](#8-customer-subscriptions-advanced)
9. [Sales Integration](#9-sales-integration)
10. [Customer Lookup Changes](#10-customer-lookup-changes)
11. [Session Report Changes](#11-session-report-changes)
12. [Discount Stacking Order](#12-discount-stacking-order)
13. [Error Codes](#13-error-codes)

---

## 1. Feature Gating

The loyalty feature is gated based on the tenant's subscription plan:

| Plan                          | `loyaltyTier` in JWT | Features Available                                                                                          |
| ----------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------- |
| Basic/Trial                   | `none`               | No loyalty features. 0 extra queries.                                                                       |
| Pro (no add-on)               | `basic`              | Points earn/redeem, history, manual adjust, FIFO expiry                                                     |
| Pro + Advanced Loyalty add-on | `advanced`           | Everything basic + membership tiers, auto-upgrade, tier discounts, point multipliers, subscription packages |

**Flutter should:**

- Read `loyaltyTier` from the JWT/login response
- Show/hide loyalty UI based on tier level
- Never call loyalty endpoints if `loyaltyTier === 'none'`

---

## 2. JWT Token Changes

### Login Response — New Fields

```json
{
  "token": "eyJ...",
  "tokenExpiryDate": "2026-03-03T...",
  "refreshToken": "abc...",
  "globalTenantId": 1,
  "globalTenantUserId": 5,
  "userId": 3,
  "planName": "Pro",
  "databaseName": "tenant_db_1",
  "globalOutletId": 2,
  "loyaltyTier": "basic"
}
```

New field: **`loyaltyTier`** — `"none"` | `"basic"` | `"advanced"`

The `loyaltyTier` value is also embedded inside the JWT payload at `user.loyaltyTier`. After a token refresh, this value updates automatically if the tenant's add-on status changes.

---

## 3. Loyalty Program Endpoints

Base URL: `/loyalty`

### 3.1 GET `/loyalty/program`

Get the loyalty program config (cached, fast).

**Response:**

```json
{
  "id": 1,
  "name": "My Rewards",
  "pointsPerCurrency": 1,
  "currencyPerPoint": 100,
  "pointsExpiryDays": 365,
  "minRedeemPoints": 100,
  "isActive": true,
  "tiers": [
    {
      "id": 1,
      "name": "Silver",
      "minSpend": 500000,
      "discountPercentage": 2,
      "pointsMultiplier": 1,
      "sortOrder": 1
    },
    {
      "id": 2,
      "name": "Gold",
      "minSpend": 2000000,
      "discountPercentage": 5,
      "pointsMultiplier": 1.5,
      "sortOrder": 2
    }
  ]
}
```

Returns HTTP 200 with `null` body if no program exists (not 404).

### 3.2 POST `/loyalty/program`

Create a loyalty program (one per tenant).

**Request:**

```json
{
  "name": "My Rewards",
  "pointsPerCurrency": 1,
  "currencyPerPoint": 100,
  "pointsExpiryDays": 365,
  "minRedeemPoints": 100
}
```

| Field               | Type   | Required | Description                                   |
| ------------------- | ------ | -------- | --------------------------------------------- |
| `name`              | string | Yes      | Program display name                          |
| `pointsPerCurrency` | number | Yes      | Points earned per 1 currency unit spent       |
| `currencyPerPoint`  | number | Yes      | Currency value of 1 point when redeeming      |
| `pointsExpiryDays`  | number | No       | Days until points expire (null = never)       |
| `minRedeemPoints`   | number | No       | Minimum points required to redeem (default 0) |

### 3.3 PUT `/loyalty/program/:id`

Update program config. Partial updates supported. Same fields as create (all optional).

---

## 4. Customer Enrollment & Account

### 4.1 POST `/loyalty/enroll`

Enroll a customer in the loyalty program.

**Request:**

```json
{
  "customerId": 42,
  "loyaltyProgramId": 1
}
```

**Response:**

```json
{
  "id": 1,
  "customerId": 42,
  "customerName": "John Doe",
  "loyaltyProgramId": 1,
  "currentPoints": 0,
  "totalEarned": 0,
  "totalRedeemed": 0,
  "totalSpend": 0,
  "loyaltyTier": null,
  "isManualTier": false,
  "joinedAt": "2026-03-02T10:00:00.000Z"
}
```

### 4.2 GET `/loyalty/account/customer/:customerId`

Get a customer's loyalty account with balance and tier info.

**Response:** Same shape as enrollment response, but with current values populated. The `loyaltyTier` field is either `null` (no tier) or a tier object:

```json
{
  "id": 1,
  "customerId": 42,
  "customerName": "John Doe",
  "loyaltyProgramId": 1,
  "currentPoints": 1500,
  "totalEarned": 3000,
  "totalRedeemed": 1500,
  "totalSpend": 5000000,
  "loyaltyTier": {
    "id": 2,
    "name": "Gold",
    "minSpend": 2000000,
    "discountPercentage": 5,
    "pointsMultiplier": 1.5,
    "sortOrder": 2
  },
  "isManualTier": false,
  "joinedAt": "2026-03-02T10:00:00.000Z"
}
```

Returns HTTP 200 with `null` body if customer is not enrolled (not 404).

**Note on `loyaltyTier` field:** The enrollment response (Section 4.1) always returns `loyaltyTier: null` because a new enrollment starts with no tier. The account lookup (this endpoint) returns the same type — `null` or a full tier object. The customer detail endpoint (Section 10) also returns this same field nested inside `loyaltyAccounts[0].loyaltyTier`. All three share the same tier object shape.

---

## 5. Points Operations

### 5.1 POST `/loyalty/account/:accountId/earn`

Manually earn points (e.g., bonus points). Not needed during normal sales — that's automatic.

**Request:**

```json
{
  "points": 500,
  "description": "Welcome bonus"
}
```

### 5.2 POST `/loyalty/account/:accountId/redeem`

Manually redeem points. Not needed during normal sales — that's handled via the sales request.

**Request:**

```json
{
  "points": 200,
  "description": "Manual redemption"
}
```

### 5.3 POST `/loyalty/account/:accountId/adjust`

Manual adjustment (add or remove points with audit trail).

**Request:**

```json
{
  "points": -50,
  "description": "Correction for duplicate earn"
}
```

`points` can be positive (add) or negative (remove). `description` is required.

### 5.4 GET `/loyalty/account/:accountId/transactions`

Cursor-paginated transaction history.

**Query params:** `?cursor=123&limit=20`

**Response:**

```json
{
  "transactions": [
    {
      "id": 45,
      "type": "EARN",
      "points": 150,
      "balanceAfter": 1650,
      "salesId": 789,
      "description": "Earned from sale #789",
      "performedBy": "cashier1",
      "createdAt": "2026-03-02T14:30:00.000Z"
    }
  ],
  "total": 128,
  "cursor": 44
}
```

**Transaction types:** `EARN`, `REDEEM`, `EARN_REVERSAL`, `REDEEM_REVERSAL`, `ADJUST`, `EXPIRE`

### 5.5 GET `/loyalty/account/:accountId/expiring?days=30`

Preview points expiring within the given number of days (default 30).

**Response:**

```json
{
  "totalExpiring": 500,
  "batches": [
    { "points": 200, "expiresAt": "2026-04-01T00:00:00.000Z" },
    { "points": 300, "expiresAt": "2026-04-15T00:00:00.000Z" }
  ]
}
```

Returns `totalExpiring: 0` and empty `batches` if no points are expiring or program has no expiry configured.

### Points Operation Response (earn/redeem/adjust)

```json
{
  "success": true,
  "message": "Earned 500 points",
  "account": {
    "currentPoints": 1500,
    "totalEarned": 3000,
    "totalRedeemed": 1500
  },
  "transaction": {
    "id": 46,
    "type": "EARN",
    "points": 500,
    "balanceAfter": 1500,
    "salesId": null,
    "description": "Welcome bonus",
    "performedBy": "admin1",
    "createdAt": "2026-03-02T15:00:00.000Z"
  }
}
```

---

## 6. Tier Management (Advanced)

Requires `loyaltyTier === 'advanced'`. Returns 403 otherwise.

### 6.1 POST `/loyalty/tier`

**Request:**

```json
{
  "loyaltyProgramId": 1,
  "name": "Gold",
  "minSpend": 2000000,
  "discountPercentage": 5,
  "pointsMultiplier": 1.5,
  "sortOrder": 2
}
```

### 6.2 PUT `/loyalty/tier/:id`

Partial update. Same fields as create (all optional except `loyaltyProgramId`).

### 6.3 DELETE `/loyalty/tier/:id`

Soft-deletes the tier. Customers on this tier are unassigned automatically.

### 6.4 GET `/loyalty/tier/program/:programId`

List all tiers for a program, sorted by `sortOrder`. Use this to refresh the tier list after create/update/delete without re-fetching the entire program.

**Response:**

```json
[
  {
    "id": 1,
    "name": "Silver",
    "minSpend": 500000,
    "discountPercentage": 2,
    "pointsMultiplier": 1,
    "sortOrder": 1
  },
  {
    "id": 2,
    "name": "Gold",
    "minSpend": 2000000,
    "discountPercentage": 5,
    "pointsMultiplier": 1.5,
    "sortOrder": 2
  }
]
```

### 6.5 PUT `/loyalty/account/:accountId/tier`

Manually assign a tier to a customer.

**Request:**

```json
{
  "loyaltyTierId": 2,
  "isManualTier": true
}
```

Set `loyaltyTierId: null` and `isManualTier: false` to remove manual assignment and let auto-upgrade resume.

---

## 7. Subscription Packages (Advanced)

Base URL: `/subscription`

Requires `loyaltyTier === 'advanced'`.

### 7.1 GET `/subscription/package`

List all active packages (cached).

**Response:**

```json
[
  {
    "id": 1,
    "name": "10-Session Wash Package",
    "packageType": "USAGE",
    "price": 150000,
    "totalQuota": 10,
    "quotaUnit": "sessions",
    "durationDays": null,
    "discountPercentage": null,
    "discountAmount": null,
    "validityDays": 90,
    "isActive": true,
    "categories": [{ "categoryId": 5, "categoryName": "Wash Services" }]
  },
  {
    "id": 2,
    "name": "Monthly Premium",
    "packageType": "TIME",
    "price": 500000,
    "totalQuota": null,
    "quotaUnit": null,
    "durationDays": 30,
    "discountPercentage": 10,
    "discountAmount": null,
    "validityDays": null,
    "isActive": true,
    "categories": [
      { "categoryId": 5, "categoryName": "Wash Services" },
      { "categoryId": 6, "categoryName": "Detail Services" }
    ]
  }
]
```

**Package Types:**

- `USAGE` — Has a fixed quota (e.g., 10 sessions). Expires when quota is used up or `validityDays` passes.
- `TIME` — Duration-based (e.g., 30 days). Customer gets discount for the duration.

### 7.2 POST `/subscription/package`

**Request:**

```json
{
  "name": "10-Session Wash Package",
  "packageType": "USAGE",
  "price": 150000,
  "totalQuota": 10,
  "quotaUnit": "sessions",
  "validityDays": 90,
  "categoryIds": [5]
}
```

### 7.3 GET `/subscription/package/:id`

Get a single package by ID. Returns the same shape as one item from the list endpoint.

### 7.4 PUT `/subscription/package/:id`

Partial update. Same fields as create. Include `categoryIds` array to replace linked categories.

### 7.5 DELETE `/subscription/package/:id`

Soft-delete. Fails if package has active customer subscriptions.

---

## 8. Customer Subscriptions (Advanced)

### 8.1 POST `/subscription/subscribe`

Subscribe a customer to a package.

**Request:**

```json
{
  "customerId": 42,
  "subscriptionPackageId": 1,
  "paidAmount": 150000
}
```

**Response:**

```json
{
  "id": 1,
  "customerId": 42,
  "customerName": "John Doe",
  "subscriptionPackageId": 1,
  "packageName": "10-Session Wash Package",
  "packageType": "USAGE",
  "status": "ACTIVE",
  "startDate": "2026-03-02T10:00:00.000Z",
  "endDate": "2026-05-31T10:00:00.000Z",
  "remainingQuota": 10,
  "usedQuota": 0,
  "paidAmount": 150000,
  "packageSnapshot": { ... }
}
```

### 8.2 GET `/subscription/customer/:customerId`

List all subscriptions for a customer. Returns ALL non-deleted subscriptions regardless of status, sorted by `createdAt` descending.

**Response:**

```json
{
  "subscriptions": [
    {
      "id": 1,
      "customerId": 42,
      "customerName": "John Doe",
      "subscriptionPackageId": 1,
      "packageName": "10-Session Wash Package",
      "packageType": "USAGE",
      "status": "ACTIVE",
      "startDate": "2026-03-02T10:00:00.000Z",
      "endDate": "2026-05-31T10:00:00.000Z",
      "remainingQuota": 7,
      "usedQuota": 3,
      "paidAmount": 150000,
      "packageSnapshot": { "...full package copy at subscription time..." }
    }
  ],
  "total": 1
}
```

### 8.3 GET `/subscription/subscription/:id`

Get single subscription details. Returns same shape as one item from the list above.

### 8.4 PUT `/subscription/cancel/:id`

Cancel a subscription. Sets status to `CANCELLED`. Returns the updated subscription object:

```json
{
  "id": 1,
  "customerId": 42,
  "customerName": "John Doe",
  "subscriptionPackageId": 1,
  "packageName": "10-Session Wash Package",
  "packageType": "USAGE",
  "status": "CANCELLED",
  "startDate": "2026-03-02T10:00:00.000Z",
  "endDate": "2026-05-31T10:00:00.000Z",
  "remainingQuota": 7,
  "usedQuota": 3,
  "paidAmount": 150000,
  "packageSnapshot": { "..." }
}
```

### 8.5 POST `/subscription/usage`

Record subscription usage (typically called from server-side during sales, but available for manual use).

**Request:**

```json
{
  "customerSubscriptionId": 1,
  "salesId": 789,
  "quantityUsed": 1
}
```

**Subscription Statuses:** `ACTIVE`, `EXPIRED`, `CANCELLED`

### 8.6 Subscription Payment

Subscribing a customer (`POST /subscription/subscribe`) is a standalone operation, separate from the sales flow. It does NOT create a sale record and does NOT appear in session reports. `paidAmount` is recorded for bookkeeping only. Payment method is not tracked by the server.

---

## 9. Sales Integration

### 9.1 New Fields on CreateSalesRequest

When creating a sale with loyalty, add these optional fields to the sales body:

```json
{
  "sales": {
    "customerId": 42,
    "totalAmount": 350000,
    "...existing fields...",

    "loyaltyPointsToRedeem": 200,
    "loyaltyPointsRedemptionValue": 20000,
    "loyaltyTierDiscountPercentage": 5,
    "loyaltyTierDiscountAmount": 17500,
    "customerSubscriptionId": 1,
    "subscriptionQuantityUsed": 1,
    "subscriptionDiscountAmount": 0
  },
  "payments": [...]
}
```

| Field                           | Type   | When to Send | Description                                                |
| ------------------------------- | ------ | ------------ | ---------------------------------------------------------- |
| `loyaltyPointsToRedeem`         | number | Basic+       | Number of points to redeem                                 |
| `loyaltyPointsRedemptionValue`  | number | Basic+       | Cash value of redeemed points (points \* currencyPerPoint) |
| `loyaltyTierDiscountPercentage` | number | Advanced     | Tier discount % being applied (see note below)             |
| `loyaltyTierDiscountAmount`     | number | Advanced     | Tier discount cash value                                   |
| `customerSubscriptionId`        | number | Advanced     | Active subscription to use                                 |
| `subscriptionQuantityUsed`      | number | Advanced     | Quota to deduct (default 1)                                |
| `subscriptionDiscountAmount`    | number | Advanced     | Discount from time-based subscription                      |

**Field naming note:** The request uses `loyaltyTierDiscountPercentage` (full word), but the Sale response/DB uses `loyaltyTierDiscountPercent` (abbreviated). The server maps between these automatically. Flutter sends `loyaltyTierDiscountPercentage` in the request and reads `loyaltyTierDiscountPercent` from the response.

### 9.2 What Happens Server-Side

**On sale creation (status = "Completed"):**

1. Server validates tier discount matches customer's actual tier
2. Server validates and deducts redeemed points (FIFO from oldest batch)
3. Server validates and deducts subscription quota
4. Server calculates and earns points on `totalAmount` (after ALL discounts)
5. Server stores all loyalty data on the Sales record

**On partial payment completion (Partially Paid -> Completed):**

- Points are earned automatically when the sale transitions to "Completed"
- No redemption/tier/subscription happens (that's only at initial checkout)

**On void/return/refund:**

- Earned points are reversed (EARN_REVERSAL transaction)
- Redeemed points are restored (REDEEM_REVERSAL transaction, new batch with no expiry)
- Subscription quota is restored

### 9.3 What Flutter Should NOT Do

- Do NOT calculate points earned — the server does this
- Do NOT send `loyaltyPointsEarned` — the server calculates it
- Do NOT send loyalty fields if `loyaltyTier === 'none'` — omit them entirely
- Do NOT send loyalty fields for Partially Paid sales — loyalty is deferred

### 9.4 What Flutter SHOULD Do

- Calculate `loyaltyPointsRedemptionValue = pointsToRedeem * program.currencyPerPoint`
- Calculate `loyaltyTierDiscountAmount = totalBeforeLoyalty * tierDiscountPercentage / 100`
  - `totalBeforeLoyalty` = subtotal - discounts + serviceCharge + tax + rounding (i.e., after ALL existing calculations)
- Calculate `subscriptionDiscountAmount` for TIME packages:
  - Identify cart items whose categoryId matches the subscription's `categories` array
  - If `discountPercentage` is set: `matchingItemsSubtotal * discountPercentage / 100`
  - If `discountAmount` is set: use the fixed amount directly (capped at matchingItemsSubtotal)
  - For USAGE packages: the matching-category items are pre-paid. Set `subscriptionDiscountAmount` to the total price of matching-category items (effectively a 100% discount). This creates an audit trail showing the subscription covered these items. Example: customer has a "10-Session Wash" package and adds a Rp 50,000 wash item → `subscriptionDiscountAmount = 50000`
- Deduct these from the `totalAmount` the customer pays
- Show the breakdown: item total -> discounts -> service/tax -> **tier discount** -> **subscription discount** -> **point redemption** -> final amount (this order matches Section 12)

### 9.5 Sale Response — Loyalty Fields

After a completed sale, the response includes loyalty data. Use `loyaltyPointsEarned` to display "You earned X points" on the receipt:

```json
{
  "id": 789,
  "...existing sale fields...",
  "loyaltyPointsEarned": 350,
  "loyaltyPointsRedeemed": 200,
  "loyaltyPointsRedemptionValue": 20000,
  "loyaltyTierDiscountPercent": 5,
  "loyaltyTierDiscountAmount": 17500,
  "customerSubscriptionId": 1,
  "subscriptionDiscountAmount": 0
}
```

These fields are `null`/`0` if loyalty was not active for the sale.

### 9.6 Customer Selection for Loyalty

Loyalty only activates when `customerId` is set on the sale:

- **No customer selected**: loyalty is skipped entirely. Sale works exactly as before. No extra queries.
- **Customer selected but not enrolled**: loyalty is skipped. No error.
- **Customer selected and enrolled**: loyalty processes (earn, redeem, tier discount, subscription).

Flutter needs a way to select an existing customer (by ID) during checkout for loyalty to work. Sales without a customer still work fine.

### 9.7 Void/Return/Refund — No Extra Fields Needed

Flutter sends the exact same void/return/refund request as today. The server automatically:

1. Reverses earned points (EARN_REVERSAL)
2. Restores redeemed points (REDEEM_REVERSAL, new non-expiring batch)
3. Restores subscription quota (if used)

Partial returns are not supported in V1 — void/return/refund is all-or-nothing on the entire sale.

### 9.8 Subscription Category Matching

When using a subscription during checkout:

1. Flutter checks if any cart item's `categoryId` exists in the subscription's `categories` array
2. If at least one item matches, the subscription is applicable. Server validates the same thing.
3. For **USAGE** (pre-paid quota):
   - `quantityUsed` is usually 1 per sale (not per item). Server validates `remainingQuota >= quantityUsed`.
   - `subscriptionDiscountAmount` = total price of all matching-category items in the cart (effectively 100% discount on those items, since they are pre-paid via the package purchase).
   - Non-matching items are charged normally.
   - Example: Cart has Wash (Rp 50,000, matches subscription) + Detailing (Rp 100,000, no match) → `subscriptionDiscountAmount = 50000`, customer pays Rp 100,000.
4. For **TIME** (duration-based discount):
   - Discount applies only to matching-category items.
   - If `discountPercentage` is set: `subscriptionDiscountAmount = matchingItemsSubtotal * discountPercentage / 100`
   - If `discountAmount` is set: use the fixed amount (capped at matchingItemsSubtotal)
5. If customer has **multiple active subscriptions** that match, let the cashier choose — only one `customerSubscriptionId` per sale.

---

## 10. Customer Lookup Changes

### GET `/customer/:id` — Enhanced Response

When `loyaltyTier !== 'none'`, the customer detail response now includes loyalty data:

**Basic loyalty:**

```json
{
  "id": 42,
  "firstName": "John",
  "lastName": "Doe",
  "...existing fields...",
  "loyaltyAccounts": [
    {
      "id": 1,
      "currentPoints": 1500,
      "totalEarned": 3000,
      "totalRedeemed": 1500,
      "totalSpend": 5000000,
      "loyaltyTierId": null,
      "isManualTier": false
    }
  ]
}
```

**Advanced loyalty (also includes subscriptions and tier):**

```json
{
  "...same as above...",
  "loyaltyAccounts": [
    {
      "id": 1,
      "currentPoints": 1500,
      "totalEarned": 3000,
      "totalRedeemed": 1500,
      "totalSpend": 5000000,
      "loyaltyTierId": 2,
      "isManualTier": false,
      "loyaltyTier": {
        "id": 2,
        "name": "Gold",
        "minSpend": 2000000,
        "discountPercentage": 5,
        "pointsMultiplier": 1.5,
        "sortOrder": 2
      }
    }
  ],
  "customerSubscriptions": [
    {
      "id": 1,
      "status": "ACTIVE",
      "remainingQuota": 7,
      "usedQuota": 3,
      "endDate": "2026-05-31T10:00:00.000Z",
      "subscriptionPackage": {
        "id": 1,
        "name": "10-Session Wash Package",
        "packageType": "USAGE",
        "discountPercentage": null,
        "discountAmount": null,
        "categories": [
          { "categoryId": 5 }
        ]
      }
    }
  ]
}
```

If `loyaltyTier === 'none'`, these fields are not included (response is unchanged).

---

## 11. Session Report Changes

### GET `/sales/getTotalSalesData?sessionID=123`

When loyalty is enabled, the response includes a `loyaltyMetrics` object:

```json
{
  "salesCount": 45,
  "totalRevenue": 15000000,
  "totalProfit": 4500000,
  "averageTransactionValue": 333333.33,
  "totalPaidAmount": 15200000,
  "totalChangeGiven": 200000,
  "outstandingAmount": 0,
  "transactionCounts": {
    "total": 50,
    "completed": 42,
    "partiallyPaid": 3,
    "delivered": 0,
    "voided": 3,
    "returned": 1,
    "refunded": 1
  },
  "loyaltyMetrics": {
    "totalLoyaltyPointsEarned": 15000,
    "totalLoyaltyPointsRedeemed": 3200,
    "totalLoyaltyDiscountAmount": 750000,
    "totalSubscriptionUsages": 5
  }
}
```

`loyaltyMetrics` is only present when `loyaltyTier !== 'none'`.

---

## 12. Discount Stacking Order

This is the full discount chain Flutter should implement for the checkout UI:

```
1. Item-level discounts (per-item, existing)
   -> subtotalAmount

2. Sales-level manual discount (%, fixed, or amount — existing)
   -> discountAmount

3. + Service charge, tax, rounding (existing)
   = totalBeforeLoyalty

4. Tier discount % (advanced only)
   -> loyaltyTierDiscountAmount = totalBeforeLoyalty * tierDiscountPercentage / 100

5. Subscription discount (advanced only)
   -> subscriptionDiscountAmount (see Section 9.4 for calculation details)

6. Point redemption cash value
   -> loyaltyPointsRedemptionValue = pointsToRedeem * program.currencyPerPoint

= totalAmount (what the customer pays)

7. Points earned on totalAmount
   = totalAmount * program.pointsPerCurrency * tierMultiplier
   (calculated server-side, NOT sent by Flutter)
```

**Important:** `totalAmount` sent to the server must already have loyalty discounts applied. The server stores the loyalty parameters but trusts the `totalAmount` calculation (consistent with how manual discounts work today).

---

## 13. Error Codes

| HTTP Status | Error Type               | Message                                                 | When                                                        |
| ----------- | ------------------------ | ------------------------------------------------------- | ----------------------------------------------------------- |
| 403         | LoyaltyNotEnabledError   | Loyalty feature not available                           | Calling loyalty endpoints with `loyaltyTier` too low        |
| 400         | InsufficientPointsError  | Insufficient loyalty points. Available: X, Requested: Y | Redeeming more points than available                        |
| 400         | TierMismatchError        | Tier discount mismatch: requested X%, actual Y%         | Tier discount doesn't match customer's tier                 |
| 400         | SubscriptionExpiredError | Customer subscription has expired                       | Using expired/inactive subscription or quota = 0            |
| 400         | RequestValidateError     | Customer is already enrolled in this program            | Duplicate enrollment                                        |
| 400         | RequestValidateError     | A loyalty program already exists. Update it instead.    | Creating a second program                                   |
| 400         | RequestValidateError     | Minimum redemption is X points                          | Redemption below `minRedeemPoints`                          |
| 400         | RequestValidateError     | Redemption value cannot exceed sale total               | Point redemption value > totalAmount                        |
| 400         | RequestValidateError     | Cannot delete package with active subscriptions         | Deleting package with active subs                           |
| 400         | RequestValidateError     | Subscription does not belong to this customer           | Subscription/customer mismatch                              |
| 400         | RequestValidateError     | Various messages                                        | Other validation errors (missing fields, invalid IDs, etc.) |
| 404         | NotFoundError            | Entity not found                                        | Customer not enrolled, program doesn't exist, etc.          |

**Point redemption rules:**

- Points are whole numbers only (no fractional points)
- `minRedeemPoints` is the minimum for any redemption transaction
- Redemption value cannot exceed the sale's `totalAmount`

---

## Quick Reference — When to Show What

| Feature                           | `none` | `basic` | `advanced` |
| --------------------------------- | ------ | ------- | ---------- |
| Loyalty program settings          | Hide   | Show    | Show       |
| Customer enrollment               | Hide   | Show    | Show       |
| Points balance in customer detail | Hide   | Show    | Show       |
| Points earn/redeem in checkout    | Hide   | Show    | Show       |
| Manual point adjustment           | Hide   | Show    | Show       |
| Transaction history               | Hide   | Show    | Show       |
| Membership tiers UI               | Hide   | Hide    | Show       |
| Tier discount in checkout         | Hide   | Hide    | Show       |
| Subscription packages             | Hide   | Hide    | Show       |
| Customer subscriptions            | Hide   | Hide    | Show       |
| Loyalty metrics in session report | Hide   | Show    | Show       |

---

## Flutter Feature Checklist

### Basic Loyalty (Pro plan — `loyaltyTier: 'basic'`)

1. **Loyalty Program Settings** — CRUD for loyalty program config (name, points rate, expiry days, min redeem). One program per tenant. Use `GET/POST/PUT /loyalty/program`.
2. **Customer Enrollment** — Enroll existing customers into the loyalty program. Use `POST /loyalty/enroll`. Show an "Enroll" button on customer detail if not yet enrolled.
3. **Customer Loyalty Info** — Display points balance, total earned, total redeemed, total spend on the customer detail screen. Data comes from `GET /customer/:id` response (`loyaltyAccounts` array).
4. **Points Checkout Integration** — During checkout, allow cashier to redeem customer's points. Flutter calculates `loyaltyPointsRedemptionValue` and deducts from `totalAmount`. Send loyalty fields in the sales request. See [Discount Stacking Order](#12-discount-stacking-order).
5. **Manual Point Adjustment** — Allow authorized users to manually add/remove points with a reason. Use `POST /loyalty/account/:id/adjust`.
6. **Transaction History** — Show point transaction history (earn, redeem, adjust, expire) for a customer. Use `GET /loyalty/account/:id/transactions` with cursor pagination.
7. **Session Report** — Display `loyaltyMetrics` (points earned, redeemed, discount amount) in the session close summary.

### Advanced Loyalty (Pro + Add-On — `loyaltyTier: 'advanced'`)

Everything above, plus:

8. **Membership Tier Management** — CRUD for loyalty tiers (name, minimum spend threshold, discount %, points multiplier). Use `GET/POST/PUT/DELETE /loyalty/tier`. Tiers are sorted by `sortOrder`.
9. **Manual Tier Assignment** — Allow assigning a customer to a specific tier manually (overrides auto-upgrade). Use `PUT /loyalty/account/:id/tier`.
10. **Tier Discount in Checkout** — When customer has a tier with `discountPercentage > 0`, apply tier discount during checkout. Flutter calculates `loyaltyTierDiscountAmount` and sends it in the sales request.
11. **Subscription Package Management** — CRUD for subscription packages (name, type USAGE/TIME, price, quota, duration, linked categories). Use `GET/POST/PUT/DELETE /subscription/package`.
12. **Customer Subscription** — Subscribe customers to packages, view their active subscriptions, cancel subscriptions. Use `POST /subscription/subscribe`, `GET /subscription/customer/:id`, `PUT /subscription/cancel/:id`.
13. **Subscription in Checkout** — When customer has an active USAGE subscription applicable to the sale items' categories, deduct quota. For TIME subscriptions, apply the subscription's discount. Send `customerSubscriptionId`, `subscriptionQuantityUsed`, `subscriptionDiscountAmount` in the sales request.
