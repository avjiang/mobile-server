# Item Creation: Stock & Cost — API Contract for Flutter Team

**Date:** 2026-03-10

---

## Overview

`POST /item/create` now fully supports setting **initial stock and cost** for both simple items and variant items in a single request. No separate stock adjustment call is needed.

---

## Simple Items (no variants)

Send `stockQuantity` and `cost` on the item:

```json
{
  "items": [
    {
      "itemName": "Widget A",
      "itemCode": "WA-001",
      "price": 25000,
      "cost": 10000,
      "stockQuantity": 50,
      "trackStock": true,
      "categoryId": 1,
      "supplierId": 1
    }
  ]
}
```

**What the backend creates:**

| Record | Condition | Values |
|---|---|---|
| Item | Always | `cost = 10000` |
| StockBalance | `trackStock == true` | `availableQuantity = 50`, `onHandQuantity = 50` |
| StockMovement | `trackStock == true` | `delta = 50`, `movementType = "Create Item"` |
| StockReceipt | `trackStock == true AND cost > 0 AND stockQuantity > 0` | `quantity = 50`, `cost = 10000` (FIFO) |

---

## Variant Items (NEW)

Send `stockQuantity` and `cost` on **each variant**. The base item's `stockQuantity` is automatically forced to 0 when variants are present.

```json
{
  "items": [
    {
      "itemName": "T-Shirt",
      "itemCode": "TS-001",
      "price": 50000,
      "cost": 0,
      "stockQuantity": 0,
      "trackStock": true,
      "categoryId": 1,
      "supplierId": 1,
      "variants": [
        {
          "variantSku": "TS-001-RED-M",
          "variantName": "Red / M",
          "cost": 20000,
          "price": 50000,
          "stockQuantity": 30,
          "barcode": null,
          "image": null,
          "weight": null,
          "length": null,
          "width": null,
          "height": null,
          "attributes": [
            { "definitionKey": "Color", "value": "Red" },
            { "definitionKey": "Size", "value": "M" }
          ]
        },
        {
          "variantSku": "TS-001-BLUE-L",
          "variantName": "Blue / L",
          "cost": 20000,
          "price": 55000,
          "stockQuantity": 15,
          "barcode": null,
          "image": null,
          "weight": null,
          "length": null,
          "width": null,
          "height": null,
          "attributes": [
            { "definitionKey": "Color", "value": "Blue" },
            { "definitionKey": "Size", "value": "L" }
          ]
        }
      ]
    }
  ]
}
```

**What the backend creates per variant:**

| Record | Condition | Values (e.g. Red/M variant) |
|---|---|---|
| ItemVariant | Always | `cost = 20000`, `price = 50000` |
| StockBalance | `trackStock == true` | `availableQuantity = 30`, `onHandQuantity = 30`, `itemVariantId = <id>` |
| StockMovement | `trackStock == true` | `delta = 30`, `movementType = "Create Variant"`, `itemVariantId = <id>` |
| StockReceipt | `trackStock == true AND cost > 0 AND stockQuantity > 0` | `quantity = 30`, `cost = 20000`, `itemVariantId = <id>` (FIFO) |

**Important:** The base item's `stockQuantity` is **automatically forced to 0** when variants are provided (even if you send a non-zero value). Stock is tracked at the variant level only.

---

## Cost Semantics

The `cost` field on a variant serves **dual purpose**:

1. **ItemVariant.cost** — the variant's default/base cost, stored on the variant record
2. **StockReceipt.cost** — cost per unit for FIFO costing (only created when `stockQuantity > 0`)

This matches the same pattern as simple items, where `cost` is stored on both `Item` and `StockReceipt`.

---

## Behavior Matrix

### Simple Items

| `trackStock` | `stockQuantity` | `cost` | StockBalance | StockMovement | StockReceipt |
|---|---|---|---|---|---|
| `true` | `0` (or omitted) | `0` | Created (qty=0) | Created (delta=0) | Not created |
| `true` | `50` | `0` | Created (qty=50) | Created (delta=50) | Not created |
| `true` | `50` | `10000` | Created (qty=50) | Created (delta=50) | Created (qty=50, cost=10000) |
| `false` | any | any | Not created | Not created | Not created |

### Variant Items (per variant)

| `trackStock` (on parent) | variant `stockQuantity` | variant `cost` | StockBalance | StockMovement | StockReceipt |
|---|---|---|---|---|---|
| `true` | `0` (or omitted) | `0` | Created (qty=0) | Created (delta=0) | Not created |
| `true` | `30` | `0` | Created (qty=30) | Created (delta=30) | Not created |
| `true` | `30` | `20000` | Created (qty=30) | Created (delta=30) | Created (qty=30, cost=20000) |
| `false` | any | any | Not created | Not created | Not created |

---

## Validation

- `stockQuantity` must be **>= 0** (both for simple items and variants). Negative values return a `400 BusinessLogicError`.
- The entire batch is atomic: if any item/variant fails validation, **all items** in the request are rolled back.

---

## Version Field

Not needed for item creation. All records are created fresh:
- **Item** -> `version: 1` (auto)
- **StockBalance** -> `version: 1` (schema default)

Optimistic locking (`version`) is only required for subsequent **updates** (e.g., stock adjustment).

---

## Response Shape

The create endpoint response returns the base item data with `hasVariants: true`. It does **not** include variant details or variant stock balances. To get full variant info after creation, call `GET /item/:id`.

---

## Backward Compatibility

- Sending `stockQuantity: 0` (or omitting it) per variant behaves exactly as before — StockBalance created with qty 0, no StockReceipt
- The `PUT /item/update` endpoint is unaffected — new variants added via update still start with qty 0 (use stock adjustment to set initial stock for those)
- Existing simple item creation is unchanged
