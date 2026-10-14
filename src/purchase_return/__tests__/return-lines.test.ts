// Unit tests for merging a purchase return's lines per item (src/purchase_return/return-lines.ts).
// Pure functions, no DB.
//
// Run with:  npx tsx --test src/purchase_return/__tests__/return-lines.test.ts   (or npm test)

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "decimal.js";

import { mergeReturnLines } from "../return-lines";

describe("mergeReturnLines", () => {
    test("two lines of one item become one line with the summed quantity", () => {
        // Stock 8: each line (5) passed the check alone, together they took stock to -2.
        const merged = mergeReturnLines([
            { itemId: 34, itemVariantId: null, quantity: 5, returnReason: "DEFECT", remark: "box 1" },
            { itemId: 34, itemVariantId: null, quantity: 5, returnReason: "BROKEN", remark: "box 2" },
        ]);
        assert.equal(merged.length, 1);
        assert.equal(merged[0].quantity.toNumber(), 10);
        assert.equal(merged[0].returnReason, "DEFECT, BROKEN");
        assert.equal(merged[0].remark, "box 1; box 2");
    });

    test("variants and other items stay separate, in first-seen order", () => {
        const merged = mergeReturnLines([
            { itemId: 34, itemVariantId: 7, quantity: 1 },
            { itemId: 34, itemVariantId: 8, quantity: 2 },
            { itemId: 35, quantity: 3 },
            { itemId: 34, itemVariantId: 7, quantity: "1.5" },
        ]);
        assert.deepEqual(
            merged.map(l => [l.itemId, l.itemVariantId ?? null, l.quantity.toNumber()]),
            [[34, 7, 2.5], [34, 8, 2], [35, null, 3]],
        );
    });

    test("a missing variant and a null variant are the same item", () => {
        assert.equal(mergeReturnLines([{ itemId: 1, quantity: 1 }, { itemId: 1, itemVariantId: null, quantity: 1 }]).length, 1);
    });

    test("cancellation: stored lines merge per receipt, a repeated reason is kept once", () => {
        const merged = mergeReturnLines([
            { itemId: 34, quantity: new Decimal(4), stockReceiptId: 90, returnReason: "DEFECT" },
            { itemId: 34, quantity: new Decimal(3), stockReceiptId: 90, returnReason: "DEFECT" },
            { itemId: 34, quantity: new Decimal(2), stockReceiptId: 91, returnReason: "DEFECT" },
        ]);
        assert.deepEqual(merged.map(l => [l.stockReceiptId, l.quantity.toNumber(), l.returnReason]), [[90, 7, "DEFECT"], [91, 2, "DEFECT"]]);
    });

    test("does not change the caller's lines", () => {
        const lines = [{ itemId: 1, quantity: 1 }, { itemId: 1, quantity: 2 }];
        mergeReturnLines(lines);
        assert.deepEqual(lines, [{ itemId: 1, quantity: 1 }, { itemId: 1, quantity: 2 }]);
    });
});
