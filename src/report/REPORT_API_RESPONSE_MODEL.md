# Report API Response Model Documentation

## Overview
This document describes the complete JSON response models for both `generateReport` (session-based) and `generateOutletReport` (outlet-based) APIs. These APIs have been updated to properly handle profit/loss calculations.

---

## Key Changes Summary

### What's New:
1. **Profit/Loss Split**: All profit metrics are now split into:
   - `profitGains` - Sum of all positive profits
   - `profitLosses` - Sum of all negative profits (will be negative numbers)
   - `profit` - Total profit calculated from (gains + losses), not from database aggregate

2. **Returns/Refunds Clarity**:
   - `profitImpact` - Original profit/loss amount from the returned/refunded sales
   - `lostProfit` - Profit lost if original sale was profitable
   - `recoveredLoss` - Loss recovered if original sale was loss-making

3. **Most Loss Items**: New `mostLossItems` array showing items sold at a loss

4. **Filtered Profitable Items**: `mostProfitableItems` now only includes items with positive profit

---

## Complete Response Model

### generateReport Response (Session-based)

```json
{
  // ===================
  // OVERALL METRICS
  // ===================
  "totalRevenue": number,                // Net revenue from completed sales
  "grossRevenue": number,                // Gross revenue from all sales
  "returnRefundImpact": number,          // Revenue impact from returns/refunds
  "totalProfit": number,                 // Total profit = totalProfitGains + totalProfitLosses
  "totalProfitGains": number,            // Sum of all positive profits from completed sales
  "totalProfitLosses": number,           // Sum of all negative profits (will be negative)
  "averageTransactionValue": number,     // Average per completed transaction
  "totalPaidAmount": number,             // Total amount paid
  "changeGiven": number,                 // Total change given
  "voidedSalesCount": number,            // Number of voided sales
  "voidedSalesAmount": number,           // Total amount of voided sales

  // ===================
  // COMPLETED SALES
  // ===================
  "completedSales": {
    "count": number,                     // Number of completed sales
    "totalAmount": number,               // Total sales amount
    "paidAmount": number,                // Total paid amount
    "profit": number,                    // Total profit = profitGains + profitLosses
    "profitGains": number,               // NEW: Sum of positive profits only
    "profitLosses": number,              // NEW: Sum of negative profits (will be negative)
    "changeGiven": number                // Total change given
  },

  // ===================
  // PARTIALLY PAID SALES
  // ===================
  "partiallyPaidSales": {
    "count": number,
    "totalAmount": number,
    "paidAmount": number,
    "outstandingAmount": number,
    "profit": number,                    // Total profit = profitGains + profitLosses
    "profitGains": number,               // NEW: Sum of positive profits
    "profitLosses": number,              // NEW: Sum of negative profits
    "averageOutstandingPerTransaction": number,
    "paymentCoverageRatio": number,      // Percentage (0-100)
    "details": [                         // Array of individual sales
      {
        "salesId": number,
        "totalAmount": number,
        "paidAmount": number,
        "outstandingAmount": number,
        "customerName": string,
        "phoneNumber": string,
        "businessDate": string           // ISO date
      }
    ]
  },

  // ===================
  // RETURNED SALES
  // ===================
  "returnedSales": {
    "count": number,
    "totalAmount": number,
    "paidAmount": number,
    "profitImpact": number,              // NEW: Original profit (can be +/-)
    "lostProfit": number,                // NEW: Profit lost from profitable sales
    "recoveredLoss": number,             // NEW: Loss recovered from loss-making sales
    "details": [
      {
        "salesId": number,
        "totalAmount": number,
        "paidAmount": number,
        "customerName": string,
        "phoneNumber": string,
        "businessDate": string,
        "remark": string
      }
    ]
  },

  // ===================
  // REFUNDED SALES
  // ===================
  "refundedSales": {
    "count": number,
    "totalAmount": number,
    "paidAmount": number,
    "profitImpact": number,              // NEW: Original profit (can be +/-)
    "lostProfit": number,                // NEW: Profit lost from profitable sales
    "recoveredLoss": number,             // NEW: Loss recovered from loss-making sales
    "details": [
      {
        "salesId": number,
        "totalAmount": number,
        "paidAmount": number,
        "customerName": string,
        "phoneNumber": string,
        "businessDate": string,
        "remark": string
      }
    ]
  },

  // ===================
  // VOIDED SALES
  // ===================
  "voidedSales": {
    "count": number,
    "totalAmount": number,
    "paidAmount": number,
    "details": [
      {
        "salesId": number,
        "totalAmount": number,
        "paidAmount": number,
        "customerName": string,
        "phoneNumber": string,
        "businessDate": string,
        "remark": string
      }
    ]
  },

  // ===================
  // SESSION INFO
  // ===================
  "sessionInfo": {
    "id": number,
    "outletId": number,
    "businessDate": string,              // ISO date
    "openingDateTime": string | null,    // ISO datetime
    "closingDateTime": string | null,    // ISO datetime
    "openingAmount": number,
    "totalSalesCount": number,           // Count of all non-voided sales
    "openByUserID": number,
    "closeByUserID": number
  },

  // ===================
  // TOP SELLING ITEMS
  // ===================
  "topSellingItems": [
    {
      "itemId": number,
      "itemName": string,
      "itemCode": string,
      "itemBrand": string,
      "quantitySold": number,
      "revenue": number
    }
  ],

  // ===================
  // TOP SELLING CATEGORIES
  // ===================
  "topSellingCategories": [
    {
      "categoryName": string,
      "quantitySold": number,
      "revenue": number
    }
  ],

  // ===================
  // MOST PROFITABLE ITEMS (UPDATED)
  // ===================
  "mostProfitableItems": [               // NOW: Only items with positive profit
    {
      "itemId": number,
      "itemName": string,
      "itemCode": string,
      "itemBrand": string,
      "profit": number                   // Always positive
    }
  ],

  // ===================
  // MOST LOSS ITEMS (NEW)
  // ===================
  "mostLossItems": [                     // NEW: Items sold at a loss
    {
      "itemId": number,
      "itemName": string,
      "itemCode": string,
      "itemBrand": string,
      "loss": number                     // Always negative
    }
  ],

  // ===================
  // PAYMENT BREAKDOWN
  // ===================
  "paymentBreakdown": [
    {
      "method": string,                  // e.g., "Cash", "Card", "E-Wallet"
      "amount": number
    }
  ],

  // ===================
  // STOCK BALANCE
  // ===================
  "stockBalance": [                      // Only items sold in this session
    {
      "itemId": number,
      "itemName": string,
      "itemCode": string,
      "itemBrand": string,
      "quantitySold": number,
      "availableQuantity": number,
      "status": string                   // "In Stock" | "Low Stock" | "Out of Stock"
    }
  ],

  // ===================
  // TODAY'S PURCHASE ORDERS
  // ===================
  "todayPurchaseOrders": {
    "count": number,
    "totalAmount": number,
    "totalItems": number,
    "orders": [
      {
        "id": number,
        "purchaseOrderNumber": string,
        "totalAmount": number,
        "status": string,
        "supplierName": string,
        "createdAt": string,             // ISO datetime
        "itemCount": number
      }
    ]
  },

  // ===================
  // TODAY'S DELIVERY ORDERS
  // ===================
  "todayDeliveryOrders": {
    "count": number,
    "totalItems": number,
    "orders": [
      {
        "id": number,
        "trackingNumber": string | null,
        "status": string,
        "deliveryDate": string | null,   // ISO datetime
        "createdAt": string,             // ISO datetime
        "supplierId": number | null,
        "itemCount": number
      }
    ]
  },

  // ===================
  // TODAY'S INVOICES
  // ===================
  "todayInvoices": {
    "count": number,
    "totalAmount": number,
    "totalItems": number,
    "invoices": [
      {
        "id": number,
        "invoiceNumber": string,
        "totalAmount": number,
        "status": string,
        "supplierName": string,
        "createdAt": string,             // ISO datetime
        "itemCount": number
      }
    ]
  },

  // ===================
  // ALL SALES IN SESSION
  // ===================
  "sales": [
    {
      "id": number,
      "businessDate": string,            // ISO date
      "salesType": string,
      "customerName": string,
      "phoneNumber": string,
      "totalAmount": number,
      "paidAmount": number,
      "profitAmount": number,            // Can be positive or negative
      "isTaxInclusive": boolean,
      "status": string,
      "remark": string,
      "salesItems": [
        {
          "id": number,
          "itemName": string,
          "itemModel": string,
          "cost": number,
          "quantity": number,
          "discountAmount": number,
          "taxAmount": number,
          "subtotalAmount": number
        }
      ]
    }
  ]
}
```

