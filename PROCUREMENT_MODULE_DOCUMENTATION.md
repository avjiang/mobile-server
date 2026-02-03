# Procurement Module Documentation

## Overview

The Procurement module manages the complete purchase-to-payment cycle for inventory management. It handles supplier quotations, purchase orders, delivery receipts, invoicing, and payment settlements with automatic stock integration.

### Key Features

| Feature              | Description                                                                        |
| -------------------- | ---------------------------------------------------------------------------------- |
| Quotation Management | Request and compare supplier quotations                                            |
| Purchase Order       | Create and track purchase orders from quotations                                   |
| Delivery Order       | Track deliveries with automatic stock updates                                      |
| Invoice Management   | Process supplier invoices linked to deliveries                                     |
| Invoice Settlement   | Batch settlement of multiple invoices with rebate support                          |
| Purchase Return      | Return defect/broken/spoilt items after settlement with automatic stock adjustment |
| Stock Integration    | Automatic StockBalance, StockReceipt, and StockMovement updates                    |
| Delta Sync           | Efficient data synchronization using timestamps                                    |
| Soft Delete          | All records support soft deletion with audit trail                                 |

### Procurement Workflow

```
┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────┐    ┌────────────────────┐
│  Quotation  │───▶│ Purchase Order  │───▶│ Delivery Order  │───▶│ Invoice │───▶│ Invoice Settlement │
└─────────────┘    └─────────────────┘    └─────────────────┘    └─────────┘    └────────────────────┘
                                                   │                                       │
                                                   ▼                                       ▼
                                          ┌───────────────────┐                 ┌─────────────────┐
                                          │ Stock Integration │                 │ Purchase Return │
                                          │  - StockBalance   │◀────────────────│ (Post-Settlement│
                                          │  - StockReceipt   │                 │  Defect/Damage) │
                                          │  - StockMovement  │                 └─────────────────┘
                                          └───────────────────┘
```

---

## Module Architecture

### Directory Structure

```
src/
├── quotation/
│   ├── quotation.controller.ts
│   ├── quotation.service.ts
│   └── quotation.request.ts
├── purchase_order/
│   ├── purchase-order.controller.ts
│   ├── purchase-order.service.ts
│   └── purchase-order.request.ts
├── delivery_order/
│   ├── delivery-order.controller.ts
│   ├── delivery-order.service.ts
│   └── delivery-order.request.ts
├── invoice/
│   ├── invoice.controller.ts
│   ├── invoice.service.ts
│   └── invoice.request.ts
├── invoice_settlement/
│   ├── invoice_settlement.controller.ts
│   ├── invoice_settlement.service.ts
│   └── invoice_settlement.request.ts
├── purchase_return/
│   ├── purchase-return.controller.ts
│   ├── purchase-return.service.ts
│   └── purchase-return.request.ts
└── procurement/
    └── PROCUREMENT_MODULE_DOCUMENTATION.md
```

### Route Registration (src/index.ts)

```typescript
app.use("/quotation", require("./quotation/quotation.controller"));
app.use(
  "/purchaseOrder",
  require("./purchase_order/purchase-order.controller"),
);
app.use(
  "/deliveryOrder",
  require("./delivery_order/delivery-order.controller"),
);
app.use("/invoice", require("./invoice/invoice.controller"));
app.use(
  "/invoiceSettlement",
  require("./invoice_settlement/invoice_settlement.controller"),
);
app.use(
  "/purchaseReturn",
  require("./purchase_return/purchase-return.controller"),
);
```

---

## Database Schema

### Quotation

```prisma
model Quotation {
  id                  Int             @id @default(autoincrement())
  quotationNumber     String          @unique
  outletId            Int
  supplierId          Int
  quotationDate       DateTime?
  validUntilDate      DateTime?
  sessionId           Int?
  discountType        String?         // "PERCENTAGE", "FIXED_AMOUNT"
  discountAmount      Decimal?        @db.Decimal(15, 4)
  serviceChargeAmount Decimal?        @db.Decimal(15, 4)
  taxAmount           Decimal?        @db.Decimal(15, 4)
  roundingAmount      Decimal?        @db.Decimal(15, 4)
  subtotalAmount      Decimal?        @db.Decimal(15, 4)
  totalAmount         Decimal?        @db.Decimal(15, 4)
  status              String?         // DRAFT, CONFIRMED, CONVERTED, CANCELLED
  remark              String?
  currency            String          @default("IDR")
  performedBy         String?
  convertedToPOAt     DateTime?
  convertedPOId       Int?
  isTaxInclusive      Boolean?        @default(false)
  deleted             Boolean         @default(false)
  deletedAt           DateTime?
  createdAt           DateTime?       @default(now())
  updatedAt           DateTime?       @updatedAt
  version             Int?            @default(1)

  // Relations
  quotationItems      QuotationItem[]
  purchaseOrders      PurchaseOrder[]
}

model QuotationItem {
  id             Int       @id @default(autoincrement())
  quotationId    Int
  itemId         Int
  itemVariantId  Int?
  variantSku     String?
  variantName    String?
  quantity       Decimal   @db.Decimal(15, 4)
  unitPrice      Decimal   @db.Decimal(15, 4)
  taxAmount      Decimal?  @db.Decimal(15, 4)
  discountType   String?
  discountAmount Decimal?
  subtotal       Decimal   @db.Decimal(15, 4)
  remark         String?
  leadTime       Int?      // Lead time in days
  isAccepted     Boolean?  // Whether item was accepted
  version        Int?      @default(1)
  deleted        Boolean   @default(false)
  deletedAt      DateTime?
  createdAt      DateTime? @default(now())
  updatedAt      DateTime? @updatedAt
}
```

### Purchase Order

```prisma
model PurchaseOrder {
  id                  Int                 @id @default(autoincrement())
  purchaseOrderNumber String              @unique
  outletId            Int
  supplierId          Int
  quotationId         Int?                // Reference to source quotation
  purchaseOrderDate   DateTime?
  sessionId           Int?
  discountType        String?
  discountAmount      Decimal?            @db.Decimal(15, 4)
  serviceChargeAmount Decimal?            @db.Decimal(15, 4)
  taxAmount           Decimal?            @db.Decimal(15, 4)
  roundingAmount      Decimal?            @db.Decimal(15, 4)
  subtotalAmount      Decimal?            @db.Decimal(15, 4)
  totalAmount         Decimal?            @db.Decimal(15, 4)
  status              String              // CONFIRMED, PARTIALLY DELIVERED, DELIVERED, COMPLETED, CANCELLED
  remark              String?
  currency            String              @default("IDR")
  performedBy         String?
  isTaxInclusive      Boolean?            @default(false)
  deleted             Boolean             @default(false)
  deletedAt           DateTime?
  createdAt           DateTime?           @default(now())
  updatedAt           DateTime?           @updatedAt
  version             Int?                @default(1)

  // Relations
  purchaseOrderItems  PurchaseOrderItem[]
  deliveryOrders      DeliveryOrder[]
  invoices            Invoice[]
}

model PurchaseOrderItem {
  id              Int       @id @default(autoincrement())
  purchaseOrderId Int
  itemId          Int
  itemVariantId   Int?
  variantSku      String?
  variantName     String?
  quantity        Decimal   @db.Decimal(15, 4)
  unitPrice       Decimal   @db.Decimal(15, 4)
  taxAmount       Decimal?  @db.Decimal(15, 4)
  discountType    String?
  discountAmount  Decimal?
  subtotal        Decimal   @db.Decimal(15, 4)
  remark          String?
  version         Int?      @default(1)
  deleted         Boolean   @default(false)
  deletedAt       DateTime?
  createdAt       DateTime? @default(now())
  updatedAt       DateTime?
}
```

### Delivery Order

