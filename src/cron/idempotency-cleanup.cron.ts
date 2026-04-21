/**
 * Idempotency Record Cleanup Cron Job
 *
 * Runs daily to delete idempotency records older than 24 hours. The FE
 * outbox gives up on a queued write far earlier than 24h (max retry count
 * × max backoff ≈ 1.5h) so anything still sitting in the table past a day
 * is guaranteed dead weight from a successful request that's already been
 * replayed back to the client.
 *
 * Runs across every tenant DB. Cheap on well-kept tables — an index on
 * CREATED_AT means the DELETE ... WHERE CREATED_AT < ? is a range scan.
 */

const { getGlobalPrisma, getTenantPrisma } = require('../db');

const RETENTION_HOURS = 24;

async function processIdempotencyCleanup(): Promise<void> {
    console.log('[Cron] Starting idempotency record cleanup...');
    const globalPrisma = getGlobalPrisma();
    const cutoff = new Date(Date.now() - RETENTION_HOURS * 60 * 60 * 1000);

    try {
        const tenants = await globalPrisma.tenant.findMany({
            where: { databaseName: { not: null } },
            select: { id: true, databaseName: true },
        });

        let totalDeleted = 0;
        for (const tenant of tenants) {
            if (!tenant.databaseName) continue;
            try {
                const prisma = getTenantPrisma(tenant.databaseName);
                const { count } = await prisma.idempotencyRecord.deleteMany({
                    where: { createdAt: { lt: cutoff } },
                });
                totalDeleted += count;
                if (count > 0) {
                    console.log(
                        `[Cron] ${tenant.databaseName}: deleted ${count} expired idempotency records`
                    );
                }
            } catch (err) {
                console.error(
                    `[Cron] Failed cleanup for ${tenant.databaseName}:`,
                    err
                );
            }
        }

        console.log(
            `[Cron] Idempotency cleanup complete. Total deleted: ${totalDeleted}`
        );
    } catch (err) {
        console.error('[Cron] Idempotency cleanup failed:', err);
    }
}

export { processIdempotencyCleanup };
