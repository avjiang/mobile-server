# Pushy Push Notification Implementation

## Overview

Push notification system using Pushy SDK for multi-tenant Flutter POS application with device limits and subscription-based access.

## Key Requirements

- **Push notifications are only available for tenants on the Pro plan**
- Frontend decides whether to register devices based on plan
- Backend checks planName from JWT token only (no database queries)
- **Hybrid Model**: Device limits calculated per outlet, but devices are tenant-wide pool
- Each outlet subscription includes 5 devices (3 outlets = 15 total devices)
- Additional devices: IDR 10,000/month per device (added to specific outlet subscription)
- Clean approach: When plan changes, all refresh tokens are invalidated forcing re-login

## Architecture

### Core Principles

1. **Permission-based notifications**: Notifications tied to permissions, not roles
2. **Topic-based delivery**: Using Pushy topics for efficient multi-tenant broadcasting
3. **Tenant isolation**: Topics include tenant ID to prevent cross-tenant notifications
4. **Singleton pattern**: All services use singleton to prevent memory leaks
5. **JWT-based plan checking**: Plan name embedded in JWT for efficient checking
6. **Hybrid device model**: Limits calculated per outlet, devices pooled at tenant level

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
   - **Devices**: 3 outlets × 5 devices = 15 total devices for tenant
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

```sql
INSERT INTO subscription_add_on (NAME, ADD_ON_TYPE, PRICE_PER_UNIT, MAX_QUANTITY, SCOPE, DESCRIPTION) VALUES
('Push Notification Device', 'device', 10000.00, null, 'tenant', 'Additional push notification device slot (IDR 10,000/month per device)');
```

## API Endpoints

### Device Management

#### Register Device

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

Success Response:
{
    "success": true,
    "device": {
        "id": 123,
        "deviceToken": "d5f9c2a8b3e1...",
        "platform": "android",
        "topics": ["tenant_1", "tenant_1_sales", "tenant_1_user_456"]
    },
    "deviceUsage": {
        "current": 3,
        "maximum": 5,
        "requiresAddOn": false
    }
}

Error Response (Device Limit):
{
    "success": false,
    "error": "Device limit reached (5/5)",
    "requiresAddOn": true,
    "deviceUsage": {
        "current": 5,
        "maximum": 5
    },
    "additionalCost": 10000,
    "code": "DEVICE_LIMIT_EXCEEDED"
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

#### Purchase Additional Devices

```
POST /pushy/admin/devices/purchase
Headers: Authorization: Bearer <jwt_token>

Request:
{
    "quantity": 2
}

Response:
{
    "success": true,
    "message": "Added 2 additional device slot(s)",
    "totalAdditionalDevices": 2,
    "monthlyAdditionalCost": 20000
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
- Each outlet subscription includes 5 devices
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

## Notification Payload Examples

### Sales Notification

**Trigger**: When cashier completes a sale  
**Recipients**: Users with `Receive Sales Notification` permission  
**Topic**: `tenant_{id}_outlet_{outletId}_sales`

**Pushy Payload Sent:**

```json
{
  "to": "/topics/tenant_1_outlet_5_sales",
  "notification": {
    "title": "New Sale Completed",
    "body": "Sale #1234 - IDR 150,000",
    "badge": 1,
    "sound": "ping.aiff"
  },
  "data": {
    "type": "sale_completed",
    "salesId": 1234,
    "amount": 150000,
    "customerName": "Walk-in Customer",
    "outletId": 5,
    "triggeringUserId": 456,
    "triggeringUsername": "cashier01",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Inventory Alert

**Trigger**: When inventory falls below reorder threshold  
**Recipients**: Users with `Receive Inventory Notification` permission  
**Topic**: `tenant_{id}_outlet_{outletId}_inventory`

**Pushy Payload Sent:**

```json
{
  "to": "/topics/tenant_1_outlet_5_inventory",
  "notification": {
    "title": "Low Stock Alert",
    "body": "Coca Cola 330ml is running low (5 remaining)",
    "badge": 1,
    "sound": "ping.aiff"
  },
  "data": {
    "type": "low_stock",
    "itemId": 789,
    "itemName": "Coca Cola 330ml",
    "itemCode": "BEV-001",
    "currentStock": 5,
    "reorderLevel": 10,
    "outletId": 5,
    "triggeringUserId": 456,
    "triggeringUsername": "inventory_manager",
    "timestamp": "2024-01-15T14:20:00Z"
  }
}
```

### Order Status Update

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
        // Initialize Pushy and get device token
        String deviceToken = await Pushy.register();

        // Register device with backend
        await ApiService.registerDevice(deviceToken, Platform.operatingSystem);

        // Subscribe to notification topics from login response
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

### Handle Device Limit

```dart
void showDeviceLimitDialog() {
    showDialog(
        context: context,
        builder: (_) => AlertDialog(
            title: Text('Device Limit Reached'),
            content: Text('Maximum 5 devices registered. Remove a device or purchase additional slot.'),
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
  "error": "Device limit reached (5/5)",
  "requiresAddOn": true,
  "deviceUsage": {
    "current": 5,
    "maximum": 5
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

- [ ] Set PUSHY_SECRET_API_KEY environment variable
- [ ] Run Prisma migrations for database schema
- [ ] Insert notification permissions into Permission table
- [ ] Insert device add-on into subscription_add_on table
- [ ] Update subscription plans with max_devices field
- [ ] Test device registration with Pro plan account
- [ ] Test device limit enforcement
- [ ] Test notification delivery to registered devices