```prisma
model DeliveryOrder {
  id                 Int                 @id @default(autoincrement())
  trackingNumber     String?
  outletId           Int
  customerId         Int?
  purchaseOrderId    Int?
  supplierId         Int?
  invoiceId          Int?
  sessionId          Int?
  deliveryDate       DateTime?
  deliveryStreet     String?
  deliveryCity       String?
  deliveryState      String?
  deliveryPostalCode String?
  deliveryCountry    String?
  status             String              // Pending, Completed, CANCELLED
  remark             String?
  performedBy        String?
  deleted            Boolean             @default(false)
  deletedAt          DateTime?
  createdAt          DateTime?           @default(now())
  updatedAt          DateTime?           @updatedAt
  version            Int?                @default(1)

  // Relations
  purchaseOrder      PurchaseOrder?
  deliveryOrderItems DeliveryOrderItem[]
  stockReceipts      StockReceipt[]
}

model DeliveryOrderItem {
  id               Int     @id @default(autoincrement())
  deliveryOrderId  Int
  itemId           Int
  itemVariantId    Int?
  variantSku       String?
  variantName      String?
  orderedQuantity  Float
  receivedQuantity Float
  unitPrice        Decimal? @db.Decimal(15, 4)
  deliveryFee      Decimal? @db.Decimal(15, 4)
  remark           String?
  version          Int?     @default(1)
  deleted          Boolean  @default(false)
  deletedAt        DateTime?
  createdAt        DateTime? @default(now())
  updatedAt        DateTime? @updatedAt
}
```

### Invoice

```prisma
model Invoice {
  id                  Int        @id @default(autoincrement())
  invoiceNumber       String     @unique
  taxInvoiceNumber    String
  purchaseOrderId     Int?
  invoiceSettlementId Int?
  supplierId          Int?
  outletId            Int
  subtotalAmount      Decimal    @db.Decimal(15, 4)
  taxAmount           Decimal    @db.Decimal(15, 4)
  sessionId           Int?
  discountType        String?
  discountAmount      Decimal    @db.Decimal(15, 4)
  totalAmount         Decimal    @db.Decimal(15, 4)
  currency            String
  status              String     // Completed, PAID, CANCELLED
  invoiceDate         DateTime?
  paymentDate         DateTime?
  dueDate             DateTime?
  remark              String?
  performedBy         String?
  isTaxInclusive      Boolean?   @default(false)
  deleted             Boolean    @default(false)
  deletedAt           DateTime?
  createdAt           DateTime?  @default(now())
  updatedAt           DateTime?  @updatedAt
  version             Int?       @default(1)

  // Relations
  purchaseOrder       PurchaseOrder?
  invoiceItems        InvoiceItem[]
  deliveryOrders      DeliveryOrder[]
}

model InvoiceItem {
  id             Int       @id @default(autoincrement())
  invoiceId      Int
  itemId         Int
  itemVariantId  Int?
  variantSku     String?
  variantName    String?
  quantity       Decimal   @db.Decimal(15, 4)
  unitPrice      Decimal   @db.Decimal(15, 4)
  discountType   String?
  discountAmount Decimal?
  taxAmount      Decimal?  @db.Decimal(15, 4)
  subtotal       Decimal   @db.Decimal(15, 4)
  remark         String?
  version        Int?      @default(1)
  deleted        Boolean   @default(false)
  deletedAt      DateTime?
  createdAt      DateTime? @default(now())
  updatedAt      DateTime?
}
```

### Invoice Settlement

```prisma
model InvoiceSettlement {
  id                 Int       @id @default(autoincrement())
  settlementNumber   String    @unique
  settlementDate     DateTime
  settlementType     String    // PARTIAL, FULL, BULK
  paymentMethod      String?   // CASH, BANK_TRANSFER, CHEQUE
  settlementAmount   Decimal   @db.Decimal(15, 4)
  currency           String
  exchangeRate       Decimal?  @db.Decimal(15, 8)
  reference          String?
  remark             String?
  status             String    @default("COMPLETED") // COMPLETED, INCOMPLETE
  performedBy        String?
  totalRebateAmount  Decimal   @default(0) @db.Decimal(15, 4)
  rebateReason       String?   // EARLY_PAYMENT, BULK_DISCOUNT, PRICE_ADJUSTMENT
  totalInvoiceCount  Int       @default(0)
  totalInvoiceAmount Decimal   @default(0) @db.Decimal(15, 4)
  deleted            Boolean   @default(false)
  deletedAt          DateTime?
  createdAt          DateTime? @default(now())
  updatedAt          DateTime? @updatedAt
  version            Int?      @default(1)

  // Relations
  invoices           Invoice[]
}
```

### Stock Tables (Related)

```prisma
model StockBalance {
  id                Int       @id @default(autoincrement())
  itemId            Int
  outletId          Int
  itemVariantId     Int?
  availableQuantity Decimal   @db.Decimal(15, 4)
  onHandQuantity    Decimal   @db.Decimal(15, 4)
  reorderThreshold  Decimal?  @db.Decimal(15, 4)
  lastRestockDate   DateTime?
  deleted           Boolean   @default(false)
  deletedAt         DateTime?
  createdAt         DateTime? @default(now())
  updatedAt         DateTime? @updatedAt
  version           Int?      @default(1)
}

model StockReceipt {
  id              Int       @id @default(autoincrement())
  itemId          Int
  outletId        Int
  itemVariantId   Int?
  deliveryOrderId Int?      // Links to DeliveryOrder
  quantity        Decimal   @db.Decimal(15, 4)
  cost            Decimal   @db.Decimal(15, 4) // Unit cost at receipt time
  receiptDate     DateTime  @default(now())
  deleted         Boolean   @default(false)
  deletedAt       DateTime?
  createdAt       DateTime? @default(now())
  updatedAt       DateTime? @updatedAt
  version         Int?      @default(1)
}

model StockMovement {
  id                        Int       @id @default(autoincrement())
  itemId                    Int
  outletId                  Int
  itemVariantId             Int?
  previousAvailableQuantity Decimal   @db.Decimal(15, 4)
  previousOnHandQuantity    Decimal   @db.Decimal(15, 4)
  availableQuantityDelta    Decimal   @db.Decimal(15, 4)
  onHandQuantityDelta       Decimal   @db.Decimal(15, 4)
  movementType              String    // "Delivery Receipt", "Purchase Return", etc.
  documentId                Int       // Reference to source document
  reason                    String
  remark                    String
  performedBy               String?
  deleted                   Boolean   @default(false)
  createdAt                 DateTime? @default(now())
  updatedAt                 DateTime? @updatedAt
  version                   Int?      @default(1)
}
```

### Purchase Return

```prisma
model PurchaseReturn {
  id                    Int                  @id @default(autoincrement())
  returnNumber          String               @unique
  invoiceId             Int                  // Linked to original invoice
  invoiceSettlementId   Int?                 // Auto-populated from invoice on creation
  outletId              Int
  supplierId            Int
  returnDate            DateTime
  status                String               @default("COMPLETED") // COMPLETED, CANCELLED
  totalReturnAmount     Decimal?             @db.Decimal(15, 4)
  remark                String?
  performedBy           String?
  deleted               Boolean              @default(false)
  deletedAt             DateTime?
  createdAt             DateTime?            @default(now())
  updatedAt             DateTime?            @updatedAt
  version               Int?                 @default(1)

  // Relations
  invoice               Invoice              @relation(fields: [invoiceId], references: [id])
  invoiceSettlement     InvoiceSettlement?   @relation(fields: [invoiceSettlementId], references: [id])
  supplier              Supplier             @relation(fields: [supplierId], references: [id])
  outlet                Outlet               @relation(fields: [outletId], references: [id])
  purchaseReturnItems   PurchaseReturnItem[]

  @@index([invoiceSettlementId])
}

model PurchaseReturnItem {
  id               Int            @id @default(autoincrement())
  purchaseReturnId Int
  itemId           Int
  itemVariantId    Int?
  stockReceiptId   Int?           // Links to the StockReceipt affected by this return
  variantSku       String?
  variantName      String?
  quantity         Decimal        @db.Decimal(15, 4)  // Quantity being returned
  unitPrice        Decimal        @db.Decimal(15, 4)  // Original unit price from invoice
  returnReason     String         // DEFECT, SPOILT, BROKEN, WRONG_ITEM, OTHER
  remark           String?
  deleted          Boolean        @default(false)
  deletedAt        DateTime?
  createdAt        DateTime?      @default(now())
  updatedAt        DateTime?      @updatedAt
  version          Int?           @default(1)

  // Relations
  purchaseReturn   PurchaseReturn @relation(fields: [purchaseReturnId], references: [id])
  item             Item           @relation(fields: [itemId], references: [id])
  itemVariant      ItemVariant?   @relation(fields: [itemVariantId], references: [id])
  stockReceipt     StockReceipt?  @relation(fields: [stockReceiptId], references: [id])
}
```

