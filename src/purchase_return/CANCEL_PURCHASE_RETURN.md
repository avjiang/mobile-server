# Cancel Purchase Return — Backend Reference

## Overview

This document covers the cancel purchase return feature implementation. Cancelling a purchase return reverses its stock operations and marks it with audit information.

---

## Schema Changes

Three new fields added to the `PurchaseReturn` model:

| Field | Type | DB Column | Description |
|-------|------|-----------|-------------|
| `cancelReason` | `String?` | `CANCEL_REASON` | Why the return was cancelled |
| `cancelledBy` | `String?` | `CANCELLED_BY` | Who cancelled the return |
| `cancelledAt` | `DateTime?` | `CANCELLED_AT` | When the return was cancelled |

---

## Endpoints

### `PUT /cancel/:id` (New)

Dedicated cancel endpoint. This is the **primary way** to cancel a purchase return.

**Request:**
```json
{
  "cancelReason": "Customer changed their mind",
  "performedBy": "user@example.com"
}
```

Both fields are optional. If `performedBy` is omitted, defaults to `"SYSTEM"`.

**Response:** Full purchase return object with items, invoice, and supplier details.

**Errors:**
| Status | Message |
|--------|---------|
| 404 | `Purchase Return not found` |
| 400 | `Purchase return is already cancelled` |

### `DELETE /:id` (Updated)

Still works as before (soft-deletes record + items), but now also populates `cancelledBy`, `cancelledAt`, and `cancelReason` (set to `"Deleted"`).

Accepts optional `performedBy` in the request body. Falls back to the authenticated user's username, then `"SYSTEM"`.

### `PUT /update` (Modified)

Now **rejects** `status: 'CANCELLED'` in the request body. Returns error:
```
Use the cancel endpoint to cancel a purchase return
```

This ensures all cancellations go through the dedicated cancel endpoint for consistent audit tracking.

---

## Status Transitions

```
  COMPLETED ──────► CANCELLED
      │                 │
      │   PUT /cancel/:id
      │                 │
      │                 ▼
      │          (Stock reversed,
      │           audit fields set,
      │           items stay visible)
      │
      └── Cannot go back to COMPLETED
```

- Purchase returns are always created as `COMPLETED` (no draft/pending state)
- `CANCELLED` is final — there is no way to un-cancel
- If the user needs the same return after cancelling, they must create a new purchase return

---

## New Fields in Existing Endpoints

The three new cancel audit fields are now included in responses from all query endpoints:

| Endpoint                                | Method | Notes |
| --------------------------------------- | ------ | ----- |
| `/purchaseReturn/sync`                  | GET    | Included in each purchase return in `data` array |
| `/purchaseReturn/dateRange`             | GET    | Included in each purchase return in `data` array |
| `/purchaseReturn/:id`                   | GET    | Included in the single purchase return object |
| `/purchaseReturn/byInvoice/:invoiceId`  | GET    | Included in each purchase return (returns both COMPLETED and CANCELLED) |
| `/purchaseReturn/cancel/:id`            | PUT    | Included in the response object |

`getByInvoiceId` intentionally does **not** filter by status — cancelled returns remain visible alongside completed ones for audit purposes.

---

## Service Method: `cancel(id, cancelData, databaseName)`

**File:** `src/purchase_return/purchase-return.service.ts`

### Flow:

1. Find existing return (must exist, not deleted, not already cancelled)
2. Within a `$transaction`:
   - Update status to `CANCELLED`
   - Set `cancelledBy`, `cancelledAt`, `cancelReason`
   - Increment `version`
   - Call `reverseStockOperationsForCancellation()` to reverse stock
3. Return updated record with items, invoice, supplier

### Stock Reversal (reuses existing `reverseStockOperationsForCancellation()`):

| Operation | Detail |
|-----------|--------|
| **StockBalance** | Adds back `availableQuantity` and `onHandQuantity` |
| **StockMovement** | Creates record with type `"Purchase Return Reversal"` and positive delta |
| **StockReceipt** (was soft-deleted) | Un-deletes and restores quantity |
| **StockReceipt** (was reduced) | Adds back the returned quantity |

### Items Behavior:

Items are **NOT** soft-deleted when cancelling via `PUT /cancel/:id`. They remain visible with the parent return showing `status: CANCELLED`. This is safe because:

