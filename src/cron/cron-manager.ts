/**
 * Cron Manager
 * Initializes and manages all scheduled background jobs.
 * Called from src/index.ts after server starts.
 */

// @ts-ignore
import cron from 'node-cron';
import { processPointExpiry } from './loyalty-expiry.cron';
import { processSubscriptionExpiry } from './subscription-expiry.cron';

function initCronJobs(): void {
    console.log('[Cron] Initializing cron jobs...');

    // Point expiry — daily at 2:00 AM
    cron.schedule('0 2 * * *', async () => {
        try {
            await processPointExpiry();
        } catch (error) {
            console.error('[Cron] Unhandled error in point expiry:', error);
        }
    });

    // Subscription expiry — daily at 2:30 AM
    cron.schedule('30 2 * * *', async () => {
        try {
            await processSubscriptionExpiry();
        } catch (error) {
            console.error('[Cron] Unhandled error in subscription expiry:', error);
        }
    });

    console.log('[Cron] Cron jobs initialized: point-expiry (2:00 AM), subscription-expiry (2:30 AM)');
}

export { initCronJobs };