---

## API Reference

### Common Query Parameters

| Parameter           | Type   | Description                                   |
| ------------------- | ------ | --------------------------------------------- |
| `skip`              | number | Number of records to skip (pagination offset) |
| `take`              | number | Number of records to return (default: 100)    |
| `lastSyncTimestamp` | string | ISO timestamp for delta sync                  |
| `outletId`          | number | Filter by outlet ID                           |
| `startDate`         | string | Start date for date range queries             |
| `endDate`           | string | End date for date range queries               |

### Common Response Format

All sync endpoints return:

```json
{
  "data": [...],
  "total": 50,
  "serverTimestamp": "2024-01-20T10:30:00.000Z"
}
```

### Batch Create Pattern (POST /\*/create)

All `POST /*/create` endpoints follow a **batch create pattern**:

- **Request**: Accepts an array of items to create (e.g., `{ "quotations": [...] }`)
- **Response**: Returns an array of created records

**Why arrays instead of single objects?**

1. **Atomic batch operations**: All items in the request are processed within a single database transaction. Either all succeed or all fail - no partial creates.

2. **Reduced HTTP overhead**: Create multiple records in one API call instead of multiple round-trips.

3. **Consistent interface**: The same endpoint handles both single and bulk creates. For a single record, simply pass an array with one item.

**Example - Single record create:**

```json
// Request
{
  "quotations": [{ "quotationNumber": "QT-001", ... }]
}

// Response
[{ "id": 1, "quotationNumber": "QT-001", ... }]
```

**Example - Bulk create:**

```json
// Request
{
  "quotations": [
    { "quotationNumber": "QT-001", ... },
    { "quotationNumber": "QT-002", ... }
  ]
}

// Response
[
  { "id": 1, "quotationNumber": "QT-001", ... },
  { "id": 2, "quotationNumber": "QT-002", ... }
]
```

**Frontend handling:** Always expect an array response. For single creates, access the first element: `response[0]`.

---

## 1. Quotation API

### Endpoints

| Method | Endpoint               | Description                     |
| ------ | ---------------------- | ------------------------------- |
| GET    | `/quotation/sync`      | Get all quotations (delta sync) |
| GET    | `/quotation/dateRange` | Get quotations by date range    |
| GET    | `/quotation/:id`       | Get quotation by ID             |
| POST   | `/quotation/create`    | Create quotations               |
| PUT    | `/quotation/update`    | Update quotation                |
| POST   | `/quotation/cancel`    | Cancel quotation                |
| DELETE | `/quotation/:id`       | Delete quotation                |

### GET /quotation/sync

**Query Parameters:**

- `outletId` (required): number
- `skip`: number (default: 0)
- `take`: number (default: 100)
- `lastSyncTimestamp`: string (ISO date)

**Response:**

```json
{
  "data": [
    {
      "id": 1,
      "quotationNumber": "QT-2024-001",
      "outletId": 1,
      "supplierId": 5,
      "quotationDate": "2024-01-15T00:00:00.000Z",
      "validUntilDate": "2024-02-15T00:00:00.000Z",
      "discountType": "PERCENTAGE",
      "discountAmount": "5.0000",
      "serviceChargeAmount": "0.0000",
      "taxAmount": "100.0000",
      "roundingAmount": "0.0000",
      "subtotalAmount": "1000.0000",
      "totalAmount": "1045.0000",
      "status": "CONFIRMED",
      "remark": "Q1 bulk order",
      "currency": "IDR",
      "performedBy": "admin@example.com",
      "isTaxInclusive": false,
      "deleted": false,
      "createdAt": "2024-01-15T08:00:00.000Z",
      "updatedAt": "2024-01-15T08:00:00.000Z",
      "version": 1,
      "quotationItems": [
        {
          "id": 1,
          "itemId": 100,
          "itemVariantId": null,
          "variantSku": null,
          "variantName": null,
          "quantity": "50.0000",
          "unitPrice": "20.0000",
          "taxAmount": "100.0000",
          "discountType": null,
          "discountAmount": "0.0000",
          "subtotal": "1000.0000",
          "remark": "",
          "leadTime": 7,
          "isAccepted": true
        }
      ],
      "supplier": {
        "id": 5,
        "supplierName": "ABC Supplier Co."
      },
      "itemCount": 1,
      "purchaseOrderCount": 1,
      "deliveryOrderCount": 2,
      "invoiceCount": 1,
      "settlementCount": 1
    }
  ],
  "total": 50,
  "serverTimestamp": "2024-01-20T10:30:00.000Z"
}
```

### GET /quotation/dateRange

**Query Parameters:**

- `outletId` (required): number
- `startDate` (required): string (ISO date)
- `endDate` (required): string (ISO date)
- `skip`: number
- `take`: number
- `lastSyncTimestamp`: string

**Response:** Same format as `/quotation/sync`

### GET /quotation/:id

**Response:**

```json
{
  "id": 1,
  "quotationNumber": "QT-2024-001",
  "outletId": 1,
  "supplierId": 5,
  "quotationDate": "2024-01-15T00:00:00.000Z",
  "validUntilDate": "2024-02-15T00:00:00.000Z",
  "subtotalAmount": "1000.0000",
  "taxAmount": "100.0000",
  "totalAmount": "1045.0000",
  "status": "CONFIRMED",
  "currency": "IDR",
  "isTaxInclusive": false,
  "quotationItems": [...],
  "supplier": {...},
  "purchaseOrders": [...],
  "itemCount": 1,
  "purchaseOrderCount": 1,
  "deliveryOrderCount": 2,
  "invoiceCount": 1,
  "settlementCount": 1
}
```

### POST /quotation/create

**Request Body:**

```json
{
  "quotations": [
    {
      "quotationNumber": "QT-2024-002",
      "outletId": 1,
      "supplierId": 5,
      "quotationDate": "2024-01-20",
      "validUntilDate": "2024-02-20",
      "discountType": "PERCENTAGE",
      "discountAmount": 5,
      "taxAmount": 100,
      "subtotalAmount": 1000,
      "totalAmount": 1045,
      "status": "DRAFT",
      "currency": "IDR",
      "isTaxInclusive": false,
      "performedBy": "user@example.com",
      "quotationItems": [
        {
          "itemId": 100,
          "itemVariantId": null,
          "quantity": 50,
          "unitPrice": 20,
          "taxAmount": 100,
          "discountAmount": 0,
          "subtotal": 1000,
          "leadTime": 7,
          "isAccepted": true
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
    "quotationNumber": "QT-2024-002",
    "outletId": 1,
    "supplierId": 5,
    "status": "DRAFT",
    "quotationItems": [...]
  }
]
```

### PUT /quotation/update

**Request Body:**

```json
{
  "id": 1,
  "quotationNumber": "QT-2024-001",
  "status": "CONFIRMED",
  "validUntilDate": "2024-03-15",
  "quotationItems": [
    {
      "id": 1,
      "itemId": 100,
      "quantity": 60,
      "unitPrice": 20,
      "subtotal": 1200
    }
  ]
}
```

### POST /quotation/cancel

**Request Body:**

```json
{
  "id": 1,
  "quotationNumber": "QT-2024-001"
}
```

**Response:**

```json
{
  "id": 1,
  "quotationNumber": "QT-2024-001",
  "status": "CANCELLED"
}
```

---

## 2. Purchase Order API

### Endpoints

| Method | Endpoint                   | Description              |
| ------ | -------------------------- | ------------------------ |
| GET    | `/purchaseOrder/sync`      | Get all POs (delta sync) |
| GET    | `/purchaseOrder/dateRange` | Get POs by date range    |
| GET    | `/purchaseOrder/:id`       | Get PO by ID             |
| POST   | `/purchaseOrder/create`    | Create POs               |
| PUT    | `/purchaseOrder/update`    | Update PO                |
| POST   | `/purchaseOrder/cancel`    | Cancel PO                |
| DELETE | `/purchaseOrder/:id`       | Delete PO                |

### GET /purchaseOrder/sync

**Query Parameters:**

