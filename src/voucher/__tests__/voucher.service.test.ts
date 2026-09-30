// Unit tests for voucher.service pure helpers exposed via __testables.
// No DB, no Prisma — pure functions backing docs/modules/LOYALTY.md §2
// (Vouchers), §4.11 (Reward Rules), §8.4 (voided/returned sale restores
// non-expired vouchers), and tester-guide scenarios §16 (best-deal),
// §18 (min purchase), §19 (expiry badge), §24 (void restore), §29 (FIXED).

import "reflect-metadata";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "decimal.js";

import voucherService from "../voucher.service";
import { RequestValidateError } from "../../api-helpers/error";

const {
    toNum,
    voucherDiscountFor,
    voucherBaseAfterPackage,
    shouldRestoreVoucher,
    expectedRepeatableVoucherCount,
    toVoucherListItem,
    validateRuleDiscountFields,
    formatRule,
} = (voucherService as any).__testables;

// ── toNum ──────────────────────────────────────────────────────────────────

describe("voucher toNum", () => {
    test("null/undefined → 0", () => {
        assert.equal(toNum(null), 0);
        assert.equal(toNum(undefined), 0);
    });

    test("number passes through", () => {
        assert.equal(toNum(10), 10);
    });

    test("Decimal/object via .toString()", () => {
        const d = new Decimal("12.50");
        assert.equal(toNum(d), 12.5);
    });

    test("string-shaped numeric parses correctly", () => {
        assert.equal(toNum("100"), 100);
    });
});

// ── voucherDiscountFor (PERCENTAGE + FIXED math, docs §2 + tester §29) ─────

describe("voucherDiscountFor", () => {
    test("PERCENTAGE 10% on 100,000 → amount 10,000, percentage 10", () => {
        const { discountPercentage, discountAmount } = voucherDiscountFor(
            "PERCENTAGE", 10, 0, new Decimal(100_000),
        );
        assert.equal(discountAmount.toNumber(), 10_000);
        assert.equal(discountPercentage.toNumber(), 10);
    });

    test("PERCENTAGE 200% (mis-configured) → capped at totalAmount", () => {
        // Defensive cap — a misbehaving rule shouldn't produce negative totals.
        const { discountAmount } = voucherDiscountFor(
            "PERCENTAGE", 200, 0, new Decimal(50_000),
        );
        assert.equal(discountAmount.toNumber(), 50_000);
    });

    test("FIXED 20,000 on 100,000 → amount 20,000, percentage 0", () => {
        const { discountPercentage, discountAmount } = voucherDiscountFor(
            "FIXED", 0, 20_000, new Decimal(100_000),
        );
        assert.equal(discountAmount.toNumber(), 20_000);
        assert.equal(discountPercentage.toNumber(), 0);
    });

    test("FIXED 50,000 on 30,000 cart → capped at 30,000 (tester scenario §29)", () => {
        const { discountAmount } = voucherDiscountFor(
            "FIXED", 0, 50_000, new Decimal(30_000),
        );
        assert.equal(discountAmount.toNumber(), 30_000);
    });

    test("PERCENTAGE with null/undefined percentage treated as 0", () => {
        const { discountAmount } = voucherDiscountFor(
            "PERCENTAGE", null, 100, new Decimal(50_000),
        );
        assert.equal(discountAmount.toNumber(), 0);
    });

    test("FIXED with null/undefined amount treated as 0", () => {
        const { discountAmount } = voucherDiscountFor(
            "FIXED", 10, null, new Decimal(50_000),
        );
        assert.equal(discountAmount.toNumber(), 0);
    });

    test("accepts Prisma Decimal-as-string for configured values", () => {
        const { discountAmount } = voucherDiscountFor(
            "PERCENTAGE", "12.50" as any, "0" as any, new Decimal(100_000),
        );
        assert.equal(discountAmount.toNumber(), 12_500);
    });
});

// ── shouldRestoreVoucher (void/return behavior, docs §8.4 FAQ + tester §24) ─

describe("shouldRestoreVoucher", () => {
    test("expiresAt in the future → ACTIVE", () => {
        const future = new Date("2026-06-01T00:00:00Z");
        const now = new Date("2026-04-01T00:00:00Z");
        assert.equal(shouldRestoreVoucher(future, now), "ACTIVE");
    });

    test("expiresAt in the past → EXPIRED", () => {
        const past = new Date("2026-03-01T00:00:00Z");
        const now = new Date("2026-04-01T00:00:00Z");
        assert.equal(shouldRestoreVoucher(past, now), "EXPIRED");
    });

    test("expiresAt exactly equals now → EXPIRED (strict > check)", () => {
        // Boundary: at the precise expiry instant, the voucher is no longer
        // active. Voucher restoration on void must not "revive" an expired
        // voucher (matches the `expiresAt > new Date()` check at line 295).
        const exact = new Date("2026-04-01T00:00:00Z");
        assert.equal(shouldRestoreVoucher(exact, exact), "EXPIRED");
    });

    test("1 ms past expiry → EXPIRED", () => {
        const exp = new Date("2026-04-01T00:00:00.000Z");
        const now = new Date("2026-04-01T00:00:00.001Z");
        assert.equal(shouldRestoreVoucher(exp, now), "EXPIRED");
    });

    test("1 ms before expiry → ACTIVE", () => {
        const exp = new Date("2026-04-01T00:00:00.001Z");
        const now = new Date("2026-04-01T00:00:00.000Z");
        assert.equal(shouldRestoreVoucher(exp, now), "ACTIVE");
    });
});

