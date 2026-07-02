// Unit tests for the requirePermission middleware. No real HTTP, no DB —
// pure logic verification with hand-rolled fakes plus an injected resolver.
//
// The middleware now resolves permissions LIVE from the DB (via
// permission-cache.getEffectivePermissions) instead of reading them off the
// JWT, falling back to the JWT-stamped list only if the live resolve throws.
// requirePermission takes an injectable resolver (default = the real cached
// one) so these tests drive every path without a database.
//
// Run with:  npm test

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { requirePermission } from "../require-permission.middleware";
import { AuthenticationError } from "../../api-helpers/error";

// ── Fakes ────────────────────────────────────────────────────────────────

/**
 * Build a fake AuthRequest. `tokenPermissions` is what the JWT carried (the
 * fallback list); the live-resolved set is supplied per-test via the injected
 * resolver. `null` → unauthenticated.
 */
function fakeReq(tokenPermissions?: string[] | null): any {
    if (tokenPermissions === null) {
        return { user: undefined }; // not authenticated
    }
    return {
        user: {
            userId: 1,
            username: "cashier",
            databaseName: "tenant_db",
            permissions: tokenPermissions ?? [],
        },
    };
}

/** Captures whether next() was called and with what (if anything). */
function fakeNext() {
    const calls: any[] = [];
    const next = (err?: any) => {
        calls.push(err);
    };
    return { next, calls };
}

/** A resolver that returns a fixed live-resolved set and counts its calls. */
function resolverReturning(permissions: string[]) {
    let calls = 0;
    const resolve = async () => {
        calls += 1;
        return permissions;
    };
    return { resolve, calls: () => calls };
}

/** A resolver that always throws, forcing the JWT fallback path. */
const resolverThrows = async (): Promise<string[]> => {
    throw new Error("DB unreachable");
};

// ── Tests ─────────────────────────────────────────────────────────────────

describe("requirePermission (live-resolve)", () => {
    test("calls next() with no error when the live-resolved set grants it", async () => {
        const mw = requirePermission("Add Client", resolverReturning(["Add Client", "Edit Client"]).resolve);
        const { next, calls } = fakeNext();

        await mw(fakeReq([]), {} as any, next);

        assert.equal(calls.length, 1);
        assert.equal(calls[0], undefined); // passed through
    });

    test("rejects with 403 when the live-resolved set is missing it", async () => {
        const mw = requirePermission("Delete Client", resolverReturning(["Add Client"]).resolve);
        const { next, calls } = fakeNext();

        await mw(fakeReq([]), {} as any, next);

        assert.equal(calls.length, 1);
        assert.ok(calls[0] instanceof AuthenticationError);
        assert.equal(calls[0].statusCode, 403);
        assert.match(calls[0].message, /Delete Client/);
    });

    test("wildcard '*' from the live resolve bypasses every check", async () => {
        const mw = requirePermission("Manage Roles", resolverReturning(["*"]).resolve);
        const { next, calls } = fakeNext();

        await mw(fakeReq([]), {} as any, next);

        assert.equal(calls[0], undefined);
    });

    test("LIVE result wins over a stale token — token has it, live does not → 403", async () => {
        // The whole point: a revoked permission still in the JWT must be rejected
        // because the live resolve (now empty) is authoritative.
        const mw = requirePermission("Override Stock Source", resolverReturning([]).resolve);
        const { next, calls } = fakeNext();

        await mw(fakeReq(["Override Stock Source"]), {} as any, next);

        assert.ok(calls[0] instanceof AuthenticationError);
        assert.equal(calls[0].statusCode, 403);
    });

    test("LIVE result wins over a stale token — token lacks it, live grants → next()", async () => {
        // The freshly granted permission isn't in the old JWT yet, but the live
        // resolve sees it → allowed without a re-login.
        const mw = requirePermission("Override Stock Source", resolverReturning(["Override Stock Source"]).resolve);
        const { next, calls } = fakeNext();

        await mw(fakeReq([]), {} as any, next);

        assert.equal(calls[0], undefined);
    });

    test("match is exact / case-sensitive", async () => {
        const mw = requirePermission("Add Client", resolverReturning(["add client"]).resolve);
        const { next, calls } = fakeNext();

        await mw(fakeReq([]), {} as any, next);

        assert.ok(calls[0] instanceof AuthenticationError);
        assert.equal(calls[0].statusCode, 403);
    });

    test("rejects with 401 when there is no authenticated user — resolver not consulted", async () => {
        const r = resolverReturning([]);
        const mw = requirePermission("Manage Users", r.resolve);
        const { next, calls } = fakeNext();

        await mw(fakeReq(null), {} as any, next);

        assert.ok(calls[0] instanceof AuthenticationError);
        assert.equal(calls[0].statusCode, 401);
        assert.equal(r.calls(), 0);
    });

    describe("JWT fallback when the live resolve fails", () => {
        test("falls back to the token-stamped permissions and grants", async () => {
            const mw = requirePermission("Add Client", resolverThrows);
            const { next, calls } = fakeNext();

            await mw(fakeReq(["Add Client"]), {} as any, next);

            assert.equal(calls[0], undefined); // fallback allowed it
        });

        test("falls back to the token and still rejects when it lacks the permission", async () => {
            const mw = requirePermission("Delete Client", resolverThrows);
            const { next, calls } = fakeNext();

            await mw(fakeReq(["Add Client"]), {} as any, next);

            assert.ok(calls[0] instanceof AuthenticationError);
            assert.equal(calls[0].statusCode, 403);
        });

        test("fallback honours the token wildcard", async () => {
            const mw = requirePermission("Manage Roles", resolverThrows);
            const { next, calls } = fakeNext();

            await mw(fakeReq(["*"]), {} as any, next);

            assert.equal(calls[0], undefined);
        });

        test("token without a permissions field falls back to deny (403)", async () => {
            const mw = requirePermission("Manage Users", resolverThrows);
            const { next, calls } = fakeNext();

            await mw({ user: { userId: 1, username: "x", databaseName: "d" } } as any, {} as any, next);

            assert.ok(calls[0] instanceof AuthenticationError);
            assert.equal(calls[0].statusCode, 403);
        });
    });
});
