# Delivery List API - Frontend Integration Guide

**Version:** 1.0
**Last Updated:** 2025-12-19
**Status:** Ready for Integration

---

## Overview

This guide provides frontend developers with everything needed to integrate the Delivery List feature, including product variant support.

---

## API Endpoints

### 1. Get Delivery List

**Endpoint:** `GET /sales/delivery-list`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `outletId` | number | Yes | The outlet ID to filter sales |
| `businessDateFrom` | string (ISO date) | No | Filter sales from this date |
| `businessDateTo` | string (ISO date) | No | Filter sales up to this date |
| `customerId` | number | No | Filter sales by customer ID |

**Example Request:**
```
GET /sales/delivery-list?outletId=1&businessDateFrom=2025-12-19&businessDateTo=2025-12-19
```

---

### 2. Confirm Delivery

**Endpoint:** `POST /sales/delivery/confirm`

**Request Body:**
```json
{
  "salesIds": [1234, 1235],
  "deliveryNotes": "All items delivered successfully",
  "deliveredAt": "2025-12-19T14:30:00.000Z"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `salesIds` | number[] | Yes | Array of sales IDs to confirm |
| `deliveryNotes` | string | No | Optional delivery notes |
| `deliveredAt` | string (ISO datetime) | No | Defaults to current time |

---

## TypeScript Interfaces

```typescript
// Sales Item with Variant Support
interface DeliverySalesItem {
  itemName: string;
  itemCode: string;
  itemVariantId: number | null;    // Variant ID (null for simple items)
  variantSku: string | null;       // Variant SKU (null for simple items)
  variantName: string | null;      // Variant display name (null for simple items)
  quantity: number;
  price: number;
  subtotalAmount: number;
}

// Delivery List Item
interface DeliveryListItem {
  id: number;
  businessDate: string;            // ISO datetime
  customerName: string | null;
  phoneNumber: string | null;
  shipStreet: string | null;
  shipCity: string | null;
  shipState: string | null;
  shipPostalCode: string | null;
  shipCountry: string | null;
  totalAmount: number;
  paidAmount: number;
  status: 'Completed' | 'Partially Paid';
  remark: string | null;
  createdAt: string;               // ISO datetime
  salesItems: DeliverySalesItem[];
}

// Confirm Delivery Request
interface ConfirmDeliveryRequest {
  salesIds: number[];
  deliveryNotes?: string;
  deliveredAt?: string;            // ISO datetime
}

// Confirm Delivery Response
interface ConfirmDeliveryResponse {
  message: string;
  successCount: number;
  deliveredSalesIds: number[];
  deliveredAt: string;             // ISO datetime
}
```

---

## Response Examples

### Delivery List Response

```json
[
  {
    "id": 1234,
    "businessDate": "2025-12-19T00:00:00.000Z",
    "customerName": "John Doe",
    "phoneNumber": "+6281234567890",
    "shipStreet": "Jl. Sudirman No. 123",
    "shipCity": "Jakarta",
    "shipState": "DKI Jakarta",
    "shipPostalCode": "12190",
    "shipCountry": "Indonesia",
    "totalAmount": 12250000,
    "paidAmount": 12250000,
    "status": "Completed",
    "remark": "Please deliver before 5 PM",
    "createdAt": "2025-12-19T08:30:00.000Z",
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
  }
]
```

### Confirm Delivery Response

```json
{
  "message": "Delivery confirmed successfully",
  "successCount": 2,
  "deliveredSalesIds": [1234, 1235],
  "deliveredAt": "2025-12-19T14:30:00.000Z"
}
```

---

## Handling Variants in UI

### Display Logic

```typescript
// Display item name with variant info
function getDisplayName(item: DeliverySalesItem): string {
  if (item.variantName) {
    return `${item.itemName} (${item.variantName})`;
  }
  return item.itemName;
}

// Example: "Samsung Galaxy S24 (Green - 256GB)"
// Example: "Nasi Goreng Special" (no variant)
```

### Display Code/SKU

```typescript
// Display SKU with variant fallback
function getDisplaySku(item: DeliverySalesItem): string {
  return item.variantSku || item.itemCode;
}

// Example: "PH001-GREEN-256GB" (has variant)
// Example: "FD001" (no variant)
```

### Check if Item Has Variant

```typescript
function hasVariant(item: DeliverySalesItem): boolean {
  return item.itemVariantId !== null;
}
```

---

## Flutter/Dart Model Example

```dart
class DeliverySalesItem {
  final String itemName;
  final String itemCode;
  final int? itemVariantId;
  final String? variantSku;
  final String? variantName;
  final double quantity;
  final double price;
  final double subtotalAmount;

  DeliverySalesItem({
    required this.itemName,
    required this.itemCode,
    this.itemVariantId,
    this.variantSku,
    this.variantName,
    required this.quantity,
    required this.price,
    required this.subtotalAmount,
  });

