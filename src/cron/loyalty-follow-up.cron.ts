/**
 * Loyalty follow-up push — daily at 09:00 WIB (same run as the plan reminder).
 *
 * For each Pro tenant (Pro trial included — loyalty is Pro), tells everyone on
 * the tenant-wide topic `tenant_{id}_loyalty` (holders of `Receive Loyalty
 * Notification`; Super Admin gets every `Receive …` permission) how many
 * customers need a follow-up: points, vouchers or packages ending within 7 days,
 * or a package with one use left. The list itself is `GET /loyalty/follow-ups`.
 *
 * Noise control: one push per tenant per day, and only when something NEW
 * entered the list today (`hasNewFollowUpToday`) — a quiet list doesn't repeat.
 */

import PushyService from '../pushy/pushy.service';
import { NotificationMessages } from '../pushy/notification-messages';
import { buildFollowUps, hasNewFollowUpToday, loadFollowUpRows, FOLLOW_UP_DEFAULT_DAYS } from '../loyalty/follow-up.service';

const { getGlobalPrisma, disconnectTenantClient, databasesOnServer } = require('../db');

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** The calendar date in WIB (UTC+7, no DST) as yyyy-mm-dd. */
export function wibDate(now: Date): string {
    return new Date(now.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** The flat notification the app routes to `LoyaltyFollowUpScreen`. */
export function buildLoyaltyFollowUpNotification(tenantId: number, count: number, now: Date) {
    const texts = NotificationMessages.loyalty.followUp;
    return {
        title: texts.title(count),
        message: texts.message,
        data: {
            // One id per tenant per WIB day: every device and a live-socket replay keep one inbox row.
            notificationId: `loyalty_${tenantId}_${wibDate(now)}`,
            type: 'loyalty_followup',
            tenantId,
            count,
            // Sent by the system: 0 never matches a signed-in user.
            outletId: 0,
            triggeringUserId: 0,
            triggeringUsername: '',
            timestamp: now.toISOString(),
        },
    };
}

async function processLoyaltyFollowUps(now: Date = new Date()): Promise<void> {
    console.log('[Cron] Starting loyalty follow-ups...');
    const globalPrisma = getGlobalPrisma();
    let sent = 0;

    try {
        // Active outlets on a live Pro plan (or the Pro trial) — the only tenants with loyalty.
        const tenantOutlets = await globalPrisma.tenantOutlet.findMany({
            where: {
                isActive: true,
                subscriptions: {
                    some: {
                        status: { in: ['Active', 'active', 'trial'] },
                        subscriptionPlan: { planName: 'Pro' },
                    },
                },
            },
            include: { tenant: { select: { databaseName: true, id: true } } },
        });

        // One run per tenant database (outlets share it).
        const tenantMap = new Map<string, number>();
        for (const outlet of tenantOutlets) {
            if (outlet.tenant?.databaseName) tenantMap.set(outlet.tenant.databaseName, outlet.tenant.id);
        }

        const onServer: Set<string> = await databasesOnServer();

        for (const [dbName, tenantId] of tenantMap) {
            if (!onServer.has(dbName)) continue;
            try {
                const rows = await loadFollowUpRows(dbName, now, FOLLOW_UP_DEFAULT_DAYS);
                if (!hasNewFollowUpToday(rows, now)) continue;

                const count = buildFollowUps(rows, now, FOLLOW_UP_DEFAULT_DAYS).counts.customers;
                if (count === 0) continue;

                const result = await PushyService.sendToTopic(
                    `tenant_${tenantId}_loyalty`,
                    buildLoyaltyFollowUpNotification(tenantId, count, now),
                    tenantId,
                );
                if (result.success) sent++;
                console.log(`[Cron] Loyalty follow-up for tenant ${tenantId}: ${count} customer(s), push ${result.success ? 'sent' : `failed (${result.error})`}`);
            } catch (error) {
                console.error(`[Cron] Loyalty follow-up failed for tenant ${tenantId} (${dbName}):`, error);
            } finally {
                await disconnectTenantClient(dbName);
            }
        }

        console.log(`[Cron] Loyalty follow-ups complete. Sent: ${sent}`);
    } catch (error) {
        console.error('[Cron] Fatal error in loyalty follow-ups:', error);
    }
}

export { processLoyaltyFollowUps };
