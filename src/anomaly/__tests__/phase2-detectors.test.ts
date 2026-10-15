import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    detectAfterHours, detectCashShortage, detectRepeatedShortage, detectSupplierPriceRise, detectVoidRateOutlier,
} from '../rules';
import { expectedCash } from '../rules/cash-shortage';
import { isOpenHour, wibClock } from '../rules/after-hours';

const actor = { userId: 7, username: 'andi' };

// ── CASH_SHORTAGE ──

test('expected cash = opening float + cash taken − cash expenses', () => {
    assert.equal(expectedCash({ openingAmount: 200_000, cashPayments: [50_000, 25_000], cashExpenses: [10_000] }).toNumber(), 265_000);
});

test('cash short: over the limit alerts per session, at or under is quiet', () => {
    const f = (declared: number) => detectCashShortage({
        actor, outletId: 1, siteId: 2, sessionId: 40, expected: 500_000, declared, params: { minShortage: 50_000 },
    });
    assert.equal(f(450_000), null);
    const found = f(420_000)!;
    assert.equal(found.amount!.toNumber(), 80_000);
    assert.equal(found.dedupKey, 'CASH_SHORTAGE|40');
    assert.equal(f(600_000), null, 'over is not short');
});

// ── AFTER_HOURS ──

test('opening window: normal and wrapping midnight; open == close means always open', () => {
    assert.equal(isOpenHour(6, 7, 22), false);
    assert.equal(isOpenHour(7, 7, 22), true);
    assert.equal(isOpenHour(22, 7, 22), false);
    assert.equal(isOpenHour(23, 18, 2), true);
    assert.equal(isOpenHour(1, 18, 2), true);
    assert.equal(isOpenHour(3, 18, 2), false);
    assert.equal(isOpenHour(3, 0, 0), true);
});

test('WIB clock of a UTC instant', () => {
    assert.deepEqual(wibClock(new Date('2026-10-14T16:35:00Z')), { hour: 23, text: '23.35' });
});

test('after hours: a 23:35 sale alerts once a day per person, accumulating', () => {
    const at = new Date('2026-10-14T16:35:00Z'); // 23:35 WIB
    const f = detectAfterHours({ actor, outletId: 1, siteId: null, at, what: 'sale', documentId: 91, params: { openHour: 7, closeHour: 22 } })!;
    assert.equal(f.dedupKey, 'AFTER_HOURS|7|2026-10-14');
    assert.equal(f.accumulate, true);
    assert.equal(f.detail.time, '23.35');
    assert.equal(detectAfterHours({ actor, outletId: 1, siteId: null, at: new Date('2026-10-14T05:00:00Z'), what: 'stock', documentId: 3, params: { openHour: 7, closeHour: 22 } }), null);
});

// ── SUPPLIER_PRICE_RISE ──

const priceRise = (lines: { name: string; unitPrice: number; quantity: number; baseline: number | null }[]) => detectSupplierPriceRise({
    actor, outletId: 1, siteId: null, deliveryOrderId: 36, document: 'SJ-902', supplier: 'PT Sumber', lines,
    params: { minPercent: 10, minRupiah: 500 },
});

test('supplier price: both the percent and the rupiah bar must be passed', () => {
    assert.equal(priceRise([{ name: 'Gula', unitPrice: 10_900, quantity: 10, baseline: 10_000 }]), null, '9 %');
    assert.equal(priceRise([{ name: 'Permen', unitPrice: 150, quantity: 10, baseline: 100 }]), null, '50 % but Rp 50');
    const f = priceRise([{ name: 'Gula', unitPrice: 11_500, quantity: 10, baseline: 10_000 }])!;
    assert.equal(f.severity, 'INFO');
    assert.equal(f.amount!.toNumber(), 15_000);
    assert.equal(f.detail.percent, 15);
});

test('supplier price: twice the percent is a WARNING; lines without a baseline are skipped', () => {
    const f = priceRise([
        { name: 'Gula', unitPrice: 12_500, quantity: 2, baseline: 10_000 },
        { name: 'Teh', unitPrice: 9_000, quantity: 1, baseline: null },
    ])!;
    assert.equal(f.severity, 'WARNING');
    assert.equal(f.count, 1);
    assert.equal(f.dedupKey, 'SUPPLIER_PRICE_RISE|36');
});

// ── VOID_RATE_OUTLIER ──

const outlier = (o: Partial<{ userSales: number; userReversals: number; othersSales: number; othersReversals: number }>) => detectVoidRateOutlier({
    userId: 7, username: 'andi', outletId: 1, week: '2026-10-12',
    userSales: o.userSales ?? 40, userReversals: o.userReversals ?? 6, othersSales: o.othersSales ?? 200, othersReversals: o.othersReversals ?? 4,
    params: { multiple: 3, minReversals: 3 },
});

test('void rate: 15 % vs 2 % alerts; under 3× does not', () => {
    const f = outlier({})!;
    assert.equal(f.detail.rate, 15);
    assert.equal(f.detail.othersRate, 2);
    assert.equal(outlier({ othersReversals: 20 }), null, '15 % vs 10 %');
});

test('void rate: too few reversals, or too few sales by the others, is quiet', () => {
    assert.equal(outlier({ userReversals: 2 }), null);
    assert.equal(outlier({ othersSales: 9 }), null);
});

test('void rate: others with no reversals at all — any cashier over the minimum stands out', () => {
    assert.notEqual(outlier({ othersReversals: 0 }), null);
});

// ── REPEATED_SHORTAGE ──

test('repeated shortage: 3 small shortages in a week alert; overs do not count', () => {
    const shortages = [
        { sessionId: 1, amount: 5_000 }, { sessionId: 2, amount: -2_000 }, { sessionId: 3, amount: 7_000 }, { sessionId: 4, amount: 3_000 },
    ];
    const f = detectRepeatedShortage({ userId: 7, username: 'andi', outletId: 1, week: '2026-10-12', shortages, params: { minCount: 3 } })!;
    assert.equal(f.count, 3);
    assert.equal(f.amount!.toNumber(), 15_000);
    assert.deepEqual(f.documentIds, [1, 3, 4]);
    assert.equal(detectRepeatedShortage({ userId: 7, username: 'andi', outletId: 1, week: 'w', shortages: shortages.slice(0, 3), params: { minCount: 3 } }), null);
});
