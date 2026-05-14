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
    shouldRestoreVoucher,
    expectedRepeatableVoucherCount,
    formatVoucherLabel,
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

// ── formatVoucherLabel (label shape on issued vouchers) ────────────────────

describe("formatVoucherLabel", () => {
    test("PERCENTAGE rule → 'Name — X% off'", () => {
        const label = formatVoucherLabel("Spend RM 1,000 Reward", "PERCENTAGE", 10, 0);
        assert.equal(label, "Spend RM 1,000 Reward — 10% off");
    });

    test("FIXED rule → 'Name — RM X off'", () => {
        const label = formatVoucherLabel("Fixed RM 20 off", "FIXED", 0, 20_000);
        assert.equal(label, "Fixed RM 20 off — RM 20000 off");
    });

    test("Decimal-as-string values coerce via toNum", () => {
        const label = formatVoucherLabel("X", "PERCENTAGE", "15.00" as any, null);
        assert.equal(label, "X — 15% off");
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
