// Unit tests for subscription-package.service pure helpers exposed via
// __testables. Pure functions backing docs/modules/LOYALTY.md §2
// (Subscription Packages), §4.6 (package types), §4.12 (checkout matching),
// §8.2 (timer pause/resume), §8.4 (snapshot is source of truth).

import "reflect-metadata";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "decimal.js";

import subscriptionService from "../subscription-package.service";

const {
    toDecimalNumber,
    calcSubscriptionEndDate,
    buildPackageSnapshot,
    isUsageQuotaExhausted,
    isSubscriptionTimedOut,
} = (subscriptionService as any).__testables;

// ── toDecimalNumber ────────────────────────────────────────────────────────

describe("subscription toDecimalNumber", () => {
    test("null/undefined → 0", () => {
        assert.equal(toDecimalNumber(null), 0);
        assert.equal(toDecimalNumber(undefined), 0);
    });

    test("Decimal-as-string parses", () => {
        assert.equal(toDecimalNumber("150000.00"), 150_000);
    });
});

// ── calcSubscriptionEndDate (docs §4.6 + §8.2) ─────────────────────────────

describe("calcSubscriptionEndDate", () => {
    const now = new Date("2026-04-01T00:00:00Z");

    test("TIME package with durationDays → endDate = now + durationDays", () => {
        const result = calcSubscriptionEndDate("TIME", 30, null, now);
        assert.equal(result?.toISOString(), "2026-05-01T00:00:00.000Z");
    });

    test("TIME package without durationDays → null (caller bug)", () => {
        const result = calcSubscriptionEndDate("TIME", null, 30, now);
        assert.equal(result, null);
    });

    test("USAGE package with validityDays → endDate = now + validityDays", () => {
        const result = calcSubscriptionEndDate("USAGE", null, 90, now);
        assert.equal(result?.toISOString(), "2026-06-30T00:00:00.000Z");
    });

    test("USAGE package WITHOUT validityDays → null (unlimited validity, docs §8.2)", () => {
        // Documented edge case: USAGE without validityDays has no expiry date
        // and is unaffected by program deactivation timer extensions.
        const result = calcSubscriptionEndDate("USAGE", null, null, now);
        assert.equal(result, null);
    });

    test("USAGE package: validityDays takes priority over durationDays", () => {
        // For a USAGE package, durationDays is irrelevant. validityDays wins.
        const result = calcSubscriptionEndDate("USAGE", 365, 90, now);
        assert.equal(result?.toISOString(), "2026-06-30T00:00:00.000Z");
    });

    test("unknown packageType → null (defensive)", () => {
        const result = calcSubscriptionEndDate("WEEKLY" as any, 7, 7, now);
        assert.equal(result, null);
    });
});

// ── buildPackageSnapshot (docs §8.4 snapshot is source of truth) ───────────

