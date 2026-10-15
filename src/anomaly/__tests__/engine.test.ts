import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AnomalyDeps, invalidateAnomalyConfig, onSaleCompleted, onSaleReversed, onStockAdjusted } from '../anomaly.service';

// ── A hand-built tenant DB: just what the engine reads and writes ──

interface FakeSale {
    id: number; friendlyNumber: string | null; outletId: number; siteId: number | null; totalAmount: number;
    createdAt: Date; performedByUserId: number | null; reversedAt: Date | null; reversedByUserId: number | null;
    status: string; deleted: boolean; discountAmount: number;
    payments: { method: string; createdAt: Date }[];
    salesItems: { itemId: number; itemVariantId: null; itemName: string; variantName: null; price: number; cost: number; discountAmount: number }[];
}

function fakeDb(opts: { sales?: FakeSale[]; config?: { ruleId: string; enabled: boolean; params: object }[]; throwOn?: string } = {}) {
    const events: any[] = [];
    let nextId = 1;
    const dec = (n: number) => ({ toString: () => String(n) });
    const guard = (name: string) => { if (opts.throwOn === name) throw new Error(`boom: ${name}`); };
    const db: any = {
        events,
        anomalyRuleConfig: { findMany: async () => opts.config ?? [] },
        anomalyEvent: {
            findUnique: async ({ where }: any) => { guard('anomalyEvent'); return events.find((e) => e.dedupKey === where.dedupKey) ?? null; },
            findUniqueOrThrow: async ({ where }: any) => events.find((e) => e.dedupKey === where.dedupKey),
            create: async ({ data }: any) => { const row = { ...data, id: nextId++ }; events.push(row); return row; },
            update: async ({ where, data }: any) => { const row = events.find((e) => e.id === where.id); Object.assign(row, data); return row; },
        },
        sales: {
            findUnique: async ({ where }: any) => {
                guard('sales');
                const s = (opts.sales ?? []).find((x) => x.id === where.id);
                return s ? { ...s, totalAmount: dec(s.totalAmount), discountAmount: dec(s.discountAmount),
                    salesItems: s.salesItems.map((l) => ({ ...l, price: dec(l.price), cost: dec(l.cost), discountAmount: dec(l.discountAmount) })) } : null;
            },
            findMany: async ({ where }: any) => (opts.sales ?? [])
                .filter((s) => s.reversedByUserId === where.reversedByUserId && s.reversedAt && s.reversedAt >= where.reversedAt.gte)
                .map((s) => ({ id: s.id, totalAmount: dec(s.totalAmount), status: s.status })),
        },
        outlet: { findUnique: async () => ({ outletName: 'Cabang Utama' }) },
        item: { findMany: async ({ where }: any) => where.id.in.map((id: number) => ({ id, itemName: `Barang ${id}` })) },
    };
    return db;
}

function deps(db: any, o: { pro?: boolean; perms?: string[] } = {}) {
    const pushes: { topic: string; notification: any }[] = [];
    const logs: string[] = [];
    const d: AnomalyDeps = {
        prisma: () => db,
        isPro: async () => o.pro ?? true,
        permissions: async () => o.perms ?? ['Process Sales'],
        push: async (topic, notification) => { pushes.push({ topic, notification }); },
        now: () => new Date('2026-10-15T05:00:00Z'),
        log: (m) => { logs.push(m); },
    };
    return { d, pushes, logs };
}

const actor = { userId: 7, username: 'chs' };
let dbSeq = 0;
const freshDb = () => { const name = `t${++dbSeq}`; invalidateAnomalyConfig(name); return name; };

const voided = (id: number, minutesAgo: number, extra: Partial<FakeSale> = {}): FakeSale => ({
    id, friendlyNumber: null, outletId: 1, siteId: 2, totalAmount: 50_000,
    createdAt: new Date('2026-10-15T01:00:00Z'), performedByUserId: 9,
    reversedAt: new Date(new Date('2026-10-15T05:00:00Z').getTime() - minutesAgo * 60_000),
    reversedByUserId: 7, status: 'Voided', deleted: false, discountAmount: 0,
    payments: [{ method: 'Card', createdAt: new Date('2026-10-15T01:00:00Z') }], salesItems: [], ...extra,
});

const reverse = (db: any, d: AnomalyDeps, saleId: number, name: string) =>
    onSaleReversed({ databaseName: name, tenantId: 11, actor, saleId, kind: 'void' }, d);

test('the second void of the day records one event and pushes once on the security topic', async () => {
    const db = fakeDb({ sales: [voided(1, 60), voided(2, 1)] });
    const { d, pushes } = deps(db);
    await reverse(db, d, 2, freshDb());

    assert.equal(db.events.length, 1);
    assert.equal(db.events[0].ruleId, 'REVERSAL_BURST');
    assert.equal(db.events[0].count, 2);
    assert.equal(db.events[0].detail.lastAt, '2026-10-15T05:00:00.000Z', 'last occurrence kept apart from UPDATED_AT');
    assert.equal(pushes.length, 1);
    const { topic, notification } = pushes[0];
    assert.equal(topic, 'tenant_11_security');
    assert.equal(notification.data.type, 'anomaly_alert');
    assert.equal(notification.data.outletId, 0, 'tenant-wide: shows in every outlet inbox');
    assert.equal(notification.data.alertOutletId, 1);
    assert.equal(notification.data.triggeringUserId, 7, "the actor's own devices drop it");
    assert.equal(notification.title, 'chs membatalkan 2 transaksi hari ini');
    assert.equal(notification.message, 'Total Rp 100.000 · batas Anda 1 per hari · Cabang Utama');
    assert.equal(notification.data.titleEn, 'chs reversed 2 sales today');
});

