# Warehouse Management Feature

**Version:** 1.0
**Status:** Production Ready
**Last Updated:** January 27, 2025

---

## Overview

The warehouse management system allows tenants to manage inventory in dedicated warehouse locations, separate from retail outlets. This feature is available on the **Pro plan** and includes automatic billing for additional warehouses.

### Key Features

- Multi-warehouse inventory management
- Independent stock tracking per warehouse
- FIFO costing per warehouse
- Warehouse-sourced sales transactions
- Automatic billing integration
- First warehouse free, additional warehouses billed at 149,000 IDR/month

---

## Architecture

### Database Structure

**Global Database:**
- `tenant_warehouse` - Tracks all warehouses for billing
- `subscription_add_on` - Includes Add-on ID 3 ("Extra Warehouse")
- `tenant_subscription_add_on` - Tracks billable warehouse count per tenant

**Tenant Database:**
- `warehouse` - Operational warehouse details
- `warehouse_stock_balance` - Current stock levels per warehouse
- `warehouse_stock_receipt` - Stock intake records (FIFO tracking)
- `warehouse_stock_movement` - Audit trail for stock changes
- `sales` - Enhanced with `stockSourceType`, `stockSourceWarehouseId` fields

---

## Billing Model

### Pricing Structure

| Warehouses | Billable | Monthly Cost (IDR) |
|------------|----------|--------------------|
| 1          | 0        | 0                  |
| 2          | 1        | 149,000            |
| 3          | 2        | 298,000            |
| 5          | 4        | 596,000            |

### Billing Logic

```typescript
const totalWarehouses = count({ tenantId, isActive: true, deleted: false });
const billableWarehouses = Math.max(0, totalWarehouses - 1);
const monthlyCost = billableWarehouses * 149_000;
```

**Add-On Configuration:**
- Add-On ID: `3`
- Name: "Extra Warehouse"
- Price Per Unit: 149,000 IDR
- Scope: Tenant-level
- Quantity: Number of billable warehouses

### Automatic Billing Updates

The system automatically updates `tenant_subscription_add_on` when:
- Creating a warehouse (increases quantity)
- Deleting a warehouse (decreases quantity)
- Deleting the last billable warehouse (removes add-on record)

---

## Plan Migration Scenarios

### Basic to Pro Plan Upgrade

**What Happens:**
1. Customer upgrades to Pro plan
2. System automatically creates "Main Warehouse" (free)
3. Customer can immediately start using warehouse features
4. Outlet stock remains unchanged

**Customer Actions After Upgrade:**
- Can continue using outlet-based stock
- Can start adding stock to the new warehouse
- Can choose stock source during sales (outlet or warehouse)
- **Optional:** Request POS owner to migrate outlet stock to warehouse

**Migration Request Process:**
1. Customer contacts POS owner: "Please migrate my outlet stock to warehouse"
2. POS owner executes migration via admin endpoint
3. Stock transferred with preserved FIFO costs
4. Outlet stock zeroed out (history preserved)
5. Customer uses warehouse exclusively going forward

---

### Pro to Basic Plan Downgrade

**What Happens:**
1. Customer downgrades to Basic plan
2. **All warehouses are soft-deleted** (`deleted: true`, `isActive: false`)
3. Warehouse stock becomes inaccessible
4. Outlet-based stock remains functional
5. Billing for warehouses stops immediately

**Protection Mechanisms:**
- Warehouse data preserved (soft delete)
- Historical sales records maintained
- Stock movement audit trail intact
- **Reactivation possible** if customer upgrades again

**Customer Actions Before Downgrade:**
1. **Must transfer warehouse stock back to outlets** (contact POS owner)
2. Ensure all warehouse inventory accounted for
3. Verify outlet stock availability

**After Downgrade:**
- Can only use outlet-based stock
- Stock source selector shows outlets only
- Cannot create new warehouses
- Historical warehouse sales remain visible (read-only)

