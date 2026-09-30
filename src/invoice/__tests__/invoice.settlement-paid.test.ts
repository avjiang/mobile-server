// GET /invoice/:id nests the invoice's settlement. The app's
// InvoiceSettlementDO.fromJson defaults a MISSING paidAmount to the whole
// settlementAmount, so a partially paid invoice read as fully paid until the
// app fetched the settlement separately. The nested select must carry the
// partial-payment fields.
//
// Run with:  npx tsx --test src/invoice/__tests__/invoice.settlement-paid.test.ts

import "reflect-metadata";
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import invoiceService from "../invoice.service";

const { invoiceSettlementDetailSelect } = (invoiceService as any).__testables;

describe("invoice getById — nested settlement carries what the app reads", () => {
    for (const field of ["paidAmount", "paymentStatus", "writeOffAmount", "transferFeeAmount"]) {
        test(`selects ${field}`, () => {
            assert.equal(invoiceSettlementDetailSelect[field], true);
        });
    }

    test("keeps the fields the invoice detail already showed", () => {
        for (const field of [
            "id", "settlementNumber", "settlementDate", "settlementType", "paymentMethod",
            "settlementAmount", "currency", "status", "totalRebateAmount", "deleted",
        ]) {
            assert.equal(invoiceSettlementDetailSelect[field], true, field);
        }
    });

    test("does not pull the payment ledger (the settlement endpoint owns it)", () => {
        assert.equal(invoiceSettlementDetailSelect.payments, undefined);
    });
});


// The list / sync reads (GET /invoice/sync, /dateRange, /getAllCompleted) nest
// the settlement too. They used to project only id/number/date/type/method/
// amount/currency/status, so the app parsed a partially paid invoice (800,000
// of 1,000,000) as fully paid. All three now go through fetchSettlementsById.
describe("invoice list / sync reads — nested settlement carries the paid fields", () => {
    const { fetchSettlementsById } = (invoiceService as any).__testables;

    const settlementRow = {
        id: 7, settlementNumber: "SET-7", settlementAmount: 1000000, status: "COMPLETED",
        paidAmount: 800000, paymentStatus: "PARTIAL", writeOffAmount: 0, transferFeeAmount: 0,
    };

    function fakeClient() {
        const calls: any[] = [];
        return {
            calls,
            invoiceSettlement: {
                findMany: async (args: any) => { calls.push(args); return [settlementRow]; },
            },
        };
    }

    test("batch fetch uses the shared detail select and keys by id", async () => {
        const client = fakeClient();
        const map = await fetchSettlementsById(client, [
            { invoiceSettlementId: 7 }, { invoiceSettlementId: 7 }, { invoiceSettlementId: null },
        ]);

        assert.equal(client.calls.length, 1);
        assert.equal(client.calls[0].select, invoiceSettlementDetailSelect);
        assert.deepEqual(client.calls[0].where, { id: { in: [7] }, deleted: false });
        const s = map.get(7);
        assert.equal(s.paidAmount, 800000);
        assert.equal(s.paymentStatus, "PARTIAL");
        assert.equal(s.settlementAmount, 1000000);
    });

    test("a page with no settled invoices skips the query", async () => {
        const client = fakeClient();
        const map = await fetchSettlementsById(client, [{ invoiceSettlementId: null }]);
        assert.equal(client.calls.length, 0);
        assert.equal(map.size, 0);
    });

    // getTenantPrisma is a non-configurable export under tsx, so the reads
    // themselves can't be driven with a fake client; guard the wiring instead.
    for (const read of ["getAll", "getByDateRange", "getCompleted"]) {
        test(`${read} nests settlements through fetchSettlementsById`, () => {
            const src = (invoiceService as any)[read].toString();
            assert.match(src, /fetchSettlementsById\(/);
            assert.doesNotMatch(src, /invoiceSettlement\.findMany\(/);
        });
    }
});
