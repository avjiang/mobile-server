# Pushy Push Notification Implementation

## Overview

Push notification system using Pushy SDK for multi-tenant Flutter POS application with device limits and subscription-based access.

## Key Requirements

- **Push notifications are only available for tenants on the Pro plan**
- Frontend decides whether to register devices based on plan
- **Backend uses database + 1-hour cache for plan checking** (95% query reduction)
- **Hybrid Model**: Device limits calculated per outlet, but devices are tenant-wide pool
- Each outlet subscription includes 3 devices (3 outlets = 9 total devices)
- Additional devices: IDR 10,000/month per device (added to specific outlet subscription)
- Clean approach: When plan changes, all refresh tokens are invalidated forcing re-login
- **Cost Optimization**:
  - Check device eligibility BEFORE calling `pushy.register()` to avoid unnecessary billing
  - 1-hour plan cache reduces DB queries by 95%
  - Plan check centralized in PushyService (no duplicate checks)
  - Notifications only sent to Pro plan tenants

## Cost-Saving Strategy

### Why Check Eligibility First?

Pushy starts billing a device as soon as `Pushy.register()` is called on the client side. To avoid unnecessary costs:

1. **Before**: Client calls `pushy.register()` → Device gets billed → Backend rejects due to limit
2. **After**: Client checks eligibility → Backend validates → Only then call `pushy.register()`

### Benefits

- **Reduced Costs**: No billing for devices that exceed limits
- **Better UX**: Show limit warning before device registration attempt
- **Clear Messaging**: Users know upfront if they need to purchase additional slots
- **Prevent Waste**: Avoid registering devices that will be immediately rejected

### Implementation Flow

```
┌─────────────┐
│ User Logs In│
└──────┬──────┘
       │
       ▼
┌──────────────────────────────┐
│ Check Pro Plan & Permissions │
└──────┬───────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ GET /devices/checkQuota     │ ◄── No Pushy billing here
└──────┬──────────────────────┘
       │
       ├─── canRegister: false ───► Show error/upgrade dialog
       │
       └─── canRegister: true
              │
              ▼
       ┌──────────────────┐
       │ Pushy.register() │ ◄── Pushy billing starts here
       └────────┬─────────┘
                │
                ▼
       ┌─────────────────────┐
       │ POST /devices/register│
       └─────────────────────┘
```

## Architecture

### Core Principles

1. **Permission-based notifications**: Notifications tied to permissions, not roles
2. **Topic-based delivery**: Using Pushy topics for efficient multi-tenant broadcasting
3. **Tenant isolation**: Topics include tenant ID to prevent cross-tenant notifications
4. **Singleton pattern**: All services use singleton to prevent memory leaks
5. **JWT-based plan checking**: Plan name embedded in JWT for efficient checking
6. **Hybrid device model**: Limits calculated per outlet, devices pooled at tenant level
7. **Cost optimization**: Check eligibility before Pushy SDK registration

### Topic Structure

- **Tenant-wide**: `tenant_{tenantId}` (for system-level notifications)
- **Tenant-level permission-based**: `tenant_{tenantId}_{permission}` (for financial, system alerts)
- **Outlet-specific permission-based**: `tenant_{tenantId}_outlet_{outletId}_{permission}` (for sales, inventory, orders)
- **User-specific**: `tenant_{tenantId}_user_{userId}` (for direct messages)

**Note**: The client app dynamically subscribes to outlet-specific topics based on the current outlet context.

## Hybrid Model (Users & Devices)

### How It Works

The hybrid model applies to both **users** and **devices**:

1. **Limits Calculation**: Sum of all outlet subscriptions

   - **Users**: 3 outlets × 10 users = 30 total users for tenant
   - **Devices**: 3 outlets × 3 devices = 9 total devices for tenant
   - Each outlet subscription contributes to the total pool

2. **Tenant-Wide Pool**: Resources shared across all outlets

   - **Users**: Can access any outlet without re-creation
   - **Devices**: Can be used at any outlet without re-registration
   - Single pool managed at tenant level

3. **Outlet Context**:
   - **For Users**: Access controlled by role permissions
   - **For Devices**: Notification routing handled by frontend outlet switching
   - Backend sends notifications to outlet-specific topics

### Benefits

- **Consistency**: Users and devices work the same way
- **Flexibility**: Staff can work at any outlet seamlessly
- **Scalability**: Limits grow with business (more outlets = more resources)
- **Fair Pricing**: Pay per outlet, get resources per outlet
- **Simplicity**: One user list, one device list to manage

## Database Schema

### Global Database (prisma/global-client/schema.prisma)

```prisma
model PushyDevice {
  id               Int       @id @default(autoincrement()) @map("ID")
  tenantUserId     Int       @map("TENANT_USER_ID")
  deviceToken      String    @unique @map("DEVICE_TOKEN")
  platform         String    @map("PLATFORM") // "android", "ios", "web"
  deviceName       String?   @map("DEVICE_NAME")
  appVersion       String?   @map("APP_VERSION")
  isActive         Boolean   @default(true) @map("IS_ACTIVE")
  lastActiveAt     DateTime? @map("LAST_ACTIVE_AT")
  createdAt        DateTime  @default(now()) @map("CREATED_AT")
  updatedAt        DateTime  @updatedAt @map("UPDATED_AT")
  tenantUser       TenantUser @relation(fields: [tenantUserId], references: [id])
  subscriptions    PushySubscription[]
  allocation       PushyDeviceAllocation?

  @@index([tenantUserId])
  @@index([deviceToken])
  @@map("pushy_device")
}

model PushySubscription {
  id           Int       @id @default(autoincrement()) @map("ID")
  deviceId     Int       @map("DEVICE_ID")
  topic        String    @map("TOPIC")
  subscribedAt DateTime  @default(now()) @map("SUBSCRIBED_AT")
  device       PushyDevice @relation(fields: [deviceId], references: [id], onDelete: Cascade)

  @@unique([deviceId, topic])
  @@index([topic])
  @@map("pushy_subscription")
}

model PushyDeviceAllocation {
  id               Int       @id @default(autoincrement()) @map("ID")
  deviceId         Int       @unique @map("DEVICE_ID")
  tenantId         Int       @map("TENANT_ID")
  subscriptionId   Int?      @map("SUBSCRIPTION_ID")
  allocationType   String    @default("included") @map("ALLOCATION_TYPE") // "included" or "addon"
  activatedAt      DateTime  @default(now()) @map("ACTIVATED_AT")
  createdAt        DateTime  @default(now()) @map("CREATED_AT")

  device           PushyDevice @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  tenant           Tenant @relation(fields: [tenantId], references: [id])
  subscription     TenantSubscription? @relation(fields: [subscriptionId], references: [id])

  @@index([tenantId])
  @@index([allocationType])
  @@map("pushy_device_allocation")
}
```

