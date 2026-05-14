// Unit tests for loyalty.service pure helpers exposed via __testables.
// No DB, no Prisma — these are pure functions extracted from the
// Prisma-bound flows so the math stays under test.
//
// Run with:  npm test
//
// Backs the rules in docs/modules/LOYALTY.md §2 (Tier Membership,
// auto-upgrade), §4.4 (FIFO redemption), §8.2 (timer pause/resume on
// deactivation), and the relevant tester-guide scenarios (§8, §10, §11).

import "reflect-metadata";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "decimal.js";

import loyaltyService from "../loyalty.service";
import { InsufficientPointsError } from "../../api-helpers/error";

const {
    toDecimalNumber,
    calculateInactiveDays,
    selectHighestQualifyingTier,
    consumePointsFifo,
    formatTransaction,
} = (loyaltyService as any).__testables;

// ── toDecimalNumber ────────────────────────────────────────────────────────

describe("loyalty toDecimalNumber", () => {
    test("null and undefined → 0", () => {
        assert.equal(toDecimalNumber(null), 0);
        assert.equal(toDecimalNumber(undefined), 0);
    });

    test("number passes through", () => {
        assert.equal(toDecimalNumber(42), 42);
        assert.equal(toDecimalNumber(0.5), 0.5);
    });

    test("Prisma Decimal-as-string is parsed", () => {
        assert.equal(toDecimalNumber("1500.00"), 1500);
        assert.equal(toDecimalNumber("0.01"), 0.01);
    });

    test("Decimal object is coerced via Number()", () => {
        const d = new Decimal("2500.50");
        assert.equal(toDecimalNumber(d), 2500.5);
    });
});

// ── calculateInactiveDays (reactivation extension math, docs §8.2) ─────────

describe("calculateInactiveDays", () => {
    test("returns 0 when now equals deactivatedAt (no time elapsed)", () => {
        const t = new Date("2026-04-01T00:00:00Z");
        assert.equal(calculateInactiveDays(t, t), 0);
    });

    test("returns 0 for negative span (clock-skew defense)", () => {
        const past = new Date("2026-04-01T00:00:00Z");
        const earlier = new Date("2026-03-31T00:00:00Z");
        assert.equal(calculateInactiveDays(past, earlier), 0);
    });

    test("exactly 1 day → 1", () => {
        const a = new Date("2026-04-01T00:00:00Z");
        const b = new Date("2026-04-02T00:00:00Z");
        assert.equal(calculateInactiveDays(a, b), 1);
    });

    test("partial day rounds UP (ceil — extends at least one full day)", () => {
        // Customer subscription endDate must extend by *at least* one calendar
        // day if the program was off for any non-zero duration. ceil() gives
        // the customer-friendly rounding.
        const a = new Date("2026-04-01T00:00:00Z");
        const b = new Date("2026-04-01T01:00:00Z");
        assert.equal(calculateInactiveDays(a, b), 1);
    });

    test("multi-day span: 7 days exact", () => {
        const a = new Date("2026-04-01T00:00:00Z");
        const b = new Date("2026-04-08T00:00:00Z");
        assert.equal(calculateInactiveDays(a, b), 7);
    });

    test("partial 7+ days rounds to 8", () => {
        const a = new Date("2026-04-01T00:00:00Z");
        const b = new Date("2026-04-08T12:00:00Z");
        assert.equal(calculateInactiveDays(a, b), 8);
    });
});

// ── selectHighestQualifyingTier (auto-upgrade, docs §2, §4.5) ──────────────

describe("selectHighestQualifyingTier", () => {
    const tiers = [
        { id: 1, name: "Silver", minSpend: 500_000 },
        { id: 2, name: "Gold", minSpend: 2_000_000 },
        { id: 3, name: "Platinum", minSpend: 5_000_000 },
    ];

    test("totalSpend below the lowest threshold → null (no qualifying tier)", () => {
        assert.equal(selectHighestQualifyingTier(0, tiers), null);
        assert.equal(selectHighestQualifyingTier(499_999, tiers), null);
    });

    test("hits lowest tier exactly → Silver", () => {
        assert.equal(selectHighestQualifyingTier(500_000, tiers)?.id, 1);
    });

    test("between Silver and Gold → Silver (highest qualifying)", () => {
        assert.equal(selectHighestQualifyingTier(1_500_000, tiers)?.id, 1);
    });

    test("at Gold boundary → Gold", () => {
        assert.equal(selectHighestQualifyingTier(2_000_000, tiers)?.id, 2);
    });

    test("above Platinum → Platinum (highest)", () => {
        assert.equal(selectHighestQualifyingTier(10_000_000, tiers)?.id, 3);
    });

    test("works with unsorted input — sorts internally", () => {
        const shuffled = [tiers[2], tiers[0], tiers[1]];
        assert.equal(selectHighestQualifyingTier(2_000_000, shuffled)?.id, 2);
    });

    test("empty tier list → null", () => {
        assert.equal(selectHighestQualifyingTier(1_000_000, []), null);
    });

    test("accepts Decimal-as-string minSpend (Prisma payloads)", () => {
        const t = [{ id: 1, minSpend: "500000.00" }];
        assert.equal(selectHighestQualifyingTier(500_000, t)?.id, 1);
    });
});

