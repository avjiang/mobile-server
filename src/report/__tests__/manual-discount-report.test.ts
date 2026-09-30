import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildManualDiscountReport,
    resolvePerformer,
    loadManualDiscountReport,
    ReportUserRow,
} from '../manual-discount-report';

const users: ReportUserRow[] = [
    { id: 1, username: 'owner', firstName: 'Alvin', lastName: 'Jiang' },
    { id: 3, username: 'budi', firstName: null, lastName: null },
    { id: 4, username: 'sari', firstName: 'Sari', lastName: null },
];

describe('resolvePerformer', () => {
    test('matches a username, then a "First Last" display name (case/space-insensitive)', () => {
        assert.deepEqual(resolvePerformer('budi', users), { userId: 3, username: 'budi' });
        assert.deepEqual(resolvePerformer('alvin  jiang', users), { userId: 1, username: 'owner' });
        assert.deepEqual(resolvePerformer('Sari', users), { userId: 4, username: 'sari' });
    });

    test('an unknown name stays as its own row with userId 0', () => {
        assert.deepEqual(resolvePerformer(' Cashier ', users), { userId: 0, username: 'Cashier' });
        assert.deepEqual(resolvePerformer(null, users), { userId: 0, username: '' });
    });
});

describe('buildManualDiscountReport', () => {
    test('always present: zeros and [] with no discounted sales', () => {
        assert.deepEqual(buildManualDiscountReport([{ totalItemDiscountAmount: 0, discountAmount: 0, performedBy: 'budi' }], users), {
            totalAmount: 0, itemAmount: 0, orderAmount: 0, salesCount: 0, byUser: [],
        });
    });

    test('sums item + order discounts, counts sales, groups by user sorted by amount desc', () => {
        const r = buildManualDiscountReport([
            { totalItemDiscountAmount: 10000, discountAmount: 0, performedBy: 'budi' },
            { totalItemDiscountAmount: 0, discountAmount: 5500, performedBy: 'Alvin Jiang' },
            { totalItemDiscountAmount: 20100, discountAmount: 0, performedBy: 'budi' },
            { totalItemDiscountAmount: 0, discountAmount: 10000, performedBy: 'owner' },
            { totalItemDiscountAmount: 0, discountAmount: 0, performedBy: 'sari' }, // no discount — ignored
        ], users);
        assert.equal(r.totalAmount, 45600);
        assert.equal(r.itemAmount, 30100);
        assert.equal(r.orderAmount, 15500);
        assert.equal(r.salesCount, 4);
        assert.deepEqual(r.byUser, [
            { userId: 3, username: 'budi', amount: 30100, salesCount: 2 },
            { userId: 1, username: 'owner', amount: 15500, salesCount: 2 },
        ]);
    });

    test('accepts Prisma-style decimals (toString)', () => {
        const d = (n: number) => ({ toString: () => String(n) });
        const r = buildManualDiscountReport([{ totalItemDiscountAmount: d(1.5), discountAmount: d(2.25), performedBy: 'sari' }], users);
        assert.equal(r.totalAmount, 3.75);
    });
});

describe('loadManualDiscountReport', () => {
    test('reads only discounted sales in the given filter; skips the user query when none', async () => {
        const calls: any[] = [];
        let userReads = 0;
        const prisma: any = {
            sales: { findMany: async (args: any) => { calls.push(args); return []; } },
            user: { findMany: async () => { userReads++; return users; } },
        };
        const r = await loadManualDiscountReport(prisma, { completedSessionId: 9, status: 'Completed', deleted: false });
        assert.deepEqual(r, { totalAmount: 0, itemAmount: 0, orderAmount: 0, salesCount: 0, byUser: [] });
        assert.equal(userReads, 0);
        assert.equal(calls[0].where.completedSessionId, 9);
        assert.equal(calls[0].where.status, 'Completed');
        assert.equal(calls[0].where.deleted, false);
        assert.equal(calls[0].where.OR.length, 2);
    });
});
