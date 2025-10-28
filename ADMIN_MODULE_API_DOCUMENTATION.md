# Admin Module API Documentation

This document provides comprehensive documentation for all Admin Module endpoints, including tenant management, subscription plans, device quotas, and warehouse operations.

---

## Table of Contents

1. [Tenant Management](#1-tenant-management)
2. [Subscription & Billing](#2-subscription--billing)
3. [User Management](#3-user-management)
4. [Device Quota Management](#4-device-quota-management)
5. [Warehouse Management](#5-warehouse-management)
6. [Subscription Plan Changes](#6-subscription-plan-changes)

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
    "plan": "Pro"
  }
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tenant.tenantName` | string | Yes | Name of the tenant organization |
| `tenant.plan` | string | Yes | Subscription plan name (`Basic`, `Pro`) |

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
  "outlets": [
    {
      "outletId": 1,
      "outletName": "Main Outlet",
      "subscription": {
        "planName": "Pro",
        "basePlanCost": 0,
        "addOns": [
          {
            "name": "Extra Warehouse",
            "quantity": 2,
            "pricePerUnit": 100000,
            "totalCost": 200000
          },
          {
            "name": "Additional Push Notification Device",
            "quantity": 5,
            "pricePerUnit": 10000,
            "totalCost": 50000
          }
        ],
        "discounts": [],
        "totalCost": 250000,
        "totalCostBeforeDiscount": 250000,
        "totalDiscount": 0,
        "status": "Active",
        "subscriptionValidUntil": "2025-11-27T10:00:00.000Z"
      }
    }
  ],
  "totalMonthlyCost": 250000,
  "totalCostBeforeDiscount": 250000,
  "totalDiscount": 0
}
```

**Pricing Summary:**
- **Pro Plan Base:** 0 IDR/month
- **Extra Warehouse:** 100,000 IDR/month per warehouse (first warehouse free)
- **Extra Device:** 10,000 IDR/month per device (beyond plan limit)

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

## 2. Subscription & Billing

### 2.1 Subscription Plans

Current available plans:

| Plan | Base Price | Max Users | Max Devices | Warehouses | Features |
|------|------------|-----------|-------------|------------|----------|
| **Basic** | 0 IDR | 2 free | 0 | Not supported | Basic POS |
| **Pro** | 0 IDR | 3 free | 3 | 1 free, then 100k/month | Advanced POS + Warehouses + Push Notifications |

### 2.2 Add-on Pricing

| Add-on ID | Name | Type | Price | Scope | Description |
|-----------|------|------|-------|-------|-------------|
| 1 | Extra User | user | Varies | outlet | Additional user slot |
| 2 | Additional Push Notification Device | device | 10,000 IDR | tenant | Extra device beyond plan limit |
| 3 | Extra Warehouse | warehouse | 100,000 IDR | tenant | Additional warehouse beyond first free |

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

### 3.2 Delete Tenant User

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

| Plan | Free Users | Total Active Users | Add-on Quantity | Action |
|------|------------|-------------------|-----------------|---------|
| Basic | 2 | 2 | 0 | No add-on needed |
| Basic | 2 | 3 | 1 | Create/update add-on |
| Basic | 2 | 1 (after delete) | 0 | Remove add-on |
| Pro | 3 | 3 | 0 | No add-on needed |
| Pro | 3 | 5 | 2 | Create/update add-on |
| Pro | 3 | 4 (after delete) | 1 | Reduce add-on quantity |
| Pro | 3 | 3 (after delete) | 0 | Remove add-on |

---

## 4. Device Quota Management

### 4.1 Get Tenant Devices

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

### 4.2 Add Device Quota

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
  "monthlyCost": 80000,
  "subscriptionId": 1
}
```

**Notes:**
- Price: 10,000 IDR/month per device
- Updates existing add-on or creates new one
- Immediate effect - devices can be activated right away

---

### 4.3 Reduce Device Quota

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

## 5. Warehouse Management

### 5.1 Create Warehouse

**Endpoint:** `POST /api/admin/tenants/:tenantId/warehouses`

**Description:** Creates a new warehouse for the tenant. First warehouse is FREE, additional warehouses cost 100k IDR/month each. If a warehouse with the same name was previously deleted, it will be **reactivated** instead of creating a duplicate.

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
  "message": "Warehouse created. Additional charge: 100000 IDR/month",
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
    "monthlyCost": 100000,
    "isFreeWarehouse": false
  }
}
```

**Response (Success - 200 - Reactivation):**
```json
{
  "success": true,
  "message": "Warehouse reactivated. Additional charge: 100000 IDR/month",
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
    "monthlyCost": 100000,
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
- Additional warehouses: 100,000 IDR/month each
- Automatically creates/updates warehouse add-on (ID 3)
- `wasReactivated` flag indicates whether warehouse was created fresh or reactivated

---

### 5.2 Delete Warehouse

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

### 5.3 Get All Warehouses

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

### 5.4 Warehouse Lifecycle & Reactivation

**Understanding Warehouse Reactivation:**

The system uses **smart reactivation** to handle warehouse deletion and recreation:

| Action | Behavior | Database State |
|--------|----------|----------------|
| **Create "Downtown Storage"** | Creates fresh warehouse | `deleted = false`, `isActive = true` |
| **Delete "Downtown Storage"** | Soft-deletes warehouse | `deleted = true`, `isActive = false` |
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

## 6. Subscription Plan Changes

### 6.1 Change Tenant Plan (Upgrade/Downgrade)

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
| `planName` | string | Yes | Target plan name (`Basic`, `Pro`) |

---

#### **6.1.1 Upgrade: Basic → Pro (First Time)**

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

#### **6.1.2 Upgrade: Basic → Pro (After Previous Downgrade)**

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

#### **6.1.3 Downgrade: Pro → Basic**

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

#### **6.1.4 Same Plan Error**

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

#### **6.1.5 Invalid Plan Error**

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

| Change | Warehouse Action | Device Action | Cost Impact |
|--------|------------------|---------------|-------------|
| **Basic → Pro** | Creates "Main Warehouse" (FREE) | No change | 0 IDR (first warehouse free) |
| **Pro → Basic** | Deactivates ALL warehouses | Removes ALL device add-ons | Reduces to 0 IDR |

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
# Cost: 100,000 IDR/month

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
# Cost: 100,000 IDR/month (2nd warehouse)

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
# Cost: 100,000 IDR/month
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
# Cost: 100,000 IDR/month
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
