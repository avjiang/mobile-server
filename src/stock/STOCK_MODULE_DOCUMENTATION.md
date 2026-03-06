# Stock Module - Backend Documentation

**Version:** 1.1
**Last Updated:** 2026-03-06
**Author:** Backend Team

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Core Services](#core-services)
6. [Variant Support](#variant-support)
7. [FIFO Cost Tracking](#fifo-cost-tracking)
8. [Delta Sync](#delta-sync)
9. [Error Handling](#error-handling)
10. [Related Modules](#related-modules)

---

## Overview

The Stock module manages inventory tracking across outlets and warehouses. It provides:

- **Stock Balance** - Current quantity tracking per item/outlet
- **Stock Movement** - Audit trail of all stock changes
- **Stock Receipt** - FIFO cost tracking for inventory valuation
- **Variant Support** - Track stock at variant level for items with variants

### Key Features

| Feature               | Description                                 |
| --------------------- | ------------------------------------------- |
| Multi-outlet          | Stock tracked separately per outlet         |
| Variant Support       | Items with variants track stock per variant |
| FIFO Costing          | First-in-first-out cost calculation         |
| Optimistic Locking    | Version-based concurrency control           |
| Delta Sync            | Efficient data synchronization              |
| Audit Trail           | Complete history via StockMovement          |
| Consumption Deduction | Volume/weight-based stock deduction for services |

---

## Architecture

### Module Structure

```
src/stock/
├── stock-balance/
│   ├── stock-balance.controller.ts   # HTTP routes
│   ├── stock-balance.service.ts      # Business logic
│   └── stock-balance.request.ts      # Request types
├── stock-movement/
│   ├── stock-movement.controller.ts  # HTTP routes
│   ├── stock-movement.service.ts     # Business logic
│   └── stock-movement.request.ts     # Request types
├── stock-receipt/
│   ├── stock-receipt.controller.ts   # HTTP routes
│   ├── stock-receipt.service.ts      # Business logic
│   └── stock-receipt.request.ts      # Request types
├── STOCK_MODULE_DOCUMENTATION.md     # This file
└── VARIANT_STOCK_API_GUIDE.md        # Frontend API guide
```

### Route Registration

```typescript
// src/index.ts
app.use("/stock", require("./stock/stock-balance/stock-balance.controller"));
app.use(
  "/stockMovement",
  require("./stock/stock-movement/stock-movement.controller")
);
app.use(
  "/stockReceipt",
  require("./stock/stock-receipt/stock-receipt.controller")
);
app.use("/warehouses", require("./warehouse/warehouse.controller"));
```

---

## Database Schema

### StockBalance

Current stock levels per item/outlet/variant.

```prisma
model StockBalance {
  id                Int          @id @default(autoincrement())
  itemId            Int          // FK to Item
  outletId          Int          // FK to Outlet
  itemVariantId     Int?         // FK to ItemVariant (null = base item)
  availableQuantity Decimal      @db.Decimal(15, 4)
  onHandQuantity    Decimal      @db.Decimal(15, 4)
  reorderThreshold  Decimal?     @db.Decimal(15, 4)
  lastRestockDate   DateTime?
  version           Int?         @default(1)  // Optimistic locking
  deleted           Boolean      @default(false)

  // Relations
  item              Item
  outlet            Outlet
  itemVariant       ItemVariant?
}
```

**Composite Key:** `itemId + outletId + itemVariantId`

### StockReceipt

FIFO cost tracking - each receipt represents a batch of stock with a specific cost.

```prisma
model StockReceipt {
  id              Int            @id @default(autoincrement())
  itemId          Int            // FK to Item
  outletId        Int            // FK to Outlet
  itemVariantId   Int?           // FK to ItemVariant
  deliveryOrderId Int?           // FK to DeliveryOrder (optional)
  quantity        Decimal        @db.Decimal(15, 4)
  cost            Decimal        @db.Decimal(15, 4)  // Cost per unit
  receiptDate     DateTime       @default(now())
  version         Int?           @default(1)
  deleted         Boolean        @default(false)

  // Relations
  item            Item
  outlet          Outlet
  itemVariant     ItemVariant?
  deliveryOrder   DeliveryOrder?
}
```

### StockMovement

Audit trail for all stock changes.

```prisma
model StockMovement {
  id                        Int          @id @default(autoincrement())
  itemId                    Int          // FK to Item
  outletId                  Int          // FK to Outlet
  itemVariantId             Int?         // FK to ItemVariant
  previousAvailableQuantity Decimal      @db.Decimal(15, 4)
  previousOnHandQuantity    Decimal      @db.Decimal(15, 4)
  availableQuantityDelta    Decimal      @db.Decimal(15, 4)
  onHandQuantityDelta       Decimal      @db.Decimal(15, 4)
  movementType              String       // "Stock Adjustment", "Sales", etc.
  documentId                Int          // Reference to source document
  reason                    String
  remark                    String       @default("")
  performedBy               String?      @default("")
  version                   Int?         @default(1)
  deleted                   Boolean      @default(false)

  // Relations
  item                      Item
  outlet                    Outlet
  itemVariant               ItemVariant?
}
```

### StockSnapshot

Point-in-time stock snapshots (for reporting).

```prisma
model StockSnapshot {
  id                Int          @id @default(autoincrement())
  itemId            Int
  outletId          Int
  itemVariantId     Int?
  availableQuantity Decimal      @db.Decimal(15, 4)
  onHandQuantity    Decimal      @db.Decimal(15, 4)
  version           Int?         @default(1)
  deleted           Boolean      @default(false)
}
```

---

## API Endpoints

### Stock Balance Endpoints

| Method | Endpoint            | Description                         |
| ------ | ------------------- | ----------------------------------- |
| GET    | `/stock/sync`       | Get all stock balances (delta sync) |
| GET    | `/stock/find`       | Get stock by item ID                |
| PUT    | `/stock/adjustment` | Adjust stock quantity               |
| POST   | `/stock/clear`      | Clear stock to zero                 |
| PUT    | `/stock/update`     | Batch update stocks                 |

### Stock Movement Endpoints

| Method | Endpoint                | Description                  |
| ------ | ----------------------- | ---------------------------- |
| GET    | `/stockMovement/`       | Get all stock movements      |
| GET    | `/stockMovement/find`   | Get movements by item/outlet |
| PUT    | `/stockMovement/update` | Update movements             |

### Stock Receipt Endpoints

| Method | Endpoint               | Description          |
| ------ | ---------------------- | -------------------- |
| GET    | `/stockReceipt/find`   | Get receipts by item |
| PUT    | `/stockReceipt/update` | Update receipts      |

### Warehouse Stock Endpoints

| Method | Endpoint                | Description         |
| ------ | ----------------------- | ------------------- |
| GET    | `/warehouses/sync`      | Get all warehouses  |
| GET    | `/warehouses/:id`       | Get warehouse by ID |
| GET    | `/warehouses/:id/stock` | Get warehouse stock |

---

## Core Services

### stock-balance.service.ts

#### `getAllStock(databaseName, syncRequest)`

Get all stock balances with delta sync support.

**Parameters:**

- `lastSyncTimestamp` - ISO timestamp for delta sync
- `lastVersion` - Version number for version-based sync
- `skip` / `take` - Pagination

**Returns:** Nested structure with variants under parent items.

**Key Logic:**

```typescript
// Groups variant stocks under parent items
const stockMap = new Map<string, any>();
for (const stock of stocks) {
  const key = `${stock.itemId}-${stock.outletId}`;
  if (stock.itemVariantId === null) {
    // Base item stock
    stockMap.set(key, {
      ...stockData,
      variants: item?.hasVariants ? [] : null,
    });
  } else {
    // Variant stock - add to parent's variants array
    parent.variants.push({ ...stockData, variantSku, variantName });
  }
}
```

#### `getStockByItemId(databaseName, itemId, itemVariantId?)`

Get stock balance for a specific item, optionally filtered by variant.

**Query String Parsing:**

- `undefined` - Don't filter by variant (return first match)
- `null` - Filter for base item only (`itemVariantId = null`)
- `number` - Filter for specific variant

#### `stockAdjustment(databaseName, stockAdjustments[])`

Adjust stock quantities with full validation and FIFO tracking.

**Flow:**

1. Validate input (adjustQuantity XOR overrideQuantity)
2. Validate variant requirements
3. Batch fetch stock balances
4. Check version (optimistic locking)
5. Batch fetch stock receipts
6. Process adjustments (FIFO deduction for negative)
7. Create stock movements
8. Update stock balances
9. Touch parent stock for delta sync (variant support)

**Variant Validation:**

```typescript
// hasVariants=true requires itemVariantId
if (item.hasVariants && !adjustment.itemVariantId) {
  throw new RequestValidateError(
    `Item "${item.itemName}" has variants. You must specify itemVariantId.`
  );
}
// hasVariants=false rejects itemVariantId
if (!item.hasVariants && adjustment.itemVariantId) {
  throw new RequestValidateError(
    `Item "${item.itemName}" does not have variants. Remove itemVariantId.`
  );
}
```

#### `clearStock(databaseName, stockClearance)`

Clear stock to zero with same variant validation.

---

## Variant Support

### Key Concepts

1. **Items without variants** (`hasVariants=false`)

   - Stock tracked at item level
   - `itemVariantId = null` in all stock tables

2. **Items with variants** (`hasVariants=true`)
   - Stock tracked at variant level
   - Each variant has separate stock balance
   - Base item stock (`itemVariantId = null`) typically has zero quantity

### Variant Stock Auto-Creation

When variants are created via Item API (`createMany()` or `update()`), the following are automatically created:

| Record | Created? | Details |
|--------|----------|---------|
| StockBalance | YES | quantity = 0, outlet 1 |
| StockMovement | YES | `movementType: "Create Variant"`, delta = 0 |
| StockReceipt | NO | Created when stock is added via adjustment/delivery |

**Implementation:** Uses batch operations for optimal performance (2 SQL queries regardless of variant count).

**Location:** Helper function `createVariantStockRecords()` in [item.service.ts](../item/item.service.ts)

### Composite Key Pattern

All stock lookups use a composite key:

```typescript
const key = `${itemId}-${itemVariantId || "null"}-${outletId}`;
```

### Nested Response Structure

GET endpoints return variants nested under parent items:

```json
{
  "data": [
    {
      "id": 1,
      "itemId": 100,
      "outletId": 1,
      "availableQuantity": "50.0000",
      "itemVariantId": null,
      "variants": null // null = no variants
    },
    {
      "id": 2,
      "itemId": 200,
      "outletId": 1,
      "availableQuantity": "0.0000",
      "itemVariantId": null,
      "variants": [
        // array = has variants
        {
          "itemVariantId": 1000,
          "variantSku": "SKU-RED",
          "variantName": "Red",
          "availableQuantity": "25.0000"
        }
      ]
    }
  ]
}
```

### Delta Sync for Variants

When variant stock changes, the parent stock's `updatedAt` is touched:

```typescript
// Touch parent stock for delta sync
if (adjustment.itemVariantId) {
  await tx.stockBalance.updateMany({
    where: {
      itemId: adjustment.itemId,
      outletId: adjustment.outletId,
      itemVariantId: null,
      deleted: false,
    },
    data: { updatedAt: new Date() },
  });
}
```

This ensures delta sync returns the parent with all variants.

---

## FIFO Cost Tracking

### How It Works

1. **Stock Increase** (positive adjustment)

   - Creates new `StockReceipt` with quantity and cost
   - Multiple receipts for same item = different cost batches

2. **Stock Decrease** (negative adjustment)

   - Deducts from oldest receipts first (FIFO)
   - Updates/deletes receipts as quantity is consumed

3. **Stock Override**
   - Marks all existing receipts as deleted
   - Creates single new receipt with override quantity

### FIFO Deduction Logic

```typescript
// For negative adjustments
let remainingReduction = deltaQuantity.abs();
for (const receipt of receipts) {
  // Ordered by receiptDate ASC
  if (remainingReduction.lessThanOrEqualTo(0)) break;

  const reduction = Decimal.min(receipt.quantity, remainingReduction);
  const newQuantity = receipt.quantity.sub(reduction);

  // Update receipt
  receiptUpdates.push({
    id: receipt.id,
    quantity: newQuantity,
    deleted: newQuantity.equals(0),
  });

  remainingReduction = remainingReduction.sub(reduction);
}

if (remainingReduction.greaterThan(0)) {
  throw new RequestValidateError("Insufficient StockReceipt quantity");
}
```

### Cost Calculation

When deducting stock (e.g., for sales), calculate weighted average cost:

```typescript
// Example: Calculate FIFO cost for quantity sold
function calculateFifoCost(
  receipts: StockReceipt[],
  quantityToSell: Decimal
): Decimal {
  let remaining = quantityToSell;
  let totalCost = new Decimal(0);

  for (const receipt of receipts) {
    const used = Decimal.min(receipt.quantity, remaining);
    totalCost = totalCost.add(used.mul(receipt.cost));
    remaining = remaining.sub(used);
    if (remaining.lessThanOrEqualTo(0)) break;
  }

  return totalCost;
}
```

---

## Delta Sync

### Mechanism

Delta sync allows clients to fetch only changed records since last sync.

**Query Parameters:**

- `lastSyncTimestamp` - ISO timestamp of last sync
- `lastVersion` - Version number for version-based sync (alternative)
- `skip` / `take` - Pagination

**Response:**

```json
{
  "data": [...],
  "total": 50,
  "serverTimestamp": "2025-12-18T10:30:00.000Z"
}
```

### Implementation

```typescript
const where = lastVersion
  ? { version: { gt: lastVersion } }
  : {
      OR: [
        { createdAt: { gte: lastSync } },
        { updatedAt: { gte: lastSync } },
        { deletedAt: { gte: lastSync } },
      ],
    };
```

### Variant Delta Sync

When variant stock changes, parent stock is touched to ensure:

1. Parent appears in delta sync results
2. All variants are returned with parent (nested structure)

---

## Error Handling

### Custom Error Classes

| Error                  | HTTP Status | Description                |
| ---------------------- | ----------- | -------------------------- |
| `RequestValidateError` | 400         | Validation failure         |
| `NotFoundError`        | 404         | Resource not found         |
| `VersionMismatchError` | 409         | Optimistic locking failure |

### Common Error Scenarios

**Missing Variant ID:**

```json
{
  "error": {
    "name": "RequestValidateError",
    "message": "Item \"Samsung Galaxy S24\" has variants. You must specify itemVariantId to adjust variant stock."
  }
}
```

**Invalid Variant ID:**

```json
{
  "error": {
    "name": "RequestValidateError",
    "message": "Item \"Simple Product\" does not have variants. Remove itemVariantId from request."
  }
}
```

**Stock Not Found:**

```json
{
  "error": {
    "name": "NotFoundError",
    "message": "Stock not found for itemId 200 and variantId 1000 and outletId 1"
  }
}
```

**Version Mismatch:**

```json
{
  "error": {
    "name": "VersionMismatchError",
    "message": "Version mismatches detected for 1 item(s)",
    "details": [{ "itemId": 100, "expectedVersion": 5, "foundVersion": 6 }]
  }
}
```

---

## Related Modules

### Sales Module

Sales automatically deduct stock:

```typescript
// sales.service.ts - completeNewSales()
// Creates StockMovement with type "Sales"
// Deducts from StockReceipts (FIFO)
// Updates StockBalance
```

**Stock Deduction Formula:**

```
if salesItem.stockConsumptionQty IS NOT NULL:
    stock -= salesItem.quantity * salesItem.stockConsumptionQty
else:
    stock -= salesItem.quantity    // standard piece-based behavior
```

This supports consumption-based items (e.g., detergent tracked in milliliters) where the stock deduction differs from the order quantity. See [docs/STOCK_CONSUMPTION_QTY.md](../../docs/STOCK_CONSUMPTION_QTY.md) for full details.

**Movement Types from Sales:**

- `Sales` - Stock deducted
- `Sales Void` - Stock restored (voided sale)
- `Sales Return` - Stock restored (returned items)
- `Sales Refund` - Stock restored (refunded items)

### Warehouse Module

Separate stock tracking for warehouses:

```typescript
// warehouse.service.ts
getWarehouseStock(databaseName, warehouseId, skip, take);
```

Uses `WarehouseStockBalance` table (similar structure to `StockBalance`).

### Item Module

Items define whether variant tracking is needed:

```typescript
interface Item {
  id: number;
  hasVariants: boolean; // Determines stock tracking level
  // ...
}
```

### Delivery Order Module

Delivery orders create stock receipts and update stock balances with full variant support:

```typescript
// delivery-order.service.ts - updateStockBalancesAndMovements()
// Creates StockMovement with type "Delivery Receipt"
// Creates StockReceipt with cost per unit
// Updates StockBalance (or creates if not exists)
// Uses composite key for variant support: itemId-itemVariantId
```

**Movement Types from Delivery Orders:**

- `Delivery Receipt` - Stock added from confirmed delivery
- `Delivery Cancellation` - Stock reversed from cancelled delivery

**Variant Support:**

| Record | itemVariantId | Description |
|--------|:-------------:|-------------|
| StockBalance | ✅ | Query and create with variant ID |
| StockMovement | ✅ | Records variant ID in audit trail |
| StockReceipt | ✅ | Tracks FIFO cost per variant |

**Composite Key Pattern:**
```typescript
// Variant-aware stock lookup
const balanceKey = `${item.itemId}-${item.itemVariantId || 'null'}`;
const stockBalance = stockBalanceMap.get(balanceKey);
```

---

## Movement Types

| Type                    | Description                      | Stock Change |
| ----------------------- | -------------------------------- | ------------ |
| `Create Item`           | Base item created                | +/-          |
| `Create Variant`        | Variant created                  | 0            |
| `Stock Adjustment`      | Manual adjustment                | +/-          |
| `Stock Clearance`       | Clear to zero                    | -            |
| `Sales`                 | Sale completed                   | -            |
| `Sales Void`            | Sale voided                      | +            |
| `Sales Return`          | Items returned                   | +            |
| `Sales Refund`          | Sale refunded                    | +            |
| `Delivery Receipt`      | Delivery order confirmed         | +            |
| `Delivery Cancellation` | Delivery order cancelled         | -            |

---

## Best Practices

### 1. Always Include Version

```typescript
// Stock adjustments require version for optimistic locking
{
  itemId: 100,
  outletId: 1,
  adjustQuantity: 10,
  version: 5  // Required
}
```

### 2. Handle Version Mismatch

```typescript
try {
  await stockAdjustment(...)
} catch (error) {
  if (error instanceof VersionMismatchError) {
    // Refresh stock data and retry
    const freshStock = await getStockByItemId(...);
    // Retry with fresh version
  }
}
```

### 3. Variant ID for Variant Items

```typescript
// Always check hasVariants before adjustment
if (item.hasVariants) {
  adjustment.itemVariantId = selectedVariant.id;
}
```

### 4. Use Transactions

All stock operations use Prisma transactions:

```typescript
await tenantPrisma.$transaction(async (tx) => {
  // All operations in same transaction
  // Rollback on any failure
});
```

---

## Testing Checklist

- [ ] Stock sync returns nested variants
- [ ] Adjust stock without variant (non-variant item)
- [ ] Adjust stock with variant (variant item)
- [ ] Clear stock for variant
- [ ] FIFO deduction works correctly
- [ ] Version mismatch throws error
- [ ] Delta sync returns changed items
- [ ] Delta sync returns parent when variant changes
- [ ] Validation errors for missing variant ID
- [ ] Validation errors for invalid variant ID
- [ ] Consumption-based sale deducts by quantity * stockConsumptionQty
- [ ] Void/return/refund of consumption sale restores correct amount
- [ ] Duplicate itemId entries (different stockConsumptionQty) validate and deduct correctly

---

## See Also

- [VARIANT_STOCK_API_GUIDE.md](./VARIANT_STOCK_API_GUIDE.md) - Frontend integration guide
- [PRODUCT_VARIANT_COMPLETE_GUIDE.md](../item/PRODUCT_VARIANT_COMPLETE_GUIDE.md) - Variant feature documentation
- [VARIANT_API_GUIDE.md](../item/VARIANT_API_GUIDE.md) - Item/Variant CRUD operations
- [STOCK_CONSUMPTION_QTY.md](../../docs/STOCK_CONSUMPTION_QTY.md) - Consumption-based stock deduction API contract

---

**Questions?** Contact the backend team.
