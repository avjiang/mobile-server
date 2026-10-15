import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    AnomalyDeps, invalidateAnomalyConfig, onCashDeclared, onDeliveryReceived, onSaleCompleted, onStockAdjusted, systemContext,
} from '../anomaly.service';
import { runTenantNightly } from '../../cron/anomaly-daily.cron';

const dec = (n: number) => ({ toString: () => String(n) });

/** A hand-built tenant DB with the tables the Phase 2 hooks and the nightly job read. */
function fakeDb(o: {
    config?: { ruleId: string; enabled: boolean; params: object }[];
    sale?: any;
    session?: any;
    payments?: { method: string; paidAmount: number; status?: string }[];
    expenses?: { amount: number }[];
    order?: any;
    itemSuppliers?: { itemId: number; cost: number | null }[];
    previousPrice?: number | null;
    sales7d?: { outletId: number; performedByUserId: number; n: number }[];
    reversals7d?: { outletId: number; reversedByUserId: number; n: number }[];
    today?: { n: number; total: number; profit: number };
} = {}) {
    const events: any[] = [];
    let nextId = 1;
    return {
        events,
        anomalyRuleConfig: { findMany: async () => o.config ?? [] },
        anomalyEvent: {
            findUnique: async ({ where }: any) => events.find((e) => e.dedupKey === where.dedupKey) ?? null,
            findUniqueOrThrow: async ({ where }: any) => events.find((e) => e.dedupKey === where.dedupKey),
            create: async ({ data }: any) => { const row = { ...data, id: nextId++, createdAt: new Date() }; events.push(row); return row; },
            update: async ({ where, data }: any) => { const row = events.find((e) => e.id === where.id); Object.assign(row, data); return row; },
            count: async ({ where }: any) => events.filter((e) => !where.status || e.status === where.status).length,
        },
        sales: {
            findUnique: async () => o.sale ?? null,
            aggregate: async () => ({
                _count: { _all: o.today?.n ?? 0 },
                _sum: { totalAmount: dec(o.today?.total ?? 0), profitAmount: dec(o.today?.profit ?? 0) },
            }),
            groupBy: async ({ by }: any) => by.includes('performedByUserId')
                ? (o.sales7d ?? []).map((r) => ({ outletId: r.outletId, performedByUserId: r.performedByUserId, _count: { _all: r.n } }))
                : (o.reversals7d ?? []).map((r) => ({ outletId: r.outletId, reversedByUserId: r.reversedByUserId, _count: { _all: r.n } })),
        },
        session: { findUnique: async () => o.session ?? null },
        payment: {
            findMany: async () => (o.payments ?? [])
                .filter((p) => !['Voided', 'Returned', 'Refunded'].includes(p.status ?? 'Completed'))
                .map((p) => ({ method: p.method, paidAmount: dec(p.paidAmount) })),
        },
        expense: { findMany: async () => (o.expenses ?? []).map((e) => ({ amount: dec(e.amount) })) },
        declaration: { findMany: async () => [] },
        deliveryOrder: { findUnique: async () => o.order ?? null },
        deliveryOrderItem: { findFirst: async () => (o.previousPrice ? { unitPrice: dec(o.previousPrice) } : null) },
        itemSupplier: { findMany: async () => (o.itemSuppliers ?? []).map((s) => ({ itemId: s.itemId, cost: s.cost === null ? null : dec(s.cost) })) },
        supplier: { findUnique: async () => ({ companyName: 'PT Sumber Rejeki' }) },
        outlet: { findUnique: async () => ({ outletName: 'Cabang Utama' }) },
        item: { findMany: async () => [] },
        user: { findMany: async ({ where }: any) => where.id.in.map((id: number) => ({ id, username: `user${id}` })) },
    } as any;
}

function deps(db: any, now = '2026-10-14T16:35:00Z', perms: string[] = ['Process Sales']) {
    const pushes: any[] = [];
    const logs: string[] = [];
    const d: AnomalyDeps = {
        prisma: () => db,
        isPro: async () => true,
        permissions: async () => perms,
        push: async (topic, notification) => { pushes.push({ topic, notification }); },
        now: () => new Date(now),
        log: (m, e) => { logs.push(`${m} ${e ?? ''}`); },
    };
    return { d, pushes, logs };
}