// ── consumePointsFifo (redemption math, docs §2 "Points") ──────────────────

describe("consumePointsFifo", () => {
    test("zero or negative redemption → no deductions", () => {
        const batches = [{ id: 1, remainingPoints: 100 }];
        assert.deepEqual(consumePointsFifo(batches, 0), []);
        assert.deepEqual(consumePointsFifo(batches, -10), []);
    });

    test("drains a single batch exactly", () => {
        const result = consumePointsFifo([{ id: 1, remainingPoints: 100 }], 100);
        assert.deepEqual(result, [{ batchId: 1, deduct: 100, newRemaining: 0 }]);
    });

    test("partial drain leaves remainder in the same batch", () => {
        const result = consumePointsFifo([{ id: 1, remainingPoints: 100 }], 60);
        assert.deepEqual(result, [{ batchId: 1, deduct: 60, newRemaining: 40 }]);
    });

    test("spills into next batch when first is exhausted (FIFO)", () => {
        const batches = [
            { id: 1, remainingPoints: 50 }, // oldest
            { id: 2, remainingPoints: 200 },
        ];
        const result = consumePointsFifo(batches, 120);
        assert.deepEqual(result, [
            { batchId: 1, deduct: 50, newRemaining: 0 },
            { batchId: 2, deduct: 70, newRemaining: 130 },
        ]);
    });

    test("stops once redemption is satisfied — does not touch later batches", () => {
        const batches = [
            { id: 1, remainingPoints: 100 },
            { id: 2, remainingPoints: 200 }, // should not appear
            { id: 3, remainingPoints: 300 }, // should not appear
        ];
        const result = consumePointsFifo(batches, 50);
        assert.equal(result.length, 1);
        assert.equal(result[0].batchId, 1);
    });

    test("skips zero-remaining batches but counts subsequent batches", () => {
        const batches = [
            { id: 1, remainingPoints: 0 }, // drained earlier
            { id: 2, remainingPoints: 100 },
        ];
        const result = consumePointsFifo(batches, 50);
        assert.equal(result.length, 1);
        assert.equal(result[0].batchId, 2);
    });

    test("insufficient batches → throws InsufficientPointsError", () => {
        const batches = [{ id: 1, remainingPoints: 30 }];
        assert.throws(
            () => consumePointsFifo(batches, 100),
            (err: any) => err instanceof InsufficientPointsError,
        );
    });

    test("accepts Prisma Decimal-as-string remainingPoints", () => {
        const batches = [
            { id: 1, remainingPoints: "100.00" as any },
            { id: 2, remainingPoints: "50.00" as any },
        ];
        const result = consumePointsFifo(batches, 120);
        assert.equal(result.length, 2);
        assert.equal(result[1].newRemaining, 30);
    });

    test("does not mutate input batches (purity)", () => {
        const batches = [{ id: 1, remainingPoints: 100 }];
        consumePointsFifo(batches, 60);
        assert.equal(batches[0].remainingPoints, 100);
    });
});

// ── formatTransaction (transaction history shape, docs §4.4) ───────────────

describe("formatTransaction", () => {
    test("maps Prisma row to API response shape", () => {
        const created = new Date("2026-03-02T15:00:00.000Z");
        const txn = formatTransaction({
            id: 46,
            type: "EARN",
            points: 500,
            balanceAfter: 1500,
            salesId: null,
            description: "Welcome bonus",
            performedBy: "admin1",
            createdAt: created,
        });
        assert.deepEqual(txn, {
            id: 46,
            type: "EARN",
            points: 500,
            balanceAfter: 1500,
            salesId: null,
            description: "Welcome bonus",
            performedBy: "admin1",
            createdAt: "2026-03-02T15:00:00.000Z",
        });
    });

    test("Decimal-as-string points value coerced", () => {
        const txn = formatTransaction({
            id: 1,
            type: "ADJUST",
            points: "100.50",
            balanceAfter: "1000.00",
            createdAt: new Date("2026-03-02T15:00:00.000Z"),
        });
        assert.equal(txn.points, 100.5);
        assert.equal(txn.balanceAfter, 1000);
    });

    test("falls back to current ISO timestamp when createdAt missing (defensive)", () => {
        const before = Date.now();
        const txn = formatTransaction({ id: 1, type: "EARN", points: 100, balanceAfter: 100 });
        const parsed = Date.parse(txn.createdAt);
        assert.ok(parsed >= before);
    });
});
