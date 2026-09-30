# Subscription Plan Comparison

Prices are **per outlet per month**. Pay yearly and get **2 months free** (pay 10 months, use 12).
Every new shop starts with a **30-day free trial with all Pro features**, then picks a plan.
Source of truth for developers: `flutter-front-end/docs/modules/SUBSCRIPTION.md` (§2 and §10).

## Retail

|                                   |      **Lite**      |     **Basic**      |      **Pro**       |
| --------------------------------- | :----------------: | :----------------: | :----------------: |
| **Price / month**                 |   Rp 100,000       |   Rp 250,000       |   Rp 375,000       |
| **Price / year**                  |   Rp 1,000,000     |   Rp 2,500,000     |   Rp 3,750,000     |
| **Users included**                |   1 (no extra)     |   2                |   3                |
| **Items**                         |   up to 100        |   unlimited        |   unlimited        |
| Sales, receipts, multiple payment methods | ✓          |   ✓                |   ✓                |
| Stock count, adjustment, low-stock alert | ✓           |   ✓                |   ✓                |
| Daily close (session) report      |   ✓                |   ✓                |   ✓                |
| Works offline                     |   ✓                |   ✓                |   ✓                |
| Void a sale                       | within 24 hours    |   ✓                |   ✓                |
| Credit sales (kasbon), partial payment | -             |   ✓                |   ✓                |
| Delivery orders                   |   -                |   ✓                |   ✓                |
| Returns & refunds                 |   -                |   ✓                |   ✓                |
| Item variants                     |   -                |   ✓                |   ✓                |
| Purchasing (quotation, PO, DO, invoice, settlement, purchase return) | - | ✓ | ✓            |
| Stock history per item            |   ✓                |   ✓                |   ✓                |
| Suppliers, FIFO cost, stock movement report | -        |   ✓                |   ✓                |
| Customer list                     |   -                |   ✓                |   ✓                |
| Staff roles & permissions         |   -                |   ✓                |   ✓                |
| PDF reports                       |   -                |   ✓                |   ✓                |
| Sales history                     | last 30 days       |   all              |   all              |
| More than one supplier per item   |   -                |   -                |   ✓                |
| Online catalogue with photos      |   -                |   -                |   ✓                |
| Loyalty points                    |   -                |   -                |   ✓                |
| Membership tiers & prepaid packages |  -               |   -                |   add-on           |
| Push notifications                |   -                |   -                |   Every phone      |

## Laundry

|                                   |     **Basic**      |      **Pro**       |
| --------------------------------- | :----------------: | :----------------: |
| **Price / month**                 |   Rp 100,000       |   Rp 199,000       |
| **Price / year**                  |   Rp 1,000,000     |   Rp 1,990,000     |
| **Users included**                |   1                |   3                |
| Orders by kg, load or piece; QR claim and pickup | ✓   |   ✓                |
| Drop-off photos, pay on collection | ✓                 |   ✓                |
| Supplies deducted per order       |   ✓                |   ✓                |
| Reports incl. PDF                 |   ✓                |   ✓                |
| Staff roles & permissions         |   ✓                |   ✓                |
| Loyalty points                    |   -                |   ✓                |
| Membership tiers & prepaid packages ("10x cuci") | -   |   ✓ included       |
| Push notifications                |   -                |   Every phone      |

## Add-ons

| Add-on                                   | Price               | Available on |
| ---------------------------------------- | ------------------- | ------------ |
| Extra user                               | Rp 50,000 / month   | Basic, Pro (not Lite) |
| Advanced Loyalty (tiers + prepaid packages) | Rp 100,000 / month | Retail Pro (included in Laundry Pro) |

## Examples (per month)

| Shop                                         | Plan              | Total        |
| -------------------------------------------- | ----------------- | ------------ |
| Small kiosk, 60 products, owner only         | Retail Lite       | Rp 100,000   |
| Shop with kasbon, owner + 1 cashier          | Retail Basic      | Rp 250,000   |
| Laundry, owner + 1 staff                     | Laundry Basic + 1 user | Rp 150,000 |
| Laundry, 3 staff, selling prepaid packages   | Laundry Pro       | Rp 199,000   |
| Shop with online catalogue + 4 users         | Retail Pro + 1 user | Rp 425,000 |

## When a shop moves to a smaller plan

Nothing is deleted. The smaller plan blocks adding new things, never using what is there: prepaid packages customers already paid for stay redeemable, old sales stay stored, and items above a limit keep selling.
