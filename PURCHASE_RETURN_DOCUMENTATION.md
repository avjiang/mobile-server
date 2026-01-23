# Purchase Return Module Documentation

## Overview

The Purchase Return module handles the return of items after invoice settlement (defect/broken/spoilt items). Returns are linked to the original invoice and automatically adjust stock levels upon creation.

---

## UX Flow (Flutter App)

```
1. User opens Invoice detail (settled invoice with status "PAID")
2. User taps "Report Return" button
3. App shows list of items from that invoice
4. User selects items to return:
   - Tap item → Enter quantity to return (must be <= original quantity)
   - Select reason: Defect / Spoilt / Broken / Wrong Item / Other
   - Optional: Add remark for each item
5. User taps "Submit Return"
6. App calls POST /purchaseReturn/create
7. Backend automatically:
   - Creates PurchaseReturn + PurchaseReturnItems
   - Reduces StockBalance (availableQuantity & onHandQuantity)
   - Creates StockMovement (type: "Purchase Return")
   - Creates negative StockReceipt (for FIFO tracking)
8. App shows success + return summary
```

---

## Database Schema

### PurchaseReturn

```prisma
model PurchaseReturn {
  id                Int       @id @default(autoincrement())
  returnNumber      String    @unique
  invoiceId         Int       // Linked to original invoice
  outletId          Int
  supplierId        Int
  returnDate        DateTime
  status            String    // COMPLETED, CANCELLED
  totalReturnAmount Decimal?  @db.Decimal(15, 4)
  remark            String?
  performedBy       String?
  deleted           Boolean   @default(false)
  deletedAt         DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  version           Int       @default(1)

  // Relations
  invoice             Invoice              @relation(fields: [invoiceId], references: [id])
  supplier            Supplier             @relation(fields: [supplierId], references: [id])
  purchaseReturnItems PurchaseReturnItem[]
}
```

### PurchaseReturnItem

```prisma
model PurchaseReturnItem {
  id               Int       @id @default(autoincrement())
  purchaseReturnId Int
  itemId           Int
  itemVariantId    Int?
  quantity         Decimal   @db.Decimal(15, 4)  // Quantity being returned
  unitPrice        Decimal   @db.Decimal(15, 4)  // Original unit price from invoice
  returnReason     String    // DEFECT, SPOILT, BROKEN, WRONG_ITEM, OTHER
  remark           String?
  deleted          Boolean   @default(false)
  deletedAt        DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  version          Int       @default(1)

  // Relations
  purchaseReturn   PurchaseReturn @relation(fields: [purchaseReturnId], references: [id])
  item             Item           @relation(fields: [itemId], references: [id])
  itemVariant      ItemVariant?   @relation(fields: [itemVariantId], references: [id])
}
```

---

## API Reference

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/purchaseReturn/sync` | Get all returns (delta sync) |
| GET | `/purchaseReturn/dateRange` | Get returns by date range |
| GET | `/purchaseReturn/byInvoice/:invoiceId` | Get returns for specific invoice |
| GET | `/purchaseReturn/:id` | Get return by ID |
| POST | `/purchaseReturn/create` | Create purchase return |
| PUT | `/purchaseReturn/update` | Update return |
| DELETE | `/purchaseReturn/:id` | Cancel/delete return |

---

### GET /purchaseReturn/sync

Get all purchase returns with delta sync support.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `outletId` | number | Yes | Filter by outlet ID |
| `skip` | number | No | Pagination offset (default: 0) |
| `take` | number | No | Number of records (default: 100) |
| `lastSyncTimestamp` | string | No | ISO timestamp for delta sync |

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "returnNumber": "RTN-2024-001",
      "invoiceId": 5,
      "outletId": 1,
      "supplierId": 3,
      "returnDate": "2024-03-15T00:00:00.000Z",
      "status": "COMPLETED",
      "totalReturnAmount": "500.0000",
      "remark": "Items damaged during storage",
      "performedBy": "warehouse@example.com",
      "deleted": false,
      "createdAt": "2024-03-15T10:00:00.000Z",
      "updatedAt": "2024-03-15T10:00:00.000Z",
      "version": 1,
      "purchaseReturnItems": [
        {
          "id": 1,
          "itemId": 100,
          "itemVariantId": null,
          "quantity": "5.0000",
          "unitPrice": "100.0000",
          "returnReason": "BROKEN",
          "remark": "Packaging was crushed"
        }
      ],
      "invoice": {
        "id": 5,
        "invoiceNumber": "INV-2024-001",
        "totalAmount": "5300.0000"
      },
      "supplier": {
        "id": 3,
        "supplierName": "XYZ Supplier Ltd."
      }
    }
  ],
  "total": 10,
  "serverTimestamp": "2024-03-15T11:00:00.000Z"
}
```

