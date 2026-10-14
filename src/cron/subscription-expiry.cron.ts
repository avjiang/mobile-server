/**
 * Subscription Expiry Cron Job
 * Runs daily at 2:30 AM to expire time-based customer subscriptions.
 * Processes EVERY tenant DB: prepaid packages exist on Laundry Pro (advanced
 * loyalty bundled, no add-on row) and on shops that stepped down from Pro or a
 * Pro trial, whose existing packages stay redeemable until their end date.
 */

const { getGlobalPrisma, getTenantPrisma, disconnectTenantClient, databasesOnServer } = require('../db');

async function processSubscriptionExpiry(): Promise<void> {
    console.log('[Cron] Starting subscription expiry check...');
    const globalPrisma = getGlobalPrisma();

    try {
        const tenants = await globalPrisma.tenant.findMany({
            where: { databaseName: { not: null } },
            select: { databaseName: true, id: true },
        });

        let totalExpired = 0;
        const onServer: Set<string> = await databasesOnServer();

        for (const tenant of tenants) {
            const dbName = tenant.databaseName;
            if (!dbName || !onServer.has(dbName)) continue;

            try {
                const expired = await expireSubscriptionsForTenant(dbName);
                if (expired > 0) {
                    console.log(`[Cron] Expired ${expired} subscriptions for tenant ${tenant.id} (${dbName})`);
                    totalExpired += expired;
                }
            } catch (error) {
                console.error(`[Cron] Error processing subscription expiry for tenant ${dbName}:`, error);
            } finally {
                // Release the tenant client after processing — bounds cron connection use (see db.ts).
                await disconnectTenantClient(dbName);
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
