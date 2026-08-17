// Unit tests for the PO down-payment draw rule backing
// docs/modules/PROCUREMENT.md (PO down payment).
//
// Regression cover for the production incident on tenant audio_technic_db:
// PO 1182 (RSA-202607/07885) carried downPaymentAmount = 17,715,600 with
// downPaymentPercentage = NULL. Every invoice therefore drew 0, the invoice
// form rendered no down-payment row at all, and the user cancelled and
// re-created the invoice twice before escalating.

import "reflect-metadata";
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import invoiceService from "../invoice.service";

const { calcDownPaymentDraw } = (invoiceService as any).__testables;

const po = (percentage: any, amount: any, applied: any = 0) => ({
    downPaymentPercentage: percentage,
    downPaymentAmount: amount,
    downPaymentApplied: applied,
});

describe("calcDownPaymentDraw — the reported bug", () => {
    test("a null draw rate draws nothing even with a positive advance", () => {
        // The exact prod state of PO 1182 before the data fix.
        assert.equal(calcDownPaymentDraw(po(null, 17715600), 59052000).toFixed(4), "0.0000");
    });

    test("setting the rate to 30% draws the full advance", () => {
        // 59,052,000 x 30% = 17,715,600, which is exactly the balance.
        assert.equal(calcDownPaymentDraw(po(30, 17715600), 59052000).toFixed(4), "17715600.0000");
    });

    test("a zero draw rate draws nothing", () => {
        assert.equal(calcDownPaymentDraw(po(0, 17715600), 59052000).toFixed(4), "0.0000");
    });
});

describe("calcDownPaymentDraw — capping", () => {
    test("caps at the remaining balance when the rate would draw more", () => {
        // 30% of 59,052,000 = 17,715,600 but only 5,000,000 remains unapplied.
        assert.equal(
            calcDownPaymentDraw(po(30, 17715600, 12715600), 59052000).toFixed(4),
            "5000000.0000"
        );
    });

    test("caps at the rate when the balance is ample", () => {
        assert.equal(calcDownPaymentDraw(po(10, 50000000), 20000000).toFixed(4), "2000000.0000");
    });

    test("a fully drawn advance yields nothing further", () => {
        assert.equal(
            calcDownPaymentDraw(po(30, 17715600, 17715600), 59052000).toFixed(4),
            "0.0000"
        );
    });

    test("an over-applied balance never returns a negative draw", () => {
        assert.equal(calcDownPaymentDraw(po(30, 100, 500), 59052000).toFixed(4), "0.0000");
    });
});

describe("calcDownPaymentDraw — degenerate inputs", () => {
    test("a rate with no advance draws nothing", () => {
        // The inverse state, seen on prod PO 1179 (rate 30, amount 0).
        assert.equal(calcDownPaymentDraw(po(30, 0), 59052000).toFixed(4), "0.0000");
    });

    test("a missing PO draws nothing", () => {
        assert.equal(calcDownPaymentDraw(null, 59052000).toFixed(4), "0.0000");
    });

    test("a zero or null invoice total draws nothing", () => {
        assert.equal(calcDownPaymentDraw(po(30, 17715600), 0).toFixed(4), "0.0000");
        assert.equal(calcDownPaymentDraw(po(30, 17715600), null).toFixed(4), "0.0000");
    });

    test("Decimal-as-string values parse (Prisma returns Decimal, not number)", () => {
        assert.equal(
            calcDownPaymentDraw(po("30", "17715600", "0"), "59052000").toFixed(4),
            "17715600.0000"
        );
    });

    test("a fractional rate keeps precision", () => {
        // 12.5% of 1,000,000 = 125,000 — no float drift.
        assert.equal(calcDownPaymentDraw(po(12.5, 500000), 1000000).toFixed(4), "125000.0000");
    });
});
