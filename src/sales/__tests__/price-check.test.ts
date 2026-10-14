// Wholesale price check (Phase 4): the TS port of the FE resolver, driven by the
// SAME table of cases as the Dart tests, plus the log-only check around it.
// Run with:  npx tsx --test src/sales/__tests__/price-check.test.ts

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
    checkSaleLinePrices,
    findPriceMismatches,
    hasCheckableLine,
    PriceBook,
    PriceCheckContext,
    PriceTierRow,
    resolvePrice,
} from "../price-check";

interface SharedCase {
    name: string;
    tiers?: PriceTierRow[];
    qty: number;
    priceLevelId: number | null;
    unitId: number | null;
    variantId: number | null;
    basePrice: number;
    price: number;
    source: string;
    tierId: number | null;
}

const shared: { tiers: PriceTierRow[]; cases: SharedCase[] } = JSON.parse(
    readFileSync(join(__dirname, "wholesale-price-cases.json"), "utf8"),
);

describe("resolvePrice — shared table with the Dart resolver", () => {
    assert.ok(shared.cases.length >= 15, "the shared table is loaded");
    for (const c of shared.cases) {
        test(c.name, () => {
            const r = resolvePrice({
                basePrice: c.basePrice,
                baseIsUnit: c.unitId != null,
                unitId: c.unitId,
                variantId: c.variantId,
                qty: c.qty,
                priceLevelId: c.priceLevelId,
                tiers: c.tiers ?? shared.tiers,
            });
            assert.equal(r.price.toNumber(), c.price);
            assert.equal(r.source, c.source);
            assert.equal(r.tierId, c.tierId);
        });
    }
});

// Indomie: Rp 3.500 a piece, 12+ → 3.300 (tier 1), Grosir level (5) 3.250 (tier 3);
// Dus isi 40 (unit 9) Rp 128.000, 10+ dus → 120.000 (tier 5); variant 7 at 3.600.
const book = (over: Partial<PriceBook> = {}): PriceBook => ({
    items: new Map([[1, { price: 3500, isOpenPrice: false }], [2, { price: 9000, isOpenPrice: true }]]),
    variants: new Map([[7, { itemId: 1, price: 3600 }]]),
    units: new Map([[9, { itemId: 1, price: 128000 }]]),
    tiers: new Map([
        [1, [
            { id: 1, price: 3300, minQuantity: 12 },
            { id: 3, price: 3250, minQuantity: 1, priceLevelId: 5 },
            { id: 5, price: 120000, minQuantity: 10, itemUnitId: 9 },
        ]],
        [2, [{ id: 8, price: 1000, minQuantity: 1 }]],
    ]),
    customerPriceLevelId: null,
    ...over,
});

describe("findPriceMismatches", () => {
    test("lines priced by the same rule pass", () => {
        const lines = [
            { itemId: 1, quantity: 3, price: 3500, priceSource: "BASE" },
            { itemId: 1, quantity: 12, price: 3300, priceSource: "TIER" },
            { itemId: 1, quantity: 2, price: 128000, priceSource: "UNIT", itemUnitId: 9 },
            { itemId: 1, quantity: 10, price: 120000, priceSource: "TIER", itemUnitId: 9 },
            { itemId: 1, quantity: 1, price: 3600, priceSource: "BASE", itemVariantId: 7 },
        ];
        assert.deepEqual(findPriceMismatches(lines, book()), []);
    });

    test("Rp 1 rounding is tolerated, more is reported", () => {
        assert.equal(findPriceMismatches([{ itemId: 1, quantity: 1, price: 3501, priceSource: "BASE" }], book()).length, 0);
        const [m] = findPriceMismatches([{ itemId: 1, quantity: 12, price: 3500, priceSource: "BASE" }], book());
        assert.equal(m.expectedPrice, "3300");
        assert.equal(m.expectedSource, "TIER");
        assert.equal(m.sentSource, "BASE");
        assert.equal(m.line, 1);
    });

    test("the level comes from the server's customer, not the line", () => {
        const line = { itemId: 1, quantity: 1, price: 3250, priceSource: "LEVEL", priceLevelId: 5 };
        assert.equal(findPriceMismatches([line], book({ customerPriceLevelId: 5 })).length, 0);
        // The customer was moved back to ecer after the device last synced.
        const [m] = findPriceMismatches([line], book({ customerPriceLevelId: null }));
        assert.equal(m.expectedPrice, "3500");
    });

    test("MANUAL lines and lines without a source are never checked", () => {
        const lines = [
            { itemId: 1, quantity: 1, price: 1000, priceSource: "MANUAL" },
            { itemId: 1, quantity: 1, price: 1000 },
            { itemId: 1, quantity: 1, price: 1000, priceSource: "PROMO" },
        ];
        assert.deepEqual(findPriceMismatches(lines, book()), []);
        assert.equal(hasCheckableLine(lines), false);
    });

    test("open-price items ignore tiers, like the FE", () => {
        assert.equal(findPriceMismatches([{ itemId: 2, quantity: 5, price: 9000, priceSource: "BASE" }], book()).length, 0);
    });

    test("unknown item, unknown unit or a unit of another item: nothing to compare", () => {
        const lines = [
            { itemId: 99, quantity: 1, price: 1, priceSource: "BASE" },
            { itemId: 1, quantity: 1, price: 1, priceSource: "UNIT", itemUnitId: 77 },
            { itemId: 2, quantity: 1, price: 1, priceSource: "UNIT", itemUnitId: 9 },
        ];
        assert.deepEqual(findPriceMismatches(lines, book()), []);
    });
});