// ── expectedRepeatableVoucherCount (milestone math, docs §2 isRepeatable) ──

describe("expectedRepeatableVoucherCount", () => {
    test("totalSpend below threshold → 0 vouchers earned", () => {
        const result = expectedRepeatableVoucherCount(new Decimal(500_000), new Decimal(1_000_000));
        assert.equal(result, 0);
    });

    test("totalSpend exactly at threshold → 1 voucher earned", () => {
        const result = expectedRepeatableVoucherCount(new Decimal(1_000_000), new Decimal(1_000_000));
        assert.equal(result, 1);
    });

    test("totalSpend at 2× threshold → 2 vouchers earned", () => {
        const result = expectedRepeatableVoucherCount(new Decimal(2_000_000), new Decimal(1_000_000));
        assert.equal(result, 2);
    });

    test("totalSpend between thresholds (1.5×) → floor → 1 voucher", () => {
        const result = expectedRepeatableVoucherCount(new Decimal(1_500_000), new Decimal(1_000_000));
        assert.equal(result, 1);
    });

    test("threshold of zero or negative → 0 (defensive)", () => {
        assert.equal(expectedRepeatableVoucherCount(new Decimal(1_000_000), new Decimal(0)), 0);
        assert.equal(expectedRepeatableVoucherCount(new Decimal(1_000_000), new Decimal(-100)), 0);
    });

    test("zero spend → 0", () => {
        assert.equal(expectedRepeatableVoucherCount(new Decimal(0), new Decimal(1_000_000)), 0);
    });
});

// ── toVoucherListItem (list response shape) ────────────────────────────────

describe("toVoucherListItem", () => {
    test("rule-issued voucher → ruleName from the relation, relation stripped", () => {
        const item = toVoucherListItem({
            id: 1, rewardRuleId: 7, label: "Hadiah — RM 5000 off",
            rewardRule: { name: "Hadiah Belanja" },
        });
        assert.equal(item.ruleName, "Hadiah Belanja");
        assert.equal(item.label, "Hadiah — RM 5000 off");
        assert.equal("rewardRule" in item, false);
    });

    test("manual voucher (no rule) → ruleName null, typed label kept", () => {
        const item = toVoucherListItem({ id: 2, rewardRuleId: null, label: "Maaf ya", rewardRule: null });
        assert.equal(item.ruleName, null);
        assert.equal(item.label, "Maaf ya");
    });
});

// ── validateRuleDiscountFields (reward-rule input validation) ──────────────

describe("validateRuleDiscountFields", () => {
    test("PERCENTAGE valid value passes", () => {
        assert.doesNotThrow(() => validateRuleDiscountFields("PERCENTAGE", 10, undefined));
    });

    test("PERCENTAGE 100 (boundary) passes", () => {
        assert.doesNotThrow(() => validateRuleDiscountFields("PERCENTAGE", 100, undefined));
    });

    test("PERCENTAGE 0 → rejected", () => {
        assert.throws(
            () => validateRuleDiscountFields("PERCENTAGE", 0, undefined),
            (err: any) => err instanceof RequestValidateError,
        );
    });

    test("PERCENTAGE > 100 → rejected", () => {
        assert.throws(
            () => validateRuleDiscountFields("PERCENTAGE", 101, undefined),
            (err: any) => err instanceof RequestValidateError,
        );
    });

    test("PERCENTAGE negative → rejected", () => {
        assert.throws(
            () => validateRuleDiscountFields("PERCENTAGE", -5, undefined),
            (err: any) => err instanceof RequestValidateError,
        );
    });

    test("PERCENTAGE undefined value → rejected", () => {
        assert.throws(
            () => validateRuleDiscountFields("PERCENTAGE", undefined, undefined),
            (err: any) => err instanceof RequestValidateError,
        );
    });

    test("FIXED valid value passes", () => {
        assert.doesNotThrow(() => validateRuleDiscountFields("FIXED", undefined, 20_000));
    });

    test("FIXED 0 → rejected", () => {
        assert.throws(
            () => validateRuleDiscountFields("FIXED", undefined, 0),
            (err: any) => err instanceof RequestValidateError,
        );
    });

    test("FIXED negative → rejected", () => {
        assert.throws(
            () => validateRuleDiscountFields("FIXED", undefined, -100),
            (err: any) => err instanceof RequestValidateError,
        );
    });

    test("invalid discountType → rejected", () => {
        assert.throws(
            () => validateRuleDiscountFields("INVALID", 10, undefined),
            (err: any) => err instanceof RequestValidateError,
        );
    });
});

// ── formatRule (Prisma row → API response, docs §4.11) ─────────────────────

