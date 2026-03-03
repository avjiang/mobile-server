# Loyalty & Membership Program — Product Overview

> Concise overview for the product team. For full technical implementation details, see [loyalty-implementation-plan.md](loyalty-implementation-plan.md).

---

## What We're Building

A loyalty and membership system integrated directly into the POS checkout flow. Customers earn points on purchases, redeem points for discounts, get automatic tier upgrades based on spending, and can subscribe to service packages (e.g., laundry bundles, F&B meal plans).

Works across **Retail, F&B, and Laundry** — business-type agnostic.

---

## Pricing & Packaging

| Plan | Loyalty Access | Monthly Cost |
|---|---|---|
| Trial / Basic | None | — |
| Pro | **Basic Loyalty** (included) | Rp 0 (bundled in Pro) |
| Pro + Add-on | **Advanced Loyalty** | Rp 150,000 / tenant / month |

### Basic Loyalty (Pro plan — free)
- Points earn & redeem
- Point history & balance
- Manual point adjustments
- Automatic point expiry (FIFO)

### Advanced Loyalty (paid add-on)
Everything in Basic, plus:
- **Membership tiers** — automatic upgrade based on cumulative spend
- **Tier discounts** — percentage discount per tier (e.g., Silver 3%, Gold 5%, Platinum 10%)
- **Point multipliers** — higher tiers earn more points per transaction
- **Subscription packages** — usage-based or time-based bundles linked to product categories

---

## How Points Work

### Earning
- Customer earns points based on the **final paid amount** (after all discounts)
- Configurable rate: e.g., 1 point per Rp 10,000 spent
- Advanced: tier multipliers increase earn rate (e.g., Gold members earn 1.5x)
- Points are only awarded when the sale is **fully paid** (partially paid / credit sales earn points when completed)

### Redeeming
- Points are redeemed at checkout as a cash discount
- Configurable rate: e.g., 1 point = Rp 1,000
- Minimum redemption threshold supported (e.g., min 10 points)
- FIFO expiry: oldest points are used first

### Expiry
- Each batch of earned points has its own expiry date
- Configurable: e.g., points expire 365 days after earning
- Daily background job automatically expires old points
- Points restored from void/return/refund **do not expire**

---

## Membership Tiers (Advanced Only)

Automatic tiering based on configurable spending window (all-time cumulative or rolling period, e.g., 365 days):

| Example Tier | Min. Spend | Discount | Point Multiplier |
|---|---|---|---|
| Member | Rp 0 | 0% | 1.0x |
| Silver | Rp 1,000,000 | 3% | 1.2x |
| Gold | Rp 5,000,000 | 5% | 1.5x |
| Platinum | Rp 15,000,000 | 10% | 2.0x |

- Tiers and thresholds are fully configurable per tenant
- Auto-upgrade happens immediately after each qualifying purchase
- Auto-downgrade via monthly evaluation (if period-based tier evaluation is configured)
- Manual tier assignment supported (e.g., VIP override) — manual tiers skip auto-evaluation

---

## Subscription Packages (Advanced Only)

Two types of subscription packages:

### Usage-Based
Customer buys a bundle with a fixed quota.

> Example: "Laundry Wash & Fold — 10 kg package for Rp 150,000"
> Customer uses quota at each visit until depleted.

### Time-Based
Customer buys a subscription with a time window and gets a discount.

> Example: "Monthly Coffee Club — Rp 200,000/month for 15% off all beverages"
> Customer gets the discount on qualifying purchases for 30 days.

**Category linking**: Packages are linked to specific product categories. A laundry package only works on laundry items, a coffee package only works on beverages.

---

## Checkout Flow (What the Cashier Sees)

```
1. Cashier selects customer
   → App shows: point balance, current tier, active subscriptions

2. Cashier rings up items
   → Normal item entry (unchanged)

3. Existing discounts applied (if any)
   → Item-level discounts, sales-level manual discounts
   → Service charge, tax, rounding

4. Loyalty discounts applied (if eligible)
   → Tier discount % applied automatically
   → Customer chooses to redeem points (partial or full)
   → Subscription package applied (if applicable)

5. Payment
   → Customer pays the final amount
   → Points earned on final amount (displayed to cashier)

6. Receipt
   → Shows: points earned, points redeemed, new balance, tier status
```

---

## Discount Stacking Order

```
Item-level discounts (per item)
    ↓
Promotion discounts (if any active promotions apply)
    ↓
Sales-level manual discount (% or fixed)
    ↓
Service charge + tax + rounding
    ↓
Tier discount % (Advanced only)
    ↓
Point redemption (cash value)
    ↓
= Final Amount (customer pays this)
    ↓
Points earned on Final Amount (whole points, rounded down)
```

Discounts are applied sequentially, not simultaneously.
Promotions and loyalty are independent — a promotion marked "exclusive" only blocks other promotions, not loyalty discounts.

---

## Void / Return / Refund Handling

When a sale with loyalty is voided, returned, or refunded:

1. **Earned points** are reversed (deducted from customer balance)
2. **Redeemed points** are restored to customer balance (without expiry)
3. **Subscription quota** is restored (if a package was used)

All reversals are idempotent — processing the same reversal twice has no effect.

---

## Server Validation

The server validates all loyalty operations at checkout:
- Tier discount matches customer's actual tier
- Point balance is sufficient for redemption
- Subscription has remaining quota
- Subscription category matches sale items

If any validation fails, the entire sale is rejected with a clear error message. This protects against client-side manipulation.

---

## Performance Impact

| Tenant Plan | Extra Queries per Sale | Impact |
|---|---|---|
| Trial / Basic | 0 | Zero — completely skipped |
| Pro (basic loyalty) | +3 | Minimal |
| Pro + add-on (advanced) | +4–6 | Moderate |

Loyalty logic is gated at the JWT level. Tenants without loyalty enabled have **zero performance overhead** — the loyalty code path is never entered.

---

## Scope & Limitations (V1)

| Feature | Status |
|---|---|
| Multi-outlet points | Supported (tenant-wide) |
| Split bill loyalty | Not in V1 (primary customer only) |
| Birthday rewards | Not in V1 |
| Referral program | Not in V1 |
| Stamp cards | Not in V1 |
| Auto-downgrade tiers | Supported (monthly evaluation, period-based) |
| Subscription auto-renewal | Not in V1 (manual re-subscribe) |

---

## Business Impact

### For Tenants (Our Customers)
- **Basic loyalty free in Pro** — encourages upgrade from Basic to Pro plan
- **Advanced loyalty as add-on** — incremental revenue at Rp 150,000/tenant/month
- **Growth bundle opportunity** — Pro + WhatsApp + Loyalty package

### For End Consumers (Tenant's Customers)
- Points create purchase incentives and repeat visits
- Tier discounts reward high-value customers
- Subscription packages provide value and lock-in

### Competitive Positioning
Indonesian competitors (Moka, Majoo, iSeller) all include basic loyalty in their premium plans. Our approach matches this while offering advanced features as a premium add-on — competitive on basic, premium on advanced.
