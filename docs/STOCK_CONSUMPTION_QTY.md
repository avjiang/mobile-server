# Stock Consumption Quantity — API Contract

## Overview

Support for consumption-based stock deduction in sales. When a service item (e.g., "Detergent Wash" at $10) is sold, staff enters how much consumable was used (e.g., 50ml), and that amount is deducted from stock instead of `quantity`.

---

## New Fields on Sales Item

### Request (CreateSalesItemRequest)

| Field                 | Type              | Required | Description                                                       |
| --------------------- | ----------------- | -------- | ----------------------------------------------------------------- |
| `stockConsumptionQty` | `number` (decimal)| No       | Amount of stock to deduct per order unit (in item's UOM). `null` for piece-based items. |
| `unitOfMeasure`       | `string`          | No       | Copied from the parent item's `unitOfMeasure` at time of sale. `null` for piece-based items. |

### Response (SalesItem)

Both fields are included in all sales item responses (`getById`, `getDeliveryList`, `getDeliveredList`).

---

## Stock Deduction Formula

```
if stockConsumptionQty IS NOT NULL:
    stock -= quantity * stockConsumptionQty
else:
    stock -= quantity    // existing piece-based behavior
```

### Examples

| Scenario                 | quantity | stockConsumptionQty | Stock Deduction |
| ------------------------ | -------- | ------------------- | --------------- |
| 2x T-Shirt (piece)       | 2        | null                | 2 pieces        |
| 1x Wash (50ml detergent) | 1        | 50.0                | 50 ml           |
| 3x Wash (50ml detergent) | 3        | 50.0                | 150 ml          |
| 1x Wash (80ml detergent) | 1        | 80.0                | 80 ml           |

---

## Request Body Example

### Piece-based item (unchanged)

```json
{
  "salesItems": [
    {
      "itemId": 123,
      "quantity": 2,
      "price": 15.00,
      "stockConsumptionQty": null,
      "unitOfMeasure": null
    }
  ]
}
```

### Consumption-based item

```json
{
  "salesItems": [
    {
      "itemId": 456,
      "quantity": 1,
      "price": 10.00,
      "stockConsumptionQty": 50.0,
      "unitOfMeasure": "Milliliter"
    }
  ]
}
```

### Multiple consumption entries (same item, different amounts)

```json
{
  "salesItems": [
    {
      "itemId": 456,
      "quantity": 1,
      "price": 10.00,
      "stockConsumptionQty": 50.0,
      "unitOfMeasure": "Milliliter"
    },
    {
      "itemId": 456,
      "quantity": 1,
      "price": 10.00,
      "stockConsumptionQty": 80.0,
      "unitOfMeasure": "Milliliter"
    }
  ]
}
```

---

## Response Body Example

```json
{
  "id": 789,
  "itemId": 456,
  "itemName": "Detergent Wash",
  "quantity": 1,
  "price": 10.00,
  "cost": 3.50,
  "stockConsumptionQty": 50.0,
  "unitOfMeasure": "Milliliter",
  "subtotalAmount": 10.00
}
```

---

## Validation Rules

| Rule | Behavior |
| ---- | -------- |
| `stockConsumptionQty <= 0` | Rejected with `BusinessLogicError` |
| `stockConsumptionQty = null` | Standard piece-based behavior (no change) |
| Insufficient stock (`available < quantity * stockConsumptionQty`) | Rejected with stock validation error |
| Duplicate `itemId` entries with different `stockConsumptionQty` | Allowed — stock validated against aggregated total |

---

## Void / Return / Refund

Stock restoration uses the same formula: `quantity * stockConsumptionQty` per sales item row.

For pre-migration sales (where `stockConsumptionQty` is `NULL`), existing behavior is preserved — stock restored by `quantity`.

---

## UOM Standardization

All `unitOfMeasure` values are now standardized to English capitalized full names:

| API value      | Abbreviation |
| -------------- | ------------ |
| `Piece`        | pcs          |
| `Pair`         | -            |
| `Box`          | -            |
| `Meter`        | m            |
| `Dozen`        | -            |
| `Set`          | -            |
| `Pack`         | -            |
| `Milliliter`   | ml           |
| `Liter`        | L            |
| `Gram`         | g            |
| `Kilogram`     | kg           |

The frontend should always send these English keys to the API and handle localized display names internally.

---

## Backward Compatibility

- Existing sales records have `stockConsumptionQty = NULL` and `unitOfMeasure = NULL` — behavior is unchanged
- Piece-based items continue to send `null` (or omit) for both fields
- No changes to item creation/update endpoints — `unitOfMeasure` field already exists on items
