// Unit tests for the requirePermission middleware. No real HTTP, no DB —
// pure logic verification with hand-rolled fakes, matching the style of
// idempotency-middleware.test.ts.
//
// Run with:  npm test

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { requirePermission } from "../require-permission.middleware";
import { AuthenticationError } from "../../api-helpers/error";

// ── Fakes ────────────────────────────────────────────────────────────────

function fakeReq(permissions?: string[] | null): any {
    if (permissions === undefined) {
        return { user: { userId: 1, permissions: [] } };
    }
    if (permissions === null) {
        return { user: undefined }; // not authenticated
    }
    return { user: { userId: 1, permissions } };
}

/** Captures whether next() was called and with what (if anything). */
function fakeNext() {
    const calls: any[] = [];
    const next = (err?: any) => {
        calls.push(err);
    };
    return { next, calls };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("requirePermission", () => {
    test("calls next() with no error when the exact permission is granted", () => {
        const mw = requirePermission("Add Client");
        const { next, calls } = fakeNext();

        mw(fakeReq(["Add Client", "Edit Client"]), {} as any, next);

        assert.equal(calls.length, 1);
        assert.equal(calls[0], undefined); // passed through
    });

    test("rejects with 403 when the permission is missing", () => {
        const mw = requirePermission("Delete Client");
        const { next, calls } = fakeNext();

        mw(fakeReq(["Add Client"]), {} as any, next);

        assert.equal(calls.length, 1);
        assert.ok(calls[0] instanceof AuthenticationError);
        assert.equal(calls[0].statusCode, 403);
        assert.match(calls[0].message, /Delete Client/);
    });

    test("wildcard '*' (super admin / god account) bypasses every check", () => {
        const mw = requirePermission("Manage Roles");
        const { next, calls } = fakeNext();

        mw(fakeReq(["*"]), {} as any, next);

        assert.equal(calls[0], undefined);
    });

    test("rejects with 401 when there is no authenticated user", () => {
        const mw = requirePermission("Manage Users");
        const { next, calls } = fakeNext();

        mw(fakeReq(null), {} as any, next);

        assert.ok(calls[0] instanceof AuthenticationError);
        assert.equal(calls[0].statusCode, 401);
    });

    test("rejects with 403 when permissions array is absent on the user", () => {
        const mw = requirePermission("Manage Users");
        const { next, calls } = fakeNext();

        // Token issued before the permissions rollout — no `permissions` field.
        mw({ user: { userId: 1 } } as any, {} as any, next);

        assert.ok(calls[0] instanceof AuthenticationError);
        assert.equal(calls[0].statusCode, 403);
    });

    test("permission match is exact / case-sensitive (mirrors JWT contents)", () => {
        const mw = requirePermission("Add Client");
        const { next, calls } = fakeNext();

        // The JWT stores the seed's exact casing; a different case must NOT match.
        mw(fakeReq(["add client"]), {} as any, next);

        assert.ok(calls[0] instanceof AuthenticationError);
        assert.equal(calls[0].statusCode, 403);
    });
});
