// `priceMix` block (wholesale Phase 1r): Grosir / Ecer / Harga diubah split of the
// report's sales lines, reconciling with the line revenue.
//
// Run with:  npx tsx --test src/report/__tests__/price-mix-report.test.ts

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Decimal } from 'decimal.js';

import {
    buildPriceMixReport,
    emptyPriceMix,
    loadPriceMixReport,
    priceMixGroupOf,
    PriceMixLineRow,
} from '../price-mix-report';

let nextSale = 1;
const line = (over: Partial<PriceMixLineRow>): PriceMixLineRow => ({
    salesId: over.salesId ?? nextSale++,
    itemId: 1,
    itemVariantId: null,
    itemUnitId: null,
    priceSource: null,
    priceLevelId: null,
    subtotalAmount: 0,
    profit: 0,
    ...over,
});

describe('priceMixGroupOf — D8 labels', () => {
    test('UNIT, TIER and LEVEL are Grosir', () => {
        for (const s of ['UNIT', 'TIER', 'LEVEL', 'unit']) assert.equal(priceMixGroupOf(s), 'grosir');
    });
    test('MANUAL is Harga diubah', () => assert.equal(priceMixGroupOf('MANUAL'), 'manual'));
    test('BASE, null (sold before the feature) and unknown values are Ecer', () => {
        for (const s of ['BASE', null, undefined, '', 'XYZ']) assert.equal(priceMixGroupOf(s as any), 'ecer');
    });
});

describe('buildPriceMixReport', () => {
    test('groups revenue, profit and line count; the groups sum to the line revenue', () => {
        const lines = [
            line({ priceSource: 'UNIT', itemUnitId: 7, subtotalAmount: 256000, profit: 32000 }), // 2 Dus
            line({ priceSource: 'TIER', subtotalAmount: 114000, profit: 14000 }),
            line({ priceSource: 'BASE', subtotalAmount: 7000, profit: 2000 }),
            line({ priceSource: null, subtotalAmount: 3500, profit: 1000 }), // pre-feature line
            line({ priceSource: 'MANUAL', subtotalAmount: 8000, profit: -500 }),
        ];
        const r = buildPriceMixReport(lines);
        assert.deepEqual(r.grosir, { revenue: 370000, profit: 46000, lineCount: 2 });
        assert.deepEqual(r.ecer, { revenue: 10500, profit: 3000, lineCount: 2 });
        assert.deepEqual(r.manual, { revenue: 8000, profit: -500, lineCount: 1 });
        // Reconciliation: groups = report line revenue / profit / count.
        const lineRevenue = lines.reduce((a, l) => a.plus(String(l.subtotalAmount)), new Decimal(0)).toNumber();
        assert.equal(r.totalRevenue, lineRevenue);
        assert.equal(r.grosir.revenue + r.ecer.revenue + r.manual.revenue, r.totalRevenue);
        assert.equal(r.grosir.profit + r.ecer.profit + r.manual.profit, r.totalProfit);
        assert.equal(r.grosir.lineCount + r.ecer.lineCount + r.manual.lineCount, r.lineCount);
        assert.deepEqual(r.byLevel, []);
    });

    test('a piece line split over several FIFO receipt rows counts as one line', () => {
        const r = buildPriceMixReport([
            line({ salesId: 900, itemId: 3, priceSource: 'BASE', subtotalAmount: 2000, profit: 500 }),
            line({ salesId: 900, itemId: 3, priceSource: 'BASE', subtotalAmount: 1000, profit: 200 }),
        ]);
        assert.deepEqual(r.ecer, { revenue: 3000, profit: 700, lineCount: 1 });
        assert.equal(r.lineCount, 1);
    });

    test('the same item as Dus and Pcs in one sale is two lines', () => {
        const r = buildPriceMixReport([
            line({ salesId: 901, itemId: 3, itemUnitId: 7, priceSource: 'UNIT', subtotalAmount: 128000 }),
            line({ salesId: 901, itemId: 3, priceSource: 'BASE', subtotalAmount: 3500 }),
        ]);
        assert.equal(r.grosir.lineCount, 1);
        assert.equal(r.ecer.lineCount, 1);
        assert.equal(r.lineCount, 2);
    });

    test('byLevel splits Grosir lines that carry a price level, by name, richest first', () => {
        const names = new Map([[1, 'Grosir'], [2, 'Reseller']]);
        const r = buildPriceMixReport([
            line({ priceSource: 'LEVEL', priceLevelId: 2, subtotalAmount: 50000, profit: 5000 }),
            line({ priceSource: 'LEVEL', priceLevelId: 1, subtotalAmount: 90000, profit: 9000 }),
            line({ priceSource: 'LEVEL', priceLevelId: 1, subtotalAmount: 10000, profit: 1000 }),
            line({ priceSource: 'LEVEL', priceLevelId: 5, subtotalAmount: 1000, profit: 100 }), // deleted, unnamed
            line({ priceSource: 'MANUAL', priceLevelId: 1, subtotalAmount: 7000 }), // not grosir
            line({ priceSource: 'TIER', subtotalAmount: 4000 }), // grosir, no level
        ], names);
        assert.deepEqual(r.byLevel.map(l => [l.name, l.revenue, l.lineCount]), [
            ['Grosir', 100000, 2], ['Reseller', 50000, 1], ['#5', 1000, 1],
        ]);
        assert.equal(r.grosir.revenue, 155000);
    });

    test('Decimal-like strings sum exactly', () => {
        const d = (n: string) => ({ toString: () => n });
        const r = buildPriceMixReport([
            line({ priceSource: 'BASE', subtotalAmount: d('0.1'), profit: d('0.1') }),
            line({ priceSource: 'BASE', subtotalAmount: d('0.2'), profit: d('0.2') }),
        ]);
        assert.equal(r.ecer.revenue, 0.3);
    });

    test('no lines → the empty block', () => {
        assert.deepEqual(buildPriceMixReport([]), emptyPriceMix());
    });
});

describe('loadPriceMixReport', () => {
    test('reads the lines of the revenue filter; skips the level query when no line has a level', async () => {
        const calls: any[] = [];
        let levelReads = 0;
        const prisma: any = {
            salesItem: { findMany: async (args: any) => { calls.push(args); return [line({ priceSource: 'UNIT', subtotalAmount: 10 })]; } },
            priceLevel: { findMany: async () => { levelReads++; return []; } },
        };
        const r = await loadPriceMixReport(prisma, { completedSessionId: 9, status: 'Completed', deleted: false });
        assert.equal(r.grosir.revenue, 10);
        assert.equal(levelReads, 0);
        assert.deepEqual(calls[0].where, { sales: { completedSessionId: 9, status: 'Completed', deleted: false }, deleted: false });
    });

    test('resolves level names (deleted levels included)', async () => {
        let levelArgs: any;
        const prisma: any = {
            salesItem: { findMany: async () => [line({ priceSource: 'LEVEL', priceLevelId: 4, subtotalAmount: 10 })] },
            priceLevel: { findMany: async (args: any) => { levelArgs = args; return [{ id: 4, name: 'Grosir' }]; } },
        };
        const r = await loadPriceMixReport(prisma, { outletId: 1 });
        assert.deepEqual(levelArgs.where, { id: { in: [4] } });
        assert.equal(r.byLevel[0].name, 'Grosir');
    });

    test('no lines → empty block, no level query', async () => {
        const prisma: any = { salesItem: { findMany: async () => [] }, priceLevel: { findMany: async () => { throw new Error('no'); } } };
        assert.deepEqual(await loadPriceMixReport(prisma, {}), emptyPriceMix());
    });
});
