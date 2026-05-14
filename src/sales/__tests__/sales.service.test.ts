// Unit tests for sales.service pure helpers: stock-consumption deduction
// formula and request-numeric validation. No DB, no Prisma — these are pure
// functions exposed via __testables.
//
// Run with:  npm test
// (or directly: npx tsx --test src/sales/__tests__/*.test.ts)

import "reflect-metadata";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "decimal.js";

import salesService from "../sales.service";

const { getEffectiveStockQty, validateSalesItemNumerics, validatePaymentNumerics, toDecimalOrThrow } =
    (salesService as any).__testables;

// ── getEffectiveStockQty ───────────────────────────────────────────────────

describe("getEffectiveStockQty", () => {
    test("piece-based item (null consumption) returns quantity unchanged", () => {
        const result = getEffectiveStockQty(new Decimal(3), null);
        assert.equal(result.toString(), "3");
    });

    test("piece-based item (undefined consumption) returns quantity unchanged", () => {
        const result = getEffectiveStockQty(new Decimal(2), undefined);
        assert.equal(result.toString(), "2");
    });

    test("consumption item multiplies quantity by stockConsumptionQty", () => {
        // 3 washes × 50ml/wash = 150ml deducted
        const result = getEffectiveStockQty(new Decimal(3), 50);
        assert.equal(result.toString(), "150");
    });

    test("consumption item accepts Decimal-like input", () => {
        const result = getEffectiveStockQty(new Decimal(2), new Decimal(80));
        assert.equal(result.toString(), "160");
    });

    test("fractional quantity multiplies cleanly", () => {
        const result = getEffectiveStockQty(new Decimal(0.5), 100);
        assert.equal(result.toString(), "50");
    });

    test("stockConsumptionQty of 0 still multiplies (yields 0) — validator must guard", () => {
        // Documents math behavior. The validator rejects 0 upstream; this
        // ensures the helper itself is honest about treating `0` as a value
        // (not as "missing"), so a missed validation can't silently fall
        // back to piece-based deduction.
        const result = getEffectiveStockQty(new Decimal(5), 0);
        assert.equal(result.toString(), "0");
    });

    test("string input coerces via toString", () => {
        const result = getEffectiveStockQty(new Decimal(2), "25");
        assert.equal(result.toString(), "50");
    });
});

// ── validateSalesItemNumerics ──────────────────────────────────────────────

function makeItem(overrides: Record<string, unknown> = {}) {
    return {
        itemId: 1,
        itemName: "Test Item",
        quantity: 1,
        price: 100,
        cost: 50,
        discountAmount: 0,
        taxAmount: 0,
        ...overrides,
    };
}

describe("validateSalesItemNumerics", () => {
    test("accepts a valid items array", () => {
        assert.doesNotThrow(() => validateSalesItemNumerics([makeItem()]));
    });

    test("rejects empty items array", () => {
        assert.throws(
            () => validateSalesItemNumerics([]),
            /at least one sales item/i
        );
    });

    test("rejects non-array input", () => {
        assert.throws(
            () => validateSalesItemNumerics(null),
            /at least one sales item/i
        );
    });

    test("rejects zero quantity", () => {
        assert.throws(
            () => validateSalesItemNumerics([makeItem({ quantity: 0 })]),
            /Quantity.*greater than 0/i
        );
    });

    test("rejects negative quantity", () => {
        assert.throws(
            () => validateSalesItemNumerics([makeItem({ quantity: -1 })]),
            /Quantity.*greater than 0/i
        );
    });

    test("rejects negative price", () => {
        assert.throws(
            () => validateSalesItemNumerics([makeItem({ price: -1 })]),
            /Price.*cannot be negative/i
        );
    });

    test("accepts zero price (free item)", () => {
        assert.doesNotThrow(() => validateSalesItemNumerics([makeItem({ price: 0 })]));
    });

    test("rejects negative cost", () => {
        assert.throws(
            () => validateSalesItemNumerics([makeItem({ cost: -10 })]),
            /Cost.*cannot be negative/i
        );
    });

    test("rejects negative discount", () => {
        assert.throws(
            () => validateSalesItemNumerics([makeItem({ discountAmount: -5 })]),
            /Discount amount.*cannot be negative/i
        );
    });

    test("rejects negative tax", () => {
        assert.throws(
            () => validateSalesItemNumerics([makeItem({ taxAmount: -5 })]),
            /Tax amount.*cannot be negative/i
        );
    });

    test("rejects non-numeric quantity", () => {
        assert.throws(
            () => validateSalesItemNumerics([makeItem({ quantity: "abc" })]),
            /Invalid quantity.*must be numeric/i
        );
    });

    test("includes item name in error for traceability", () => {
        assert.throws(
            () => validateSalesItemNumerics([makeItem({ itemName: "Widget A", quantity: -1 })]),
            /Widget A/
        );
    });

    test("falls back to itemId when itemName missing", () => {
        assert.throws(
            () => validateSalesItemNumerics([makeItem({ itemName: undefined, itemId: 42, quantity: -1 })]),
            /itemId 42/
        );
    });

    test("validates every item — fails on the bad one", () => {
        assert.throws(
            () => validateSalesItemNumerics([makeItem(), makeItem({ quantity: -1 })]),
            /greater than 0/i
        );
    });
});

// ── validatePaymentNumerics ────────────────────────────────────────────────

describe("validatePaymentNumerics", () => {
    test("accepts valid payments", () => {
        assert.doesNotThrow(() =>
            validatePaymentNumerics([{ tenderedAmount: 100 }, { tenderedAmount: 50 }])
        );
    });

    test("accepts empty payments array", () => {
        assert.doesNotThrow(() => validatePaymentNumerics([]));
    });

    test("accepts zero tendered (e.g., voucher-only payment)", () => {
        assert.doesNotThrow(() => validatePaymentNumerics([{ tenderedAmount: 0 }]));
    });

    test("rejects negative tendered amount", () => {
        assert.throws(
            () => validatePaymentNumerics([{ tenderedAmount: -10 }]),
            /Tendered amount.*cannot be negative/i
        );
    });

    test("identifies which payment index failed", () => {
        assert.throws(
            () => validatePaymentNumerics([{ tenderedAmount: 100 }, { tenderedAmount: -1 }]),
            /payment\[1\]/
        );
    });

    test("rejects non-numeric tendered amount", () => {
        assert.throws(
            () => validatePaymentNumerics([{ tenderedAmount: "abc" }]),
            /Invalid tenderedAmount.*must be numeric/i
        );
    });
});

// ── toDecimalOrThrow ───────────────────────────────────────────────────────

describe("toDecimalOrThrow", () => {
    test("null returns zero", () => {
        assert.equal(toDecimalOrThrow(null, "x", "item").toString(), "0");
    });

    test("undefined returns zero", () => {
        assert.equal(toDecimalOrThrow(undefined, "x", "item").toString(), "0");
    });

    test("number coerces to Decimal", () => {
        assert.equal(toDecimalOrThrow(42.5, "x", "item").toString(), "42.5");
    });

    test("numeric string coerces to Decimal", () => {
        assert.equal(toDecimalOrThrow("123.45", "x", "item").toString(), "123.45");
    });

    test("non-numeric string throws", () => {
        assert.throws(
            () => toDecimalOrThrow("not a number", "fieldX", "itemRef"),
            /Invalid fieldX for itemRef/
        );
    });
});