**Reactivation (Upgrade Again):**
- Warehouses can be reactivated by POS owner
- Stock balances preserved during soft-delete period
- Billing resumes based on active warehouse count

---

## Management Workflow

### POS Owner-Managed Operations

All warehouse CRUD operations are managed by the **POS owner**, not customers.

**Customer Workflow:**
1. Customer contacts POS owner (phone/WhatsApp)
2. Requests warehouse creation/deletion
3. POS owner executes via admin dashboard
4. System handles billing automatically
5. POS owner confirms action to customer

**Similar to:**
- Device quota management (`addDeviceQuotaForTenant`)
- User management
- Subscription management

---

## API Endpoints

### Admin Endpoints (POS Owner Only)

**Warehouse Management:**

```http
POST   /admin/tenants/:tenantId/warehouses
DELETE /admin/tenants/:tenantId/warehouses/:id
GET    /admin/tenants/:tenantId/warehouses
```

**Stock Migration:**

```http
POST   /admin/tenants/:tenantId/migrate-outlet-to-warehouse
```

#### Create Warehouse

```http
POST /admin/tenants/:tenantId/warehouses
Content-Type: application/json

{
  "warehouseName": "Central Warehouse",
  "address": "Jl. Raya No. 45, Jakarta",
  "street": "Jl. Raya No. 45",
  "city": "Jakarta",
  "state": "DKI Jakarta",
  "postalCode": "12345",
  "country": "Indonesia",
  "contactPhone": "+62812345678",
  "contactEmail": "warehouse@example.com"
}
```

**Response:**

```json
{
  "success": true,
  "message": "First warehouse created successfully (FREE)",
  "warehouse": {
    "id": 1,
    "warehouseName": "Central Warehouse",
    "warehouseCode": "CENTRAL_WAREHOUSE",
    "globalWarehouseId": 1
  },
  "billing": {
    "totalWarehouses": 1,
    "billableWarehouses": 0,
    "monthlyCost": 0,
    "isFreeWarehouse": true
  }
}
```

#### Delete Warehouse

```http
DELETE /admin/tenants/:tenantId/warehouses/:id
```

**Response:**

```json
{
  "success": true,
  "message": "2 warehouse(s) remaining. Billable: 1",
  "billing": {
    "remainingWarehouses": 2,
    "billableWarehouses": 1,
    "monthlyCost": 149000
  }
}
```

**Error (if warehouse has stock):**

```json
{
  "success": false,
  "error": "Cannot delete warehouse with active stock. Please transfer or clear stock first."
}
```

#### Migrate Outlet Stock to Warehouse

```http
POST /admin/tenants/:tenantId/migrate-outlet-to-warehouse
Content-Type: application/json

{
  "sourceOutletId": 1,
  "targetWarehouseId": 1,
  "deleteSourceAfterMigration": false,
  "migrationReason": "Upgraded to Pro plan - Centralized inventory"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Successfully migrated 150 items from outlet to warehouse",
  "migration": {
    "sourceOutlet": {
      "id": 1,
      "name": "Outlet A"
    },
    "targetWarehouse": {
      "id": 1,
      "name": "Central Warehouse"
    },
    "migratedItems": 150,
    "totalQuantityMigrated": 5420,
    "totalValue": 125000000,
    "migrationDate": "2025-01-27T10:30:00Z",
    "items": [
      {
        "itemCode": "PROD-001",
        "itemName": "Product A",
        "quantityMigrated": 50,
        "receiptsCount": 5,
        "totalCost": 2500000
      }
    ]
  }
}
```

---

### Customer Endpoints

**Warehouse Access (Read-Only):**

```http
GET    /warehouses/sync
GET    /warehouses/:id
GET    /warehouses/:id/stock
```

#### List Warehouses (Delta Sync)

```http
GET /warehouses/sync?lastSyncVersion=0
```

**Response:**