describe("checkSaleLinePrices — log-only", () => {
    const NOW = new Date("2026-10-15T08:00:00.000Z");
    const ctx = (over: Partial<PriceCheckContext> = {}): PriceCheckContext => ({
        databaseName: "grosir_retail_db",
        username: "kasir",
        planName: "Retail Basic",
        isLitePlan: (p) => (p ?? "").includes("Lite"),
        saleRef: "ref-1",
        now: NOW,
        ...over,
    });
    const fresh = new Date(NOW.getTime() - 60_000).toISOString();
    const stale = { itemId: 1, quantity: 12, price: 3500, priceSource: "BASE" };

    test("a mismatch is logged and the sale goes through", async () => {
        const warnings: string[] = [];
        const out = await checkSaleLinePrices(
            { clientCreatedAt: fresh, customerId: 4, salesItems: [stale] },
            ctx(),
            { loadBook: async (q) => { assert.deepEqual(q, { itemIds: [1], variantIds: [], unitIds: [], customerId: 4 }); return book(); }, warn: (l) => warnings.push(l) },
        );
        assert.equal(out.action, "checked");
        assert.equal(warnings.length, 1);
        assert.match(warnings[0], /\[price-check\].*item=1 qty=12 sent=3500\(BASE\) expected=3300\(TIER tier=1\)/);
    });

    test("late (offline-outbox) sales are skipped without touching the DB", async () => {
        const out = await checkSaleLinePrices(
            { clientCreatedAt: new Date(NOW.getTime() - 30 * 60_000).toISOString(), salesItems: [stale] },
            ctx(),
            { loadBook: async () => assert.fail("must not load"), warn: () => assert.fail("must not warn") },
        );
        assert.deepEqual(out, { action: "skipped", reason: "late-sale" });
    });

    test("Retail Lite and sales without resolver lines are skipped without IO", async () => {
        const deps = { loadBook: async (): Promise<PriceBook> => assert.fail("must not load") };
        assert.deepEqual(
            await checkSaleLinePrices({ clientCreatedAt: fresh, salesItems: [stale] }, ctx({ planName: "Retail Lite" }), deps),
            { action: "skipped", reason: "lite-plan" },
        );
        assert.deepEqual(
            await checkSaleLinePrices({ clientCreatedAt: fresh, salesItems: [{ itemId: 1, quantity: 1, price: 1 }] }, ctx(), deps),
            { action: "skipped", reason: "no-checkable-line" },
        );
    });

    test("a DB error never fails the sale", async () => {
        const warnings: string[] = [];
        const out = await checkSaleLinePrices(
            { clientCreatedAt: fresh, salesItems: [stale] },
            ctx(),
            { loadBook: async () => { throw new Error("connection lost"); }, warn: (l) => warnings.push(l) },
        );
        assert.deepEqual(out, { action: "skipped", reason: "error" });
        assert.match(warnings[0], /skipped \(error\).*connection lost/);
    });
});
