// Unit tests for the pure loyalty follow-up rules (no DB).
// Run with:  npx tsx --test src/loyalty/__tests__/follow-up.service.test.ts

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    buildFollowUps,
    clampFollowUpDays,
    FollowUpRows,
    FollowUpSubscriptionRow,
} from '../follow-up.service';

const NOW = new Date('2026-10-14T02:00:00.000Z'); // 09:00 WIB
const DAY = 86_400_000;
const at = (days: number, extraMs = 0) => new Date(NOW.getTime() + days * DAY + extraMs);

const customer = (id: number, firstName: string, lastName = '', mobile: string | null = null) =>
    ({ id, firstName, lastName, mobile });

const sub = (over: Partial<FollowUpSubscriptionRow>): FollowUpSubscriptionRow => ({
    id: 1, customerId: 1, packageName: 'Paket 10x Cuci', status: 'ACTIVE',
    endDate: null, remainingQuota: 5, updatedAt: at(-10), ...over,
});

const rows = (over: Partial<FollowUpRows>): FollowUpRows => ({
    customers: [], pointBatches: [], vouchers: [], subscriptions: [], ...over,
});

describe('clampFollowUpDays', () => {
    test('defaults to 7 when missing or not a number', () => {
        assert.equal(clampFollowUpDays(undefined), 7);
        assert.equal(clampFollowUpDays(''), 7);
        assert.equal(clampFollowUpDays('abc'), 7);
    });
    test('clamps to 1..30', () => {
        assert.equal(clampFollowUpDays('0'), 1);
        assert.equal(clampFollowUpDays('-5'), 1);
        assert.equal(clampFollowUpDays('14'), 14);
        assert.equal(clampFollowUpDays('99'), 30);
        assert.equal(clampFollowUpDays(3), 3);
    });
});

describe('buildFollowUps — window (now, now+days]', () => {
    test('a date exactly now is out, exactly now+days is in, a ms later is out', () => {
        const r = buildFollowUps(rows({
            customers: [customer(1, 'A'), customer(2, 'B'), customer(3, 'C')],
            vouchers: [
                { id: 10, customerId: 1, label: 'X', status: 'ACTIVE', expiresAt: at(0) },
                { id: 11, customerId: 2, label: 'Y', status: 'ACTIVE', expiresAt: at(7) },
                { id: 12, customerId: 3, label: 'Z', status: 'ACTIVE', expiresAt: at(7, 1) },
            ],
        }), NOW, 7);
        assert.deepEqual(r.customers.map(c => c.customerId), [2]);
    });

    test('the days parameter widens the window', () => {
        const input = rows({
            customers: [customer(1, 'A')],
            pointBatches: [{ customerId: 1, remainingPoints: 50, expiresAt: at(10) }],
        });
        assert.equal(buildFollowUps(input, NOW, 7).customers.length, 0);
        assert.equal(buildFollowUps(input, NOW, 14).customers.length, 1);
    });
});

describe('buildFollowUps — points', () => {
    test('one reason per customer: the sum, dated by the earliest batch', () => {
        const r = buildFollowUps(rows({
            customers: [customer(1, 'Siti', 'Aminah', '0812')],
            pointBatches: [
                { customerId: 1, remainingPoints: 70.1, expiresAt: at(5) },
                { customerId: 1, remainingPoints: 50.2, expiresAt: at(2) },
                { customerId: 1, remainingPoints: 0, expiresAt: at(1) },       // spent → ignored
                { customerId: 1, remainingPoints: 30, expiresAt: at(9) },      // outside the window
                { customerId: 1, remainingPoints: 30, expiresAt: null },       // never expires
            ],
        }), NOW, 7);
        assert.equal(r.customers.length, 1);
        assert.deepEqual(r.customers[0].reasons, [{ kind: 'points', points: 120.3, expiresAt: at(2).toISOString() }]);
        assert.equal(r.customers[0].customerName, 'Siti Aminah');
        assert.equal(r.customers[0].mobile, '0812');
        assert.equal(r.counts.points, 1);
    });
});

describe('buildFollowUps — vouchers', () => {
    test('one reason per ACTIVE voucher; an empty label becomes null', () => {
        const r = buildFollowUps(rows({
            customers: [customer(1, 'A')],
            vouchers: [
                { id: 4, customerId: 1, label: 'Diskon 10%', status: 'ACTIVE', expiresAt: at(3) },
                { id: 5, customerId: 1, label: '', status: 'ACTIVE', expiresAt: at(4) },
                { id: 6, customerId: 1, label: 'Used', status: 'REDEEMED', expiresAt: at(4) },
            ],
        }), NOW, 7);
        assert.deepEqual(r.customers[0].reasons, [
            { kind: 'voucher', voucherId: 4, label: 'Diskon 10%', expiresAt: at(3).toISOString() },
            { kind: 'voucher', voucherId: 5, label: null, expiresAt: at(4).toISOString() },
        ]);
        assert.equal(r.counts.vouchers, 2);
    });
});

