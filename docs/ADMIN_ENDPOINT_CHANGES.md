# Admin Endpoint Changes — Add-On Architecture Refactor

This document summarizes all breaking changes to admin-facing API responses resulting from the Add-On Architecture Refactor (Phase 0) and the Loyalty feature addition.

---

## Summary of Changes

1. **Add-ons moved from per-outlet to per-tenant** — `TenantAddOn` replaces `TenantSubscriptionAddOn`
2. **Cost responses restructured** — add-ons at tenant level, not per-outlet
3. **Discounts only apply to plan costs** — add-ons are not discountable
4. **Outlet details includes tenant add-ons** — `addOns` array and `totalMonthlyCost` added to `GET /account/outlet/:id`
5. **Custom pricing support** — `isCustomPrice`, `standardPlanPrice`, `customPriceNote` added to all cost endpoints
6. **New `loyaltyTier` in JWT** — affects login/refresh responses
7. **New permission categories** — Loyalty permissions added
8. **Advanced Loyalty add-on management** — `POST/DELETE /admin/tenants/:tenantId/addons/loyalty`

---

## 1. GET `/admin/tenant/:id/cost` — TenantCostResponse

### Before (Old Structure)

```json
{
  "tenantId": 1,
  "tenantName": "Salon ABC",
  "outletCount": 2,
  "outlets": [
    {
      "outletId": 1,
      "outletName": "Main Outlet",
      "subscription": {
        "planName": "Pro",
        "basePlanCost": 450000,
        "addOns": [
          { "name": "Extra Device", "quantity": 2, "pricePerUnit": 20000, "totalCost": 40000 },
          { "name": "Extra Warehouse", "quantity": 1, "pricePerUnit": 150000, "totalCost": 150000 }
        ],
        "discounts": [...],
        "totalCost": 580000,
        "totalCostBeforeDiscount": 640000,
        "totalDiscount": 60000,
        "status": "Active"
      }
    }
  ],
  "totalMonthlyCost": 580000,
  "totalCostBeforeDiscount": 640000,
  "totalDiscount": 60000
}
```

### After (New Structure)

```json
{
  "tenantId": 1,
  "tenantName": "Salon ABC",
  "outletCount": 2,
  "tenantAddOns": [
    {
      "name": "Extra Device",
      "quantity": 2,
      "pricePerUnit": 20000,
      "totalCost": 40000
    },
    {
      "name": "Extra Warehouse",
      "quantity": 1,
      "pricePerUnit": 150000,
      "totalCost": 150000
    },
    {
      "name": "Advanced Loyalty",
      "quantity": 1,
      "pricePerUnit": 150000,
      "totalCost": 150000
    }
  ],
  "totalAddOnCost": 340000,
  "outlets": [
    {
      "outletId": 1,
      "outletName": "Main Outlet",
      "subscription": {
        "planName": "Pro",
        "basePlanCost": 450000,
        "isCustomPrice": false,
        "standardPlanPrice": 450000,
        "customPriceNote": "",
        "discounts": [
          {
            "name": "Early Bird",
            "type": "percentage",
            "value": 10,
            "amount": 45000
          }
        ],
        "totalCost": 405000,
        "totalCostBeforeDiscount": 450000,
        "totalDiscount": 45000,
        "status": "Active",
        "subscriptionValidUntil": "2026-04-01T00:00:00.000Z"
      }
    }
  ],
  "totalMonthlyCost": 745000,
  "totalCostBeforeDiscount": 790000,
  "totalDiscount": 45000
}
```

### Key Differences

| Change              | Before                                     | After                                                         |
| ------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| Add-ons location    | Inside each `outlet.subscription.addOns`   | Top-level `tenantAddOns` array                                |
| `totalAddOnCost`    | Not present                                | New field at top level                                        |
| Per-outlet `addOns` | Present                                    | Removed                                                       |
| Discount scope      | Applied to plan + add-ons                  | Applied to plan costs only                                    |
| Custom pricing      | Not present                                | `isCustomPrice`, `standardPlanPrice`, `customPriceNote` added |
| `totalMonthlyCost`  | Plan + add-ons per outlet (with discounts) | Sum of all outlet plans + tenant add-ons                      |

---

## 2. GET `/admin/tenants/cost` — AllTenantCost (SQL-based)

Same structural changes as above but for all tenants. The SQL was rewritten to:

- Replace 8 `TENANT_SUBSCRIPTION_ADD_ON` subqueries with 2 `tenant_add_on` subqueries
- Use `COALESCE(ts.CUSTOM_PRICE, sp.PRICE)` for custom pricing support
- Apply discounts only to plan costs, not add-ons

Response array items follow the same `TenantCostResponse` shape as endpoint #1.

---

## 3. GET `/admin/tenant/:id/billing-summary` — TenantBillingSummaryResponse

### Before

```json
{
  "tenantId": 1,
  "tenantName": "Salon ABC",
  "totalMonthlyCost": 580000,
  "outlets": [
    {
      "outletId": 1,
      "outletName": "Main Outlet",
      "planName": "Pro",
      "basePlanCost": 450000,
      "addOns": [...],
      "outletTotalCost": 580000
    }
  ]
}
```

