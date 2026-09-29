// Unit tests for the sale-header profit definition (sales/sale-profit.ts).
// Regression for 2026-09-28: laundry sessions showed profit above revenue because
// PROFIT_AMOUNT ignored the cart discount and the loyalty chain. The figures below
// are the real nanggroe_wash (tenant 18) session-9 sales that exposed it.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "decimal.js";

import { netSaleProfit, saleLevelDeductions, SALE_LEVEL_DEDUCTIONS_SQL } from "../sale-profit";

describe("netSaleProfit", () => {
    test("no deductions → header profit is the line-profit sum", () => {
        // #42: Cuci 18,000 + detergent supply costing 1,500
        assert.equal(netSaleProfit(16_500, {}).toNumber(), 16_500);
    });

    test("wash fully covered by a prepaid package → revenue 0, profit = −cost", () => {
        // #36: 2 × Cuci Lipat 30,000, package discount 60,000, detergent cost 3,000
        const p = netSaleProfit(57_000, { subscriptionDiscountAmount: 60_000 });
        assert.equal(p.toNumber(), -3_000);
    });

    test("package + tier discount come off together", () => {
        // #41: 11 washes 330,000 → total 83,400; line profit 313,500, cost 16,500
        const p = netSaleProfit(313_500, {
            subscriptionDiscountAmount: 240_000,
            loyaltyTierDiscountAmount: 6_600,
        });
        assert.equal(p.toNumber(), 66_900); // = total 83,400 − cost 16,500
    });

    test("tier discount + point redemption", () => {
        // #39: 30,000 → total 24,400 (tier 600, redeemed 5,000); cost 1,500
        const p = netSaleProfit(28_500, {
            loyaltyTierDiscountAmount: 600,
            loyaltyPointsRedemptionValue: 5_000,
        });
        assert.equal(p.toNumber(), 22_900);
    });

    test("cart discount and voucher are deductions too (retail)", () => {
        const p = netSaleProfit(40_000, { discountAmount: 5_000, voucherDiscountAmount: 2_500 });
        assert.equal(p.toNumber(), 32_500);
    });

    test("null / undefined / Decimal / string inputs", () => {
        const d = saleLevelDeductions({
            discountAmount: null,
            loyaltyTierDiscountAmount: undefined,
            voucherDiscountAmount: new Decimal("1000.5"),
            subscriptionDiscountAmount: "2000",
            loyaltyPointsRedemptionValue: 0,
        });
        assert.equal(d.toNumber(), 3000.5);
        assert.equal(netSaleProfit(null, {}).toNumber(), 0);
    });
});

describe("SALE_LEVEL_DEDUCTIONS_SQL", () => {
    test("covers the same five columns as the TS helper", () => {
        for (const col of [
            "DISCOUNT_AMOUNT",
            "LOYALTY_TIER_DISCOUNT_AMOUNT",
            "VOUCHER_DISCOUNT_AMOUNT",
            "SUBSCRIPTION_DISCOUNT_AMOUNT",
            "LOYALTY_POINTS_REDEMPTION_VALUE",
        ]) {
            assert.match(SALE_LEVEL_DEDUCTIONS_SQL, new RegExp(`COALESCE\\(s\\.${col}, 0\\)`));
        }
    });
});
