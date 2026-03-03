# Delivery History Feature - Implementation Documentation

## Overview

This endpoint returns a **paginated list of delivered sales** (sales that have been confirmed as delivered). It allows the frontend to display delivery history filtered by the delivery confirmation date (`deliveredAt`).

---

## API Endpoint

### Get Delivered Sales History

**Endpoint:** `GET /sales/delivery/history`

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `outletId` | number | Yes | - | The outlet ID to filter sales |
| `startDate` | string (ISO date) | Yes | - | Filter deliveries confirmed from this date (inclusive) |
| `endDate` | string (ISO date) | Yes | - | Filter deliveries confirmed up to this date (inclusive) |
| `skip` | number | No | 0 | Number of records to skip (for pagination) |
| `take` | number | No | 100 | Number of records to return per page (max per request) |

> **Note:** `startDate` and `endDate` filter on the `deliveredAt` field — i.e., when the delivery was **confirmed**, not when the sale was created.

---

## Pagination

This endpoint uses **offset-based pagination** (`skip` / `take`). The response includes a `total` field indicating the total number of matching records.

### Pagination Loop Pattern

The frontend should loop through pages until all records are fetched:

```dart
Future<List<DeliveredSale>> fetchAllDeliveredSales({
  required int outletId,
  required String startDate,
  required String endDate,
}) async {
  final List<DeliveredSale> allSales = [];
  int skip = 0;
  const int take = 100;
  int total = 0;

  do {
    final response = await api.get(
      '/sales/delivery/history',
      queryParameters: {
        'outletId': outletId,
        'startDate': startDate,
        'endDate': endDate,
        'skip': skip,
        'take': take,
      },
    );

    final responseData = response.data;
    // NetworkResponse wrapper fields
    total = responseData['total'];
    final sales = (responseData['data'] as List)
        .map((e) => DeliveredSale.fromJson(e))
        .toList();
    allSales.addAll(sales);
    skip += take;
  } while (skip < total);

  return allSales;
}
```

---

## Response Schema

The response is wrapped in the standard `NetworkResponse` format:

**Top-Level Response (NetworkResponse):**
| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Whether the request was successful |
| `data` | array | Array of delivered sale objects |
| `total` | number | Total number of matching records (for pagination) |
| `serverTimestamp` | string (ISO datetime) | Server timestamp at the time of response |

**Each Sale Object (inside `data` array):**
| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Sale ID |
| `businessDate` | string (ISO datetime) | The business date of the original sale |
| `customerName` | string \| null | Customer name |
| `phoneNumber` | string | Customer phone number |
| `shipStreet` | string | Delivery street address |
| `shipCity` | string | Delivery city |
| `shipState` | string | Delivery state/province |
| `shipPostalCode` | string | Delivery postal code |
| `shipCountry` | string | Delivery country |
| `totalAmount` | number | Total sale amount |
| `paidAmount` | number | Amount paid |
| `status` | string | Sale status (`"Delivered"` or `"Partially Paid"`) |
| `remark` | string | Sale remark/note |
| `createdAt` | string (ISO datetime) | When the sale was created |
| `deliveredAt` | string (ISO datetime) | When the delivery was confirmed |
| `deliveredBy` | string | Username of person who confirmed the delivery |
| `deliveryNotes` | string | Notes added during delivery confirmation |
| `salesItems` | array | Array of items in the sale |

**Each Sales Item Object:**
| Field | Type | Description |
|-------|------|-------------|
| `itemName` | string | Item name |
| `itemCode` | string | Item code |
| `itemVariantId` | number \| null | Variant ID (null if no variant) |
| `variantSku` | string \| null | Variant SKU (null if no variant) |
| `variantName` | string \| null | Variant name (null if no variant) |
| `quantity` | number | Quantity ordered |
| `price` | number | Unit price |
| `subtotalAmount` | number | Line item subtotal |

---

## Sample Response

**Request:**

