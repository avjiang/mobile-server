# Frontend Integration Guide: Purchase Return Info in Procurement List Endpoints

## Overview

This document describes the new purchase return summary fields added to all procurement module list endpoints. These changes enable the frontend to display return information across all procurement views without needing separate API calls.

**Key Points:**

- All new fields are **backward compatible** (purely additive)
- **List endpoints** (`getAll`, `getByDateRange`) return **summary fields only** (count, total amount, flag)
- **Detail endpoints** (`getById`) return **full purchase return data** including items
- All queries use **batch fetching** with indexes for optimal performance

---

## Important: List vs Detail Response

| Endpoint Type     | Returns                                                        |
| ----------------- | -------------------------------------------------------------- |
| `getAll` / `sync` | Summary only: `returnCount`, `totalReturnAmount`, `hasReturns` |
| `getByDateRange`  | Summary only: `returnCount`, `totalReturnAmount`, `hasReturns` |
| `getById` / `:id` | Full data: `purchaseReturns[]` array + summary fields          |

This design keeps list responses lightweight while providing full details when viewing a single record.

---

## New Fields Added to List Endpoints

### Common Fields (Added to All Modules)

| Field               | Type             | Description                                  |
| ------------------- | ---------------- | -------------------------------------------- |
| `returnCount`       | Number           | Total number of purchase returns             |
| `totalReturnAmount` | String (Decimal) | Sum of all return amounts (e.g., "300.0000") |
| `hasReturns`        | Boolean          | True if `returnCount > 0`                    |

---

## Module-Specific Changes

### 1. Invoice Module

**Affected Endpoints:**

- `GET /invoice/sync` (getAll)
- `GET /invoice/dateRange` (getByDateRange)

**New Fields in Response:**

```json
{
  "invoices": [
    {
      "id": 1,
      "invoiceNumber": "INV-2024-001",
      "totalAmount": "5300.0000",
      "status": "PAID",
      "itemCount": 5,
      "deliveryOrderCount": 2,
      "returnCount": 1,
      "totalReturnAmount": "300.0000",
      "hasReturns": true
    }
  ],
  "total": 50,
  "serverTimestamp": "2024-01-26T10:00:00.000Z"
}
```

**Display Recommendation:**

- Show return badge/indicator when `hasReturns` is true
- Display `returnCount` in parentheses: "Returns (1)"

---

### 2. Delivery Order Module

**Affected Endpoints:**

- `GET /deliveryOrder/sync` (getAll)
- `GET /deliveryOrder/dateRange` (getByDateRange)
- `GET /deliveryOrder/:id` (getById - includes full `purchaseReturns` array)

**New Fields in List Response:**

```json
{
  "deliveryOrders": [
    {
      "id": 10,
      "trackingNumber": "TRK-2024-001",
      "invoiceNumber": "INV-2024-001",
      "returnCount": 1,
      "totalReturnAmount": "300.0000",
      "hasReturns": true
    }
  ]
}
```

**New Fields in getById Response:**

```json
{
  "id": 10,
  "trackingNumber": "TRK-2024-001",
  "purchaseReturns": [
    {
      "id": 1,
      "returnNumber": "RTN-2024-001",
      "returnDate": "2024-03-15T00:00:00.000Z",
      "totalReturnAmount": "300.0000",
      "purchaseReturnItems": [...]
    }
  ],
  "returnCount": 1,
  "totalReturnAmount": "300.0000",
  "hasReturns": true
}
```

---

### 3. Purchase Order Module

**Affected Endpoints:**

- `GET /purchaseOrder/sync` (getAll)
- `GET /purchaseOrder/dateRange` (getByDateRange)
- `GET /purchaseOrder/:id` (getById - includes full `purchaseReturns` array)

**Note:** Returns are aggregated across **all invoices** linked to the purchase order.

**New Fields in List Response:**

```json
{
  "purchaseOrders": [
    {
      "id": 5,
      "purchaseOrderNumber": "PO-2024-001",
      "status": "COMPLETED",
      "itemCount": 3,
      "deliveryOrderCount": 2,
      "invoiceCount": 2,
      "settledInvoiceCount": 2,
      "returnCount": 2,
      "totalReturnAmount": "500.0000",
      "hasReturns": true
    }
  ]
}
```

**New Fields in getById Response:**

```json
{
  "id": 5,
  "purchaseOrderNumber": "PO-2024-001",
  "purchaseReturns": [
    {
      "id": 1,
      "returnNumber": "RTN-2024-001",
      "invoiceId": 10,
      "totalReturnAmount": "300.0000",
      "purchaseReturnItems": [...]
    },
    {
      "id": 2,
      "returnNumber": "RTN-2024-002",
      "invoiceId": 11,
      "totalReturnAmount": "200.0000",
      "purchaseReturnItems": [...]
    }
  ],
  "returnCount": 2,
  "totalReturnAmount": "500.0000",
  "hasReturns": true
}
```