---

### generateOutletReport Response (Outlet-based)

**The structure is identical to `generateReport` with the following differences:**

1. **No `sessionInfo` object** - Since it's outlet-based, not session-based
2. **Filters by `outletId` instead of `sessionId`**
3. **Optional date range** - Can filter by `startDate` and `endDate`

All profit/loss calculations work exactly the same way as in `generateReport`.

---

## Understanding Profit/Loss Metrics

### Scenario Examples:

#### Example 1: Sale with Positive Profit
```json
// Item sold: Cost = $50, Selling Price = $100
// Profit = $50 (positive)
{
  "completedSales": {
    "profit": 50,           // Total
    "profitGains": 50,      // Counted here
    "profitLosses": 0       // Not counted here
  }
}
```

#### Example 2: Sale with Loss
```json
// Item sold: Cost = $100, Selling Price = $80
// Profit = -$20 (negative, it's a loss)
{
  "completedSales": {
    "profit": -20,          // Total (negative)
    "profitGains": 0,       // Not counted here
    "profitLosses": -20     // Counted here (negative)
  }
}
```

#### Example 3: Mixed Sales
```json
// Sale 1: Profit = $100
// Sale 2: Profit = -$30
// Sale 3: Profit = $50
{
  "completedSales": {
    "profit": 120,          // $100 + (-$30) + $50 = $120
    "profitGains": 150,     // $100 + $50 = $150
    "profitLosses": -30     // -$30
  }
}
```