describe('buildFollowUps — packages', () => {
    test('package ending in the window → package_ending (remainingQuota may be null)', () => {
        const r = buildFollowUps(rows({
            customers: [customer(1, 'A')],
            subscriptions: [sub({ id: 9, endDate: at(3), remainingQuota: null })],
        }), NOW, 7);
        assert.deepEqual(r.customers[0].reasons, [
            { kind: 'package_ending', subscriptionId: 9, packageName: 'Paket 10x Cuci', endDate: at(3).toISOString(), remainingQuota: null },
        ]);
    });

    test('one use left and no end date → package_last_use with endDate null; soonestAt null', () => {
        const r = buildFollowUps(rows({
            customers: [customer(1, 'A')],
            subscriptions: [sub({ id: 11, packageName: 'Paket 5x Setrika', remainingQuota: 1, endDate: null })],
        }), NOW, 7);
        assert.deepEqual(r.customers[0].reasons, [
            { kind: 'package_last_use', subscriptionId: 11, packageName: 'Paket 5x Setrika', remainingQuota: 1, endDate: null },
        ]);
        assert.equal(r.customers[0].soonestAt, null);
        assert.equal(r.counts.packagesLastUse, 1);
    });

    test('one use left and ending in the window → reported ONCE, as package_ending with remainingQuota 1', () => {
        const r = buildFollowUps(rows({
            customers: [customer(1, 'A')],
            subscriptions: [sub({ id: 9, remainingQuota: 1, endDate: at(2) })],
        }), NOW, 7);
        assert.equal(r.customers[0].reasons.length, 1);
        assert.equal(r.customers[0].reasons[0].kind, 'package_ending');
        assert.equal((r.customers[0].reasons[0] as any).remainingQuota, 1);
        assert.deepEqual(r.counts, { customers: 1, points: 0, vouchers: 0, packagesEnding: 1, packagesLastUse: 0 });
    });

    test('one use left, ending after the window → package_last_use carrying its endDate', () => {
        const r = buildFollowUps(rows({
            customers: [customer(1, 'A')],
            subscriptions: [sub({ id: 9, remainingQuota: 1, endDate: at(20) })],
        }), NOW, 7);
        assert.deepEqual(r.customers[0].reasons, [
            { kind: 'package_last_use', subscriptionId: 9, packageName: 'Paket 10x Cuci', remainingQuota: 1, endDate: at(20).toISOString() },
        ]);
    });

    test('ended, inactive or not on the last use → nothing', () => {
        const r = buildFollowUps(rows({
            customers: [customer(1, 'A')],
            subscriptions: [
                sub({ id: 1, remainingQuota: 1, endDate: at(-1) }),           // already ended
                sub({ id: 2, remainingQuota: 1, endDate: at(0) }),            // ends exactly now
                sub({ id: 3, status: 'CANCELLED', endDate: at(2) }),
                sub({ id: 4, status: 'EXPIRED', remainingQuota: 1 }),
                sub({ id: 5, remainingQuota: 2, endDate: null }),
                sub({ id: 6, remainingQuota: 0, endDate: null }),
            ],
        }), NOW, 7);
        assert.equal(r.customers.length, 0);
    });
});

describe('buildFollowUps — grouping and sorting', () => {
    test('reasons of one customer are grouped and sorted by date, soonestAt = earliest', () => {
        const r = buildFollowUps(rows({
            customers: [customer(1, 'A')],
            pointBatches: [{ customerId: 1, remainingPoints: 10, expiresAt: at(5) }],
            vouchers: [{ id: 4, customerId: 1, label: 'V', status: 'ACTIVE', expiresAt: at(2) }],
            subscriptions: [
                sub({ id: 11, remainingQuota: 1, endDate: null }),
                sub({ id: 9, endDate: at(4) }),
            ],
        }), NOW, 7);
        assert.equal(r.customers.length, 1);
        assert.deepEqual(r.customers[0].reasons.map(x => x.kind), ['voucher', 'package_ending', 'points', 'package_last_use']);
        assert.equal(r.customers[0].soonestAt, at(2).toISOString());
        assert.deepEqual(r.counts, { customers: 1, points: 1, vouchers: 1, packagesEnding: 1, packagesLastUse: 1 });
    });

    test('customers sort by soonestAt ascending, null last, then by name', () => {
        const r = buildFollowUps(rows({
            customers: [customer(1, 'Zed'), customer(2, 'Budi'), customer(3, 'Ani'), customer(4, 'Cici'), customer(5, 'Andi')],
            vouchers: [
                { id: 1, customerId: 1, label: 'v', status: 'ACTIVE', expiresAt: at(1) },
                { id: 2, customerId: 2, label: 'v', status: 'ACTIVE', expiresAt: at(3) },
                { id: 3, customerId: 3, label: 'v', status: 'ACTIVE', expiresAt: at(3) },
            ],
            subscriptions: [
                sub({ id: 7, customerId: 4, remainingQuota: 1, endDate: null }),
                sub({ id: 8, customerId: 5, remainingQuota: 1, endDate: null }),
            ],
        }), NOW, 7);
        assert.deepEqual(r.customers.map(c => c.customerName), ['Zed', 'Ani', 'Budi', 'Andi', 'Cici']);
    });

    test('rows of a deleted / unknown customer are dropped; empty mobile becomes null', () => {
        const r = buildFollowUps(rows({
            customers: [customer(1, 'A', '', '')],
            vouchers: [
                { id: 1, customerId: 1, label: 'v', status: 'ACTIVE', expiresAt: at(1) },
                { id: 2, customerId: 99, label: 'v', status: 'ACTIVE', expiresAt: at(1) },
            ],
        }), NOW, 7);
        assert.deepEqual(r.customers.map(c => c.customerId), [1]);
        assert.equal(r.customers[0].mobile, null);
        assert.equal(r.counts.vouchers, 1);
    });

    test('envelope: days, generatedAt, empty list', () => {
        const r = buildFollowUps(rows({}), NOW, 7);
        assert.deepEqual(r, {
            days: 7,
            generatedAt: NOW.toISOString(),
            counts: { customers: 0, points: 0, vouchers: 0, packagesEnding: 0, packagesLastUse: 0 },
            customers: [],
        });
    });
});
