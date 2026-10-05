// Unit tests for the laundry supply-shortfall maths (src/stock/supply-shortage.ts).
// Pure functions, no DB.
//
// Run with:  npx tsx --test src/stock/__tests__/supply-shortage.test.ts   (or npm test)

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
    receiptQtyAfterDebt,
    settleLayers,
    shortPortion,
    shortageEpisode,
    episodeSalesIds,
    ShortageMovement,
} from "../supply-shortage";

const n = (d: { toNumber(): number }) => d.toNumber();

let nextId = 1000;
/** Movements are built OLDEST → newest here, then reversed (the walk is newest-first). */
function history(...rows: [type: string, prev: number, delta: number, doc?: number][]): ShortageMovement[] {
    return rows
        .map(([movementType, prev, delta, doc], i) => ({
            id: nextId++,
            previousAvailableQuantity: prev,
            availableQuantityDelta: delta,
            movementType,
            documentId: doc ?? 0,
            createdAt: new Date(Date.UTC(2026, 9, 2, 7, i)),
        }))
        .reverse();
}

describe("shortPortion", () => {
    test("crossing below zero counts only the part below zero", () => {
        assert.equal(n(shortPortion(100, -150)), 50);
    });
    test("landing exactly on zero is not short", () => {
        assert.equal(n(shortPortion(100, -100)), 0);
    });
    test("already negative: the whole consumption is short", () => {
        assert.equal(n(shortPortion(-20, -30)), 30);
    });
    test("staying positive is not short", () => {
        assert.equal(n(shortPortion(100, -30)), 0);
    });
    test("a positive delta (restock / void) is never short", () => {
        assert.equal(n(shortPortion(-50, 20)), 0);
        assert.equal(n(shortPortion(-50, 80)), 0);
    });
    test("decimal quantities stay exact", () => {
        assert.equal(n(shortPortion(0.3, -0.5)), 0.2);
    });
});

describe("receiptQtyAfterDebt / settleLayers", () => {
    test("non-negative balance keeps the whole stock-in", () => {
        assert.equal(n(receiptQtyAfterDebt(0, 500)), 500);
        assert.equal(n(receiptQtyAfterDebt(40, 500)), 500);
    });
    test("negative balance: only the positive remainder becomes a receipt", () => {
        assert.equal(n(receiptQtyAfterDebt(-250, 1000)), 750);
    });
    test("stock-in that only pays part of the debt creates no receipt", () => {
        assert.equal(n(receiptQtyAfterDebt(-250, 100)), 0);
        assert.equal(n(receiptQtyAfterDebt(-250, 250)), 0);
    });
    test("non-positive delta → 0", () => {
        assert.equal(n(receiptQtyAfterDebt(-10, 0)), 0);
        assert.equal(n(receiptQtyAfterDebt(10, -5)), 0);
    });
    test("multi-layer: debt absorbed oldest layer first", () => {
        assert.deepEqual(settleLayers(-250, [100, 200, 300]).map(n), [0, 50, 300]);
        assert.deepEqual(settleLayers(10, [100, 200]).map(n), [100, 200]);
        assert.deepEqual(settleLayers(-1000, [100, 200]).map(n), [0, 0]);
    });
});

describe("shortageEpisode", () => {
    test("one wash crossing below zero", () => {
        const mv = history(
            ["Delivery Receipt", 0, 100],
            ["Sales", 100, -60, 1],
            ["Sales", 40, -100, 2], // crosses: 60 short
        );
        const ep = shortageEpisode(mv);
        assert.deepEqual(ep.sales.map((s) => [s.salesId, n(s.shortQuantity)]), [[2, 60]]);
        assert.equal(ep.since?.toISOString(), mv[0].createdAt?.toISOString());
    });

    test("partial crossing then more washes already in the negative — newest first", () => {
        const mv = history(
            ["Sales", 30, -50, 1],  // 20 short, crossing → since
            ["Sales", -20, -40, 2], // 40 short
            ["Sales", -60, -10, 3], // 10 short
        );
        const ep = shortageEpisode(mv);
        assert.deepEqual(ep.sales.map((s) => [s.salesId, n(s.shortQuantity)]), [[3, 10], [2, 40], [1, 20]]);
        assert.equal(ep.since?.toISOString(), mv[2].createdAt?.toISOString());
    });

    test("a voided wash inside the episode is skipped (its void movement is ignored too)", () => {
        const mv = history(
            ["Sales", 10, -30, 1],     // 20 short
            ["Sales", -20, -40, 2],    // voided below
            ["Sales Void", -60, 40, 2],
            ["Sales", -20, -5, 3],     // 5 short
        );
        assert.deepEqual(episodeSalesIds(mv).sort(), [1, 2, 3]);
        const ep = shortageEpisode(mv, new Set([2]));
        assert.deepEqual(ep.sales.map((s) => [s.salesId, n(s.shortQuantity)]), [[3, 5], [1, 20]]);
    });

    test("episode ends at the restock: older shortages that were paid back don't count", () => {
        const mv = history(
            ["Sales", 0, -50, 1],                // old episode
            ["Stock Adjustment", -50, 200, 0],   // restock → 150
            ["Sales", 150, -100, 2],             // 50 left, not short
            ["Sales", 50, -80, 3],               // crosses: 30 short (episode start)
            ["Sales", -30, -10, 4],              // 10 short
        );
        const ep = shortageEpisode(mv);
        assert.deepEqual(ep.sales.map((s) => [s.salesId, n(s.shortQuantity)]), [[4, 10], [3, 30]]);
        assert.deepEqual(episodeSalesIds(mv).sort(), [3, 4]);
        // since = the crossing movement (sale 3)
        assert.equal(ep.since?.toISOString(), mv[1].createdAt?.toISOString());
    });

    test("a partial restock that stays negative does not end the episode", () => {
        const mv = history(
            ["Sales", 20, -70, 1],               // 50 short (crossing)
            ["Stock Adjustment", -50, 30, 0],    // → -20, still negative
            ["Sales", -20, -15, 2],              // 15 short
        );
        const ep = shortageEpisode(mv);
        assert.deepEqual(ep.sales.map((s) => [s.salesId, n(s.shortQuantity)]), [[2, 15], [1, 50]]);
    });

    test("never stocked: first movement starts at 0 and is the crossing", () => {
        const mv = history(["Sales", 0, -25, 9]);
        const ep = shortageEpisode(mv);
        assert.deepEqual(ep.sales.map((s) => [s.salesId, n(s.shortQuantity)]), [[9, 25]]);
        assert.ok(ep.since);
    });

    test("no movements → empty episode", () => {
        const ep = shortageEpisode([]);
        assert.equal(ep.since, null);
        assert.deepEqual(ep.sales, []);
    });
});