let seq = 0;
const name = () => { const n = `p2_${++seq}`; invalidateAnomalyConfig(n); return n; };
const actor = { userId: 7, username: 'andi' };

test('cash count: the server computes what should be in the drawer', async () => {
    const db = fakeDb({
        session: { openingAmount: dec(200_000), outletId: 1, closedBySiteId: 2, siteId: 1 },
        payments: [{ method: 'Cash', paidAmount: 300_000 }, { method: 'Card', paidAmount: 90_000 }, { method: 'Cash', paidAmount: 40_000, status: 'Voided' }],
        expenses: [{ amount: 20_000 }],
    });
    const { d, pushes } = deps(db);
    await onCashDeclared({ databaseName: name(), tenantId: 11, actor, declarations: [{ sessionID: 9, paymentType: 'Cash', declarationAmount: 400_000 }] }, d);
    // expected 200.000 + 300.000 − 20.000 = 480.000; counted 400.000 → short 80.000
    assert.equal(db.events.length, 1);
    assert.equal(db.events[0].ruleId, 'CASH_SHORTAGE');
    assert.equal(pushes[0].notification.title, 'Kas andi kurang Rp 80.000');
    assert.equal(pushes[0].notification.message, 'Seharusnya Rp 480.000, dihitung Rp 400.000 · Cabang Utama');
});

test('cash count: non-cash declarations and a drawer within the limit stay quiet', async () => {
    const db = fakeDb({ session: { openingAmount: dec(0), outletId: 1, siteId: null }, payments: [{ method: 'Cash', paidAmount: 100_000 }] });
    const { d, pushes } = deps(db);
    await onCashDeclared({
        databaseName: name(), tenantId: 11, actor,
        declarations: [{ sessionID: 9, paymentType: 'Card', declarationAmount: 0 }, { sessionID: 9, paymentType: 'cash', declarationAmount: 60_000 }],
    }, d);
    assert.equal(pushes.length, 0);
});

test('after hours: off by default; on, a 23:35 sale pushes once and later ones add to it', async () => {
    const sale = { id: 31, friendlyNumber: null, outletId: 1, siteId: null, discountAmount: dec(0), salesItems: [] };
    const body = { clientCreatedAt: '2026-10-14T16:35:00Z', salesItems: [], discountAmount: 0 };
    const off = fakeDb({ sale });
    const r1 = deps(off);
    await onSaleCompleted({ databaseName: name(), tenantId: 11, actor, permissions: ['Process Sales'], saleId: 31, salesBody: body, discountDecision: { action: 'allow' } }, r1.d);
    assert.equal(off.events.length, 0, 'default off');

    const db = fakeDb({ sale, config: [{ ruleId: 'AFTER_HOURS', enabled: true, params: { openHour: 7, closeHour: 22 } }] });
    const { d, pushes } = deps(db);
    const tenantDb = name();
    await onSaleCompleted({ databaseName: tenantDb, tenantId: 11, actor, permissions: ['Process Sales'], saleId: 31, salesBody: body, discountDecision: { action: 'allow' } }, d);
    assert.equal(pushes.length, 1);
    assert.equal(pushes[0].notification.title, 'andi bertransaksi di luar jam buka (23.35)');
    assert.equal(pushes[0].notification.message, 'Penjualan · jam buka 7.00–22.00 · Cabang Utama');

    // A stock adjustment the same night: same event, no second push.
    await onStockAdjusted({ databaseName: tenantDb, tenantId: 11, actor, siteId: null, adjusted: [{ itemId: 5, outletId: 1 }], writeOffs: [] }, d);
    assert.equal(pushes.length, 1);
    assert.equal(db.events.length, 1);
    assert.equal(db.events[0].count, 2);
});