describe("formatRule", () => {
    test("maps a populated row into the API response shape", () => {
        const now = new Date("2026-03-02T15:00:00.000Z");
        const out = formatRule({
            id: 1,
            name: "Spend RM 1,000 Reward",
            triggerType: "SPEND_MILESTONE",
            spendThreshold: "1000000.00",
            isRepeatable: false,
            discountType: "PERCENTAGE",
            discountPercentage: "10.00",
            discountAmount: null,
            expiryDays: 30,
            minPurchaseAmount: "50000.00",
            isActive: true,
            createdAt: now,
            updatedAt: now,
        });
        assert.equal(out.spendThreshold, 1_000_000);
        assert.equal(out.discountPercentage, 10);
        assert.equal(out.discountAmount, null);
        assert.equal(out.minPurchaseAmount, 50_000);
        assert.equal(out.isActive, true);
        assert.equal(out.createdAt, "2026-03-02T15:00:00.000Z");
    });

    test("null minPurchaseAmount stays null in response", () => {
        const out = formatRule({
            id: 1,
            name: "X",
            triggerType: "SPEND_MILESTONE",
            spendThreshold: 1,
            isRepeatable: false,
            discountType: "FIXED",
            discountAmount: 100,
            discountPercentage: null,
            expiryDays: 30,
            minPurchaseAmount: null,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        assert.equal(out.minPurchaseAmount, null);
    });

    test("deactivated rule survives formatting (isActive: false)", () => {
        const out = formatRule({
            id: 1,
            name: "X",
            triggerType: "SPEND_MILESTONE",
            spendThreshold: 1,
            isRepeatable: false,
            discountType: "PERCENTAGE",
            discountPercentage: 10,
            discountAmount: null,
            expiryDays: 30,
            minPurchaseAmount: null,
            isActive: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        assert.equal(out.isActive, false);
    });
});

// ── voucherBaseAfterPackage ────────────────────────────────────────────────
// The sale's totalAmount is FINAL (after package, voucher, points); the FE
// takes the voucher on what the prepaid package left. Validation must rebuild
// that base, or every voucher sale is rejected (found 2026-09-30 on
// nanggroe_wash: "sent 6000, expected 5400" for 10% on a 60,000 cart) — and
// must NOT add the package back, or a package-paid sale burns a voucher
// (demo_laundry, Rina: 64,000 covered by her package, 10% voucher → 6,400).

describe("voucherBaseAfterPackage", () => {
    const D = (n: number) => new Decimal(n);
    const expectedOnBase = (type: string, pct: number | null, amt: number | null, final: number, sent: number, redemption = 0) =>
        voucherDiscountFor(type, pct, amt, voucherBaseAfterPackage(D(final), D(redemption), sent)).discountAmount.toNumber();

    test("10% on a 60,000 cart: final 54,000 + sent 6,000 → base 60,000, expected 6,000", () => {
        assert.equal(voucherBaseAfterPackage(D(54000), D(0), 6000).toNumber(), 60000);
        assert.equal(expectedOnBase("PERCENTAGE", 10, null, 54000, 6000), 6000);
    });

    test("an inflated percentage amount is still rejected (expected ≠ sent)", () => {
        // Cashier-side claims 9,000 off a 60,000 cart at 10%: final would be 51,000.
        assert.notEqual(expectedOnBase("PERCENTAGE", 10, null, 51000, 9000), 9000);
    });

    test("points are added back, the package is not (it goes first)", () => {
        // 100,000 cart: package 20,000 → 80,000; voucher 10% → 8,000 → 72,000;
        // points 5,000 → 67,000 final. Base = 67,000 + 5,000 + 8,000 = 80,000.
        assert.equal(voucherBaseAfterPackage(D(67000), D(5000), 8000).toNumber(), 80000);
        assert.equal(expectedOnBase("PERCENTAGE", 10, null, 67000, 8000, 5000), 8000);
    });

    test("package covers the whole sale: base 0 → caller skips redemption", () => {
        // Rina: 64,000 all covered by the package, FE sends no voucher amount.
        assert.equal(voucherBaseAfterPackage(D(0), D(0), undefined).toNumber(), 0);
        assert.equal(voucherBaseAfterPackage(D(0), D(0), 0).toNumber(), 0);
    });

    test("old stacking order is rejected: voucher 10% of the pre-package 64,000", () => {
        // Pre-fix FE: voucher 6,400 on 64,000, package 57,600, final 0.
        // Base = 0 + 0 + 6,400 → expected 640 ≠ sent 6,400.
        assert.notEqual(expectedOnBase("PERCENTAGE", 10, null, 0, 6400), 6400);
    });

    test("FIXED voucher: full amount when the cart covers it", () => {
        assert.equal(expectedOnBase("FIXED", null, 15000, 45000, 15000), 15000);
    });

    test("FIXED voucher capped at the cart: 15,000 voucher on a 10,000 cart → 10,000", () => {
        assert.equal(expectedOnBase("FIXED", null, 15000, 0, 10000), 10000);
    });

    test("no sent amount → base is just final + points", () => {
        assert.equal(voucherBaseAfterPackage(D(50000), D(0), undefined).toNumber(), 50000);
    });
});
