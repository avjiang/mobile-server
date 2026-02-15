# Cancel Purchase Return — Frontend Integration Guide

## Overview

This guide covers everything the frontend team needs to integrate the cancel purchase return feature. The backend provides a dedicated `PUT /cancel/:id` endpoint that cancels a purchase return and reverses all stock operations.

---

## API Endpoint

### `PUT /purchaseReturn/cancel/:id`

| Method | Path                            |
| ------ | ------------------------------- |
| PUT    | `/purchaseReturn/cancel/:id`    |

**Authentication:** Required (Bearer token)

---

## Request

**URL Parameter:**
- `id` (required) — The purchase return ID to cancel

**Request Body (JSON):**
```json
{
  "cancelReason": "Supplier agreed to credit instead of physical return",
  "performedBy": "john@example.com"
}
```

### CancelPurchaseReturnDO

| Field          | Type      | Required | Notes                                                                 |
| -------------- | --------- | -------- | --------------------------------------------------------------------- |
| `cancelReason` | `string?` | No       | Free-text reason for cancellation. Stored separately from `remark`    |
| `performedBy`  | `string?` | No       | Who is performing the cancel (e.g., username or email). Defaults to `"SYSTEM"` if omitted |

**Example Request:**
```http
PUT /purchaseReturn/cancel/42
Content-Type: application/json
Authorization: Bearer <token>

{
  "cancelReason": "Supplier agreed to credit instead of physical return",
  "performedBy": "john@example.com"
}
```

**Minimal Request (no body needed):**
```http
PUT /purchaseReturn/cancel/42
Content-Type: application/json
Authorization: Bearer <token>
```

---

## Response

### Success Response (200)

Returns the full updated purchase return object:

```json
{
  "id": 42,
  "returnNumber": "RTN-1739612345678",
  "invoiceId": 123,
  "invoiceSettlementId": 50,
  "outletId": 1,
  "supplierId": 456,
  "returnDate": "2026-02-15T03:30:00.000Z",
  "status": "CANCELLED",
  "totalReturnAmount": 50000,
  "remark": "Damaged packaging",
  "performedBy": "original-creator@example.com",
  "cancelReason": "Supplier agreed to credit instead of physical return",
  "cancelledBy": "john@example.com",
  "cancelledAt": "2026-02-20T14:30:00.000Z",
  "deleted": false,
  "deletedAt": null,
  "createdAt": "2026-02-15T10:00:00.000Z",
  "updatedAt": "2026-02-20T14:30:00.000Z",
  "version": 2,
  "purchaseReturnItems": [
    {
      "id": 1,
      "itemId": 789,
      "itemVariantId": 101,
      "variantSku": null,
      "variantName": "Red / Large",
      "quantity": 5,
      "unitPrice": 10000,
      "returnReason": "DEFECT",
      "remark": "Cracked screen",
      "item": {
        "id": 789,
        "itemName": "Widget A",
        "itemCode": "WA-001",
        "unitOfMeasure": "PCS"
      }
    }
  ],
  "invoice": {
    "id": 123,
    "invoiceNumber": "INV-2026-001"
  },
  "supplier": {
    "id": 456,
    "companyName": "ACME Supplies"
  }
}
```

### Error Responses

| HTTP Status | Error | When |
|-------------|-------|------|
| 400 | `Purchase return is already cancelled` | The return has already been cancelled |
| 400 | `User not authenticated` | No valid auth token |
| 400 | `ID format incorrect` | Non-numeric ID in URL |
| 404 | `Purchase Return not found` | ID doesn't exist or is soft-deleted |

**Error Response Format:**
```json
{
  "error": "Purchase return is already cancelled"
}
```

---

## Important Notes on Dates

- `cancelledAt` is **server-generated** — the backend sets it to the current server timestamp when the cancel is processed. The frontend does **NOT** pass this value.
- `returnDate` (the original return date, user-selected from the app date picker) remains **unchanged** on the purchase return after cancellation.
- All date fields in responses are in **UTC ISO 8601** format (e.g., `"2026-02-15T03:30:00.000Z"`).

## Important Notes on Numeric Fields

All Decimal fields (`totalReturnAmount`, `quantity`, `unitPrice`) are returned as **JSON numbers** (not strings). The backend's `sendResponse` helper automatically converts Prisma Decimal objects to JavaScript numbers via `.toNumber()`.

- `totalReturnAmount`: `50000` (number, not `"50000.0000"`)
- `quantity`: `5` (number, not `"5.0000"`)
- `unitPrice`: `10000` (number, not `"10000.0000"`)

The frontend `double` / `double?` types are compatible. Existing `fromJson()` using `double.tryParse()` or direct assignment will work without changes.

---

## New Fields in Existing Endpoints

Three new fields have been added to the purchase return object across **all** endpoints:

| Field          | Type            | Description |
| -------------- | --------------- | ----------- |
| `cancelReason` | `string \| null` | Why the return was cancelled. `null` for active (COMPLETED) returns |
| `cancelledBy`  | `string \| null` | Who cancelled the return. `null` for active returns |
| `cancelledAt`  | `string \| null` | UTC ISO 8601 timestamp of when the return was cancelled (server-generated). `null` for active returns |

### Affected Endpoints

These fields are now included in responses from:

| Endpoint                                | Method | Notes |
| --------------------------------------- | ------ | ----- |
| `/purchaseReturn/sync`                  | GET    | Included in each purchase return object in the `data` array |
| `/purchaseReturn/dateRange`             | GET    | Included in each purchase return object in the `data` array |
| `/purchaseReturn/:id`                   | GET    | Included in the single purchase return object |
| `/purchaseReturn/byInvoice/:invoiceId`  | GET    | Included in each purchase return (returns both COMPLETED and CANCELLED) |
| `/purchaseReturn/cancel/:id`            | PUT    | Included in the response object |

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

**Key Points:**
- Purchase returns are always created as `COMPLETED` (no draft/pending state)
- `CANCELLED` is final — there is no way to un-cancel
- If the user needs the same return after cancelling, they must create a new purchase return
- The `PUT /update` endpoint **no longer accepts** `status: 'CANCELLED'` — use `PUT /cancel/:id` instead

---

## UI Considerations

### 1. Cancel Button Placement
- Show a "Cancel" button on the purchase return detail view
- Only show when `status === 'COMPLETED'`
- Hide when `status === 'CANCELLED'`

### 2. Confirmation Dialog
Recommended: Show a confirmation dialog before calling the cancel endpoint. Include:
- Return number
- Total return amount
- Optional text input for `cancelReason`
- Warning: "This will reverse all stock adjustments from this return. This action cannot be undone."

### 3. Displaying Cancelled Returns

Cancelled returns remain visible in all list views. Suggested UI treatment:

```
┌─────────────────────────────────────────────┐
│ RTN-1739612345678     CANCELLED (greyed out) │
│ Invoice: INV-2026-001                        │
│ Amount: $50,000.00                           │
│ Items: 1                                     │
│                                              │
│ Cancelled by: john@example.com               │
│ Cancelled at: 2026-02-20 14:30               │
│ Reason: Supplier agreed to credit            │
└─────────────────────────────────────────────┘
```

- Use a visual indicator (e.g., strikethrough, greyed out, red badge) for cancelled returns
- Show `cancelledBy`, `cancelledAt`, and `cancelReason` in the detail view
- Items should still be listed (they are NOT deleted) — show them as read-only

### 4. Impact on Summary Fields

When a return is cancelled, summary fields on related entities update automatically:

| Entity     | Field                | Behaviour |
| ---------- | -------------------- | --------- |
| Invoice    | `returnCount`        | Decreases (only counts COMPLETED returns) |
| Invoice    | `totalReturnAmount`  | Decreases |
| Invoice    | `hasReturns`         | May change to `false` if no COMPLETED returns remain |
| Settlement | `netSettlementAmount`| Increases (less deducted) |
| PO / DO    | `returnCount` / `totalReturnAmount` | Decrease accordingly |

No additional API calls needed — these are calculated dynamically on the server.

### 5. Creating New Return After Cancel

After cancelling a return, the user can create a new return for the same invoice/items. The full invoice quantity becomes available again since the cancelled return's quantities are excluded from validation.

---

## Sync Integration

The sync endpoint (`GET /purchaseReturn/sync`) now includes the three new fields. When syncing:

1. A cancelled purchase return will come through with:
   - `status: "CANCELLED"`
   - `cancelReason`, `cancelledBy`, `cancelledAt` populated
   - `deleted: false` (cancel does NOT soft-delete)
   - Items still present in `purchaseReturnItems` array

2. The `updatedAt` timestamp changes when a return is cancelled, so it will be picked up by the sync mechanism via `lastSyncTimestamp`.

3. Local database schema needs to add the three new columns:
   ```sql
   ALTER TABLE purchase_return ADD COLUMN cancel_reason TEXT;
   ALTER TABLE purchase_return ADD COLUMN cancelled_by TEXT;
   ALTER TABLE purchase_return ADD COLUMN cancelled_at DATETIME;
   ```

---

## Complete Field Reference

### PurchaseReturnDO (Response Object)

