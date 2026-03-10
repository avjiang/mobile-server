# Subscription Model Documentation

## Overview

This document provides the complete reference for the POS application subscription model,
including pricing, features, billing logic, and technical implementation details.

**Target Market:** Indonesia
**Currency:** Indonesian Rupiah (IDR)
**Billing Cycle:** Monthly, per outlet

---

## Pricing Summary

### Base Plans

| Plan  | Price (IDR) | Price (IDR) | Price/Outlet/Month |
| ----- | ----------- | ----------- | ------------------ |
| Trial | Rp 0        | Rp 0        | Per outlet         |
| Basic | Rp 300,000  | Rp 300,000  | Per outlet         |
| Pro   | Rp 450,000  | Rp 450,000  | Per outlet         |

### Add-Ons

| Add-On           | Price (IDR)          | Scope       | Availability |
| ---------------- | -------------------- | ----------- | ------------ |
| Extra User       | Rp 50,000/user       | Tenant-wide | Basic & Pro  |
| Extra Device     | Rp 20,000/device     | Tenant-wide | Pro only     |
| Extra Warehouse  | Rp 150,000/warehouse | Tenant-wide | Pro only     |
| Advanced Loyalty | Rp 150,000/tenant    | Tenant-wide | Pro only     |

---

## Plan Details

### Trial Plan (Rp 0/month/outlet)

**Included:**

- Unlimited sales management
- Unlimited purchasing & inventory
  - Quotation
  - Purchase Order
  - Delivery Order
  - Invoice
  - Settlement
- Stock alerts in real-time
- Customized role-based access control
  - Cashier
  - Manager
  - Super Admin
  - Custom roles
- Daily session reports (PDF)
  - Top categories
  - Profit analysis
  - Revenue breakdown
  - Payment methods
- Live sales session tracking
- Delivery list management
- Credit sales tracking (Partial/Full Payment)
- **2 users included**

**Not Included:**

- Push notifications
- Warehouse management
- Cross-outlet inventory
- Loyalty program

---

### Basic Plan (Rp 300,000/month/outlet)

**Included:**

- Unlimited sales management
- Unlimited purchasing & inventory
  - Quotation
  - Purchase Order
  - Delivery Order
  - Invoice
  - Settlement
- Stock alerts in real-time
- Customized role-based access control
  - Cashier
  - Manager
  - Super Admin
  - Custom roles
- Daily session reports (PDF)
  - Top categories
  - Profit analysis
  - Revenue breakdown
  - Payment methods
- Live sales session tracking
- Delivery list management
- Credit sales tracking (Partial/Full Payment)
- **2 users included**

**Not Included:**

- Push notifications
- Warehouse management
- Cross-outlet inventory
- Loyalty program

**Add-ons Available:**

- Extra User: Rp 50,000/user

---

### Pro Plan (Rp 450,000/month/outlet)

**Includes everything in Basic, plus:**

- **Centralized warehouse & cross-outlet inventory**
  - Central warehouse serving all outlets
  - Stock transfers: Warehouse -> Any Outlet
  - Cross-outlet inventory visibility
  - FIFO costing per warehouse
- **Real-time push notifications**
  - Sales notifications
  - Inventory alerts (low stock, out of stock)
  - Delivery confirmations
  - Payment notifications
- **Basic loyalty program (included)**
  - Loyalty program configuration
  - Customer enrollment & points balance
  - Points earn/redeem during checkout
  - Manual point adjustments
  - Points expiry with FIFO batch deduction
  - Transaction history
  - Loyalty metrics in session reports
- **3 users included**
- **3 notification devices included**
- **1 warehouse included (free)**

**Add-ons Available:**

- Extra User: Rp 50,000/user
- Extra Device: Rp 20,000/device
- Extra Warehouse: Rp 150,000/warehouse
- Advanced Loyalty: Rp 150,000/tenant (unlocks tiers, multipliers, subscription packages)

---

## Architecture

### Billing Model: Per-Outlet Subscription

```
Tenant (Company)
├── Outlet 1 -> Subscription (Basic or Pro) -> Billed separately
├── Outlet 2 -> Subscription (Basic or Pro) -> Billed separately
└── Outlet N -> Subscription (Basic or Pro) -> Billed separately
```

