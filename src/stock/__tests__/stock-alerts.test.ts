import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Decimal } from 'decimal.js';
import {
    buildStockAlertNotifications,
    classifyStockAlerts,
    mergeStockAlertRows,
    StockAlertRow,
} from '../stock-alerts';

const row = (o: Partial<StockAlertRow> & { prev: number; next: number; threshold?: number | null }): StockAlertRow => ({
    itemId: o.itemId ?? 34,
    itemVariantId: o.itemVariantId ?? null,
    itemName: o.itemName ?? 'Air Mineral 600ml',
    itemCode: o.itemCode ?? 'AM600',
    previousAvailable: new Decimal(o.prev),
    newAvailable: new Decimal(o.next),
    reorderThreshold: o.threshold === undefined || o.threshold === null ? null : new Decimal(o.threshold),
    quantity: new Decimal(o.prev - o.next),
});

// ── The crossing rule ──

test('crossing the reorder level is low stock', () => {
    const r = classifyStockAlerts([row({ prev: 12, next: 8, threshold: 10 })]);
    assert.equal(r.lowStock.length, 1);
    assert.equal(r.outOfStock.length, 0);
});

test('already below the reorder level does not alert again', () => {
    const r = classifyStockAlerts([row({ prev: 8, next: 5, threshold: 10 })]);
    assert.equal(r.lowStock.length, 0);
    assert.equal(r.outOfStock.length, 0);
});

test('landing exactly on the threshold alerts; starting on it does not', () => {
    assert.equal(classifyStockAlerts([row({ prev: 11, next: 10, threshold: 10 })]).lowStock.length, 1);
    assert.equal(classifyStockAlerts([row({ prev: 10, next: 9, threshold: 10 })]).lowStock.length, 0);
});

test('no threshold means no low-stock alert, but zero still alerts', () => {
    assert.equal(classifyStockAlerts([row({ prev: 5, next: 1, threshold: null })]).lowStock.length, 0);
    const r = classifyStockAlerts([row({ prev: 5, next: 0, threshold: null })]);
    assert.equal(r.outOfStock.length, 1);
    assert.equal(r.lowStock.length, 0);
});

test('going to zero is out of stock, not low stock', () => {
    const r = classifyStockAlerts([row({ prev: 12, next: 0, threshold: 10 })]);
    assert.equal(r.outOfStock.length, 1);
    assert.equal(r.lowStock.length, 0);
});

test('already at or below zero does not alert again', () => {
    const r = classifyStockAlerts([row({ prev: 0, next: -2, threshold: 10 }), row({ itemId: 2, prev: -1, next: -3 })]);
    assert.equal(r.outOfStock.length, 0);
    assert.equal(r.lowStock.length, 0);
});

test('increases are ignored', () => {
    const r = classifyStockAlerts([row({ prev: 5, next: 20, threshold: 10 }), row({ itemId: 2, prev: -1, next: 4 })]);
    assert.equal(r.outOfStock.length, 0);
    assert.equal(r.lowStock.length, 0);
});

test('duplicate rows for one item merge: first previous, last new', () => {
    // 12 → 11 (no crossing) then 11 → 9 (crosses 10): merged 12 → 9 alerts once.
    const merged = mergeStockAlertRows([
        row({ prev: 12, next: 11, threshold: 10 }),
        row({ prev: 11, next: 9, threshold: 10 }),
    ]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].previousAvailable.toNumber(), 12);
    assert.equal(merged[0].newAvailable.toNumber(), 9);
    assert.equal(merged[0].quantity.toNumber(), 3);
    assert.equal(classifyStockAlerts([
        row({ prev: 12, next: 11, threshold: 10 }),
        row({ prev: 11, next: 9, threshold: 10 }),
    ]).lowStock.length, 1);
});

test('variants of one item stay separate rows', () => {
    const merged = mergeStockAlertRows([
        row({ itemVariantId: 1, prev: 12, next: 9, threshold: 10 }),
        row({ itemVariantId: 2, prev: 12, next: 9, threshold: 10 }),
    ]);
    assert.equal(merged.length, 2);
});

// ── The payload builder ──

const base = { tenantId: 11, outletId: 1, triggeringUserId: 7, triggeringUsername: 'chs' };

test('a stock adjustment builds one low_stock push on the outlet inventory topic', () => {
    const out = buildStockAlertNotifications({
        ...base,
        source: 'stock_adjustment',
        rows: [row({ prev: 12, next: 8, threshold: 10 })],
    });
    assert.equal(out.length, 1);
    const [n] = out;
    assert.equal(n.topic, 'tenant_11_outlet_1_inventory');
    assert.equal(n.payload.data.type, 'low_stock');
    assert.equal(n.payload.data.priority, 'normal');
    assert.equal(n.payload.data.source, 'stock_adjustment');
    assert.equal(n.payload.data.count, 1);
    assert.equal(n.payload.data.outletId, 1);
    assert.equal(n.payload.data.tenantId, 11);
    assert.equal(n.payload.data.triggeringUserId, 7);
    assert.equal(n.payload.data.triggeringUsername, 'chs');
    assert.equal('salesId' in n.payload.data, false);
    assert.deepEqual(n.payload.data.items, [{
        itemId: 34,
        itemName: 'Air Mineral 600ml',
        itemCode: 'AM600',
        previousStock: 12,
        currentStock: 8,
        reorderThreshold: 10,
        quantity: 4,
    }]);
    assert.ok(n.payload.title.length > 0);
    assert.ok(n.payload.message.includes('Air Mineral 600ml'));
});

test('a sale keeps salesId and soldQuantity; out_of_stock and low_stock both go out', () => {
    const out = buildStockAlertNotifications({
        ...base,
        source: 'sale',
        salesId: 99,
        rows: [row({ prev: 3, next: 0, threshold: 10 }), row({ itemId: 2, itemName: 'Teh', prev: 12, next: 9, threshold: 10 })],
    });
    assert.deepEqual(out.map((n) => n.payload.data.type), ['out_of_stock', 'low_stock']);
    for (const n of out) {
        assert.equal(n.payload.data.salesId, 99);
        assert.equal(n.payload.data.source, 'sale');
    }
    assert.deepEqual(out[0].payload.data.items, [{
        itemId: 34, itemName: 'Air Mineral 600ml', itemCode: 'AM600',
        previousStock: 3, currentStock: 0, soldQuantity: 3,
    }]);
    assert.equal(out[0].payload.data.priority, 'high');
    assert.equal(out[1].payload.data.items[0].soldQuantity, 3);
    assert.equal('quantity' in out[1].payload.data.items[0], false);
});

test('salesId is never sent for a non-sale source, even if passed', () => {
    const [n] = buildStockAlertNotifications({
        ...base,
        source: 'stock_transfer',
        salesId: 5,
        rows: [row({ prev: 2, next: 0 })],
    });
    assert.equal('salesId' in n.payload.data, false);
    assert.equal(n.payload.data.source, 'stock_transfer');
    assert.equal(n.payload.data.items[0].quantity, 2);
});

test('nothing crossing builds nothing', () => {
    assert.deepEqual(buildStockAlertNotifications({
        ...base,
        source: 'purchase_return',
        rows: [row({ prev: 50, next: 40, threshold: 10 })],
    }), []);
});