- `outletId` (required): number
- `skip`: number (default: 0)
- `take`: number (default: 100)
- `lastSyncTimestamp`: string

**Response:**

```json
{
  "data": [
    {
      "id": 1,
      "purchaseOrderNumber": "PO-2024-001",
      "quotationId": 5,
      "outletId": 1,
      "supplierId": 3,
      "purchaseOrderDate": "2024-01-20T00:00:00.000Z",
      "discountType": "FIXED_AMOUNT",
      "discountAmount": "100.0000",
      "serviceChargeAmount": "0.0000",
      "taxAmount": "500.0000",
      "subtotalAmount": "5000.0000",
      "totalAmount": "5400.0000",
      "status": "PARTIALLY DELIVERED",
      "currency": "IDR",
      "isTaxInclusive": true,
      "deleted": false,
      "createdAt": "2024-01-20T08:00:00.000Z",
      "updatedAt": "2024-01-25T10:00:00.000Z",
      "purchaseOrderItems": [
        {
          "id": 1,
          "itemId": 100,
          "itemVariantId": null,
          "variantSku": null,
          "variantName": null,
          "quantity": "50.0000",
          "unitPrice": "100.0000",
          "taxAmount": "500.0000",
          "discountAmount": "0.0000",
          "subtotal": "5000.0000"
        }
      ],
      "supplier": {
        "id": 3,
        "supplierName": "XYZ Supplier Ltd."
      },
      "itemCount": 1,
      "deliveryOrderCount": 2,
      "invoiceCount": 1,
      "invoiceSettlementCount": 1
    }
  ],
  "total": 25,
  "serverTimestamp": "2024-01-25T10:30:00.000Z"
}
```

### GET /purchaseOrder/:id

**Response:**

```json
{
  "id": 1,
  "purchaseOrderNumber": "PO-2024-001",
  "quotationId": 5,
  "outletId": 1,
  "supplierId": 3,
  "purchaseOrderDate": "2024-01-20T00:00:00.000Z",
  "subtotalAmount": "5000.0000",
  "taxAmount": "500.0000",
  "totalAmount": "5400.0000",
  "status": "PARTIALLY DELIVERED",
  "currency": "IDR",
  "isTaxInclusive": true,
  "purchaseOrderItems": [
    {
      "id": 1,
      "itemId": 100,
      "quantity": "50.0000",
      "unitPrice": "100.0000",
      "subtotal": "5000.0000",
      "item": {
        "id": 100,
        "itemName": "Widget A"
      }
    }
  ],
  "deliveryOrders": [
    {
      "id": 10,
      "trackingNumber": "TRK-001",
      "deliveryDate": "2024-01-22T00:00:00.000Z",
      "status": "Completed"
    },
    {
      "id": 11,
      "trackingNumber": "TRK-002",
      "deliveryDate": "2024-01-25T00:00:00.000Z",
      "status": "Pending"
    }
  ],
  "invoices": [
    {
      "id": 5,
      "invoiceNumber": "INV-2024-001",
      "totalAmount": "5400.0000",
      "status": "PAID"
    }
  ],
  "invoiceSettlements": [
    {
      "id": 1,
      "settlementNumber": "STL-2024-001",
      "settlementAmount": "5400.0000",
      "status": "COMPLETED"
    }
  ],
  "quotation": {
    "id": 5,
    "quotationNumber": "QT-2024-005"
  },
  "supplier": {
    "id": 3,
    "supplierName": "XYZ Supplier Ltd."
  },
  "itemCount": 1,
  "deliveryOrderCount": 2,
  "invoiceCount": 1,
  "invoiceSettlementCount": 1
}
```

### POST /purchaseOrder/create

**Request Body:**

```json
{
  "purchaseOrders": [
    {
      "purchaseOrderNumber": "PO-2024-002",
      "quotationId": 5,
      "outletId": 1,
      "supplierId": 3,
      "purchaseOrderDate": "2024-01-25",
      "discountType": "PERCENTAGE",
      "discountAmount": 5,
      "taxAmount": 500,
      "subtotalAmount": 5000,
      "totalAmount": 5225,
      "status": "CONFIRMED",
      "currency": "IDR",
      "isTaxInclusive": false,
      "performedBy": "admin@example.com",
      "purchaseOrderItems": [
        {
          "itemId": 100,
          "itemVariantId": null,
          "quantity": 50,
          "unitPrice": 100,
          "taxAmount": 500,
          "discountAmount": 0,
          "subtotal": 5000
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
    "purchaseOrderNumber": "PO-2024-002",
    "status": "CONFIRMED",
    "purchaseOrderItems": [...]
  }
]
```

### PUT /purchaseOrder/update

**Request Body:**

```json
{
  "id": 1,
  "purchaseOrderNumber": "PO-2024-001",
  "status": "DELIVERED",
  "remark": "All items received"
}
```

### POST /purchaseOrder/cancel

**Request Body:**

```json
{
  "id": 1,
  "purchaseOrderNumber": "PO-2024-001"
}
```

**Response:**

```json
{
  "id": 1,
  "purchaseOrderNumber": "PO-2024-001",
  "status": "CANCELLED"
}
```

---

## 3. Delivery Order API

### Endpoints

| Method | Endpoint                              | Description                   |
| ------ | ------------------------------------- | ----------------------------- |
| GET    | `/deliveryOrder/sync`                 | Get all DOs (delta sync)      |
| GET    | `/deliveryOrder/dateRange`            | Get DOs by date range         |
| GET    | `/deliveryOrder/uninvoiced/:outletId` | Get uninvoiced DOs for outlet |
| GET    | `/deliveryOrder/:id`                  | Get DO by ID                  |
| POST   | `/deliveryOrder/create`               | Create DOs                    |
| PUT    | `/deliveryOrder/update`               | Update DO                     |
| DELETE | `/deliveryOrder/:id`                  | Delete DO                     |

### GET /deliveryOrder/sync

**Query Parameters:**

- `outletId` (required): number
- `skip`: number
- `take`: number
- `lastSyncTimestamp`: string

**Response:**

```json
{
  "data": [
    {
      "id": 10,
      "trackingNumber": "TRK-2024-001",
      "outletId": 1,
      "purchaseOrderId": 5,
      "supplierId": 3,
      "invoiceId": null,
      "deliveryDate": "2024-01-25T00:00:00.000Z",
      "deliveryStreet": "123 Main St",
      "deliveryCity": "Jakarta",
      "deliveryState": "DKI Jakarta",
      "deliveryPostalCode": "12345",
      "deliveryCountry": "Indonesia",
      "status": "Completed",
      "remark": "",
      "performedBy": "warehouse@example.com",
      "deleted": false,
      "createdAt": "2024-01-25T08:00:00.000Z",
      "updatedAt": "2024-01-25T10:00:00.000Z",
      "deliveryOrderItems": [
        {
          "id": 50,
          "itemId": 100,
          "itemVariantId": null,
          "variantSku": null,
          "variantName": null,
          "orderedQuantity": 50,
          "receivedQuantity": 50,
          "unitPrice": "100.0000",
          "deliveryFee": "10.0000",
          "remark": ""
        }
      ],
      "purchaseOrder": {
        "id": 5,
        "purchaseOrderNumber": "PO-2024-001"
      },
      "supplier": {
        "id": 3,
        "supplierName": "XYZ Supplier Ltd."
      }
    }
  ],
  "total": 15,
  "serverTimestamp": "2024-01-25T11:00:00.000Z"
}
```

### GET /deliveryOrder/uninvoiced/:outletId

Gets all delivery orders that have not been linked to an invoice yet.

**Response:**

```json
{
  "data": [
    {
      "id": 12,
      "trackingNumber": "TRK-2024-003",
      "outletId": 1,
      "purchaseOrderId": 7,
      "deliveryDate": "2024-01-28T00:00:00.000Z",
      "status": "Completed",
      "invoiceId": null,
      "deliveryOrderItems": [...]
    }
  ]
}
```

### POST /deliveryOrder/create

**Request Body:**