### Required Permissions (Global Database)

```sql
INSERT INTO permission (NAME, CATEGORY, DESCRIPTION) VALUES
('Receive Notification', 'Notifications', 'Master permission to enable push notifications'),
('Receive Sales Notification', 'Notifications', 'Receive sales notifications'),
('Receive Inventory Notification', 'Notifications', 'Receive inventory alerts'),
('Receive Order Notification', 'Notifications', 'Receive order updates'),
('Receive Financial Notification', 'Notifications', 'Receive financial alerts'),
('Receive Staff Notification', 'Notifications', 'Receive staff notifications'),
('Receive System Notification', 'Notifications', 'Receive system alerts');
```

### Permission Logic

- **`Receive Notification`**: Master permission that enables push notification functionality
  - If this permission is disabled, client won't register with Pushy at all
  - Acts as an on/off switch for the entire notification system
- **Specific notification permissions**: Control which types of notifications the user receives
  - Only checked if `Receive Notification` is enabled
  - Used to generate notification topics for subscription

### Subscription Add-on

**Important**: The system uses **add-on ID (2)** to identify device add-ons, not the name. This ensures reliability even if the name changes.

```sql
-- Add-on ID: 2
INSERT INTO subscription_add_on (ID, NAME, ADD_ON_TYPE, PRICE_PER_UNIT, MAX_QUANTITY, SCOPE, DESCRIPTION) VALUES
(2, 'Additional Push Notification Device', 'device', 10000.00, null, 'tenant', 'Additional push notification device slot (IDR 10,000/month per device)');
```

## API Endpoints

### Device Management

#### Check Device Registration Eligibility

**IMPORTANT**: Call this endpoint BEFORE calling `pushy.register()` on the frontend to avoid unnecessary billing from Pushy.

```
GET /pushy/devices/check-eligibility
Headers: Authorization: Bearer <jwt_token>

Success Response (Can Register):
{
    "success": true,
    "canRegister": true,
    "reason": "Device registration allowed",
    "deviceUsage": {
        "current": 3,
        "maximum": 5
    },
    "requiresPayment": false,
    "additionalCost": 0
}

Success Response (Limit Reached):
{
    "success": true,
    "canRegister": false,
    "reason": "Device limit reached. Purchase additional device slot for IDR 10.000/month",
    "deviceUsage": {
        "current": 5,
        "maximum": 5
    },
    "requiresPayment": true,
    "additionalCost": 10000
}

Success Response (Not Pro Plan):
{
    "success": true,
    "canRegister": false,
    "reason": "Push notifications are only available for Pro plan",
    "currentPlan": "Basic",
    "deviceUsage": {
        "current": 0,
        "maximum": 0
    }
}
```

#### Provider/Owner: Add Device Quota for Tenant

**IMPORTANT**: This endpoint is for the **POS app provider/owner** to manually add device quota when a tenant requests additional device slots.

**User Journey:**

1. Tenant user hits device limit (3/3 devices)
2. Tenant contacts you (provider) to request 2 more device slots
3. You call this endpoint to add 2 device quota
4. Tenant can immediately register new devices (now 3/5 available)

```
POST /admin/addDeviceQuota/:tenantId
Headers: Authorization: Bearer <provider_admin_token>

Request:
{
    "quantity": 2
}

Success Response:
{
    "success": true,
    "message": "Added 2 device quota. Total add-on devices: 2",
    "tenantId": 1,
    "addOnQuantity": 2,
    "monthlyCost": 20000,
    "subscriptionId": 123
}

Notes:
- This endpoint adds device quota to the tenant's FIRST active subscription
- If tenant already has device add-ons, quantity will be ADDED to existing
- Each device add-on costs IDR 10,000/month
- The quota is immediately available for device registration
- Maximum device limit = (3 devices per outlet × number of outlets) + add-on quantity
- Example: 1 outlet with 2 add-ons = 3 + 2 = 5 total devices
```

#### Provider/Owner: Get All Tenant Devices

**IMPORTANT**: This endpoint shows device statistics including inactive devices, but only returns **active** devices in the devices array.

```
GET /admin/tenantDevices/:tenantId
Headers: Authorization: Bearer <provider_admin_token>

Success Response:
{
    "success": true,
    "tenantId": 1,
    "tenantName": "Acme Corp",
    "deviceUsage": {
        "active": 4,
        "inactive": 2,
        "total": 6,
        "maximum": 5
    },
    "devices": [
        {
            "id": 123,
            "deviceToken": "d5f9c2a8b3e1...",
            "platform": "android",
            "deviceName": "Samsung Galaxy S21",
            "appVersion": "1.0.0",
            "isActive": true,
            "lastActiveAt": "2024-01-15T14:20:00Z",
            "createdAt": "2024-01-15T10:30:00Z",
            "user": {
                "id": 456,
                "username": "cashier1",
                "role": "Cashier"
            },
            "allocation": {
                "type": "included",
                "activatedAt": "2024-01-15T10:30:00Z"
            }
        },
        {
            "id": 124,
            "deviceToken": "a7b9c3d2e1f4...",
            "platform": "ios",
            "deviceName": "iPhone 13",
            "appVersion": "1.0.0",
            "isActive": true,
            "lastActiveAt": "2024-01-15T13:45:00Z",
            "createdAt": "2024-01-14T09:15:00Z",
            "user": {
                "id": 457,
                "username": "manager1",
                "role": "Manager"
            },
            "allocation": {
                "type": "addon",
                "activatedAt": "2024-01-14T09:15:00Z"
            }
        }
    ]
}

Notes:
- Device usage statistics include ALL devices (active, inactive, total)
- The devices array only contains ACTIVE devices (inactive devices are excluded from the list)
- Devices are ordered by createdAt (newest first)
- Includes device allocation information (included or addon)
- Shows which user owns each device
- Useful for auditing and managing tenant device usage
```

#### Provider/Owner: Reduce Device Quota for Tenant

**IMPORTANT**: This endpoint **automatically deactivates excess devices** (oldest first) when quota is reduced below current active device count.

**Deactivation Strategy:**

- Uses FIFO (First In, First Out) based on `lastActiveAt` timestamp
- Oldest/least recently active devices are deactivated first
- Immediate effect - devices are deactivated instantly

