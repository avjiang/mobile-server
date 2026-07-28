/**
 * Nightly reset of the "Coba Demo" tenants.
 *
 * The demo tenants are SHARED — every prospect logs into the same two accounts — so
 * whatever one prospect does during the day is what the next one sees. This job rebuilds
 * the pristine baseline overnight.
 *
 * Runs with `createIfMissing:false`: on any environment where the demo tenants were never
 * provisioned (a dev machine, a fresh deploy) this is a silent no-op. The alternative —
 * auto-creating them — would mean a routine deploy quietly manufacturing tenants in
 * production.
 *
 * See docs/modules/DEMO_STARTER_KIT.md.
 */
import { resetDemoTenants } from '../demo/demo-seed.service';

export async function processDemoReset(): Promise<void> {
    const started = Date.now();
    const results = await resetDemoTenants();
    const seeded = results.filter(r => !r.skipped);

    if (seeded.length === 0) {
        // Expected everywhere the demo was never provisioned — not a warning.
        console.log('[Cron] Demo reset: no demo tenants provisioned, nothing to do.');
        return;
    }
    console.log(
        `[Cron] Demo reset complete in ${((Date.now() - started) / 1000).toFixed(1)}s — ` +
        seeded.map(r => `${r.tenantName} (${r.sales} sales)`).join(', '),
    );
}
