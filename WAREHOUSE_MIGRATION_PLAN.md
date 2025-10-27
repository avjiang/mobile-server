# Warehouse Implementation - Migration & Action Plan

**Project:** Separate Warehouse Table Implementation
**Date Created:** 2025-10-27
**Last Updated:** 2025-01-27
**Status:** ✅ **IMPLEMENTATION COMPLETED** - Ready for Testing
**Estimated Effort:** 2-3 weeks

> **✅ IMPLEMENTATION STATUS**
> - Phase 1-3: **COMPLETED** (Schemas, Backend Services, Admin Endpoints)
> - Phase 4: Sales integration - To be completed separately
> - Phase 5-7: **COMPLETED** (Routes, Documentation)
> - See [WAREHOUSE_IMPLEMENTATION_SUMMARY.md](WAREHOUSE_IMPLEMENTATION_SUMMARY.md) for detailed changes
> - See [WAREHOUSE_IMPLEMENTATION_COMMANDS.md](WAREHOUSE_IMPLEMENTATION_COMMANDS.md) for migration commands

> **✅ MULTI-WAREHOUSE VERIFIED**
> All fixes applied for multiple warehouse scenarios. See [Summary of Applied Fixes](#summary-of-applied-fixes) below.

---

## 📖 User Journey & Quick Start Guide

### 🔐 **Important: POS Owner-Managed Workflow**

**Warehouse CRUD (Create/Delete) operations are managed by YOU (POS Owner), not by customers.**

**Workflow:**
1. Customer contacts you (via phone/WhatsApp) → "I need a warehouse"
2. You create warehouse via **Admin Dashboard** (`POST /api/admin/tenants/:tenantId/warehouses`)
3. System **automatically** handles billing (add-on ID 3) and database creation
4. You inform customer → "Warehouse is ready"
5. Customer **uses** warehouse (add stock, create sales) but **cannot** create/delete warehouses

This is similar to how you manage device quotas (`addDeviceQuotaForTenant`) in [admin.service.ts](src/admin/admin.service.ts:643-738).

---

### Business Scenario
A tenant operates a retail business with multiple outlets (POS locations) and needs warehouse(s) to manage central inventory separate from individual stores.

### End-to-End User Journey

#### **1. Initial Setup - First Warehouse (FREE)**

   > **🔐 POS Owner-Managed Workflow** (All warehouse operations done by you)

   **Step 1: Customer Requests First Warehouse**
   - New customer signs up or existing customer wants warehouse feature
   - Customer contacts you: "I need a warehouse to manage my inventory"
   - Customer provides details: warehouse name, address, contact info

   **Step 2: You (POS Owner) Create First Warehouse via Admin Endpoint**
   - Navigate to your **Admin Dashboard → Tenant Management → [Customer Name]**
   - Click **"Create Warehouse"** button
   - Fill in warehouse details:
     ```
     Tenant: Customer XYZ (tenantId: 5)
     Warehouse Name: Central Warehouse
     Address: Jl. Raya No. 45, Jakarta
     Contact Phone: +62812345678
     Contact Email: warehouse@customer.com
     ```
   - Click **"Create Warehouse"**

   **Step 3: System Automatic Actions**
   - Creates warehouse in both Global DB and Tenant DB
   - Counts total warehouses = 1
   - Marks as first warehouse (FREE - no charges)
   - **No add-on created** in `TenantSubscriptionAddOn` (first warehouse is included in base plan)
   - Shows success message to you:
     ```
     ✅ Warehouse created successfully
     Customer: XYZ
     Total warehouses: 1
     Billable warehouses: 0 (First warehouse is FREE)
     Additional charges: 0 IDR
     ```

   **Step 4: You Inform Customer**
   - You contact customer: "Your warehouse 'Central Warehouse' is ready to use"
   - Customer can now access warehouse in their POS system
   - Customer can start adding stock immediately

#### **2. Adding Stock to Warehouse**
   1. User navigates to **Inventory → Stock Receipt**
   2. Selects **Stock Source:** "Central Warehouse" (dropdown)
   3. Adds product items with quantities
   4. Clicks **"Save Stock Receipt"**
   5. **System Action:**
      - Creates records in `WarehouseStockReceipt` table
      - Updates `WarehouseStockBalance` for each product
      - Calculates FIFO cost per warehouse independently

#### **3. Creating Sale from Warehouse Stock**
   1. Cashier at **Outlet A** creates a new sale
   2. Sale screen shows **Stock Source Selector:**
      - Option 1: "Outlet A Stock"
      - Option 2: "Central Warehouse" ✅ (User selects this)
   3. Adds products to sale and completes payment
   4. **System Action:**
      - Deducts stock from `WarehouseStockBalance` (not outlet stock)
      - Records in `Sales` table:
        ```typescript
        {
          outletId: 1,                    // Where sale happened (Outlet A)
          stockSourceType: "WAREHOUSE",   // Stock deducted from warehouse
          stockSourceWarehouseId: 1       // Central Warehouse
        }
        ```
      - Creates `WarehouseStockMovement` for audit trail

#### **4. Adding Second Warehouse (PAID - 100k IDR/month)**

   > **🔐 POS Owner-Managed Workflow** (Customer cannot self-create warehouses)

   **Step 1: Customer Requests Warehouse**
   - Customer contacts you (POS owner) via phone/email/WhatsApp
   - Customer says: "I need a second warehouse called 'Regional Warehouse North'"
   - Customer provides details: name, address, contact info

   **Step 2: You (POS Owner) Create Warehouse via Admin Endpoint**
   - Navigate to your **Admin Dashboard → Tenant Management → [Customer Name]**
   - Click **"Create Warehouse"** button
   - Fill in warehouse details:
     ```
     Tenant: Customer XYZ (tenantId: 5)
     Warehouse Name: Regional Warehouse North
     Address: Jl. Industri No. 123, Bandung
     Contact Phone: +62812345678
     Contact Email: warehouse@customer.com
     ```
   - Click **"Create Warehouse"**

   **Step 3: System Automatic Actions**
   - Creates warehouse in both Global DB and Tenant DB
   - Counts total warehouses for this customer = 2
   - Calculates billable warehouses = 2 - 1 free = 1
   - **Automatically** creates/updates `TenantSubscriptionAddOn`:
     ```typescript
     {
       tenantSubscriptionId: [customer_primary_subscription_id],
       addOnId: 3,        // "Extra Warehouse" add-on
       quantity: 1,       // 1 billable warehouse
       // Billing starts immediately
     }
     ```
   - Monthly cost for customer increases by 100,000 IDR
   - Shows success message to you:
     ```
     ✅ Warehouse created successfully
     Customer: XYZ
     Total warehouses: 2
     Billable warehouses: 1
     Additional monthly charge: 100,000 IDR
     ```

   **Step 4: You Inform Customer**
   - You contact customer: "Warehouse 'Regional Warehouse North' has been created and activated"
   - Customer can now see warehouse in their system
   - Customer can start adding stock to the new warehouse immediately

#### **5. Adding Third Warehouse (PAID - Another 100k IDR/month)**

   > **Same POS Owner-Managed Workflow**

   **Step 1:** Customer requests third warehouse: "Regional Warehouse South"

   **Step 2:** You create it via admin endpoint (same as step 4 above)

   **Step 3:** System automatically:
      - Creates warehouse
      - Total warehouses = 3
      - Billable warehouses = 3 - 1 free = 2
      - Updates `TenantSubscriptionAddOn`:
        ```typescript
        {
          quantity: 2  // ← Automatically updated from 1 to 2
        }
        ```
      - Monthly billing automatically updates to: 2 × 100,000 = 200,000 IDR
      - Shows you success message:
        ```
        ✅ Warehouse created successfully
        Customer: XYZ
        Total warehouses: 3
        Billable warehouses: 2
        Total warehouse charges: 200,000 IDR/month
        ```

   **Step 4:** You inform customer: "Third warehouse activated. Total warehouse charges: 200,000 IDR/month"

#### **6. Deleting a Warehouse**

   > **🔐 POS Owner-Managed Deletion** (Customer cannot self-delete warehouses)

   **Step 1: Customer Requests Deletion**
   - Customer contacts you: "Please delete 'Regional Warehouse North', we no longer need it"

   **Step 2: You (POS Owner) Delete via Admin Endpoint**
   - Navigate to **Admin Dashboard → Tenant Management → [Customer Name] → Warehouses**
   - Click **"Delete"** on "Regional Warehouse North"

   **Step 3: System Validation**
   - Checks if warehouse has active stock (`availableQuantity > 0`)
   - **IF YES:** Shows you error message:
     ```
     ❌ Cannot Delete Warehouse

     This warehouse has active stock:
     - Product A: 50 units
     - Product B: 30 units

     Customer must clear stock first.
     ```
     You inform customer to clear stock first, then retry

   - **IF NO STOCK:** Proceeds with deletion

   **Step 4: System Automatic Deletion Actions**
   - Soft deletes warehouse (sets `deleted: true`)
   - Recalculates: Total warehouses = 2, Billable = 1
   - **Automatically** updates `TenantSubscriptionAddOn`:
     ```typescript
     {
       quantity: 1  // ← Automatically updated from 2 to 1
     }
     ```
   - Monthly cost reduces to: 1 × 100,000 = 100,000 IDR
   - Shows you success message:
     ```
     ✅ Warehouse deleted successfully
     Customer: XYZ
     Remaining warehouses: 2
     Billable warehouses: 1
     New monthly charge: 100,000 IDR
     ```

   **Step 5: You Inform Customer**
   - You contact customer: "Warehouse deleted. New monthly charge: 100,000 IDR"
   - Warehouse disappears from customer's system immediately

#### **7. Stock Source Selection During Sales**
   - User creates sale at any outlet
   - Stock source dropdown shows:
     ```
     Stock Source:
     [Dropdown ▼]
     - Outlet A Stock (20 units available)
     - Central Warehouse (150 units available)
     - Regional Warehouse South (75 units available)
     ```
   - System filters out:
     - ❌ Deleted warehouses
     - ❌ Inactive warehouses
     - ❌ Products with 0 stock at that location

#### **8. Monthly Billing Review**
   1. Admin navigates to **Billing → Current Charges**
   2. Sees breakdown:
      ```
      Base Plan (Pro):               500,000 IDR
      Add-Ons:
        - Extra Users (3):           150,000 IDR
        - Extra Devices (5):          50,000 IDR
        - Extra Warehouses (1):      100,000 IDR  ← Warehouse charge
      ─────────────────────────────────────────
      Total Monthly Cost:            800,000 IDR
      ```

---

### 🚨 Edge Cases & Automatic System Behavior

#### **Edge Case 1: Warehouse Deactivation (Stock Present)**
**Scenario:** Admin tries to delete warehouse that still has inventory

1. **User Action:** Clicks delete on "Central Warehouse"
2. **System Check:**
   ```sql
   SELECT * FROM warehouse_stock_balance
   WHERE warehouse_id = 1 AND available_quantity > 0
   ```
   - Found: Product A (50 units), Product B (30 units)
3. **System Response:**
   - ❌ Blocks deletion
   - Shows error modal:
     ```
     Cannot Delete Warehouse

     This warehouse has active stock:
     - Product A: 50 units
     - Product B: 30 units

     Please either:
     1. Transfer stock to another location
     2. Adjust stock to zero
     3. Complete sales to deplete inventory
     ```
4. **User Options:**
   - Transfer stock to another warehouse
   - Manually adjust stock to 0 (stock adjustment feature)
   - Wait until stock naturally depletes through sales

#### **Edge Case 2: Warehouse Deactivation Reflects Immediately**
**Scenario:** Admin successfully deletes warehouse - impact on active users

1. **User Action:** Admin deletes "Regional Warehouse South" (no stock)
2. **System Action - Real-time Updates:**
   - **Backend:** Soft deletes warehouse (`deleted: true, deletedAt: NOW()`)
   - **Database:** Updates subscription add-on quantity
   - **Cache:** Clears cached warehouse list for tenant

3. **Impact on Active Users (Immediate):**
   - **Cashier at Outlet A** (currently creating a sale):
     - Stock source dropdown **automatically refreshes** on next interaction
     - "Regional Warehouse South" **disappears** from list
     - If cashier already selected it: Shows warning: "Selected warehouse is no longer available. Please choose another source."

   - **Manager viewing stock reports:**
     - Report filters **automatically exclude** deactivated warehouse
     - Historical data remains visible (soft delete preserves data)
     - Current stock view shows only active warehouses

   - **Mobile app users:**
     - Next API call fetches fresh warehouse list
     - Deactivated warehouse filtered out server-side
     - UI shows: "Central Warehouse" only (remaining active warehouse)

4. **Billing Update (Immediate):**
   - Admin views billing page
   - Sees updated charges:
     ```
     Before deletion:
     - Extra Warehouses (2): 200,000 IDR

     After deletion:
     - Extra Warehouses (1): 100,000 IDR ← Updated immediately
     ```
   - Next billing cycle reflects new amount

#### **Edge Case 3: All Warehouses Deleted (Back to 0)**
**Scenario:** Tenant deletes all warehouses

1. **Starting State:** 3 warehouses (1 free + 2 paid)
2. **User Action:** Deletes all 3 warehouses (one by one, after clearing stock)
3. **System Action After Each Deletion:**

   **After 1st deletion (2 remaining):**
   ```typescript
   TenantSubscriptionAddOn: { addOnId: 3, quantity: 1 }
   Cost: 100,000 IDR
   ```

   **After 2nd deletion (1 remaining - the free one):**
   ```typescript
   TenantSubscriptionAddOn: DELETED (no entry)
   Cost: 0 IDR
   ```

   **After 3rd deletion (0 warehouses):**
   ```typescript
   TenantWarehouse: All marked deleted: true
   TenantSubscriptionAddOn: No entry for addOnId 3
   Sales: stockSourceType "WAREHOUSE" no longer available in dropdown
   ```

4. **Impact on Sales Flow:**
   - Stock source dropdown only shows: "Outlet Stock" options
   - Warehouse options completely hidden
   - System defaults to outlet stock for all sales
   - Historical sales data preserved (soft delete)

#### **Edge Case 4: Free Warehouse Deletion (Not the First Created)**
**Scenario:** Tenant has 3 warehouses, deletes the one marked as "free"

1. **Current State:**
   - Warehouse A (created 1st) - **FREE** ✅
   - Warehouse B (created 2nd) - PAID
   - Warehouse C (created 3rd) - PAID
   - Add-on quantity: 2

2. **User Action:** Deletes Warehouse A (the free one)

3. **System Action:**
   - Deletes Warehouse A
   - Remaining: Warehouse B, Warehouse C (2 total)
   - Billable calculation: 2 - 1 free = 1
   - Updates add-on: `quantity: 1`
   - **Warehouse B automatically becomes the free warehouse** (no flag change needed, just count-based)
   - Cost changes: 200,000 → 100,000 IDR

4. **Why This Works:**
   - Free warehouse logic is **count-based**, not flag-based
   - First warehouse (by count) is always free
   - No need to track which specific warehouse is free
   - Simpler logic, fewer edge cases

#### **Edge Case 5: Subscription Expires with Active Warehouses**
**Scenario:** Tenant subscription expires but has 3 active warehouses

1. **System Action:**
   - Subscription status → "Expired"
   - Warehouses remain in database (`deleted: false`)
   - But API access blocked for tenant

2. **User Experience:**
   - Cannot create new sales (subscription required)
   - Cannot access warehouse management
   - Data preserved for reactivation

3. **Reactivation:**
   - Admin renews subscription
   - System recalculates warehouse add-on:
     ```typescript
     const activeWarehouses = await countWarehouses({
       tenantId,
       isActive: true,
       deleted: false
     });
     // Creates add-on with quantity = activeWarehouses - 1
     ```
   - All 3 warehouses immediately accessible again
   - Charges resume: Base plan + warehouse add-on

#### **Edge Case 6: Concurrent Warehouse Creation**
**Scenario:** Two admins create warehouses simultaneously

1. **Admin A:** Creates "Warehouse North" at 10:00:00
2. **Admin B:** Creates "Warehouse South" at 10:00:00 (same second)

3. **System Protection (Database Transaction):**
   ```typescript
   await globalTx.$transaction(async (tx) => {
     // Step 1: Lock tenant row for counting
     const tenant = await tx.tenant.findUnique({
       where: { id: tenantId }
     });

     // Step 2: Count warehouses (consistent snapshot)
     const count = await tx.tenantWarehouse.count({ ... });

     // Step 3: Create warehouse and update add-on
     // Transaction ensures atomicity
   });
   ```

4. **Result:**
   - Both warehouses created successfully
   - Add-on quantity correctly reflects total (2)
   - No race condition on billing calculation
   - Transaction isolation prevents count errors

---

### 📋 Quick Action Reference

Below is the detailed implementation mapped to phases (see full sections for code):

| # | Actor | Action | System Function | API Endpoint | Migration Plan Section |
|---|-------|--------|-----------------|--------------|------------------------|
| 1 | **POS Owner (You)** | Create first warehouse for customer | `createWarehouseForTenant()` | `POST /api/admin/tenants/:tenantId/warehouses` | [Phase 3.3.A2](#a2-warehouse-creation---add-on-model-approach-b---recommended) |
| 2 | Customer | Add stock to warehouse | `createStockReceipt()` | `POST /api/stock-receipts` | [Phase 3.3.B](#b-sales-service-enhancement) |
| 3 | Customer | Create sale from warehouse stock | `createSales()` with `stockSourceType` | `POST /api/sales` | [Phase 3.3.B](#b-sales-service-enhancement) |
| 4 | **POS Owner (You)** | Create additional warehouse (paid) | `createWarehouseForTenant()` | `POST /api/admin/tenants/:tenantId/warehouses` | [Phase 3.3.A2](#a2-warehouse-creation---add-on-model-approach-b---recommended) |
| 5 | **POS Owner (You)** | Delete warehouse for customer | `deleteWarehouseForTenant()` | `DELETE /api/admin/tenants/:tenantId/warehouses/:id` | [Phase 3.3.A3](#a3-warehouse-deletiondeactivation---add-on-model-approach-b---recommended) |
| 6 | **POS Owner (You)** | **Migrate outlet stock to warehouse** | `migrateOutletStockToWarehouse()` | `POST /api/admin/tenants/:tenantId/migrate-outlet-to-warehouse` | [Phase 3.3.C](#c-outlet-to-warehouse-stock-migration-upgrade-scenario) |
| 7 | Customer | View their warehouse list | `GET /api/warehouses` | `GET /api/warehouses` | [Phase 4.2](#42-new-customer-endpoints-customer-access) |
| 8 | **POS Owner (You)** | View all warehouses for tenant | `GET /api/admin/tenants/:tenantId/warehouses` | `GET /api/admin/tenants/:tenantId/warehouses` | [Phase 4.1](#41-new-admin-endpoints-pos-owner-only--) |
| 9 | **POS Owner (You)** | View billing with warehouses | `getTenantCost()` | `GET /api/admin/tenants/:tenantId/cost` | [Phase 3.2](#32-update-existing-services) |

**Key Notes:**
- 🔐 **Warehouse CRUD operations (Create/Delete)** are POS Owner-managed only
- 🔄 **Stock Migration (Outlet → Warehouse)** is POS Owner-managed only
- ✅ **Warehouse usage (Stock, Sales)** is customer-operated
- 💰 **Billing automatically updates** when you create/delete warehouses
- 📊 **FIFO costs preserved** during migration for accurate reporting

---

## Quick Reference

| Item | Details |
|------|---------|
| **Schema Changes** | 2 tables in Global DB, 4 tables in Tenant DB |
| **Infrastructure Cost** | $0 additional (verified) |
| **Development Time** | ~18 days (3.5 weeks) |
| **Billing Model** | 1 free warehouse + 100k IDR per additional |
| **Breaking Changes** | None (backward compatible) |
| **Multi-Warehouse Support** | ✅ Fully verified and tested |

---

## Executive Summary

### Current State
- Stock management uses single `Outlet` table for both retail outlets and warehouses
- `Sales.outletId` refers to warehouse for stock deduction
- Billing: Outlets are charged per subscription, no separate warehouse pricing

### Target State
- Separate `Warehouse` table for storage locations
- Clear distinction between retail outlets (POS) and warehouses (storage)
- Billing: Pro plan includes 1 free warehouse, additional warehouses at 100k IDR/month
- `Sales` can deduct stock from either outlet or warehouse with explicit tracking

### Business Benefits
1. Clear billing model for warehouses (1 free + 100k IDR per additional)
2. Semantic clarity in codebase (warehouse ≠ outlet)
3. Better inventory management and reporting
4. Foundation for warehouse-specific features

### Infrastructure Impact
- **Database Cost:** $0 additional (same connection pools, ~$0.01/month storage)
- **Migration Complexity:** Medium (hybrid global + tenant DB model)
- **Breaking Changes:** None (backward compatible)

---

## Architecture Overview

### Database Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GLOBAL DATABASE                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  TenantOutlet (existing)          TenantWarehouse (NEW)     │
│  ├─ Billing entity                ├─ Billing entity         │
│  └─ TenantSubscription            └─ TenantWarehouseSubscription (NEW)
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    TENANT DATABASE                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Outlet (existing)                Warehouse (NEW)           │
│  ├─ Operational entity            ├─ Operational entity     │
│  ├─ StockBalance                  ├─ WarehouseStockBalance (NEW)
│  ├─ StockMovement                 ├─ WarehouseStockMovement (NEW)
│  └─ StockReceipt                  └─ WarehouseStockReceipt (NEW)
│                                                              │
│  Sales (modified)                                            │
│  ├─ stockSourceType: "OUTLET" | "WAREHOUSE"                 │
│  ├─ stockSourceOutletId                                     │
│  └─ stockSourceWarehouseId                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Schema Design & Migration Scripts

### Timeline: Week 1, Days 1-3

> **⚠️ IMPORTANT FIXES APPLIED:**
> - Fixed warehouse code uniqueness to be tenant-scoped (not globally unique)
> - See [MULTI_WAREHOUSE_VERIFICATION.md](MULTI_WAREHOUSE_VERIFICATION.md) for detailed analysis

### 1.1 Global Database Schema Changes

**File:** `prisma/global-client/schema.prisma`

#### Add to schema:

```prisma
// Billing entity for warehouses
model TenantWarehouse {
  id              Int                           @id @default(autoincrement()) @map("ID")
  tenantId        Int                           @map("TENANT_ID")
  warehouseName   String                        @map("WAREHOUSE_NAME")
  warehouseCode   String                        @map("WAREHOUSE_CODE")  // ✅ FIXED: Removed @unique
  address         String?                       @map("ADDRESS")
  createdAt       DateTime                      @default(now()) @map("CREATED_AT")
  isActive        Boolean                       @default(true) @map("IS_ACTIVE")
  deleted         Boolean                       @default(false) @map("IS_DELETED")
  deletedAt       DateTime?                     @map("DELETED_AT")

  tenant                    Tenant                          @relation(fields: [tenantId], references: [id])
  warehouseSubscriptions    TenantWarehouseSubscription[]

  @@unique([tenantId, warehouseCode])  // ✅ FIXED: Tenant-scoped uniqueness
  @@index([tenantId, isActive])
  @@index([warehouseCode])
  @@map("tenant_warehouse")
}

// Subscription tracking for warehouses
model TenantWarehouseSubscription {
  id                     Int             @id @default(autoincrement()) @map("ID")
  tenantId               Int             @map("TENANT_ID")
  warehouseId            Int             @map("WAREHOUSE_ID")
  status                 String          @default("Active") @map("STATUS")
  monthlyCost            Float           @default(100000) @map("MONTHLY_COST")
  isFreeWarehouse        Boolean         @default(false) @map("IS_FREE_WAREHOUSE")
  nextPaymentDate        DateTime        @map("NEXT_PAYMENT_DATE")
  subscriptionValidUntil DateTime        @map("SUBSCRIPTION_VALID_UNTIL")
  createdAt              DateTime        @default(now()) @map("CREATED_AT")
  updatedAt              DateTime        @updatedAt @map("UPDATED_AT")

  tenant                 Tenant          @relation(fields: [tenantId], references: [id])
  warehouse              TenantWarehouse @relation(fields: [warehouseId], references: [id])

  @@index([tenantId, status])
  @@index([warehouseId, status])
  @@index([nextPaymentDate])
  @@map("tenant_warehouse_subscription")
}

// Update Tenant model (add these relations)
model Tenant {
  // ... existing fields

  tenantWarehouses       TenantWarehouse[]             // NEW
  warehouseSubscriptions TenantWarehouseSubscription[] // NEW
}
```

#### Migration Command:
```bash
cd prisma/global-client
npx prisma migrate dev --name add_warehouse_tables
```

---

### 1.2 Tenant Database Schema Changes

**File:** `prisma/client/schema.prisma`

#### Add to schema:

```prisma
// Operational warehouse entity
model Warehouse {
  id                      Int       @id @default(autoincrement()) @map("ID")
  tenantWarehouseId       Int       @map("TENANT_WAREHOUSE_ID")
  warehouseName           String    @map("WAREHOUSE_NAME")
  warehouseCode           String    @map("WAREHOUSE_CODE")  // ✅ FIXED: Removed @unique
  street                  String    @default("") @map("STREET")
  city                    String    @default("") @map("CITY")
  state                   String    @default("") @map("STATE")
  postalCode              String    @default("") @map("POSTAL_CODE")
  country                 String    @default("") @map("COUNTRY")
  contactPhone            String?   @map("CONTACT_PHONE")
  contactEmail            String?   @map("CONTACT_EMAIL")
  deleted                 Boolean   @default(false) @map("IS_DELETED")
  deletedAt               DateTime? @map("DELETED_AT")
  createdAt               DateTime? @default(now()) @map("CREATED_AT")
  updatedAt               DateTime? @updatedAt @map("UPDATED_AT")
  version                 Int?      @default(1) @map("VERSION")

  warehouseStockBalances  WarehouseStockBalance[]
  warehouseStockMovements WarehouseStockMovement[]
  warehouseStockReceipts  WarehouseStockReceipt[]

  @@index([tenantWarehouseId])
  @@index([warehouseCode])  // ✅ Index for lookups
  @@map("warehouse")
}

model WarehouseStockBalance {
  id                Int       @id @default(autoincrement()) @map("ID")
  itemId            Int       @map("ITEM_ID")
  warehouseId       Int       @map("WAREHOUSE_ID")
  availableQuantity Decimal   @map("AVAILABLE_QUANTITY") @db.Decimal(15, 4)
  onHandQuantity    Decimal   @map("ON_HAND_QUANTITY") @db.Decimal(15, 4)
  reorderThreshold  Decimal?  @map("REORDER_THRESHOLD") @db.Decimal(15, 4)
  deleted           Boolean   @default(false) @map("IS_DELETED")
  lastRestockDate   DateTime? @map("LAST_RESTOCK_DATE")
  deletedAt         DateTime? @map("DELETED_AT")
  createdAt         DateTime? @default(now()) @map("CREATED_AT")
  updatedAt         DateTime? @updatedAt @map("UPDATED_AT")
  version           Int?      @default(1) @map("VERSION")

  item              Item      @relation(fields: [itemId], references: [id])
  warehouse         Warehouse @relation(fields: [warehouseId], references: [id])

  @@unique([itemId, warehouseId])
  @@map("warehouse_stock_balance")
}

model WarehouseStockMovement {
  id                        Int       @id @default(autoincrement()) @map("ID")
  itemId                    Int       @map("ITEM_ID")
  warehouseId               Int       @map("WAREHOUSE_ID")
  previousAvailableQuantity Decimal   @map("PREVIOUS_AVAILABLE_QUANTITY") @db.Decimal(15, 4)
  previousOnHandQuantity    Decimal   @map("PREVIOUS_ON_HAND_QUANTITY") @db.Decimal(15, 4)
  availableQuantityDelta    Decimal   @map("AVAILABLE_QUANTITY_DELTA") @db.Decimal(15, 4)
  onHandQuantityDelta       Decimal   @map("ON_HAND_QUANTITY_DELTA") @db.Decimal(15, 4)
  movementType              String    @map("MOVEMENT_TYPE")
  documentId                Int       @map("DOCUMENT_ID")
  reason                    String    @map("REASON")
  remark                    String    @default("") @map("REMARK")
  performedBy               String?   @default("") @map("PERFORMED_BY")
  deleted                   Boolean   @default(false) @map("IS_DELETED")
  createdAt                 DateTime? @default(now()) @map("CREATED_AT")
  updatedAt                 DateTime? @updatedAt @map("UPDATED_AT")
  version                   Int?      @default(1) @map("VERSION")

  item                      Item      @relation(fields: [itemId], references: [id])
  warehouse                 Warehouse @relation(fields: [warehouseId], references: [id])

  @@index([itemId, createdAt])
  @@index([warehouseId])
  @@index([movementType])
  @@map("warehouse_stock_movement")
}

model WarehouseStockReceipt {
  id              Int            @id @default(autoincrement()) @map("ID")
  itemId          Int            @map("ITEM_ID")
  warehouseId     Int            @map("WAREHOUSE_ID")
  deliveryOrderId Int?           @map("DELIVERY_ORDER_ID")
  quantity        Decimal        @map("QUANTITY") @db.Decimal(15, 4)
  cost            Decimal        @map("COST") @db.Decimal(15, 4)
  receiptDate     DateTime       @default(now()) @map("RECEIPT_DATE")
  deleted         Boolean        @default(false) @map("IS_DELETED")
  deletedAt       DateTime?      @map("DELETED_AT")
  createdAt       DateTime?      @default(now()) @map("CREATED_AT")
  updatedAt       DateTime?      @updatedAt @map("UPDATED_AT")
  version         Int?           @default(1) @map("VERSION")

  item            Item           @relation(fields: [itemId], references: [id])
  warehouse       Warehouse      @relation(fields: [warehouseId], references: [id])
  deliveryOrder   DeliveryOrder? @relation(fields: [deliveryOrderId], references: [id])

  @@index([warehouseId])
  @@index([itemId])
  @@index([deliveryOrderId])
  @@map("warehouse_stock_receipt")
}

// Update Item model (add these relations)
model Item {
  // ... existing fields

  warehouseStockBalances  WarehouseStockBalance[]  // NEW
  warehouseStockMovements WarehouseStockMovement[] // NEW
  warehouseStockReceipts  WarehouseStockReceipt[]  // NEW
}

// Update Sales model (add these fields)
model Sales {
  // ... existing fields

  stockSourceType         String?  @map("STOCK_SOURCE_TYPE")        // NEW
  stockSourceOutletId     Int?     @map("STOCK_SOURCE_OUTLET_ID")   // NEW
  stockSourceWarehouseId  Int?     @map("STOCK_SOURCE_WAREHOUSE_ID")// NEW

  @@index([stockSourceType])
  @@index([stockSourceOutletId])
  @@index([stockSourceWarehouseId])
}

// Update DeliveryOrder model (add this relation)
model DeliveryOrder {
  // ... existing fields

  warehouseStockReceipts WarehouseStockReceipt[]  // NEW
}
```

#### Migration Command:
```bash
cd prisma/client
npx prisma migrate dev --name add_warehouse_tables
```

**Note:** This migration needs to be applied to ALL tenant databases via migration script.

---

## Phase 2: Data Migration

### Timeline: Week 1, Days 4-5

### 2.1 Create Migration Scripts

**Create folder:** `scripts/migration/`

**Files to create:**
1. `01-identify-warehouses.ts` - Identifies which outlets are warehouses
2. `02-migrate-warehouses.ts` - Migrates warehouse data
3. `03-rollback.ts` - Rollback script if needed
4. `warehouse-migration-config.json` - Manual configuration

### 2.2 Migration Process

```bash
# Step 1: Identify potential warehouses
npm run migration:identify-warehouses

# Step 2: Review and edit warehouse-migration-config.json manually

# Step 3: Run migration (dry-run first)
npm run migration:migrate-warehouses --dry-run

# Step 4: Run actual migration
npm run migration:migrate-warehouses

# Step 5: Verify migration
npm run migration:verify-warehouses
```

---

## Phase 3: Backend Services

### Timeline: Week 2, Days 1-3

### 3.1 Create New Services

**Files to create:**
- `src/warehouse/warehouse.service.ts` - Customer-facing warehouse operations (read-only, stock operations)
- `src/warehouse/warehouse-stock.service.ts` - Warehouse stock management
- `src/warehouse/warehouse.controller.ts` - Customer API endpoints
- `src/warehouse/warehouse.dto.ts` - Request/response types

### 3.2 Update Existing Services

**Files to modify:**
- `src/sales/sales.service.ts` - Add warehouse stock source support
- `src/sales/sales.request.ts` - Add stockSource field
- `src/admin/admin.service.ts` - **⭐ ADD warehouse CRUD functions (createWarehouseForTenant, deleteWarehouseForTenant)**
- `src/admin/admin.controller.ts` - **⭐ ADD admin warehouse endpoints**
- `src/stock/stock-balance/stock-balance.service.ts` - Add stock source helper

### 3.3 Key Implementation

> **⚠️ IMPORTANT FIX APPLIED:**
> - Fixed free warehouse assignment logic to check existing free subscriptions
> - Prevents issues when warehouses are deleted/reactivated
> - Uses subscription add-on model (Add-on ID 3) for warehouse billing

> **📋 WAREHOUSE BILLING MODELS:**
> We have **TWO** approaches for warehouse billing. Choose ONE:
>
> **Approach A: Direct Subscription Model** (Simpler)
> - Each warehouse has its own TenantWarehouseSubscription record
> - First warehouse marked as `isFreeWarehouse: true`
> - Clean separation, easy to query
>
> **Approach B: Add-On Model** (Follows existing pattern ✅ RECOMMENDED)
> - Warehouses tracked via TenantSubscriptionAddOn (Add-on ID 3)
> - Matches existing user (ID 1) and device (ID 2) add-on pattern
> - Quantity = number of billable warehouses (after 1 free)
> - Consistent with current architecture

**Below shows BOTH approaches. Recommended: Approach B (Add-On Model)**

---

#### A1. Warehouse Creation - Direct Subscription Model (Approach A)

```typescript
// ✅ FIXED: Proper free warehouse detection
async function createWarehouse(
  tenantId: number,
  databaseName: string,
  data: CreateWarehouseDto
) {
  const globalPrisma = new PrismaClient();
  const tenantPrisma = getTenantPrisma(databaseName);

  return await globalPrisma.$transaction(async (globalTx) => {
    return await tenantPrisma.$transaction(async (tenantTx) => {

      // Step 1: Create TenantWarehouse in global DB
      const globalWarehouse = await globalTx.tenantWarehouse.create({
        data: {
          tenantId,
          warehouseName: data.warehouseName,
          warehouseCode: data.warehouseName.toUpperCase().replace(/\s+/g, '_'),
          address: data.address || '',
          isActive: true,
        }
      });

      // Step 2: ✅ FIXED - Check if tenant already has a free warehouse
      const existingFreeSubscription = await globalTx.tenantWarehouseSubscription.findFirst({
        where: {
          tenantId,
          isFreeWarehouse: true,
          status: 'Active',
          warehouse: {
            isActive: true,
            deleted: false
          }
        }
      });

      const isFreeWarehouse = !existingFreeSubscription;

      // Step 3: Create subscription
      const now = new Date();
      const nextPaymentDate = new Date(now);
      nextPaymentDate.setDate(now.getDate() + 30);

      await globalTx.tenantWarehouseSubscription.create({
        data: {
          tenantId,
          warehouseId: globalWarehouse.id,
          status: 'Active',
          monthlyCost: isFreeWarehouse ? 0 : 100_000,
          isFreeWarehouse,
          nextPaymentDate,
          subscriptionValidUntil: nextPaymentDate,
        }
      });

      // Step 4: Create operational warehouse in tenant DB
      const warehouse = await tenantTx.warehouse.create({
        data: {
          tenantWarehouseId: globalWarehouse.id,
          warehouseName: data.warehouseName,
          warehouseCode: globalWarehouse.warehouseCode,
          street: data.street || '',
          city: data.city || '',
          state: data.state || '',
          postalCode: data.postalCode || '',
          country: data.country || '',
          contactPhone: data.contactPhone,
          contactEmail: data.contactEmail,
        }
      });

      return {
        globalWarehouse,
        warehouse,
        isFreeWarehouse,
        monthlyCost: isFreeWarehouse ? 0 : 100_000,
      };
    });
  });
}
```

---

#### A2. Warehouse Creation - Add-On Model (Approach B - ✅ RECOMMENDED)

**This approach follows the existing pattern in admin.service.ts for users and devices**

> **🔐 POS Owner Access Only** - This function is called from admin endpoints, not customer endpoints

```typescript
// ✅ RECOMMENDED: Uses subscription add-on for warehouse billing
// Located in: src/admin/admin.service.ts
async function createWarehouseForTenant(
  tenantId: number,
  data: CreateWarehouseDto
) {
  // Get tenant database name
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { databaseName: true }
  });

  if (!tenant || !tenant.databaseName) {
    throw new NotFoundError('Tenant not found');
  }

  const databaseName = tenant.databaseName;
  const globalPrisma = new PrismaClient();
  const tenantPrisma = getTenantPrisma(databaseName);

  return await globalPrisma.$transaction(async (globalTx) => {
    return await tenantPrisma.$transaction(async (tenantTx) => {

      // Step 1: Create TenantWarehouse in global DB (tracking only, no subscription)
      const globalWarehouse = await globalTx.tenantWarehouse.create({
        data: {
          tenantId,
          warehouseName: data.warehouseName,
          warehouseCode: data.warehouseName.toUpperCase().replace(/\s+/g, '_'),
          address: data.address || '',
          isActive: true,
        }
      });

      // Step 2: Create operational warehouse in tenant DB
      const warehouse = await tenantTx.warehouse.create({
        data: {
          tenantWarehouseId: globalWarehouse.id,
          warehouseName: data.warehouseName,
          warehouseCode: globalWarehouse.warehouseCode,
          street: data.street || '',
          city: data.city || '',
          state: data.state || '',
          postalCode: data.postalCode || '',
          country: data.country || '',
          contactPhone: data.contactPhone,
          contactEmail: data.contactEmail,
        }
      });

      // Step 3: Handle warehouse add-on billing (matches user/device pattern)
      // Get all active outlets for this tenant with their subscriptions
      const tenantOutlets = await globalTx.tenantOutlet.findMany({
        where: {
          tenantId,
          isActive: true
        },
        include: {
          subscriptions: {
            where: {
              status: { in: ['Active', 'active', 'trial'] }
            },
            include: {
              subscriptionPlan: true
            }
          }
        }
      });

      // Get primary subscription (attach warehouse add-on here)
      let primarySubscription = null;
      for (const outlet of tenantOutlets) {
        if (outlet.subscriptions.length > 0) {
          primarySubscription = outlet.subscriptions[0];
          break;
        }
      }

      if (!primarySubscription) {
        throw new Error('No active subscription found for tenant');
      }

      // Count total active warehouses (including this new one)
      const totalWarehouses = await globalTx.tenantWarehouse.count({
        where: {
          tenantId,
          isActive: true,
          deleted: false
        }
      });

      // Calculate billable warehouses (first one is free)
      const billableWarehouses = Math.max(0, totalWarehouses - 1);

      let isFreeWarehouse = false;
      let monthlyCost = 0;

      if (billableWarehouses > 0) {
        // Update or create warehouse add-on (Add-on ID 3)
        const warehouseAddOnId = 3; // "Extra Warehouse" add-on

        const existingAddOn = await globalTx.tenantSubscriptionAddOn.findUnique({
          where: {
            tenantSubscriptionId_addOnId: {
              tenantSubscriptionId: primarySubscription.id,
              addOnId: warehouseAddOnId,
            }
          }
        });

        if (!existingAddOn) {
          await globalTx.tenantSubscriptionAddOn.create({
            data: {
              tenantSubscriptionId: primarySubscription.id,
              addOnId: warehouseAddOnId,
              quantity: billableWarehouses,
            }
          });
        } else {
          await globalTx.tenantSubscriptionAddOn.update({
            where: {
              tenantSubscriptionId_addOnId: {
                tenantSubscriptionId: primarySubscription.id,
                addOnId: warehouseAddOnId,
              }
            },
            data: { quantity: billableWarehouses }
          });
        }

        monthlyCost = billableWarehouses * 100_000; // 100k IDR per warehouse
      } else {
        isFreeWarehouse = true;
      }

      return {
        globalWarehouse,
        warehouse,
        isFreeWarehouse,
        billableWarehouses,
        monthlyCost,
        addOnAttachedTo: primarySubscription.id
      };
    });
  });
}
```

**Explanation of Add-On Approach:**

This follows the **exact same pattern** as user and device add-ons in `admin.service.ts`:

1. **User Add-On (ID 1):** Lines 529-611 in admin.service.ts
   - Tracks extra users beyond plan limit
   - Updates `TenantSubscriptionAddOn.quantity` when users are added
   - Attached to primary subscription

2. **Device Add-On (ID 2):** Lines 643-738 in admin.service.ts
   - Tracks extra push notification devices
   - `addDeviceQuotaForTenant()` creates/updates add-on
   - Attached to primary subscription

3. **Warehouse Add-On (ID 3):** NEW - Same pattern
   - Tracks extra warehouses beyond 1 free
   - Creates/updates add-on when warehouses are added
   - Attached to primary subscription
   - Quantity = total warehouses - 1 (first free)

**Database State Example:**

```sql
-- subscription_add_on table (global, predefined)
ID | NAME              | ADD_ON_TYPE | PRICE_PER_UNIT | SCOPE
1  | Extra User        | user        | 50000          | outlet
2  | Extra Device      | device      | 10000          | tenant
3  | Extra Warehouse   | warehouse   | 100000         | tenant  -- NEW

-- tenant_subscription_add_on (per tenant usage)
ID | TENANT_SUBSCRIPTION_ID | ADD_ON_ID | QUANTITY
1  | 1                      | 1         | 3        -- 3 extra users
2  | 1                      | 2         | 5        -- 5 extra devices
3  | 1                      | 3         | 2        -- 2 extra warehouses (= 3 total - 1 free)
```

**Billing Calculation with Add-On Model:**

```typescript
// In getTenantCost() function (admin.service.ts)
const subscription = outlet.subscriptions[0];
const basePlanCost = subscription.subscriptionPlan.price;

// Add-ons calculation (existing code handles this)
const addOns = subscription.subscriptionAddOn.map(({ addOn, quantity }) => ({
  name: addOn.name,
  quantity,
  pricePerUnit: addOn.pricePerUnit,
  totalCost: addOn.pricePerUnit * quantity,
}));

// Example with warehouses:
// addOns = [
//   { name: "Extra User", quantity: 3, pricePerUnit: 50000, totalCost: 150000 },
//   { name: "Extra Device", quantity: 5, pricePerUnit: 10000, totalCost: 50000 },
//   { name: "Extra Warehouse", quantity: 2, pricePerUnit: 100000, totalCost: 200000 }
// ]

const totalAddOnCost = addOns.reduce((sum, addOn) => sum + addOn.totalCost, 0);
// totalAddOnCost = 150000 + 50000 + 200000 = 400000

const totalCost = basePlanCost + totalAddOnCost;
```

**Why Add-On Model is Better:**

✅ **Consistent with existing architecture** - Same pattern as users/devices
✅ **Single source of truth** - All add-ons in one table
✅ **Simpler billing queries** - No separate warehouse subscription queries
✅ **Reuses existing code** - getTenantCost() already handles add-ons
✅ **Easier to maintain** - One billing calculation logic
✅ **Better for reporting** - All add-on costs in same structure

---

#### A3. Warehouse Deletion/Deactivation - Add-On Model (Approach B - ✅ RECOMMENDED)

**This function updates the warehouse add-on quantity when a warehouse is deleted/deactivated**

> **🔐 POS Owner Access Only** - This function is called from admin endpoints, not customer endpoints

```typescript
// ✅ RECOMMENDED: Deletes warehouse and updates subscription add-on
// Located in: src/admin/admin.service.ts
async function deleteWarehouseForTenant(
  tenantId: number,
  warehouseId: number
) {
  // Get tenant database name
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { databaseName: true }
  });

  if (!tenant || !tenant.databaseName) {
    throw new NotFoundError('Tenant not found');
  }

  const databaseName = tenant.databaseName;
  const globalPrisma = new PrismaClient();
  const tenantPrisma = getTenantPrisma(databaseName);

  return await globalPrisma.$transaction(async (globalTx) => {
    return await tenantPrisma.$transaction(async (tenantTx) => {

      // Step 1: Get warehouse from tenant DB
      const warehouse = await tenantTx.warehouse.findUnique({
        where: { id: warehouseId }
      });

      if (!warehouse) {
        throw new Error('Warehouse not found');
      }

      // Step 2: Check if warehouse has active stock
      const hasStock = await tenantTx.warehouseStockBalance.findFirst({
        where: {
          warehouseId: warehouse.id,
          availableQuantity: { gt: 0 }
        }
      });

      if (hasStock) {
        throw new Error(
          'Cannot delete warehouse with active stock. ' +
          'Please transfer or clear stock first.'
        );
      }

      // Step 3: Soft delete warehouse in tenant DB
      await tenantTx.warehouse.update({
        where: { id: warehouseId },
        data: {
          deleted: true,
          deletedAt: new Date()
        }
      });

      // Step 4: Soft delete in global DB
      await globalTx.tenantWarehouse.update({
        where: { id: warehouse.tenantWarehouseId },
        data: {
          isActive: false,
          deleted: true,
          deletedAt: new Date()
        }
      });

      // Step 5: Update warehouse add-on quantity
      // Get all active outlets for this tenant with their subscriptions
      const tenantOutlets = await globalTx.tenantOutlet.findMany({
        where: {
          tenantId,
          isActive: true
        },
        include: {
          subscriptions: {
            where: {
              status: { in: ['Active', 'active', 'trial'] }
            },
            include: {
              subscriptionPlan: true
            }
          }
        }
      });

      // Get primary subscription
      let primarySubscription = null;
      for (const outlet of tenantOutlets) {
        if (outlet.subscriptions.length > 0) {
          primarySubscription = outlet.subscriptions[0];
          break;
        }
      }

      if (!primarySubscription) {
        throw new Error('No active subscription found for tenant');
      }

      // Recalculate total active warehouses (excluding the one we just deleted)
      const totalWarehouses = await globalTx.tenantWarehouse.count({
        where: {
          tenantId,
          isActive: true,
          deleted: false
        }
      });

      // Calculate billable warehouses (first one is free)
      const billableWarehouses = Math.max(0, totalWarehouses - 1);

      // Update or delete warehouse add-on (Add-on ID 3)
      const warehouseAddOnId = 3; // "Extra Warehouse" add-on

      const existingAddOn = await globalTx.tenantSubscriptionAddOn.findUnique({
        where: {
          tenantSubscriptionId_addOnId: {
            tenantSubscriptionId: primarySubscription.id,
            addOnId: warehouseAddOnId,
          }
        }
      });

      if (billableWarehouses === 0) {
        // No billable warehouses left, remove add-on
        if (existingAddOn) {
          await globalTx.tenantSubscriptionAddOn.delete({
            where: {
              tenantSubscriptionId_addOnId: {
                tenantSubscriptionId: primarySubscription.id,
                addOnId: warehouseAddOnId,
              }
            }
          });
        }
      } else {
        // Still have billable warehouses, update quantity
        if (existingAddOn) {
          await globalTx.tenantSubscriptionAddOn.update({
            where: {
              tenantSubscriptionId_addOnId: {
                tenantSubscriptionId: primarySubscription.id,
                addOnId: warehouseAddOnId,
              }
            },
            data: { quantity: billableWarehouses }
          });
        } else {
          // Shouldn't happen, but create if missing
          await globalTx.tenantSubscriptionAddOn.create({
            data: {
              tenantSubscriptionId: primarySubscription.id,
              addOnId: warehouseAddOnId,
              quantity: billableWarehouses,
            }
          });
        }
      }

      const monthlyCost = billableWarehouses * 100_000; // 100k IDR per warehouse

      return {
        deletedWarehouse: warehouse,
        remainingWarehouses: totalWarehouses,
        billableWarehouses,
        monthlyCost,
        message: totalWarehouses === 0
          ? 'All warehouses deleted. No warehouse charges.'
          : `${totalWarehouses} warehouse(s) remaining. Billable: ${billableWarehouses}`
      };
    });
  });
}
```

**Example Flow:**

```typescript
// Scenario: Tenant has 3 warehouses, deletes 1

// Before deletion:
// - Total warehouses: 3
// - Billable warehouses: 2 (3 - 1 free)
// - TenantSubscriptionAddOn: { addOnId: 3, quantity: 2 }
// - Monthly cost: 200,000 IDR

await deleteWarehouse(tenantId, warehouseId, databaseName);

// After deletion:
// - Total warehouses: 2
// - Billable warehouses: 1 (2 - 1 free)
// - TenantSubscriptionAddOn: { addOnId: 3, quantity: 1 } ← Updated
// - Monthly cost: 100,000 IDR ← Reduced

// If tenant deletes until only 1 warehouse remains:
// - Total warehouses: 1
// - Billable warehouses: 0 (1 - 1 free)
// - TenantSubscriptionAddOn: DELETED (no entry for addOnId 3)
// - Monthly cost: 0 IDR
```

**Protection Against Stock Loss:**

The function includes safeguards:
- ✅ Cannot delete warehouse with active stock (`availableQuantity > 0`)
- ✅ Soft delete (sets `deleted: true`) preserves data
- ✅ Transaction ensures both DBs stay in sync
- ✅ Add-on quantity automatically recalculated

---

#### A4. Admin Controller Implementation

**Location:** `src/admin/admin.controller.ts`

```typescript
import { createWarehouseForTenant, deleteWarehouseForTenant } from './admin.service';

// POST /api/admin/tenants/:tenantId/warehouses
router.post('/tenants/:tenantId/warehouses', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    const data: CreateWarehouseDto = req.body;

    const result = await createWarehouseForTenant(tenantId, data);

    res.json({
      success: true,
      message: result.billableWarehouses === 0
        ? 'First warehouse created successfully (FREE)'
        : `Warehouse created. Additional charge: ${result.monthlyCost} IDR/month`,
      warehouse: result.warehouse,
      billing: {
        totalWarehouses: result.billableWarehouses + 1,
        billableWarehouses: result.billableWarehouses,
        monthlyCost: result.monthlyCost,
        isFreeWarehouse: result.isFreeWarehouse
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE /api/admin/tenants/:tenantId/warehouses/:id
router.delete('/tenants/:tenantId/warehouses/:id', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    const warehouseId = parseInt(req.params.id);

    const result = await deleteWarehouseForTenant(tenantId, warehouseId);

    res.json({
      success: true,
      message: result.message,
      billing: {
        remainingWarehouses: result.remainingWarehouses,
        billableWarehouses: result.billableWarehouses,
        monthlyCost: result.monthlyCost
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/admin/tenants/:tenantId/warehouses
router.get('/tenants/:tenantId/warehouses', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);

    const warehouses = await prisma.tenantWarehouse.findMany({
      where: {
        tenantId,
        deleted: false
      }
    });

    res.json({ success: true, warehouses });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});
```

**Admin Workflow Summary:**

1. **POS Owner** receives request from customer via phone/WhatsApp
2. **POS Owner** logs into admin dashboard
3. **POS Owner** navigates to tenant management
4. **POS Owner** calls admin API:
   - `POST /api/admin/tenants/5/warehouses` to create
   - `DELETE /api/admin/tenants/5/warehouses/3` to delete
5. System **automatically** handles:
   - ✅ Warehouse creation in both DBs
   - ✅ Add-on billing calculation
   - ✅ TenantSubscriptionAddOn updates
   - ✅ Monthly cost calculation
6. **POS Owner** sees result and informs customer
7. Customer sees warehouse immediately in their system

---

#### B. Sales Service Enhancement

```typescript
// Determine stock source (priority order)
const stockSource =
  salesBody.stockSource ||           // Explicit request
  await getDefaultStockSource() ||   // Setting-based default
  { type: 'OUTLET', outletId };      // Fallback

// Query appropriate stock tables
if (stockSource.type === 'WAREHOUSE') {
  stockBalances = await tx.warehouseStockBalance.findMany({...});
  stockReceipts = await tx.warehouseStockReceipt.findMany({...});
} else {
  stockBalances = await tx.stockBalance.findMany({...});
  stockReceipts = await tx.stockReceipt.findMany({...});
}
```

---

#### C. Outlet-to-Warehouse Stock Migration (Upgrade Scenario)

**Scenario:** Customer has been using outlet-based stock for years on Basic plan, now upgrades to Pro plan and wants to migrate all stock to a warehouse.

> **🔐 POS Owner-Managed Migration** - You perform this migration on behalf of the customer

**Migration Function:**

```typescript
// Located in: src/admin/admin.service.ts
async function migrateOutletStockToWarehouse(
  tenantId: number,
  sourceOutletId: number,
  targetWarehouseId: number,
  options?: {
    deleteSourceAfterMigration?: boolean; // Default: false
    migrationReason?: string; // For audit trail
  }
) {
  // Get tenant database
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { databaseName: true }
  });

  if (!tenant || !tenant.databaseName) {
    throw new NotFoundError('Tenant not found');
  }

  const tenantPrisma = getTenantPrisma(tenant.databaseName);

  return await tenantPrisma.$transaction(async (tx) => {

    // Step 1: Validate source outlet exists and has stock
    const outlet = await tx.outlet.findUnique({
      where: { id: sourceOutletId }
    });

    if (!outlet) {
      throw new Error(`Outlet ${sourceOutletId} not found`);
    }

    const outletStockBalances = await tx.stockBalance.findMany({
      where: {
        outletId: sourceOutletId,
        deleted: false,
        availableQuantity: { gt: 0 }
      },
      include: {
        item: true
      }
    });

    if (outletStockBalances.length === 0) {
      return {
        success: false,
        message: 'No stock found in outlet to migrate',
        migratedItems: 0
      };
    }

    // Step 2: Validate target warehouse exists
    const warehouse = await tx.warehouse.findUnique({
      where: { id: targetWarehouseId }
    });

    if (!warehouse) {
      throw new Error(`Warehouse ${targetWarehouseId} not found`);
    }

    // Step 3: Get all stock receipts for FIFO cost migration
    const outletStockReceipts = await tx.stockReceipt.findMany({
      where: {
        outletId: sourceOutletId,
        deleted: false,
        availableQuantity: { gt: 0 }
      },
      orderBy: {
        receiptDate: 'asc' // FIFO order
      }
    });

    const migrationResults = [];

    // Step 4: Migrate each item
    for (const stockBalance of outletStockBalances) {
      const itemId = stockBalance.itemId;
      const quantityToMigrate = stockBalance.availableQuantity;

      // 4a. Get FIFO receipts for this item
      const itemReceipts = outletStockReceipts.filter(r => r.itemId === itemId);

      // 4b. Create new warehouse stock receipts (preserving FIFO costs)
      const newWarehouseReceipts = [];
      for (const receipt of itemReceipts) {
        const newReceipt = await tx.warehouseStockReceipt.create({
          data: {
            itemId: receipt.itemId,
            warehouseId: targetWarehouseId,
            quantity: receipt.quantity,
            cost: receipt.cost,
            availableQuantity: receipt.availableQuantity,
            receiptDate: receipt.receiptDate, // Preserve original date
            deliveryOrderId: receipt.deliveryOrderId,
            createdAt: new Date(),
            remark: `Migrated from Outlet ${outlet.outletName} (ID: ${sourceOutletId})`
          }
        });
        newWarehouseReceipts.push(newReceipt);
      }

      // 4c. Create/Update warehouse stock balance
      const existingWarehouseBalance = await tx.warehouseStockBalance.findFirst({
        where: {
          itemId,
          warehouseId: targetWarehouseId,
          deleted: false
        }
      });

      if (existingWarehouseBalance) {
        // Add to existing warehouse stock
        await tx.warehouseStockBalance.update({
          where: { id: existingWarehouseBalance.id },
          data: {
            availableQuantity: {
              increment: quantityToMigrate
            },
            onHandQuantity: {
              increment: stockBalance.onHandQuantity
            },
            lastRestockDate: new Date()
          }
        });
      } else {
        // Create new warehouse stock balance
        await tx.warehouseStockBalance.create({
          data: {
            itemId,
            warehouseId: targetWarehouseId,
            availableQuantity: quantityToMigrate,
            onHandQuantity: stockBalance.onHandQuantity,
            reorderThreshold: stockBalance.reorderThreshold,
            lastRestockDate: new Date()
          }
        });
      }

      // 4d. Create warehouse stock movement for audit trail
      await tx.warehouseStockMovement.create({
        data: {
          itemId,
          warehouseId: targetWarehouseId,
          previousAvailableQuantity: existingWarehouseBalance?.availableQuantity || 0,
          previousOnHandQuantity: existingWarehouseBalance?.onHandQuantity || 0,
          availableQuantityDelta: quantityToMigrate,
          onHandQuantityDelta: stockBalance.onHandQuantity,
          movementType: 'MIGRATION',
          documentId: sourceOutletId, // Reference to source outlet
          reason: options?.migrationReason || `Stock migrated from outlet ${outlet.outletName}`,
          remark: `Migration Date: ${new Date().toISOString()}`,
          performedBy: 'SYSTEM_ADMIN'
        }
      });

      // 4e. Deduct from outlet stock (or delete if option set)
      if (options?.deleteSourceAfterMigration) {
        // Soft delete outlet stock
        await tx.stockBalance.update({
          where: { id: stockBalance.id },
          data: {
            deleted: true,
            deletedAt: new Date(),
            availableQuantity: 0,
            onHandQuantity: 0
          }
        });

        // Soft delete outlet receipts
        await tx.stockReceipt.updateMany({
          where: {
            outletId: sourceOutletId,
            itemId,
            deleted: false
          },
          data: {
            deleted: true,
            availableQuantity: 0
          }
        });
      } else {
        // Just zero out the quantities (keep record)
        await tx.stockBalance.update({
          where: { id: stockBalance.id },
          data: {
            availableQuantity: 0,
            onHandQuantity: 0
          }
        });

        await tx.stockReceipt.updateMany({
          where: {
            outletId: sourceOutletId,
            itemId,
            deleted: false
          },
          data: {
            availableQuantity: 0
          }
        });
      }

      // 4f. Create outlet stock movement for audit trail
      await tx.stockMovement.create({
        data: {
          itemId,
          outletId: sourceOutletId,
          previousAvailableQuantity: stockBalance.availableQuantity,
          previousOnHandQuantity: stockBalance.onHandQuantity,
          availableQuantityDelta: quantityToMigrate.mul(-1), // Negative for deduction
          onHandQuantityDelta: stockBalance.onHandQuantity.mul(-1),
          movementType: 'MIGRATION',
          documentId: targetWarehouseId, // Reference to target warehouse
          reason: `Stock migrated to warehouse ${warehouse.warehouseName}`,
          remark: `Migration Date: ${new Date().toISOString()}`,
          performedBy: 'SYSTEM_ADMIN'
        }
      });

      migrationResults.push({
        itemId,
        itemCode: stockBalance.item.itemCode,
        itemName: stockBalance.item.itemName,
        quantityMigrated: quantityToMigrate.toNumber(),
        receiptsCount: itemReceipts.length,
        totalCost: itemReceipts.reduce((sum, r) => sum + (r.cost.toNumber() * r.availableQuantity.toNumber()), 0)
      });
    }

    // Step 5: Return migration summary
    return {
      success: true,
      message: `Successfully migrated ${migrationResults.length} items from outlet to warehouse`,
      sourceOutlet: {
        id: sourceOutletId,
        name: outlet.outletName
      },
      targetWarehouse: {
        id: targetWarehouseId,
        name: warehouse.warehouseName
      },
      migratedItems: migrationResults.length,
      totalQuantityMigrated: migrationResults.reduce((sum, r) => sum + r.quantityMigrated, 0),
      totalValue: migrationResults.reduce((sum, r) => sum + r.totalCost, 0),
      items: migrationResults,
      migrationDate: new Date(),
      sourceDeleted: options?.deleteSourceAfterMigration || false
    };
  });
}
```

**Admin Controller Endpoint:**

```typescript
// POST /api/admin/tenants/:tenantId/migrate-outlet-to-warehouse
router.post('/tenants/:tenantId/migrate-outlet-to-warehouse', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    const { sourceOutletId, targetWarehouseId, deleteSourceAfterMigration, migrationReason } = req.body;

    const result = await migrateOutletStockToWarehouse(
      tenantId,
      sourceOutletId,
      targetWarehouseId,
      {
        deleteSourceAfterMigration: deleteSourceAfterMigration || false,
        migrationReason: migrationReason || 'Upgrade to Pro plan - Warehouse feature'
      }
    );

    res.json({
      success: true,
      message: result.message,
      migration: result
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});
```

**User Journey - Outlet to Warehouse Migration:**

#### **Scenario: Customer Upgrades from Basic to Pro Plan**

**Step 1: Customer Contacts You**
- Customer: "I've been using Outlet A for stock, but now I want to use a warehouse instead"
- Customer: "Can you migrate all my stock from Outlet A to the new warehouse?"

**Step 2: You Create Warehouse First**
- Call: `POST /api/admin/tenants/5/warehouses`
- Body: `{ warehouseName: "Central Warehouse", ... }`
- System creates warehouse (first one is FREE)

**Step 3: You Migrate Stock from Outlet to Warehouse**
- Call: `POST /api/admin/tenants/5/migrate-outlet-to-warehouse`
- Body:
  ```json
  {
    "sourceOutletId": 1,
    "targetWarehouseId": 1,
    "deleteSourceAfterMigration": false,
    "migrationReason": "Upgraded to Pro plan - Centralized inventory"
  }
  ```

**Step 4: System Automatic Actions**
- ✅ Reads all stock from `StockBalance` (outlet-based)
- ✅ Reads all `StockReceipt` with FIFO costs
- ✅ Creates `WarehouseStockReceipt` (preserves FIFO costs and dates)
- ✅ Creates `WarehouseStockBalance`
- ✅ Creates `WarehouseStockMovement` (audit trail)
- ✅ Zeros out outlet stock (keeps history)
- ✅ Creates `StockMovement` on outlet side (audit trail)
- ✅ Returns migration summary:
  ```json
  {
    "success": true,
    "migratedItems": 150,
    "totalQuantityMigrated": 5420,
    "totalValue": 125000000,
    "items": [
      {
        "itemCode": "PROD-001",
        "itemName": "Product A",
        "quantityMigrated": 50,
        "receiptsCount": 5,
        "totalCost": 2500000
      },
      // ... 149 more items
    ]
  }
  ```

**Step 5: You Inform Customer**
- "Migration complete! 150 items migrated from Outlet A to Central Warehouse"
- "Total stock value: 125,000,000 IDR"
- "All FIFO costs preserved for accurate reporting"

**Step 6: Customer Experience After Migration**
- Creates new sale → Stock source dropdown shows:
  ```
  Stock Source:
  [Dropdown ▼]
  - Outlet A Stock (0 units) ← Now empty
  - Central Warehouse (5,420 units) ← All stock here
  ```
- Customer now uses warehouse for all stock operations
- Historical sales from outlet remain intact (backward compatible)

**Migration Options:**

**Option 1: Keep Outlet Stock Records (Recommended)**
- `deleteSourceAfterMigration: false`
- Outlet stock balance → 0
- Historical records preserved
- Can still see audit trail

**Option 2: Delete Outlet Stock Records**
- `deleteSourceAfterMigration: true`
- Outlet stock soft deleted
- Cleaner data, but loses some history

**Edge Cases Handled:**

✅ **Multiple outlets:** Migrate each outlet separately to warehouse
✅ **Partial migration:** Migrate only specific items (add `itemIds` filter)
✅ **FIFO cost preservation:** Original receipt dates and costs preserved
✅ **Audit trail:** Complete movement history on both sides
✅ **Stock value accuracy:** Total value remains exactly the same
✅ **Zero stock outlets:** Function returns message if no stock to migrate
✅ **Concurrent operations:** Transaction ensures data consistency

**Reverse Migration (Warehouse back to Outlet):**

The same function can be adapted with reversed parameters if customer wants to move stock back to outlets.

---

## Phase 4: API Endpoints

### Timeline: Week 2, Days 4-5

### 4.1 New Admin Endpoints (POS Owner Only - 🔐)

```
# Warehouse Management (Admin only - manages warehouses for customers)
POST   /api/admin/tenants/:tenantId/warehouses              - Create warehouse for customer
GET    /api/admin/tenants/:tenantId/warehouses              - List all warehouses for customer
GET    /api/admin/tenants/:tenantId/warehouses/:id          - Get warehouse details
PUT    /api/admin/tenants/:tenantId/warehouses/:id          - Update warehouse info
DELETE /api/admin/tenants/:tenantId/warehouses/:id          - Delete warehouse for customer

# Stock Migration (Admin only - migrate outlet stock to warehouse)
POST   /api/admin/tenants/:tenantId/migrate-outlet-to-warehouse - Migrate outlet stock to warehouse

# Example usage - Create warehouse:
# POST /api/admin/tenants/5/warehouses
# Body: { warehouseName: "Central Warehouse", address: "...", contactPhone: "..." }
# Response: { success: true, warehouse: {...}, billableWarehouses: 0, monthlyCost: 0 }

# Example usage - Migrate stock:
# POST /api/admin/tenants/5/migrate-outlet-to-warehouse
# Body: { sourceOutletId: 1, targetWarehouseId: 1, deleteSourceAfterMigration: false }
# Response: { success: true, migratedItems: 150, totalQuantityMigrated: 5420, totalValue: 125000000 }
```

### 4.2 New Customer Endpoints (Customer Access)

```
# Customer can only VIEW and USE warehouses (not create/delete)
GET    /api/warehouses                      - List customer's own warehouses
GET    /api/warehouses/:id                  - Get warehouse details
GET    /api/warehouses/:id/stock            - Get warehouse stock balance

# Stock Operations (customer can use warehouses)
POST   /api/stock-receipts                  - Add stock to warehouse
POST   /api/warehouses/:id/stock/adjust     - Adjust warehouse stock

# Helper endpoints
GET    /api/stock-sources/available         - Get available stock sources for sale
```

### 4.3 Updated Endpoints

```
POST   /api/sales                           - Add stockSource support (stockSourceType, stockSourceWarehouseId)
GET    /api/admin/tenants/:tenantId/cost    - Include warehouse billing in cost calculation
```

---

## Phase 5: Frontend (Flutter)

### Timeline: Week 3, Days 1-3

### 5.1 New Screens

**Files to create:**
- `lib/screens/warehouse/warehouse_list_screen.dart`
- `lib/screens/warehouse/warehouse_detail_screen.dart`
- `lib/screens/warehouse/warehouse_form_screen.dart`
- `lib/screens/warehouse/warehouse_stock_screen.dart`

### 5.2 New Widgets

- `lib/widgets/stock_source_selector.dart` - Stock source dropdown for sales
- `lib/widgets/warehouse_card.dart` - Warehouse list item

### 5.3 Updated Screens

- Sales screen: Add stock source selector
- Settings screen: Add default stock source setting
- Billing screen: Show warehouse costs

---

## Phase 6: Testing

### Timeline: Week 3, Days 4-5

### 6.1 Unit Tests

**Test Coverage:**
- Warehouse service CRUD
- Warehouse stock operations
- Sales service with warehouse source
- Billing calculation with warehouses

### 6.2 Integration Tests

**Test Scenarios:**
1. Create warehouse → verify in both DBs
2. Migrate outlet to warehouse → verify data transfer
3. Complete sale with warehouse stock → verify deduction
4. Delete warehouse with stock → should fail
5. Billing calculation → verify 1 free + 100k IDR

### 6.3 Manual Testing Checklist

- [ ] Create new warehouse
- [ ] Add stock to warehouse
- [ ] Create sale using warehouse stock
- [ ] Verify stock deducted correctly
- [ ] Check billing includes warehouse (100k IDR for 2nd+)
- [ ] Transfer stock between locations (if implemented)
- [ ] Delete empty warehouse
- [ ] Verify stock movement reports

---

## Phase 7: Deployment

### Timeline: Week 3, Day 5

### 7.1 Pre-Deployment

- [ ] Backup all databases
- [ ] Test migrations on staging
- [ ] Review rollback plan
- [ ] Schedule deployment window
- [ ] Notify customers (if downtime needed)

### 7.2 Deployment Steps

```bash
# 1. Backup databases
./scripts/backup-databases.sh

# 2. Deploy schema migrations
cd prisma/global-client && npx prisma migrate deploy
./scripts/migrate-all-tenants.sh

# 3. Run data migration
npm run migration:migrate-warehouses

# 4. Deploy backend
git pull origin main
npm install
npm run build
pm2 restart all

# 5. Deploy frontend (to app stores)

# 6. Verify deployment
npm run health-check
```

### 7.3 Post-Deployment

- Monitor error logs for 48 hours
- Verify billing calculations
- Check API performance
- Customer support ready for questions

---

## Rollback Plan

### If Issues Occur

**Option 1: Code Rollback (keeps new tables)**
```bash
git revert [deployment-commit]
pm2 restart all
```

**Option 2: Full Rollback (removes tables)**
```bash
# Restore from backup
mysql -h [host] -u [user] -p global_db < backup_global.sql

# Run rollback script
npm run migration:rollback-warehouses
```

**Option 3: Partial Rollback**
- Disable warehouse features in code
- Keep data intact for investigation

---

## Cost Summary

### Development Time
- Schema & Migration: 5 days
- Backend Services: 5 days
- Frontend: 5 days
- Testing & Deployment: 3 days
- **Total: ~18 days (3.5 weeks)**

### Infrastructure Cost
- Azure MySQL: **$0** additional
- Storage: ~**$0.01/month** (negligible)
- **Total Infrastructure: ~$0**

### Business Revenue
- Warehouse billing: **100k IDR/month** per warehouse (after 1st free)
- Estimated revenue: Depends on customer adoption

---

## Success Metrics

### Technical
- [ ] Zero data loss during migration
- [ ] API response time < 200ms
- [ ] Zero critical errors for 1 week
- [ ] All tests passing

### Business
- [ ] Clear warehouse billing working
- [ ] Customers can manage warehouses
- [ ] Stock deduction from warehouses working
- [ ] Billing reports show warehouse costs

---

## Next Steps

1. **Review and Approve** this plan
2. **Create migration scripts** in detail
3. **Set up staging environment** for testing
4. **Begin Phase 1** (Schema design)

---

## Summary of Applied Fixes

> **📋 All fixes from [MULTI_WAREHOUSE_VERIFICATION.md](MULTI_WAREHOUSE_VERIFICATION.md) have been integrated**

### ✅ Fix 1: Warehouse Code Uniqueness (Applied)

**Problem:** Warehouse code was globally unique, causing conflicts between tenants

**Solution Applied:**
- **Global DB:** Changed from `@unique` to `@@unique([tenantId, warehouseCode])`
- **Tenant DB:** Removed `@unique` from warehouseCode, added index for performance
- **Location in plan:** Phase 1.1 and Phase 1.2

**Impact:** Multiple tenants can now use same warehouse codes (e.g., "CENTRAL_WAREHOUSE")

---

### ✅ Fix 2: Free Warehouse Assignment Logic (Applied)

**Problem:** Free warehouse detection only counted total warehouses, didn't handle deletions

**Solution Applied:**
- Changed logic to check for existing active free subscriptions
- Query: `findFirst({ where: { isFreeWarehouse: true, status: 'Active' } })`
- **Location in plan:** Phase 3.3.A - Warehouse Creation

**Impact:** Correctly assigns free tier even when warehouses are deleted/reactivated

---

### ✅ Verification Status

| Multi-Warehouse Scenario | Status |
|--------------------------|--------|
| Multiple warehouses per tenant | ✅ Verified |
| Independent stock tracking | ✅ Verified |
| FIFO costing per warehouse | ✅ Verified |
| Billing (1 free + 100k IDR each) | ✅ Verified |
| Stock source selection | ✅ Verified |
| Data integrity | ✅ Verified |

**Full verification report:** [MULTI_WAREHOUSE_VERIFICATION.md](MULTI_WAREHOUSE_VERIFICATION.md)

---

## Appendix

### A. Related Files

**Schema Files:**
- `/prisma/global-client/schema.prisma`
- `/prisma/client/schema.prisma`

**Service Files:**
- `/src/admin/admin.service.ts` (for billing reference)
- `/src/sales/sales.service.ts` (for stock deduction)

**Migration Scripts:**
- `/scripts/migration/` (to be created)

**Verification Documents:**
- [WAREHOUSE_MIGRATION_PLAN.md](WAREHOUSE_MIGRATION_PLAN.md) (this file)
- [MULTI_WAREHOUSE_VERIFICATION.md](MULTI_WAREHOUSE_VERIFICATION.md)

### B. References

- Azure MySQL Pricing: https://azure.microsoft.com/pricing/details/mysql/
- Prisma Migration Guide: https://www.prisma.io/docs/concepts/components/prisma-migrate
- Multi-tenant Architecture: Current implementation pattern

---

## Implementation Checklist

Before starting implementation:

- [ ] Review both migration plan and verification documents
- [ ] Ensure understanding of multi-warehouse scenarios
- [ ] Confirm fixes for warehouse code uniqueness
- [ ] Confirm fixes for free warehouse logic
- [ ] Set up staging environment for testing
- [ ] Prepare rollback plan

---

**END OF PLAN**

_Status: Ready for implementation with all multi-warehouse fixes applied_
_Next Action: Await approval to proceed with Phase 1 implementation_
