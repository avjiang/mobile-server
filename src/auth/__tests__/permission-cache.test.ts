// Unit tests for the permission cache. No DB: getEffectivePermissions takes an
// injectable resolver, so these tests drive caching/TTL/invalidation behavior
// with a counting fake resolver and node:test's mocked Date clock.
//
// Run with:  npm test

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
    getEffectivePermissions,
    invalidatePermissions,
    clearPermissionCache,
} from "../permission-cache";

const TTL_MS = 5 * 60 * 1000; // must match permission-cache.ts

/** A resolver that records its calls and returns a configurable list. */
function countingResolver(value: string[]) {
    let calls = 0;
    const resolver = async () => {
        calls += 1;
        return value;
    };
    return { resolver, calls: () => calls };
}

describe("permission-cache", () => {
    beforeEach(() => clearPermissionCache());

    test("a miss resolves and a subsequent hit is served from cache", async () => {
        const { resolver, calls } = countingResolver(["Add Client"]);

        const first = await getEffectivePermissions("db1", 1, "u", resolver);
        const second = await getEffectivePermissions("db1", 1, "u", resolver);

        assert.deepEqual(first, ["Add Client"]);
        assert.deepEqual(second, ["Add Client"]);
        assert.equal(calls(), 1); // second call did NOT hit the resolver
    });

    test("cache is keyed per (db, userId) — different users resolve independently", async () => {
        const a = countingResolver(["A"]);
        const b = countingResolver(["B"]);

        const ra = await getEffectivePermissions("db1", 1, "u", a.resolver);
        const rb = await getEffectivePermissions("db1", 2, "u", b.resolver);

        assert.deepEqual(ra, ["A"]);
        assert.deepEqual(rb, ["B"]);
        assert.equal(a.calls(), 1);
        assert.equal(b.calls(), 1);
    });

    test("invalidatePermissions flushes a whole tenant, leaving other tenants cached", async () => {
        const t1 = countingResolver(["T1"]);
        const t2 = countingResolver(["T2"]);

        await getEffectivePermissions("db1", 1, "u", t1.resolver);
        await getEffectivePermissions("db2", 1, "u", t2.resolver);

        invalidatePermissions("db1");

        await getEffectivePermissions("db1", 1, "u", t1.resolver); // re-resolves
        await getEffectivePermissions("db2", 1, "u", t2.resolver); // still cached

        assert.equal(t1.calls(), 2);
        assert.equal(t2.calls(), 1);
    });

    test("entries expire after the TTL and re-resolve", async (t) => {
        t.mock.timers.enable({ apis: ["Date"] });
        const { resolver, calls } = countingResolver(["X"]);

        await getEffectivePermissions("db1", 1, "u", resolver); // cached at t=0
        t.mock.timers.tick(TTL_MS - 1);
        await getEffectivePermissions("db1", 1, "u", resolver); // still fresh
        assert.equal(calls(), 1);

        t.mock.timers.tick(2); // now past expiry
        await getEffectivePermissions("db1", 1, "u", resolver); // re-resolves
        assert.equal(calls(), 2);
    });

    test("clearPermissionCache drops everything", async () => {
        const { resolver, calls } = countingResolver(["X"]);

        await getEffectivePermissions("db1", 1, "u", resolver);
        clearPermissionCache();
        await getEffectivePermissions("db1", 1, "u", resolver);

        assert.equal(calls(), 2);
    });
});
