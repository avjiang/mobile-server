# Procurement Module - Business Guide

> **Audience:** Product Managers, Sales Team, Business Stakeholders
> **Purpose:** Understand the procurement workflow and features without technical details

---

## What is the Procurement Module?

The Procurement Module helps businesses manage their **entire purchasing cycle** - from requesting quotes from suppliers to paying invoices and handling returns. It provides complete visibility and control over all purchasing activities.

---

## The Procurement Workflow

The procurement process follows a logical flow from start to finish:

```
┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  Quotation   │ →  │  Purchase Order  │ →  │  Delivery Order  │
│  (Get Price) │    │  (Place Order)   │    │  (Receive Goods) │
└──────────────┘    └──────────────────┘    └──────────────────┘
                                                     │
                                                     ▼
                    ┌──────────────────┐    ┌──────────────────┐
                    │ Invoice          │ ←  │  Stock Updated   │
                    │ Settlement (Pay) │    │  Automatically   │
                    └──────────────────┘    └──────────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ Purchase Return  │  (If items need to be returned)
                    │ (Return Goods)   │
                    └──────────────────┘
```

---

## Module Breakdown

### 1. Quotation

**What it does:** Request and compare prices from suppliers before committing to a purchase.

**Key Features:**
- Create quotation requests with specific items and quantities
- Set validity dates for quotes
- Compare prices across different suppliers
- Convert approved quotations directly into purchase orders

**Business Value:**
- Ensures competitive pricing
- Provides documentation for price negotiations
- Streamlines the approval process

**Status Flow:**
- **Draft** → Initial creation, can still be edited
- **Confirmed** → Finalized and ready to convert
- **Converted** → Successfully turned into a Purchase Order
- **Cancelled** → Quotation voided

---

### 2. Purchase Order (PO)

**What it does:** Officially order items from suppliers after quotation approval.

**Key Features:**
- Create purchase orders linked to quotations (or standalone)
- Track ordered quantities vs. delivered quantities
- Support for partial deliveries
- Automatic status updates based on delivery progress

**Business Value:**
- Clear commitment record with suppliers
- Tracks fulfillment progress
- Provides basis for receiving goods and invoicing

**Status Flow:**
- **Confirmed** → Order placed with supplier
- **Partially Delivered** → Some items received, more expected
- **Delivered** → All ordered items have been received
- **Completed** → All invoices paid and settled
- **Cancelled** → Order cancelled

---

### 3. Delivery Order (DO)

**What it does:** Record when goods arrive from suppliers.

**Key Features:**
- Record received quantities (may differ from ordered)
- Support multiple deliveries per purchase order
- **Automatic stock updates** - inventory increases when delivery is confirmed
- Track delivery fees per item

**Business Value:**
- Accurate receiving records
- Real-time inventory updates
- Discrepancy tracking (ordered vs. received)

**What happens behind the scenes:**
When a delivery is confirmed, the system automatically:
- Adds the received quantity to your inventory
- Records the item cost (including delivery fees)
- Creates an audit trail of the stock movement

---

### 4. Invoice

**What it does:** Record supplier invoices for payment processing.

**Key Features:**
- Link invoices to purchase orders and deliveries
- Support tax-inclusive or tax-exclusive amounts
- Track discount amounts
- Support multiple invoices per purchase order

**Business Value:**
- Accurate accounts payable tracking
- Tax documentation
- Payment planning

**Status Flow:**
- **Completed** → Invoice recorded, awaiting payment
- **Paid** → Invoice has been settled
- **Cancelled** → Invoice voided

---

### 5. Invoice Settlement

**What it does:** Record payments made to suppliers.

**Key Features:**
- Settle multiple invoices in a single payment
- Support various payment methods (bank transfer, cash, etc.)
- Track rebates and discounts at settlement level
- Record tax invoice numbers for compliance

**Business Value:**
- Consolidated payment tracking
- Rebate documentation
- Clear payment history per supplier

**Payment Methods Supported:**
- Bank Transfer
- Cash
- Cheque
- Credit Card
- Other

---

### 6. Purchase Return

**What it does:** Handle returns of defective, damaged, or incorrect items after purchase.

**Key Features:**
- Return items from any settled invoice
- Specify return reasons for each item
- **Automatic stock adjustment** - inventory decreases when return is processed
- Track returns linked to original invoices and settlements

**Return Reasons:**
| Reason | Description |
|--------|-------------|
| Defect | Manufacturing defect found |
| Spoilt | Item expired or spoiled |
| Broken | Damaged during delivery or storage |
| Wrong Item | Supplier sent incorrect item |
| Other | Other reasons (requires explanation) |

**Business Value:**
- Accurate inventory after returns
- Documentation for supplier claims
- Return tracking for supplier performance analysis

**What happens when you create a return:**
1. Stock quantity is automatically reduced
2. The return is linked to the original invoice and settlement
3. Net amounts are recalculated to show actual cost

---

## Key Business Scenarios

### Scenario 1: Standard Purchase Cycle

