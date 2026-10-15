import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Decimal } from 'decimal.js';
import {
    detectBelowCost, detectLargeDiscount, detectLargeStockWriteOff, detectQuickReversal, detectReversalBurst,
} from '../rules';

const actor = { userId: 7, username: 'andi' };

// ── REVERSAL_BURST ──

const burst = (n: number, maxPerDay = 1) => detectReversalBurst({
    actor, outletId: 1, siteId: 2, wibDay: '2026-10-15', params: { maxPerDay },
    reversalsToday: Array.from({ length: n }, (_, i) => ({ salesId: 100 + i, amount: 10_000, kind: 'void' as const })),
});

test('burst: at the limit is quiet, one over alerts and pushes', () => {
    assert.equal(burst(1), null);
    const f = burst(2)!;
    assert.equal(f.count, 2);
    assert.equal(f.notify, true);
    assert.equal(f.escalation, false);
    assert.equal(f.dedupKey, 'REVERSAL_BURST|7|2026-10-15');
    assert.deepEqual(f.documentIds, [100, 101]);
    assert.equal(f.amount!.toNumber(), 20_000);
});

test('burst: no push between the first crossing and the escalation, one at twice', () => {
    assert.equal(burst(3)!.notify, false);
    const fourth = burst(4)!;
    assert.equal(fourth.notify, true);
    assert.equal(fourth.escalation, true);
    assert.equal(burst(5)!.notify, false);
});

test('burst: a higher limit moves both points', () => {
    assert.equal(burst(3, 3), null);
    assert.equal(burst(4, 3)!.notify, true);
    assert.equal(burst(8, 3)!.escalation, true);
});

test('burst: counts kinds', () => {
    const f = detectReversalBurst({
        actor, outletId: 1, siteId: null, wibDay: 'd', params: { maxPerDay: 1 },
        reversalsToday: [{ salesId: 1, amount: 1, kind: 'void' }, { salesId: 2, amount: 1, kind: 'refund' }],
    })!;
    assert.deepEqual(f.detail.kinds, { void: 1, return: 0, refund: 1 });
});

// ── QUICK_REVERSAL ──

const paidAt = new Date('2026-10-15T03:00:00Z');
const quick = (o: { minutesLater: number; method?: string; rungBy?: number | null; within?: number }) => detectQuickReversal({
    actor, kind: 'void', reversedAt: new Date(paidAt.getTime() + o.minutesLater * 60_000),
    sale: {
        id: 55, friendlyNumber: null, outletId: 1, siteId: 3, performedByUserId: o.rungBy === undefined ? 7 : o.rungBy,
        totalAmount: 85_000, createdAt: paidAt, payments: [{ method: o.method ?? 'Cash', createdAt: paidAt }],
    },
    params: { withinMinutes: o.within ?? 15 },
});

test('quick: a cash sale voided by its cashier inside the window alerts', () => {
    const f = quick({ minutesLater: 4 })!;
    assert.equal(f.detail.minutes, 4);
    assert.equal(f.dedupKey, 'QUICK_REVERSAL|55');
    assert.equal(f.notify, true);
});

test('quick: the window end is exclusive', () => {
    assert.notEqual(quick({ minutesLater: 14.9 }), null);
    assert.equal(quick({ minutesLater: 15 }), null);
});

test('quick: card sales, other users and unknown cashiers are skipped', () => {
    assert.equal(quick({ minutesLater: 2, method: 'Card' }), null);
    assert.equal(quick({ minutesLater: 2, rungBy: 8 }), null);
    assert.equal(quick({ minutesLater: 2, rungBy: null }), null);
});

test('quick: "cash" matches regardless of case and spaces', () => {
    assert.notEqual(quick({ minutesLater: 2, method: ' cash ' }), null);
});

// ── LARGE_DISCOUNT ──

