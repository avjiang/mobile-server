/**
 * One-off data fix: settle ONE supplier invoice whose whole net amount is offset by a
 * rebate (supplier cash back), so no cash changes hands — the case the app refused
 * before 2026-09-29 ("Payment amount must be greater than zero").
 *
 *   npx ts-node src/script/settle_invoice_fully_offset.ts <tenantDbName> <invoiceId> \
 *       <settlementDate YYYY-MM-DD, tenant local> <siteId> [remark] [prod] [--apply]
 *
 * The settlement number is server-assigned (`SET-OUT{outlet}-{yyyyMMdd}-{seq}`, see
 * src/helpers/documentNumber.ts) under the invoice's outlet — needs the multi-outlet
 * migration (`document_sequence`) on the target DB.
 *
 * Without --apply it only prints the plan. With it, it calls the real
 * `invoiceSettlementService.createSettlement` (rebate = invoice net, settlementAmount 0,
 * paidAmount 0), so the rebate is distributed onto the invoice + its items exactly as
 * the app would, in one transaction. Prisma sets UPDATED_AT/CREATED_AT, so devices pick
 * the settlement and the Paid invoice up on their next delta sync.
 *
 * Guards: invoice must exist, be undeleted, status `Completed`, unsettled, with net > 0.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const isProd = args.includes('prod');
const [tenantDbName, invoiceIdArg, dateArg, siteIdArg, remarkArg] =
    args.filter(a => a !== '--apply' && a !== 'prod');

if (isProd) {
    if (!process.env.PROD_TENANT_DATABASE_URL || !process.env.PROD_GLOBAL_DB_URL) {
        throw new Error('Refusing: target is "prod" but PROD_*_DB_URL is unset — .env did not load');
    }
    process.env.TENANT_DATABASE_URL = process.env.PROD_TENANT_DATABASE_URL;
    process.env.GLOBAL_DB_URL = process.env.PROD_GLOBAL_DB_URL;
    console.log('Target: PRODUCTION (Azure)');
} else {
    console.log('Target: LOCAL');
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getTenantPrisma, disconnectAllPrismaClients } = require('../db');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const service = require('../invoice_settlement/invoice_settlement.service');

// Tenant-local midnight (WIB, UTC+7) — how the app stores settlement dates.
const localMidnightUtc = (ymd: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) throw new Error(`Refusing: bad date ${ymd}`);
    return new Date(new Date(`${ymd}T00:00:00.000Z`).getTime() - 7 * 3600 * 1000);
};

async function main() {
    if (!tenantDbName || !invoiceIdArg || !dateArg || !siteIdArg) {
        throw new Error('Usage: <tenantDbName> <invoiceId> <YYYY-MM-DD> <siteId> [remark] [prod] [--apply]');
    }
    const prisma = getTenantPrisma(tenantDbName);
    const invoiceId = Number(invoiceIdArg);

    const inv = await prisma.invoice.findFirst({ where: { id: invoiceId } });
    if (!inv) throw new Error(`Refusing: no invoice with ID ${invoiceId}`);
    if (inv.deleted) throw new Error('Refusing: invoice is deleted');
    if (inv.status !== 'Completed') throw new Error(`Refusing: invoice status is ${inv.status}, not Completed`);
    if (inv.invoiceSettlementId !== null) throw new Error(`Refusing: already in settlement ${inv.invoiceSettlementId}`);

    const net = Number(inv.totalAmount) - Number(inv.downPaymentApplied || 0);
    if (!(net > 0)) throw new Error(`Refusing: invoice net is ${net}`);

    const settlement = {
        settlementDate: localMidnightUtc(dateArg),
        settlementType: 'PAYMENT',
        paymentMethod: undefined,
        settlementAmount: 0,
        paidAmount: 0,
        transferFeeAmount: 0,
        currency: inv.currency || 'IDR',
        exchangeRate: 1,
        remark: remarkArg || undefined,
        status: 'COMPLETED',
        siteId: Number(siteIdArg),
        totalRebateAmount: net,
        totalInvoiceCount: 1,
        totalInvoiceAmount: net,
        invoiceIds: [invoiceId],
        invoiceTaxNumbers: [0],
    };

    console.log('--- INVOICE (before) ---');
    console.log({ id: inv.id, number: inv.invoiceNumber, status: inv.status, totalAmount: String(inv.totalAmount),
        downPaymentApplied: String(inv.downPaymentApplied), supplierId: inv.supplierId, outletId: inv.outletId });
    console.log('--- SETTLEMENT TO CREATE ---');
    console.log(settlement);

    if (!apply) {
        console.log('\nDRY RUN — nothing written. Re-run with --apply to create it.');
        await disconnectAllPrismaClients();
        return;
    }

    const created = await service.createSettlement(tenantDbName, { settlements: [settlement] });
    const after = await prisma.invoice.findFirst({ where: { id: invoiceId } });
    console.log('--- CREATED ---');
    console.log(JSON.stringify(created, (_k, x) => (typeof x === 'bigint' ? x.toString() : x), 2).slice(0, 1500));
    console.log('--- INVOICE (after) ---');
    console.log({ status: after.status, paymentDate: after.paymentDate, invoiceSettlementId: after.invoiceSettlementId,
        totalAmount: String(after.totalAmount), discountAmount: String(after.discountAmount), remark: after.remark });
    await disconnectAllPrismaClients();
}

main().catch(async (e) => {
    console.error(e);
    try { await disconnectAllPrismaClients(); } catch { /* ignore */ }
    process.exit(1);
});
