// Unit tests for the PO down-payment draw-rate write guard backing
// docs/modules/PROCUREMENT.md (PO down payment).
//
// Background: a PO edit that submits `downPaymentPercentage: null` used to NULL the
// column unconditionally. With an advance already recorded, that strands the money —
// every subsequent invoice draws min(0% x total, balance) = 0. A frontend-only guard
// shipped 2026-07-06; the same tenant (audio_technic_db) hit it again on 2026-08-15,
// so the rule now lives server-side where no client build can bypass it.
//
// The clear is deliberately a separate guarded statement rather than a read-then-write,
// so a concurrent addDownPayment cannot race between the check and the write.

import "reflect-metadata";
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import purchaseOrderService from "../purchase-order.service";

const { resolveDownPaymentPercentageUpdate, clearDownPaymentPercentageIfUnused } =
    (purchaseOrderService as any).__testables;

describe("resolveDownPaymentPercentageUpdate — main update statement", () => {
    test("undefined leaves the column untouched", () => {
        assert.equal(resolveDownPaymentPercentageUpdate(undefined), undefined);
    });

    test("null ALSO leaves it untouched here — clearing is the guarded statement's job", () => {
        // If this ever returned null, the main update would strand advances again.
        assert.equal(resolveDownPaymentPercentageUpdate(null), undefined);
    });

    test("a number is written", () => {
        assert.equal(resolveDownPaymentPercentageUpdate(30)?.toFixed(0), "30");
    });

    test("a fractional rate keeps precision", () => {
        assert.equal(resolveDownPaymentPercentageUpdate(12.5)?.toFixed(1), "12.5");
    });

    test("zero is written as-is (an explicit 0% is the caller's choice)", () => {
        assert.equal(resolveDownPaymentPercentageUpdate(0)?.toFixed(0), "0");
    });
});

describe("clearDownPaymentPercentageIfUnused — the guard", () => {
    /** Minimal tx double that records the updateMany it receives. */
    const txSpy = (count: number) => {
        const calls: any[] = [];
        return {
            calls,
            tx: {
                purchaseOrder: {
                    updateMany: async (args: any) => {
                        calls.push(args);
                        return { count };
                    },
                },
            },
        };
    };

    test("guards on the advance inside the WHERE, not a prior read", async () => {
        // This is the whole point: check and write must be one atomic statement.
        const { tx, calls } = txSpy(1);
        await clearDownPaymentPercentageIfUnused(tx, 1182);

        assert.equal(calls.length, 1);
        assert.deepEqual(calls[0].where, { id: 1182, downPaymentAmount: { lte: 0 } });
        assert.deepEqual(calls[0].data, { downPaymentPercentage: null });
    });

    test("reports 1 when the row had no advance and was cleared", async () => {
        const { tx } = txSpy(1);
        assert.equal(await clearDownPaymentPercentageIfUnused(tx, 1182), 1);
    });

    test("reports 0 when the advance blocked the clear", async () => {
        // The prod failure mode: PO 1182 held 17,715,600, so the rate must survive.
        const { tx } = txSpy(0);
        assert.equal(await clearDownPaymentPercentageIfUnused(tx, 1182), 0);
    });

    test("never writes anything other than the rate", async () => {
        const { tx, calls } = txSpy(1);
        await clearDownPaymentPercentageIfUnused(tx, 7);
        assert.deepEqual(Object.keys(calls[0].data), ["downPaymentPercentage"]);
    });
});
