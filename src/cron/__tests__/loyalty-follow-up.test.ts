// Unit tests for the loyalty follow-up push: the "new today" rule and the payload.
// Run with:  npx tsx --test src/cron/__tests__/loyalty-follow-up.test.ts

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { hasNewFollowUpToday, FollowUpRows, FollowUpSubscriptionRow } from '../../loyalty/follow-up.service';
import { buildLoyaltyFollowUpNotification, wibDate } from '../loyalty-follow-up.cron';

const NOW = new Date('2026-10-14T02:00:00.000Z'); // 09:00 WIB
const DAY = 86_400_000;
const HOUR = 3_600_000;
const at = (days: number, extraMs = 0) => new Date(NOW.getTime() + days * DAY + extraMs);

const sub = (over: Partial<FollowUpSubscriptionRow>): FollowUpSubscriptionRow => ({
    id: 1, customerId: 1, packageName: 'Paket', status: 'ACTIVE',
    endDate: null, remainingQuota: 5, updatedAt: at(-10), ...over,
});

const rows = (over: Partial<FollowUpRows>): FollowUpRows => ({
    customers: [{ id: 1, firstName: 'A', lastName: '', mobile: null }],
    pointBatches: [], vouchers: [], subscriptions: [], ...over,
});

describe('hasNewFollowUpToday', () => {
    test('nothing → false', () => {
        assert.equal(hasNewFollowUpToday(rows({}), NOW), false);
    });

    test('something already in the list since earlier days (≤ now+6d) → false', () => {
        assert.equal(hasNewFollowUpToday(rows({
            pointBatches: [{ customerId: 1, remainingPoints: 10, expiresAt: at(6) }],
            vouchers: [{ id: 1, customerId: 1, label: 'v', status: 'ACTIVE', expiresAt: at(3) }],
            subscriptions: [sub({ endDate: at(1) })],
        }), NOW), false);
    });

    test('points batch entering (now+6d, now+7d] → true; boundaries are exclusive/inclusive', () => {
        const withBatch = (d: Date) => rows({ pointBatches: [{ customerId: 1, remainingPoints: 10, expiresAt: d }] });
        assert.equal(hasNewFollowUpToday(withBatch(at(6, 1)), NOW), true);
        assert.equal(hasNewFollowUpToday(withBatch(at(7)), NOW), true);
        assert.equal(hasNewFollowUpToday(withBatch(at(6)), NOW), false);
        assert.equal(hasNewFollowUpToday(withBatch(at(7, 1)), NOW), false);
    });

    test('a spent batch entering the day window does not count', () => {
        assert.equal(hasNewFollowUpToday(rows({
            pointBatches: [{ customerId: 1, remainingPoints: 0, expiresAt: at(6.5) }],
        }), NOW), false);
    });

    test('voucher entering the day window → true; a redeemed one → false', () => {
        assert.equal(hasNewFollowUpToday(rows({
            vouchers: [{ id: 1, customerId: 1, label: 'v', status: 'ACTIVE', expiresAt: at(6.5) }],
        }), NOW), true);
        assert.equal(hasNewFollowUpToday(rows({
            vouchers: [{ id: 1, customerId: 1, label: 'v', status: 'REDEEMED', expiresAt: at(6.5) }],
        }), NOW), false);
    });

    test('package ending in the day window → true', () => {
        assert.equal(hasNewFollowUpToday(rows({ subscriptions: [sub({ endDate: at(6.5) })] }), NOW), true);
    });

    test('package on its last use, updated in the last 24h → true; earlier → false', () => {
        assert.equal(hasNewFollowUpToday(rows({
            subscriptions: [sub({ remainingQuota: 1, updatedAt: at(0, -2 * HOUR) })],
        }), NOW), true);
        assert.equal(hasNewFollowUpToday(rows({
            subscriptions: [sub({ remainingQuota: 1, updatedAt: at(-1, -1) })],
        }), NOW), false);
    });

    test('a recently updated package with more than one use left → false', () => {
        assert.equal(hasNewFollowUpToday(rows({
            subscriptions: [sub({ remainingQuota: 2, updatedAt: at(0, -HOUR) })],
        }), NOW), false);
    });

    test('rows of a customer not in the list (deleted) do not count', () => {
        assert.equal(hasNewFollowUpToday(rows({
            customers: [],
            vouchers: [{ id: 1, customerId: 1, label: 'v', status: 'ACTIVE', expiresAt: at(6.5) }],
        }), NOW), false);
    });
});

describe('buildLoyaltyFollowUpNotification', () => {
    test('flat payload with the contract fields, system-sent', () => {
        const n = buildLoyaltyFollowUpNotification(11, 5, NOW);
        assert.equal(n.title, '5 pelanggan perlu dihubungi');
        assert.equal(n.message, 'Poin, voucher, atau paket mereka segera berakhir. Ketuk untuk melihat daftarnya.');
        assert.deepEqual(n.data, {
            notificationId: 'loyalty_11_2026-10-14',
            type: 'loyalty_followup',
            tenantId: 11,
            count: 5,
            outletId: 0,
            triggeringUserId: 0,
            triggeringUsername: '',
            timestamp: NOW.toISOString(),
        });
    });

    test('notificationId uses the WIB calendar date', () => {
        // 17:30 UTC on the 14th is 00:30 WIB on the 15th.
        assert.equal(wibDate(new Date('2026-10-14T17:30:00.000Z')), '2026-10-15');
        assert.equal(wibDate(new Date('2026-10-14T16:59:59.000Z')), '2026-10-14');
        assert.equal(
            buildLoyaltyFollowUpNotification(3, 1, new Date('2026-10-14T17:30:00.000Z')).data.notificationId,
            'loyalty_3_2026-10-15',
        );
    });
});
