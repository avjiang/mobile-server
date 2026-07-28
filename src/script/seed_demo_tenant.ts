/**
 * Provision / reseed the "Coba Demo" tenants.
 *
 *   node dist/script/seed_demo_tenant.js <local|prod> [retail|laundry|both]
 *
 * Examples:
 *   node dist/script/seed_demo_tenant.js local both
 *   node dist/script/seed_demo_tenant.js prod retail
 *
 * Creates the tenant if it does not exist (Pro / Retail|Laundry, login = tenant name,
 * password = tenant name), then wipes and rebuilds its data. Safe to re-run: the seed
 * IS the reset. Additive with respect to real tenants — it only ever touches
 * demo_retail / demo_laundry.
 *
 * ⚠️ Run `npm run backup_db_prod` before the first prod run, per the standing rule.
 *
 * The nightly 04:00 cron calls the same service with createIfMissing:false, so this
 * script is only needed for provisioning and for forcing a mid-day reset.
 */
import dotenv from 'dotenv';

dotenv.config();

type Target = 'local' | 'prod';

const target = (process.argv[2] as Target) || 'local';
const which = (process.argv[3] || 'both').toLowerCase();

if (!['local', 'prod'].includes(target)) {
    console.error(`Unknown target "${target}". Usage: seed_demo_tenant.js <local|prod> [retail|laundry|both]`);
    process.exit(1);
}
if (!['retail', 'laundry', 'both'].includes(which)) {
    console.error(`Unknown vertical "${which}". Use retail, laundry, or both.`);
    process.exit(1);
}

if (target === 'prod') {
    if (!process.env.PROD_GLOBAL_DB_URL || !process.env.PROD_TENANT_DATABASE_URL) {
        console.error('Missing PROD_GLOBAL_DB_URL or PROD_TENANT_DATABASE_URL in .env');
        process.exit(1);
    }
    process.env.GLOBAL_DB_URL = process.env.PROD_GLOBAL_DB_URL;
    process.env.TENANT_DATABASE_URL = process.env.PROD_TENANT_DATABASE_URL;
    console.log('Target: PROD');
} else {
    console.log('Target: LOCAL');
}

// Load AFTER the env override so the Prisma clients resolve to the chosen target.
const { seedDemoTenant } = require('../demo/demo-seed.service') as typeof import('../demo/demo-seed.service');
const { disconnectAllPrismaClients } = require('../db') as typeof import('../db');

async function run() {
    const verticals: Array<'retail' | 'laundry'> =
        which === 'both' ? ['retail', 'laundry'] : [which as 'retail' | 'laundry'];

    for (const vertical of verticals) {
        const started = Date.now();
        const r = await seedDemoTenant(vertical, { createIfMissing: true });
        console.log(
            `\n${r.created ? 'Provisioned' : 'Reseeded'} ${r.tenantName} (${r.databaseName}) in ${((Date.now() - started) / 1000).toFixed(1)}s\n` +
            `  items: ${r.items}  customers: ${r.customers}  sales: ${r.sales}  revenue: Rp ${r.revenue.toLocaleString('id-ID')}\n` +
            `  login: ${r.tenantName} / ${r.tenantName}`,
        );
    }
}

if (require.main === module) {
    run()
        .catch((error) => {
            console.error('Failed:', error);
            process.exitCode = 1;
        })
        .finally(async () => {
            await disconnectAllPrismaClients();
            process.exit(process.exitCode ?? 0);
        });
}