Each outlet has its own subscription and is billed independently.

### Resource Scoping

| Resource   | Scope            | Description                       |
| ---------- | ---------------- | --------------------------------- |
| Users      | Tenant-Wide Pool | Users pooled across all outlets   |
| Devices    | Tenant-Wide Pool | Devices pooled across all outlets |
| Warehouses | Tenant-Wide      | Shared across all outlets         |

### Hybrid Limit Calculation

**Users:** Sum of all outlet user limits (pooled)

- Example: 3 Pro outlets = 3 x 3 = 9 total users
- Users can be assigned to any outlet within the tenant

**Devices:** Sum of all outlet device limits (pooled)

- Example: 3 Pro outlets = 3 x 3 = 9 total devices
- Devices can be used at any outlet

**Warehouses:** Tenant-level, 1 free with Pro plan

- Additional warehouses: Rp 150,000/month each
- Shared across all outlets

---

## Feature Comparison

| Feature                       |     Trial      |     Basic      |       Pro       |
| ----------------------------- | :------------: | :------------: | :-------------: |
| **Sales Management**          |                |                |                 |
| Unlimited transactions        |      Yes       |      Yes       |       Yes       |
| Multiple payment methods      |      Yes       |      Yes       |       Yes       |
| Credit sales tracking         |      Yes       |      Yes       |       Yes       |
| Delivery management           |      Yes       |      Yes       |       Yes       |
| Sales voiding/returns/refunds |      Yes       |      Yes       |       Yes       |
| **Inventory**                 |                |                |                 |
| Outlet-level stock            |      Yes       |      Yes       |       Yes       |
| Real-time stock alerts        |      Yes       |      Yes       |       Yes       |
| Purchasing (PO, DO, Invoice)  |      Yes       |      Yes       |       Yes       |
| Warehouse management          |       No       |       No       |       Yes       |
| Cross-outlet inventory        |       No       |       No       |       Yes       |
| FIFO costing                  |      Yes       |      Yes       |       Yes       |
| **Users & Access**            |                |                |                 |
| Role-based access control     |      Yes       |      Yes       |       Yes       |
| Custom roles                  |      Yes       |      Yes       |       Yes       |
| Users included                |       2        |       2        |        3        |
| Extra user cost               |     Rp 50k     |     Rp 50k     |     Rp 50k      |
| **Notifications**             |                |                |                 |
| Push notifications            |       No       |       No       |       Yes       |
| Devices included              |       0        |       0        |        3        |
| Extra device cost             |      N/A       |      N/A       |     Rp 20k      |
| **Reports**                   |                |                |                 |
| Daily session reports         |      Yes       |      Yes       |       Yes       |
| PDF export                    |      Yes       |      Yes       |       Yes       |
| **Loyalty**                   |                |                |                 |
| Loyalty program settings      |       No       |       No       |       Yes       |
| Customer enrollment           |       No       |       No       |       Yes       |
| Points earn/redeem            |       No       |       No       |       Yes       |
| Manual point adjustment       |       No       |       No       |       Yes       |
| Points expiry (FIFO)          |       No       |       No       |       Yes       |
| Transaction history           |       No       |       No       |       Yes       |
| Membership tiers              |       No       |       No       | Add-on required |
| Tier discounts in checkout    |       No       |       No       | Add-on required |
| Points multipliers per tier   |       No       |       No       | Add-on required |
| Auto tier upgrade (by spend)  |       No       |       No       | Add-on required |
| Subscription packages         |       No       |       No       | Add-on required |
| Customer subscriptions        |       No       |       No       | Add-on required |
| Advanced Loyalty add-on cost  |      N/A       |      N/A       |     Rp 150k     |
| **Multi-Outlet**              |                |                |                 |
| Multiple outlets              | Yes (isolated) | Yes (isolated) | Yes (connected) |
| Centralized warehouse         |       No       |       No       |       Yes       |

---

## Add-On Details

### 1. Extra User (ID: 1)

| Property      | Value                               |
| ------------- | ----------------------------------- |
| Price         | Rp 50,000/month                     |
| Scope         | tenant                              |
| Available For | Basic, Pro                          |
| Description   | Additional user slot for the tenant |

**Billing Logic:**