---

### GET /purchaseReturn/dateRange

Get purchase returns within a specific date range.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `outletId` | number | Yes | Filter by outlet ID |
| `startDate` | string | Yes | Start date (ISO format) |
| `endDate` | string | Yes | End date (ISO format) |
| `skip` | number | No | Pagination offset |
| `take` | number | No | Number of records |
| `lastSyncTimestamp` | string | No | ISO timestamp for delta sync |

**Response:** Same format as `/purchaseReturn/sync`

---

### GET /purchaseReturn/byInvoice/:invoiceId

Get all purchase returns for a specific invoice.

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `invoiceId` | number | Yes | The invoice ID |

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "returnNumber": "RTN-2024-001",
      "invoiceId": 5,
      "returnDate": "2024-03-15T00:00:00.000Z",
      "status": "COMPLETED",
      "totalReturnAmount": "500.0000",
      "purchaseReturnItems": [...]
    }
  ]
}
```

---

### GET /purchaseReturn/:id

Get a single purchase return by ID with full details.

**Response:**
```json
{
  "id": 1,
  "returnNumber": "RTN-2024-001",
  "invoiceId": 5,
  "outletId": 1,
  "supplierId": 3,
  "returnDate": "2024-03-15T00:00:00.000Z",
  "status": "COMPLETED",
  "totalReturnAmount": "500.0000",
  "remark": "Items damaged during storage",
  "performedBy": "warehouse@example.com",
  "deleted": false,
  "createdAt": "2024-03-15T10:00:00.000Z",
  "updatedAt": "2024-03-15T10:00:00.000Z",
  "version": 1,
  "purchaseReturnItems": [
    {
      "id": 1,
      "itemId": 100,
      "itemVariantId": null,
      "quantity": "5.0000",
      "unitPrice": "100.0000",
      "returnReason": "BROKEN",
      "remark": "Packaging was crushed",
      "item": {
        "id": 100,
        "itemName": "Widget A",
        "itemCode": "WGT-001"
      }
    }
  ],
  "invoice": {
    "id": 5,
    "invoiceNumber": "INV-2024-001",
    "taxInvoiceNumber": "TAX-001",
    "totalAmount": "5300.0000",
    "invoiceDate": "2024-01-26T00:00:00.000Z",
    "purchaseOrder": {
      "id": 10,
      "purchaseOrderNumber": "PO-2024-001"
    }
  },
  "supplier": {
    "id": 3,
    "supplierName": "XYZ Supplier Ltd."
  }
}
```

---

### POST /purchaseReturn/create

Create a new purchase return. Stock is automatically adjusted upon creation.

**Request Body:**
```json
{
  "purchaseReturns": [
    {
      "returnNumber": "RTN-2024-002",
      "invoiceId": 5,
      "outletId": 1,
      "supplierId": 3,
      "returnDate": "2024-03-20",
      "remark": "Quality issues found during inspection",
      "performedBy": "warehouse@example.com",
      "purchaseReturnItems": [
        {
          "itemId": 100,
          "itemVariantId": null,
          "quantity": 3,
          "unitPrice": 100,
          "returnReason": "DEFECT",
          "remark": "Manufacturing defect in batch"
        },
        {
          "itemId": 101,
          "itemVariantId": 5,
          "quantity": 2,
          "unitPrice": 150,
          "returnReason": "SPOILT",
          "remark": "Expired before delivery"
        }
      ]
    }
  ]
}
```

**Response:**
```json
[
  {
    "id": 2,
    "returnNumber": "RTN-2024-002",
    "invoiceId": 5,
    "outletId": 1,
    "supplierId": 3,
    "returnDate": "2024-03-20T00:00:00.000Z",
    "status": "COMPLETED",
    "totalReturnAmount": "600.0000",
    "remark": "Quality issues found during inspection",
    "performedBy": "warehouse@example.com",
    "purchaseReturnItems": [
      {
        "id": 3,
        "itemId": 100,
        "quantity": "3.0000",
        "unitPrice": "100.0000",
        "returnReason": "DEFECT"
      },
      {
        "id": 4,
        "itemId": 101,
        "itemVariantId": 5,
        "quantity": "2.0000",
        "unitPrice": "150.0000",
        "returnReason": "SPOILT"
      }
    ]
  }
]
```

**Automatic Stock Operations:**

On successful creation:
1. **StockBalance**: Reduces `availableQuantity` and `onHandQuantity` for each returned item
2. **StockMovement**: Creates record with:
   - `movementType`: "Purchase Return"
   - `availableQuantityDelta`: negative value (e.g., -3)
   - `onHandQuantityDelta`: negative value (e.g., -3)
   - `reason`: "Return from invoice {invoiceNumber} - {returnReason}"
   - `documentId`: purchaseReturnId
3. **StockReceipt**: Creates record with negative quantity for FIFO cost tracking

---

### PUT /purchaseReturn/update

Update a purchase return (only remark and performedBy can be updated after creation).

**Request Body:**
```json
{
  "id": 2,
  "returnNumber": "RTN-2024-002",
  "remark": "Updated remark with additional details"
}
```

**Response:**
```json
{
  "id": 2,
  "returnNumber": "RTN-2024-002",
  "status": "COMPLETED",
  "remark": "Updated remark with additional details",
  "updatedAt": "2024-03-20T12:00:00.000Z",
  "version": 2
}
```

---

### DELETE /purchaseReturn/:id

Cancel/delete a purchase return. This reverses the stock operations.

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | Yes | The purchase return ID |

**Response:**
```json
{
  "message": "Purchase return RTN-2024-002 cancelled successfully"
}
```

**Stock Reversal on Cancellation:**

1. **StockBalance**: Increases `availableQuantity` and `onHandQuantity` by the returned quantities
2. **StockMovement**: Creates reversal record with:
   - `movementType`: "Purchase Return Reversal"
   - Positive quantity deltas
   - `reason`: "Cancelled return {returnNumber}"
3. **StockReceipt**: Soft deletes the negative receipt records

---

## Return Reasons

| Reason | Code | Description |
|--------|------|-------------|
| Manufacturing Defect | `DEFECT` | Product has manufacturing issues |
| Expired/Spoiled | `SPOILT` | Product expired or spoiled |
| Damaged | `BROKEN` | Damaged during delivery or storage |
| Wrong Item | `WRONG_ITEM` | Supplier delivered incorrect item |
| Other | `OTHER` | Other reason (remark required) |

---

## Status Values

| Status | Description |
|--------|-------------|
| `COMPLETED` | Return created and stock adjusted (default) |
| `CANCELLED` | Return voided, stock restored |

**Note:** Returns go directly to `COMPLETED` status upon creation. There is no pending/approval workflow.

---

## Request Type Definitions (TypeScript)

```typescript
interface PurchaseReturnItemInput {
  id?: number;
  itemId: number;
  itemVariantId?: number | null;
  quantity: number;
  unitPrice: number;
  returnReason: 'DEFECT' | 'SPOILT' | 'BROKEN' | 'WRONG_ITEM' | 'OTHER';
  remark?: string;
}