  factory DeliverySalesItem.fromJson(Map<String, dynamic> json) {
    return DeliverySalesItem(
      itemName: json['itemName'] as String,
      itemCode: json['itemCode'] as String,
      itemVariantId: json['itemVariantId'] as int?,
      variantSku: json['variantSku'] as String?,
      variantName: json['variantName'] as String?,
      quantity: (json['quantity'] as num).toDouble(),
      price: (json['price'] as num).toDouble(),
      subtotalAmount: (json['subtotalAmount'] as num).toDouble(),
    );
  }

  /// Returns display name with variant (if any)
  String get displayName {
    if (variantName != null && variantName!.isNotEmpty) {
      return '$itemName ($variantName)';
    }
    return itemName;
  }

  /// Returns the appropriate SKU (variant SKU if available, otherwise item code)
  String get displaySku => variantSku ?? itemCode;

  /// Whether this item has a variant
  bool get hasVariant => itemVariantId != null;
}

class DeliveryListItem {
  final int id;
  final DateTime businessDate;
  final String? customerName;
  final String? phoneNumber;
  final String? shipStreet;
  final String? shipCity;
  final String? shipState;
  final String? shipPostalCode;
  final String? shipCountry;
  final double totalAmount;
  final double paidAmount;
  final String status;
  final String? remark;
  final DateTime createdAt;
  final List<DeliverySalesItem> salesItems;

  DeliveryListItem({
    required this.id,
    required this.businessDate,
    this.customerName,
    this.phoneNumber,
    this.shipStreet,
    this.shipCity,
    this.shipState,
    this.shipPostalCode,
    this.shipCountry,
    required this.totalAmount,
    required this.paidAmount,
    required this.status,
    this.remark,
    required this.createdAt,
    required this.salesItems,
  });

  factory DeliveryListItem.fromJson(Map<String, dynamic> json) {
    return DeliveryListItem(
      id: json['id'] as int,
      businessDate: DateTime.parse(json['businessDate'] as String),
      customerName: json['customerName'] as String?,
      phoneNumber: json['phoneNumber'] as String?,
      shipStreet: json['shipStreet'] as String?,
      shipCity: json['shipCity'] as String?,
      shipState: json['shipState'] as String?,
      shipPostalCode: json['shipPostalCode'] as String?,
      shipCountry: json['shipCountry'] as String?,
      totalAmount: (json['totalAmount'] as num).toDouble(),
      paidAmount: (json['paidAmount'] as num).toDouble(),
      status: json['status'] as String,
      remark: json['remark'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      salesItems: (json['salesItems'] as List<dynamic>)
          .map((e) => DeliverySalesItem.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  /// Full delivery address
  String get fullAddress {
    final parts = [shipStreet, shipCity, shipState, shipPostalCode, shipCountry]
        .where((p) => p != null && p.isNotEmpty)
        .toList();
    return parts.join(', ');
  }

  /// Whether this is a COD (Cash on Delivery) order
  bool get isCod => status == 'Partially Paid';

  /// Remaining amount to collect for COD orders
  double get balanceDue => totalAmount - paidAmount;
}
```

---

## UI Recommendations

### Item List Display

For each sales item, display:
1. **Item Name** with variant (use `displayName`)
2. **SKU** (use `displaySku`)
3. **Quantity** x **Price**
4. **Subtotal**

**Example Layout:**
```
+------------------------------------------+
| Samsung Galaxy S24 (Green - 256GB)       |
| SKU: PH001-GREEN-256GB                   |
| 1 x Rp 12,000,000 = Rp 12,000,000       |
+------------------------------------------+
| Nasi Goreng Special                      |
| SKU: FD001                               |
| 2 x Rp 50,000 = Rp 100,000              |
+------------------------------------------+
```

### Visual Indicators

Consider adding visual indicators for variant items:
- Badge or icon to show "Variant" items
- Different styling for variant name (e.g., smaller text, muted color)

---

## Error Handling

### Common Errors

| HTTP Code | Error | Action |
|-----------|-------|--------|
| 400 | "salesIds array is required" | Ensure at least one ID is provided |
| 400 | "Sales #1234 is not a delivery sale" | Check salesType before confirming |
| 400 | "Sales #1234 has already been delivered" | Refresh the list and retry |
| 404 | "One or more sales records not found" | Refresh the list and retry |

---

## Related Documentation

- [DELIVERY_LIST_FEATURE.md](DELIVERY_LIST_FEATURE.md) - Full backend implementation details
- [PRODUCT_VARIANT_COMPLETE_GUIDE.md](../item/PRODUCT_VARIANT_COMPLETE_GUIDE.md) - Complete variant system documentation

---

## Questions?

Contact the backend team for any questions or issues with the API.
