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

| Add-On          | Price (IDR)          | Scope       | Availability |
| --------------- | -------------------- | ----------- | ------------ |
| Extra User      | Rp 50,000/user       | Tenant-wide | Basic & Pro  |
| Extra Device    | Rp 20,000/device     | Tenant-wide | Pro only     |
| Extra Warehouse | Rp 150,000/warehouse | Tenant-wide | Pro only     |

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
- **3 users included**
- **3 notification devices included**
- **1 warehouse included (free)**

**Add-ons Available:**

- Extra User: Rp 50,000/user
- Extra Device: Rp 20,000/device
- Extra Warehouse: Rp 150,000/warehouse

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

---

## Plan Migration

### Basic -> Pro Upgrade

**What Happens:**

1. Subscription plan updated for all outlets
2. "Main Warehouse" automatically created (free)
3. Push notification support enabled
4. User limit increases from 2 to 3 per outlet
5. Device limit set to 3 per outlet
6. **Custom prices are auto-cleared** on all outlets (logged to `custom_price_log`)

**Customer Actions:**

- Can immediately use warehouse features
- Can start registering notification devices
- Optionally migrate outlet stock to warehouse

### Pro -> Basic Downgrade

**What Happens:**

1. All warehouses soft-deleted
2. All device add-ons removed
3. User limit decreases from 3 to 2 per outlet
4. Push notifications disabled
5. **Custom prices are auto-cleared** on all outlets (logged to `custom_price_log`)

**Before Downgrade:**

- Transfer warehouse stock back to outlets
- Ensure user count within new limit (or accept add-on charges)

**After Downgrade:**

- Warehouse data preserved (soft delete)
- Can upgrade again to restore warehouses

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
-----------------------------------------
Total Monthly:                Rp 910,000
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
-----------------------------------------
Total Monthly:              Rp 1,900,000
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

| Rule | Behavior |
|------|----------|
| On plan change | Custom price is **auto-cleared** (reset to `null`). Admin must re-set if needed. |
| Scope | Per-outlet subscription. Different outlets can have different custom prices. |
| Validation | `customPrice` must be > 0 or `null`. Zero/negative rejected. |
| Discounts | Discounts still apply on top of the custom price (replaces base price only). |
| Add-ons | Add-on prices are NOT customizable. Only the base plan price can be overridden. |
| Visibility | Tenants can see `isCustomPrice` flag and `standardPlanPrice` in their billing APIs. |

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
| id | INT | Primary key (1=user, 2=device, 3=warehouse) |
| name | STRING | Add-on display name |
| addOnType | STRING | "user", "device", "warehouse" |
| pricePerUnit | FLOAT | Price per unit (IDR) |
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

---

## Technical Implementation

### Code Locations

| Component               | File                                     |
| ----------------------- | ---------------------------------------- |
| Plan definitions        | `src/script/subscription_plan_seed.ts`   |
| Add-on definitions      | `src/script/subscription_add_on_seed.ts` |
| Device pricing constant | `src/pushy/device.service.ts`            |
| Cost calculation        | `src/admin/admin.service.ts`             |
| Plan change logic       | `src/admin/admin.service.ts`             |

### Seed Scripts

Update database with current pricing:

```bash
npx ts-node src/script/subscription_plan_seed.ts
npx ts-node src/script/subscription_add_on_seed.ts
```

---

## Version History

| Version | Date       | Changes               |
| ------- | ---------- | --------------------- |
| 1.0     | 2025-01-22 | Initial documentation |
| 1.1     | 2026-03-02 | Added custom pricing capability (per-outlet price override) |

---

## Related Documentation

- [Admin Module API](src/admin/ADMIN_MODULE_API_DOCUMENTATION.md)
- [Pushy Implementation](src/pushy/PUSHY_IMPLEMENTATION.md)
- [Warehouse Feature](WAREHOUSE_FEATURE.md)
