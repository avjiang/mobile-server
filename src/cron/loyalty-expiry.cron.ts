/**
 * Loyalty Point Expiry Cron Job
 * Runs daily at 2:00 AM to expire point batches past their expiresAt date.
 * Only processes tenant DBs where planName = 'Pro' and subscription is active.
 */

const { getGlobalPrisma, getTenantPrisma } = require('../db');

const BATCH_SIZE = 100;

async function processPointExpiry(): Promise<void> {
    console.log('[Cron] Starting loyalty point expiry check...');
    const globalPrisma = getGlobalPrisma();

    try {
        // Get all active Pro tenants (only they have loyalty)
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
            include: {
                tenant: { select: { databaseName: true, id: true } },
            },
        });

        // Deduplicate by tenant (multiple outlets may share same tenant)
        const tenantMap = new Map<string, number>();
        for (const outlet of tenantOutlets) {
            if (outlet.tenant?.databaseName) {
                tenantMap.set(outlet.tenant.databaseName, outlet.tenant.id);
            }
        }

        let totalExpired = 0;

        for (const [dbName, tenantId] of tenantMap) {
            try {
                const expired = await expirePointsForTenant(dbName);
                if (expired > 0) {
                    console.log(`[Cron] Expired ${expired} point batches for tenant ${tenantId} (${dbName})`);
                    totalExpired += expired;
                }
            } catch (error) {
                console.error(`[Cron] Error processing point expiry for tenant ${dbName}:`, error);
            }
        }

        console.log(`[Cron] Point expiry complete. Total batches expired: ${totalExpired}`);
    } catch (error) {
        console.error('[Cron] Fatal error in point expiry job:', error);
    }
}

async function expirePointsForTenant(dbName: string): Promise<number> {
    const prisma = getTenantPrisma(dbName);
    const now = new Date();
    let totalExpired = 0;
    let cursor: number | undefined;

    // Process in batches using cursor-based pagination
    while (true) {
        const batches = await prisma.loyaltyPointBatch.findMany({
            where: {
                expiresAt: { lt: now },
                remainingPoints: { gt: 0 },
                deleted: false,
            },
            take: BATCH_SIZE,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
            orderBy: { id: 'asc' },
            select: {
                id: true,
                loyaltyAccountId: true,
                remainingPoints: true,
            },
        });

        if (batches.length === 0) break;

        // Group by account for efficient batch processing
        const accountBatches = new Map<number, typeof batches>();
        for (const batch of batches) {
            if (!accountBatches.has(batch.loyaltyAccountId)) {
                accountBatches.set(batch.loyaltyAccountId, []);
            }
            accountBatches.get(batch.loyaltyAccountId)!.push(batch);
        }

        // Process each account's expired batches in a transaction
        for (const [accountId, expiredBatches] of accountBatches) {
            await prisma.$transaction(async (tx: any) => {
                let totalExpiredPoints = 0;

                for (const batch of expiredBatches) {
                    const remaining = typeof batch.remainingPoints === 'number'
                        ? batch.remainingPoints
                        : Number(batch.remainingPoints);

                    // Zero out the batch
                    await tx.loyaltyPointBatch.update({
                        where: { id: batch.id },
                        data: { remainingPoints: 0 },
                    });

                    totalExpiredPoints += remaining;
                }

                if (totalExpiredPoints > 0) {
                    // Decrement account points (clamp to 0)
                    const account = await tx.loyaltyAccount.findUnique({
                        where: { id: accountId },
                        select: { currentPoints: true },
                    });
                    const currentPoints = typeof account.currentPoints === 'number'
                        ? account.currentPoints
                        : Number(account.currentPoints);
                    const newBalance = Math.max(currentPoints - totalExpiredPoints, 0);

                    await tx.loyaltyAccount.update({
                        where: { id: accountId },
                        data: { currentPoints: newBalance },
                    });

                    // Create EXPIRE transaction
                    await tx.loyaltyTransaction.create({
                        data: {
                            loyaltyAccountId: accountId,
                            type: 'EXPIRE',
                            points: -totalExpiredPoints,
                            balanceAfter: newBalance,
                            description: `${totalExpiredPoints} points expired`,
                            performedBy: 'system',
                        },
                    });
                }
            });
        }

        totalExpired += batches.length;
        cursor = batches[batches.length - 1].id;

        // If we got fewer than BATCH_SIZE, we're done
        if (batches.length < BATCH_SIZE) break;
    }

    return totalExpired;
}

export { processPointExpiry };