```json
{
  "success": true,
  "warehouses": [
    {
      "id": 1,
      "warehouseName": "Central Warehouse",
      "warehouseCode": "CENTRAL_WAREHOUSE",
      "street": "Jl. Raya No. 45",
      "city": "Jakarta",
      "contactPhone": "+62812345678",
      "version": 1
    }
  ],
  "latestVersion": 1
}
```

#### Get Warehouse Stock

```http
GET /warehouses/:id/stock?itemId=123
```

**Response:**

```json
{
  "success": true,
  "stock": [
    {
      "itemId": 123,
      "itemCode": "PROD-001",
      "itemName": "Product A",
      "availableQuantity": 150.00,
      "onHandQuantity": 150.00,
      "reorderThreshold": 20.00
    }
  ]
}
```

#### Create Sale with Warehouse Stock

```http
POST /sales
Content-Type: application/json

{
  "outletId": 1,
  "stockSourceType": "WAREHOUSE",
  "stockSourceWarehouseId": 1,
  "items": [
    {
      "itemId": 123,
      "quantity": 5,
      "price": 50000
    }
  ]
}
```

**Stock Source Options:**
- `stockSourceType: "OUTLET"` + `stockSourceOutletId` - Deduct from outlet
- `stockSourceType: "WAREHOUSE"` + `stockSourceWarehouseId` - Deduct from warehouse

---

## Automatic Warehouse Creation

### Pro Plan Tenants

When creating a new tenant with a **Pro plan**, the system automatically:

1. Creates `TenantWarehouse` in global database:
   - `warehouseName`: "Main Warehouse"
   - `warehouseCode`: "MAIN_WAREHOUSE"
   - `isActive`: true

2. Creates `Warehouse` in tenant database (linked to global)

3. **No billing add-on created** (first warehouse is free)

4. Returns warehouse info in tenant creation response:

```json
{
  "subscription": { "planName": "Pro" },
  "tenant": { "id": 1, "tenantName": "My Store" },
  "tenantUser": { "id": 1, "globalTenantId": 1 },
  "warehouse": {
    "id": 1,
    "warehouseName": "Main Warehouse",
    "warehouseCode": "MAIN_WAREHOUSE",
    "globalWarehouseId": 1
  }
}
```

### Basic Plan Tenants

- **No automatic warehouse creation**
- `warehouse: undefined` in response
- Can upgrade to Pro later to enable warehouses

---

## Stock Operations

### Adding Stock to Warehouse

**Endpoint:** `POST /stock-receipts`

```json
{
  "warehouseId": 1,
  "items": [
    {
      "itemId": 123,
      "quantity": 100,
      "cost": 25000
    }
  ]
}
```

**System Actions:**
1. Creates `WarehouseStockReceipt` (FIFO tracking)
2. Updates `WarehouseStockBalance`
3. Creates `WarehouseStockMovement` (audit trail)

### Creating Sale from Warehouse

**Sale Record:**

```typescript
{
  outletId: 1,                    // Where sale happened
  stockSourceType: "WAREHOUSE",   // Stock source
  stockSourceWarehouseId: 1       // Which warehouse
}
```

**System Actions:**
1. Validates warehouse stock availability
2. Deducts from `WarehouseStockBalance`
3. Updates FIFO `WarehouseStockReceipt` quantities
4. Creates `WarehouseStockMovement` for audit

---

## Data Integrity

### Tenant-Scoped Uniqueness

**Warehouse codes are unique per tenant**, not globally:

```prisma
// Global DB
@@unique([tenantId, warehouseCode])

// Tenant DB
// No unique constraint (allows flexibility)
```

**Result:** Multiple tenants can use "CENTRAL_WAREHOUSE" code.

### Soft Delete Protection

All deletions are soft deletes:
- `deleted: true`
- `deletedAt: DateTime`
- Data preserved for audit and potential recovery

**Cannot delete warehouse if:**
- `availableQuantity > 0` for any item
- Error message prompts to clear stock first

