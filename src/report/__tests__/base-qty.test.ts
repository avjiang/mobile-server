// Item rankings in base units (wholesale Phase 1r): Σ quantity × coalesce(unitFactor, 1).
//
// Run with:  npx tsx --test src/report/__tests__/base-qty.test.ts

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Decimal } from 'decimal.js';

import { baseQty, mergeByBaseQty, rankBy } from '../base-qty';

const KEYS = ['itemId', 'itemName', 'itemCode', 'itemBrand'] as const;
const row = (itemId: number, quantity: number, unitFactor: number | null, extra: Record<string, number> = {}) => ({
    itemId, itemName: `Item ${itemId}`, itemCode: `C${itemId}`, itemBrand: '',
    unitFactor: unitFactor === null ? null : new Decimal(unitFactor),
    _sum: { quantity: new Decimal(quantity), subtotalAmount: new Decimal(extra.subtotalAmount ?? 0), ...(extra.profit !== undefined ? { profit: new Decimal(extra.profit) } : {}) },
});

describe('baseQty', () => {
    test('2 Dus isi 40 = 80 pcs', () => assert.equal(baseQty(2, 40).toNumber(), 80));
    test('no unit → factor 1', () => {
        assert.equal(baseQty(3, null).toNumber(), 3);
        assert.equal(baseQty('2.5', undefined).toNumber(), 2.5);
    });
    test('a zero / negative factor never zeroes the line', () => assert.equal(baseQty(4, 0).toNumber(), 4));
});

describe('mergeByBaseQty + rankBy', () => {
    test('"2 Dus" outranks 50 single pcs (80 > 50)', () => {
        const rows = [row(1, 50, null), row(2, 2, 40)];
        const ranked = rankBy(mergeByBaseQty(rows, KEYS), 'quantity', 'desc', 10);
        assert.deepEqual(ranked.map(r => [r.itemId, r._sum.quantity!.toNumber()]), [[2, 80], [1, 50]]);
    });

    test('Dus + Pcs rows of one item merge into one row in pcs; revenue and profit add up', () => {
        const rows = [
            row(3, 5, null, { subtotalAmount: 17500, profit: 2500 }),
            row(3, 1, 40, { subtotalAmount: 128000, profit: 8000 }),
        ];
        const [m] = mergeByBaseQty(rows, KEYS);
        assert.equal(m._sum.quantity!.toNumber(), 45);
        assert.equal(m._sum.subtotalAmount!.toNumber(), 145500);
        assert.equal(m._sum.profit!.toNumber(), 10500);
        assert.equal(m.itemName, 'Item 3');
        assert.equal((m as any).unitFactor, undefined);
    });

    test('lines without units (laundry, pre-feature) rank exactly as before', () => {
        const rows = [row(1, 4, null), row(2, 9, null), row(3, 6, null)];
        const ranked = rankBy(mergeByBaseQty(rows, KEYS), 'quantity', 'desc', 10);
        assert.deepEqual(ranked.map(r => r.itemId), [2, 3, 1]);
        assert.deepEqual(ranked.map(r => r._sum.quantity!.toNumber()), [9, 6, 4]);
    });

    test('rank by profit asc (most loss) and take', () => {
        const rows = [row(1, 1, null, { profit: -100 }), row(2, 1, null, { profit: -900 }), row(3, 1, null, { profit: -50 })];
        const ranked = rankBy(mergeByBaseQty(rows, KEYS), 'profit', 'asc', 2);
        assert.deepEqual(ranked.map(r => r.itemId), [2, 1]);
    });

    test('ties keep input order', () => {
        const rows = [row(5, 2, null), row(6, 2, null)];
        assert.deepEqual(rankBy(mergeByBaseQty(rows, KEYS), 'quantity', 'desc', 10).map(r => r.itemId), [5, 6]);
    });

    test('a renamed item (different itemName) stays a separate row, as the old groupBy did', () => {
        const a = row(7, 1, null);
        const b = { ...row(7, 1, 10), itemName: 'Renamed' };
        assert.equal(mergeByBaseQty([a, b], KEYS).length, 2);
    });
});