| Field                 | Type         | Nullable | Notes                                                                                     |
| --------------------- | ------------ | -------- | ----------------------------------------------------------------------------------------- |
| `id`                  | `int`        | No       | Unique identifier                                                                          |
| `returnNumber`        | `string`     | No       | Unique return number (e.g., `RTN-1739612345678`)                                           |
| `invoiceId`           | `int`        | No       | Linked invoice ID                                                                          |
| `invoiceSettlementId` | `int?`       | Yes      | Linked settlement ID (auto-populated by backend)                                           |
| `outletId`            | `int`        | No       | Outlet that processed the return                                                           |
| `supplierId`          | `int`        | No       | Supplier ID                                                                                |
| `returnDate`          | `string`     | No       | UTC ISO 8601. User-selected from date picker, unchanged on cancel                          |
| `status`              | `string`     | No       | `"COMPLETED"` or `"CANCELLED"` (uppercased)                                                |
| `totalReturnAmount`   | `string?`    | Yes      | Decimal string (e.g., `"50000.0000"`)                                                      |
| `remark`              | `string?`    | Yes      | Original return remark. Unchanged on cancel                                                |
| `performedBy`         | `string?`    | Yes      | Who created the return                                                                     |
| `cancelReason`        | `string?`    | Yes      | **NEW** — Why the return was cancelled. `null` for COMPLETED returns                       |
| `cancelledBy`         | `string?`    | Yes      | **NEW** — Who cancelled the return. `null` for COMPLETED returns                           |
| `cancelledAt`         | `string?`    | Yes      | **NEW** — UTC ISO 8601 timestamp of cancellation (server-generated). `null` for COMPLETED  |
| `deleted`             | `bool`       | No       | Soft-delete flag. `false` for cancel, `true` for delete                                    |
| `deletedAt`           | `string?`    | Yes      | UTC ISO 8601. When soft-deleted                                                            |
| `createdAt`           | `string?`    | Yes      | UTC ISO 8601. When created                                                                 |
| `updatedAt`           | `string?`    | Yes      | UTC ISO 8601. When last updated                                                            |
| `version`             | `int`        | Yes      | Optimistic locking version. Increments on cancel                                           |
| `purchaseReturnItems` | `array`      | Yes      | Array of PurchaseReturnItemDO (see below)                                                  |

### PurchaseReturnItemDO (Nested in Response)

| Field              | Type      | Nullable | Notes                                                       |
| ------------------ | --------- | -------- | ----------------------------------------------------------- |
| `id`               | `int`     | No       | Unique identifier                                           |
| `itemId`           | `int`     | No       | Item being returned                                         |
| `itemVariantId`    | `int?`    | Yes      | Variant ID if applicable                                    |
| `variantSku`       | `string?` | Yes      | SKU of the variant                                          |
| `variantName`      | `string?` | Yes      | Display name of the variant (e.g., `"Red / Large"`)         |
| `quantity`         | `string`  | No       | Decimal string (e.g., `"5.0000"`). Must be > 0              |
| `unitPrice`        | `string`  | No       | Decimal string. Unit price from the original invoice         |
| `returnReason`     | `string`  | No       | One of: `DEFECT`, `SPOILT`, `BROKEN`, `WRONG_ITEM`, `OTHER` |
| `remark`           | `string?` | Yes      | Required when `returnReason` is `OTHER`                     |
| `createdAt`        | `string?` | Yes      | UTC ISO 8601                                                |
| `updatedAt`        | `string?` | Yes      | UTC ISO 8601                                                |
| `item`             | `object`  | Yes      | Nested item details (only in detail/cancel response)        |

### Item Object (Nested in PurchaseReturnItemDO)

| Field           | Type      | Notes                    |
| --------------- | --------- | ------------------------ |
| `id`            | `int`     | Item ID                  |
| `itemName`      | `string`  | Display name of the item |
| `itemCode`      | `string`  | Item code/SKU            |
| `unitOfMeasure` | `string`  | e.g., `"PCS"`, `"KG"`   |

### Return Reason Enum

| Value        | Description                    |
| ------------ | ------------------------------ |
| `DEFECT`     | Manufacturing defect           |
| `SPOILT`     | Spoilt/expired                 |
| `BROKEN`     | Physically broken              |
| `WRONG_ITEM` | Wrong item delivered           |
| `OTHER`      | Other reason (remark required) |

---

## Quick Integration Checklist

- [ ] Add `cancelReason`, `cancelledBy`, `cancelledAt` columns to local SQLite/database schema
- [ ] Update purchase return model/entity (DO) to include the 3 new fields
- [ ] Implement cancel API call: `PUT /purchaseReturn/cancel/:id`
- [ ] Add cancel button on purchase return detail view (only for `status === 'COMPLETED'`)
- [ ] Add confirmation dialog with optional cancel reason input
- [ ] Handle error responses (already cancelled, not found)
- [ ] Display cancelled status with visual indicator in list views
- [ ] Show cancel audit info (`cancelledBy`, `cancelledAt`, `cancelReason`) in detail view
- [ ] Keep items listed for cancelled returns (read-only)
- [ ] Update sync logic to handle the 3 new fields
- [ ] Test: Cancel a return, verify stock summaries update on invoice/PO/settlement views
- [ ] Test: Cancel a return, then create a new return for the same items — verify it works
