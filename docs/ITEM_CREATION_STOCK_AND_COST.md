# Item Creation: Stock & Cost — API Contract for Flutter Team

**Date:** 2026-03-11

---

## Overview

`POST /item/create` now fully supports setting **initial stock and cost** for both simple items and variant items in a single request. No separate stock adjustment call is needed.

---

## Cost Routing Rule

The backend routes `cost` based on `trackStock`:

| `trackStock` | `Item.cost` / `ItemVariant.cost` | `StockReceipt.cost` |
|---|---|---|
| `true` | **0** (not stored — FIFO is the cost source of truth) | Stored (when `stockQuantity > 0 AND cost > 0`) |
| `false` | **Stored** (this is the only cost source — no FIFO) | Not created |

**The frontend always sends `cost` the same way.** The backend handles routing automatically — no conditional logic needed on the frontend side.

---

## Simple Items (no variants)

### Stock-tracked item (`trackStock: true`)

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

| Record | Values |
|---|---|
| Item | `cost = 0` (FIFO handles cost) |
| StockBalance | `availableQuantity = 50`, `onHandQuantity = 50` |
| StockMovement | `delta = 50`, `movementType = "Create Item"` |
| StockReceipt | `quantity = 50`, `cost = 10000` (FIFO entry) |

### Non-stock item (`trackStock: false`)

```json
{
  "items": [
    {
      "itemName": "Service Fee",
      "itemCode": "SVC-001",
      "price": 50000,
      "cost": 30000,
      "trackStock": false,
      "categoryId": 1,
      "supplierId": 1
    }
  ]
}
```

**What the backend creates:**

| Record | Values |
|---|---|
| Item | `cost = 30000` (primary cost source for profit calculation) |
| StockBalance | Not created |
| StockMovement | Not created |
| StockReceipt | Not created |

---

## Variant Items

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

**What the backend creates per variant (when `trackStock: true`):**

| Record | Values (e.g. Red/M variant) |
|---|---|
| ItemVariant | `cost = 0` (FIFO handles cost), `price = 50000` |
| StockBalance | `availableQuantity = 30`, `onHandQuantity = 30`, `itemVariantId = <id>` |
| StockMovement | `delta = 30`, `movementType = "Create Variant"`, `itemVariantId = <id>` |
| StockReceipt | `quantity = 30`, `cost = 20000`, `itemVariantId = <id>` (FIFO entry) |

**Important:** The base item's `stockQuantity` is **automatically forced to 0** when variants are provided. Stock is tracked at the variant level only.

---

## Behavior Matrix

### Simple Items

| `trackStock` | `stockQuantity` | `cost` | `Item.cost` | StockReceipt |
|---|---|---|---|---|
| `true` | `0` | `0` | `0` | Not created |
| `true` | `50` | `0` | `0` | Not created (cost is 0) |
| `true` | `50` | `10000` | `0` | Created (qty=50, cost=10000) |
| `false` | — | `30000` | `30000` | Not created |
| `false` | — | `0` | `0` | Not created |

### Variant Items (per variant, inherits `trackStock` from parent)

| `trackStock` | variant `stockQuantity` | variant `cost` | `ItemVariant.cost` | StockReceipt |
|---|---|---|---|---|
| `true` | `0` | `0` | `0` | Not created |
| `true` | `30` | `0` | `0` | Not created (cost is 0) |
| `true` | `30` | `20000` | `0` | Created (qty=30, cost=20000) |
| `false` | — | `20000` | `20000` | Not created |

---

## How Cost Is Used at Sale Time

| Item type | Cost source |
|---|---|
| Stock-tracked (with receipts) | `StockReceipt.cost` via FIFO (oldest receipt consumed first) |
| Stock-tracked (receipts depleted) | Falls back to `Item.cost` (which is 0 — means no known cost) |
| Non-stock | `Item.cost` directly |

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
- The `PUT /item/update` endpoint now processes `stockQuantity` and `cost` for new variants (variants without an `id`), creating StockBalance, StockMovement, and StockReceipt — same behavior as `POST /item/create`
- Existing simple item creation is unchanged
- Stock adjustments and delivery orders are unaffected — they only create StockReceipts (never touch `Item.cost`)