```json
{
  "deliveryOrders": [
    {
      "outletId": 1,
      "purchaseOrderId": 5,
      "supplierId": 3,
      "deliveryDate": "2024-01-25",
      "trackingNumber": "TRK-2024-002",
      "deliveryStreet": "123 Main St",
      "deliveryCity": "Jakarta",
      "deliveryState": "DKI Jakarta",
      "deliveryPostalCode": "12345",
      "deliveryCountry": "Indonesia",
      "status": "Pending",
      "performedBy": "warehouse@example.com",
      "deliveryOrderItems": [
        {
          "itemId": 100,
          "itemVariantId": null,
          "orderedQuantity": 50,
          "receivedQuantity": 50,
          "unitPrice": 100,
          "deliveryFee": 10
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
    "id": 11,
    "trackingNumber": "TRK-2024-002",
    "outletId": 1,
    "purchaseOrderId": 5,
    "status": "Pending",
    "deliveryOrderItems": [
      {
        "id": 55,
        "itemId": 100,
        "orderedQuantity": 50,
        "receivedQuantity": 50,
        "unitPrice": "100.0000",
        "deliveryFee": "10.0000"
      }
    ]
  }
]
```

**Note:** On delivery order creation, the system automatically:

1. **Updates StockBalance**: Adds `receivedQuantity` to `availableQuantity` and `onHandQuantity`
2. **Creates StockMovement**: Type "Delivery Receipt" with quantity delta
3. **Creates StockReceipt**: With cost = `unitPrice + (deliveryFee / quantity)`
4. **Updates PurchaseOrder status**: CONFIRMED → PARTIALLY DELIVERED or DELIVERED

### PUT /deliveryOrder/update

**Request Body:**

```json
{
  "id": 11,
  "trackingNumber": "TRK-2024-002",
  "status": "Completed",
  "deliveryOrderItems": [
    {
      "id": 55,
      "itemId": 100,
      "orderedQuantity": 50,
      "receivedQuantity": 45,
      "remark": "5 items damaged"
    }
  ]
}
```

---

## 4. Invoice API

### Endpoints

| Method | Endpoint                   | Description                       |
| ------ | -------------------------- | --------------------------------- |
| GET    | `/invoice/sync`            | Get all invoices (delta sync)     |
| GET    | `/invoice/dateRange`       | Get invoices by date range        |
| GET    | `/invoice/getAllCompleted` | Get completed invoices for outlet |
| GET    | `/invoice/:id`             | Get invoice by ID                 |
| POST   | `/invoice/create`          | Create invoices                   |
| PUT    | `/invoice/update`          | Update invoice                    |
| DELETE | `/invoice/:id`             | Delete invoice                    |

### GET /invoice/sync

**Query Parameters:**

- `outletId` (required): number
- `skip`: number
- `take`: number
- `lastSyncTimestamp`: string

**Response:**

```json
{
  "data": [
    {
      "id": 1,
      "invoiceNumber": "INV-2024-001",
      "taxInvoiceNumber": "TAX-001",
      "purchaseOrderId": 5,
      "invoiceSettlementId": 1,
      "supplierId": 3,
      "outletId": 1,
      "subtotalAmount": "5000.0000",
      "taxAmount": "500.0000",
      "discountType": "FIXED_AMOUNT",
      "discountAmount": "200.0000",
      "totalAmount": "5300.0000",
      "currency": "IDR",
      "status": "PAID",
      "invoiceDate": "2024-01-26T00:00:00.000Z",
      "paymentDate": "2024-02-01T00:00:00.000Z",
      "dueDate": "2024-02-25T00:00:00.000Z",
      "remark": "",
      "isTaxInclusive": true,
      "deleted": false,
      "createdAt": "2024-01-26T08:00:00.000Z",
      "updatedAt": "2024-02-01T10:00:00.000Z",
      "invoiceItems": [
        {
          "id": 1,
          "itemId": 100,
          "itemVariantId": null,
          "quantity": "50.0000",
          "unitPrice": "100.0000",
          "discountType": "FIXED_AMOUNT",
          "discountAmount": "200.0000",
          "taxAmount": "500.0000",
          "subtotal": "4800.0000"
        }
      ],
      "purchaseOrder": {
        "id": 5,
        "purchaseOrderNumber": "PO-2024-001"
      },
      "supplier": {
        "id": 3,
        "supplierName": "XYZ Supplier Ltd."
      }
    }
  ],
  "total": 20,
  "serverTimestamp": "2024-02-01T11:00:00.000Z"
}
```

### GET /invoice/getAllCompleted

Gets invoices with status "Completed" that are ready for settlement.

**Query Parameters:**

- `outletId` (required): number

**Response:**

```json
{
  "data": [
    {
      "id": 2,
      "invoiceNumber": "INV-2024-002",
      "totalAmount": "3500.0000",
      "status": "Completed",
      "invoiceDate": "2024-01-28T00:00:00.000Z",
      "dueDate": "2024-02-27T00:00:00.000Z"
    }
  ],
  "total": 5
}
```

### GET /invoice/:id

**Response:**

```json
{
  "id": 1,
  "invoiceNumber": "INV-2024-001",
  "taxInvoiceNumber": "TAX-001",
  "purchaseOrderId": 5,
  "supplierId": 3,
  "outletId": 1,
  "subtotalAmount": "5000.0000",
  "taxAmount": "500.0000",
  "discountAmount": "200.0000",
  "totalAmount": "5300.0000",
  "currency": "IDR",
  "status": "PAID",
  "invoiceDate": "2024-01-26T00:00:00.000Z",
  "paymentDate": "2024-02-01T00:00:00.000Z",
  "isTaxInclusive": true,
  "invoiceItems": [
    {
      "id": 1,
      "itemId": 100,
      "quantity": "50.0000",
      "unitPrice": "100.0000",
      "discountAmount": "200.0000",
      "subtotal": "4800.0000",
      "returnedQuantity": "3.0000",
      "remainingQuantity": "47.0000",
      "item": {
        "id": 100,
        "itemName": "Widget A"
      }
    }
  ],
  "purchaseOrder": {
    "id": 5,
    "purchaseOrderNumber": "PO-2024-001",
    "totalAmount": "5400.0000"
  },
  "deliveryOrders": [
    {
      "id": 10,
      "trackingNumber": "TRK-2024-001",
      "deliveryDate": "2024-01-25T00:00:00.000Z",
      "status": "Completed"
    }
  ],
  "invoiceSettlement": {
    "id": 1,
    "settlementNumber": "STL-2024-001",
    "settlementDate": "2024-02-01T00:00:00.000Z",
    "settlementAmount": "10600.0000",
    "status": "COMPLETED"
  },
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
  "returnCount": 1,
  "hasFullyReturnedItems": false,
  "supplier": {
    "id": 3,
    "supplierName": "XYZ Supplier Ltd."
  }
}
```

> **Note:** The following fields are computed at query time (not stored in database):
> - `totalReturnAmount` - Sum of all purchase returns for this invoice
> - `netAmount` - `totalAmount` - `totalReturnAmount`
> - `returnedQuantity` (per item) - Total quantity already returned for this item
> - `remainingQuantity` (per item) - Available quantity for return (`quantity - returnedQuantity`)
> - `hasFullyReturnedItems` - True if any item has `remainingQuantity <= 0`

### POST /invoice/create

**Request Body:**

```json
{
  "invoices": [
    {
      "invoiceNumber": "INV-2024-003",
      "taxInvoiceNumber": "TAX-003",
      "purchaseOrderId": 7,
      "supplierId": 3,
      "deliveryOrderIds": [12, 13],
      "outletId": 1,
      "subtotalAmount": 3000,
      "taxAmount": 300,
      "discountType": "PERCENTAGE",
      "discountAmount": 5,
      "totalAmount": 3135,
      "currency": "IDR",
      "isTaxInclusive": false,
      "status": "Completed",
      "invoiceDate": "2024-02-01",
      "dueDate": "2024-03-01",
      "performedBy": "finance@example.com",
      "invoiceItems": [
        {
          "itemId": 100,
          "quantity": 30,
          "unitPrice": 100,
          "taxAmount": 300,
          "discountAmount": 150,
          "subtotal": 2850
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
    "id": 3,
    "invoiceNumber": "INV-2024-003",
    "status": "Completed",
    "totalAmount": "3135.0000",
    "invoiceItems": [...]
  }
]
```

**Note:** On invoice creation, the system:

1. Links delivery orders to the invoice (sets `invoiceId` on DeliveryOrder)
2. Updates StockReceipt costs based on invoice item prices
3. May update PurchaseOrder status to "COMPLETED" if all items are invoiced

### PUT /invoice/update

**Request Body:**

```json
{
  "id": 3,
  "invoiceNumber": "INV-2024-003",
  "status": "PAID",
  "paymentDate": "2024-02-15"
}
```

---

## 5. Invoice Settlement API

### Endpoints

| Method | Endpoint                       | Description                   |
| ------ | ------------------------------ | ----------------------------- |
| GET    | `/invoiceSettlement/sync`      | Get all settlements           |
| GET    | `/invoiceSettlement/dateRange` | Get settlements by date range |
| GET    | `/invoiceSettlement/:id`       | Get settlement by ID          |
| POST   | `/invoiceSettlement/create`    | Create settlement             |
| PUT    | `/invoiceSettlement/update`    | Update settlement             |

### GET /invoiceSettlement/sync

**Query Parameters:**

- `skip`: number
- `take`: number
- `lastSyncTimestamp`: string
- `startDate`: string
- `endDate`: string

**Response:**

```json
{
  "data": [
    {
      "id": 1,
      "settlementNumber": "STL-2024-001",
      "settlementDate": "2024-02-01T00:00:00.000Z",
      "settlementType": "FULL",
      "paymentMethod": "BANK_TRANSFER",
      "settlementAmount": "10600.0000",
      "currency": "IDR",
      "exchangeRate": "1.00000000",
      "reference": "TRF-20240201-001",
      "remark": "",
      "status": "COMPLETED",
      "performedBy": "finance@example.com",
      "totalRebateAmount": "0.0000",
      "rebateReason": null,
      "totalInvoiceCount": 2,
      "totalInvoiceAmount": "10600.0000",
      "deleted": false,
      "createdAt": "2024-02-01T10:00:00.000Z",
      "updatedAt": "2024-02-01T10:00:00.000Z",
      "invoices": [
        {
          "id": 1,
          "invoiceNumber": "INV-2024-001",
          "totalAmount": "5300.0000",
          "status": "PAID"
        },
        {
          "id": 2,
          "invoiceNumber": "INV-2024-002",
          "totalAmount": "5300.0000",
          "status": "PAID"
        }
      ]
    }
  ],
  "total": 10,
  "serverTimestamp": "2024-02-05T10:00:00.000Z"
}
```

### GET /invoiceSettlement/dateRange

**Query Parameters:**

- `outletId` (required): number
- `startDate` (required): string
- `endDate` (required): string
- `skip`: number
- `take`: number
- `lastSyncTimestamp`: string

**Response:** Same format as `/invoiceSettlement/sync`

### GET /invoiceSettlement/:id

**Response:**

```json
{
  "id": 1,
  "settlementNumber": "STL-2024-001",
  "settlementDate": "2024-02-01T00:00:00.000Z",
  "settlementType": "FULL",
  "paymentMethod": "BANK_TRANSFER",
  "settlementAmount": "10600.0000",
  "currency": "IDR",
  "exchangeRate": "1.00000000",
  "reference": "TRF-20240201-001",
  "status": "COMPLETED",
  "totalRebateAmount": "0.0000",
  "totalInvoiceCount": 2,
  "totalInvoiceAmount": "10600.0000",
  "invoices": [
    {
      "id": 1,
      "invoiceNumber": "INV-2024-001",
      "taxInvoiceNumber": "12345",
      "totalAmount": "5300.0000",
      "status": "PAID",
      "purchaseReturns": [
        {
          "id": 1,
          "returnNumber": "RTN-2024-001",
          "returnDate": "2024-03-15T00:00:00.000Z",
          "status": "COMPLETED",
          "totalReturnAmount": "300.0000",
          "purchaseReturnItems": [
            {
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
    },
    {
      "id": 2,
      "invoiceNumber": "INV-2024-002",
      "taxInvoiceNumber": "12346",
      "totalAmount": "5300.0000",
      "status": "PAID",
      "purchaseReturns": [],
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
      "totalReturnAmount": "300.0000"
    }
  ],
  "purchaseOrders": [
    {
      "id": 5,
      "purchaseOrderNumber": "PO-2024-001",
      "totalAmount": "5400.0000",
      "status": "COMPLETED"
    },
    {
      "id": 6,
      "purchaseOrderNumber": "PO-2024-002",
      "totalAmount": "5400.0000",
      "status": "COMPLETED"
    }
  ],
  "deliveryOrders": [...],
  "purchaseOrderCount": 2,
  "deliveryOrderCount": 4,
  "totalReturnAmount": "300.0000",
  "netSettlementAmount": "10300.0000",
  "returnCount": 1
}
```

> **Note:** Purchase returns are linked to the settlement via `invoiceSettlementId` (auto-populated from invoice on creation). The `totalReturnAmount`, `netAmount`, and `netSettlementAmount` are computed at query time:
> - Per invoice: `netAmount` = `totalAmount` - `totalReturnAmount`
> - Settlement level: `netSettlementAmount` = `settlementAmount` - `totalReturnAmount`

### POST /invoiceSettlement/create

**Request Body:**

```json
{
  "settlements": [
    {
      "settlementNumber": "STL-2024-002",
      "settlementDate": "2024-02-15",
      "settlementType": "FULL",
      "paymentMethod": "BANK_TRANSFER",
      "settlementAmount": 8500,
      "currency": "IDR",
      "exchangeRate": 1,
      "reference": "TRF-20240215-001",
      "remark": "Monthly settlement",
      "performedBy": "finance@example.com",
      "totalRebateAmount": 100,
      "rebateReason": "EARLY_PAYMENT",
      "invoiceIds": [3, 4],
      "invoiceTaxNumbers": [12347, 12348]
    }
  ]
}
```

**Response:**

```json
[
  {
    "id": 2,
    "settlementNumber": "STL-2024-002",
    "settlementDate": "2024-02-15T00:00:00.000Z",
    "settlementType": "FULL",
    "settlementAmount": "8500.0000",
    "status": "COMPLETED",
    "totalRebateAmount": "100.0000",
    "rebateReason": "EARLY_PAYMENT",
    "totalInvoiceCount": 2,
    "totalInvoiceAmount": "8600.0000",
    "invoices": [
      {
        "id": 3,
        "invoiceNumber": "INV-2024-003",
        "taxInvoiceNumber": "12347",
        "status": "PAID"
      },
      {
        "id": 4,
        "invoiceNumber": "INV-2024-004",
        "taxInvoiceNumber": "12348",
        "status": "PAID"
      }
    ]
  }
]
```

**Note:** On settlement creation:

1. Updates all linked invoices to status "PAID"
2. Sets `paymentDate` on invoices
3. Updates `taxInvoiceNumber` on invoices from `invoiceTaxNumbers` array
4. Distributes rebate amount proportionally across invoices if applicable

### PUT /invoiceSettlement/update

**Request Body:**

```json
{
  "id": 2,
  "settlementNumber": "STL-2024-002",
  "remark": "Updated remark",
  "reference": "TRF-20240215-002"
}
```

---

## 6. Purchase Return API

Purchase returns handle the return of items after invoice settlement (defect/broken/spoilt items). Returns are linked to the original invoice and automatically adjust stock levels upon creation.

### Endpoints

| Method | Endpoint                               | Description                      |
| ------ | -------------------------------------- | -------------------------------- |
| GET    | `/purchaseReturn/sync`                 | Get all returns (delta sync)     |
| GET    | `/purchaseReturn/dateRange`            | Get returns by date range        |
| GET    | `/purchaseReturn/byInvoice/:invoiceId` | Get returns for specific invoice |
| GET    | `/purchaseReturn/:id`                  | Get return by ID                 |
| POST   | `/purchaseReturn/create`               | Create purchase return           |
| PUT    | `/purchaseReturn/update`               | Update return                    |
| DELETE | `/purchaseReturn/:id`                  | Cancel/delete return             |

### GET /purchaseReturn/sync

**Query Parameters:**

- `outletId` (required): number
- `skip`: number (default: 0)
- `take`: number (default: 100)
- `lastSyncTimestamp`: string (ISO date)

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

### GET /purchaseReturn/dateRange