- Tenant-wide user pool (same as devices)
- Pool size = Sum of all outlet user limits + add-ons
- Automatically calculated when user count exceeds total tenant limit
- Example: 2 Pro outlets (6 free) + 3 extra users = 9 total users allowed

### 2. Extra Device (ID: 2)

| Property      | Value                               |
| ------------- | ----------------------------------- |
| Price         | Rp 20,000/month                     |
| Scope         | tenant                              |
| Available For | Pro only                            |
| Description   | Additional push notification device |

**Billing Logic:**

- Tenant-wide device pool
- Pool size = Sum of all outlet device limits + add-ons
- Example: 2 Pro outlets + 5 extra devices = (2x3) + 5 = 11 total devices

### 3. Extra Warehouse (ID: 3)

| Property      | Value                              |
| ------------- | ---------------------------------- |
| Price         | Rp 150,000/month                   |
| Scope         | tenant                             |
| Available For | Pro only                           |
| Description   | Additional warehouse for inventory |

**Billing Logic:**

- First warehouse is FREE with Pro plan
- Billable warehouses = Total warehouses - 1
- Example: 4 warehouses = 3 billable = Rp 450,000/month

### 4. Advanced Loyalty (ID: 4)

| Property      | Value                                                                |
| ------------- | -------------------------------------------------------------------- |
| Price         | Rp 150,000/month                                                     |
| Scope         | tenant                                                               |
| Available For | Pro only                                                             |
| Max Quantity  | 1                                                                    |
| Add-on Type   | feature                                                              |
| Description   | Advanced loyalty features: tiers, multipliers, subscription packages |

**Loyalty Tier System:**

The `loyaltyTier` field in the JWT token determines what loyalty features are available:

| Tier       | Condition                  | Features                                                                                                             |
| ---------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `none`     | Trial or Basic plan        | No loyalty features                                                                                                  |
| `basic`    | Pro plan (included)        | Program config, enrollment, points earn/redeem/adjust, expiry, transaction history                                   |
| `advanced` | Pro plan + Advanced add-on | Everything in basic + membership tiers, tier discounts, points multipliers, auto tier upgrade, subscription packages |

**Basic Loyalty Features (included with Pro):**

- Loyalty program configuration (name, points rate, expiry, min redeem)
- Customer enrollment (automatic or manual)
- Points earn/redeem during checkout
- Manual point adjustments with audit trail
- Points expiry with FIFO batch deduction
- Transaction history (cursor-paginated)
- Loyalty metrics in session reports

**Advanced Loyalty Features (requires add-on):**

- **Membership tiers** — Define tiers with `minSpend`, `discountPercentage`, `pointsMultiplier`, `sortOrder`
- **Tier discounts in checkout** — Automatic percentage discount based on customer's tier
- **Points multipliers per tier** — Higher tiers earn points faster (e.g., Gold = 1.5x)
- **Auto tier upgrade** — Customers automatically upgrade tiers based on `totalSpend`
- **Manual tier assignment** — Lock a customer to a specific tier (prevents auto-upgrade)
- **Subscription packages (USAGE type)** — Pre-paid quota packages (e.g., "10-Session Wash") linked to categories
- **Subscription packages (TIME type)** — Duration-based discount packages with percentage or fixed amount discount
- **Customer subscription management** — Subscribe, list, cancel, track usage

**Discount Stacking Order (during checkout):**

```
1. Item discounts → subtotal
2. Sales-level discount → discountAmount
3. Service charge, tax, rounding → totalBeforeLoyalty
4. Tier discount % → loyaltyTierDiscountAmount
5. Subscription discount → subscriptionDiscountAmount
6. Point redemption → loyaltyPointsRedemptionValue
= Final totalAmount (what customer pays)
```

**Sales Integration:**

- Points earned automatically on completed sales: `pointsEarned = totalAmount * pointsPerCurrency * tierMultiplier`
- Points redeemed via FIFO deduction from oldest batch
- Subscription quota deducted at sale time
- On void/return/refund: earned points reversed, redeemed points restored, subscription quota restored

**Billing Logic:**

- Feature-type add-on (not quantity-based like users/devices)
- Max quantity: 1 per tenant
- Flat rate: Rp 150,000/month regardless of outlet count
- Auto-removed on Pro → Basic downgrade
- Loyalty data preserved when add-on is removed (features just become inaccessible)

