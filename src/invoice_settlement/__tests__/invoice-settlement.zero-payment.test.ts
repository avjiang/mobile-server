// Unit tests for the initial-payment rule of a new invoice settlement, backing
// docs/modules/PROCUREMENT.md (Invoice Settlement).
//
// Regression cover for the production report on tenant audio_technic_db
// (2026-09-29): invoice 9645373156 (#1209, Rp 23,663,996) was fully offset by a
// supplier cash back entered as the rebate, so the settlement owed Rp 0 — and
// both the app and this service refused it ("Payment amount must be greater
// than zero"), leaving the invoice impossible to settle.

import "reflect-metadata";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "decimal.js";

import settlementService from "../invoice_settlement.service";

const { resolveInitialPayment } = (settlementService as any).__testables;

describe("resolveInitialPayment — fully offset settlement (the reported bug)", () => {
    test("settlement 0 with paid 0 settles with no cash", () => {
        const r = resolveInitialPayment(new Decimal(0), 0);
        assert.equal(r.isZeroSettlement, true);
        assert.equal(r.paidAmountDec.toFixed(4), "0.0000");
    });

    test("settlement 0 with paid omitted defaults to 0 and settles", () => {
        const r = resolveInitialPayment(new Decimal(0), undefined);
        assert.equal(r.isZeroSettlement, true);
    });
});

describe("resolveInitialPayment — settlements with a balance are unchanged", () => {
    test("paid 0 on a positive settlement is still refused", () => {
        assert.throws(() => resolveInitialPayment(new Decimal(23663996), 0), /greater than zero/);
    });

    test("a negative payment is refused, even on a zero settlement", () => {
        assert.throws(() => resolveInitialPayment(new Decimal(0), -1), /greater than zero/);
    });

    test("paying more than the settlement is refused", () => {
        assert.throws(() => resolveInitialPayment(new Decimal(0), 1), /cannot exceed/);
        assert.throws(() => resolveInitialPayment(new Decimal(100), 101), /cannot exceed/);
    });

    test("full and partial payments pass and are not zero settlements", () => {
        const full = resolveInitialPayment(new Decimal(8500), undefined);
        assert.equal(full.paidAmountDec.toFixed(0), "8500");
        assert.equal(full.isZeroSettlement, false);
        const partial = resolveInitialPayment(new Decimal(8500), 3000);
        assert.equal(partial.paidAmountDec.toFixed(0), "3000");
        assert.equal(partial.isZeroSettlement, false);
    });
});