---

## Migration Preservation

### FIFO Cost Preservation

During outlet-to-warehouse migration:
- Original `receiptDate` preserved
- Original `cost` per receipt preserved
- FIFO order maintained
- Total stock value remains identical

**Example:**

```
Outlet Receipt (2024-12-01): 50 units @ 20,000 IDR
Outlet Receipt (2025-01-15): 30 units @ 25,000 IDR

After Migration:
Warehouse Receipt (2024-12-01): 50 units @ 20,000 IDR
Warehouse Receipt (2025-01-15): 30 units @ 25,000 IDR
```

### Audit Trail

All stock movements tracked:
- `WarehouseStockMovement.movementType: "MIGRATION"`
- `reason`: "Stock migrated from Outlet A"
- `documentId`: Source outlet ID
- `performedBy`: "SYSTEM_ADMIN"

---

## Business Rules

### Warehouse Creation

- First warehouse: **FREE** (no add-on created)
- Second+ warehouse: **149,000 IDR/month each**
- Warehouse code auto-generated: `WAREHOUSE_NAME.toUpperCase().replace(/\s+/g, '_')`
- Tenant-scoped uniqueness

### Warehouse Deletion

**Validations:**
1. Cannot delete if `availableQuantity > 0`
2. Must be initiated by POS owner
3. Soft delete (data preserved)
4. Billing immediately updated

**After deletion:**
- Warehouse disappears from customer stock source selector
- Historical sales remain visible
- Add-on quantity decreases
- If only free warehouse remains: add-on record deleted

### Stock Source Selection

**Priority order:**
1. Explicit request (`stockSourceType` in request body)
2. Setting-based default
3. Fallback to outlet stock

**Filtering:**
- Inactive warehouses excluded
- Deleted warehouses excluded
- Products with 0 stock excluded

---

## Edge Cases

### Concurrent Warehouse Creation

**Protected by database transactions:**
- Atomic warehouse creation
- Atomic add-on quantity updates
- No race conditions on billing

### Subscription Expiration

**If subscription expires:**
- Warehouses remain in database
- API access blocked
- Data preserved

**On reactivation:**
- All warehouses immediately accessible
- Add-on billing recalculated based on active count

### Deleting Free Warehouse

**Scenario:** Tenant has 3 warehouses, deletes the 1st (free one)

**Result:**
- Total warehouses: 3 → 2
- Billable count: 2 - 1 = 1
- One of the remaining warehouses becomes the "free" one
- Cost: 298,000 → 149,000 IDR

**Logic is count-based**, not flag-based (simpler, fewer edge cases).

---

## Testing Checklist

### Schema & Database

- [ ] Global DB has `tenant_warehouse` table
- [ ] Tenant DBs have 4 warehouse tables
- [ ] Sales table has stock source columns

### Warehouse Creation

- [ ] Pro plan auto-creates "Main Warehouse"
- [ ] Basic plan does NOT create warehouse
- [ ] First warehouse is FREE (no add-on)
- [ ] Second warehouse bills 100k IDR

### Warehouse Deletion

- [ ] Cannot delete with active stock
- [ ] Soft delete preserves data
- [ ] Billing updates correctly
- [ ] Last billable warehouse removes add-on

### Stock Operations

- [ ] Add stock to warehouse works
- [ ] Create sale from warehouse deducts stock
- [ ] FIFO costing calculated correctly
- [ ] Audit trail created

### Plan Migration

- [ ] Basic → Pro creates warehouse
- [ ] Pro → Basic soft-deletes warehouses
- [ ] Stock migration preserves FIFO costs
- [ ] Reactivation restores access

---

## Common Workflows

### Workflow 1: New Pro Customer

1. Tenant created with Pro plan
2. "Main Warehouse" auto-created (free)
3. Customer adds stock to warehouse
4. Customer creates sales from warehouse
5. **Cost:** Base plan only (no warehouse charges)

