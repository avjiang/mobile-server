/**
 * One-off data fix: restore the missing down-payment draw rate on a PurchaseOrder.
 *
 *   npx ts-node src/script/fix_po_dp_rate.ts <tenantDbName> <poId> <ratePercent> [prod]
 *
 * Guards: refuses to run unless the PO currently has a NULL/0 rate and a positive
 * downPaymentAmount — so a re-run is a no-op rather than a silent overwrite.
 * Bumps VERSION (so delta sync pushes it to devices) and UPDATED_AT (raw-SQL rule).
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
// Resolve .env from the repo root, not the caller's cwd — this script may be run
// from anywhere, and a missed .env silently points the fix at the LOCAL database.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const [, , tenantDbName, poIdArg, rateArg, target] = process.argv;
if (target === 'prod') {
    // Fail loudly rather than silently falling through to the local DB.
    if (!process.env.PROD_TENANT_DATABASE_URL || !process.env.PROD_GLOBAL_DB_URL) {
        throw new Error('Refusing: target is "prod" but PROD_*_DB_URL is unset — .env did not load');
    }
    process.env.TENANT_DATABASE_URL = process.env.PROD_TENANT_DATABASE_URL;
    process.env.GLOBAL_DB_URL = process.env.PROD_GLOBAL_DB_URL;
    console.log('Target: PRODUCTION (Azure)');
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getTenantPrisma, disconnectAllPrismaClients } = require('../db');

const j = (v: any) => JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x), 2);

async function main() {
    const prisma = getTenantPrisma(tenantDbName);
    const poId = Number(poIdArg);
    const rate = Number(rateArg);

    if (!(rate > 0 && rate <= 100)) throw new Error(`Refusing: rate ${rateArg} is out of range`);

    const before = await prisma.purchaseOrder.findFirst({ where: { id: poId } });
    if (!before) throw new Error(`Refusing: no purchase_order with ID ${poId}`);

    console.log('--- BEFORE ---');
    console.log(j({
        id: before.id, number: before.purchaseOrderNumber, status: before.status, deleted: before.deleted,
        totalAmount: before.totalAmount, downPaymentPercentage: before.downPaymentPercentage,
        downPaymentAmount: before.downPaymentAmount, downPaymentApplied: before.downPaymentApplied,
        version: before.version, updatedAt: before.updatedAt,
    }));

    if (before.downPaymentPercentage !== null && Number(before.downPaymentPercentage) > 0) {
        console.log(`\nNO-OP: PO already has a draw rate of ${before.downPaymentPercentage}%. Nothing written.`);
        await disconnectAllPrismaClients();
        return;
    }
    if (!(Number(before.downPaymentAmount || 0) > 0)) {
        throw new Error('Refusing: PO has no down-payment amount, so a draw rate would be meaningless');
    }

    // Raw SQL so UPDATED_AT is set explicitly (Prisma @updatedAt is ORM-only) and
    // VERSION is bumped for delta sync.
    const affected = await prisma.$executeRaw`
        UPDATE purchase_order
        SET DOWN_PAYMENT_PERCENTAGE = ${rate},
            VERSION = VERSION + 1,
            UPDATED_AT = NOW()
        WHERE ID = ${poId}
          AND IS_DELETED = 0
          AND DOWN_PAYMENT_PERCENTAGE IS NULL
    `;
    console.log(`\nRows affected: ${affected}`);

    const after = await prisma.purchaseOrder.findFirst({ where: { id: poId } });
    console.log('\n--- AFTER ---');
    console.log(j({
        id: after.id, number: after.purchaseOrderNumber,
        downPaymentPercentage: after.downPaymentPercentage,
        downPaymentAmount: after.downPaymentAmount, downPaymentApplied: after.downPaymentApplied,
        version: after.version, updatedAt: after.updatedAt,
    }));

    const balance = Number(after.downPaymentAmount) - Number(after.downPaymentApplied);
    const fullDrawTotal = balance / (rate / 100);
    console.log(`\nDP balance available to draw: ${balance.toLocaleString()}`);
    console.log(
        `At ${rate}%, an invoice of ${Math.round(fullDrawTotal).toLocaleString()} or more ` +
        `draws the whole remaining balance; a smaller invoice draws ${rate}% of its own total.`
    );

    await disconnectAllPrismaClients();
}
main().catch(async (e) => { console.error(e); await disconnectAllPrismaClients(); process.exit(1); });