---

## Plan Migration

### Basic -> Pro Upgrade

**What Happens:**

1. Subscription plan updated for all outlets
2. "Main Warehouse" automatically created (free)
3. Push notification support enabled
4. User limit increases from 2 to 3 per outlet
5. Device limit set to 3 per outlet
6. Basic loyalty features become available (`loyaltyTier` → `basic`)
7. **Custom prices are auto-cleared** on all outlets (logged to `custom_price_log`)

**Customer Actions:**

- Can immediately use warehouse features
- Can start registering notification devices
- Optionally migrate outlet stock to warehouse
- Can set up loyalty program and start enrolling customers
- Can optionally purchase Advanced Loyalty add-on for tiers & subscription packages

### Pro -> Basic Downgrade

**What Happens:**

1. All warehouses soft-deleted
2. All device add-ons removed
3. **Advanced Loyalty add-on removed** (if present)
4. User limit decreases from 3 to 2 per outlet
5. Push notifications disabled
6. Loyalty features disabled (`loyaltyTier` → `none`)
7. **Custom prices are auto-cleared** on all outlets (logged to `custom_price_log`)

**Before Downgrade:**

- Transfer warehouse stock back to outlets
- Ensure user count within new limit (or accept add-on charges)

**After Downgrade:**

- Warehouse data preserved (soft delete)
- Loyalty data preserved (programs, tiers, accounts, transactions) but inaccessible
- Can upgrade again to restore warehouses and loyalty access

---

## Cost Calculation Examples

### Example 1: Single Basic Outlet

```
Base Plan:                    Rp 300,000
Extra Users (0):              Rp       0
-----------------------------------------
Total Monthly:                Rp 300,000
```

### Example 2: Single Pro Outlet with Add-ons

```
Base Plan:                    Rp 450,000
Extra Users (2):              Rp 100,000  (2 x 50,000)
Extra Devices (3):            Rp  60,000  (3 x 20,000)
Extra Warehouses (2):         Rp 300,000  (2 x 150,000)
Advanced Loyalty:             Rp 150,000
-----------------------------------------
Total Monthly:              Rp 1,060,000
```

### Example 3: Multi-Outlet Business (3 Pro Outlets)

```
Outlet 1 (Main):
  Base Plan:                  Rp 450,000
  Extra Users (1):            Rp  50,000

Outlet 2 (Branch A):
  Base Plan:                  Rp 450,000
  Extra Users (0):            Rp       0

Outlet 3 (Branch B):
  Base Plan:                  Rp 450,000
  Extra Users (2):            Rp 100,000

Tenant-Wide Add-ons:
  Extra Devices (5):          Rp 100,000  (5 x 20,000)
  Extra Warehouses (2):       Rp 300,000  (2 x 150,000)
  Advanced Loyalty:           Rp 150,000
-----------------------------------------
Total Monthly:              Rp 2,050,000
```

---

## Custom Pricing

### Overview

Admin can override the standard plan price for any specific outlet subscription. This enables negotiated rates, promotional pricing, and per-outlet price adjustments while maintaining a full audit trail.

### Key Principle

```
Effective Price = subscription.customPrice ?? subscription.subscriptionPlan.price
```

If `customPrice` is `null`, the standard plan price is used. If set, the custom price takes precedence.

### Business Rules

| Rule           | Behavior                                                                            |
| -------------- | ----------------------------------------------------------------------------------- |
| On plan change | Custom price is **auto-cleared** (reset to `null`). Admin must re-set if needed.    |
| Scope          | Per-outlet subscription. Different outlets can have different custom prices.        |
| Validation     | `customPrice` must be > 0 or `null`. Zero/negative rejected.                        |
| Discounts      | Discounts still apply on top of the custom price (replaces base price only).        |
| Add-ons        | Add-on prices are NOT customizable. Only the base plan price can be overridden.     |
| Visibility     | Tenants can see `isCustomPrice` flag and `standardPlanPrice` in their billing APIs. |

### Cost Calculation Flow

```
basePlanCost = customPrice ?? subscriptionPlan.price
         |
  + addOnCosts (unchanged)
         |
  - discounts (applied on effective base price)
         |
  = outletTotalCost
```

### Audit Trail

