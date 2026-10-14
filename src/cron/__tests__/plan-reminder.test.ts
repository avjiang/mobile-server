// Unit tests for the pure parts of the plan reminder (src/cron/plan-reminder.cron.ts).
// Run with:  npx tsx --test src/cron/__tests__/plan-reminder.test.ts

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { planReminderFor, buildPlanReminderNotification, PlanSubscription } from '../plan-reminder.cron';

const NOW = new Date('2026-10-14T02:00:00.000Z'); // 09:00 WIB
const DAY = 86_400_000;
const until = (days: number) => new Date(NOW.getTime() + days * DAY);
const s = (status: string, days: number, planName: string | null = 'Pro'): PlanSubscription =>
    ({ status, subscriptionValidUntil: until(days), planName });

describe('planReminderFor', () => {
    test('reminds only 7, 3, 1 and 0 days before the end', () => {
        for (let d = -2; d <= 10; d++) {
            const r = planReminderFor([s('active', d)], NOW);
            if ([7, 3, 1, 0].includes(d)) {
                assert.ok(r, `day ${d} should remind`);
                assert.equal(r!.daysRemaining, d);
            } else {
                assert.equal(r, null, `day ${d} should not remind`);
            }
        }
    });

    test('the earliest-ending live subscription decides', () => {
        // Outlet A ends in 3 days, outlet B in 10: the reminder is about A.
        const r = planReminderFor([s('active', 10, 'Pro'), s('active', 3, 'Basic')], NOW);
        assert.equal(r?.daysRemaining, 3);
        assert.equal(r?.planName, 'Basic');
        // The earliest is on a non-reminder day → no reminder, even if another is on 7.
        assert.equal(planReminderFor([s('active', 7), s('active', 5)], NOW), null);
    });

    test('expired / cancelled subscriptions are ignored', () => {
        assert.equal(planReminderFor([s('expired', 3), s('cancelled', 1)], NOW), null);
        const r = planReminderFor([s('cancelled', 1), s('Active', 7)], NOW);
        assert.equal(r?.daysRemaining, 7);
    });

    test("'trial' → trial_ending, otherwise plan_expiring (status is case-insensitive)", () => {
        assert.equal(planReminderFor([s('trial', 3)], NOW)?.alertType, 'trial_ending');
        assert.equal(planReminderFor([s('Trial', 3)], NOW)?.alertType, 'trial_ending');
        assert.equal(planReminderFor([s('active', 3)], NOW)?.alertType, 'plan_expiring');
        assert.equal(planReminderFor([s('Active', 3)], NOW)?.alertType, 'plan_expiring');
    });

    test('expiryDate is the UTC date; missing planName becomes empty string', () => {
        const r = planReminderFor([s('active', 1, null)], NOW);
        assert.equal(r?.expiryDate, '2026-10-15');
        assert.equal(r?.planName, '');
    });

    test('several outlets: the ending outlet is named; a single outlet is not', () => {
        const multi = planReminderFor([
            { ...s('active', 200), outletName: 'Main Outlet' },
            { ...s('active', 7), outletName: 'Cabang Kedua' },
        ], NOW);
        assert.equal(multi!.outletName, 'Cabang Kedua');
        assert.match(buildPlanReminderNotification(11, multi!).message, /Cabang Kedua/);
        const single = planReminderFor([{ ...s('active', 7), outletName: 'Main Outlet' }], NOW);
        assert.equal(single!.outletName, null);
        assert.doesNotMatch(buildPlanReminderNotification(11, single!).message, /Main Outlet/);
    });

    test('no subscriptions → null', () => {
        assert.equal(planReminderFor([], NOW), null);
    });
});

describe('buildPlanReminderNotification', () => {
    const reminder = { alertType: 'plan_expiring' as const, daysRemaining: 3, expiryDate: '2026-10-17', planName: 'Pro' };

    test('system-sent: triggeringUserId 0, outletId 0, empty username', () => {
        const n = buildPlanReminderNotification(11, reminder);
        assert.equal(n.data.triggeringUserId, 0);
        assert.equal(n.data.outletId, 0);
        assert.equal(n.data.triggeringUsername, '');
        assert.equal(n.data.type, 'subscription_alert');
        assert.equal(n.data.tenantId, 11);
        assert.equal(n.data.alertType, 'plan_expiring');
        assert.equal(n.data.daysRemaining, 3);
        assert.equal(n.data.expiryDate, '2026-10-17');
        assert.equal(n.data.planName, 'Pro');
        assert.ok(n.title.length > 0);
        assert.ok(n.message.length > 0);
    });

    test('notificationId is deterministic (same tenant, date, day → same id)', () => {
        const a = buildPlanReminderNotification(11, reminder);
        const b = buildPlanReminderNotification(11, reminder);
        assert.equal(a.data.notificationId, 'plan_11_2026-10-17_3');
        assert.equal(a.data.notificationId, b.data.notificationId);
        assert.notEqual(
            buildPlanReminderNotification(11, { ...reminder, daysRemaining: 1 }).data.notificationId,
            a.data.notificationId,
        );
    });

    test('trial and plan use different texts', () => {
        const trial = buildPlanReminderNotification(11, { ...reminder, alertType: 'trial_ending' });
        const plan = buildPlanReminderNotification(11, reminder);
        assert.notEqual(trial.title, plan.title);
        assert.equal(trial.data.alertType, 'trial_ending');
    });
});