const discount = (gross: number, total: number, acceptedLate = false, maxPercent = 20) => detectLargeDiscount({
    actor, sale: { id: 9, friendlyNumber: '251015-1-004', outletId: 1, siteId: null },
    summary: { gross: new Decimal(gross), total: new Decimal(total) }, acceptedLate, params: { maxPercent },
});

test('discount: exactly the limit is fine, above alerts', () => {
    assert.equal(discount(100_000, 20_000), null);
    const f = discount(100_000, 25_000)!;
    assert.equal(f.detail.percent, '25');
    assert.equal(f.detail.sale, '251015-1-004');
});

test('discount: a late offline sale over the cap alerts even under the limit', () => {
    assert.notEqual(discount(100_000, 5_000, true), null);
});

test('discount: no manual discount never alerts', () => {
    assert.equal(discount(100_000, 0, true), null);
});

test('discount: one decimal when not whole', () => {
    assert.equal(discount(300_000, 70_000)!.detail.percent, '23.3');
});

// ── BELOW_COST ──

const line = (o: Partial<{ itemId: number; name: string; price: number; cost: number; discount: number }>) => ({
    itemId: o.itemId ?? 1, itemVariantId: null, itemName: o.name ?? 'Gula 1kg',
    price: o.price ?? 15_000, cost: o.cost ?? 12_000, discountAmount: o.discount ?? 0,
});

const below = (lines: ReturnType<typeof line>[], orderDiscount = 0) => detectBelowCost({
    actor, sale: { id: 12, outletId: 1, siteId: null, orderDiscount }, lines,
});

test('below cost: a profitable sale is quiet', () => {
    assert.equal(below([line({})]), null);
});

test('below cost: a line discount that sinks the price alerts', () => {
    const f = below([line({ discount: 4_000 })])!;
    assert.equal(f.amount!.toNumber(), 1_000);
    assert.deepEqual(f.detail.items, { id: 'Gula 1kg', en: 'Gula 1kg' });
});

test('below cost: the order discount is shared by net value', () => {
    // Two lines of 15.000 / cost 12.000; a 8.000 order discount = 4.000 each → 11.000 < 12.000.
    const f = below([line({ itemId: 1 }), line({ itemId: 2, name: 'Teh' })], 8_000)!;
    assert.equal(f.count, 2);
    assert.deepEqual(f.detail.items, { id: 'Gula 1kg dan 1 lainnya', en: 'Gula 1kg and 1 more' });
});

test('below cost: FIFO split lines of one item are summed', () => {
    // 2 rows of one item: price 10.000 + 10.000, cost 9.000 + 12.000 → 20.000 vs 21.000.
    const f = below([line({ price: 10_000, cost: 9_000 }), line({ price: 10_000, cost: 12_000 })])!;
    assert.equal(f.count, 1);
    assert.equal(f.amount!.toNumber(), 1_000);
});

test('below cost: zero cost and Rp 1 rounding are ignored', () => {
    assert.equal(below([line({ cost: 0, price: 1 })]), null);
    assert.equal(below([line({ price: 11_999, cost: 12_000 })]), null);
});

// ── LARGE_STOCK_WRITEOFF ──

const writeOff = (costs: number[], maxAmount = 250_000) => detectLargeStockWriteOff({
    actor, outletId: 1, siteId: null, requestKey: 'req-1', params: { maxAmount },
    entries: costs.map((c, i) => ({ itemId: i + 1, itemName: `Item ${i + 1}`, cost: c, reason: 'Rusak' })),
});

test('write-off: at the limit is quiet, over alerts, biggest line first', () => {
    assert.equal(writeOff([150_000, 100_000]), null);
    const f = writeOff([100_000, 200_000])!;
    assert.equal(f.amount!.toNumber(), 300_000);
    assert.equal((f.detail.lines as { name: string }[])[0].name, 'Item 2');
    assert.equal(f.dedupKey, 'LARGE_STOCK_WRITEOFF|req-1|1');
});
