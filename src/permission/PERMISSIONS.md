# Permission System Documentation

## Overview

The permission system manages access control for various features and functionalities within the application. Permissions are organized by categories and can be assigned to roles to control user access to different parts of the system.

## Permission Structure

Each permission contains the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | Integer | Unique identifier for the permission |
| `name` | String | Human-readable name of the permission |
| `category` | String | Category grouping for the permission |
| `description` | String | Detailed description of what the permission allows |
| `allowed_roles` | String | Comma-separated list of role IDs that have this permission |
| `created_at` | Timestamp | When the permission was created |
| `updated_at` | Timestamp | When the permission was last modified |
| `is_deleted` | Boolean | Soft delete flag (0 = active, 1 = deleted) |
| `deleted_at` | Timestamp | When the permission was deleted (if applicable) |
| `version` | Integer | Version number for optimistic locking |

## Permission Categories

### Dashboard
Permissions related to dashboard access and analytics viewing.

### Inventory
Permissions for managing and viewing inventory, stock levels, and suppliers.

### Reports
Permissions for accessing various types of reports and analytics.

### Access Control
Permissions for managing users, roles, and access control settings.

### Customer Management
Permissions for managing customer information.

### Outlet Management
Permissions for managing outlet information and settings.

### Sales
Permissions for processing and viewing sales transactions.

### Function Management
Permissions for managing core system functions and configurations.

### Notifications
Permissions for receiving and managing push notifications.

### Devices
Permissions for managing push notification devices.

### Loyalty
Permissions for managing the loyalty program, customer loyalty accounts, point adjustments, subscription packages, and customer subscriptions. These permissions are only relevant for tenants with `loyaltyTier` of `basic` or `advanced`.

## Complete Permission List

### Dashboard Permissions

| ID | Name | Description |
|----|------|-------------|
| 1 | View Dashboard | View dashboard and analytics |

### Inventory Permissions

| ID | Name | Description |
|----|------|-------------|
| 2 | View Inventory | View inventory items and stock levels |
| 7 | Manage Inventory | Add, edit, and delete inventory items |
| 8 | Manage Suppliers | Add, edit, and delete suppliers |
| 9 | View Stock Amount | View complete stock amount |
| 21 | Receive Inventory Notification | Receive inventory related notification |

### Reports Permissions

| ID | Name | Description |
|----|------|-------------|
| 3 | View Session Reports | View session reports and analytics |
| 4 | View Financial Reports | View financial reports and statements |

### Access Control Permissions

| ID | Name | Description |
|----|------|-------------|
| 5 | Manage Users | Create, edit, and delete users |
| 6 | Manage Roles | Create, edit, and delete roles |
| 17 | Manage Access Control | Create and process access control data |

### Customer Management Permissions

| ID | Name | Description | Status |
|----|------|-------------|--------|
| 10 | ~~Manage Customers~~ | ~~Add, edit, and delete customers~~ | **DEPRECATED** (soft-deleted) |
| 22 | Add Customer | Add new customers | Active |
| 23 | Edit Customer | Edit existing customers | Active |
| 24 | Delete Customer | Delete customers | Active |

### Outlet Management Permissions

| ID | Name | Description |
|----|------|-------------|
| 11 | Manage Outlets | Create and manage outlet information |

### Sales Permissions

| ID | Name | Description |
|----|------|-------------|
| 12 | Process Sales | Create and process sales transactions |
| 13 | View Sales History | View sales history and details |
| 14 | Modify Sales History | Modify existing sales histories |
| 18 | Receive Sales Notification | Receive sales related notification |

### Function Management Permissions

| ID | Name | Description |
|----|------|-------------|
| 15 | Manage Master Data | Create and process master data |
| 16 | Manage Procurement | Create and process procurement data |

### Notification Permissions

| ID | Name | Description |
|----|------|-------------|
| 19 | Receive Notification | Master permission to enable push notifications |

### Device Management Permissions

| ID | Name | Description |
|----|------|-------------|
| 20 | Manage Push Notification Devices | Manage active push notification devices |

### Loyalty Permissions

| ID | Name | Description |
|----|------|-------------|
| 25 | Manage Loyalty Program | Create and edit loyalty program settings and tiers |
| 26 | View Loyalty Accounts | View customer loyalty balances and history |
| 27 | Adjust Loyalty Points | Manually add or remove loyalty points |
| 28 | Manage Subscription Packages | Create, edit, and delete subscription packages |
| 29 | View Customer Subscriptions | View active customer subscriptions |
| 30 | Manage Customer Subscriptions | Subscribe, cancel, and manage customer subscriptions |

