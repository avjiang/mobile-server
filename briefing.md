# Backend Briefing: Laundry Shop UOM Support

## Overview

We want to support laundry-type shops where stock is tracked in volume/weight units (e.g., detergent in milliliters). The core change is a **per-sale consumption model** — when staff sells a service (e.g., "Regular Wash" at $10), they enter how much consumable was used (e.g., 50ml of detergent), and that amount is deducted from stock.

## How It Works

### Current flow (piece-based items)

```
Staff sells 2× T-Shirt ($15 each)
→ quantity = 2, price = $15
→ subtotal = $30
→ stock deduction: 2 pieces
```

### New flow (consumption-based items)

```
Staff sells 1× "Detergent Wash" ($10/order, item UOM = Milliliter)
→ Popup asks: "How many ml used?" → staff enters 50
→ quantity = 1, price = $10, stockConsumptionQty = 50
→ subtotal = $10
→ stock deduction: 50 ml (not 1 piece)
```

### Why not just use quantity = 50?

- `subtotal = price × quantity` would be `$10 × 50 = $500` — wrong
- Cart badge would show "50" instead of "1" — confusing
- +/- buttons would increment ml instead of orders — bad UX

That's why we need a **separate field** for consumption amount.

---

## Required Backend Changes

### 1. Accept New UOM Values

The `unitOfMeasure` field on items already exists. Please accept these additional values:

| Value        | Abbreviation | Example         |
| ------------ | ------------ | --------------- |
| `Milliliter` | ml           | Detergent       |
| `Liter`      | L            | Fabric softener |
| `Gram`       | g            | Washing powder  |
| `Kilogram`   | kg           | Bulk chemicals  |

Existing values (`Piece`, `Pair`, `Box`, `Meter`, `Dozen`, `Set`, `Pack`) remain unchanged.

### 2. New Fields on `sales_items` Table

Add two nullable columns:

| Column                  | Type                      | Description                                                                                           |
| ----------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `stock_consumption_qty` | `DECIMAL(10,2)`, nullable | Amount of stock to deduct per order (in item's UOM). `NULL` for piece-based items.                    |
| `unit_of_measure`       | `VARCHAR`, nullable       | Copied from the parent item's `unitOfMeasure` at time of sale. `NULL` for existing/piece-based items. |

**Backward compatibility**: Existing sales records have `NULL` for both fields — behavior is unchanged.

### 3. Stock Deduction Logic Change

**This is the most critical change.**

Current logic:

```
stock -= salesItem.quantity
```

New logic:

```
if salesItem.stock_consumption_qty IS NOT NULL:
    stock -= salesItem.quantity × salesItem.stock_consumption_qty
else:
    stock -= salesItem.quantity    // existing piece-based behavior (unchanged)
```

**Examples:**

| Scenario                 | quantity | stock_consumption_qty | Stock Deduction |
| ------------------------ | -------- | --------------------- | --------------- |
| 2× T-Shirt (piece)       | 2        | NULL                  | 2 pieces        |
| 1× Wash (50ml detergent) | 1        | 50.0                  | 50 ml           |
| 3× Wash (50ml detergent) | 3        | 50.0                  | 150 ml          |
| 1× Wash (80ml detergent) | 1        | 80.0                  | 80 ml           |

### 4. Stock Validation

When processing a sale with `stock_consumption_qty`:

- Calculate total deduction: `quantity × stock_consumption_qty`
- Validate: `available_stock >= total deduction`
- Reject the sale if stock is insufficient (prevent negative stock)

### 5. API Changes

#### Sales Item — Request Body

The frontend will send these new fields when creating a sale:

```json
{
  "salesItems": [
    {
      "itemId": 123,
      "quantity": 1,
      "price": 10.00,
      "stockConsumptionQty": 50.0,
      "unitOfMeasure": "Milliliter",
      ... // existing fields unchanged
    }
  ]
}
```

For piece-based items, `stockConsumptionQty` and `unitOfMeasure` will be `null` (or omitted).

#### Sales Item — Response DTO

Please include `stockConsumptionQty` and `unitOfMeasure` in the sales item response so the frontend can display consumption info in sales history:

```json
{
  "id": 456,
  "itemId": 123,
  "itemName": "Detergent Wash",
  "quantity": 1,
  "price": 10.00,
  "stockConsumptionQty": 50.0,
  "unitOfMeasure": "Milliliter",
  ...
}
```

---

## What Does NOT Change

- **Item creation/update endpoints** — `unitOfMeasure` field already exists on items, just accepting new values
- **Stock balance model** — already uses `DECIMAL`/`double` for quantities
- **Stock adjustment endpoints** — already support fractional quantities
- **All other modules** (PO, Invoice, Delivery, Quotation) — no changes needed for now

---

## Test Scenarios

### Scenario 1: Basic consumption sale

1. Create item: "Detergent", UOM = `Milliliter`, price = $10
2. Stock adjustment: set stock to 5000 (ml)
3. Create sale: quantity = 1, stockConsumptionQty = 50
4. Expected: stock = 5000 - 50 = 4950 ml

### Scenario 2: Multiple orders of same item

1. Same item with stock = 5000 ml
2. Create sale with 2 items:
   - Item A: quantity = 1, stockConsumptionQty = 50 (one wash used 50ml)
   - Item B: quantity = 1, stockConsumptionQty = 80 (another wash used 80ml)
3. Expected: stock = 5000 - 50 - 80 = 4870 ml

### Scenario 3: Quantity > 1 (same consumption repeated)

1. Same item with stock = 5000 ml
2. Create sale: quantity = 3, stockConsumptionQty = 50
3. Expected: stock = 5000 - (3 × 50) = 4850 ml

### Scenario 4: Insufficient stock

1. Same item with stock = 30 ml
2. Attempt sale: quantity = 1, stockConsumptionQty = 50
3. Expected: sale rejected (30 < 50)

### Scenario 5: Piece-based item (no regression)

1. Create item: "T-Shirt", UOM = `Piece`, price = $15
2. Stock = 10
3. Create sale: quantity = 2, stockConsumptionQty = null
4. Expected: stock = 10 - 2 = 8 (existing behavior unchanged)

### Scenario 6: Mixed cart

1. Cart contains both piece-based and ml-based items
2. Each deducts stock using its own logic
3. Expected: piece items deduct by quantity, ml items deduct by quantity × consumptionQty

---

## Reply to Backend Team Questions

### Q1: Duplicate-Item Handling

**Piece-based items**: The app **always merges** duplicates. When staff taps the same item twice, `addToCart()` finds the existing cart entry and increments its quantity (`existedItem.quantity += 1`). The app will **never** send duplicate `itemId` entries for piece-based items — always a single entry with `quantity = 2, 3, ...`.

**Consumption-based items**: Yes, **separate entries per different `stockConsumptionQty`** is the intended pattern. Each laundry order may use a different amount of detergent (50ml for one load, 80ml for another), so they must be separate entries. The same `itemId` can appear multiple times, each with a different `stockConsumptionQty`.

The frontend already does a pre-validation stock check that **aggregates all entries** for the same `itemId` before comparing against available stock. But the backend fix for cumulative validation is still good as a safety net.

**Summary:**

| Item type         | Duplicate itemId entries? | Pattern                                                     |
| ----------------- | ------------------------- | ----------------------------------------------------------- |
| Piece-based       | Never                     | Single entry, quantity incremented                          |
| Consumption-based | Yes, expected             | Separate entry per order with different stockConsumptionQty |

### Q2: Schema Precision

`DECIMAL(15,4)` is fine. No impact on frontend — we use `double` for all numeric fields. Agreed.

### Q3: UOM Naming Convention

**We found a pre-existing issue on the frontend side.** The app currently sends **localized display names** as UOM values — not fixed codes. This means:

- English user creates item → sends `"Piece"` to backend
- Indonesian user creates same type of item → sends `"Buah"` to backend

This is problematic. The same unit gets stored as different strings depending on user language.

**Our recommendation: Option A — standardize on English capitalized full names.**

We will fix the frontend to always send the **English key** regardless of locale:

| API value (fixed) | English display | Indonesian display |
| ----------------- | --------------- | ------------------ |
| `Piece`           | Piece           | Buah               |
| `Pair`            | Pair            | Pasang             |
| `Box`             | Box             | Kotak              |
| `Meter`           | Meter           | Meter              |
| `Dozen`           | Dozen           | Lusin              |
| `Set`             | Set             | Set                |
| `Pack`            | Pack            | Paket              |
| `Milliliter`      | Milliliter      | Mililiter          |
| `Liter`           | Liter           | Liter              |
| `Gram`            | Gram            | Gram               |
| `Kilogram`        | Kilogram        | Kilogram           |

The frontend will:

1. Store/send English keys to API (e.g., `"Piece"`, `"Milliliter"`)
2. Display localized names to users (e.g., `"Buah"`, `"Mililiter"`)
3. Map API values ↔ localized display names internally

**Migration question for backend**: Do existing items in the DB have mixed localized values (some `"Piece"`, some `"Buah"`)? If so, a one-time migration to standardize to English keys would clean this up. Otherwise, the frontend can handle both old and new values gracefully.

### Q4: Confirmed

Acknowledged — no action needed.

### Q5: Void/Return/Refund — FIFO Receipts

**Balance-only restoration is fine.** We don't do receipt-level FIFO tracking on the frontend side. The existing behavior (restore balance, don't recreate receipts) is acceptable for both piece-based and consumption-based items.

For consumption items, the restore amount should be: `quantity × stockConsumptionQty` (same formula used for deduction, just reversed).

---

## Clarification: Frontend Local Stock Validation

The frontend already performs **local stock validation** before allowing items into the cart. We will extend this for consumption-based items:

### Current behavior (piece-based)

Before adding a piece-based item, the app checks:

```
totalQtyInCart = sum of quantity for all cart entries with same itemId
if (totalQtyInCart + 1 > localAvailableStock) → show "out of stock", block add
```

### New behavior (consumption-based)

For consumption items, the check uses the consumption formula:

```
totalConsumptionInCart = sum of (quantity × stockConsumptionQty) for all cart entries with same itemId
remainingStock = localAvailableStock - totalConsumptionInCart
```

This check happens in **two stages**:

1. **Before showing the popup**: If `remainingStock <= 0`, skip the popup entirely and show "out of stock"
2. **Inside the popup**: Display "Available: {remainingStock} ml" and validate that the entered amount does not exceed `remainingStock`

This gives **instant feedback** to staff without a network round-trip. The backend validation remains as a **safety net** for race conditions (e.g., another device sold stock between the local check and API submission).
