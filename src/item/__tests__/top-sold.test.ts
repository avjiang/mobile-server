// Home "Top 5 items": revenue after the line's manual discount (Σ SUBTOTAL_AMOUNT,
// the reports' per-item revenue), ranked by units as before.
//
// Run with:  npx tsx --test src/item/__tests__/top-sold.test.ts

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "decimal.js";

import { buildTopSoldItems, rankTopSoldByBaseQty } from "../top-sold";

const item = (id: number, price: number, stock = 10) => ({
    id, itemName: `Item ${id}`, price: new Decimal(price), stockBalance: [{ availableQuantity: new Decimal(stock) }],
});

describe("buildTopSoldItems — revenue net of the line discount", () => {
    test("web_bytes sale #43: line 97.500 with a 10% line discount contributes 87.750", () => {
        // PRICE 97500, DISCOUNT_AMOUNT 9750 → SUBTOTAL_AMOUNT 87750.
        const rows = [{ itemId: 7, _sum: { quantity: new Decimal(15), subtotalAmount: new Decimal(87750) } }];
        const [r] = buildTopSoldItems(rows, [item(7, 6500)]);
        assert.equal(r.totalRevenue, 87750);
        assert.equal(r.quantitySold, 15);
    });

    test("revenue is what was sold, not catalogue price × units", () => {
        // Catalogue says 10.000 but the till sold 3 units for 25.000 after discount.
        const rows = [{ itemId: 1, _sum: { quantity: 3, subtotalAmount: 25000 } }];
        const [r] = buildTopSoldItems(rows, [item(1, 10000)]);
        assert.equal(r.totalRevenue, 25000);
    });

    test("keeps the server's units ranking order and the stock quantity", () => {
        const rows = [
            { itemId: 2, _sum: { quantity: 9, subtotalAmount: 9000 } },
            { itemId: 1, _sum: { quantity: 4, subtotalAmount: 40000 } },
        ];
        const out = buildTopSoldItems(rows, [item(1, 10000, 3), item(2, 1000, 5)]);
        assert.deepEqual(out.map(r => r.item.id), [2, 1]);
        assert.equal(out[0].item.stockQuantity.toString(), "5");
    });

    test("an item no longer in the catalogue is dropped", () => {
        const rows = [{ itemId: 99, _sum: { quantity: 1, subtotalAmount: 1 } }];
        assert.equal(buildTopSoldItems(rows, [item(1, 1)]).length, 0);
    });

    test("null sums read as 0", () => {
        const rows = [{ itemId: 1, _sum: { quantity: null, subtotalAmount: null } }];
        const [r] = buildTopSoldItems(rows, [{ id: 1 }]);
        assert.equal(r.totalRevenue, 0);
        assert.equal(r.quantitySold, 0);
        assert.equal(r.item.stockQuantity, 0);
    });
});

describe("rankTopSoldByBaseQty — Home top 5 in base units", () => {
    test('"2 Dus" (isi 40) counts as 80 pcs and outranks 50 single pcs', () => {
        const rows = [
            { itemId: 1, unitFactor: null, _sum: { quantity: 50, subtotalAmount: 175000 } },
            { itemId: 2, unitFactor: new Decimal(40), _sum: { quantity: 2, subtotalAmount: 256000 } },
        ];
        const ranked = rankTopSoldByBaseQty(rows, 5);
        assert.deepEqual(ranked.map(r => r.itemId), [2, 1]);
        const out = buildTopSoldItems(ranked, [item(1, 3500), item(2, 3500)]);
        assert.equal(out[0].quantitySold, 80);
        assert.equal(out[0].totalRevenue, 256000);
    });

    test("an item sold by Dus and by Pcs is one row: 1 Dus + 5 Pcs = 45", () => {
        const rows = [
            { itemId: 3, unitFactor: new Decimal(40), _sum: { quantity: 1, subtotalAmount: 128000 } },
            { itemId: 3, unitFactor: null, _sum: { quantity: 5, subtotalAmount: 17500 } },
        ];
        const [r] = rankTopSoldByBaseQty(rows, 5);
        assert.equal(Number(r._sum.quantity!.toString()), 45);
        assert.equal(Number(r._sum.subtotalAmount!.toString()), 145500);
    });

    test("no units (laundry / pre-feature): same order as Σ quantity, top 5 only", () => {
        const rows = [3, 9, 1, 7, 5, 8].map((q, i) => ({ itemId: i + 1, unitFactor: null, _sum: { quantity: q, subtotalAmount: 0 } }));
        assert.deepEqual(rankTopSoldByBaseQty(rows, 5).map(r => r.itemId), [2, 6, 4, 5, 1]);
    });
});