test('supplier price: the agreed price wins, else the previous delivery', async () => {
    const order = {
        id: 36, outletId: 1, siteId: null, supplierId: 4, trackingNumber: 'DO-2026-36', supplierReference: 'SJ-902', deleted: false,
        deliveryOrderItems: [
            { itemId: 1, itemVariantId: null, variantName: null, receivedQuantity: 10, unitPrice: dec(11_500), item: { itemName: 'Gula 1kg' } },
            { itemId: 2, itemVariantId: null, variantName: null, receivedQuantity: 5, unitPrice: dec(7_000), item: { itemName: 'Teh' } },
        ],
    };
    const db = fakeDb({ order, itemSuppliers: [{ itemId: 1, cost: 10_000 }], previousPrice: 6_000 });
    const { d, pushes } = deps(db);
    await onDeliveryReceived({ databaseName: name(), tenantId: 11, actor, deliveryOrderIds: [36] }, d);
    assert.equal(db.events.length, 1);
    assert.equal(db.events[0].count, 2, 'Gula vs agreed 10.000 (+15 %), Teh vs previous 6.000 (+17 %)');
    assert.equal(pushes[0].notification.title, 'Harga PT Sumber Rejeki naik untuk Gula 1kg dan 1 lainnya');
    assert.match(pushes[0].notification.message, /surat jalan SJ-902/);
});

test('nightly: only at the tenant\'s hour; report + void-rate outlier; owner never flagged', async () => {
    const atNine = '2026-10-15T14:05:00Z'; // 21:05 WIB
    const sales7d = [{ outletId: 1, performedByUserId: 7, n: 40 }, { outletId: 1, performedByUserId: 8, n: 200 }];
    const reversals7d = [{ outletId: 1, reversedByUserId: 7, n: 6 }, { outletId: 1, reversedByUserId: 8, n: 4 }];

    const early = fakeDb({ sales7d, reversals7d, today: { n: 63, total: 4_250_000, profit: 1_180_000 } });
    const e = deps(early, '2026-10-15T13:05:00Z'); // 20:05 WIB
    const ctxEarly = (await systemContext(e.d, name(), 11))!;
    assert.equal(await runTenantNightly(ctxEarly, new Date('2026-10-15T13:05:00Z')), false);
    assert.equal(e.pushes.length, 0);

    const db = fakeDb({ sales7d, reversals7d, today: { n: 63, total: 4_250_000, profit: 1_180_000 } });
    const { d, pushes } = deps(db, atNine);
    const ctx = (await systemContext(d, name(), 11))!;
    assert.equal(await runTenantNightly(ctx, new Date(atNine)), true);
    assert.equal(db.events.length, 1);
    assert.equal(db.events[0].ruleId, 'VOID_RATE_OUTLIER');
    assert.equal(pushes.length, 2);
    assert.equal(pushes[0].notification.title, 'user7 paling sering membatalkan minggu ini');
    const report = pushes[1].notification;
    assert.equal(report.data.type, 'daily_report');
    assert.equal(report.message, 'Laba kotor Rp 1.180.000 · ⚠️ 1 peringatan hari ini — 1 belum dicek');

    // The same cashier as account owner: no outlier alert.
    const ownerDb = fakeDb({ sales7d, reversals7d, today: { n: 0, total: 0, profit: 0 } });
    const o = deps(ownerDb, atNine, ['*']);
    const ownerCtx = (await systemContext(o.d, name(), 11))!;
    assert.equal(await runTenantNightly(ownerCtx, new Date(atNine)), false, 'no sales, no alerts → no report');
    assert.equal(ownerDb.events.length, 0);
});

test('nightly: a tenant who moved the report to 22:00 and switched it off still gets the weekly checks', async () => {
    const db = fakeDb({
        config: [{ ruleId: 'DAILY_REPORT', enabled: false, params: { hour: 22 } }],
        sales7d: [{ outletId: 1, performedByUserId: 7, n: 40 }, { outletId: 1, performedByUserId: 8, n: 200 }],
        reversals7d: [{ outletId: 1, reversedByUserId: 7, n: 6 }],
        today: { n: 10, total: 100_000, profit: 20_000 },
    });
    const at = '2026-10-15T15:05:00Z'; // 22:05 WIB
    const { d, pushes } = deps(db, at);
    const ctx = (await systemContext(d, name(), 11))!;
    assert.equal(await runTenantNightly(ctx, new Date(at)), false);
    assert.equal(pushes.length, 1);
    assert.equal(pushes[0].notification.data.type, 'anomaly_alert');
});