describe("buildPackageSnapshot", () => {
    const pkg = {
        id: 5,
        name: "10-Session Wash",
        packageType: "USAGE",
        price: "150000.00", // Prisma Decimal
        totalQuota: 10,
        quotaUnit: "sessions",
        durationDays: null,
        discountPercentage: null,
        discountAmount: null,
        categories: [
            { category: { id: 5, name: "Wash" } },
            { category: { id: 6, name: "Detail" } },
        ],
    };

    test("materializes Decimal price into plain number", () => {
        const snap = buildPackageSnapshot(pkg);
        assert.equal(snap.price, 150_000);
        assert.equal(typeof snap.price, "number");
    });

    test("flattens categories to {categoryId, categoryName} array", () => {
        const snap = buildPackageSnapshot(pkg);
        assert.deepEqual(snap.categories, [
            { categoryId: 5, categoryName: "Wash" },
            { categoryId: 6, categoryName: "Detail" },
        ]);
    });

    test("includes packageId, name, packageType, totalQuota, quotaUnit", () => {
        const snap = buildPackageSnapshot(pkg);
        assert.equal(snap.packageId, 5);
        assert.equal(snap.name, "10-Session Wash");
        assert.equal(snap.packageType, "USAGE");
        assert.equal(snap.totalQuota, 10);
        assert.equal(snap.quotaUnit, "sessions");
    });

    test("TIME-package fields (durationDays + discountPercentage) round-trip", () => {
        const timePkg = {
            ...pkg,
            packageType: "TIME",
            totalQuota: null,
            quotaUnit: null,
            durationDays: 30,
            discountPercentage: "10.00",
            discountAmount: null,
        };
        const snap = buildPackageSnapshot(timePkg);
        assert.equal(snap.packageType, "TIME");
        assert.equal(snap.durationDays, 30);
        assert.equal(snap.discountPercentage, 10);
        assert.equal(snap.discountAmount, null);
    });

    test("null discountPercentage/discountAmount stay null in snapshot", () => {
        const snap = buildPackageSnapshot(pkg);
        assert.equal(snap.discountPercentage, null);
        assert.equal(snap.discountAmount, null);
    });

    test("snapshot is independent of source — mutating source does not mutate snapshot", () => {
        // Docs §8.4: "packageSnapshot is the source of truth at checkout, not
        // the live package. Edits to the package don't retroactively affect
        // active subscriptions." Guard against accidental reference sharing.
        const source = { ...pkg, categories: [...pkg.categories] };
        const snap = buildPackageSnapshot(source);

        source.name = "Mutated After Snapshot";
        source.categories.push({ category: { id: 99, name: "Extra" } });

        assert.equal(snap.name, "10-Session Wash");
        assert.equal(snap.categories.length, 2);
    });

    test("empty categories → empty array", () => {
        const snap = buildPackageSnapshot({ ...pkg, categories: [] });
        assert.deepEqual(snap.categories, []);
    });
});

// ── isUsageQuotaExhausted ──────────────────────────────────────────────────

describe("isUsageQuotaExhausted", () => {
    test("USAGE: remainingQuota exactly equals quantityUsed → exhausted", () => {
        assert.equal(isUsageQuotaExhausted("USAGE", 1, 1), true);
    });

    test("USAGE: remainingQuota > quantityUsed → not exhausted", () => {
        assert.equal(isUsageQuotaExhausted("USAGE", 5, 1), false);
    });

    test("USAGE: remainingQuota less than quantityUsed → exhausted (overshoot)", () => {
        // Defensive: caller should reject before deducting, but if somehow
        // we get here, the predicate still flips status to EXPIRED.
        assert.equal(isUsageQuotaExhausted("USAGE", 0, 1), true);
    });

    test("USAGE: null remainingQuota → not exhausted (treat as missing data)", () => {
        // The pre-check in recordUsage rejects null first. This predicate
        // intentionally does not flip status on missing data — only on a
        // confirmed depletion.
        assert.equal(isUsageQuotaExhausted("USAGE", null, 1), false);
    });

    test("TIME package → never quota-exhausted (uses time instead)", () => {
        assert.equal(isUsageQuotaExhausted("TIME", 0, 1), false);
        assert.equal(isUsageQuotaExhausted("TIME", null, 1), false);
    });
});

// ── isSubscriptionTimedOut ─────────────────────────────────────────────────

describe("isSubscriptionTimedOut", () => {
    test("endDate in future → not timed out", () => {
        const future = new Date("2026-06-01T00:00:00Z");
        const now = new Date("2026-04-01T00:00:00Z");
        assert.equal(isSubscriptionTimedOut(future, now), false);
    });

    test("endDate in past → timed out", () => {
        const past = new Date("2026-03-01T00:00:00Z");
        const now = new Date("2026-04-01T00:00:00Z");
        assert.equal(isSubscriptionTimedOut(past, now), true);
    });

    test("null endDate (USAGE without validityDays) → never times out", () => {
        const now = new Date("2026-04-01T00:00:00Z");
        assert.equal(isSubscriptionTimedOut(null, now), false);
        assert.equal(isSubscriptionTimedOut(undefined, now), false);
    });

    test("endDate exactly equals now → not timed out (strict > check)", () => {
        // Boundary alignment with recordUsage's `now > endDate` check.
        const exact = new Date("2026-04-01T00:00:00Z");
        assert.equal(isSubscriptionTimedOut(exact, exact), false);
    });

    test("1 ms past endDate → timed out", () => {
        const exp = new Date("2026-04-01T00:00:00.000Z");
        const now = new Date("2026-04-01T00:00:00.001Z");
        assert.equal(isSubscriptionTimedOut(exp, now), true);
    });
});