Two layers of audit:

1. **`custom_price_log` table** — tracks every change to `customPrice` (set, changed, cleared, auto-cleared on plan change)
2. **Payment cost snapshots** — each payment freezes `isCustomPrice`, `standardPlanPrice`, and `customPriceNote` at time of payment

### Example: Multi-Outlet Mixed Pricing

```
Tenant "Toko Maju" with 3 Pro outlets:

  Outlet 1 (Main):     customPrice = 350,000    <- Negotiated rate
  Outlet 2 (Branch A): customPrice = null        <- Standard Rp 450,000
  Outlet 3 (Branch B): customPrice = 400,000    <- Partial discount

  Billing Summary:
    Outlet 1: Rp 350,000 (custom)
    Outlet 2: Rp 450,000 (standard)
    Outlet 3: Rp 400,000 (custom)
    Total:    Rp 1,200,000/month
```

---

## Database Schema

### Global Database Tables

**subscription_plan**
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| planName | STRING | "Basic" or "Pro" |
| price | FLOAT | Base price (IDR) |
| maxUsers | INT | Free users per outlet |
| maxDevices | INT | Free devices per outlet |

**subscription_add_on**
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key (1=user, 2=device, 3=warehouse, 4=advanced loyalty) |
| name | STRING | Add-on display name |
| addOnType | STRING | "user", "device", "warehouse", "feature" |
| pricePerUnit | FLOAT | Price per unit (IDR) |
| maxQuantity | INT? | Max allowed quantity (1 for Advanced Loyalty) |
| scope | STRING | "outlet" or "tenant" |

**tenant_subscription**
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| tenantId | INT | Owner tenant |
| outletId | INT | Specific outlet |
| subscriptionPlanId | INT | Current plan |
| status | STRING | Active, Grace, Expired |
| subscriptionValidUntil | DATETIME | Expiry date |
| customPrice | FLOAT? | Override base plan price. `null` = use standard plan price |
| customPriceNote | TEXT? | Admin-entered reason for the custom price |

**tenant_subscription_add_on**
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| subscriptionId | INT | Parent subscription |
| addOnId | INT | Add-on type |
| quantity | INT | Number of add-ons |

**tenant_add_on** (tracks which add-ons a tenant has)
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| tenantId | INT | Tenant |
| addOnId | INT | References subscription_add_on.id |
| quantity | INT | Default 1 |
| createdAt | DATETIME | When add-on was enabled |

Composite unique key: `tenantId_addOnId`

**custom_price_log** (audit table)
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| tenantId | INT | Tenant |
| outletId | INT | Outlet |
| subscriptionId | INT | Subscription |
| previousPrice | FLOAT? | Price before change (`null` if was standard) |
| newPrice | FLOAT? | New price (`null` if reverting to standard) |
| note | TEXT? | Reason for change |
| changedBy | INT? | Admin user ID |
| createdAt | DATETIME | Timestamp |

### Tenant Database Tables (Loyalty)

**loyalty_program**
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| name | STRING | Program display name |
| pointsPerCurrency | DECIMAL | Points earned per currency unit |
| currencyPerPoint | DECIMAL | Currency value per point redeemed |
| pointsExpiryDays | INT? | Days until points expire (`null` = never) |
| minRedeemPoints | DECIMAL | Minimum points for redemption |
| isActive | BOOLEAN | Whether program is active |
| deactivatedAt | DATETIME? | When program was deactivated |

**loyalty_tier** (Advanced Loyalty only)
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| loyaltyProgramId | INT | Parent program |
| name | STRING | Tier name (e.g., "Gold") |
| minSpend | DECIMAL | Spend threshold to qualify |
| discountPercentage | DECIMAL | Automatic checkout discount (e.g., 5%) |
| pointsMultiplier | DECIMAL | Points earn multiplier (e.g., 1.5x) |
| sortOrder | INT | Display ordering |

**loyalty_account**
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| customerId | INT | Linked customer (unique per program) |
| loyaltyProgramId | INT | Parent program |
| currentPoints | DECIMAL | Available point balance |
| totalEarned | DECIMAL | Lifetime points earned |
| totalRedeemed | DECIMAL | Lifetime points redeemed |
| totalSpend | DECIMAL | Lifetime spend (for tier auto-upgrade) |
| loyaltyTierId | INT? | Current tier (Advanced Loyalty only) |
| isManualTier | BOOLEAN | Prevents auto-upgrade when true |
| joinedAt | DATETIME | Enrollment date |