---

### 4. Invoice Settlement Module

**Affected Endpoints:**

- `GET /invoiceSettlement/sync` (getSettlements)
- `GET /invoiceSettlement/dateRange` (getByDateRange)
- `GET /invoiceSettlement/:id` (getById - already had returns, now consistent)

**Note:** Returns are linked via `invoiceSettlementId` on PurchaseReturn.

**New Fields in List Response:**

```json
{
  "settlements": [
    {
      "id": 1,
      "settlementNumber": "STL-2024-001",
      "settlementAmount": "10600.0000",
      "invoiceCount": 2,
      "returnCount": 1,
      "totalReturnAmount": "300.0000",
      "netSettlementAmount": "10300.0000",
      "hasReturns": true
    }
  ]
}
```

**Additional Field:**
| Field | Type | Description |
|-------|------|-------------|
| `netSettlementAmount` | String (Decimal) | `settlementAmount - totalReturnAmount` |

**Display Recommendation:**

```
Settlement Amount:     10,600.00
Total Returns:           -300.00
─────────────────────────────────
Net Settlement:        10,300.00
```

---

### 5. Quotation Module

**Affected Endpoints:**

- `GET /quotation/sync` (getAll)
- `GET /quotation/dateRange` (getByDateRange)
- `GET /quotation/:id` (getById - includes returns at quotation and PO level)

**Note:** Returns are aggregated across the full chain: Quotation -> PurchaseOrders -> Invoices -> PurchaseReturns

**New Fields in List Response:**

```json
{
  "quotations": [
    {
      "id": 1,
      "quotationNumber": "QT-2024-001",
      "status": "CONVERTED",
      "itemCount": 5,
      "purchaseOrderCount": 1,
      "deliveryOrderCount": 2,
      "invoiceCount": 2,
      "settlementCount": 1,
      "returnCount": 2,
      "totalReturnAmount": "500.0000",
      "hasReturns": true
    }
  ]
}
```

**New Fields in getById Response:**

```json
{
  "id": 1,
  "quotationNumber": "QT-2024-001",
  "purchaseOrders": [
    {
      "id": 5,
      "purchaseOrderNumber": "PO-2024-001",
      "purchaseReturns": [...]
    }
  ],
  "purchaseReturns": [...],
  "returnCount": 2,
  "totalReturnAmount": "500.0000",
  "hasReturns": true
}
```

---

## Display Recommendations

### List Views

1. **Return Indicator Badge:**
   - Show a small badge/chip when `hasReturns` is true
   - Use a distinctive color (e.g., orange/yellow for "has returns")
   - Example: "2 Returns" or return icon with count

2. **Quick Summary:**
   - Display `returnCount` alongside other counts
   - Consider showing `totalReturnAmount` if space permits

3. **Filtering/Sorting:**
   - Consider adding filter option: "Has Returns"
   - Consider sorting option by `returnCount` or `totalReturnAmount`

### Detail Views

1. **Returns Section:**
   - Show expandable "Returns" section when `hasReturns` is true
   - List individual returns with their details
   - Show item-level return information

2. **Amount Summary:**
   ```
   Total Amount:         5,300.00
   Returns:               -300.00 (1 return)
   ─────────────────────────────────
   Net Amount:           5,000.00
   ```

---

## Performance Notes

- All return data is fetched using **batch queries** with `IN` clause
- Indexes exist on `purchaseReturn.invoiceId` and `purchaseReturn.invoiceSettlementId`
- Summary fields are computed in-memory after batch fetch (O(n) complexity)
- No N+1 query problems - single batch query per endpoint

---

## TypeScript Interface Updates

```typescript
// Base return summary (used in all list responses)
interface ReturnSummary {
  returnCount: number;
  totalReturnAmount: string; // Decimal as string
  hasReturns: boolean;
}

// Extended for Invoice Settlement
interface SettlementReturnSummary extends ReturnSummary {
  netSettlementAmount: string; // Decimal as string
}

// Update your existing interfaces to include ReturnSummary
interface InvoiceListItem extends ReturnSummary {
  // ... existing fields ...
}

interface DeliveryOrderListItem extends ReturnSummary {
  // ... existing fields ...
}

interface PurchaseOrderListItem extends ReturnSummary {
  // ... existing fields ...
}

interface InvoiceSettlementListItem extends SettlementReturnSummary {
  // ... existing fields ...
}

interface QuotationListItem extends ReturnSummary {
  // ... existing fields ...
}
```

---

## Questions?

Contact the backend team for any clarification on these changes.