```
POST /admin/reduceDeviceQuota/:tenantId
Headers: Authorization: Bearer <provider_admin_token>

Request:
{
    "quantity": 1
}

Success Response (No devices deactivated):
{
    "success": true,
    "message": "Reduced 1 device quota.",
    "tenantId": 1,
    "addOnQuantity": 1,
    "monthlyCost": 10000,
    "subscriptionId": 123,
    "quota": {
        "previous": 5,
        "current": 4
    },
    "devices": {
        "active": 3,
        "deactivated": 0,
        "deactivatedList": []
    }
}

Success Response (With automatic deactivation):
{
    "success": true,
    "message": "Reduced 1 device quota. Automatically deactivated 1 excess device(s).",
    "tenantId": 1,
    "addOnQuantity": 1,
    "monthlyCost": 10000,
    "subscriptionId": 123,
    "quota": {
        "previous": 5,
        "current": 4
    },
    "devices": {
        "active": 4,
        "deactivated": 1,
        "deactivatedList": [
            {
                "deviceToken": "abc123...",
                "platform": "android",
                "deviceName": "Old Phone",
                "username": "cashier1",
                "lastActiveAt": "2024-01-10T08:30:00Z"
            }
        ]
    }
}

Error Response (Insufficient add-on):
{
    "success": false,
    "error": {
        "errorType": "RequestValidateError",
        "errorMessage": "Cannot reduce by 3. Current add-on quantity is 2"
    }
}

Notes:
- Reduces add-on quantity from the tenant's FIRST active subscription
- If new quota < current active devices, excess devices are AUTO-DEACTIVATED
- Deactivation is based on lastActiveAt (oldest first)
- Cannot reduce more than current add-on quantity
- If reducing to 0, the add-on record is deleted
- Response includes list of deactivated devices for record-keeping
```

#### Register Device

**Important Logic:**

- If device already exists (same deviceToken), it will be **reactivated** without checking the limit
- Device limit is **only checked for NEW devices** (first-time registration)
- This allows users to re-login on the same device without hitting quota issues

```
POST /pushy/devices/register
Headers: Authorization: Bearer <jwt_token>

Request:
{
    "deviceToken": "d5f9c2a8b3e1...",
    "platform": "android",
    "deviceName": "Samsung Galaxy S21",
    "appVersion": "1.0.0"
}

Success Response (New Device):
{
    "success": true,
    "message": "Device registered successfully",
    "device": {
        "id": 123,
        "deviceToken": "d5f9c2a8b3e1...",
        "platform": "android",
        "isActive": true
    },
    "subscribedTopics": ["tenant_1", "tenant_1_sales", "tenant_1_user_456"],
    "deviceStats": {
        "currentCount": 4,
        "maxAllowed": 5
    }
}

Success Response (Existing Device Reactivated):
{
    "success": true,
    "message": "Device updated successfully",
    "device": {
        "id": 123,
        "deviceToken": "d5f9c2a8b3e1...",
        "platform": "android",
        "isActive": true
    },
    "subscribedTopics": ["tenant_1", "tenant_1_sales", "tenant_1_user_456"]
}

Error Response (Device Limit):
{
    "success": false,
    "error": {
        "errorType": "Function",
        "errorMessage": "Device limit reached. Purchase additional device slot for IDR 10.000/month"
    }
}
```

#### Unregister Device

```
DELETE /pushy/devices/:deviceToken
Headers: Authorization: Bearer <jwt_token>

Success Response:
{
    "success": true,
    "message": "Device unregistered successfully"
}
```

#### Get User's Devices

```
GET /pushy/devices/user
Headers: Authorization: Bearer <jwt_token>

Response:
{
    "success": true,
    "devices": [
        {
            "id": 123,
            "deviceToken": "d5f9c2a8b3e1...",
            "platform": "android",
            "deviceName": "Samsung Galaxy S21",
            "isActive": true,
            "createdAt": "2024-01-15T10:30:00Z",
            "lastActiveAt": "2024-01-15T14:20:00Z"
        },
        {
            "id": 124,
            "deviceToken": "a7b9c3d2e1f4...",
            "platform": "ios",
            "deviceName": "iPhone 13",
            "isActive": true,
            "createdAt": "2024-01-14T09:15:00Z",
            "lastActiveAt": "2024-01-15T13:45:00Z"
        }
    ],
    "deviceUsage": {
        "current": 2,
        "maximum": 5
    }
}
```

#### Update Device Status

```
PATCH /pushy/devices/:deviceToken/status
Headers: Authorization: Bearer <jwt_token>

Request:
{
    "isActive": false
}

Response:
{
    "success": true,
    "device": {
        "id": 123,
        "deviceToken": "d5f9c2a8b3e1...",
        "isActive": false
    }
}
```

### Admin Endpoints

#### Get Device Statistics

```
GET /pushy/admin/devices/stats
Headers: Authorization: Bearer <jwt_token>

Response:
{
    "success": true,
    "stats": {
        "totalDevices": 8,
        "activeDevices": 5,
        "inactiveDevices": 3,
        "paidDevices": 3,
        "freeDevices": 5,
        "devices": [
            {
                "id": 123,
                "deviceToken": "d5f9c2a8b3e1...",
                "platform": "android",
                "isActive": true,
                "isPaid": false,
                "username": "john.doe",
                "createdAt": "2024-01-15T10:30:00Z",
                "lastActiveAt": "2024-01-15T14:20:00Z"
            }
        ]
    }
}
```

#### Remove Additional Devices

```
DELETE /pushy/admin/devices/remove
Headers: Authorization: Bearer <jwt_token>

Request:
{
    "quantity": 1
}

Response:
{
    "success": true,
    "message": "Removed 1 additional device slot(s)",
    "totalAdditionalDevices": 1,
    "monthlyAdditionalCost": 10000
}
```

## Service Files

### 1. pushy.service.ts

Core Pushy SDK integration (Singleton)

- Methods: sendToTopic, sendToDevices, subscribeToTopics, unsubscribeFromTopics
- Device info and subscription checking

### 2. notification.service.ts

High-level notification service (Singleton)

- Permission-based notification sending
- Business logic notifications (sales, inventory, orders, etc.)

### 3. device-limit.service.ts

Device limit management (Singleton)

- **Hybrid model**: Device limits calculated as sum of all outlet subscriptions
- Each outlet subscription includes 3 devices
- Additional device purchase (IDR 10,000/device/month) added to outlet subscription
- Devices are pooled at tenant level (can be used at any outlet)
- Device allocation tracking

### 4. device.controller.ts

Device management controller

- Register/unregister devices
- Device status management
- Topic subscription based on permissions