**Query Parameters:**

- `outletId` (required): number
- `startDate` (required): string (ISO date)
- `endDate` (required): string (ISO date)
- `skip`: number
- `take`: number
- `lastSyncTimestamp`: string

**Response:** Same format as `/purchaseReturn/sync`

### GET /purchaseReturn/byInvoice/:invoiceId

Get all purchase returns for a specific invoice.

**URL Parameters:**

- `invoiceId` (required): number

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

### GET /purchaseReturn/:id

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

**Note:** On successful creation, stock operations are performed automatically (see Stock Integration section).

**Validation - Return Quantity Check:**

The system validates that the requested return quantity does not exceed the available quantity for each item:

```
availableQuantity = invoiceItem.quantity - totalPreviouslyReturned
if (requestedQuantity > availableQuantity) → REJECT
```

**Validation Error Response (HTTP 400):**

```json
{
  "success": false,
  "error": {
    "name": "RequestValidateError",
    "message": "Return quantity exceeds available quantity for one or more items. Item 100: requested 8.0000, available 7.0000 (invoice qty: 10.0000, already returned: 3.0000)"
  }
}
```

This prevents returning more items than were originally invoiced, even across multiple returns.

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

### DELETE /purchaseReturn/:id

Cancel/delete a purchase return. This reverses the stock operations.

**URL Parameters:**

- `id` (required): number

**Response:**

```json
{
  "message": "Purchase return RTN-2024-002 cancelled successfully"
}
```

**Note:** On cancellation, stock operations are reversed (see Stock Integration section).

### Return Reasons

| Reason               | Code         | Description                        |
| -------------------- | ------------ | ---------------------------------- |
| Manufacturing Defect | `DEFECT`     | Product has manufacturing issues   |
| Expired/Spoiled      | `SPOILT`     | Product expired or spoiled         |
| Damaged              | `BROKEN`     | Damaged during delivery or storage |
| Wrong Item           | `WRONG_ITEM` | Supplier delivered incorrect item  |
| Other                | `OTHER`      | Other reason (remark required)     |

---

## Stock Integration

### Delivery Order Stock Operations

When a delivery order is created, the following stock operations occur automatically:

#### 1. StockBalance Update

```typescript
// For each delivery order item:
StockBalance.update({
  where: { itemId, outletId, itemVariantId },
  data: {
    availableQuantity: { increment: receivedQuantity },
    onHandQuantity: { increment: receivedQuantity },
    lastRestockDate: deliveryDate,
  },
});
```

#### 2. StockReceipt Creation

```typescript
// For each delivery order item:
StockReceipt.create({
  data: {
    itemId: item.itemId,
    outletId: deliveryOrder.outletId,
    itemVariantId: item.itemVariantId,
    deliveryOrderId: deliveryOrder.id,
    quantity: item.receivedQuantity,
    cost: unitPrice + deliveryFee / quantity, // Per-unit cost
    receiptDate: deliveryDate,
  },
});
```

#### 3. StockMovement Creation

```typescript
// For each delivery order item:
StockMovement.create({
  data: {
    itemId: item.itemId,
    outletId: deliveryOrder.outletId,
    itemVariantId: item.itemVariantId,
    previousAvailableQuantity: currentBalance.availableQuantity,
    previousOnHandQuantity: currentBalance.onHandQuantity,
    availableQuantityDelta: item.receivedQuantity,
    onHandQuantityDelta: item.receivedQuantity,
    movementType: "Delivery Receipt",
    documentId: deliveryOrder.id,
    reason: `Delivery from PO-${purchaseOrderNumber}`,
    performedBy: deliveryOrder.performedBy,
  },
});
```

### Invoice Stock Operations

When an invoice is created:

1. **StockReceipt Cost Update**: Updates the cost on existing StockReceipts linked to the delivery orders, using the final invoice item prices.

### Cancellation Reversal

When a delivery order is cancelled:

1. **StockBalance**: Decrements quantities by the original `receivedQuantity`
2. **StockMovement**: Creates reversal movement with negative deltas
3. **StockReceipt**: Soft deletes related receipts

### Purchase Return Stock Operations

When a purchase return is created, the following stock operations occur automatically:

#### 1. StockBalance Update

```typescript
// For each return item:
StockBalance.update({
  where: { itemId, outletId, itemVariantId },
  data: {
    availableQuantity: { decrement: returnQuantity },
    onHandQuantity: { decrement: returnQuantity },
  },
});
```

#### 2. StockMovement Creation

```typescript
// For each return item:
StockMovement.create({
  data: {
    itemId: item.itemId,
    outletId: purchaseReturn.outletId,
    itemVariantId: item.itemVariantId,
    previousAvailableQuantity: currentBalance.availableQuantity,
    previousOnHandQuantity: currentBalance.onHandQuantity,
    availableQuantityDelta: -item.quantity, // Negative delta
    onHandQuantityDelta: -item.quantity, // Negative delta
    movementType: "Purchase Return",
    documentId: purchaseReturn.id,
    reason: `Return from invoice ${invoiceNumber} - ${returnReason}`,
    performedBy: purchaseReturn.performedBy,
  },
});
```

#### 3. StockReceipt Modification

Instead of creating negative StockReceipt records (which would confuse users editing cost/capital), the system finds and modifies the **existing** StockReceipt created during delivery:

**How it finds the receipt:**
```
Invoice → DeliveryOrders (via invoiceId) → StockReceipt (via deliveryOrderId + itemId + itemVariantId)
```

**Logic:**
```typescript
// Find matching StockReceipt
const matchedReceipt = await tx.stockReceipt.findFirst({
  where: {
    deliveryOrderId: { in: deliveryOrderIds },
    itemId: item.itemId,
    itemVariantId: item.itemVariantId ?? null,
    deleted: false,
  },
});

if (matchedReceipt) {
  if (returnQuantity >= receiptQuantity) {
    // Soft-delete the receipt (full return)
    await tx.stockReceipt.update({
      where: { id: matchedReceipt.id },
      data: { deleted: true, deletedAt: new Date() },
    });
  } else {
    // Reduce the receipt quantity (partial return)
    await tx.stockReceipt.update({
      where: { id: matchedReceipt.id },
      data: { quantity: receiptQuantity - returnQuantity },
    });
  }
}
```

**Tracking:** The `stockReceiptId` is stored in `PurchaseReturnItem` to track which receipt was affected (used for cancellation reversal).

### Purchase Return Cancellation Reversal

When a purchase return is cancelled:

1. **StockBalance**: Increments `availableQuantity` and `onHandQuantity` by the returned quantities
2. **StockMovement**: Creates reversal record with:
   - `movementType`: "Purchase Return Reversal"
   - Positive quantity deltas
   - `reason`: "Cancelled return {returnNumber}"
3. **StockReceipt Restoration**: Using the stored `stockReceiptId`:
   - **If receipt was soft-deleted**: Un-delete it (`deleted: false, deletedAt: null`) and restore original quantity
   - **If receipt quantity was reduced**: Add back the return quantity

### Purchase Return - Invoice Settlement Linkage

Purchase returns are automatically linked to their corresponding Invoice Settlement for tracking and display purposes.

#### How It Works

1. **On Purchase Return Creation**:
   - The system looks up the `invoiceSettlementId` from the linked invoice
   - Automatically populates `invoiceSettlementId` on the purchase return
   - No manual intervention required

2. **Computed Fields** (calculated at query time, not stored):

   | Field | Level | Description |
   |-------|-------|-------------|
   | `totalReturnAmount` | Invoice | Sum of all return amounts for the invoice |
   | `netAmount` | Invoice | `totalAmount` - `totalReturnAmount` |
   | `returnCount` | Invoice | Number of purchase returns for the invoice |
   | `totalReturnAmount` | Settlement | Sum of all return amounts across all invoices |
   | `netSettlementAmount` | Settlement | `settlementAmount` - `totalReturnAmount` |
   | `returnCount` | Settlement | Total number of purchase returns in settlement |

3. **Data Access**:
   - `GET /invoice/:id` - Returns `purchaseReturns` array with computed totals
   - `GET /invoiceSettlement/:id` - Returns `purchaseReturns` at both invoice and settlement level

#### Performance Considerations

