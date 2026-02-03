# Frontend Integration Guide: Purchase Return - Invoice Settlement Linkage

## Overview

This document describes the API response changes related to linking Purchase Returns to Invoice Settlements. These changes are **backward compatible** - all new fields are additive.

---

## API Response Changes

### 1. GET /invoice/:id

**New fields added at invoice level:**

| Field | Type | Description |
|-------|------|-------------|
| `purchaseReturns` | Array | List of purchase returns for this invoice |
| `totalReturnAmount` | String (Decimal) | Sum of all return amounts (e.g., "300.0000") |
| `netAmount` | String (Decimal) | `totalAmount` - `totalReturnAmount` |
| `returnCount` | Number | Number of purchase returns |
| `hasFullyReturnedItems` | Boolean | True if any item has `remainingQuantity = 0` |

**New fields added at invoice item level (within `invoiceItems` array):**

| Field | Type | Description |
|-------|------|-------------|
| `returnedQuantity` | String (Decimal) | Total quantity already returned for this item |
| `remainingQuantity` | String (Decimal) | Available quantity for return (`quantity - returnedQuantity`) |

**Example response snippet:**

```json
{
  "id": 1,
  "invoiceNumber": "INV-2024-001",
  "totalAmount": "5300.0000",
  "status": "PAID",
  "hasFullyReturnedItems": false,
  "invoiceItems": [
    {
      "id": 1,
      "itemId": 100,
      "itemVariantId": null,
      "quantity": "10.0000",
      "unitPrice": "100.0000",
      "returnedQuantity": "3.0000",
      "remainingQuantity": "7.0000"
    },
    {
      "id": 2,
      "itemId": 101,
      "itemVariantId": null,
      "quantity": "5.0000",
      "unitPrice": "200.0000",
      "returnedQuantity": "0.0000",
      "remainingQuantity": "5.0000"
    }
  ],
  "purchaseReturns": [
    {
      "id": 1,
      "returnNumber": "RTN-2024-001",
      "returnDate": "2024-03-15T00:00:00.000Z",
      "status": "COMPLETED",
      "totalReturnAmount": "300.0000",
      "remark": "Defective items",
      "purchaseReturnItems": [
        {
          "id": 1,
          "itemId": 100,
          "quantity": "3.0000",
          "unitPrice": "100.0000",
          "returnReason": "DEFECT"
        }
      ]
    }
  ],
  "totalReturnAmount": "300.0000",
  "netAmount": "5000.0000",
  "returnCount": 1
}
```

---

### 2. GET /invoiceSettlement/:id

**New fields at invoice level (within `invoices` array):**

| Field | Type | Description |
|-------|------|-------------|
| `totalReturnAmount` | String (Decimal) | Return total for this invoice |
| `netAmount` | String (Decimal) | Invoice net after returns |
| `returnCount` | Number | Number of returns for this invoice |

**Note:** `purchaseReturns` array is NOT included at invoice level to avoid duplication. All purchase return details are at the settlement level.

**New fields at settlement level:**

| Field | Type | Description |
|-------|------|-------------|
| `purchaseReturns` | Array | All purchase returns with full details (includes `purchaseReturnItems`) |
| `totalReturnAmount` | String (Decimal) | Total returns across all invoices |
| `netSettlementAmount` | String (Decimal) | `settlementAmount` - `totalReturnAmount` |
| `returnCount` | Number | Total number of returns in settlement |

**Example response snippet:**

```json
{
  "id": 1,
  "settlementNumber": "STL-2024-001",
  "settlementAmount": "10600.0000",
  "invoices": [
    {
      "id": 1,
      "invoiceNumber": "INV-2024-001",
      "totalAmount": "5300.0000",
      "totalReturnAmount": "300.0000",
      "netAmount": "5000.0000",
      "returnCount": 1
    },
    {
      "id": 2,
      "invoiceNumber": "INV-2024-002",
      "totalAmount": "5300.0000",
      "totalReturnAmount": "0.0000",
      "netAmount": "5300.0000",
      "returnCount": 0
    }
  ],
  "purchaseReturns": [
    {
      "id": 1,
      "returnNumber": "RTN-2024-001",
      "invoiceId": 1,
      "returnDate": "2024-03-15T00:00:00.000Z",
      "status": "COMPLETED",
      "totalReturnAmount": "300.0000",
      "remark": "Defective items",
      "purchaseReturnItems": [
        {
          "id": 1,
          "itemId": 100,
          "itemVariantId": null,
          "quantity": "3.0000",
          "unitPrice": "100.0000",
          "returnReason": "DEFECT",
          "remark": null
        }
      ]
    }
  ],
  "totalReturnAmount": "300.0000",
  "netSettlementAmount": "10300.0000",
  "returnCount": 1
}
```

---

## Display Recommendations

### Invoice Detail Screen

1. **Show "Returns" section** if `returnCount > 0`
2. **Display amounts with returns context:**
   ```
   Invoice Total:    5,300.00
   Returns:           -300.00
   ─────────────────────────
   Net Amount:       5,000.00
   ```
3. **List individual returns** with expandable details showing items

### Invoice Settlement Detail Screen

1. **Per-invoice view:**
   - Show return indicator/badge if invoice has returns
   - Display `netAmount` alongside `totalAmount`

2. **Settlement summary:**
   ```
   Settlement Amount:     10,600.00
   Total Returns:           -300.00
   ─────────────────────────────────
   Net Settlement:        10,300.00
   ```

3. **Returns breakdown section:**
   - List all returns grouped by invoice
   - Show return reasons and item details

### Purchase Return Creation Screen

