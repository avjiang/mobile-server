# Delivery List Feature - Implementation Documentation

## Overview
This feature introduces a delivery management system for sales that require delivery. It allows the frontend to retrieve a list of sales pending delivery and confirm deliveries in batches.

---

## Business Requirements

### Purpose
- Track sales that require delivery (where `salesType = "DELIVERY"`)
- Display all pending deliveries (both fully paid and partially paid)
- Allow batch confirmation of multiple deliveries at once
- Prevent modification of delivered sales (voiding, returning, or refunding)

### Key Concepts
- **Delivery Sales**: Sales with `salesType = "DELIVERY"`
- **Pending Delivery**: Sales with status "Completed" or "Partially Paid" that have not been delivered yet (`deliveredAt IS NULL`)
- **Delivered Sales**: Sales with status "Delivered" (final state, cannot be reverted)
- **Batch Confirmation**: Multiple sales can be confirmed as delivered in a single API call

---

## Database Schema Changes

### Sales Model Updates
Location: `prisma/client/schema.prisma`

Add the following fields to the `Sales` model (around line 440):

```prisma
model Sales {
  // ... existing fields ...
  deliveredAt     DateTime? @map("DELIVERED_AT")
  deliveredBy     String?   @map("DELIVERED_BY")
  deliveryNotes   String?   @default("") @map("DELIVERY_NOTES")
}
```

**Field Descriptions:**
- `deliveredAt`: Timestamp when delivery was confirmed (NULL = not yet delivered)
- `deliveredBy`: Username of the person who confirmed the delivery
- `deliveryNotes`: Optional notes about the delivery

---

## Status Transitions

### Sales Status Flow

```
New Sale (salesType = "DELIVERY")
         ↓
   "Partially Paid"
         ↓ (add payment)
     "Completed"
         ↓
         └──→ Appears in Delivery List (deliveredAt IS NULL)
                      ↓
              (POST /sales/delivery/confirm)
                      ↓
                 "Delivered"
              (Final State - Cannot be voided/returned/refunded)
```

### Valid Status Transitions
- `"Partially Paid"` → `"Completed"` (via payment)
- `"Partially Paid"` → `"Delivered"` (via delivery confirmation)
- `"Completed"` → `"Delivered"` (via delivery confirmation)
- `"Completed"` → `"Voided"` / `"Returned"` / `"Refunded"` (only if NOT delivered)
- `"Delivered"` → **NO TRANSITIONS** (final state)

---

## API Endpoints

### 1. Get Delivery List

**Endpoint:** `GET /sales/delivery-list`

**Description:** Retrieves all sales pending delivery for a specific outlet.

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `outletId` | number | Yes | The outlet ID to filter sales |
| `businessDateFrom` | string (ISO date) | No | Filter sales from this date |
| `businessDateTo` | string (ISO date) | No | Filter sales up to this date |
| `customerId` | number | No | Filter sales by customer ID |

**Response:** Array of `DeliveryListItemResponse`

**Success Response (200):**
```json
[
  {
    "id": 1234,
    "businessDate": "2025-10-29T00:00:00.000Z",
    "customerName": "John Doe",
    "phoneNumber": "+6281234567890",
    "shipStreet": "Jl. Sudirman No. 123",
    "shipCity": "Jakarta",
    "shipState": "DKI Jakarta",
    "shipPostalCode": "12190",
    "shipCountry": "Indonesia",
    "totalAmount": 250000,
    "paidAmount": 250000,
    "status": "Completed",
    "remark": "Please deliver before 5 PM",
    "createdAt": "2025-10-29T08:30:00.000Z",
    "salesItems": [
      {
        "itemName": "Nasi Goreng Special",
        "itemCode": "FD001",
        "itemVariantId": null,
        "variantSku": null,
        "variantName": null,
        "quantity": 2,
        "price": 50000,
        "subtotalAmount": 100000
      },
      {
        "itemName": "Samsung Galaxy S24",
        "itemCode": "PH001",
        "itemVariantId": 1000,
        "variantSku": "PH001-GREEN-256GB",
        "variantName": "Green - 256GB",
        "quantity": 1,
        "price": 12000000,
        "subtotalAmount": 12000000
      }
    ]
  },
  {
    "id": 1235,
    "businessDate": "2025-10-29T00:00:00.000Z",
    "customerName": "Jane Smith",
    "phoneNumber": "+6289876543210",
    "shipStreet": "Jl. Thamrin No. 45",
    "shipCity": "Jakarta",
    "shipState": "DKI Jakarta",
    "shipPostalCode": "10350",
    "shipCountry": "Indonesia",
    "totalAmount": 180000,
    "paidAmount": 100000,
    "status": "Partially Paid",
    "remark": "COD - Collect remaining 80,000",
    "createdAt": "2025-10-29T09:15:00.000Z",
    "salesItems": [
      {
        "itemName": "Ayam Bakar",
        "itemCode": "FD005",
        "itemVariantId": 500,
        "variantSku": "FD005-LARGE",
        "variantName": "Large",
        "quantity": 1,
        "price": 75000,
        "subtotalAmount": 75000
      }
    ]
  }
]
```

