// priceBeforeTax (and the other line-total amounts) must not be multiplied by
// quantity: the app sends them for the whole line. lineShareOf splits a line
// total across FIFO rows so the rows add back up to it.
//
// Run with:  npx tsx --test src/sales/__tests__/line-share.test.ts

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "decimal.js";

import { lineShareOf } from "../line-share";

describe("lineShareOf — line-total amounts on split rows", () => {
    test("single row keeps the line total (qty 2 × 6.500 → priceBeforeTax 13000, not 26000)", () => {
        // What the FE sends for an untaxed-inclusive line: priceBeforeTax = line total.
        assert.equal(lineShareOf(13000, 2, 2).toString(), "13000");
    });

    test("inclusive-tax line base stays the line base", () => {
        // qty 3 × 11.100, PPN 11% inclusive → base 33300 / 1.11 = 30000.
        assert.equal(lineShareOf(30000, 3, 3).toString(), "30000");
    });

    test("FIFO split across two receipts shares pro rata and sums back to the line", () => {
        const a = lineShareOf(30000, 1, 3);
        const b = lineShareOf(30000, 2, 3);
        assert.equal(a.toString(), "10000");
        assert.equal(b.toString(), "20000");
        assert.equal(a.plus(b).toString(), "30000");
    });

    test("fractional quantities (per-kg) split cleanly", () => {
        const a = lineShareOf(35000, new Decimal("2.5"), new Decimal("3.5"));
        const b = lineShareOf(35000, 1, new Decimal("3.5"));
        assert.equal(a.plus(b).toDecimalPlaces(4).toString(), "35000");
    });

    test("0 for a non-taxable line stays 0", () => {
        assert.equal(lineShareOf(0, 1, 2).toString(), "0");
    });

    test("null / undefined line total reads as 0", () => {
        assert.equal(lineShareOf(null, 1, 2).toString(), "0");
        assert.equal(lineShareOf(undefined, 1, 2).toString(), "0");
    });

    test("whole of 0 returns the line total instead of dividing by zero", () => {
        assert.equal(lineShareOf(500, 0, 0).toString(), "500");
    });
});
