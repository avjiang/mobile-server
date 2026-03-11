# Admin Module API Documentation

This document provides comprehensive documentation for all Admin Module endpoints, including tenant management, subscription plans, device quotas, warehouse operations, and payment management.

---

## Changelog

### v1.4.0 - Plan Type Support (2026-03-11)

**New Features:**

- **`planType` field** — Subscription plans now support business types: `"Retail"`, `"F&B"`, `"Laundry"`
- **`planType` in JWT** — Added to `UserInfo` payload for middleware access
- **`planType` in login/refresh response** — Returned alongside `planName`
- **`planType` in signup** — Optional field (defaults to `"Retail"`)
- **Composite unique key** — `subscription_plan` unique constraint changed from `PLAN_NAME` to `(PLAN_NAME, PLAN_TYPE)`

**Affected Endpoints:**
| Endpoint | Changes |
|----------|---------|
| `POST /signup` | New optional `planType` field in request body |
| `PUT /tenants/:tenantId/changePlan` | Preserves tenant's `planType` when switching plans |
| `POST /auth/login` | Response now includes `planType` |
| `POST /auth/refresh-token` | Response now includes `planType` |

**See:** [ADMIN_ENDPOINT_CHANGES.md](../../docs/ADMIN_ENDPOINT_CHANGES.md) for full details (sections 11-13).

---

### v1.3.0 - Add-On Architecture Refactor & Loyalty (2026-03-02)

**Breaking Changes:**

- **Add-ons moved from per-outlet to per-tenant** — `tenantAddOns` array at top level replaces per-outlet `subscription.addOns`
- **Cost responses restructured** — `totalAddOnCost` added, discounts apply to plan costs only
- **Custom pricing support** — `isCustomPrice`, `standardPlanPrice`, `customPriceNote` added to all cost/billing endpoints
- **Cost snapshot updated** — Now includes custom pricing fields for historical audit

**New Features:**

- Custom price override per outlet with admin notes
- Advanced Loyalty add-on (ID 4) — feature-type tenant add-on
- Add/Remove Advanced Loyalty endpoints (`POST/DELETE /tenants/:tenantId/addons/loyalty`)
- `loyaltyTier` field in JWT (`none` | `basic` | `advanced`)
- 6 new Loyalty permissions

**Affected Endpoints:**
| Endpoint | Changes |
|----------|---------|
| `GET /tenantDetails/:id` | New structure: `tenantAddOns` at top level, custom pricing fields |
| `GET /getAllTenantSubscription` | SQL rewritten for tenant-level add-ons + custom pricing |
| `GET /tenants/:tenantId/billing-summary` | `tenantAddOns` at top level, custom pricing fields per outlet |
| `GET /account/outlet/:id` | `addOns` array + `totalMonthlyCost` added |
| Cost Snapshot (payments) | Custom pricing fields added |

**See:** [ADMIN_ENDPOINT_CHANGES.md](../../docs/ADMIN_ENDPOINT_CHANGES.md) for full before/after JSON comparisons.

---

### v1.2.0 - User Management Enhancement (2025-01-06)

**New Features:**

- Get all users for a specific tenant with optional deleted filter

**New Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/tenants/:tenantId/users` | GET | Get all users for a tenant |

**Breaking Changes:** None

---

### v1.1.0 - Payment Management (2025-01-27)

**New Features:**

- Manual payment recording with invoice generation (INV-YYYYMM-XXXX format)
- Payment history tracking per outlet with cost snapshots
- Subscription extension (monthly/annual)
- 7-day grace period for expired subscriptions
- Upcoming payment reminders with Summary + Drill-down pattern
- Consolidated billing summary across all outlets

**New Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/tenants/:tenantId/outlets/:outletId/payments` | POST | Record payment & extend subscription |
| `/tenants/:tenantId/payments` | GET | Get tenant payment history |
| `/payments` | GET | Get all payments (admin dashboard) |
| `/tenants/:tenantId/billing-summary` | GET | Consolidated billing view |
| `/payments/upcoming/summary` | GET | Summary counts by status |
| `/payments/upcoming` | GET | Paginated list of expiring subscriptions |

**New Database Table:**

- `tenant_payment` - Stores payment records with cost snapshots (JSON)

**Breaking Changes:** None

---

## Table of Contents

