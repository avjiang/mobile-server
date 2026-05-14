// Unit tests for sales.service loyalty pure helpers exposed via __testables.
// No DB, no Prisma — these back the math inside processLoyaltyForSale
// (sales.service.ts:166). Together with the FE
// sales_calculation_helper_loyalty_test.dart this gives full coverage of
// the discount-stacking rules in docs/modules/LOYALTY.md §2 + tester-guide
// §16 scenarios A–G.

import "reflect-metadata";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "decimal.js";

import salesService from "../sales.service";
import { TierMismatchError } from "../../api-helpers/error";

const {
    pickBestDiscount,
    calcPointsEarned,
    validateTierMatch,
} = (salesService as any).__testables;

// ── pickBestDiscount (tester §16 A–G, docs §2 "Discount Stacking Order") ───

describe("pickBestDiscount", () => {
    const total = new Decimal(100_000);

    test("no tier, no voucher → winner: 'none', both amounts 0", () => {
        const r = pickBestDiscount({
            tierDiscountPercentage: 0,
            hasVoucher: false,
            totalAmount: total,
        });
        assert.equal(r.winner, "none");
        assert.equal(r.tierAmount.toNumber(), 0);
        assert.equal(r.voucherAmount.toNumber(), 0);
    });

    test("tier only (5%, no voucher) → winner: 'tier', tierAmount = 5,000", () => {
        const r = pickBestDiscount({
            tierDiscountPercentage: 5,
            hasVoucher: false,
            totalAmount: total,
        });
        assert.equal(r.winner, "tier");
        assert.equal(r.tierAmount.toNumber(), 5_000);
        assert.equal(r.voucherAmount.toNumber(), 0);
    });

    test("voucher % > tier % → winner: 'voucher' (tester §16 A)", () => {
        const r = pickBestDiscount({
            tierDiscountPercentage: 5,
            voucherDiscountType: "PERCENTAGE",
            voucherDiscountPercentage: 10,
            hasVoucher: true,
            totalAmount: total,
        });
        assert.equal(r.winner, "voucher");
        assert.equal(r.voucherAmount.toNumber(), 10_000);
        // tierAmount is still computed (for the response shape), but the
        // caller zeroes the tier fields when winner === 'voucher'.
        assert.equal(r.tierAmount.toNumber(), 5_000);
    });

    test("tier % > voucher % → winner: 'tier' (tester §16 B)", () => {
        const r = pickBestDiscount({
            tierDiscountPercentage: 10,
            voucherDiscountType: "PERCENTAGE",
            voucherDiscountPercentage: 5,
            hasVoucher: true,
            totalAmount: total,
        });
        assert.equal(r.winner, "tier");
        assert.equal(r.tierAmount.toNumber(), 10_000);
    });

    test("tie tier 10% vs voucher 10% → winner: 'tier' (strict >, tester §16 C)", () => {
        const r = pickBestDiscount({
            tierDiscountPercentage: 10,
            voucherDiscountType: "PERCENTAGE",
            voucherDiscountPercentage: 10,
            hasVoucher: true,
            totalAmount: total,
        });
        assert.equal(r.winner, "tier",
            "tie must go to tier — voucher stays ACTIVE for next sale");
    });

    test("voucher FIXED 20,000 vs tier 5% (5,000) → voucher wins", () => {
        const r = pickBestDiscount({
            tierDiscountPercentage: 5,
            voucherDiscountType: "FIXED",
            voucherDiscountPercentage: 0,
            voucherDiscountAmount: 20_000,
            hasVoucher: true,
            totalAmount: total,
        });
        assert.equal(r.winner, "voucher");
        assert.equal(r.voucherAmount.toNumber(), 20_000);
    });

    test("voucher FIXED capped at remaining (tester §29 fixed-amount voucher)", () => {
        const r = pickBestDiscount({
            tierDiscountPercentage: 0,
            voucherDiscountType: "FIXED",
            voucherDiscountAmount: 50_000,
            hasVoucher: true,
            totalAmount: new Decimal(30_000),
        });
        assert.equal(r.winner, "voucher");
        assert.equal(r.voucherAmount.toNumber(), 30_000, "FIXED capped at cart total");
    });

    test("voucher PERCENTAGE > 100% mis-configured → capped at totalAmount", () => {
        // Defensive — a misbehaving voucher rule shouldn't yield negative totals.
        const r = pickBestDiscount({
            tierDiscountPercentage: 0,
            voucherDiscountType: "PERCENTAGE",
            voucherDiscountPercentage: 200,
            hasVoucher: true,
            totalAmount: new Decimal(50_000),
        });
        assert.equal(r.voucherAmount.toNumber(), 50_000);
    });

    test("hasVoucher false suppresses voucher branch even if amount set", () => {
        // Caller invariant — when hasVoucher is false the configured values
        // are ignored. Guards against bugs that compute voucher math from a
        // stale `salesBody` after the voucher has been removed.
        const r = pickBestDiscount({
            tierDiscountPercentage: 5,
            voucherDiscountType: "PERCENTAGE",
            voucherDiscountPercentage: 50,
            hasVoucher: false,
            totalAmount: total,
        });
        assert.equal(r.winner, "tier");
        assert.equal(r.voucherAmount.toNumber(), 0);
    });
});

// ── calcPointsEarned (docs §2 "Points") ────────────────────────────────────

