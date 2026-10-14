// Wholesale pricing audit on sales lines — stored as sent, never rejects.
// Run with:  npx tsx --test src/sales/__tests__/price-audit.test.ts

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { pricingAuditOf } from "../price-audit";

describe("pricingAuditOf", () => {
    test("a carton line sold at a level price keeps all six fields", () => {
        const a = pricingAuditOf({
            priceSource: "LEVEL", listPrice: 120000, priceLevelId: 3, itemUnitId: 7, unitName: "Dus", unitFactor: 40,
        });
        assert.equal(a.priceSource, "LEVEL");
        assert.equal(a.listPrice!.toString(), "120000");
        assert.equal(a.priceLevelId, 3);
        assert.equal(a.itemUnitId, 7);
        assert.equal(a.unitName, "Dus");
        assert.equal(a.unitFactor!.toString(), "40");
    });

    test("a line from an older app (no fields) stores nulls = Ecer", () => {
        assert.deepEqual(pricingAuditOf({}), {
            priceSource: null, listPrice: null, priceLevelId: null, itemUnitId: null, unitName: null, unitFactor: null,
        });
    });

    test("each source is accepted, case-insensitively; junk becomes null instead of failing the sale", () => {
        for (const s of ["BASE", "UNIT", "TIER", "LEVEL", "MANUAL"]) assert.equal(pricingAuditOf({ priceSource: s }).priceSource, s);
        assert.equal(pricingAuditOf({ priceSource: " manual " }).priceSource, "MANUAL");
        assert.equal(pricingAuditOf({ priceSource: "PROMO" }).priceSource, null);
        assert.equal(pricingAuditOf({ listPrice: "abc" }).listPrice, null);
        assert.equal(pricingAuditOf({ listPrice: -1 }).listPrice, null);
        assert.equal(pricingAuditOf({ listPrice: 0 }).listPrice!.toString(), "0", "a free item has list price 0");
        assert.equal(pricingAuditOf({ unitFactor: 0 }).unitFactor, null);
        assert.equal(pricingAuditOf({ priceLevelId: 1.5 }).priceLevelId, null);
        assert.equal(pricingAuditOf({ unitName: "x".repeat(40) }).unitName!.length, 32);
    });
});
