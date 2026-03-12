# Lite Plan — Comprehensive Implementation Reference

> **Status:** Planning complete, ready for implementation
> **Markets:** Indonesia + Malaysia
> **Target segment:** Solo micro-vendors (pasar malam, warung, kaki lima, gerai tepi jalan)
> **Created:** March 2026

---

## Table of Contents

1. [Plan Overview](#1-plan-overview)
2. [Target Market Analysis](#2-target-market-analysis)
3. [Feature Matrix](#3-feature-matrix)
4. [Architecture — Local-First Model](#4-architecture--local-first-model)
5. [Server-Side Implementation](#5-server-side-implementation)
6. [Flutter App Implementation](#6-flutter-app-implementation)
7. [Upgrade Path: Lite to Basic](#7-upgrade-path-lite-to-basic)
8. [Critical Issues & Solutions](#8-critical-issues--solutions)
9. [UI Flow Suggestions for Frontend Team](#9-ui-flow-suggestions-for-frontend-team)
10. [Testing & Verification](#10-testing--verification)
11. [Decision Log](#11-decision-log)

---

## 1. Plan Overview

### Pricing

|                               | Lite                         | Trial             | Basic                  | Pro                     |
| ----------------------------- | ---------------------------- | ----------------- | ---------------------- | ----------------------- |
| **Price**                     | RM 35 / Rp 100,000 per month | Rp 0              | Rp 300,000/mo (~RM 88) | Rp 450,000/mo (~RM 132) |
| **Trial period**              | 7 days                       | 30 days           | 30 days                | 30 days                 |
| **Users**                     | 1                            | 2                 | 2 (+add-on)            | 3 (+add-on)             |
| **Items**                     | 50 max                       | Unlimited         | Unlimited              | Unlimited               |
| **Outlets**                   | 1                            | Unlimited         | Unlimited              | Unlimited               |
| **Push Notification Devices** | 0                            | 0                 | 0                      | 3 (+add-on)             |
| **Warehouses**                | 0                            | 0                 | 0                      | 1 free (+add-on)        |
| **Data storage**              | Local Realm DB (phone)       | Cloud (tenant DB) | Cloud (tenant DB)      | Cloud (tenant DB)       |
| **Server cost**               | ~$0.01/mo (auth only)        | ~$2-5/mo          | ~$2-5/mo               | ~$2-5/mo                |

### Tier Progression

```
Lite (RM 35)          Basic (RM 88)           Pro (RM 132)
Pasar malam owner  →  Opens a small shop   →  Multiple outlets
1 person, 1 stall     2-3 staff, suppliers     Warehouse, loyalty
Simple sales          Full procurement         Enterprise features
Local data            Cloud sync               Cloud sync + advanced
```

### Implementation Split

- **Server (this repo):** Minimal — subscription plan seed, auth bypass for Lite, plan-gate middleware, skip tenant DB creation
- **Flutter app:** Major — local Realm DB database, simplified UI, offline-first architecture, "Export My Data" feature

---

## 2. Target Market Analysis

### Small Vendor Segment (Both Markets)

**Malaysia: Pasar malam, gerai tepi jalan, small kedai**

- Solo operators or husband-wife teams (1-2 people)
- Single stall, possibly rotating across multiple night market locations
- 10-100 SKUs (nasi lemak variations, kuih, drinks, etc.)
- Cash + e-wallet (Touch 'n Go, GrabPay, DuitNow QR)
- Budget: RM 35/mo

**Indonesia: Warung, kaki lima, toko kecil, pedagang pasar**

- Same solo/family profile
- Single location or rotating (pasar malam, car free day)
- 10-100 SKUs (nasi goreng, gorengan, minuman, etc.)
- Cash + QRIS/GoPay/OVO/Dana
- Budget: Rp 100k/mo

### What They Need vs What They Don't

**Need:**

1. Quick sales recording — tap item, collect cash/e-wallet, done
2. Daily sales summary — "How much did I make today?" + payment method breakdown + top items
3. Simple item catalog — list of items with prices, categories
4. Basic stock counting — "I have 50 nasi lemak left" (optional)

**Don't need (upgrade triggers):**

- Procurement cycle, warehouse management, push notifications, RBAC, loyalty, multi-user, supplier management, credit sales/hutang, customer management, PDF reporting, delivery management, quotations

### Market Comparison

| Dimension      | Basic/Pro (Indonesian SME)             | Lite (Small Vendors, Both Markets) |
| -------------- | -------------------------------------- | ---------------------------------- |
| Team size      | 3-15+                                  | 1-2                                |
| Outlets        | 1-5+                                   | 1 stall (rotating locations)       |
| SKU count      | 50-500+                                | 10-50                              |
| Monthly budget | Rp 300k-600k+                          | Rp 100k / RM 35 max                |
| Hardware       | Phone + tablet + printer               | Phone only                         |
| Tech literacy  | Moderate                               | Low                                |
| Key metric     | Profitability per item                 | "How much did I make today?"       |
| Churn risk     | Moderate (sticky if using procurement) | High (will abandon if confusing)   |

---

## 3. Feature Matrix

### Included in Lite

| Feature                  | Details                                                                           |
| ------------------------ | --------------------------------------------------------------------------------- |
| Sales recording          | Unlimited transactions, tap item → select payment → done                          |
| Item catalog             | Max 50 items, name + price + category + optional photo                            |
| Categories               | Basic organization for items                                                      |
| Daily sales summary      | Total + payment method breakdown + top items sold                                 |
| Stock balance            | Simplified: single `quantity` field per item (no FIFO, no onHand/available split) |
| Stock adjustment         | Set / add / subtract quantity only                                                |
| Multiple payment methods | Cash + e-wallet/QRIS                                                              |
| Offline-first            | Works without internet after initial login                                        |
| Sessions                 | Simplified local "start day / end day" only                                       |

### Excluded from Lite (with Upgrade Triggers)

| Feature                        | Trigger to Basic                          |
| ------------------------------ | ----------------------------------------- |
| Customer management            | "I want to track my regulars"             |
| Credit sales / hutang          | "My customer wants to pay later"          |
| More than 50 items             | "I sell more products now"                |
| Second user                    | "I hired a helper"                        |
| Procurement (QT/PO/DO/Invoice) | "I need to track supplier orders"         |
| PDF reports                    | "I need formal reports"                   |
| Supplier management            | "I want to track who I buy from"          |
| Stock movement history         | Audit trail is Basic+                     |
| FIFO costing / stock receipt   | Cost tracking is Basic+                   |
| Item variants                  | 50-item stall doesn't need SKU variations |
| RBAC / roles                   | Solo operator                             |
| Loyalty program                | Too complex                               |
| Push notifications             | Not needed                                |
| Warehouse management           | Not needed                                |
| Menu/FnB features              | Restaurant-specific                       |
| Promotions / campaigns         | Too complex                               |
| Split bills                    | Single-payment only                       |
| Settings sync                  | Local settings only                       |
| Receipt printing               | Most won't have printer                   |
| Override logs                  | Single user, no manager approvals         |

### Stock Module Comparison

| Stock Module         | Basic/Pro (Cloud)                                                                                                | Lite (Local Realm DB)                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Stock Balance        | Full: `availableQuantity`, `onHandQuantity`, `reorderThreshold`, variant support, delta sync, optimistic locking | Simplified: single `quantity` field per item |
| Stock Adjustment     | Full: `adjustQuantity`, `overrideQuantity`, cost tracking, variant validation, version conflict detection        | Simplified: set/add/subtract only            |
| Stock Movement       | Full audit trail: previous/current quantities, delta, movement type, document reference                          | NOT included                                 |
| Stock Receipt (FIFO) | FIFO batch tracking: receipt date, cost per batch                                                                | NOT included                                 |
| Warehouse Stock      | Parallel tables for warehouse-level tracking                                                                     | NOT included                                 |

---

## 4. Architecture — Local-First Model

### Data Architecture

```
Basic/Pro (current):   Global DB (account) + Tenant DB (POS data) + Cloud sync
Lite (proposed):       Global DB (account only) + Local Realm DB (POS data) + No sync
```

**Lite users in Global DB only:**

- `Tenant` record (account info, `databaseName: null`)
- `TenantSubscription` (subscription status, payment tracking)
- `TenantOutlet` (single outlet)
- `TenantUser` (auth — username, hashed password)
- NO tenant database created
- NO cloud sync

**POS data lives on phone (Realm DB):**

- Items (max 50), categories, sales transactions, session summaries, payment breakdowns, stock counts

### JWT for Lite Users

```json
{
  "user": {
    "tenantUserId": 123,
    "userId": 0,
    "username": "ahmad",
    "databaseName": null,
    "tenantId": 45,
    "role": "Super Admin",
    "planName": "Lite",
    "loyaltyTier": "none",
    "notificationTopics": []
  }
}
```

### Cost Structure

```
Basic/Pro user:  Tenant DB hosting + sync load + auth = ~$2-5/mo server cost
Lite user:       Auth-only global DB query = ~$0.01/mo server cost
```

### Localization

| Aspect     | Indonesia              | Malaysia                      |
| ---------- | ---------------------- | ----------------------------- |
| Currency   | IDR (Rp)               | MYR (RM)                      |
| Language   | Bahasa Indonesia       | Bahasa Melayu                 |
| E-wallet   | QRIS, GoPay, OVO, Dana | Touch 'n Go, GrabPay, DuitNow |
| Lite price | Rp 100,000/mo          | RM 35/mo                      |

Since Lite data is local, currency and payment method names are configured in the app, not the server.

---

## 5. Server-Side Implementation

### 5.1 Add Lite Subscription Plan Seed

**File:** `src/script/subscription_plan_seed.ts`

Add to the `subscriptionPlans` array:

```typescript
{
    planName: "Lite",
    planType: "Retail",
    price: 100000,
    maxTransactions: null,  // unlimited
    maxProducts: 50,
    maxUsers: 1,
    maxDevices: 0,
    description: "Lite plan for small vendors — local data only, no tenant database"
}
```

**Run:** `npm run seed_subscription_plans`

---

### 5.2 Modify Auth — Handle Lite Users Without Tenant DB

**Files:**

- `src/auth/auth.service.ts` — `authenticate()`, `refreshToken()`, `generateJwtToken()`
- `src/middleware/authorize-middleware.ts` — `UserInfo` interface

#### 5.2.1 Update `UserInfo` interface

**File:** `src/middleware/authorize-middleware.ts`

```typescript
export interface UserInfo {
  tenantUserId: number;
  userId: number; // 0 for Lite (no tenant DB user)
  username: string;
  databaseName: string | null; // null for Lite plan
  tenantId: number;
  role: string;
  notificationTopics?: string[];
  planName?: string | null;
  loyaltyTier?: "none" | "basic" | "advanced";
}
```

#### 5.2.2 Update `authenticate()` function

**File:** `src/auth/auth.service.ts`

Use the existing `avjiang` bypass pattern (lines 32-38) as a template. Insert after the avjiang check:

```typescript
if (tenantUser.username === "avjiang") {
  // existing bypass...
} else if (!tenantUser.tenant?.databaseName) {
  // LITE USER — no tenant DB, bypass tenant lookup
  customerUser = {
    id: 0,
    username: tenantUser.username,
  } as User;
} else {
  // NORMAL FLOW — query tenant DB
  const tenantPrisma = getTenantPrisma(tenantUser.tenant.databaseName);
  customerUser = await tenantPrisma.user.findFirst({
    where: { username: tenantUser.username },
  });
  // ...existing code...
}
```

#### 5.2.3 Update `generateJwtToken()` function

**File:** `src/auth/auth.service.ts`

Skip notification topics for Lite (no tenant DB to query):

```typescript
// Skip notification topics for Lite (no tenant DB to query)
if (tenantUser.username !== "avjiang" && db) {
  // ...existing subscription + notification logic...
}
// For Lite: planName comes from subscription, loyaltyTier = 'none', topics = []
```

#### 5.2.4 Update `refreshToken()` function

**File:** `src/auth/auth.service.ts`

Same Lite bypass pattern — skip tenant DB lookup when `databaseName` is null.

#### 5.2.5 Add defensive guard in `getTenantPrisma()`

**File:** `src/db.ts`

```typescript
export function getTenantPrisma(tenantDbName: string): TenantPrismaClient {
  if (!tenantDbName || tenantDbName.trim() === "") {
    throw new Error("Tenant database name is required and cannot be empty");
  }
  // ...existing code...
}
```

This prevents silent failures if any code accidentally passes empty string for Lite users.

---

### 5.3 Modify Signup Flow — Skip Tenant DB for Lite

**File:** `src/admin/admin.service.ts` (`createTenant` function)

When `planName === 'Lite'`:

- Create `Tenant` in global DB (with `databaseName: null`)
- Create `TenantOutlet` in global DB
- Create `TenantSubscription` in global DB (with 7-day trial: `validUntil = now + 7 days`)
- Create `TenantUser` in global DB (for auth — username, hashed password)
- **SKIP** `initializeTenantDatabase()` — no tenant DB
- **SKIP** creating tenant-DB Outlet, default roles/permissions, default user in tenant DB

Key changes in the function:

```typescript
// Line ~89: Conditional database name generation
const databaseName =
  subscriptionPlan.planName === "Lite"
    ? null
    : `${tenant.tenantName.toLowerCase().replace(/\s/g, "_")}_db`;

// Line ~120: Conditional trial period
const trialDays = subscriptionPlan.planName === "Lite" ? 7 : 30;
const nextPaymentDate = new Date(now);
nextPaymentDate.setDate(now.getDate() + trialDays);

// Line ~144: Conditional tenant DB initialization
if (databaseName) {
  await initializeTenantDatabase(databaseName);
  const tenantPrisma = getTenantPrisma(databaseName);
  // ...create user, roles, outlet in tenant DB...
}
// else: skip all tenant DB operations for Lite
```

---

### 5.4 Add Plan-Gate Middleware

**File:** `src/middleware/plan-gate.middleware.ts` (NEW FILE)

```typescript
import { AuthenticationError } from "../api-helpers/error";

export function requireCloudPlan() {
  return (req: any, res: any, next: any) => {
    if (!req.user?.databaseName) {
      throw new AuthenticationError(
        403,
        "This feature requires Basic or Pro plan",
      );
    }
    next();
  };
}
```

**File:** `src/index.ts` — Apply to all tenant-DB-dependent routes:

```typescript
import { requireCloudPlan } from "./middleware/plan-gate.middleware";

// Routes BEFORE plan-gate (accessible by Lite users)
app.use("/auth", require("./auth/auth.controller")); // Public (no auth)
app.use(authorizeMiddleware); // JWT required below
app.use("/admin", require("./admin/admin.controller")); // Admin only — Lite OK
app.use("/account", require("./account/account.controller")); // Lite OK (global DB only)

// All routes below require a tenant DB (Basic/Pro only)
// Lite users (databaseName=null) get 403 on any of these
app.use(requireCloudPlan());

// --- Tenant-DB-dependent routes (22 total) ---
app.use("/user", require("./user/user.controller"));
app.use("/item", require("./item/item.controller"));
app.use("/category", require("./category/category.controller"));
app.use("/supplier", require("./supplier/supplier.controller"));
app.use("/customer", require("./customer/customer.controller"));
app.use("/sales", require("./sales/sales.controller"));
app.use("/stock", require("./stock/stock-balance/stock-balance.controller"));
app.use(
  "/stockMovement",
  require("./stock/stock-movement/stock-movement.controller"),
);
app.use(
  "/stockReceipt",
  require("./stock/stock-receipt/stock-receipt.controller"),
);
app.use("/session", require("./session/session.controller"));
app.use("/menu", require("./menu/menu.controller")); // No tenant DB, but excluded from Lite
app.use("/report", require("./report/report.controller"));
app.use("/role", require("./role/role.controller"));
app.use("/permission", require("./permission/permission.controller")); // Global DB, but excluded from Lite
app.use("/outlet", require("./outlet/outlet.controller"));
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
app.use("/quotation", require("./quotation/quotation.controller"));
app.use("/pushy", require("./pushy/device.controller"));
app.use("/settings", require("./settings/settings.controller"));
app.use("/warehouses", require("./warehouse/warehouse.controller"));
app.use(
  "/purchaseReturn",
  require("./purchase_return/purchase-return.controller"),
);
app.use("/loyalty", require("./loyalty/loyalty.controller"));
app.use(
  "/subscription",
  require("./subscription-package/subscription-package.controller"),
);
```

**Summary:** Lite users can only hit: `/auth/*`, `/admin/*` (if admin role), `/account/*`. All other endpoints return 403.

**Note:** `/permission` and `/menu` technically use global DB only, but are blocked for Lite users anyway (deny-by-default — Lite users have no need for these endpoints).

---

### 5.5 Critical Files for Server Implementation

| File                                     | Changes                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| `src/auth/auth.service.ts`               | Lite bypass in `authenticate()`, `refreshToken()`, `generateJwtToken()` |
| `src/middleware/authorize-middleware.ts` | `UserInfo.databaseName: string \| null`                                 |
| `src/middleware/plan-gate.middleware.ts` | New file — `requireCloudPlan()` middleware                              |
| `src/admin/admin.service.ts`             | Conditional skip of `initializeTenantDatabase()` for Lite; 7-day trial  |
| `src/db.ts`                              | Add empty-string guard in `getTenantPrisma()`                           |
| `src/index.ts`                           | Apply `requireCloudPlan()` to all 22 tenant-DB route groups             |
| `src/script/subscription_plan_seed.ts`   | Add Lite plan seed data                                                 |
| `SUBSCRIPTION_MODEL.md`                  | Update with Lite plan documentation                                     |

### 5.6 Commands to Run After Implementation

```bash
npm run seed_subscription_plans   # Seed the new Lite plan
npm run build                     # Verify TypeScript compilation
npm run dev                       # Start dev server and test
```

---

## 6. Flutter App Implementation

### 6.1 Local Realm DB Database Layer

**New local database with tables:**

| Table             | Fields                                                                          | Notes                                 |
| ----------------- | ------------------------------------------------------------------------------- | ------------------------------------- |
| `items`           | id, name, price, categoryId, quantity, imageUrl, isActive, createdAt, updatedAt | Max 50 rows enforced                  |
| `categories`      | id, name, createdAt, updatedAt                                                  |                                       |
| `sales`           | id, totalAmount, paymentMethod, itemCount, note, createdAt                      |                                       |
| `sale_items`      | id, saleId, itemId, itemName, quantity, unitPrice, subtotal                     | Store itemName for history resilience |
| `daily_summaries` | id, date, totalSales, totalTransactions, cashTotal, ewalletTotal, topItemsJson  | Pre-computed daily cache              |

**Key design decisions:**

- No variant support in Lite
- `sale_items` stores `itemName` directly (not just FK) so history survives item deletion
- `daily_summaries` is a denormalized cache — rebuilt from `sales` if needed
- No `stock_movement`, `stock_receipt`, `customers`, `suppliers`, etc.

### 6.2 Feature Gating by Plan

Check `planName` from JWT:

- `planName === 'Lite'`: Show simplified UI, use local Realm DB, hide cloud features
- `planName === 'Basic' || 'Pro'`: Show full UI, use cloud sync (existing behavior)

**Gated features (hidden for Lite):**

- Bottom nav: hide Procurement, Suppliers, Customers, Warehouse, Loyalty, Roles
- Sales screen: hide customer selection, credit/hutang option, delivery option
- Item screen: show "50/50 items" counter, hide variant management
- Reports: hide PDF export, show simplified daily summary only
- Settings: hide receipt printer config, show "Export My Data" button

### 6.3 Offline-First Architecture

- All Lite operations read/write local Realm DB only
- No API calls for POS operations (sales, items, stock)
- Only API calls: auth (login/refresh), subscription check (periodic)
- App works fully offline after initial login
- Periodic subscription validation (check every 24h when online)
- JWT expiry handling: if expired but subscription valid locally → continue; queue refresh for when internet returns
- Soft lock after 7 days offline AND subscription expired (can view data, can't create sales)

### 6.4 Export My Data Feature

- Settings → "Export My Data" button (Lite only)
- Generates 3 JSON files:
  - `categories.json`: all categories
  - `items.json`: all items with current stock quantities
  - `sales.json`: last 30 days of sales with line items
- Uses platform share sheet → user sends via WhatsApp to admin
- References use names (not IDs) for cross-DB compatibility

### 6.5 Item Limit Enforcement

- Hard cap at 50 items
- Show counter: "12/50 items" in item list header
- When at 50: disable "Add Item" button, show upgrade prompt

---

## 7. Upgrade Path: Lite to Basic

### Method: Create New Tenant (Not Plan Change)

The existing `changeTenantPlan` function (`admin.service.ts:1447`) rejects null `databaseName`. Instead of modifying it, Lite→Basic upgrades create a **new tenant**:

### Migration Workflow

```
1. Vendor calls admin: "I want to upgrade to Basic"
2. Admin tells vendor: "Go to Settings → tap 'Export My Data'"
3. App generates 3 JSON files → vendor shares via WhatsApp to admin
4. Admin receives files on WhatsApp
5. Admin creates new Basic tenant via POST /admin/signup
   → Tenant DB is auto-created
6. Admin logs in as the new tenant user → gets JWT with correct databaseName
7. Admin imports each JSON in order:
   a. categories.json → POST /category/create (for each category)
   b. items.json → POST /item/create (map categoryName → new category ID)
   c. sales.json → DB insert script (or skip — start fresh)
8. Admin deactivates old Lite tenant subscription
9. Vendor logs in with new Basic credentials — data is there
```

### What Gets Migrated

- Categories (all)
- Items with stock counts (up to 50)
- Sales history (last 30 days only)

### What Does NOT Migrate

- Sales older than 30 days
- Session reports (regenerated from imported sales)

### JSON Format

References use names (not IDs) since IDs change in the new tenant DB:

- `items.json` → references `categoryName` (not categoryId)
- `sales.json` → references `itemName` (not itemId)
- `sale_items` stores `itemName` at time of sale (denormalized) → exported as-is

### Upgrade Triggers (Lite → Basic)

- Exceeds 50 items
- Needs customer tracking
- Needs hutang/credit sales
- Hires a helper (second user)
- Starts tracking suppliers
- Opens a permanent shop
- Wants PDF reports

---

## 8. Critical Issues & Solutions

### CRITICAL: Auth Flow Crashes for Lite Users

**Problem:** `auth.service.ts:39-46` calls `getTenantPrisma(databaseName)` to look up user in tenant DB. Lite users have no tenant DB → crash.

**Solution:** Use existing `avjiang` bypass pattern as template. See [Section 5.2.2](#522-update-authenticate-function).

### CRITICAL: UserInfo.databaseName Type Mismatch

**Problem:** `UserInfo.databaseName` is typed as `string` (not nullable). Lite JWT has `null`.

**Solution:** Change to `string | null`. See [Section 5.2.1](#521-update-userinfo-interface).

### CRITICAL: changeTenantPlan Rejects Null databaseName

**Problem:** `admin.service.ts:1447-1449` throws `NotFoundError` when `databaseName` is null.

**Solution:** Lite→Basic upgrade creates a new tenant, not plan change. See [Section 7](#7-upgrade-path-lite-to-basic).

### IMPORTANT: Import Endpoint Auth Context

**Problem:** `POST /item/create`, `POST /category/create` use `req.user.databaseName` from JWT. Admin can't write into another tenant's DB.

**Solution:** Admin logs in as the newly created Basic user, then calls existing endpoints. No new endpoint needed.

### IMPORTANT: JWT Expiry vs Offline Use

**Problem:** JWT expires in 1 day. Lite app works offline.

**Solution:** Flutter-side caching. App continues in local mode if JWT expired but subscription valid. Queue refresh for when internet returns. Soft lock after 7 days offline + expired subscription.

### IMPORTANT: Subscription Expiry Enforcement

**Problem:** Local-only means user could change phone date to bypass expiry.

**Solution:** Accept as business risk at RM 35/month. Server returns expiry date during login → stored locally. App checks on launch. Not worth over-engineering anti-tamper.

### MINOR: Trial Period

**Problem:** Existing plans get 30-day trial. Lite gets 7-day trial.

**Solution:** Conditional in signup: `subscriptionValidUntil = now + 7 days` for Lite (vs `now + 30 days` for others).

### MINOR: Export Data — Item Name Fragility

**Problem:** `sales.json` references items by name.

**Solution:** `sale_items` stores `itemName` at time of sale (denormalized). Import uses it purely for display — no re-linking needed.

---

## 9. UI Flow Suggestions for Frontend Team

### 9.1 Navigation Comparison: Lite vs Basic/Pro

| Nav Element  | Lite                       | Basic                                      | Pro                                     |
| ------------ | -------------------------- | ------------------------------------------ | --------------------------------------- |
| Bottom tabs  | 3 (Home, Items, More)      | 5+ (Home, Sales, Items, Procurement, More) | 5+ (same as Basic + Warehouse, Loyalty) |
| Dashboard    | Today's total + top items  | Session reports + profit                   | Full analytics                          |
| Sales screen | Item grid → payment → done | + Customer, discount, credit               | + Loyalty, tier discount                |
| Item screen  | Name, price, category, qty | + Cost, SKU, variants, supplier            | Same as Basic                           |
| Stock        | Simple qty adjust          | + Movement history, FIFO                   | + Warehouse stock                       |
| Settings     | Account, export, language  | + Tax, receipt, roles                      | + Notifications, warehouse config       |

### 9.2 Onboarding Flow (Admin-Initiated, Target: < 2 Minutes In-App)

**Admin side:**

1. Vendor contacts admin (WhatsApp/call)
2. Admin creates Lite account via admin panel (`POST /admin/signup`)
3. Admin gives vendor credentials (username + temporary password)

**Vendor side (in app):**

```
Welcome Screen → Log In → Welcome + Quick Item Add → Main Dashboard
```

- Login screen shows: "Don't have an account? Contact us on WhatsApp →"
- First-time setup: quick add items (name, price, category) → "Done - Start Selling!"
- Target: under 2 minutes from login to first sale

### 9.3 Main Dashboard (Lite)

```
┌──────────────────────────────┐
│  Good morning, Ahmad         │
│  Lite Plan  •  7 days left   │  ← Trial countdown
├──────────────────────────────┤
│  TODAY'S SALES               │
│  ┌────────────────────────┐  │
│  │      RM 847.00         │  │  ← Hero number
│  │   23 transactions      │  │
│  └────────────────────────┘  │
│  PAYMENT BREAKDOWN           │
│  Cash      RM 520.00         │
│  E-wallet  RM 327.00         │
│  TOP ITEMS TODAY             │
│  1. Nasi Lemak  x42  RM336   │
│  2. Teh Tarik   x31  RM155   │
│  3. Mee Goreng  x18  RM162   │
│        [+ NEW SALE]          │  ← FAB always visible
├──────────────────────────────┤
│  Home  │  Items  │  More     │  ← 3 tabs only
└──────────────────────────────┘
```

### 9.4 Sales Flow (Lite — Simplified)

```
Item Grid (with category filter chips)
  → Tap items to add to cart
  → View cart with quantities
  → Select payment: [Cash] [E-wallet]
  → [Complete Sale]
  → Sale Complete! [Share Receipt] [New Sale] [Back Home]
```

**Removed vs Basic/Pro:** No customer selection, no credit/hutang, no discount/loyalty, no delivery, no quotation/draft, no receipt print.

### 9.5 Item Management (Lite)

```
Items screen header: "Items  12/50"  ← counter/limit
Item list: name, price, category, stock quantity inline
Add Item form: name, price, category dropdown, stock qty (optional), photo (optional)
```

**Removed vs Basic/Pro:** No cost/purchase price, no SKU/barcode, no variants, no supplier link, no reorder threshold, no bulk create.

### 9.6 Stock Adjustment (Lite — Simplified)

```
Tap item → "Adjust Stock"
  → Toggle: [Set] [Add] [Remove]
  → Enter quantity
  → Optional reason
  → Preview: "After adjustment: 50"
  → [Confirm Adjustment]
```

**Removed vs Basic/Pro:** No variant selection, no cost field, no batch tracking, no "performed by", no version conflicts, no movement history.

### 9.7 Daily Summary Screen

```
Date navigator: [< 4 Mar]  5 Mar 2026  [>]
Total Sales: RM 1,247.00 (34 transactions)
By Payment Method: bar chart (Cash 65.8%, E-wallet 34.2%)
Top Items: 1-5 items with qty and total
Weekly/monthly running totals
[No PDF export in Lite. Upgrade to Basic →]  ← subtle nudge
```

### 9.8 "More" Tab / Settings

```
Account: name, plan, valid until
Sales History: daily summaries, recent sales
Data: Export My Data (Lite only)
[UPGRADE TO BASIC] ← prominent CTA
App: language, help, log out
```

### 9.9 Export My Data Flow

```
Export My Data screen:
  Shows what will be exported:
  - Categories (count)
  - Items & stock (count)
  - Sales - last 30 days (count)

  [Export & Share via WhatsApp]
  → Share sheet opens with 3 JSON files
  → User sends to admin contact
```

### 9.10 Upgrade Prompts (Contextual)

Appear naturally when hitting Lite limitations:

- **50/50 items reached:** "Upgrade to Basic for unlimited items, customers, hutang, reports & more"
- **Tapping hidden features:** "Customer tracking is a Basic plan feature"
- **Daily summary screen:** Subtle "No PDF export in Lite. Upgrade to Basic →"

---

## 10. Testing & Verification

### Server-Side

1. Seed Lite plan → verify it appears in subscription plan list
2. Signup as Lite → verify tenant created in global DB, NO tenant DB created, `databaseName: null`
3. Login as Lite → verify JWT has `planName: 'Lite'`, `databaseName: null`, `userId: 0`
4. Hit tenant-DB endpoints as Lite → verify 403 rejection from plan-gate middleware
5. Hit `/auth/*`, `/admin/*`, `/account/*` as Lite → verify they work
6. Upgrade Lite → Basic → create new tenant, verify data importable via existing endpoints
7. Verify existing Basic/Pro users are not affected (regression check)

### Flutter App

1. Login as Lite → verify simplified UI renders (3 tabs, no procurement)
2. Add items → verify 50 item limit enforced, counter shows correctly
3. Record sales → verify local Realm DB persistence
4. View daily summary → verify totals, payment breakdown, top items correct
5. Close app, reopen → verify data persists
6. Go offline → verify all POS operations still work
7. Export My Data → verify 3 JSONs generated, shareable via WhatsApp
8. Login as Basic → verify full UI renders, cloud sync works (no regression)

---

## 11. Decision Log

| Decision             | Choice                             | Rationale                                                  |
| -------------------- | ---------------------------------- | ---------------------------------------------------------- |
| Price                | Rp 100k / RM 35 per month          | Affordable for micro-vendors, clear gap from Basic (RM 88) |
| Trial                | 7-day free trial                   | Reduce friction for low-tech users                         |
| Markets              | Indonesia + Malaysia               | Same product, same tier                                    |
| Data model           | Fully local Realm DB               | Near-zero server cost                                      |
| Server role          | Auth + subscription only           | No tenant DB created                                       |
| Users                | 1                                  | Solo operator                                              |
| Items                | 50 max                             | Upgrade trigger                                            |
| Customers            | No                                 | Upgrade trigger                                            |
| Credit/hutang        | No                                 | Upgrade trigger                                            |
| Stock balance        | Yes (simplified qty only)          | Basic counting                                             |
| Stock adjustment     | Yes (set/add/subtract)             | Simple ops                                                 |
| Stock movement       | No                                 | Audit trail is Basic+                                      |
| FIFO costing         | No                                 | Cost tracking is Basic+                                    |
| Reporting            | Daily summary (no PDF)             | "How much did I make?"                                     |
| Sessions             | Simplified local (start/end day)   | No formal declarations                                     |
| Menu/FnB             | No                                 | Restaurant-specific                                        |
| Promotions           | No                                 | Too complex                                                |
| Split bills          | No                                 | Single-payment only                                        |
| Item variants        | No                                 | 50-item stall doesn't need SKU variants                    |
| Settings             | Local only                         | Tax/currency stored on device                              |
| Upgrade migration    | Semi-manual via WhatsApp           | 3 JSONs, admin imports                                     |
| Upgrade method       | Create new Basic tenant            | Not plan-change on existing Lite tenant                    |
| Sales data migration | Last 30 days only                  | Limits payload size                                        |
| Migration references | Denormalized names in sale_items   | No re-linking needed                                       |
| Signup               | Admin-initiated                    | Same as current model, no public self-service              |
| Auth for Lite        | Bypass tenant DB (avjiang pattern) | userId=0, databaseName=null                                |
| Route protection     | Plan-gate middleware               | Lite users get 403 on 22 tenant-DB routes                  |
| Trial period         | 7 days (vs 30 for others)          | Lower commitment tier                                      |

### Revenue Model

- **Unit economics:** Need ~500+ Lite subscribers to match revenue of ~100 Basic subscribers
- **Cost per Lite user:** Near zero (~$0.01/mo — auth-only global DB query)
- **Margin:** Very high (almost pure revenue since no DB/sync cost)
- **Strategy:** Near-zero-cost, high-margin volume play that doubles as a funnel to Basic

### Risk Assessment

| Risk                        | Mitigation                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------- |
| Lite cannibalizes Basic/Pro | Feature gap is massive: no customers, no hutang, no procurement, no RBAC, 50 item limit |
| High churn from Lite        | Keep onboarding <2 min; daily summary is the killer feature; works offline              |
| Support cost per Lite user  | Self-serve only; no add-on complexity; in-app help                                      |
| Phone lost = data lost      | Accepted risk at this price point; consider optional Google Drive backup in future      |
| Upgrade path complexity     | One-time JSON migration; data volume is small (50 items)                                |
