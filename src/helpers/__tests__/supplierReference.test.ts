// Unit tests for the supplier-reference rules on delivery orders and invoices
// (docs/modules/PROCUREMENT.md — supplier reference).
//
// The `undefined` case is the one that protects live data: an app that predates
// the field sends no key on update, and that must leave the stored value alone.

import "reflect-metadata";
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { normaliseSupplierReference, SUPPLIER_REFERENCE_MAX_LENGTH } from "../supplierReference";
import { ErrorCode, RequestValidateError } from "../../api-helpers/error";

describe("normaliseSupplierReference", () => {
    test("a missing key stays undefined, so an update keeps the stored value", () => {
        assert.equal(normaliseSupplierReference(undefined), undefined);
    });

    test("null, empty and whitespace clear it", () => {
        assert.equal(normaliseSupplierReference(null), null);
        assert.equal(normaliseSupplierReference(""), null);
        assert.equal(normaliseSupplierReference("   "), null);
    });

    test("trims surrounding whitespace and keeps the inside as typed", () => {
        assert.equal(normaliseSupplierReference("  SJ/2026/10/0042 "), "SJ/2026/10/0042");
        assert.equal(normaliseSupplierReference("inv 77-a"), "inv 77-a");
    });

    test("a number is stored as its text", () => {
        assert.equal(normaliseSupplierReference(12345), "12345");
    });

    test("exactly the column length is accepted", () => {
        const max = "x".repeat(SUPPLIER_REFERENCE_MAX_LENGTH);
        assert.equal(normaliseSupplierReference(max), max);
        // Length is checked after trimming.
        assert.equal(normaliseSupplierReference(`  ${max}  `), max);
    });

    test("one over the column length is rejected with SUPPLIER_REFERENCE_TOO_LONG", () => {
        assert.throws(
            () => normaliseSupplierReference("x".repeat(SUPPLIER_REFERENCE_MAX_LENGTH + 1)),
            (e: any) => {
                assert.ok(e instanceof RequestValidateError);
                assert.equal(e.statusCode, 400);
                assert.equal(e.errorCode, ErrorCode.SupplierReferenceTooLong);
                assert.deepEqual(e.params, { max: String(SUPPLIER_REFERENCE_MAX_LENGTH) });
                return true;
            }
        );
    });
});