1. **Get Quote:** Create quotation for 100 units of Product A from Supplier X
2. **Place Order:** Convert quotation to purchase order
3. **Receive Goods:** Record delivery of 100 units, stock increases automatically
4. **Get Invoice:** Record supplier's invoice for $10,000
5. **Make Payment:** Settle the invoice via bank transfer

**Result:** Complete audit trail from quote to payment, inventory updated.

---

### Scenario 2: Partial Delivery

1. **Place Order:** Order 100 units of Product A
2. **First Delivery:** Receive 60 units → PO status becomes "Partially Delivered"
3. **Second Delivery:** Receive remaining 40 units → PO status becomes "Delivered"
4. **Invoice & Pay:** Process invoice and settlement

**Result:** Accurate tracking of split shipments, inventory updated per delivery.

---

### Scenario 3: Return After Payment

1. **Complete Purchase:** Full cycle from PO to settlement completed
2. **Issue Found:** 10 units found defective 2 weeks later
3. **Create Return:** Record purchase return with reason "Defect"
4. **Automatic Updates:**
   - Stock reduced by 10 units
   - Invoice shows net amount after return
   - Settlement shows adjusted total

**Result:** Accurate inventory and financial records reflecting the return.

---

### Scenario 4: Multiple Invoices, Single Payment

1. **Multiple Orders:** 3 purchase orders from same supplier over a month
2. **Multiple Invoices:** Each PO generates an invoice ($5,000 each)
3. **Consolidated Payment:** Create single settlement for all 3 invoices ($15,000)
4. **Apply Rebate:** Record 2% rebate from supplier ($300)

**Result:** Single payment record covering multiple invoices, rebate documented.

---

## Reports & Visibility

### What You Can Track

| Report Area | What It Shows |
|-------------|---------------|
| **By Supplier** | All quotations, orders, deliveries, invoices per supplier |
| **By Purchase Order** | Complete lifecycle of each order |
| **By Invoice** | Payment status, linked deliveries, returns |
| **By Settlement** | All invoices paid in each payment |
| **Returns** | All returns with reasons, linked to original purchases |

### Key Metrics Available

- Total ordered vs. delivered quantities
- Invoice totals vs. amounts paid
- Return amounts by supplier
- Outstanding invoices
- Settlement history

---

## Stock Integration Summary

The procurement module automatically manages inventory:

| Action | Stock Impact |
|--------|--------------|
| Delivery confirmed | Stock **increases** |
| Purchase return created | Stock **decreases** |
| Return cancelled | Stock **restored** |

**No manual stock adjustments needed** - the system handles it automatically.

---

## Linking & Traceability

Every transaction is linked for full traceability:

```
Quotation
    └── Purchase Order
            └── Delivery Order(s)
                    └── Stock Receipts (cost tracking)
            └── Invoice(s)
                    └── Invoice Settlement
                    └── Purchase Return(s)
```

**From any point, you can trace:**
- Which quotation led to which order
- Which deliveries fulfilled which order
- Which invoices were paid in which settlement
- Which returns apply to which invoice

---

## Frequently Asked Questions

### Q: Can I create a purchase order without a quotation?
**A:** Yes, quotations are optional. You can create standalone purchase orders.

### Q: What if I receive more items than ordered?
**A:** The delivery order can record the actual received quantity, which may exceed the ordered quantity.

### Q: Can I pay multiple invoices at once?
**A:** Yes, invoice settlements support grouping multiple invoices into a single payment.

### Q: What happens to stock when I return items?
**A:** Stock is automatically reduced when a purchase return is created. If the return is cancelled, stock is restored.

### Q: Can I return items months after purchase?
**A:** Yes, you can create a purchase return at any time after the invoice is settled.

### Q: How is the return amount calculated?
**A:** Return amount = quantity returned × original unit price from the invoice.

### Q: Can I track why items were returned?
**A:** Yes, each return item requires a reason (Defect, Spoilt, Broken, Wrong Item, or Other with explanation).

---

## Glossary

| Term | Definition |
|------|------------|
| **Quotation** | A price request sent to suppliers before ordering |
| **Purchase Order (PO)** | An official order placed with a supplier |
| **Delivery Order (DO)** | A record of goods received from a supplier |
| **Invoice** | A bill from the supplier for goods delivered |
| **Settlement** | Payment made to supplier for one or more invoices |
| **Purchase Return** | Goods sent back to supplier due to issues |
| **Stock Balance** | Current inventory quantity on hand |
| **Rebate** | Discount given by supplier at payment time |

---

## Summary

The Procurement Module provides **end-to-end visibility** of your purchasing operations:

- **Request quotes** and compare supplier prices
- **Place orders** and track fulfillment
- **Receive goods** with automatic stock updates
- **Process invoices** and manage payments
- **Handle returns** with proper documentation

All transactions are linked, providing complete traceability from initial quote to final payment (and any returns).

---

*For technical integration details, see [PROCUREMENT_MODULE_DOCUMENTATION.md](./PROCUREMENT_MODULE_DOCUMENTATION.md)*