### After

```json
{
  "tenantId": 1,
  "tenantName": "Salon ABC",
  "totalMonthlyCost": 745000,
  "tenantAddOns": [
    {
      "name": "Extra Device",
      "quantity": 2,
      "pricePerUnit": 20000,
      "totalCost": 40000
    },
    {
      "name": "Advanced Loyalty",
      "quantity": 1,
      "pricePerUnit": 150000,
      "totalCost": 150000
    }
  ],
  "totalAddOnCost": 190000,
  "outlets": [
    {
      "outletId": 1,
      "outletName": "Main Outlet",
      "planName": "Pro",
      "basePlanCost": 450000,
      "isCustomPrice": false,
      "standardPlanPrice": 450000,
      "customPriceNote": "",
      "discounts": [{ "name": "Early Bird", "amount": 45000 }],
      "outletTotalCost": 405000,
      "subscriptionStatus": "Active",
      "subscriptionValidUntil": "2026-04-01T00:00:00.000Z",
      "graceEndDate": "2026-04-08T00:00:00.000Z",
      "daysUntilExpiry": 30
    }
  ]
}
```

---

## 4. GET `/account/outlet/:id` — OutletDetailsResponse

### Before

```json
{
  "outletId": 1,
  "outletName": "Main Outlet",
  "isActive": true,
  "subscription": {
    "planName": "Pro",
    "basePlanCost": 450000,
    "addOns": [...],
    "discounts": [...],
    "totalCost": 580000,
    "status": "Active"
  }
}
```

### After

```json
{
  "outletId": 1,
  "outletName": "Main Outlet",
  "isActive": true,
  "subscription": {
    "planName": "Pro",
    "basePlanCost": 450000,
    "isCustomPrice": false,
    "standardPlanPrice": 450000,
    "discounts": [...],
    "totalCost": 405000,
    "totalCostBeforeDiscount": 450000,
    "totalDiscount": 45000,
    "status": "Active",
    "subscriptionValidUntil": "2026-04-01T00:00:00.000Z"
  },
  "addOns": [
    { "id": 2, "name": "Extra Device", "addOnType": "quantity", "pricePerUnit": 20000, "maxQuantity": 10, "scope": "tenant", "description": null, "currentQuantity": 2 },
    { "id": 4, "name": "Advanced Loyalty", "addOnType": "feature", "pricePerUnit": 150000, "maxQuantity": 1, "scope": "tenant", "description": null, "currentQuantity": 1 }
  ],
  "totalMonthlyCost": 595000
}
```

- `addOns` array moved from per-outlet subscription to top-level — now shows tenant-level add-ons with current quantities
- `totalMonthlyCost` added — sum of tenant add-on costs + outlet subscription cost (after discounts)

---

## 5. Cost Snapshot (Payment Records)

`buildCostSnapshot()` now takes `tenantAddOns` as a separate parameter. The `CostSnapshot` stored with each payment still includes add-ons (for historical audit), but they're sourced from the tenant-level `TenantAddOn` table, not the per-outlet subscription.

```json
{
  "planName": "Pro",
  "planId": 2,
  "basePlanCost": 450000,
  "isCustomPrice": false,
  "standardPlanPrice": 450000,
  "customPriceNote": "",
  "addOns": [
    {
      "addOnId": 2,
      "name": "Extra Device",
      "quantity": 2,
      "pricePerUnit": 20000,
      "totalCost": 40000
    },
    {
      "addOnId": 4,
      "name": "Advanced Loyalty",
      "quantity": 1,
      "pricePerUnit": 150000,
      "totalCost": 150000
    }
  ],
  "discounts": [
    {
      "discountId": 1,
      "name": "Early Bird",
      "type": "percentage",
      "value": 10,
      "amountOff": 45000
    }
  ],
  "totalBeforeDiscount": 640000,
  "totalDiscount": 45000,
  "totalAfterDiscount": 595000
}
```

---

## 6. Custom Pricing — New Fields Across All Cost Endpoints

Custom pricing allows the admin to override the standard plan price for a specific outlet's subscription.

### New Fields

| Field               | Type      | Description                                                                                       |
| ------------------- | --------- | ------------------------------------------------------------------------------------------------- |
| `isCustomPrice`     | `boolean` | `true` if a custom price override is active for this outlet                                       |
| `standardPlanPrice` | `number`  | The original plan price (e.g., 450000 for Pro)                                                    |
| `customPriceNote`   | `string`  | Admin note explaining why this outlet has a custom price (empty string if none)                   |
| `basePlanCost`      | `number`  | The effective price used for billing — equals `customPrice` if set, otherwise `standardPlanPrice` |

### How It Works

- When `isCustomPrice = false`: `basePlanCost === standardPlanPrice` (normal pricing)
- When `isCustomPrice = true`: `basePlanCost` reflects the custom override, and `standardPlanPrice` still shows the original plan price for reference

