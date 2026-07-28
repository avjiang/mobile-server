// Regression tests for the sale-reversal concurrency guard.
//
// Background: on 2026-07-26, sale #6068 (audio_technic_db) was returned twice.
// Two taps 197ms apart produced two requests with distinct idempotency keys;
// both read `status = "Completed"` before either committed, both passed the
// `if (sales.status !== "Completed")` check, and both restored stock — items
// 255 and 274 were each credited +1 twice. See docs/modules/SALES.md.
//
// The fix expresses the transition as a single conditional write
// (`updateMany` with the expected status in the WHERE), so exactly one
// concurrent caller can claim it. These tests pin that contract.
//
// Pure: the fake `tx` below models MySQL's conditional-update semantics
// (a row is matched only if it still satisfies the WHERE at write time).
// No DB, no Prisma.
//
// Run with:  npm test

import "reflect-metadata";
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import salesService from "../sales.service";
import { BusinessLogicError } from "../../api-helpers/error";

const { claimSalesReversal } = (salesService as any).__testables;

/**
 * Minimal stand-in for a Prisma transaction client over a single sale row.
 * `updateMany` applies the update only if the row currently satisfies every
 * predicate — which is precisely the atomicity the real UPDATE gives us.
 */
function makeTx(initial: { id: number; status: string; deleted?: boolean }) {
    const row = { deleted: false, ...initial };
    const calls: any[] = [];
    return {
        row,
        calls,
        sales: {
            updateMany: async ({ where, data }: any) => {
                calls.push({ where, data });
                const matches =
                    row.id === where.id &&
                    (where.deleted === undefined || row.deleted === where.deleted) &&
                    (where.status === undefined || row.status === where.status);
                if (!matches) return { count: 0 };
                Object.assign(row, data);
                return { count: 1 };
            },
            findUniqueOrThrow: async ({ where }: any) => {
                if (row.id !== where.id) throw new Error("not found");
                return { ...row };
            },
        },
    };
}

describe("claimSalesReversal", () => {
    test("claims a Completed sale and returns the updated row", async () => {
        const tx = makeTx({ id: 1, status: "Completed" });

        const result = await claimSalesReversal(tx, 1, "Returned", "nope");

        assert.equal(tx.row.status, "Returned");
        assert.equal(result.status, "Returned");
    });

    test("guards on status in the WHERE clause, not a prior read", async () => {
        const tx = makeTx({ id: 1, status: "Completed" });

        await claimSalesReversal(tx, 1, "Returned", "nope");

        // The predicate is what makes this safe — assert it explicitly so a
        // future refactor can't quietly drop it back to an unguarded update.
        assert.deepEqual(tx.calls[0].where, {
            id: 1,
            deleted: false,
            status: "Completed",
        });
    });

    test("THE REGRESSION: a second concurrent claim is rejected", async () => {
        const tx = makeTx({ id: 6068, status: "Completed" });

        // Both callers were admitted by the pre-check (each read the sale as
        // Completed before either wrote) — exactly the #6068 scenario.
        const first = await claimSalesReversal(tx, 6068, "Returned", "already returned");

        await assert.rejects(
            () => claimSalesReversal(tx, 6068, "Returned", "already returned"),
            (err: unknown) => {
                assert.ok(err instanceof BusinessLogicError);
                assert.match((err as Error).message, /already returned/);
                return true;
            }
        );

        assert.equal(first.status, "Returned");
        assert.equal(tx.row.status, "Returned", "status must not be written twice");
    });

    test("interleaved claims: only one of two racing callers wins", async () => {
        const tx = makeTx({ id: 2, status: "Completed" });

        const results = await Promise.allSettled([
            claimSalesReversal(tx, 2, "Voided", "already voided"),
            claimSalesReversal(tx, 2, "Voided", "already voided"),
        ]);

        const fulfilled = results.filter((r) => r.status === "fulfilled");
        const rejected = results.filter((r) => r.status === "rejected");
        assert.equal(fulfilled.length, 1, "exactly one caller may proceed to restore stock");
        assert.equal(rejected.length, 1);
    });

    test("rejects a sale that is already in a terminal state", async () => {
        const tx = makeTx({ id: 3, status: "Voided" });

        await assert.rejects(
            () => claimSalesReversal(tx, 3, "Refunded", "Only completed sales can be refunded"),
            BusinessLogicError
        );
        assert.equal(tx.row.status, "Voided", "terminal status must be left untouched");
    });

    test("rejects a soft-deleted sale", async () => {
        const tx = makeTx({ id: 4, status: "Completed", deleted: true });

        await assert.rejects(
            () => claimSalesReversal(tx, 4, "Returned", "Only completed sales can be returned"),
            BusinessLogicError
        );
        assert.equal(tx.row.status, "Completed");
    });

    test("carries the caller's message so each endpoint keeps its own wording", async () => {
        const tx = makeTx({ id: 5, status: "Cancelled" });

        await assert.rejects(
            () => claimSalesReversal(tx, 5, "Voided", "Only completed sales can be voided"),
            /Only completed sales can be voided/
        );
    });
});