**loyalty_point_batch**
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| loyaltyAccountId | INT | Parent account |
| originalPoints | DECIMAL | Points when batch was created |
| remainingPoints | DECIMAL | Points remaining (decremented by FIFO) |
| expiresAt | DATETIME? | Expiry date (`null` = never) |
| earnedAt | DATETIME | When batch was earned (for FIFO ordering) |
| salesId | INT? | Linked sale (for earn reversal) |

**loyalty_transaction**
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| loyaltyAccountId | INT | Parent account |
| type | STRING | EARN, REDEEM, EARN_REVERSAL, REDEEM_REVERSAL, ADJUST, EXPIRE |
| points | DECIMAL | Points affected |
| balanceAfter | DECIMAL | Balance after transaction |
| salesId | INT? | Linked sale |
| description | STRING? | Audit description |
| performedBy | STRING? | Username who performed action |
| createdAt | DATETIME | Timestamp |

**subscription_package** (Advanced Loyalty only)
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| name | STRING | Package name |
| packageType | STRING | "USAGE" or "TIME" |
| price | DECIMAL | Purchase price |
| totalQuota | INT? | For USAGE: total uses included |
| quotaUnit | STRING? | For USAGE: unit label (e.g., "sessions") |
| durationDays | INT? | For TIME: duration in days |
| discountPercentage | DECIMAL? | For TIME: percentage discount |
| discountAmount | DECIMAL? | For TIME: fixed amount discount |
| validityDays | INT? | For USAGE: days until expiry |
| isActive | BOOLEAN | Whether package is active |

**customer_subscription** (Advanced Loyalty only)
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| customerId | INT | Subscribed customer |
| subscriptionPackageId | INT | Parent package |
| status | STRING | ACTIVE, EXPIRED, CANCELLED |
| startDate | DATETIME | Start date |
| endDate | DATETIME? | End date |
| remainingQuota | INT? | For USAGE: remaining uses |
| usedQuota | INT | Total uses consumed |
| paidAmount | DECIMAL | Amount paid |
| packageSnapshot | JSON | Historical copy of package at time of purchase |

---

## API Reference

### Get Tenant Cost Details

```
GET /api/admin/tenantDetails/:tenantId
```

Returns detailed cost breakdown including base plan, add-ons, and discounts.
Response includes `isCustomPrice` and `standardPlanPrice` per outlet.

### Get Billing Summary

```
GET /api/admin/tenants/:tenantId/billing-summary
```

Returns subscription status, expiry dates, and per-outlet costs.
Response includes `isCustomPrice` and `standardPlanPrice` per outlet.

### Set Custom Price

```
PUT /api/admin/tenants/:tenantId/outlets/:outletId/customPrice
```

Set or clear custom price for a specific outlet subscription.

**Request Body (set custom price):**

```json
{
  "customPrice": 350000,
  "customPriceNote": "Early adopter negotiated rate"
}
```

**Request Body (revert to standard):**

```json
{
  "customPrice": null
}
```

**Response:**

```json
{
  "success": true,
  "message": "Custom price set to Rp 350,000 for outlet Main Outlet",
  "subscription": {
    "id": 1,
    "outletId": 5,
    "planName": "Pro",
    "standardPlanPrice": 450000,
    "customPrice": 350000,
    "customPriceNote": "Early adopter negotiated rate",
    "effectivePrice": 350000
  }
}
```

### Record Payment

```
POST /api/admin/tenants/:tenantId/outlets/:outletId/payments
```

Records payment and extends subscription.
Cost snapshot includes `isCustomPrice`, `standardPlanPrice`, `customPriceNote` audit fields.

### Change Plan

```
PUT /api/admin/tenants/:tenantId/changePlan
Body: { "planName": "Pro" }
```

Upgrades or downgrades tenant plan. **Auto-clears custom price** on all outlets and logs the change.

### Enable Advanced Loyalty

```
POST /api/admin/tenants/:tenantId/addAdvancedLoyalty
```