### Example — Outlet With Custom Price

```json
{
  "planName": "Pro",
  "basePlanCost": 300000,
  "isCustomPrice": true,
  "standardPlanPrice": 450000,
  "customPriceNote": "Early partner discount",
  "discounts": [],
  "totalCost": 300000,
  "totalCostBeforeDiscount": 300000,
  "totalDiscount": 0,
  "status": "Active"
}
```

### Affected Endpoints

| Endpoint                                | Where custom pricing fields appear                                      |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `GET /admin/tenant/:id/cost`            | `outlets[].subscription`                                                |
| `GET /admin/tenants/cost`               | SQL uses `COALESCE(ts.CUSTOM_PRICE, sp.PRICE)`                          |
| `GET /admin/tenant/:id/billing-summary` | `outlets[]`                                                             |
| `GET /account/outlet/:id`               | `subscription`                                                          |
| Cost Snapshot (payment records)         | `basePlanCost`, `isCustomPrice`, `standardPlanPrice`, `customPriceNote` |

### Admin API — Set/Clear Custom Price

`PUT /admin/tenant/:tenantId/outlet/:outletId/custom-price`

```json
// Set custom price
{ "customPrice": 300000, "customPriceNote": "Early partner discount" }

// Clear custom price (revert to standard)
{ "customPrice": null }
```

---

## 7. Login/Refresh Response — New Field

Both `/auth/login` and `/auth/refresh` now return:

```json
{
  "...existing fields...",
  "loyaltyTier": "basic"
}
```

Values: `"none"` | `"basic"` | `"advanced"`

---

## 8. New Permissions

Six new permissions added to the global `Permission` table under category "Loyalty":

| Permission Name               | Description                                |
| ----------------------------- | ------------------------------------------ |
| Manage Loyalty Program        | Create/edit loyalty program and tiers      |
| View Loyalty Accounts         | View customer loyalty balances and history |
| Adjust Loyalty Points         | Manual point add/remove                    |
| Manage Subscription Packages  | Create/edit/delete subscription packages   |
| View Customer Subscriptions   | View active customer subscriptions         |
| Manage Customer Subscriptions | Subscribe/cancel customers                 |

These are auto-granted to Super Admin (role ID 1). Other roles need explicit assignment via the role permissions UI.

---

## 9. Advanced Loyalty Add-On Management — New Endpoints

Two new endpoints for enabling/disabling the Advanced Loyalty add-on per tenant.

### 9.1 POST `/admin/tenants/:tenantId/addons/loyalty` — Add Advanced Loyalty

Enables the Advanced Loyalty add-on for a tenant. Requires the tenant to be on the Pro plan.

**Request:** No body required.

**Response (200):**

```json
{
  "success": true,
  "message": "Advanced Loyalty add-on enabled",
  "tenantId": 11,
  "addOnId": 4,
  "monthlyCost": 150000
}
```

**Errors:**

| Status | Condition | Message |
| ------ | --------- | ------- |
| 400 | Tenant is not on Pro plan | `Advanced Loyalty is only available on the Pro plan` |
| 400 | Add-on already exists | `Tenant already has the Advanced Loyalty add-on` |
| 404 | Tenant or subscription not found | `... not found` |

**Side Effect:** After adding the add-on, the tenant's next login/refresh will return `loyaltyTier: "advanced"` instead of `"basic"`.

### 9.2 DELETE `/admin/tenants/:tenantId/addons/loyalty` — Remove Advanced Loyalty

Removes the Advanced Loyalty add-on from a tenant.

**Request:** No body required.

**Response (200):**

```json
{
  "success": true,
  "message": "Advanced Loyalty add-on removed",
  "tenantId": 11
}
```

**Errors:**

| Status | Condition | Message |
| ------ | --------- | ------- |
| 404 | Add-on not found | `Advanced Loyalty add-on not found for this tenant not found.` |

**Side Effect:** After removal, the tenant's next login/refresh will return `loyaltyTier: "basic"` instead of `"advanced"`.

**Note:** The add-on is also automatically removed when a tenant is downgraded from Pro to Basic (via `PUT /admin/tenant/:tenantId/change-plan`).

---

## 10. New Add-On

New entry in global `SubscriptionAddOn` table:

| ID  | Name             | Type    | Price   | Scope  |
| --- | ---------------- | ------- | ------- | ------ |
| 4   | Advanced Loyalty | feature | 150,000 | tenant |

Managed via `TenantAddOn` table (same as Extra User, Extra Device, Extra Warehouse).

---

## Migration Checklist

1. Run `npx prisma migrate dev` for tenant DB (new loyalty tables + Sales fields)
2. Run `npx prisma generate` for both global and tenant clients
3. Run permission seed script (`src/script/permission_seed.ts`)
4. Manually add Advanced Loyalty add-on record to `SubscriptionAddOn` table (ID 4)
5. Admin dashboard: Update cost display components to read from `tenantAddOns` instead of per-outlet `addOns`
6. Admin dashboard: Handle `loyaltyTier` display if applicable
