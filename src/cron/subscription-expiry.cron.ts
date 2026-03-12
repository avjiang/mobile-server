/**
 * Subscription Expiry Cron Job
 * Runs daily at 2:30 AM to expire time-based customer subscriptions.
 * Only processes tenant DBs with Advanced Loyalty add-on.
 */

const { getGlobalPrisma, getTenantPrisma } = require('../db');
import { ADD_ON_IDS } from '../constants/add-on-ids';

async function processSubscriptionExpiry(): Promise<void> {
    console.log('[Cron] Starting subscription expiry check...');
    const globalPrisma = getGlobalPrisma();

    try {
        // Get tenants with Advanced Loyalty add-on
        const tenantAddOns = await globalPrisma.tenantAddOn.findMany({
            where: { addOnId: ADD_ON_IDS.ADVANCED_LOYALTY },
            include: {
                tenant: { select: { databaseName: true, id: true } },
            },
        });

        let totalExpired = 0;

        for (const addOn of tenantAddOns) {
            const dbName = addOn.tenant?.databaseName;
            if (!dbName) continue;

            try {
                const expired = await expireSubscriptionsForTenant(dbName);
                if (expired > 0) {
                    console.log(`[Cron] Expired ${expired} subscriptions for tenant ${addOn.tenant.id} (${dbName})`);
                    totalExpired += expired;
                }
            } catch (error) {
                console.error(`[Cron] Error processing subscription expiry for tenant ${dbName}:`, error);
            }
        }

        console.log(`[Cron] Subscription expiry complete. Total expired: ${totalExpired}`);
    } catch (error) {
        console.error('[Cron] Fatal error in subscription expiry job:', error);
    }
}

async function expireSubscriptionsForTenant(dbName: string): Promise<number> {
    const prisma = getTenantPrisma(dbName);
    const now = new Date();

    // Find and expire all active subscriptions past their endDate
    const result = await prisma.customerSubscription.updateMany({
        where: {
            status: 'ACTIVE',
            endDate: { lt: now, not: null },
            deleted: false,
        },
        data: { status: 'EXPIRED' },
    });

    return result.count;
}

export { processSubscriptionExpiry };