1. [Tenant Management](#1-tenant-management)
2. [Subscription & Billing](#2-subscription--billing)
3. [User Management](#3-user-management)
4. [Advanced Loyalty Add-On](#4-advanced-loyalty-add-on)
5. [Device Quota Management](#5-device-quota-management)
6. [Warehouse Management](#6-warehouse-management)
7. [Subscription Plan Changes](#7-subscription-plan-changes)
8. [Payment Management](#8-payment-management)

---

## Base URL

All endpoints are prefixed with:

```
/api/admin
```

---

## 1. Tenant Management

### 1.1 Create Tenant (Signup)

**Endpoint:** `POST /api/admin/signup`

**Description:** Creates a new tenant with database initialization, default outlet, owner user, and subscription.

**Authentication:** Not required (public signup)

**Request Body:**

```json
{
  "tenant": {
    "tenantName": "My Coffee Shop",
    "plan": "Pro",
    "planType": "Retail"
  }
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tenant.tenantName` | string | Yes | Name of the tenant organization |
| `tenant.plan` | string | Yes | Subscription plan name (`Trial`, `Basic`, `Pro`) |
| `tenant.planType` | string | No | Business type: `"Retail"`, `"F&B"`, `"Laundry"`. Defaults to `"Retail"` |

**Response (Success - 200):**

```json
{
  "tenant": {
    "id": 1,
    "tenantName": "My Coffee Shop",
    "databaseName": "my_coffee_shop_db",
    "createdAt": "2025-10-28T10:00:00.000Z"
  },
  "tenantUser": {
    "id": 1,
    "username": "my_coffee_shop",
    "tenantId": 1,
    "role": "Owner"
  },
  "subscription": {
    "id": 1,
    "tenantId": 1,
    "outletId": 1,
    "subscriptionPlanId": 2,
    "status": "Active",
    "nextPaymentDate": "2025-11-27T10:00:00.000Z",
    "subscriptionValidUntil": "2025-11-27T10:00:00.000Z",
    "subscriptionPlan": {
      "id": 2,
      "planName": "Pro",
      "price": 0,
      "maxTransactions": null,
      "maxProducts": null,
      "maxUsers": null,
      "maxDevices": 3
    }
  },
  "warehouse": {
    "id": 1,
    "warehouseName": "Main Warehouse",
    "warehouseCode": "MAIN_WAREHOUSE",
    "tenantWarehouseId": 1
  }
}
```

**Notes:**

- Auto-generates database name from tenant name
- Creates default owner user with username matching tenant name (lowercased, spaces replaced with `_`)
- Creates "Main Outlet" by default
- For `Pro` plan: creates a free "Main Warehouse"
- Initial password = username (should be changed after first login)

---

### 1.2 Get Tenant Cost Details

**Endpoint:** `GET /api/admin/tenantDetails/:id`

**Description:** Retrieves detailed cost breakdown for a specific tenant including base plan, add-ons, and discounts.

**Authentication:** Required

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | Tenant ID |

**Response (Success - 200):**

```json
{
  "tenantId": 1,
  "tenantName": "My Coffee Shop",
  "outletCount": 1,
  "tenantAddOns": [
    { "name": "Extra Device", "quantity": 2, "pricePerUnit": 20000, "totalCost": 40000 },
    { "name": "Extra Warehouse", "quantity": 1, "pricePerUnit": 150000, "totalCost": 150000 }
  ],
  "totalAddOnCost": 190000,
  "outlets": [
    {
      "outletId": 1,
      "outletName": "Main Outlet",
      "subscription": {
        "planName": "Pro",
        "basePlanCost": 450000,
        "isCustomPrice": false,
        "standardPlanPrice": 450000,
        "customPriceNote": "",
        "discounts": [
          { "name": "Early Bird", "type": "percentage", "value": 10, "amount": 45000 }
        ],
        "totalCost": 405000,
        "totalCostBeforeDiscount": 450000,
        "totalDiscount": 45000,
        "status": "Active",
        "subscriptionValidUntil": "2026-04-01T00:00:00.000Z"
      },
      "lastPayment": null
    }
  ],
  "totalMonthlyCost": 595000,
  "totalCostBeforeDiscount": 640000,
  "totalDiscount": 45000
}
```

**Response Fields:**
| Field | Description |
|-------|-------------|
| `tenantAddOns` | Tenant-level add-ons (no longer inside per-outlet subscription) |
| `totalAddOnCost` | Sum of all tenant add-on costs |
| `isCustomPrice` | `true` if this outlet has a custom price override |
| `standardPlanPrice` | The original plan price before any custom override |
| `customPriceNote` | Admin note for why custom price was applied (empty string if none) |
| `basePlanCost` | Effective price: `customPrice` if set, otherwise `standardPlanPrice` |
| `totalMonthlyCost` | Sum of all outlet plan costs (after discounts) + tenant add-on costs |

**Pricing Summary:**

- **Basic Plan Base:** 300,000 IDR/month per outlet
- **Pro Plan Base:** 450,000 IDR/month per outlet
- **Extra User:** 50,000 IDR/month per user (beyond plan limit)
- **Extra Warehouse:** 150,000 IDR/month per warehouse (first warehouse free, Pro only)
- **Extra Device:** 20,000 IDR/month per device (beyond plan limit, Pro only)
- **Advanced Loyalty:** 150,000 IDR/month per tenant (feature add-on)

**See Also:** For payment status information (expiry dates, grace period), use [`/tenants/:tenantId/billing-summary`](#85-get-tenant-billing-summary) instead.

---

### 1.3 Get All Tenants Subscription Summary

**Endpoint:** `GET /api/admin/getAllTenantSubscription`

**Description:** Retrieves aggregated billing summary for ALL tenants (Provider/Admin use).

**Authentication:** Required

**Response (Success - 200):**

```json
{
  "totalRevenue": 1500000,
  "totalRevenueBeforeDiscount": 1600000,
  "totalDiscount": 100000,
  "tenants": [
    {
      "tenantId": 1,
      "tenantName": "My Coffee Shop",
      "totalMonthlyCost": 250000,
      "totalCostBeforeDiscount": 250000,
      "totalDiscount": 0
    },
    {
      "tenantId": 2,
      "tenantName": "Bakery Delights",
      "totalMonthlyCost": 350000,
      "totalCostBeforeDiscount": 400000,
      "totalDiscount": 50000
    }
  ]
}
```

**Notes:**

- Uses optimized raw SQL query for performance
- Only includes tenants with active subscriptions
- Automatically calculates percentage and fixed discounts

---

---

### 1.4 Get Tenant Overview

**Endpoint:** `GET /api/admin/tenantOverview`

**Description:** Retrieves high-level tenant statistics including total counts, active/inactive status, and monthly growth.

**Authentication:** Required

**Response (Success - 200):**

```json
{
  "totalTenantCount": 150,
  "totalActiveTenantCount": 145,
  "totalInactiveTenantCount": 5,
  "totalTenantsCreatedThisMonth": 12
}
```

**Response Fields:**
| Field | Description |
|-------|-------------|
| `totalTenantCount` | Total number of tenants registered in the system |
| `totalActiveTenantCount` | Tenants with at least one active subscription (Active, Trial) |
| `totalInactiveTenantCount` | Tenants with no active subscriptions (all expired or none) |
| `totalTenantsCreatedThisMonth` | Number of new tenants created since the 1st of the current month |

---

## 2. Subscription & Billing

### 2.1 Subscription Plans

Current available plans:

| Plan      | Base Price  | Max Users | Max Devices | Warehouses               | Features                                       |
| --------- | ----------- | --------- | ----------- | ------------------------ | ---------------------------------------------- |
| **Trial** | 0 IDR       | 2 free    | 0           | Not supported            | Basic POS                                      |
| **Basic** | 300,000 IDR | 2 free    | 0           | Not supported            | Basic POS                                      |
| **Pro**   | 450,000 IDR | 3 free    | 3           | 1 free, then 150k/month  | Advanced POS + Warehouses + Push Notifications |

### 2.2 Add-on Pricing

| Add-on ID | Name                                | Type      | Price       | Scope  | Description                            |
| --------- | ----------------------------------- | --------- | ----------- | ------ | -------------------------------------- |
| 1         | Extra User                          | user      | 50,000 IDR  | tenant | Additional user slot (tenant-wide pool)|
| 2         | Additional Push Notification Device | device    | 20,000 IDR  | tenant | Extra device beyond plan limit         |
| 3         | Extra Warehouse                     | warehouse | 150,000 IDR | tenant | Additional warehouse beyond first free |
| 4         | Advanced Loyalty                    | feature   | 150,000 IDR | tenant | Enables advanced loyalty tier features |

---

## 3. User Management

### 3.1 Create Tenant User

**Endpoint:** `POST /api/admin/createTenantUser/:tenantId`

**Description:** Creates a new user in both global and tenant databases. Automatically creates user add-on if exceeding plan limits.

**Authentication:** Required

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `tenantId` | number | Tenant ID |

**Request Body:**

```json
{
  "username": "john_doe",
  "password": "SecurePassword123!"
}
```

**Response (Success - 200):**

```json
{
  "tenantId": 1,
  "tenantUserId": 5,
  "userId": 3,
  "username": "john_doe"
}
```

**Notes:**

- Creates user in **both** global DB and tenant DB
- Username must be globally unique
- No roles assigned initially (admin assigns roles later)
- If user count exceeds plan limit, auto-creates user add-on (ID 1)

---

### 3.2 Get Tenant Users

**Endpoint:** `GET /api/admin/tenants/:tenantId/users`

**Description:** Retrieves all users for a specific tenant. Optionally includes soft-deleted users.

**Authentication:** Required

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `tenantId` | number | Tenant ID |

**Query Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `includeDeleted` | boolean | No | false | Include soft-deleted users |

**Example Requests:**

```
GET /api/admin/tenants/1/users
GET /api/admin/tenants/1/users?includeDeleted=true
```

**Response (Success - 200):**

```json
{
  "tenantId": 1,
  "tenantName": "My Coffee Shop",
  "users": [
    { "id": 1, "username": "owner", "role": "Owner", "isDeleted": false },
    { "id": 2, "username": "cashier_01", "role": "Cashier", "isDeleted": false }
  ],
  "total": 2,
  "activeCount": 2
}
```

**Response Fields:**
| Field | Description |
|-------|-------------|
| `tenantId` | The tenant ID |
| `tenantName` | Name of the tenant |
| `users` | Array of user objects |
| `total` | Total count of users returned |
| `activeCount` | Count of non-deleted users |

---

### 3.3 Delete Tenant User

**Endpoint:** `DELETE /api/admin/tenants/:tenantId/users/:userId`

**Description:** Soft-deletes a user in both global and tenant databases. Automatically recalculates and reduces/removes user add-on (ID 1) if applicable.

**Authentication:** Required

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `tenantId` | number | Tenant ID |
| `userId` | number | User ID (global tenant_user ID) |

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "User deleted successfully",
  "tenantId": 1,
  "deletedUserId": 5,
  "username": "john_doe"
}
```

**Error Response (Cannot delete owner):**

```json
{
  "error": "Cannot delete the tenant owner"
}
```

**Error Response (User already deleted):**

```json
{
  "error": "User is already deleted"
}
```

**Error Response (User not found):**

```json
{
  "error": "User not found"
}
```

**Notes:**

- Performs **soft delete** (sets `isDeleted = true` in global DB, `deleted = true` in tenant DB)
- **Cannot delete the tenant Owner** - protected to prevent locking out the tenant
- Automatically recalculates user add-on quantity based on remaining active users
- **Removes user add-on** (ID 1) if user count drops below or equals plan limit
- **Reduces user add-on quantity** if still over limit but fewer extra users needed
- Follows same pattern as device quota and warehouse management
- Uses best-effort rollback on error

**Example Flow:**

```bash
# Scenario: Pro plan tenant (3 free users) with 5 total users (2 extra = add-on quantity of 2)

# Before deletion
GET /api/admin/tenantDetails/1
# Response shows: user add-on quantity = 2, cost = varies

# Delete one user
DELETE /api/admin/tenants/1/users/5
# Result:
# - User soft-deleted in both databases
# - Remaining active users: 4 (1 over limit)
# - User add-on quantity automatically reduced: 2 → 1

# Delete another user
DELETE /api/admin/tenants/1/users/4
# Result:
# - User soft-deleted in both databases
# - Remaining active users: 3 (at limit)
# - User add-on completely removed (quantity 0)
# - Cost reduced accordingly
```

**Add-on Management Logic:**

| Plan  | Free Users | Total Active Users | Add-on Quantity | Action                 |
| ----- | ---------- | ------------------ | --------------- | ---------------------- |
| Basic | 2          | 2                  | 0               | No add-on needed       |
| Basic | 2          | 3                  | 1               | Create/update add-on   |
| Basic | 2          | 1 (after delete)   | 0               | Remove add-on          |
| Pro   | 3          | 3                  | 0               | No add-on needed       |
| Pro   | 3          | 5                  | 2               | Create/update add-on   |
| Pro   | 3          | 4 (after delete)   | 1               | Reduce add-on quantity |
| Pro   | 3          | 3 (after delete)   | 0               | Remove add-on          |


### 3.4 Forgot Tenant User Password (Force Reset)

**Endpoint:** `POST /api/admin/tenants/:tenantId/users/:userId/forgot-password`

**Description:** Force-resets a user's password. Generates and returns a random temporary password. Used when the current password is lost.

**Authentication:** Required (Admin/Owner)

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `tenantId` | number | Tenant ID |
| `userId` | number | User ID (global tenant_user ID) |

**Request Body:** None (Empty JSON `{}`)

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Password reset successfully",
  "temporaryPassword": "a1b2c3d4e5f6g7h8"
}
```

**Notes:**

- Updates password in **both** Global and Tenant databases.
- Returns a raw password string that must be communicated to the user.
- No email is sent (system currently lacks email integration).

---

## 4. Advanced Loyalty Add-On

### 4.1 Add Advanced Loyalty

**Endpoint:** `POST /api/admin/tenants/:tenantId/addons/loyalty`

**Description:** Enables the Advanced Loyalty add-on for a tenant. Requires Pro plan. This is a feature flag add-on (quantity is always 1).

**Authentication:** Required

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `tenantId` | number | Tenant ID |

**Request Body:** None

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Advanced Loyalty add-on enabled",
  "tenantId": 1,
  "addOnId": 4,
  "monthlyCost": 150000
}
```

**Error Responses:**

| Status | Message | When |
|--------|---------|------|
| 400 | "Advanced Loyalty is only available on the Pro plan" | Tenant is on Basic/Trial |
| 400 | "Tenant already has the Advanced Loyalty add-on" | Add-on already active |
| 404 | "No active subscription found for tenant" | Tenant has no active subscription |

**Notes:**

- After adding, the tenant's next login/refresh will return `loyaltyTier: "advanced"` in the JWT
- Cost (150,000 IDR/month) appears automatically in `tenantAddOns` on all cost endpoints
- No request body needed — it's a binary toggle (on/off), not quantity-based

---

### 4.2 Remove Advanced Loyalty

**Endpoint:** `DELETE /api/admin/tenants/:tenantId/addons/loyalty`

**Description:** Removes the Advanced Loyalty add-on from a tenant. Tenant reverts to basic loyalty (points only, no tiers/subscriptions).

**Authentication:** Required

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `tenantId` | number | Tenant ID |

**Request Body:** None

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Advanced Loyalty add-on removed",
  "tenantId": 1
}
```

**Error Response:**

| Status | Message | When |
|--------|---------|------|
| 404 | "Advanced Loyalty add-on not found for this tenant" | Add-on not active |

**Notes:**

- After removing, the tenant's next login/refresh will return `loyaltyTier: "basic"` (if still on Pro plan)
- Existing loyalty data (tiers, subscription packages, customer subscriptions) is NOT deleted — it's just inaccessible via the API until the add-on is re-enabled
- This add-on is also automatically removed when downgrading from Pro to Basic

---

## 5. Device Quota Management

### 5.1 Get Tenant Devices

**Endpoint:** `GET /api/admin/tenantDevices/:tenantId`

**Description:** Retrieves all devices (active and inactive) for a tenant with usage statistics.

**Authentication:** Required

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `tenantId` | number | Tenant ID |

**Response (Success - 200):**

```json
{
  "tenantId": 1,
  "tenantName": "My Coffee Shop",
  "deviceUsage": {
    "active": 5,
    "inactive": 2,
    "total": 7,
    "maximum": 8
  },
  "devices": [
    {
      "id": 1,
      "deviceToken": "abc123xyz",
      "platform": "android",
      "deviceName": "Samsung Galaxy S21",
      "appVersion": "1.2.3",
      "isActive": true,
      "lastActiveAt": "2025-10-28T09:30:00.000Z",
      "createdAt": "2025-10-20T10:00:00.000Z",
      "user": {
        "id": 2,
        "username": "cashier_01",
        "role": "Cashier"
      },
      "allocation": {
        "type": "subscription",
        "activatedAt": "2025-10-20T10:05:00.000Z"
      }
    }
  ]
}
```

---

### 5.2 Add Device Quota

**Endpoint:** `POST /api/admin/addDeviceQuota/:tenantId`

**Description:** Increases device quota by purchasing add-on devices (ID 2).

**Authentication:** Required

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `tenantId` | number | Tenant ID |

**Request Body:**

```json
{
  "quantity": 5
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Added 5 device quota. Total add-on devices: 8",
  "tenantId": 1,
  "addOnQuantity": 8,
  "monthlyCost": 152000,
  "subscriptionId": 1
}
```

**Notes:**

- Price: 20,000 IDR/month per device
- Updates existing add-on or creates new one
- Immediate effect - devices can be activated right away

---

### 5.3 Reduce Device Quota

**Endpoint:** `POST /api/admin/reduceDeviceQuota/:tenantId`

**Description:** Reduces device quota. Automatically deactivates excess devices (FIFO - oldest first).

**Authentication:** Required

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `tenantId` | number | Tenant ID |

**Request Body:**

```json
{
  "quantity": 3
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Reduced 3 device quota. Automatically deactivated 2 excess device(s).",
  "tenantId": 1,
  "addOnQuantity": 5,
  "monthlyCost": 50000,
  "subscriptionId": 1,
  "quota": {
    "previous": 8,
    "current": 5
  },
  "devices": {
    "active": 5,
    "deactivated": 2,
    "deactivatedList": [
      {
        "deviceToken": "old_device_1",
        "platform": "android",
        "deviceName": "Old Phone",
        "username": "john_doe",
        "lastActiveAt": "2025-09-15T08:00:00.000Z"
      },
      {
        "deviceToken": "old_device_2",
        "platform": "ios",
        "deviceName": "iPhone 11",
        "username": "jane_smith",
        "lastActiveAt": "2025-09-20T12:00:00.000Z"
      }
    ]
  }
}
```

**Notes:**

- Validates that reduction doesn't exceed current add-on quantity
- Automatically deactivates oldest devices first (based on `lastActiveAt`)
- Deallocates deactivated devices
- If quantity becomes 0, deletes the add-on entirely

---

## 6. Warehouse Management

### 6.1 Create Warehouse

**Endpoint:** `POST /api/admin/tenants/:tenantId/warehouses`

**Description:** Creates a new warehouse for the tenant. First warehouse is FREE, additional warehouses cost 149k IDR/month each. If a warehouse with the same name was previously deleted, it will be **reactivated** instead of creating a duplicate.

**Authentication:** Required (POS Owner only)

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `tenantId` | number | Tenant ID |

**Request Body:**

```json
{
  "warehouseName": "Downtown Warehouse",
  "street": "123 Main Street",
  "city": "Jakarta",
  "state": "DKI Jakarta",
  "postalCode": "12345",
  "country": "Indonesia",
  "contactPhone": "+62-21-1234567",
  "contactEmail": "warehouse@company.com"
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `warehouseName` | string | Yes | Warehouse name |
| `street` | string | No | Street address |
| `city` | string | No | City |
| `state` | string | No | State/Province |
| `postalCode` | string | No | Postal/ZIP code |
| `country` | string | No | Country |
| `contactPhone` | string | No | Contact phone number |
| `contactEmail` | string | No | Contact email |

**Response (Success - 200 - New Creation):**

```json
{
  "success": true,
  "message": "Warehouse created. Additional charge: 149000 IDR/month",
  "warehouse": {
    "id": 2,
    "tenantWarehouseId": 2,
    "warehouseName": "Downtown Warehouse",
    "warehouseCode": "DOWNTOWN_WAREHOUSE",
    "street": "123 Main Street",
    "city": "Jakarta",
    "state": "DKI Jakarta",
    "postalCode": "12345",
    "country": "Indonesia",
    "contactPhone": "+62-21-1234567",
    "contactEmail": "warehouse@company.com"
  },
  "wasReactivated": false,
  "billing": {
    "totalWarehouses": 2,
    "billableWarehouses": 1,
    "monthlyCost": 149000,
    "isFreeWarehouse": false
  }
}
```

**Response (Success - 200 - Reactivation):**

```json
{
  "success": true,
  "message": "Warehouse reactivated. Additional charge: 149000 IDR/month",
  "warehouse": {
    "id": 2,
    "tenantWarehouseId": 2,
    "warehouseName": "Downtown Warehouse",
    "warehouseCode": "DOWNTOWN_WAREHOUSE",
    "street": "456 Updated Street",
    "city": "Bandung",
    "state": "West Java",
    "postalCode": "54321",
    "country": "Indonesia",
    "contactPhone": "+62-21-9999999",
    "contactEmail": "updated@company.com"
  },
  "wasReactivated": true,
  "billing": {
    "totalWarehouses": 2,
    "billableWarehouses": 1,
    "monthlyCost": 149000,
    "isFreeWarehouse": false
  }
}
```

**For first warehouse:**

```json
{
  "success": true,
  "message": "First warehouse created successfully (FREE)",
  "warehouse": { ... },
  "wasReactivated": false,
  "billing": {
    "totalWarehouses": 1,
    "billableWarehouses": 0,
    "monthlyCost": 0,
    "isFreeWarehouse": true
  }
}
```

**Notes:**

- **Smart Reactivation:** If a warehouse with the same name was previously deleted, it will be reactivated instead of creating a duplicate
- When reactivating, warehouse data (address, phone, email) is updated with new values provided
- Creates warehouse in **both** global and tenant databases (atomic transaction)
- Auto-generates `warehouseCode` from warehouse name (e.g., "Downtown Warehouse" → "DOWNTOWN_WAREHOUSE")
- First warehouse: FREE
- Additional warehouses: 150,000 IDR/month each
- Automatically creates/updates warehouse add-on (ID 3)
- `wasReactivated` flag indicates whether warehouse was created fresh or reactivated

---

### 6.2 Delete Warehouse

**Endpoint:** `DELETE /api/admin/tenants/:tenantId/warehouses/:id`

**Description:** Soft-deletes a warehouse. Automatically recalculates billing. Cannot delete warehouse with active stock.

**Authentication:** Required (POS Owner only)

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `tenantId` | number | Tenant ID |
| `id` | number | Warehouse ID (tenant DB ID) |

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "2 warehouse(s) remaining. Billable: 1",
  "billing": {
    "remainingWarehouses": 2,
    "billableWarehouses": 1,
    "monthlyCost": 100000
  }
}
```

**Error Response (Warehouse has stock):**

```json
{
  "error": "Cannot delete warehouse with active stock. Please transfer or clear stock first."
}
```

**Notes:**

- Performs **soft delete** (sets `deleted = true`, `deletedAt = NOW()`)
- Validates no active stock exists (`availableQuantity > 0`)
- Updates warehouse add-on quantity automatically
- Removes add-on if no billable warehouses remain
- **Deleted warehouses can be reactivated** by creating a warehouse with the same name

---

### 6.3 Get All Warehouses

**Endpoint:** `GET /api/admin/tenants/:tenantId/warehouses`

**Description:** Retrieves all active (non-deleted) warehouses for a tenant.

**Authentication:** Required (POS Owner only)

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `tenantId` | number | Tenant ID |

**Response (Success - 200):**

```json
{
  "data": [
    {
      "id": 1,
      "tenantId": 1,
      "warehouseName": "Main Warehouse",
      "warehouseCode": "MAIN_WAREHOUSE",
      "address": "456 Storage Ave, Jakarta, DKI Jakarta 67890",
      "isActive": true,
      "deleted": false,
      "createdAt": "2025-10-20T10:00:00.000Z",
      "deletedAt": null
    },
    {
      "id": 2,
      "tenantId": 1,
      "warehouseName": "Downtown Warehouse",
      "warehouseCode": "DOWNTOWN_WAREHOUSE",
      "address": "123 Main Street, Jakarta, DKI Jakarta 12345",
      "isActive": true,
      "deleted": false,
      "createdAt": "2025-10-25T14:30:00.000Z",
      "deletedAt": null
    }
  ],
  "total": 2
}
```

**Notes:**

- Only returns non-deleted warehouses (`deleted = false`)
- Sorted by creation date (newest first)
- Returns data from **global** database

---

### 6.4 Warehouse Lifecycle & Reactivation

**Understanding Warehouse Reactivation:**

The system uses **smart reactivation** to handle warehouse deletion and recreation:

| Action                              | Behavior                           | Database State                       |
| ----------------------------------- | ---------------------------------- | ------------------------------------ |
| **Create "Downtown Storage"**       | Creates fresh warehouse            | `deleted = false`, `isActive = true` |
| **Delete "Downtown Storage"**       | Soft-deletes warehouse             | `deleted = true`, `isActive = false` |
| **Create "Downtown Storage" again** | **Reactivates** existing warehouse | `deleted = false`, `isActive = true` |

**Key Benefits:**

- ✅ No duplicate warehouse errors
- ✅ Preserves warehouse ID and historical relationships
- ✅ Updates warehouse data (address, contact info) on reactivation
- ✅ Maintains audit trail
- ✅ Supports unlimited create/delete cycles

**Example Flow:**

```bash
# Step 1: Create warehouse
POST /api/admin/tenants/1/warehouses
Body: { "warehouseName": "Airport Depot", "city": "Jakarta" }
Response: { "wasReactivated": false, "warehouse": { "id": 3 } }

# Step 2: Delete warehouse
DELETE /api/admin/tenants/1/warehouses/3
Response: { "success": true }

# Step 3: Recreate with same name (reactivation)
POST /api/admin/tenants/1/warehouses
Body: { "warehouseName": "Airport Depot", "city": "Bandung" }  # Updated city!
Response: {
  "wasReactivated": true,
  "warehouse": {
    "id": 3,  # Same ID!
    "city": "Bandung"  # Updated data!
  }
}
```

**Plan Change Behavior:**

- **Downgrade Pro → Basic:** ALL warehouses soft-deleted
- **Upgrade Basic → Pro (1st time):** Creates "Main Warehouse"
- **Upgrade Basic → Pro (after downgrade):** Reactivates "Main Warehouse"
- **Custom warehouses:** Remain soft-deleted after upgrade, must be manually recreated

---

## 7. Subscription Plan Changes

### 7.1 Change Tenant Plan (Upgrade/Downgrade)

**Endpoint:** `PUT /api/admin/tenants/:tenantId/changePlan`

**Description:** Changes tenant subscription plan. Supports both upgrades and downgrades with automatic resource management.

**Authentication:** Required (POS Owner only)

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `tenantId` | number | Tenant ID |

**Request Body:**

```json
{
  "planName": "Pro"
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `planName` | string | Yes | Target plan name (`Trial`, `Basic`, `Pro`) |

---

#### **7.1.1 Upgrade: Basic → Pro (First Time)**

**Request:**

```json
{
  "planName": "Pro"
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Successfully upgraded from 'Basic' to 'Pro'. Main warehouse has been created.",
  "tenantId": 1,
  "previousPlan": "Basic",
  "newPlan": "Pro",
  "updatedSubscriptions": 1,
  "tokensInvalidated": true,
  "cacheCleared": true,
  "downgradeDetails": null,
  "upgradeDetails": {
    "warehouseReactivated": false,
    "warehouseCreated": true,
    "warehouseId": 1,
    "warehouseName": "Main Warehouse",
    "globalWarehouseId": 1
  }
}
```

**What Happens:**

1. ✅ Creates "Main Warehouse" in both global and tenant databases
2. ✅ First warehouse is **FREE** (no add-on charge)
3. ✅ Updates subscription plan to Pro
4. ✅ Invalidates existing auth tokens
5. ✅ Clears plan cache

---

#### **7.1.2 Upgrade: Basic → Pro (After Previous Downgrade)**

**Scenario:** User previously had Pro plan, downgraded to Basic, now upgrading back to Pro.

**Request:**

```json
{
  "planName": "Pro"
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Successfully upgraded from 'Basic' to 'Pro'. Main warehouse has been reactivated.",
  "tenantId": 1,
  "previousPlan": "Basic",
  "newPlan": "Pro",
  "updatedSubscriptions": 1,
  "tokensInvalidated": true,
  "cacheCleared": true,
  "downgradeDetails": null,
  "upgradeDetails": {
    "warehouseReactivated": true,
    "warehouseCreated": false,
    "warehouseId": 1,
    "warehouseName": "Main Warehouse",
    "globalWarehouseId": 1
  }
}
```

**What Happens:**

1. ✅ **Reactivates** existing "Main Warehouse" (soft-deleted during previous downgrade)
2. ✅ Sets `deleted = false`, `isActive = true`, `deletedAt = null`
3. ✅ Preserves original warehouse ID and historical data
4. ✅ First warehouse is **FREE** (no add-on charge)
5. ✅ Updates subscription plan to Pro
6. ✅ Invalidates existing auth tokens
7. ✅ Clears plan cache

**Important Notes:**

- **No duplicate warehouse error** - System intelligently reactivates instead of creating duplicate
- **Data preserved** - Original warehouse ID and relationships maintained
- **Supports unlimited cycles** - Basic → Pro → Basic → Pro works indefinitely

---

#### **7.1.3 Downgrade: Pro → Basic**

**Request:**

```json
{
  "planName": "Basic"
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Successfully downgraded from 'Pro' to 'Basic'. All warehouses and push notification devices have been deactivated.",
  "tenantId": 1,
  "previousPlan": "Pro",
  "newPlan": "Basic",
  "updatedSubscriptions": 1,
  "tokensInvalidated": true,
  "cacheCleared": true,
  "downgradeDetails": {
    "warehousesDeactivated": 3,
    "warehouseAddOnRemoved": true,
    "deviceAddOnRemoved": true,
    "deviceAddOnCount": 5
  },
  "upgradeDetails": null
}
```

**What Happens:**

1. ❌ **Deactivates ALL warehouses** in both global and tenant databases
2. ❌ **Removes warehouse add-on** (ID 3) completely
3. ❌ **Removes ALL device add-ons** (ID 2) - Basic plan has 0 device support
4. ✅ Updates subscription plan to Basic
5. ✅ Invalidates existing auth tokens
6. ✅ Clears plan cache

**Important Notes:**

- **Warehouses:** All warehouses soft-deleted (`deleted = true`, `isActive = false`)
- **Devices:** All device add-ons removed (Basic plan = 0 devices)
- **Atomic:** Uses transactions - either all changes succeed or all rollback
- **Reversible:** Warehouse data is soft-deleted but preserved - can be reactivated by upgrading to Pro again
- **Other Warehouses:** Custom warehouses (beyond Main Warehouse) remain soft-deleted after upgrade - must be manually recreated

---

#### **7.1.4 Same Plan Error**

**Request:**

```json
{
  "planName": "Pro"
}
```

**Response (Error - 400):**

```json
{
  "error": "Tenant is already on 'Pro' plan"
}
```

---

#### **7.1.5 Invalid Plan Error**

**Request:**

```json
{
  "planName": "Enterprise"
}
```

**Response (Error - 404):**

```json
{
  "error": "Plan 'Enterprise' not found"
}
```

---

## Plan Change Summary

| Change          | Warehouse Action                | Device Action              | Cost Impact                  |
| --------------- | ------------------------------- | -------------------------- | ---------------------------- |
| **Basic → Pro** | Creates "Main Warehouse" (FREE) | No change                  | 0 IDR (first warehouse free) |
| **Pro → Basic** | Deactivates ALL warehouses      | Removes ALL device add-ons | Reduces to 0 IDR             |

---

## Error Responses

All endpoints follow standard error response format:

### Validation Error (400)

```json
{
  "error": "Invalid request. Both username and password are required."
}
```

### Not Found (404)

```json
{
  "error": "Tenant not found"
}
```

### Unauthorized (401)

```json
{
  "error": "User not authenticated"
}
```

### Internal Server Error (500)

```json
{
  "error": "An unexpected error occurred. Please try again later."
}
```

---

## Common Use Cases

### Use Case 1: New Tenant Onboarding (Pro Plan)

```bash
# Step 1: Create tenant
POST /api/admin/signup
{
  "tenant": {
    "tenantName": "My Restaurant",
    "plan": "Pro"
  }
}
# Result: Tenant created with Main Outlet and Main Warehouse (free)

# Step 2: Create additional users
POST /api/admin/createTenantUser/1
{
  "username": "cashier_01",
  "password": "SecurePass123"
}

# Step 3: Add more device quota if needed
POST /api/admin/addDeviceQuota/1
{
  "quantity": 5
}
# Cost: 50,000 IDR/month

# Step 4: Create second warehouse
POST /api/admin/tenants/1/warehouses
{
  "warehouseName": "Secondary Storage"
}
# Cost: 149,000 IDR/month

# Total Monthly Cost: 150,000 IDR
```

---

### Use Case 2: Downgrade Pro → Basic

```bash
# Before downgrade: Check current cost
GET /api/admin/tenantDetails/1
# Response shows: 250,000 IDR/month (2 extra warehouses + 5 extra devices)

# Downgrade to Basic
PUT /api/admin/tenants/1/changePlan
{
  "planName": "Basic"
}
# Result:
# - All 3 warehouses deactivated
# - All 5 device add-ons removed
# - Monthly cost: 0 IDR
```

---

### Use Case 3: Upgrade Basic → Pro

```bash
# Upgrade from Basic to Pro
PUT /api/admin/tenants/1/changePlan
{
  "planName": "Pro"
}
# Result:
# - Main Warehouse created automatically (FREE)
# - Push notification support enabled (3 free devices)
# - Monthly cost: 0 IDR (if no additional warehouses/devices)
```

---

### Use Case 4: Warehouse Deletion & Recreation

```bash
# Step 1: Create custom warehouse
POST /api/admin/tenants/1/warehouses
{
  "warehouseName": "Airport Depot",
  "street": "Terminal 3 Area",
  "city": "Jakarta",
  "contactPhone": "+62-21-5551234"
}
# Response: { "wasReactivated": false, "warehouse": { "id": 4 } }
# Cost: 149,000 IDR/month (2nd warehouse)

# Step 2: User realizes they don't need it - delete
DELETE /api/admin/tenants/1/warehouses/4
# Response: { "success": true, "monthlyCost": 0 }
# Cost reduced to 0 IDR

# Step 3: Two months later, user needs it again
POST /api/admin/tenants/1/warehouses
{
  "warehouseName": "Airport Depot",
  "street": "Terminal 2 Area",  # Updated location!
  "city": "Jakarta",
  "contactPhone": "+62-21-5559999"  # Updated phone!
}
# Response: {
#   "wasReactivated": true,  # ✅ Reactivated, not duplicated
#   "warehouse": {
#     "id": 4,  # ✅ Same ID!
#     "street": "Terminal 2 Area",  # ✅ Data updated
#     "contactPhone": "+62-21-5559999"
#   }
# }
# Cost: 149,000 IDR/month
```

---

### Use Case 5: Plan Change Cycle (Pro → Basic → Pro)

```bash
# Initial state: Pro plan with 3 warehouses
GET /api/admin/tenants/1/warehouses
# Response: ["Main Warehouse", "Downtown Storage", "Airport Depot"]
# Cost: 200,000 IDR/month (2 extra warehouses)

# Step 1: Downgrade to Basic
PUT /api/admin/tenants/1/changePlan
{ "planName": "Basic" }
# Result:
# - All 3 warehouses soft-deleted
# - All device add-ons removed
# - Cost: 0 IDR/month

# Step 2: Six months later, upgrade back to Pro
PUT /api/admin/tenants/1/changePlan
{ "planName": "Pro" }
# Response: {
#   "message": "...Main warehouse has been reactivated.",
#   "upgradeDetails": {
#     "warehouseReactivated": true,  # ✅ Main warehouse restored!
#     "warehouseId": 1
#   }
# }
# Result:
# - Main Warehouse reactivated (FREE)
# - Downtown Storage still soft-deleted (not restored)
# - Airport Depot still soft-deleted (not restored)
# - Cost: 0 IDR/month

# Step 3: Manually recreate custom warehouses if needed
POST /api/admin/tenants/1/warehouses
{ "warehouseName": "Downtown Storage" }
# Response: { "wasReactivated": true }  # ✅ Reactivated!
# Cost: 149,000 IDR/month
```

---

## 8. Payment Management

This section covers manual payment recording, payment history, billing summaries, and upcoming payment reminders.

### 8.1 Key Concepts

#### Grace Period

All subscriptions have a **7-day grace period** after expiration:

- **Active:** Subscription is valid (`now <= subscriptionValidUntil`)
- **Grace:** Subscription expired but within 7-day grace period (`validUntil < now <= validUntil + 7 days`)
- **Expired:** Subscription fully expired, beyond grace period (`now > validUntil + 7 days`)

#### Invoice Number Format

Auto-generated format: `INV-YYYYMM-XXXX`

- `YYYY` = Year
- `MM` = Month
- `XXXX` = Sequential number within that month (padded to 4 digits)
- Example: `INV-202501-0001`, `INV-202501-0002`, etc.

#### Cost Snapshot

Each payment stores an immutable JSON snapshot of the subscription cost at payment time:

```json
{
  "planName": "Pro",
  "planId": 2,
  "basePlanCost": 450000,
  "isCustomPrice": false,
  "standardPlanPrice": 450000,
  "customPriceNote": "",
  "addOns": [
    {
      "addOnId": 2,
      "name": "Extra Device",
      "quantity": 2,
      "pricePerUnit": 20000,
      "totalCost": 40000
    },
    {
      "addOnId": 4,
      "name": "Advanced Loyalty",
      "quantity": 1,
      "pricePerUnit": 150000,
      "totalCost": 150000
    }
  ],
  "discounts": [
    {
      "discountId": 1,
      "name": "Early Bird",
      "type": "percentage",
      "value": 10,
      "amountOff": 45000
    }
  ],
  "totalBeforeDiscount": 640000,
  "totalDiscount": 45000,
  "totalAfterDiscount": 595000
}
```

**Note:** Add-ons in the cost snapshot are sourced from the tenant-level `TenantAddOn` table, not per-outlet. Custom pricing fields (`isCustomPrice`, `standardPlanPrice`, `customPriceNote`) are included for historical audit.

---

### 8.2 Record Payment

**Endpoint:** `POST /api/admin/tenants/:tenantId/outlets/:outletId/payments`

**Description:** Records a payment for an outlet's subscription and extends the subscription validity.

**Authentication:** Required

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `tenantId` | number | Tenant ID |
| `outletId` | number | Outlet ID |

**Request Body:**

```json
{
  "amount": 298000,
  "paymentMethod": "bank_transfer",
  "referenceNumber": "TRF-123456789",
  "paymentDate": "2025-01-27T10:00:00Z",
  "extensionMonths": 1,
  "notes": "January 2025 subscription"
}
```

**Request Fields:**
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `amount` | number | Yes | - | Payment amount (must be positive) |
| `paymentMethod` | string | Yes | - | Free-form: `bank_transfer`, `cash`, `e_wallet`, etc. |
| `paymentDate` | datetime | Yes | - | When payment was made (ISO 8601) |
| `referenceNumber` | string | No | null | Bank transfer reference or transaction ID |
| `extensionMonths` | number | No | 1 | Months to extend (1=monthly, 12=annual) |
| `notes` | string | No | null | Optional remarks |

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Payment recorded. Subscription extended to 2025-02-27",
  "payment": {
    "id": 1,
    "invoiceNumber": "INV-202501-0001",
    "tenantId": 1,
    "outletId": 1,
    "outletName": "Main Outlet",
    "amount": 298000,
    "currency": "IDR",
    "paymentMethod": "bank_transfer",
    "referenceNumber": "TRF-123456789",
    "paymentDate": "2025-01-27T10:00:00.000Z",
    "periodFrom": "2025-01-27T00:00:00.000Z",
    "periodTo": "2025-02-27T00:00:00.000Z",
    "extensionMonths": 1,
    "costSnapshot": {
      "planName": "Pro",
      "planId": 2,
      "basePlanCost": 0,
      "addOns": [
        {
          "addOnId": 1,
          "name": "Additional User",
          "quantity": 2,
          "pricePerUnit": 49000,
          "totalCost": 98000
        },
        {
          "addOnId": 3,
          "name": "Extra Warehouse",
          "quantity": 1,
          "pricePerUnit": 149000,
          "totalCost": 149000
        }
      ],
      "discounts": [],
      "totalBeforeDiscount": 247000,
      "totalDiscount": 0,
      "totalAfterDiscount": 247000
    },
    "recordedAt": "2025-01-27T10:30:00.000Z"
  },
  "subscription": {
    "previousValidUntil": "2025-01-27T00:00:00.000Z",
    "newValidUntil": "2025-02-27T00:00:00.000Z",
    "status": "Active"
  }
}
```

**Period Calculation Logic:**
| Subscription State | `periodFrom` | `periodTo` |
|--------------------|--------------|------------|
| Active | Current `subscriptionValidUntil` | `periodFrom` + `extensionMonths` |
| Grace | Current `subscriptionValidUntil` | `periodFrom` + `extensionMonths` |
| Expired (past grace) | **Today** (no free months) | `periodFrom` + `extensionMonths` |

**Notes:**

- Amount is recorded as provided (allows manual overrides for negotiations)
- Warning logged if amount doesn't match calculated cost
- Subscription status automatically set to `Active` after payment
- Cost snapshot captures current subscription state for historical audit

---

### 8.3 Get Tenant Payment History

**Endpoint:** `GET /api/admin/tenants/:tenantId/payments`

**Description:** Retrieves payment history for a tenant (all outlets or filtered by outlet).

**Authentication:** Required

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `tenantId` | number | Tenant ID |

**Query Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `outletId` | number | No | - | Filter by specific outlet |
| `from` | date | No | - | Start date filter (ISO 8601) |
| `to` | date | No | - | End date filter (ISO 8601) |
| `limit` | number | No | 50 | Max 100 |
| `offset` | number | No | 0 | Pagination offset |

**Example Requests:**

```
GET /api/admin/tenants/1/payments
GET /api/admin/tenants/1/payments?outletId=1
GET /api/admin/tenants/1/payments?from=2025-01-01&to=2025-12-31&limit=50&offset=0
```

**Response (Success - 200):**

```json
{
  "payments": [
    {
      "id": 1,
      "invoiceNumber": "INV-202501-0001",
      "tenantId": 1,
      "outletId": 1,
      "outletName": "Main Outlet",
      "amount": 298000,
      "currency": "IDR",
      "paymentMethod": "bank_transfer",
      "referenceNumber": "TRF-123456789",
      "paymentDate": "2025-01-27T10:00:00.000Z",
      "periodFrom": "2025-01-27T00:00:00.000Z",
      "periodTo": "2025-02-27T00:00:00.000Z",
      "extensionMonths": 1,
      "costSnapshot": { ... },
      "recordedAt": "2025-01-27T10:30:00.000Z"
    }
  ],
  "total": 12,
  "limit": 50,
  "offset": 0
}
```

---

### 8.4 Get All Payments (Admin Dashboard)

**Endpoint:** `GET /api/admin/payments`

**Description:** Retrieves all payments across tenants. **Requires date range** to prevent full table scans.

**Authentication:** Required

**Query Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `from` | date | **Yes** | - | Start date (required for performance) |
| `to` | date | **Yes** | - | End date (required for performance) |
| `tenantId` | number | No | - | Filter by tenant |
| `limit` | number | No | 50 | Max 100 |
| `offset` | number | No | 0 | Pagination offset |

**Example Requests:**

```
GET /api/admin/payments?from=2025-01-01&to=2025-01-31
GET /api/admin/payments?from=2025-01-01&to=2025-12-31&tenantId=1&limit=50
```

**Response (Success - 200):**

```json
{
  "payments": [
    {
      "id": 1,
      "invoiceNumber": "INV-202501-0001",
      "tenantId": 1,
      "tenantName": "Coffee Shop",
      "outletId": 1,
      "outletName": "Main Outlet",
      "amount": 298000,
      "currency": "IDR",
      "paymentMethod": "bank_transfer",
      "referenceNumber": "TRF-123456789",
      "paymentDate": "2025-01-27T10:00:00.000Z",
      "periodFrom": "2025-01-27T00:00:00.000Z",
      "periodTo": "2025-02-27T00:00:00.000Z",
      "extensionMonths": 1,
      "costSnapshot": { ... },
      "recordedAt": "2025-01-27T10:30:00.000Z"
    },
    {
      "id": 2,
      "invoiceNumber": "INV-202501-0002",
      "tenantId": 2,
      "tenantName": "Bakery House",
      "outletId": 3,
      "outletName": "Downtown Branch",
      "amount": 149000,
      "currency": "IDR",
      "paymentMethod": "cash",
      "referenceNumber": null,
      "paymentDate": "2025-01-27T14:00:00.000Z",
      "periodFrom": "2025-01-27T00:00:00.000Z",
      "periodTo": "2025-02-27T00:00:00.000Z",
      "extensionMonths": 1,
      "costSnapshot": { ... },
      "recordedAt": "2025-01-27T14:15:00.000Z"
    }
  ],
  "total": 156,
  "limit": 50,
  "offset": 0
}
```

**Error Response (Missing date range):**

```json
{
  "error": "Invalid request. from and to date range are required."
}
```

---

### 8.5 Get Tenant Billing Summary

**Endpoint:** `GET /api/admin/tenants/:tenantId/billing-summary`

**Description:** Retrieves consolidated billing view for a tenant across all outlets, including subscription status and expiry information.

**Authentication:** Required

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `tenantId` | number | Tenant ID |

**Response (Success - 200):**

```json
{
  "tenantId": 1,
  "tenantName": "Coffee Shop",
  "totalMonthlyCost": 745000,
  "tenantAddOns": [
    { "name": "Extra Device", "quantity": 2, "pricePerUnit": 20000, "totalCost": 40000 },
    { "name": "Advanced Loyalty", "quantity": 1, "pricePerUnit": 150000, "totalCost": 150000 }
  ],
  "totalAddOnCost": 190000,
  "outlets": [
    {
      "outletId": 1,
      "outletName": "Main Outlet",
      "planName": "Pro",
      "basePlanCost": 450000,
      "isCustomPrice": false,
      "standardPlanPrice": 450000,
      "customPriceNote": "",
      "discounts": [{ "name": "Early Bird", "amount": 45000 }],
      "outletTotalCost": 405000,
      "subscriptionStatus": "Active",
      "subscriptionValidUntil": "2026-04-01T00:00:00.000Z",
      "graceEndDate": "2026-04-08T00:00:00.000Z",
      "daysUntilExpiry": 30
    },
    {
      "outletId": 2,
      "outletName": "Mall Branch",
      "planName": "Pro",
      "basePlanCost": 450000,
      "isCustomPrice": false,
      "standardPlanPrice": 450000,
      "customPriceNote": "",
      "discounts": [],
      "outletTotalCost": 450000,
      "subscriptionStatus": "Grace",
      "subscriptionValidUntil": "2026-03-01T00:00:00.000Z",
      "graceEndDate": "2026-03-08T00:00:00.000Z",
      "daysUntilExpiry": -2
    }
  ]
}
```

**Notes:**

- `tenantAddOns` is now at the top level (no longer inside per-outlet)
- `isCustomPrice`, `standardPlanPrice`, `customPriceNote` added to each outlet
- `subscriptionStatus`: `Active`, `Grace`, or `Expired`
- `daysUntilExpiry`: Positive = days until expiry, Negative = days past expiry
- `graceEndDate`: 7 days after `subscriptionValidUntil`
- Use this endpoint for drill-down after getting upcoming payments summary
- **Returns ALL outlets** regardless of payment status - filter client-side if needed

**Comparison: `tenantDetails` vs `billing-summary`**

| Aspect                    | `/tenantDetails/:id`       | `/billing-summary`           |
| ------------------------- | -------------------------- | ---------------------------- |
| **Purpose**               | Cost breakdown for pricing | Payment status tracking      |
| **Focus**                 | What tenant **owes**       | When tenant **needs to pay** |
| `subscriptionStatus`      | ❌                         | ✅ (Active/Grace/Expired)    |
| `daysUntilExpiry`         | ❌                         | ✅                           |
| `graceEndDate`            | ❌                         | ✅                           |
| `totalCostBeforeDiscount` | ✅                         | ❌                           |
| `totalDiscount`           | ✅                         | ❌                           |
| Custom pricing fields     | ✅                         | ✅                           |
| Add-on details            | ✅ Tenant-level            | ✅ Tenant-level              |

**When to use:**

- **`tenantDetails`** → Pricing page, invoice breakdown, showing what they're paying for
- **`billing-summary`** → Payment reminders, collection dashboard, checking who needs to pay

---

### 8.6 Get Upcoming Payments Summary

**Endpoint:** `GET /api/admin/payments/upcoming/summary`

**Description:** Quick overview of upcoming payments grouped by status. Use this for dashboard widgets.

**Authentication:** Required

**Query Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `days` | number | No | 30 | Days ahead to look |

**Example Request:**

```
GET /api/admin/payments/upcoming/summary
GET /api/admin/payments/upcoming/summary?days=14
```

**Response (Success - 200):**

```json
{
  "days": 30,
  "summary": {
    "activeExpiring": 450,
    "graceExpiring": 200,
    "expiredCount": 350,
    "totalTenants": 120,
    "totalOutlets": 1000
  }
}
```

**Summary Fields:**
| Field | Description |
|-------|-------------|
| `activeExpiring` | Active subscriptions expiring within `days` |
| `graceExpiring` | Subscriptions in grace period (already expired, within 7 days) |
| `expiredCount` | Fully expired subscriptions (past grace period) |
| `totalTenants` | Unique tenants with expiring/expired subscriptions |
| `totalOutlets` | Total outlet count across all statuses |

---

### 8.7 Get Upcoming Payments (Paginated List)

**Endpoint:** `GET /api/admin/payments/upcoming`

**Description:** Paginated list of tenants with expiring subscriptions, sorted by most urgent first.

**Authentication:** Required

**Query Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `days` | number | No | 30 | Days ahead to look |
| `status` | string | No | all | Filter: `active`, `grace`, `expired`, `all` |
| `limit` | number | No | 50 | Max 100 |
| `offset` | number | No | 0 | Pagination offset |

**Example Requests:**

```
GET /api/admin/payments/upcoming
GET /api/admin/payments/upcoming?days=14&status=grace&limit=50&offset=0
GET /api/admin/payments/upcoming?status=expired
```

**Response (Success - 200):**

```json
{
  "upcomingPayments": [
    {
      "tenantId": 1,
      "tenantName": "Coffee Shop",
      "outletCount": 3,
      "totalMonthlyCost": 447000,
      "mostUrgentExpiry": "2025-02-01T00:00:00.000Z",
      "mostUrgentStatus": "Grace"
    },
    {
      "tenantId": 2,
      "tenantName": "Bakery House",
      "outletCount": 1,
      "totalMonthlyCost": 149000,
      "mostUrgentExpiry": "2025-02-05T00:00:00.000Z",
      "mostUrgentStatus": "Active"
    }
  ],
  "totalCount": 120,
  "limit": 50,
  "offset": 0
}
```

**Error Response (Invalid status):**

```json
{
  "error": "Invalid status. Must be one of: active, grace, expired, all"
}
```

**Drill-down Pattern:**

1. Get summary counts: `GET /payments/upcoming/summary`
2. Get paginated list: `GET /payments/upcoming?status=grace`
3. Get tenant details: `GET /tenants/:tenantId/billing-summary`

---

### 8.8 Payment Use Cases

#### Use Case 1: Record Monthly Payment

```bash
# Step 1: Check billing summary
GET /api/admin/tenants/1/billing-summary
# Response shows: outletTotalCost = 247000 IDR

# Step 2: Record payment
POST /api/admin/tenants/1/outlets/1/payments
{
  "amount": 247000,
  "paymentMethod": "bank_transfer",
  "referenceNumber": "TRF-202501-001",
  "paymentDate": "2025-01-27T10:00:00Z",
  "extensionMonths": 1
}
# Result:
# - Invoice generated: INV-202501-0001
# - Subscription extended by 1 month
# - Status: Active
```

#### Use Case 2: Record Annual Payment (12 months)

```bash
POST /api/admin/tenants/1/outlets/1/payments
{
  "amount": 2964000,
  "paymentMethod": "bank_transfer",
  "referenceNumber": "TRF-ANNUAL-001",
  "paymentDate": "2025-01-27T10:00:00Z",
  "extensionMonths": 12,
  "notes": "Annual subscription 2025"
}
# Result:
# - Subscription extended by 12 months
# - periodTo = periodFrom + 12 months
```

#### Use Case 3: Payment for Expired Subscription (Past Grace)

```bash
# Subscription expired on 2025-01-01, grace ended 2025-01-08
# Current date: 2025-01-27 (19 days past expiry)

POST /api/admin/tenants/1/outlets/1/payments
{
  "amount": 247000,
  "paymentMethod": "cash",
  "paymentDate": "2025-01-27T10:00:00Z"
}
# Result:
# - periodFrom = 2025-01-27 (today, NOT the old expired date)
# - periodTo = 2025-02-27
# - No free months given for lapsed period
# - Status restored to Active
```

#### Use Case 4: Dashboard - Check Upcoming Payments

```bash
# Step 1: Get summary for dashboard widget
GET /api/admin/payments/upcoming/summary?days=30
# Response: { summary: { activeExpiring: 45, graceExpiring: 12, expiredCount: 8 } }

# Step 2: View grace period tenants (most urgent)
GET /api/admin/payments/upcoming?status=grace&limit=10
# Response: [{ tenantId: 1, tenantName: "Coffee Shop", mostUrgentStatus: "Grace" }]

# Step 3: Drill down to specific tenant
GET /api/admin/tenants/1/billing-summary
# Response: Full outlet breakdown with expiry dates
```

#### Use Case 5: Generate Monthly Revenue Report

```bash
# Get all payments for January 2025
GET /api/admin/payments?from=2025-01-01&to=2025-01-31

# Response includes:
# - All payments with tenant names
# - Cost snapshots for historical accuracy
# - Total count for pagination
```

---

## Notes

- All monetary values are in **Indonesian Rupiah (IDR)**
- All timestamps are in **ISO 8601 format** (UTC)
- **Soft deletes** preserve data with `deleted = true` and `deletedAt` timestamp
- **Smart reactivation:** Deleted warehouses can be reactivated by creating with the same name
- Transactions ensure atomicity across global and tenant databases
- Authentication tokens are invalidated on plan changes
- First warehouse and plan base limits are always **FREE**
- Warehouse reactivation updates data (address, contact info) with new values
- Plan change cycles (Pro → Basic → Pro) work indefinitely without errors