## Modified Files

### auth.service.ts

- Added `getNotificationTopics` function to generate notification topics
- Modified `generateJwtToken` to include notificationTopics and planName in JWT
- Permission checking: `name.startsWith('Receive ') && category === 'Notifications'`

### authorize-middleware.ts

- Added `notificationTopics` field to UserInfo interface
- Added `planName` field to UserInfo interface

### index.ts

- Added pushy routes: `app.use('/pushy', require('./pushy/device.routes').default)`

## Plan Upgrade Endpoint (Admin/POS Owner)

### Upgrade Tenant Plan

**Purpose**: Upgrade tenant subscription plan with automatic token invalidation and cache clearing

**Endpoint**: `PUT /admin/tenants/:tenantId/upgradePlan`

**Headers**: `Authorization: Bearer <admin_token>`

**Request Body**:

```json
{
  "planName": "Pro"
}
```

**Response**:

```json
{
  "success": true,
  "message": "Successfully upgraded from \"Basic\" to \"Pro\"",
  "tenantId": 5,
  "previousPlan": "Basic",
  "newPlan": "Pro",
  "updatedSubscriptions": 3,
  "tokensInvalidated": true,
  "cacheCleared": true
}
```

**What Happens Automatically:**

1. Validates new plan exists
2. Updates ALL outlet subscriptions to new plan
3. Clears plan cache (instant effect for notifications)
4. Revokes all refresh tokens (users must re-login)
5. Users get new JWT with updated plan on next login

**Notification Impact:**

- Next sale (within 1 second): Plan change detected, notifications work immediately
- Cache cleared: No 1-hour wait for plan detection
- Cost-optimized: 1-hour cache reduces DB queries by 95%

---

## Implemented Notifications

### Sales Module Notifications

The sales module is fully integrated with push notifications. All sales-related events automatically send notifications to users with the `Receive Sales Notification` permission.

#### 1. New Sale Completed

**Trigger**: When a new sale is completed successfully
**Function**: `completeNewSales()` in [sales.service.ts](src/sales/sales.service.ts)
**Recipients**: Users with `Receive Sales Notification` permission
**Topic**: `tenant_{tenantId}_outlet_{outletId}_sales`

**Payload:**