```
GET /sales/delivery/history?outletId=1&startDate=2025-10-29&endDate=2025-10-29&skip=0&take=100
```

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1236,
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
      "status": "Delivered",
      "remark": "Please deliver before 5 PM",
      "createdAt": "2025-10-29T08:30:00.000Z",
      "deliveredAt": "2025-10-29T14:30:00.000Z",
      "deliveredBy": "john.doe",
      "deliveryNotes": "All items delivered successfully at customer's door",
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
      "deliveredAt": "2025-10-29T13:00:00.000Z",
      "deliveredBy": "driver.budi",
      "deliveryNotes": "Customer paid remaining balance on delivery",
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
  ],
  "total": 2,
  "serverTimestamp": "2025-10-30T02:00:00.000Z"
}
```

---

## Empty Response

When no delivered sales match the filters:

```json
{
  "success": true,
  "data": [],
  "total": 0,
  "serverTimestamp": "2025-10-30T02:00:00.000Z"
}
```

---

## Status Values

A delivered sale can have one of these statuses:

| Status             | Meaning                                              |
| ------------------ | ---------------------------------------------------- |
| `"Delivered"`      | Sale was fully paid before delivery confirmation     |
| `"Partially Paid"` | Sale was delivered but not fully paid (COD scenario) |

> **Tip:** Use `paidAmount` vs `totalAmount` to show payment status regardless of the `status` field. If `paidAmount < totalAmount`, the customer still owes a balance.

---

## Filter Logic

A sale is included in delivery history if:

- `salesType = "DELIVERY"`
- `deliveredAt IS NOT NULL`
- `deliveredAt` falls within `startDate` (start of day) to `endDate` (end of day)
- `deleted = false`

---

## Sorting

Results are sorted by:

1. `deliveredAt` descending (most recently delivered first)
2. `id` descending (tie-breaker)

---

## Error Responses

**400 Bad Request - Missing Parameters:**

```json
{
  "success": false,
  "error": {
    "message": "Valid outletId is required"
  }
}
```

```json
{
  "success": false,
  "error": {
    "message": "startDate and endDate are required"
  }
}
```

**400 Bad Request - Invalid Date:**

```json
{
  "success": false,
  "error": {
    "message": "Invalid date format"
  }
}
```

---

## Differences from Delivery List (`GET /sales/delivery/list`)

|                       | Delivery List (Pending)                          | Delivery History (Completed)                  |
| --------------------- | ------------------------------------------------ | --------------------------------------------- |
| **Endpoint**          | `GET /sales/delivery/list`                       | `GET /sales/delivery/history`                 |
| **Shows**             | Sales waiting to be delivered                    | Sales already delivered                       |
| **Date filter field** | `businessDate`                                   | `deliveredAt`                                 |
| **Date params**       | `businessDateFrom` / `businessDateTo` (optional) | `startDate` / `endDate` (required)            |
| **Pagination**        | No (returns all)                                 | Yes (`skip` / `take`)                         |
| **Sort order**        | `businessDate ASC` (oldest first)                | `deliveredAt DESC` (newest first)             |
| **Extra fields**      | -                                                | `deliveredAt`, `deliveredBy`, `deliveryNotes` |
| **Status filter**     | `Completed` or `Partially Paid` only             | Any (as long as `deliveredAt` is set)         |

---

## Code Changes Summary

### Files Modified

| File                            | Changes                                                           |
| ------------------------------- | ----------------------------------------------------------------- |
| `src/sales/sales.service.ts`    | Add `getDeliveredList()` function, update exports                 |
| `src/sales/sales.controller.ts` | Add `getDeliveredList` handler, add `GET /delivery/history` route |

### New Functions

**sales.service.ts:**

- `getDeliveredList()` - Retrieves paginated delivered sales by `deliveredAt` date range

**sales.controller.ts:**

- `GET /sales/delivery/history` - Delivered sales history endpoint

---

## Document Version

- **Version:** 1.0
- **Date:** 2026-03-02
- **Status:** Implementation Ready