- `invoiceSettlementId` is indexed for fast lookups
- Purchase returns are fetched in a single query with the parent record
- Computed totals use in-memory calculation (Decimal.js) to avoid additional queries

---

## Status Tracking

### Status Transitions

#### Quotation

```
DRAFT → CONFIRMED → CONVERTED (to PO)
      ↘ CANCELLED
```

#### Purchase Order

```
CONFIRMED → PARTIALLY DELIVERED → DELIVERED → COMPLETED
          ↘────────────────────↘───────────↘ CANCELLED
```

- **CONFIRMED**: Initial status after creation
- **PARTIALLY DELIVERED**: At least one delivery received, but not all ordered items
- **DELIVERED**: All ordered items received via delivery orders
- **COMPLETED**: All invoices paid and settled
- **CANCELLED**: Manually cancelled

#### Delivery Order

```
Pending → Completed
        ↘ CANCELLED
```

#### Invoice

```
Completed → PAID
          ↘ CANCELLED
```

- **Completed**: Invoice created, ready for settlement
- **PAID**: Invoice settled

#### Invoice Settlement

```
COMPLETED (default)
INCOMPLETE (if partial settlement)
```

#### Purchase Return

```
On Creation → COMPLETED (stock automatically adjusted)
            → CANCELLED (if voided later, stock restored)
```

- **COMPLETED**: Return created and stock adjusted (default status on creation)
- **CANCELLED**: Return voided, stock restored

**Note:** Returns go directly to `COMPLETED` status upon creation. There is no pending/approval workflow.

---

## Error Handling

### Common Validation Errors

| Error                                     | Cause                                           |
| ----------------------------------------- | ----------------------------------------------- |
| `User not authenticated`                  | Missing or invalid auth token                   |
| `Request body is empty`                   | Empty POST/PUT body                             |
| `Valid outletId is required`              | Missing or invalid outlet ID                    |
| `ID format incorrect`                     | Non-numeric ID parameter                        |
| `Both startDate and endDate are required` | Missing date range parameters                   |
| `Date validation error`                   | Invalid date format or endDate before startDate |
| `Update failed: [id] not found`           | Missing ID in update request                    |

### Business Rule Violations

| Error                                    | Cause                                                                 |
| ---------------------------------------- | --------------------------------------------------------------------- |
| `Cannot cancel delivered PO`             | Attempting to cancel PO with deliveries                               |
| `Invoice already settled`                | Attempting to modify settled invoice                                  |
| `Insufficient stock`                     | Stock reversal would cause negative balance                           |
| `Duplicate number`                       | Attempting to create with existing number                             |
| `Return quantity exceeds available qty`  | Return qty > (invoice item qty - already returned qty)                |
| `Item not found in invoice`              | Return item doesn't exist in the original invoice                     |

---

## Related Modules

| Module          | Relation                                    |
| --------------- | ------------------------------------------- |
| **Supplier**    | All procurement documents link to suppliers |
| **Item**        | Line items reference the Item catalog       |
| **ItemVariant** | Optional variant support for items          |
| **Stock**       | Automatic stock updates on delivery         |
| **Outlet**      | Multi-outlet support for all documents      |
| **Session**     | Optional session tracking                   |

---

## Appendix: Request Type Definitions

### Quotation

```typescript
interface QuotationItemInput {
  id?: number;
  itemId: number;
  itemVariantId?: number | null;
  variantSku?: string | null;
  variantName?: string | null;
  quantity: Decimal;
  unitPrice: Decimal;
  taxAmount?: Decimal;
  discountType?: string;
  discountAmount: Decimal;
  subtotal: Decimal;
  remark?: string;
  leadTime?: number;
  isAccepted?: boolean;
}

interface QuotationInput {
  id?: number;
  quotationNumber: string;
  outletId: number;
  supplierId: number;
  sessionId?: number;
  quotationDate?: Date;
  validUntilDate?: Date;
  discountType?: string;
  discountAmount?: Decimal;
  serviceChargeAmount?: Decimal;
  taxAmount?: Decimal;
  roundingAmount?: Decimal;
  isTaxInclusive?: boolean;
  subtotalAmount?: Decimal;
  totalAmount?: Decimal;
  status?: string;
  remark?: string;
  currency?: string;
  performedBy?: string;
  quotationItems?: QuotationItemInput[];
}
```

### Purchase Order

```typescript
interface PurchaseOrderItemInput {
  id?: number;
  itemId: number;
  itemVariantId?: number | null;
  variantSku?: string | null;
  variantName?: string | null;
  quantity: Decimal;
  unitPrice: Decimal;
  taxAmount?: Decimal;
  discountType?: string;
  discountAmount: Decimal;
  subtotal: Decimal;
  remark?: string;
}

interface PurchaseOrderInput {
  id?: number;
  purchaseOrderNumber: string;
  quotationId?: number;
  outletId: number;
  supplierId: number;
  sessionId?: number;
  purchaseOrderDate?: Date;
  discountType?: string;
  discountAmount?: Decimal;
  serviceChargeAmount?: Decimal;
  taxAmount?: Decimal;
  roundingAmount?: Decimal;
  isTaxInclusive?: boolean;
  subtotalAmount: Decimal;
  totalAmount: Decimal;
  status?: string;
  remark?: string;
  currency?: string;
  performedBy?: string;
  purchaseOrderItems?: PurchaseOrderItemInput[];
}
```

### Delivery Order

```typescript
interface DeliveryOrderItemInput {
  id?: number;
  itemId: number;
  itemVariantId?: number | null;
  variantSku?: string | null;
  variantName?: string | null;
  orderedQuantity: number;
  receivedQuantity: number;
  unitPrice?: Decimal;
  deliveryFee?: Decimal;
  remark?: string;
}

interface DeliveryOrderInput {
  id?: number;
  outletId: number;
  customerId?: number;
  purchaseOrderId?: number;
  supplierId?: number;
  sessionId?: number;
  deliveryDate?: Date;
  deliveryStreet?: string;
  deliveryCity?: string;
  deliveryState?: string;
  deliveryPostalCode?: string;
  deliveryCountry?: string;
  trackingNumber?: string;
  status?: string;
  remark?: string;
  performedBy?: string;
  deliveryOrderItems?: DeliveryOrderItemInput[];
}
```

### Invoice

```typescript
interface InvoiceItemInput {
  id?: number;
  itemId: number;
  itemVariantId?: number | null;
  variantSku?: string | null;
  variantName?: string | null;
  quantity: number;
  unitPrice: number;
  taxAmount?: number;
  discountType?: string;
  discountAmount: number;
  subtotal: number;
  remark?: string;
}

interface InvoiceInput {
  id?: number;
  invoiceNumber: string;
  taxInvoiceNumber?: string;
  purchaseOrderId?: number;
  supplierId?: number;
  sessionId?: number;
  deliveryOrderIds?: number[];
  outletId: number;
  subtotalAmount: number;
  taxAmount: number;
  discountType?: string;
  discountAmount: number;
  totalAmount: number;
  currency?: string;
  isTaxInclusive?: boolean;
  status: string;
  invoiceDate?: Date;
  paymentDate?: Date;
  dueDate?: Date;
  remark?: string;
  performedBy?: string;
  invoiceItems?: InvoiceItemInput[];
}
```

### Invoice Settlement

```typescript
interface InvoiceSettlementInput {
  id?: number;
  settlementNumber: string;
  settlementDate: Date;
  settlementType: string;
  paymentMethod?: string;
  settlementAmount: number;
  currency: string;
  exchangeRate?: number;
  reference?: string;
  remark?: string;
  status?: string;
  performedBy?: string;
  totalRebateAmount?: number;
  rebateReason?: string;
  invoiceIds: number[];
  invoiceTaxNumbers: number[];
}
```

### Purchase Return

```typescript
interface PurchaseReturnItemInput {
  id?: number;
  itemId: number;
  itemVariantId?: number | null;
  variantSku?: string | null;
  variantName?: string | null;
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
  status?: string;
  totalReturnAmount?: number;
  remark?: string;
  performedBy?: string;
  purchaseReturnItems?: PurchaseReturnItemInput[];
}

interface CreatePurchaseReturnRequestBody {
  purchaseReturns: PurchaseReturnInput[];
}
```