**Example Request:**
```bash
GET /sales/delivery-list?outletId=1&businessDateFrom=2025-10-29&businessDateTo=2025-10-29
```

**Filter Logic:**
- `salesType = "DELIVERY"`
- `status IN ("Completed", "Partially Paid")`
- `deliveredAt IS NULL`
- `deleted = false`
- Ordered by `businessDate ASC` (oldest first)

---

### 2. Confirm Delivery Batch

**Endpoint:** `POST /sales/delivery/confirm`

**Description:** Confirms delivery for one or more sales. Updates status to "Delivered" and records delivery information.

**Authentication:** Required

**Request Body:**
```json
{
  "salesIds": [1234, 1235, 1236],
  "deliveryNotes": "All items delivered successfully at customer's door",
  "deliveredAt": "2025-10-29T14:30:00.000Z"
}
```

**Request Body Schema:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `salesIds` | number[] | Yes | Array of sales IDs to confirm delivery (min 1) |
| `deliveryNotes` | string | No | Optional notes about the delivery |
| `deliveredAt` | string (ISO datetime) | No | Delivery timestamp (defaults to current time) |

**Success Response (200):**
```json
{
  "message": "Delivery confirmed successfully",
  "successCount": 3,
  "deliveredSalesIds": [1234, 1235, 1236],
  "deliveredAt": "2025-10-29T14:30:00.000Z"
}
```

**Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| `message` | string | Success message |
| `successCount` | number | Number of sales successfully delivered |
| `deliveredSalesIds` | number[] | Array of delivered sales IDs |
| `deliveredAt` | string (ISO datetime) | Timestamp of delivery |

**Error Responses:**

**400 Bad Request - Missing or Invalid Data:**
```json
{
  "message": "salesIds array is required"
}
```

**400 Bad Request - Validation Errors:**
```json
{
  "message": "Sales #1234 is not a delivery sale; Sales #1235 has already been delivered"
}
```

**404 Not Found:**
```json
{
  "message": "One or more sales records not found"
}
```

**Validation Rules:**
- All sales IDs must exist in the database
- All sales must have `salesType = "DELIVERY"`
- All sales must have `status IN ("Completed", "Partially Paid")`
- All sales must have `deliveredAt = NULL` (not already delivered)
- All sales must have `deleted = false`

**Example Requests:**

**Single Delivery Confirmation:**
```bash
POST /sales/delivery/confirm
Content-Type: application/json

{
  "salesIds": [1234]
}
```

**Batch Delivery Confirmation with Notes:**
```bash
POST /sales/delivery/confirm
Content-Type: application/json

{
  "salesIds": [1234, 1235, 1236, 1237],
  "deliveryNotes": "Driver: Budi - All deliveries completed in Sudirman area",
  "deliveredAt": "2025-10-29T15:45:00.000Z"
}
```

**Batch Delivery Confirmation (Default Timestamp):**
```bash
POST /sales/delivery/confirm
Content-Type: application/json

{
  "salesIds": [1234, 1235]
}
```

---

## Notification System

### Delivery Confirmation Notification

When deliveries are confirmed, a push notification is sent to the topic:
```
/topics/tenant_{tenantId}_outlet_{outletId}_delivery
```

**Notification Payload:**
```json
{
  "title": "Deliveries Confirmed",
  "message": "3 delivery order(s) have been delivered",
  "data": {
    "type": "delivery_confirmed",
    "salesIds": [1234, 1235, 1236],
    "deliveredBy": "john.doe",
    "deliveredAt": "2025-10-29T14:30:00.000Z",
    "count": 3,
    "outletId": 1,
    "triggeringUserId": 5,
    "triggeringUsername": "john.doe",
    "timestamp": "2025-10-29T14:30:00.000Z"
  }
}
```

---

## Business Logic Rules

### Delivery List Inclusion Rules
A sale appears in the delivery list if:
1. `salesType = "DELIVERY"`
2. `status = "Completed"` OR `status = "Partially Paid"`
3. `deliveredAt IS NULL` (not yet delivered)
4. `deleted = false`

### Delivery Confirmation Rules
A sale can be confirmed as delivered if:
1. `salesType = "DELIVERY"`
2. `status = "Completed"` OR `status = "Partially Paid"`
3. `deliveredAt IS NULL` (not already delivered)
4. `deleted = false`

