/**
 * Cron Manager
 * Initializes and manages all scheduled background jobs.
 * Called from src/index.ts after server starts.
 */

// @ts-ignore
import cron from 'node-cron';
import { processPointExpiry } from './loyalty-expiry.cron';
import { processSubscriptionExpiry } from './subscription-expiry.cron';
import { processIdempotencyCleanup } from './idempotency-cleanup.cron';
import { processPlanReminders } from './plan-reminder.cron';
import { processLoyaltyFollowUps } from './loyalty-follow-up.cron';
import { processAnomalyDaily } from './anomaly-daily.cron';

// Business timezone (WIB, as in helpers/documentNumber.ts). Without it node-cron uses the host clock, which is UTC on
// both the Oracle VM and Azure, so "2:00 AM" ran at 09:00 WIB / 10:00 MYT, in opening hours (fixed 2026-10-14).
const SCHEDULE = { timezone: 'Asia/Jakarta' };

function initCronJobs(): void {
    console.log('[Cron] Initializing cron jobs...');

    // Point expiry — daily at 00:00 WIB
    cron.schedule('0 0 * * *', async () => {
        try {
            await processPointExpiry();
        } catch (error) {
            console.error('[Cron] Unhandled error in point expiry:', error);
        }
    }, SCHEDULE);

    // Subscription expiry — daily at 00:30 WIB
    cron.schedule('30 0 * * *', async () => {
        try {
            await processSubscriptionExpiry();
        } catch (error) {
            console.error('[Cron] Unhandled error in subscription expiry:', error);
        }
    }, SCHEDULE);

    // Idempotency record cleanup — daily at 01:00 WIB
    cron.schedule('0 1 * * *', async () => {
        try {
            await processIdempotencyCleanup();
        } catch (error) {
            console.error('[Cron] Unhandled error in idempotency cleanup:', error);
        }
    }, SCHEDULE);

    // Owner pushes — daily at 09:00 WIB (shop hours): plan reminder, then loyalty
    // follow-ups. Each in its own try/catch so one failing doesn't skip the other.
    cron.schedule('0 9 * * *', async () => {
        try {
            await processPlanReminders();
        } catch (error) {
            console.error('[Cron] Unhandled error in plan reminders:', error);
        }
        try {
            await processLoyaltyFollowUps();
        } catch (error) {
            console.error('[Cron] Unhandled error in loyalty follow-ups:', error);
        }
    }, SCHEDULE);

    // Security alerts nightly — every hour 17:05–23:05 WIB; each tenant is handled
    // at its own closing-report hour (anomaly rule DAILY_REPORT, default 21).
    cron.schedule('5 17-23 * * *', async () => {
        try {
            await processAnomalyDaily();
        } catch (error) {
            console.error('[Cron] Unhandled error in security nightly:', error);
        }
    }, SCHEDULE);

    console.log('[Cron] Cron jobs initialized: point-expiry 00:00, subscription-expiry 00:30, idempotency-cleanup 01:00, plan-reminder + loyalty-follow-up 09:00, security-nightly 17:05–23:05 hourly (Asia/Jakarta)');
}

export { initCronJobs };