1. **Use `remainingQuantity` as max limit** for quantity input
2. **Disable/hide fully returned items** where `remainingQuantity = 0`
3. **Show informational text:** "X of Y already returned"
4. **Check `hasFullyReturnedItems`** to show warning if some items can't be returned

---

## Validation Errors

### POST /purchaseReturn/create - Quantity Exceeded Error

When the requested return quantity exceeds the available quantity (invoice qty - already returned qty), the server returns a validation error.

**Error Response:**

```json
{
  "success": false,
  "error": {
    "name": "RequestValidateError",
    "message": "Return quantity exceeds available quantity for one or more items. Item 100: requested 8.0000, available 7.0000 (invoice qty: 10.0000, already returned: 3.0000)"
  }
}
```

**Validation Logic:**
```
For each item in the purchase return request:
  availableQuantity = invoiceItem.quantity - totalPreviouslyReturned
  if (requestedQuantity > availableQuantity):
    REJECT with validation error
```

**Frontend Handling:**
1. Parse the error message to show user-friendly feedback
2. Highlight the affected items in the form
3. Pre-validate on client side using `remainingQuantity` from invoice response

---

## Important Notes

### No Breaking Changes

- All existing fields remain unchanged
- New fields are purely additive
- No changes to POST/PUT request bodies

### Auto-Population

- `invoiceSettlementId` is automatically set on purchase returns when created
- No frontend action required - the linkage happens server-side

### Computed Fields

These fields are calculated at query time (not stored in database):
- `totalReturnAmount`
- `netAmount`
- `netSettlementAmount`
- `returnCount`

### Decimal Handling

All monetary amounts are returned as strings with 4 decimal places (e.g., "300.0000"). Parse these as decimals for calculations, not floats.

---

## Stock Operations (Backend Behavior)

When a Purchase Return is created, the following stock operations occur automatically:

### On Purchase Return Creation

1. **StockBalance**: Reduced by the return quantity
   - `availableQuantity` decreases
   - `onHandQuantity` decreases

2. **StockMovement**: Created with negative delta
   - `movementType`: "Purchase Return"
   - Records the stock reduction for audit trail

3. **StockReceipt**: Modified (not creating negative records)
   - The system finds the original StockReceipt via: Invoice → DeliveryOrders → StockReceipt
   - Matching by: `deliveryOrderId` + `itemId` + `itemVariantId`
   - **If return qty >= receipt qty**: Soft-delete the receipt (`deleted: true`)
   - **If return qty < receipt qty**: Reduce the receipt quantity

### On Purchase Return Cancellation

1. **StockBalance**: Restored by the return quantity
   - `availableQuantity` increases
   - `onHandQuantity` increases

2. **StockMovement**: Created with positive delta
   - `movementType`: "Purchase Return Reversal"
   - Records the stock restoration for audit trail

3. **StockReceipt**: Restored
   - **If receipt was soft-deleted**: Un-delete and restore quantity
   - **If receipt was reduced**: Add back the return quantity

### Why This Approach?

- **Single Record Per Item**: Users see one StockReceipt record per delivered item (not two records for in/out)
- **Clean Cost Editing**: Users can edit cost/capital on StockReceipt without confusion from negative entries
- **Accurate FIFO Tracking**: Quantity reflects actual stock on hand

---

## TypeScript Interface Updates

```typescript
// Add to Invoice interface
interface Invoice {
  // ... existing fields ...
  invoiceItems: InvoiceItemWithReturnTracking[];
  purchaseReturns?: PurchaseReturnSummary[];
  totalReturnAmount?: string;  // Decimal as string
  netAmount?: string;          // Decimal as string
  returnCount?: number;
  hasFullyReturnedItems?: boolean;  // True if any item has remainingQuantity = 0
}

// Invoice item with return tracking fields
interface InvoiceItemWithReturnTracking {
  id: number;
  itemId: number;
  itemVariantId?: number | null;
  quantity: string;           // Decimal as string
  unitPrice: string;          // Decimal as string
  // ... other existing fields ...
  returnedQuantity: string;   // Total returned for this item
  remainingQuantity: string;  // Available for return (quantity - returnedQuantity)
}

// Add to InvoiceSettlement interface
interface InvoiceSettlement {
  // ... existing fields ...
  purchaseReturns?: PurchaseReturnSummary[];
  totalReturnAmount?: string;      // Decimal as string
  netSettlementAmount?: string;    // Decimal as string
  returnCount?: number;
}

// Invoice within settlement response
interface SettlementInvoice {
  // ... existing fields ...
  purchaseReturns: PurchaseReturnDetail[];
  totalReturnAmount: string;
  netAmount: string;
  returnCount: number;
}

// Purchase return summary (at settlement level)
interface PurchaseReturnSummary {
  id: number;
  returnNumber: string;
  invoiceId: number;
  returnDate: string;
  status: string;
  totalReturnAmount: string;
  remark?: string;
}

// Purchase return detail (at invoice level)
interface PurchaseReturnDetail extends PurchaseReturnSummary {
  purchaseReturnItems: PurchaseReturnItemDetail[];
}

interface PurchaseReturnItemDetail {
  id: number;
  itemId: number;
  itemVariantId?: number | null;
  stockReceiptId?: number | null;  // Links to affected StockReceipt (internal tracking)
  quantity: string;
  unitPrice: string;
  returnReason: 'DEFECT' | 'SPOILT' | 'BROKEN' | 'WRONG_ITEM' | 'OTHER';
  remark?: string;
}
```

---

## Questions?

Contact the backend team for any clarification on these changes.