### Workflow 2: Customer Needs Second Warehouse

1. Customer contacts POS owner
2. POS owner: `POST /admin/tenants/5/warehouses`
3. System creates warehouse + updates billing
4. Customer sees new warehouse in system
5. **Cost:** Base plan + 149,000 IDR

### Workflow 3: Basic → Pro Upgrade

1. Customer upgrades subscription to Pro
2. "Main Warehouse" auto-created
3. Customer has both outlet + warehouse stock options
4. Customer requests outlet stock migration
5. POS owner: `POST /admin/tenants/5/migrate-outlet-to-warehouse`
6. Stock transferred with FIFO preservation
7. **Cost:** Pro plan (no warehouse charges for first one)

### Workflow 4: Pro → Basic Downgrade

1. Customer requests downgrade to Basic
2. **Before downgrade:** POS owner migrates warehouse stock back to outlets
3. Subscription downgraded
4. All warehouses soft-deleted
5. Customer uses outlet stock only
6. **Cost:** Basic plan (no warehouse charges)

### Workflow 5: Warehouse Deletion

1. Customer requests warehouse removal
2. Customer clears all stock from warehouse
3. POS owner: `DELETE /admin/tenants/5/warehouses/3`
4. System validates no stock remaining
5. Soft deletes warehouse + updates billing
6. **Cost reduced by:** 149,000 IDR/month

---

## Technical Details

### Database Transactions

All warehouse operations use nested transactions:

```typescript
await globalPrisma.$transaction(async (globalTx) => {
  await tenantPrisma.$transaction(async (tenantTx) => {
    // Create in both DBs atomically
  });
});
```

**Ensures:**
- Global and tenant DBs stay in sync
- Billing updates are atomic
- Rollback on any error

### Add-On Model

Follows existing pattern for users (ID 1) and devices (ID 2):

```sql
-- subscription_add_on (predefined)
ID | NAME              | PRICE_PER_UNIT
1  | Extra User        | 50000
2  | Extra Device      | 19000
3  | Extra Warehouse   | 149000

-- tenant_subscription_add_on (usage tracking)
TENANT_SUBSCRIPTION_ID | ADD_ON_ID | QUANTITY
1                      | 1         | 3        (3 extra users)
1                      | 2         | 5        (5 extra devices)
1                      | 3         | 2        (2 extra warehouses)
```

**Billing calculation:**

```typescript
const totalCost = basePlanCost + addOns.reduce((sum, addOn) =>
  sum + (addOn.pricePerUnit * addOn.quantity), 0
);
```

---

## File Locations

### Schemas
- `prisma/global-client/schema.prisma`
- `prisma/client/schema.prisma`

### Backend Services
- `src/warehouse/warehouse.service.ts` - Customer-facing operations
- `src/warehouse/warehouse.controller.ts` - Customer API endpoints
- `src/admin/admin.service.ts` - Admin warehouse operations
- `src/admin/admin.controller.ts` - Admin API endpoints

### Routing
- `src/index.ts` - Warehouse route registration

---

## Support & Troubleshooting

### Common Issues

**"Cannot delete warehouse"**
- Check for active stock: `SELECT * FROM warehouse_stock_balance WHERE warehouseId = X AND availableQuantity > 0`
- Solution: Transfer or clear stock first

**"Warehouse not appearing in stock source"**
- Check `deleted: false` and `isActive: true`
- Check tenant subscription is active
- Verify customer has Pro plan

**"Billing not updating"**
- Check `tenant_subscription_add_on` record exists
- Verify `quantity` matches billable warehouse count
- Check primary subscription is active

**"Stock migration failed"**
- Check outlet has stock to migrate
- Verify target warehouse exists
- Ensure tenant database connection is healthy

---

## Version History

| Version | Date       | Changes                                      |
|---------|------------|----------------------------------------------|
| 1.0     | 2025-01-27 | Initial release - Core warehouse functionality |

---

**End of Documentation**