describe("calcPointsEarned", () => {
    test("standard: 100,000 × 0.01 × 1.0 = 1,000 points (whole, default FLOOR)", () => {
        const earned = calcPointsEarned(new Decimal(100_000), 0.01, 1.0);
        assert.equal(earned, 1_000);
    });

    test("with Gold tier multiplier 1.5x → 1,500 points", () => {
        // Per docs §2 — earned points scale by tier.pointsMultiplier.
        const earned = calcPointsEarned(new Decimal(100_000), 0.01, 1.5);
        assert.equal(earned, 1_500);
    });

    test("zero totalAmount → 0 points (fully discounted sale)", () => {
        const earned = calcPointsEarned(new Decimal(0), 0.01, 1.5);
        assert.equal(earned, 0);
    });

    test("negative totalAmount → 0 points (defensive)", () => {
        const earned = calcPointsEarned(new Decimal(-100), 0.01, 1.0);
        assert.equal(earned, 0);
    });

    test("zero pointsPerCurrency → 0 points (e.g. earn disabled)", () => {
        const earned = calcPointsEarned(new Decimal(100_000), 0, 1.0);
        assert.equal(earned, 0);
    });

    test("zero or null multiplier → 0 points (defensive)", () => {
        // Per docs §2: pointsMultiplier defaults to 1.0 in caller; if it
        // somehow arrives as 0, points earn is suppressed rather than
        // silently using the raw pointsPerCurrency.
        assert.equal(calcPointsEarned(new Decimal(100_000), 0.01, 0), 0);
    });

    // ── Rounding modes (tenant-configurable, docs §2 + §8.4) ──────────

    test("FLOOR (default): 999.99 raw → 999 (drops fraction)", () => {
        // 99,999 × 0.01 × 1 = 999.99 raw
        const earned = calcPointsEarned(new Decimal(99_999), 0.01, 1, "FLOOR");
        assert.equal(earned, 999);
    });

    test("FLOOR: omitting mode uses FLOOR as the default", () => {
        const earned = calcPointsEarned(new Decimal(99_999), 0.01, 1);
        assert.equal(earned, 999, "FLOOR is the default — protects merchant");
    });

    test("ROUND: 999.99 raw → 1000 (rounds up at .5+)", () => {
        const earned = calcPointsEarned(new Decimal(99_999), 0.01, 1, "ROUND");
        assert.equal(earned, 1000);
    });

    test("ROUND: 999.49 raw → 999 (rounds down below .5)", () => {
        // 99,949 × 0.01 × 1 = 999.49 raw
        const earned = calcPointsEarned(new Decimal(99_949), 0.01, 1, "ROUND");
        assert.equal(earned, 999);
    });

    test("ROUND: exactly .5 rounds up (half-up convention)", () => {
        // 999.5 raw
        const earned = calcPointsEarned(new Decimal(99_950), 0.01, 1, "ROUND");
        assert.equal(earned, 1000);
    });

    test("CEIL: 999.01 raw → 1000 (any fraction becomes whole)", () => {
        // 99,901 × 0.01 × 1 = 999.01 raw
        const earned = calcPointsEarned(new Decimal(99_901), 0.01, 1, "CEIL");
        assert.equal(earned, 1000);
    });

    test("CEIL: exactly whole stays whole (no rounding needed)", () => {
        const earned = calcPointsEarned(new Decimal(100_000), 0.01, 1, "CEIL");
        assert.equal(earned, 1000);
    });

    test("all modes: whole-number result is unchanged", () => {
        // When the raw math already produces a whole number, no mode changes it.
        for (const mode of ["FLOOR", "ROUND", "CEIL"] as const) {
            assert.equal(calcPointsEarned(new Decimal(100_000), 0.01, 1, mode), 1000);
        }
    });

    test("all modes: zero result is unchanged", () => {
        for (const mode of ["FLOOR", "ROUND", "CEIL"] as const) {
            assert.equal(calcPointsEarned(new Decimal(0), 0.01, 1, mode), 0);
        }
    });
});

// ── validateTierMatch (docs §8.3 TierMismatchError) ────────────────────────

describe("validateTierMatch", () => {
    test("exact match passes", () => {
        assert.doesNotThrow(() => validateTierMatch(5, 5));
    });

    test("within 0.01 tolerance passes (float drift)", () => {
        assert.doesNotThrow(() => validateTierMatch(5.001, 5));
        assert.doesNotThrow(() => validateTierMatch(5, 5.009));
    });

    test("mismatch > 0.01 throws TierMismatchError", () => {
        assert.throws(
            () => validateTierMatch(10, 5),
            (err: any) => err instanceof TierMismatchError,
        );
    });

    test("error message includes both percentages", () => {
        try {
            validateTierMatch(10, 5);
            assert.fail("expected TierMismatchError");
        } catch (err: any) {
            assert.match(err.message, /requested 10%/);
            assert.match(err.message, /actual 5%/);
        }
    });

    test("customer has no tier (actual=0), but request sent tier % → throws", () => {
        // Per processLoyaltyForSale flow: when tier is null we pass 0 as
        // actualPercentage. Any non-zero request must throw.
        assert.throws(() => validateTierMatch(5, 0));
    });

    test("both zero → no mismatch (no-op pass)", () => {
        assert.doesNotThrow(() => validateTierMatch(0, 0));
    });
});