```json
{
  "to": "/topics/tenant_1_outlet_5_sales",
  "notification": {
    "title": "New Sale Completed",
    "body": "Sale #1234 - IDR 150000",
    "badge": 1,
    "sound": "default"
  },
  "data": {
    "type": "sale_completed",
    "salesId": 1234,
    "amount": 150000,
    "customerName": "Walk-in Customer",
    "status": "Completed",
    "itemCount": 5,
    "outletId": 5,
    "triggeringUserId": 456,
    "triggeringUsername": "cashier01",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

#### 2. Payment Added to Partially Paid Sale

**Trigger**: When additional payment is added to a partially paid sale
**Function**: `addPaymentToPartiallyPaidSales()` in [sales.service.ts](src/sales/sales.service.ts)
**Recipients**: Users with `Receive Sales Notification` permission
**Topic**: `tenant_{tenantId}_outlet_{outletId}_sales`

**Payload (Partial Payment):**

```json
{
  "to": "/topics/tenant_1_outlet_5_sales",
  "notification": {
    "title": "Payment Added",
    "body": "Sale #1234 - Payment IDR 50000",
    "badge": 1,
    "sound": "default"
  },
  "data": {
    "type": "payment_added",
    "salesId": 1234,
    "paymentAmount": 50000,
    "remainingAmount": 50000,
    "newStatus": "Partially Paid",
    "outletId": 5,
    "triggeringUserId": 456,
    "triggeringUsername": "cashier01",
    "timestamp": "2024-01-15T11:00:00Z"
  }
}
```

**Payload (Payment Completed):**

```json
{
  "to": "/topics/tenant_1_outlet_5_sales",
  "notification": {
    "title": "Payment Completed",
    "body": "Sale #1234 - Payment IDR 100000",
    "badge": 1,
    "sound": "default"
  },
  "data": {
    "type": "payment_completed",
    "salesId": 1234,
    "paymentAmount": 100000,
    "remainingAmount": 0,
    "newStatus": "Completed",
    "outletId": 5,
    "triggeringUserId": 456,
    "triggeringUsername": "manager01",
    "timestamp": "2024-01-15T12:00:00Z"
  }
}
```

#### 3. Sale Voided

**Trigger**: When a completed sale is voided
**Function**: `voidSales()` in [sales.service.ts](src/sales/sales.service.ts)
**Recipients**: Users with `Receive Sales Notification` permission
**Topic**: `tenant_{tenantId}_outlet_{outletId}_sales`

**Payload:**

```json
{
  "to": "/topics/tenant_1_outlet_5_sales",
  "notification": {
    "title": "Sale Voided",
    "body": "Sale #1234 - IDR 150000 has been voided",
    "badge": 1,
    "sound": "default"
  },
  "data": {
    "type": "sale_voided",
    "salesId": 1234,
    "amount": 150000,
    "customerName": "Walk-in Customer",
    "previousStatus": "Completed",
    "outletId": 5,
    "triggeringUserId": 789,
    "triggeringUsername": "manager01",
    "timestamp": "2024-01-15T14:00:00Z"
  }
}
```

#### 4. Sale Returned

**Trigger**: When a completed sale is returned
**Function**: `returnSales()` in [sales.service.ts](src/sales/sales.service.ts)
**Recipients**: Users with `Receive Sales Notification` permission
**Topic**: `tenant_{tenantId}_outlet_{outletId}_sales`

**Payload:**

```json
{
  "to": "/topics/tenant_1_outlet_5_sales",
  "notification": {
    "title": "Sale Returned",
    "body": "Sale #1234 - IDR 150000 has been returned",
    "badge": 1,
    "sound": "default"
  },
  "data": {
    "type": "sale_returned",
    "salesId": 1234,
    "amount": 150000,
    "customerName": "Walk-in Customer",
    "previousStatus": "Completed",
    "outletId": 5,
    "triggeringUserId": 789,
    "triggeringUsername": "manager01",
    "timestamp": "2024-01-15T15:00:00Z"
  }
}
```

#### 5. Sale Refunded

**Trigger**: When a completed sale is refunded
**Function**: `refundSales()` in [sales.service.ts](src/sales/sales.service.ts)
**Recipients**: Users with `Receive Sales Notification` permission
**Topic**: `tenant_{tenantId}_outlet_{outletId}_sales`

**Payload:**

```json
{
  "to": "/topics/tenant_1_outlet_5_sales",
  "notification": {
    "title": "Sale Refunded",
    "body": "Sale #1234 - IDR 150000 has been refunded",
    "badge": 1,
    "sound": "default"
  },
  "data": {
    "type": "sale_refunded",
    "salesId": 1234,
    "amount": 150000,
    "customerName": "Walk-in Customer",
    "previousStatus": "Completed",
    "outletId": 5,
    "triggeringUserId": 789,
    "triggeringUsername": "manager01",
    "timestamp": "2024-01-15T16:00:00Z"
  }
}
```

### Inventory Module Notifications

The inventory module automatically sends notifications when stock reaches critical levels. All inventory notifications are sent to users with the `Receive Inventory Notification` permission.

#### 1. Out of Stock Alert (Single Item)

**Trigger**: When an item's available quantity reaches exactly 0 after a sale
**Function**: `completeNewSales()` in [sales.service.ts](src/sales/sales.service.ts)
**Recipients**: Users with `Receive Inventory Notification` permission
**Topic**: `tenant_{tenantId}_outlet_{outletId}_inventory`

**Payload:**

```json
{
  "to": "/topics/tenant_1_outlet_5_inventory",
  "notification": {
    "title": "Out of Stock Alert",
    "body": "Coca Cola 330ml is now out of stock",
    "badge": 1,
    "sound": "default"
  },
  "data": {
    "type": "out_of_stock",
    "priority": "high",
    "count": 1,
    "items": [
      {
        "itemId": 789,
        "itemName": "Coca Cola 330ml",
        "itemCode": "BEV-001",
        "previousStock": 5,
        "currentStock": 0,
        "soldQuantity": 5
      }
    ],
    "outletId": 5,
    "salesId": 1234,
    "triggeringUserId": 456,
    "triggeringUsername": "cashier01",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

#### 2. Out of Stock Alert (Multiple Items)

**Trigger**: When multiple items reach 0 stock in the same sale
**Topic**: `tenant_{tenantId}_outlet_{outletId}_inventory`

**Payload:**

```json
{
  "to": "/topics/tenant_1_outlet_5_inventory",
  "notification": {
    "title": "3 Items Out of Stock",
    "body": "Coca Cola 330ml, Sprite 330ml, Fanta 330ml",
    "badge": 1,
    "sound": "default"
  },
  "data": {
    "type": "out_of_stock",
    "priority": "high",
    "count": 3,
    "items": [
      {
        "itemId": 789,
        "itemName": "Coca Cola 330ml",
        "itemCode": "BEV-001",
        "previousStock": 5,
        "currentStock": 0,
        "soldQuantity": 5
      },
      {
        "itemId": 790,
        "itemName": "Sprite 330ml",
        "itemCode": "BEV-002",
        "previousStock": 3,
        "currentStock": 0,
        "soldQuantity": 3
      },
      {
        "itemId": 791,
        "itemName": "Fanta 330ml",
        "itemCode": "BEV-003",
        "previousStock": 2,
        "currentStock": 0,
        "soldQuantity": 2
      }
    ],
    "outletId": 5,
    "salesId": 1234,
    "triggeringUserId": 456,
    "triggeringUsername": "cashier01",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

#### 3. Low Stock Warning (Single Item)

**Trigger**: When an item's stock crosses below its reorder threshold after a sale
**Function**: `completeNewSales()` in [sales.service.ts](src/sales/sales.service.ts)
**Recipients**: Users with `Receive Inventory Notification` permission
**Topic**: `tenant_{tenantId}_outlet_{outletId}_inventory`

**Note**: Only sent if item has a reorder threshold set AND stock was above threshold before sale

**Payload:**

```json
{
  "to": "/topics/tenant_1_outlet_5_inventory",
  "notification": {
    "title": "Low Stock Warning",
    "body": "Coca Cola 330ml is running low (8 left)",
    "badge": 1,
    "sound": "default"
  },
  "data": {
    "type": "low_stock",
    "priority": "normal",
    "count": 1,
    "items": [
      {
        "itemId": 789,
        "itemName": "Coca Cola 330ml",
        "itemCode": "BEV-001",
        "previousStock": 12,
        "currentStock": 8,
        "reorderThreshold": 10,
        "soldQuantity": 4
      }
    ],
    "outletId": 5,
    "salesId": 1234,
    "triggeringUserId": 456,
    "triggeringUsername": "cashier01",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

#### 4. Low Stock Warning (Multiple Items)

**Trigger**: When multiple items cross their reorder threshold in the same sale
**Topic**: `tenant_{tenantId}_outlet_{outletId}_inventory`

**Payload:**

```json
{
  "to": "/topics/tenant_1_outlet_5_inventory",
  "notification": {
    "title": "2 Items Low on Stock",
    "body": "Coca Cola 330ml, Sprite 330ml",
    "badge": 1,
    "sound": "default"
  },
  "data": {
    "type": "low_stock",
    "priority": "normal",
    "count": 2,
    "items": [
      {
        "itemId": 789,
        "itemName": "Coca Cola 330ml",
        "itemCode": "BEV-001",
        "previousStock": 12,
        "currentStock": 8,
        "reorderThreshold": 10,
        "soldQuantity": 4
      },
      {
        "itemId": 790,
        "itemName": "Sprite 330ml",
        "itemCode": "BEV-002",
        "previousStock": 15,
        "currentStock": 9,
        "reorderThreshold": 10,
        "soldQuantity": 6
      }
    ],
    "outletId": 5,
    "salesId": 1234,
    "triggeringUserId": 456,
    "triggeringUsername": "cashier01",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

**Key Features:**

- ✅ Consistent payload structure (always `items` array)
- ✅ Dynamic title/message based on count
- ✅ Priority levels (high for out-of-stock, normal for low-stock)
- ✅ Only sent if stock actually changed (prevents spam)
- ✅ Items without reorder threshold never send low-stock alerts

---

## Notification Payload Examples (Other Modules - Not Yet Implemented)

### Order Status Update

**Status**: Not yet implemented
**Trigger**: When order status changes
**Recipients**: Users with `Receive Order Notification` permission
**Topic**: `tenant_{id}_outlet_{outletId}_order`

**Pushy Payload Sent:**

```json
{
  "to": "/topics/tenant_1_outlet_5_order",
  "notification": {
    "title": "Order Status Updated",
    "body": "Order #5678 is now READY",
    "badge": 1,
    "sound": "ping.aiff"
  },
  "data": {
    "type": "order_status",
    "orderId": 5678,
    "previousStatus": "PREPARING",
    "status": "READY",
    "tableNumber": "T-12",
    "items": ["Burger Deluxe x2", "French Fries x2", "Coca Cola x2"],
    "outletId": 5,
    "triggeringUserId": 789,
    "triggeringUsername": "kitchen_staff",
    "timestamp": "2024-01-15T12:45:00Z"
  }
}
```

### Financial Alert

**Trigger**: Purchase order approved  
**Recipients**: Users with `Receive Financial Notification` permission  
**Topic**: `tenant_{id}_financial`

**Pushy Payload Sent:**

```json
{
  "to": "/topics/tenant_1_financial",
  "notification": {
    "title": "Purchase Order Approved",
    "body": "PO #2024-001 approved by manager01",
    "badge": 1,
    "sound": "ping.aiff"
  },
  "data": {
    "type": "po_approved",
    "poId": 2024001,
    "poNumber": "PO-2024-001",
    "totalAmount": 5000000,
    "supplierName": "ABC Supplies Ltd",
    "itemCount": 15,
    "approvedBy": "manager01",
    "triggeringUserId": 234,
    "triggeringUsername": "manager01",
    "timestamp": "2024-01-15T16:00:00Z"
  }
}
```

### Staff Notification

**Trigger**: Shift reminder  
**Recipients**: Users with `Receive Staff Notification` permission  
**Topic**: `tenant_{id}_staff`

**Pushy Payload Sent:**

```json
{
  "to": "/topics/tenant_1_staff",
  "notification": {
    "title": "Shift Reminder",
    "body": "Your shift starts in 30 minutes",
    "badge": 1,
    "sound": "ping.aiff"
  },
  "data": {
    "type": "shift_reminder",
    "shiftId": 321,
    "shiftStartTime": "2024-01-15T14:00:00Z",
    "shiftEndTime": "2024-01-15T22:00:00Z",
    "outletId": 5,
    "outletName": "Main Street Branch",
    "triggeringUserId": 1,
    "triggeringUsername": "system",
    "timestamp": "2024-01-15T13:30:00Z"
  }
}
```

### System Alert

**Trigger**: Subscription expiring  
**Recipients**: Users with `Receive System Notification` permission  
**Topic**: `tenant_{id}_system`

**Pushy Payload Sent:**

```json
{
  "to": "/topics/tenant_1_system",
  "notification": {
    "title": "Subscription Alert",
    "body": "Your subscription expires in 7 days",
    "badge": 1,
    "sound": "ping.aiff"
  },
  "data": {
    "type": "subscription_alert",
    "alertType": "expiring",
    "daysRemaining": 7,
    "expiryDate": "2024-01-22T00:00:00Z",
    "planName": "Pro Plan",
    "renewalUrl": "/subscription/renew",
    "triggeringUserId": null,
    "triggeringUsername": "system",
    "timestamp": "2024-01-15T09:00:00Z"
  }
}
```

### Direct User Notification

**Trigger**: System or admin sends direct message  
**Recipients**: Specific user  
**Topic**: `tenant_{id}_user_{userId}`

**Pushy Payload Sent:**

```json
{
  "to": "/topics/tenant_1_user_456",
  "notification": {
    "title": "Important Message",
    "body": "Please check your pending approvals",
    "badge": 1,
    "sound": "ping.aiff"
  },
  "data": {
    "type": "direct_message",
    "priority": "high",
    "actionRequired": true,
    "deepLink": "/approvals/pending",
    "triggeringUserId": 1,
    "triggeringUsername": "admin",
    "timestamp": "2024-01-15T11:00:00Z"
  }
}
```

## Integration Examples

### Send Sales Notification

```typescript
import NotificationService from '../pushy/notification.service';

async createSale(req: AuthRequest, res: Response) {
  const userInfo = req.user;
  const sale = await salesService.createSale(req.body);

  // Send notification (automatically skipped if not Pro plan)
  await NotificationService.sendSalesNotification(
    userInfo.tenantId,
    'New Sale Created',
    `Sale #${sale.id} for IDR ${sale.amount}`,
    userInfo.userId,
    userInfo.planName,
    { saleId: sale.id, amount: sale.amount },
    sale.outletId // Outlet-specific notification
  );

  res.json({ success: true, sale });
}
```

### Send Inventory Alert

```typescript
async updateStock(req: AuthRequest, res: Response) {
  const stock = await inventoryService.updateStock(req.body);

  if (stock.quantity <= stock.reorderLevel) {
    await NotificationService.sendInventoryNotification(
      req.user.tenantId,
      'Low Stock Alert',
      `${stock.itemName} is running low (${stock.quantity} remaining)`,
      req.user.userId,
      req.user.planName,
      { itemId: stock.id, currentStock: stock.quantity },
      stock.outletId // Outlet-specific notification
    );
  }

  res.json({ success: true, stock });
}
```

## Flutter Client Integration

### Dynamic Outlet Topic Subscription

When a user switches outlets in the app, the client should:

1. Unsubscribe from previous outlet-specific topics
2. Subscribe to new outlet-specific topics

```dart
Future<void> switchOutlet(int newOutletId) async {
    // Get current user's permissions that require outlet-specific subscriptions
    final outletSpecificPermissions = ['sales', 'inventory', 'order'];

    // Unsubscribe from old outlet topics
    if (currentOutletId != null) {
        for (final permission in outletSpecificPermissions) {
            if (userPermissions.contains('Receive ${permission.capitalize()} Notification')) {
                await PushySDK.unsubscribe('tenant_${tenantId}_outlet_${currentOutletId}_$permission');
            }
        }
    }

    // Subscribe to new outlet topics
    for (final permission in outletSpecificPermissions) {
        if (userPermissions.contains('Receive ${permission.capitalize()} Notification')) {
            await PushySDK.subscribe('tenant_${tenantId}_outlet_${newOutletId}_$permission');
        }
    }

    currentOutletId = newOutletId;
}
```

### Register Device on Login

**IMPORTANT**: Always check device eligibility BEFORE calling `Pushy.register()` to save costs.

```dart
Future<void> onLoginSuccess(LoginResponse response) async {
    // Check if Pro plan
    if (response.planName != 'Pro') {
        return; // Skip device registration for non-Pro plans
    }

    // Check if user has master notification permission
    if (!hasPermission('Receive Notification')) {
        return; // Skip if user doesn't have notification permission
    }

    // Store notification topics for later use
    await SharedPreferences.setStringList('notification_topics', response.notificationTopics);

    try {
        // STEP 1: Check eligibility BEFORE calling Pushy.register()
        // This prevents unnecessary billing from Pushy
        final eligibility = await ApiService.checkDeviceEligibility();

        if (!eligibility.canRegister) {
            // Handle cases where device cannot be registered
            if (eligibility.requiresPayment) {
                showDeviceLimitDialog(
                    current: eligibility.deviceUsage.current,
                    maximum: eligibility.deviceUsage.maximum,
                    additionalCost: eligibility.additionalCost
                );
            } else {
                showErrorDialog(eligibility.reason);
            }
            return;
        }

        // STEP 2: Only call Pushy.register() if eligibility check passed
        // This is when Pushy starts billing for the device
        String deviceToken = await Pushy.register();

        // STEP 3: Register device with backend
        await ApiService.registerDevice(deviceToken, Platform.operatingSystem);

        // STEP 4: Subscribe to notification topics from login response
        for (String topic in response.notificationTopics) {
            await Pushy.subscribe(topic);
        }

    } catch (e) {
        if (e is DeviceLimitException) {
            showDeviceLimitDialog();
        }
    }
}

bool hasPermission(String permissionName) {
    // Check if user has the specified permission
    // This should read from your user session/JWT token
    return userPermissions.contains(permissionName);
}
```

### Provider Billing Workflow

#### Scenario 1: Adding Device Quota

**Complete flow when tenant requests additional devices:**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Tenant User: Try to register 6th device                 │
│    GET /pushy/devices/check-eligibility                     │
│    Response: canRegister: false, current: 5, maximum: 5    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Tenant: Contact Provider via email/WhatsApp             │
│    "We need 2 more device slots"                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Provider (You): Add device quota                        │
│    POST /admin/addDeviceQuota/1                            │
│    Body: { "quantity": 2 }                                 │
│                                                              │
│    Database Changes:                                         │
│    - Creates/updates TenantSubscriptionAddOn                │
│    - addOnId: 2 (Push Notification Device)                 │
│    - quantity: 2                                            │
│    - Attached to primary subscription                       │
│                                                              │
│    Monthly billing: +IDR 20,000 (2 × 10,000)               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Tenant User: Check eligibility again                    │
│    GET /pushy/devices/check-eligibility                     │
│    Response: canRegister: true, current: 3, maximum: 5     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Tenant User: Register device successfully               │
│    POST /pushy/devices/register                            │
│    Response: Success! current: 4, maximum: 5               │
└─────────────────────────────────────────────────────────────┘
```

**Billing Calculation:**

- Base: 1 outlet × 3 devices = 3 devices (included in Pro plan)
- Add-on: 2 additional devices = IDR 20,000/month
- Total: 5 devices available

**Provider Dashboard Query:**

```sql
-- To see all tenant device add-ons for billing
SELECT
    t.TENANT_NAME,
    tsa.QUANTITY as additional_devices,
    (tsa.QUANTITY * 10000) as monthly_cost
FROM TENANT_SUBSCRIPTION_ADD_ON tsa
JOIN TENANT_SUBSCRIPTION ts ON tsa.TENANT_SUBSCRIPTION_ID = ts.ID
JOIN TENANT_OUTLET o ON ts.OUTLET_ID = o.ID
JOIN TENANT t ON o.TENANT_ID = t.ID
WHERE tsa.ADD_ON_ID = 2
AND ts.STATUS IN ('Active', 'active', 'trial');
```

#### Scenario 2: Reducing Device Quota (with Automatic Deactivation)

**Complete flow when provider reduces device quota and system auto-deactivates excess devices:**

```
Current State:
┌───────────────────────────────────────────────────────┐
│ Tenant has 5 devices registered (all active)          │
│ - Device 1: lastActiveAt: 2024-01-10 08:30:00        │
│ - Device 2: lastActiveAt: 2024-01-11 10:15:00        │
│ - Device 3: lastActiveAt: 2024-01-12 14:20:00        │
│ - Device 4: lastActiveAt: 2024-01-13 09:45:00        │
│ - Device 5: lastActiveAt: 2024-01-14 16:30:00        │
│                                                        │
│ Current quota: 5 (3 base + 2 add-on)                 │
└───────────────────────────────────────────────────────┘

                       │
                       ▼

┌─────────────────────────────────────────────────────────────┐
│ 1. Provider (You): Reduce device quota by 1                │
│    POST /admin/reduceDeviceQuota/1                         │
│    Body: { "quantity": 1 }                                 │
│                                                              │
│    System Actions:                                           │
│    ✓ Reduces add-on quantity: 2 → 1                        │
│    ✓ New quota: 4 devices (3 base + 1 add-on)             │
│    ✓ Checks current devices: 5 active                      │
│    ✓ Calculates excess: 5 - 4 = 1 device to deactivate    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. System: Auto-deactivates excess device                  │
│    Strategy: FIFO (oldest lastActiveAt first)              │
│                                                              │
│    Devices sorted by lastActiveAt (ascending):              │
│    1. Device 1: 2024-01-10 08:30:00 ← DEACTIVATED          │
│    2. Device 2: 2024-01-11 10:15:00                        │
│    3. Device 3: 2024-01-12 14:20:00                        │
│    4. Device 4: 2024-01-13 09:45:00                        │
│    5. Device 5: 2024-01-14 16:30:00                        │
│                                                              │
│    For Device 1:                                             │
│    ✓ Set isActive = false                                  │
│    ✓ Delete from PushyDeviceAllocation                     │
│    ✓ Add to deactivatedList response                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Provider receives response with details                 │
│    {                                                        │
│      "success": true,                                       │
│      "message": "Reduced 1 device quota. Automatically     │
│                  deactivated 1 excess device(s).",         │
│      "quota": {                                             │
│        "previous": 5,                                       │
│        "current": 4                                         │
│      },                                                     │
│      "devices": {                                           │
│        "active": 4,                                         │
│        "deactivated": 1,                                    │
│        "deactivatedList": [                                 │
│          {                                                  │
│            "deviceToken": "abc123...",                      │
│            "platform": "android",                           │
│            "deviceName": "Old Phone",                       │
│            "username": "cashier1",                          │
│            "lastActiveAt": "2024-01-10T08:30:00Z"          │
│          }                                                  │
│        ]                                                    │
│      }                                                      │
│    }                                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────────────┐
│ New State:                                             │
│ - 4 devices active (Device 2, 3, 4, 5)               │
│ - 1 device inactive (Device 1)                        │
│ - Current quota: 4                                     │
│ - Monthly billing: IDR 10,000 (1 add-on)              │
└───────────────────────────────────────────────────────┘
```

**Deactivation Logic:**

1. **Ordering**: Devices are sorted by `lastActiveAt` in ascending order (oldest first)
2. **Selection**: First N devices from the sorted list are selected for deactivation
3. **Execution**: For each device:
   - Set `isActive = false` in `PushyDevice` table
   - Delete entry from `PushyDeviceAllocation` table
   - Add device info to response's `deactivatedList`

**Why FIFO (First In, First Out)?**

- Preserves most recently used devices (likely still in use)
- Deactivates least recently used devices (likely abandoned/unused)
- Fair and predictable deactivation strategy
- Minimizes disruption to active users

**Edge Cases:**

- If reducing quota to 0 add-ons → Deletes the add-on record entirely
- If quota reduction exceeds current add-on quantity → Error response
- If devices ≤ new quota → No deactivation, just quota reduction
- Inactive devices don't count toward active limit

### Handle Device Limit

```dart
void showDeviceLimitDialog() {
    showDialog(
        context: context,
        builder: (_) => AlertDialog(
            title: Text('Device Limit Reached'),
            content: Text('Maximum 3 devices registered. Remove a device or purchase additional slot.'),
            actions: [
                TextButton(
                    onPressed: () => Navigator.pushNamed(context, '/devices'),
                    child: Text('Manage Devices')
                ),
                ElevatedButton(
                    onPressed: () => purchaseAdditionalDevice(),
                    child: Text('Add Device (IDR 10,000/month)')
                ),
            ],
        ),
    );
}
```

## Authentication Response with Notification Topics

### Login Response

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenExpiryDate": "2024-01-16T10:30:00Z",
  "refreshToken": "f1g2h3j4k5l6m7n8o9p0q1r2s3t4u5v6",
  "tenantId": 1,
  "userId": 789,
  "notificationTopics": [
    "tenant_1",
    "tenant_1_sales",
    "tenant_1_inventory",
    "tenant_1_order",
    "tenant_1_financial",
    "tenant_1_staff",
    "tenant_1_system",
    "tenant_1_user_456"
  ],
  "planName": "Pro"
}
```

## Error Responses

### Device Limit Exceeded

```json
{
  "success": false,
  "error": "Device limit reached (3/3)",
  "requiresAddOn": true,
  "deviceUsage": {
    "current": 3,
    "maximum": 3
  },
  "additionalCost": 10000,
  "code": "DEVICE_LIMIT_EXCEEDED"
}
```

### No Pro Plan

```json
{
  "success": false,
  "error": "Push notifications are only available for Pro plan",
  "currentPlan": "Basic",
  "code": "PLAN_NOT_SUPPORTED"
}
```

## Environment Variables

```bash
PUSHY_SECRET_API_KEY=your_pushy_api_key
```

## Memory Management

- All services use singleton pattern to prevent memory leaks
- Single instance shared across all requests
- Connection pooling managed by Prisma and Pushy SDK
- Stateless services safe for concurrent operations

## Token Invalidation on Plan Changes

When subscription plan changes:

1. Delete all refresh tokens for tenant
2. Forces re-login with updated JWT containing new plan
3. Ensures no stale plan data in active sessions

```typescript
// In subscription update logic:
import TokenInvalidationService from "./pushy/token-invalidation.service";

await TokenInvalidationService.onPlanChange(tenantId, oldPlan, newPlan);
```

## Deployment Checklist

## Plan Checking & Cost Optimization

### How Plan Checking Works

All notifications go through centralized plan checking in `PushyService.sendToTopic()` and `PushyService.sendToDevices()`.

**Flow:**

```
Notification triggered (e.g., new sale)
       ↓
PushyService.sendToTopic(topic, data, tenantId)
       ↓
Check PlanCheckService.isProPlan(tenantId)
       ├─ Check in-memory cache first
       ├─ If cached (< 1 hour): Return cached result (NO DB query) ✅
       └─ If not cached: Query database → Cache result → Return
       ↓
If NOT Pro plan: Return { success: true, id: 'skipped' } (NO Pushy API call) ✅
If Pro plan: Send to Pushy API ✅
```

### Cache Performance

**Cache TTL**: 1 hour (configurable in [plan-check.service.ts:15](src/pushy/plan-check.service.ts#L15))

**Cache Hit Rate:**

- High-volume tenants (>10 sales/hour): 80-90% cache hit
- Medium-volume tenants (3-10 sales/hour): 50-70% cache hit
- Low-volume tenants (<3 sales/hour): 0-20% cache hit

**Query Reduction:**

- Without cache: 10,000 sales = 10,000 DB queries
- With 1-hour cache: 10,000 sales = ~500 DB queries
- **95% reduction!** ✅

### Cost Analysis

**Monthly Cost (10,000 sales, 100 tenants):**
| Component | Without Optimization | With Optimization | Savings |
|-----------|---------------------|-------------------|---------|
| **DB Queries** | 10,000 | 500 | 95% ✅ |
| **Pushy API Calls** | 10,000 | ~2,000 (20% Pro) | 80% ✅ |
| **DB Cost** | $0.10 | $0.005 | $0.095/mo |
| **Pushy Cost** | $15.00 | $3.00 | $12.00/mo |
| **Total Savings** | - | - | **$12.10/mo** ✅ |

### Plan Upgrade Handling

When you upgrade a tenant's plan using `PUT /admin/tenants/:tenantId/upgradePlan`:

1. **Instant Cache Clear**: `PlanCheckService.clearTenantCache(tenantId)` called immediately
2. **Next Notification**: Within 1 second, plan change detected
3. **Token Invalidation**: All refresh tokens revoked, users must re-login
4. **New JWT**: Users get updated `planName` in JWT on next login

**Result**: No 1-hour wait for upgrades! ✅

### When Plan Cache is Checked

Cache is **ONLY** checked when notifications are sent:

- Currently: Sales module (new sales, payments, void, return, refund)
- Future: Inventory, orders, staff, financial modules

**Important**: No sales = No cache checks = No DB queries (completely lazy)

---

## Implementation Checklist

- [ ] Set PUSHY_SECRET_API_KEY environment variable
- [ ] Run Prisma migrations for database schema
- [ ] Insert notification permissions into Permission table
- [ ] Insert device add-on into subscription_add_on table
- [ ] Update subscription plans with max_devices field
- [ ] Test device registration with Pro plan account
- [ ] Test device limit enforcement
- [ ] Test notification delivery to registered devices
- [x] Implement plan checking with 1-hour cache
- [x] Implement plan upgrade endpoint
- [x] Implement sales notifications
- [x] Implement inventory notifications (out-of-stock and low-stock)