#### Example 4: Returned Profitable Sale
```json
// Original sale: Profit = $50
// Customer returns it
{
  "returnedSales": {
    "profitImpact": 50,     // Original profit was $50
    "lostProfit": 50,       // We lost $50 in profit
    "recoveredLoss": 0      // No loss was recovered
  }
}
```

#### Example 5: Returned Loss-Making Sale
```json
// Original sale: Profit = -$20 (we lost $20)
// Customer returns it
{
  "returnedSales": {
    "profitImpact": -20,    // Original was a $20 loss
    "lostProfit": 0,        // No profit was lost
    "recoveredLoss": 20     // We recovered $20 of our loss
  }
}
```

---

## Frontend Integration Guide

### Displaying Profit Metrics

```typescript
// Show net profit with breakdown
const netProfit = data.totalProfit;
const gains = data.totalProfitGains;
const losses = Math.abs(data.totalProfitLosses); // Convert to positive for display

console.log(`Net Profit: $${netProfit}`);
console.log(`  └─ Gains: $${gains}`);
console.log(`  └─ Losses: -$${losses}`);
```

### Color Coding
```typescript
// Use green for gains, red for losses
const profitColor = data.totalProfit >= 0 ? 'green' : 'red';
const gainsColor = 'green';
const lossesColor = 'red';
```

### Percentage Calculations
```typescript
// Calculate profit margin
const profitMargin = (data.totalProfit / data.totalRevenue) * 100;

// Calculate what % of revenue was from profitable vs loss-making items
const gainPercentage = (data.totalProfitGains / data.totalRevenue) * 100;
const lossPercentage = (Math.abs(data.totalProfitLosses) / data.totalRevenue) * 100;
```

### Displaying Item Lists
```typescript
// Most Profitable Items
data.mostProfitableItems.forEach(item => {
  console.log(`${item.itemName}: +$${item.profit}`);
});

// Most Loss-Making Items
data.mostLossItems.forEach(item => {
  console.log(`${item.itemName}: -$${Math.abs(item.loss)}`);
});
```

---

## Migration Notes

### Breaking Changes:
1. **`mostProfitableItems`** - Now only includes items with **positive profit** (previously included all items)
2. **New fields added** - Frontend must handle new fields gracefully

### New Fields to Display:
- `totalProfitGains` / `totalProfitLosses` - Show profit breakdown
- `mostLossItems` - Display loss-making items
- `profitGains` / `profitLosses` in sales sections
- `profitImpact`, `lostProfit`, `recoveredLoss` in returns/refunds

### Backward Compatibility:
- All existing fields remain unchanged
- `profit` field still exists with same meaning (total profit including losses)
- Frontend can ignore new fields if not ready to display them

---

## API Endpoints

### Session Report
```
POST /api/report/generate
Body: { sessionId: number }
```

### Outlet Report
```
POST /api/report/generate-outlet
Body: {
  outletId: number,
  startDate?: string,  // ISO date
  endDate?: string     // ISO date
}
```

---

## Data Types Reference

```typescript
type SalesStatus = "Completed" | "Partially Paid" | "Returned" | "Refunded" | "Voided";
type StockStatus = "In Stock" | "Low Stock" | "Out of Stock";
type PaymentMethod = string; // e.g., "Cash", "Card", "E-Wallet", etc.
```

---

## Notes

1. **All monetary values are numbers** (not strings)
2. **All dates are ISO 8601 strings**
3. **Negative profits indicate losses** (selling below cost)
4. **Returns/refunds of loss-making sales actually improve your profit** (recoveredLoss)
5. **Most loss items are sorted by loss amount** (most negative first)
