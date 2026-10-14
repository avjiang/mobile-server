/**
 * Idempotency Record Cleanup Cron Job
 *
 * Runs daily to delete idempotency records older than 24 hours.
 *
 * The FE outbox depends on this retention. It waits out a device outage of
 * any length, so it does not give up after a fixed number of retries.
 *   - Checkouts and payments don't need these records past 24h: the key is
 *     also stored on the row (sales/payment.CLIENT_REF, see
 *     sales/client-ref.ts), so a replay of any age is deduped there.
 *   - Every other write is auto-replayed only within 20h of queueing
 *     (`OutboxRepository.replayWindow`). Older entries are stopped for a
 *     manager to check, because the record that would dedupe the replay may
 *     be gone. Do not shorten RETENTION_HOURS without first shortening the FE
 *     window, which keeps a 4h margin for clock skew.
 *
 * Runs across every tenant DB. Cheap on well-kept tables — an index on
 * CREATED_AT means the DELETE ... WHERE CREATED_AT < ? is a range scan.
 */

const { getGlobalPrisma, getTenantPrisma, disconnectTenantClient, databasesOnServer } = require('../db');

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
        const onServer: Set<string> = await databasesOnServer();
        for (const tenant of tenants) {
            if (!tenant.databaseName || !onServer.has(tenant.databaseName)) continue;
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
            } finally {
                // Release this tenant's client so its connections don't
                // accumulate across the whole-fleet sweep (see db.ts).
                await disconnectTenantClient(tenant.databaseName);
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