- All external modules (invoice, PO, DO, settlement, quotation) filter returns by `status: 'COMPLETED'`
- `validateReturnQuantities` filters by `status: 'COMPLETED'` — cancelled return quantities are not double-counted
- Users can see what items were in the cancelled return for audit purposes

---

## Date Handling

- `cancelledAt` is **server-generated** via `new Date()` — set to the current server timestamp when the cancel is processed. It is NOT passed from the frontend.
- `returnDate` (the original return date, user-selected from the app date picker) remains **unchanged** after cancellation.
- All date fields in responses are in **UTC ISO 8601** format (e.g., `"2026-02-15T03:30:00.000Z"`).

## Numeric Field Serialization

All Prisma `Decimal(15,4)` fields (`totalReturnAmount`, `quantity`, `unitPrice`) are returned as **JSON numbers** (not strings). The `sendResponse` helper in `src/api-helpers/network.ts` runs `convertDecimalsToNumbers` which converts Prisma Decimal objects to JavaScript numbers via `.toNumber()`.

- `totalReturnAmount`: `50000` (number, not `"50000.0000"`)
- `quantity`: `5` (number, not `"5.0000"`)
- `unitPrice`: `10000` (number, not `"10000.0000"`)

---

## Impact on Related Entities

When a purchase return is cancelled, summary fields on related entities update automatically (calculated dynamically on the server — no manual reversal needed):

| Entity     | Field                | Behaviour |
| ---------- | -------------------- | --------- |
| Invoice    | `returnCount`        | Decreases (only counts COMPLETED returns) |
| Invoice    | `totalReturnAmount`  | Decreases |
| Invoice    | `hasReturns`         | May change to `false` if no COMPLETED returns remain |
| Settlement | `netSettlementAmount`| Increases (less deducted) |
| PO / DO    | `returnCount` / `totalReturnAmount` | Decrease accordingly |

All external modules (invoice, PO, DO, settlement, quotation) filter returns by `status: 'COMPLETED'` — cancelled returns are excluded from all aggregations.

---

## Cancel → Recreate Cycle

The full cycle of cancel a purchase return then create a new one is verified to work correctly:

1. **validateReturnQuantities:** Filters by `status: 'COMPLETED'` (line 591). Cancelled returns are excluded from already-returned tally.
2. **StockBalance:** Restored on cancel, reduced again on new create. Arithmetic is correct.
3. **StockReceipt:** Restored on cancel (un-deleted or quantity added back). Found correctly on new create via `deleted: false` filter.
4. **StockMovement:** Full audit trail — original create (negative), cancel (positive), new create (negative).

---

## Difference Between Cancel and Delete

| Aspect | `PUT /cancel/:id` | `DELETE /:id` |
|--------|-------------------|---------------|
| Status | `CANCELLED` | `CANCELLED` |
| Record soft-deleted | No | Yes |
| Items soft-deleted | No | Yes |
| Cancel audit fields | Set from request | Set (`cancelReason: 'Deleted'`) |
| Stock reversal | Yes | Yes |
| Use case | Normal cancellation | Hard removal from lists |

---

## Sync Behaviour

The sync endpoint (`GET /purchaseReturn/sync`) picks up cancelled returns automatically:

1. `updatedAt` timestamp changes when a return is cancelled, so it's captured by `lastSyncTimestamp` filtering
2. A cancelled return syncs with `status: "CANCELLED"`, `deleted: false`, and all three cancel audit fields populated
3. Items remain present in the `purchaseReturnItems` array (not soft-deleted)

---

## Files Modified

| File | Changes |
|------|---------|
| `prisma/client/schema.prisma` | Added `cancelReason`, `cancelledBy`, `cancelledAt` |
| `src/purchase_return/purchase-return.request.ts` | Added `CancelPurchaseReturnInput` interface |
| `src/purchase_return/purchase-return.service.ts` | Added `cancel()`, blocked `update()` from cancelling, updated `deletePurchaseReturn()`, added new fields to sync/query responses |
| `src/purchase_return/purchase-return.controller.ts` | Added `PUT /cancel/:id` endpoint, updated `DELETE /:id` to pass user info |

---

## Terminal Commands

After schema changes:
```bash
npx prisma generate
```

After all code changes:
```bash
npm run build
```