test('the third void updates the event quietly; the fourth escalates and re-opens it', async () => {
    const sales = [voided(1, 60), voided(2, 50)];
    const db = fakeDb({ sales });
    const { d, pushes } = deps(db);
    const name = freshDb();
    await reverse(db, d, 2, name);
    db.events[0].status = 'ACKNOWLEDGED';

    sales.push(voided(3, 10));
    await reverse(db, d, 3, name);
    assert.equal(pushes.length, 1);
    assert.equal(db.events[0].count, 3);
    assert.equal(db.events[0].status, 'ACKNOWLEDGED');

    sales.push(voided(4, 1));
    await reverse(db, d, 4, name);
    assert.equal(pushes.length, 2);
    assert.equal(db.events[0].status, 'OPEN');
    assert.equal(db.events.length, 1);
});

test('a retried request never pushes twice', async () => {
    const db = fakeDb({ sales: [voided(1, 60), voided(2, 1)] });
    const { d, pushes } = deps(db);
    const name = freshDb();
    await reverse(db, d, 2, name);
    await reverse(db, d, 2, name);
    assert.equal(pushes.length, 1);
});

test('the account owner never alerts; neither does a tenant off Pro', async () => {
    const sales = [voided(1, 60), voided(2, 1)];
    for (const o of [{ perms: ['*'] }, { pro: false }]) {
        const db = fakeDb({ sales });
        const { d, pushes } = deps(db, o);
        await reverse(db, d, 2, freshDb());
        assert.equal(db.events.length, 0);
        assert.equal(pushes.length, 0);
    }
});

test('a rule switched off by the tenant stays silent', async () => {
    const db = fakeDb({ sales: [voided(1, 60), voided(2, 1)], config: [{ ruleId: 'REVERSAL_BURST', enabled: false, params: {} }] });
    const { d, pushes } = deps(db);
    await reverse(db, d, 2, freshDb());
    assert.equal(pushes.length, 0);
});

test('the tenant limit replaces the default', async () => {
    const db = fakeDb({ sales: [voided(1, 60), voided(2, 1)], config: [{ ruleId: 'REVERSAL_BURST', enabled: true, params: { maxPerDay: 5 } }] });
    const { d, pushes } = deps(db);
    await reverse(db, d, 2, freshDb());
    assert.equal(pushes.length, 0);
});

test('a quick cash void by the cashier who rang it alerts', async () => {
    const paid = new Date('2026-10-15T04:55:00Z');
    const db = fakeDb({ sales: [voided(1, 0, { performedByUserId: 7, reversedAt: new Date('2026-10-15T05:00:00Z'), payments: [{ method: 'Cash', createdAt: paid }] })] });
    const { d, pushes } = deps(db);
    await reverse(db, d, 1, freshDb());
    assert.equal(pushes.length, 1);
    assert.equal(db.events[0].ruleId, 'QUICK_REVERSAL');
    assert.equal(pushes[0].notification.title, 'chs membatalkan penjualan tunai 5 menit setelah dibayar');
});

test('fail-open: a database error is logged, never thrown', async () => {
    const db = fakeDb({ sales: [voided(1, 60), voided(2, 1)], throwOn: 'anomalyEvent' });
    const { d, pushes, logs } = deps(db);
    await reverse(db, d, 2, freshDb());
    assert.equal(pushes.length, 0);
    assert.equal(logs.length, 1);
    assert.match(logs[0], /onSaleReversed\(sale 2\) failed/);
});

test('a sale: large discount and below cost are two separate events', async () => {
    const db = fakeDb({
        sales: [{
            ...voided(30, 0), status: 'Completed', reversedAt: null, reversedByUserId: null, discountAmount: 0,
            salesItems: [{ itemId: 5, itemVariantId: null, itemName: 'Gula', variantName: null, price: 100_000, cost: 80_000, discountAmount: 30_000 }],
        }],
    });
    const { d, pushes } = deps(db);
    await onSaleCompleted({
        databaseName: freshDb(), tenantId: 11, actor, permissions: ['Process Sales'], saleId: 30,
        salesBody: { salesItems: [{ price: 100_000, quantity: 1, discountAmount: 30_000 }], discountAmount: 0 },
        discountDecision: { action: 'allow' },
    }, d);
    assert.deepEqual(db.events.map((e: any) => e.ruleId).sort(), ['BELOW_COST', 'LARGE_DISCOUNT']);
    assert.equal(pushes.length, 2);
});

test('a big write-off at one outlet alerts with the item names', async () => {
    const db = fakeDb();
    const { d, pushes } = deps(db);
    await onStockAdjusted({
        databaseName: freshDb(), tenantId: 11, actor, siteId: null,
        writeOffs: [{ itemId: 1, outletId: 1, cost: 200_000, reason: 'Rusak' }, { itemId: 2, outletId: 1, cost: 100_000, reason: 'Hilang' }],
    }, d);
    assert.equal(db.events.length, 1);
    assert.equal(pushes[0].notification.title, 'chs mengurangi stok senilai Rp 300.000');
    assert.equal(pushes[0].notification.message, 'Barang 1 dan 1 lainnya · batas Anda Rp 250.000 · Cabang Utama');
});
