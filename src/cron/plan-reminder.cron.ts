/**
 * Plan reminder — daily at 09:00 WIB (shop hours, so a Windows counter that
 * opens in the morning is usually online; the live socket replays it otherwise).
 *
 * Tells the tenant's owners (Super Admin, role ID 1) that their Bayar Yuk! plan
 * or Pro trial ends in 7, 3 or 1 day(s), or today — a push to each owner's own
 * topic `tenant_{id}_user_{tenantUserId}`, so cashiers never get it. The app also
 * shows a sheet on the dashboard, but only when someone opens the app; this
 * reaches the owner who doesn't.
 *
 * Push is Pro-only (`PushyService.sendToTopic`), and the Pro trial counts as Pro,
 * so in practice: Pro tenants and Pro-trial tenants. Basic and Lite devices never
 * register for push.
 *
 * Days are counted like the dashboard does (calendar days of the UTC dates), so
 * the push and the in-app sheet agree on "N days left".
 */

import PushyService from '../pushy/pushy.service';
import { NotificationMessages } from '../pushy/notification-messages';

const { getGlobalPrisma, getTenantPrisma, disconnectTenantClient, databasesOnServer } = require('../db');

/** Days before the end on which the owner is told. 0 = the last day. */
export const PLAN_REMINDER_DAYS = [7, 3, 1, 0];

const SUPER_ADMIN_ROLE_ID = 1;

export interface PlanSubscription {
    status: string;
    subscriptionValidUntil: Date;
    planName: string | null | undefined;
    outletName?: string | null;
}

export interface PlanReminder {
    alertType: 'trial_ending' | 'plan_expiring';
    daysRemaining: number;
    /** yyyy-MM-dd (UTC date, as the app shows it). */
    expiryDate: string;
    planName: string;
    /** Named only when the tenant has more than one live outlet: "which one ends?". */
    outletName?: string | null;
}

const isLive = (status: string) => ['active', 'trial'].includes((status ?? '').toLowerCase());

const utcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/**
 * The reminder due today for one tenant, or null. The tenant's first-ending live
 * subscription decides (one outlet ending is enough to lock the app there).
 */
export function planReminderFor(subscriptions: PlanSubscription[], now: Date): PlanReminder | null {
    const live = subscriptions
        .filter(s => isLive(s.status) && s.subscriptionValidUntil)
        .sort((a, b) => a.subscriptionValidUntil.getTime() - b.subscriptionValidUntil.getTime());
    const first = live[0];
    if (!first) return null;

    const daysRemaining = Math.round((utcDay(first.subscriptionValidUntil) - utcDay(now)) / 86_400_000);
    if (!PLAN_REMINDER_DAYS.includes(daysRemaining)) return null;

    return {
        alertType: first.status.toLowerCase() === 'trial' ? 'trial_ending' : 'plan_expiring',
        daysRemaining,
        expiryDate: first.subscriptionValidUntil.toISOString().slice(0, 10),
        planName: first.planName ?? '',
        outletName: live.length > 1 ? (first.outletName ?? null) : null,
    };
}

/** The flat notification for [reminder] (the app's `SubscriptionAlertPushyTopic`). */
export function buildPlanReminderNotification(tenantId: number, reminder: PlanReminder) {
    const texts = reminder.alertType === 'trial_ending'
        ? NotificationMessages.plan.trialEnding
        : NotificationMessages.plan.planExpiring;
    return {
        title: texts.title(reminder.daysRemaining),
        message: texts.message(reminder.expiryDate, reminder.outletName),
        data: {
            // Same id on every device and on a live-socket replay: the inbox keeps one row.
            notificationId: `plan_${tenantId}_${reminder.expiryDate}_${reminder.daysRemaining}`,
            type: 'subscription_alert',
            tenantId,
            alertType: reminder.alertType,
            daysRemaining: reminder.daysRemaining,
            expiryDate: reminder.expiryDate,
            planName: reminder.planName,
            outletName: reminder.outletName ?? null,
            // Sent by the system, not a user: 0 never matches a signed-in user, so
            // the app never treats it as "your own action".
            outletId: 0,
            triggeringUserId: 0,
            triggeringUsername: '',
            timestamp: new Date().toISOString(),
        },
    };
}

async function processPlanReminders(now: Date = new Date()): Promise<void> {
    console.log('[Cron] Starting plan reminders...');
    const globalPrisma = getGlobalPrisma();
    let sent = 0;

    try {
        const tenants = await globalPrisma.tenant.findMany({
            where: { databaseName: { not: null } },
            select: {
                id: true,
                databaseName: true,
                // A deactivated outlet's subscription doesn't lock anything — ignore it.
                subscription: {
                    where: { outlet: { isActive: true } },
                    select: {
                        status: true,
                        subscriptionValidUntil: true,
                        subscriptionPlan: { select: { planName: true } },
                        outlet: { select: { outletName: true } },
                    },
                },
            },
        });
        const onServer: Set<string> = await databasesOnServer();

        for (const tenant of tenants) {
            const reminder = planReminderFor(
                tenant.subscription.map((s: any) => ({
                    status: s.status,
                    subscriptionValidUntil: s.subscriptionValidUntil,
                    planName: s.subscriptionPlan?.planName,
                    outletName: s.outlet?.outletName,
                })),
                now,
            );
            if (!reminder || !tenant.databaseName || !onServer.has(tenant.databaseName)) continue;

            try {
                const owners = await getTenantPrisma(tenant.databaseName).user.findMany({
                    where: { deleted: false, roles: { some: { id: SUPER_ADMIN_ROLE_ID, deleted: false } } },
                    select: { username: true },
                });
                if (owners.length === 0) continue;

                const tenantUsers = await globalPrisma.tenantUser.findMany({
                    where: { tenantId: tenant.id, isDeleted: false, username: { in: owners.map((o: any) => o.username) } },
                    select: { id: true },
                });

                const notification = buildPlanReminderNotification(tenant.id, reminder);
                for (const tu of tenantUsers) {
                    await PushyService.sendToTopic(`tenant_${tenant.id}_user_${tu.id}`, notification, tenant.id);
                    sent++;
                }
            } catch (error) {
                console.error(`[Cron] Plan reminder failed for tenant ${tenant.id}:`, error);
            } finally {
                await disconnectTenantClient(tenant.databaseName);
            }
        }

        console.log(`[Cron] Plan reminders complete. Sent: ${sent}`);
    } catch (error) {
        console.error('[Cron] Fatal error in plan reminders:', error);
    }
}

export { processPlanReminders };