### Status Protection Rules
Once a sale has `status = "Delivered"`:
- **CANNOT** be voided (void operation blocked)
- **CANNOT** be returned (return operation blocked)
- **CANNOT** be refunded (refund operation blocked)
- **CANNOT** be reverted back to "Completed" or "Partially Paid"

**Error Messages:**
- Void attempt: `"Cannot void a delivered sale"`
- Return attempt: `"Cannot return a delivered sale. Please contact support."`
- Refund attempt: `"Cannot refund a delivered sale. Please contact support."`

---

## Frontend Integration Guide

### Workflow

#### 1. Display Delivery List
```typescript
// Fetch pending deliveries for today
const response = await fetch(
  `/sales/delivery-list?outletId=1&businessDateFrom=2025-10-29&businessDateTo=2025-10-29`
);
const deliveryList = await response.json();

// Display list with checkboxes for batch selection
deliveryList.forEach(sale => {
  console.log(`#${sale.id} - ${sale.customerName} - ${sale.shipStreet}`);
  console.log(`Status: ${sale.status} - Paid: ${sale.paidAmount}/${sale.totalAmount}`);
});
```

#### 2. Batch Confirm Deliveries
```typescript
// User selects multiple sales via checkboxes
const selectedSalesIds = [1234, 1235, 1236];

// Confirm delivery
const response = await fetch('/sales/delivery/confirm', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    salesIds: selectedSalesIds,
    deliveryNotes: 'All items delivered successfully'
  })
});