## API Endpoints

### Sync Permissions

Retrieve all permissions with pagination support.

**Endpoint:** `GET /permissions/sync`

**Authentication:** Required (JWT token)

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `skip` | Integer | No | 0 | Number of records to skip for pagination |
| `take` | Integer | No | 100 | Number of records to retrieve |
| `lastSyncTimestamp` | String | No | - | ISO timestamp for incremental sync |

**Response:**

```json
{
  "data": [
    {
      "id": 1,
      "name": "View Dashboard",
      "category": "Dashboard",
      "description": "View dashboard and analytics",
      "allowed_roles": "",
      "created_at": "2025-08-29T01:46:23.230Z",
      "updated_at": "2025-08-29T01:46:23.230Z",
      "is_deleted": false,
      "deleted_at": null,
      "version": 1
    }
  ],
  "total": 24,
  "serverTimestamp": "2025-11-06T14:16:00.000Z"
}
```

**Example Request:**

```bash
curl -X GET "https://api.example.com/permissions/sync?skip=0&take=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Permission Assignment

Permissions can be assigned to roles through the `allowed_roles` field, which contains a comma-separated list of role IDs. When a user is assigned a role, they inherit all permissions associated with that role.

## Usage in Code

To check if a user has a specific permission:

```typescript
// Example middleware for checking permissions
const requirePermission = (permissionName: string) => {
  return (req: NetworkRequest<any>, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new RequestValidateError('User not authenticated');
    }

    const hasPermission = req.user.permissions.some(
      (p: Permission) => p.name === permissionName
    );

    if (!hasPermission) {
      throw new RequestValidateError('Insufficient permissions');
    }

    next();
  };
};

// Usage in routes
router.post('/sales', requirePermission('Process Sales'), createSale);
```

## Best Practices

1. **Principle of Least Privilege**: Assign only the minimum permissions necessary for users to perform their tasks.

2. **Role-Based Access**: Group permissions into roles rather than assigning individual permissions to users.

3. **Regular Audits**: Periodically review permission assignments to ensure they remain appropriate.

4. **Notification Permissions**: The "Receive Notification" permission (ID 19) is a master permission required before specific notification types (sales, inventory) can be enabled.

5. **Soft Deletes**: Permissions use soft deletes (`is_deleted` flag) to maintain data integrity and audit trails.

## Related Files

- Controller: [src/permission/permission.controller.ts](src/permission/permission.controller.ts)
- Service: `src/permission/permission.service.ts`
- Database Schema: `prisma/schema.prisma`

## Migration Notes

### v1.4 - Customer Permission Granularization

The "Manage Customers" permission (ID 10) has been soft-deleted and replaced by three granular permissions:

| Old Permission | New Permissions |
|---------------|----------------|
| Manage Customers (ID 10) | Add Customer (ID 22), Edit Customer (ID 23), Delete Customer (ID 24) |

**Impact on Tenant Databases:**
- Existing `role_permission` records referencing permission ID 10 become inert (the permission is soft-deleted in the global DB).
- Roles that previously had "Manage Customers" will lose customer management access until the new granular permissions are assigned.
- Tenant administrators must update their role configurations to assign the new granular permissions (IDs 22, 23, 24) to roles that previously had "Manage Customers" (ID 10).

**Cleanup (Optional):**
Stale `role_permission` records with `PERMISSION_ID = 10` can be soft-deleted in tenant databases:

```sql
UPDATE role_permission
SET IS_DELETED = 1, DELETED_AT = NOW()
WHERE PERMISSION_ID = 10 AND IS_DELETED = 0;
```

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2025-08-29 | 1.0 | Initial permission system with 17 permissions |
| 2025-09-30 | 1.1 | Added notification permissions (IDs 18, 19) |
| 2025-11-01 | 1.2 | Added device management permission (ID 20) |
| 2025-11-05 | 1.3 | Added inventory notification permission (ID 21) |
| 2026-02-27 | 1.4 | Deprecated "Manage Customers" (ID 10); added granular customer permissions: Add Customer (ID 22), Edit Customer (ID 23), Delete Customer (ID 24) |
| 2026-03-02 | 1.5 | Added Loyalty permissions (IDs 25-30): Manage Loyalty Program, View Loyalty Accounts, Adjust Loyalty Points, Manage Subscription Packages, View Customer Subscriptions, Manage Customer Subscriptions |