interface PurchaseReturnInput {
  id?: number;
  returnNumber: string;
  invoiceId: number;
  outletId: number;
  supplierId: number;
  returnDate: Date | string;
  remark?: string;
  performedBy?: string;
  purchaseReturnItems: PurchaseReturnItemInput[];
}

interface CreatePurchaseReturnRequestBody {
  purchaseReturns: PurchaseReturnInput[];
}
```

---

## Error Handling

### Common Validation Errors

| Error | Cause |
|-------|-------|
| `User not authenticated` | Missing or invalid auth token |
| `Request body is empty` | Empty POST/PUT body |
| `Valid outletId is required` | Missing or invalid outlet ID |
| `ID format incorrect` | Non-numeric ID parameter |
| `Invoice not found` | Invoice ID doesn't exist |
| `Invalid return reason` | Reason not in allowed list |
| `Quantity exceeds invoice quantity` | Returning more than was invoiced |

### Business Rule Violations

| Error | Cause |
|-------|-------|
| `Invoice not settled` | Cannot return items from unpaid invoice |
| `Return already cancelled` | Attempting to cancel an already cancelled return |
| `Insufficient stock` | Cannot cancel return - would cause negative stock |

---

## Integration Notes

### Linking to Invoice

When displaying the "Report Return" button on Invoice detail screen:
- Only show for invoices with `status: "PAID"`
- Fetch existing returns using `GET /purchaseReturn/byInvoice/:invoiceId`
- Calculate remaining returnable quantity per item

### Validation Before Submit

Before calling `POST /purchaseReturn/create`:
1. Validate all quantities are > 0
2. Validate quantities don't exceed original invoice quantities minus already returned quantities
3. Ensure `returnReason` is selected for each item
4. If `returnReason` is "OTHER", ensure `remark` is provided

### After Successful Return

1. Refresh the invoice detail to show updated return history
2. Navigate to return detail or show success summary
3. Stock levels are automatically updated - no additional calls needed