const result = await response.json();
console.log(`${result.successCount} deliveries confirmed`);
```

#### 3. Handle Payment Status Display
```typescript
// Show payment status badge
function getPaymentBadge(sale) {
  if (sale.status === 'Completed') {
    return '✓ Fully Paid';
  } else if (sale.status === 'Partially Paid') {
    const balance = sale.totalAmount - sale.paidAmount;
    return `⚠ COD - Collect Rp ${balance.toLocaleString()}`;
  }
}
```

### UI Recommendations

**Delivery List Screen:**
- Show delivery address prominently
- Display payment status (Fully Paid vs COD with balance)
- Include customer phone number for contact
- Show item summary
- Provide checkboxes for batch selection
- "Confirm Delivery" button for batch action
- Filter by date range
- Sort by order date (oldest first)

**Confirmation Dialog:**
- Show count of selected deliveries
- Optional: Add delivery notes field
- Confirm button with loading state
- Success message with count

---

## Testing Scenarios

### Test Case 1: Get Delivery List - Success
**Prerequisites:**
- Sales #1234: `salesType = "DELIVERY"`, `status = "Completed"`, `deliveredAt = NULL`
- Sales #1235: `salesType = "DELIVERY"`, `status = "Partially Paid"`, `deliveredAt = NULL`

**Request:**
```
GET /sales/delivery-list?outletId=1
```

**Expected Result:**
- HTTP 200
- Array contains both sales #1234 and #1235

### Test Case 2: Get Delivery List - Filters Out Delivered Sales
**Prerequisites:**
- Sales #1234: `salesType = "DELIVERY"`, `status = "Delivered"`, `deliveredAt = "2025-10-28"`

**Request:**
```
GET /sales/delivery-list?outletId=1
```

**Expected Result:**
- HTTP 200
- Array does NOT contain sales #1234

### Test Case 3: Confirm Single Delivery - Success
**Prerequisites:**
- Sales #1234: `salesType = "DELIVERY"`, `status = "Completed"`, `deliveredAt = NULL`

**Request:**
```json
POST /sales/delivery/confirm
{
  "salesIds": [1234]
}
```

**Expected Result:**
- HTTP 200
- Sales #1234 updated: `status = "Delivered"`, `deliveredAt` set, `deliveredBy` set
- Success response with count = 1

### Test Case 4: Confirm Batch Delivery - Success
**Prerequisites:**
- Sales #1234, #1235, #1236: All have `salesType = "DELIVERY"`, `status = "Completed"`, `deliveredAt = NULL`

**Request:**
```json
POST /sales/delivery/confirm
{
  "salesIds": [1234, 1235, 1236],
  "deliveryNotes": "Batch delivery completed"
}
```

**Expected Result:**
- HTTP 200
- All 3 sales updated to `status = "Delivered"`
- Success response with count = 3
- Push notification sent

### Test Case 5: Confirm Delivery - Invalid Sales Type
**Prerequisites:**
- Sales #1234: `salesType = "DINE_IN"`, `status = "Completed"`

**Request:**
```json
POST /sales/delivery/confirm
{
  "salesIds": [1234]
}
```

**Expected Result:**
- HTTP 400
- Error message: "Sales #1234 is not a delivery sale"

### Test Case 6: Confirm Delivery - Already Delivered
**Prerequisites:**
- Sales #1234: `salesType = "DELIVERY"`, `status = "Delivered"`, `deliveredAt = "2025-10-28"`

**Request:**
```json
POST /sales/delivery/confirm
{
  "salesIds": [1234]
}
```

**Expected Result:**
- HTTP 400
- Error message: "Sales #1234 has already been delivered"

### Test Case 7: Void Delivered Sale - Should Fail
**Prerequisites:**
- Sales #1234: `status = "Delivered"`

**Request:**
```
POST /sales/1234/void
```

**Expected Result:**
- HTTP 400
- Error message: "Cannot void a delivered sale"

### Test Case 8: Return Delivered Sale - Should Fail
**Prerequisites:**
- Sales #1234: `status = "Delivered"`

**Request:**
```
POST /sales/1234/return
```

**Expected Result:**
- HTTP 400
- Error message: "Cannot return a delivered sale. Please contact support."

### Test Case 9: Refund Delivered Sale - Should Fail
**Prerequisites:**
- Sales #1234: `status = "Delivered"`

**Request:**
```
POST /sales/1234/refund
```

**Expected Result:**
- HTTP 400
- Error message: "Cannot refund a delivered sale. Please contact support."

---

## Code Changes Summary

### Files Modified

| File | Changes | Lines |
|------|---------|-------|
| `prisma/client/schema.prisma` | Add 3 fields to Sales model | ~440 |
| `src/sales/sales.service.ts` | Add 2 functions, update 3 validations, update exports | ~1400-1738 |
| `src/sales/sales.request.ts` | Add 2 request DTOs | ~132 |
| `src/sales/sales.response.ts` | Add 3 response DTOs | New/Update |
| `src/sales/sales.controller.ts` | Add 2 endpoints | Follow pattern |

### New Functions Added

**sales.service.ts:**
- `getDeliveryList()` - Retrieves pending deliveries
- `confirmDeliveryBatch()` - Confirms multiple deliveries at once

**sales.controller.ts:**
- `GET /sales/delivery-list` - Delivery list endpoint
- `POST /sales/delivery/confirm` - Confirm delivery endpoint

### Updated Functions

**sales.service.ts:**
- `voidSales()` - Added validation to prevent voiding delivered sales
- `returnSales()` - Added validation to prevent returning delivered sales
- `refundSales()` - Added validation to prevent refunding delivered sales

---

## Migration Checklist

- [ ] Update `prisma/client/schema.prisma` with new fields
- [ ] Run database migration (handled manually)
- [ ] Generate Prisma client (handled manually)
- [ ] Update `src/sales/sales.service.ts`
- [ ] Update `src/sales/sales.request.ts`
- [ ] Create/update `src/sales/sales.response.ts`
- [ ] Update `src/sales/sales.controller.ts`
- [ ] Test GET `/sales/delivery-list` endpoint
- [ ] Test POST `/sales/delivery/confirm` endpoint
- [ ] Test void/return/refund protection
- [ ] Deploy to staging
- [ ] Update frontend
- [ ] Deploy to production

---

## Support & Maintenance

### Common Issues

**Issue:** Delivery list is empty
- **Check:** Are there sales with `salesType = "DELIVERY"` and `status IN ("Completed", "Partially Paid")`?
- **Check:** Is `deliveredAt = NULL` for these sales?
- **Check:** Is `deleted = false`?

**Issue:** Cannot confirm delivery
- **Check:** Are all salesIds valid?
- **Check:** Do all sales have `salesType = "DELIVERY"`?
- **Check:** Do all sales have valid status ("Completed" or "Partially Paid")?
- **Check:** Are any sales already delivered?

**Issue:** Push notification not received
- **Check:** Is Pushy service configured correctly?
- **Check:** Are devices subscribed to the delivery topic?
- **Check:** Check server logs for notification errors

---

## Future Enhancements (Not Included)

Potential features for future versions:
- Delivery driver assignment
- Delivery route optimization
- Delivery proof (signature/photo capture)
- Delivery time windows
- SMS/Email notification to customers
- Delivery tracking in real-time
- Delivery performance reports
- Estimated delivery time calculation

---

## Document Version

- **Version:** 1.1
- **Date:** 2025-12-19
- **Author:** Development Team
- **Status:** Implementation Ready

### Changelog

#### v1.1 (2025-12-19)
- Added product variant support to delivery list response
- `salesItems` now includes: `itemVariantId`, `variantSku`, `variantName`
- See [DELIVERY_LIST_FRONTEND_GUIDE.md](DELIVERY_LIST_FRONTEND_GUIDE.md) for frontend integration

#### v1.0 (2025-10-29)
- Initial implementation
