// Unit tests for "did this edit change what was received?" (src/delivery_order/received-lines.ts).
// Pure functions, no DB.
//
// Run with:  npx tsx --test src/delivery_order/__tests__/received-lines.test.ts   (or npm test)

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "decimal.js";

import { sameReceivedLines } from "../received-lines";

const booked = [
    { itemId: 34, itemVariantId: null, receivedQuantity: new Decimal("10.0000") },
    { itemId: 35, itemVariantId: 7, receivedQuantity: new Decimal("2.5000") },
];

describe("sameReceivedLines", () => {
    test("the app resending the booked lines (numbers, any order) is not a change", () => {
        assert.equal(sameReceivedLines(booked, [
            { itemId: 35, itemVariantId: 7, receivedQuantity: 2.5 },
            { itemId: 34, receivedQuantity: 10 },
        ]), true);
    });

    test("a changed quantity is a change (it used to be added on top of the old one)", () => {
        assert.equal(sameReceivedLines(booked, [
            { itemId: 34, receivedQuantity: 12 },
            { itemId: 35, itemVariantId: 7, receivedQuantity: 2.5 },
        ]), false);
    });

    test("a swapped variant is a change", () => {
        assert.equal(sameReceivedLines(booked, [
            { itemId: 34, receivedQuantity: 10 },
            { itemId: 35, itemVariantId: 8, receivedQuantity: 2.5 },
        ]), false);
    });

    test("an added or removed item is a change", () => {
        assert.equal(sameReceivedLines(booked, [{ itemId: 34, receivedQuantity: 10 }]), false);
        assert.equal(sameReceivedLines(booked, [...booked, { itemId: 36, receivedQuantity: 1 }]), false);
    });

    test("one item split over two lines with the same total is not a change; a zero line is ignored", () => {
        assert.equal(sameReceivedLines(booked, [
            { itemId: 34, receivedQuantity: 6 },
            { itemId: 34, receivedQuantity: 4 },
            { itemId: 35, itemVariantId: 7, receivedQuantity: 2.5 },
            { itemId: 40, receivedQuantity: 0 },
        ]), true);
    });
});