Enables the Advanced Loyalty add-on for a tenant. Requires Pro plan.
Returns: `{ success, message, addOnId: 4, monthlyCost: 150000 }`

### Remove Advanced Loyalty

```
DELETE /api/admin/tenants/:tenantId/removeAdvancedLoyalty
```

Removes the Advanced Loyalty add-on. Loyalty data is preserved but advanced features become inaccessible. JWT `loyaltyTier` downgrades to `basic` on next token refresh.

### Loyalty Program

```
GET    /api/loyalty/program                        # Get program config (basic)
POST   /api/loyalty/program                        # Create program (basic)
PUT    /api/loyalty/program/:id                    # Update program (basic)
```

### Enrollment & Account

```
POST   /api/loyalty/enroll                          # Enroll customer (basic)
GET    /api/loyalty/account/customer/:customerId    # Get account (basic)
```

### Points Operations

```
POST   /api/loyalty/account/:id/earn               # Earn points (basic)
POST   /api/loyalty/account/:id/redeem             # Redeem points (basic)
POST   /api/loyalty/account/:id/adjust             # Adjust points (basic)
GET    /api/loyalty/account/:id/transactions       # Transaction history (basic)
GET    /api/loyalty/account/:id/expiring?days=30   # Expiring points preview (basic)
```

### Tier Management (Advanced Loyalty only)

```
POST   /api/loyalty/tier                            # Create tier
PUT    /api/loyalty/tier/:id                        # Update tier
DELETE /api/loyalty/tier/:id                        # Delete tier
GET    /api/loyalty/tier/program/:programId         # List tiers
PUT    /api/loyalty/account/:id/tier                # Assign tier to customer
```

### Subscription Packages (Advanced Loyalty only)

```
GET    /api/subscription/package                    # List packages
POST   /api/subscription/package                    # Create package
GET    /api/subscription/package/:id                # Get package
PUT    /api/subscription/package/:id                # Update package
DELETE /api/subscription/package/:id                # Delete package
```

### Customer Subscriptions (Advanced Loyalty only)

```
POST   /api/subscription/subscribe                  # Subscribe customer
GET    /api/subscription/customer/:customerId       # List subscriptions
GET    /api/subscription/subscription/:id           # Get subscription
PUT    /api/subscription/cancel/:id                 # Cancel subscription
POST   /api/subscription/usage                      # Record usage (called from sales)
```

---

## Technical Implementation

### Code Locations

| Component               | File                                        |
| ----------------------- | ------------------------------------------- |
| Plan definitions        | `src/script/subscription_plan_seed.ts`      |
| Add-on definitions      | `src/script/subscription_add_on_seed.ts`    |
| Device pricing constant | `src/pushy/device.service.ts`               |
| Cost calculation        | `src/admin/admin.service.ts`                |
| Plan change logic       | `src/admin/admin.service.ts`                |
| Add-on ID constants     | `src/constants/add-on-ids.ts`               |
| Loyalty gate middleware | `src/middleware/loyalty-gate.middleware.ts` |
| Loyalty service         | `src/loyalty/loyalty.service.ts`            |
| Loyalty controller      | `src/loyalty/loyalty.controller.ts`         |
| Subscription packages   | `src/subscription/subscription.service.ts`  |
| Loyalty cache           | `src/cache/simple-cache.service.ts`         |
| Sales loyalty logic     | `src/sales/sales.service.ts`                |

### Seed Scripts

Update database with current pricing:

```bash
npx ts-node src/script/subscription_plan_seed.ts
npx ts-node src/script/subscription_add_on_seed.ts
```

---

## Version History

| Version | Date       | Changes                                                     |
| ------- | ---------- | ----------------------------------------------------------- |
| 1.0     | 2025-01-22 | Initial documentation                                       |
| 1.1     | 2026-03-02 | Added custom pricing capability (per-outlet price override) |
| 1.2     | 2026-03-07 | Added Advanced Loyalty add-on documentation                 |

---

## Related Documentation

- [Admin Module API](src/admin/ADMIN_MODULE_API_DOCUMENTATION.md)
- [Pushy Implementation](src/pushy/PUSHY_IMPLEMENTATION.md)
- [Warehouse Feature](WAREHOUSE_FEATURE.md)
- [Loyalty API Contract](docs/LOYALTY.md)
