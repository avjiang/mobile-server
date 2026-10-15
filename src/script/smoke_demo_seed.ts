/**
 * End-to-end check of the Demo Starter Kit seeder against local demo tenants.
 *
 * Covers the three things that would silently ruin a live demo: the data not being
 * reproducible (so today's demo differs from yesterday's screenshots), the reports
 * coming up empty (the whole point of seeding), and the login not working.
 *
 * Usage: npx ts-node src/script/smoke_demo_seed.ts
 * Requires the local demo tenants; provisions them if missing.
 */
import crypto from 'crypto';
import { seedDemoTenant, resetDemoTenants, DEMO_TENANTS } from '../demo/demo-seed.service';
import { LOYALTY_TARGETS, DEMO_CASHIERS, RETAIL_SHOP } from '../demo/demo-catalogue';
import { listEvents, getEvent } from '../anomaly/anomaly.queries';
import { getTenantPrisma } from '../db';
import reportService from '../report/report.service';
import monthlySummaryService from '../report/monthly-summary.service';

const authService = require('../auth/auth.service');

const WIB = 7 * 60;
let pass = 0, fail = 0;

function check(name: string, cond: boolean, detail = '') {
    if (cond) { pass++; console.log(`  ✅ ${name}`); }
    else { fail++; console.log(`  ❌ ${name} ${detail}`); }
}

/** The last 10 local (WIB) calendar days, as the UTC instants a report would use. */
function reportWindow() {
    const s = new Date(Date.now() + WIB * 60_000);
    return {
        start: new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate() - 9, 0, 0, 0, 0) - WIB * 60_000),
        end: new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate(), 23, 59, 59, 999) - WIB * 60_000),
    };
}

async function fingerprint(db: string) {
    const p: any = getTenantPrisma(db);
    const [sales, lines, pays, bal] = await Promise.all([
        p.sales.findMany({ orderBy: { id: 'asc' }, select: { id: true, businessDate: true, totalAmount: true, profitAmount: true, customerId: true, friendlyNumber: true, orderRef: true } }),
        p.salesItem.findMany({ orderBy: { id: 'asc' }, select: { salesId: true, itemId: true, quantity: true, loadWeightKg: true, itemStatus: true } }),
        p.payment.findMany({ orderBy: { id: 'asc' }, select: { salesId: true, method: true, paidAmount: true } }),
        p.stockBalance.findMany({ orderBy: { itemId: 'asc' }, select: { itemId: true, availableQuantity: true } }),
    ]);
    return {
        hash: crypto.createHash('sha256').update(JSON.stringify({ sales, lines, pays, bal })).digest('hex').slice(0, 16),
        sales: sales.length, lines: lines.length,
    };
}

const bad = (r: any) => Number(r[0].c);

(async () => {
    for (const vertical of ['retail', 'laundry'] as const) {
        const db = `demo_${vertical}_db`;
        console.log(`\n── ${DEMO_TENANTS[vertical].tenantName} ──`);

        console.log('\n1. Seed is reproducible (a reseed must not change the shop)');
        await seedDemoTenant(vertical, { createIfMissing: true });
        const a = await fingerprint(db);
        await seedDemoTenant(vertical, { createIfMissing: true });
        const b = await fingerprint(db);
        check('reseed is byte-identical', a.hash === b.hash, `${a.hash} vs ${b.hash}`);
        check('sales present', a.sales > 50, `got ${a.sales}`);
        check('sales lines present', a.lines > a.sales, `got ${a.lines}`);

        console.log('\n2. Referential + arithmetic integrity');
        const p: any = getTenantPrisma(db);
        check('no orphan sales lines',
            bad(await p.$queryRawUnsafe('SELECT COUNT(*) c FROM sales_item si LEFT JOIN sales s ON s.ID=si.SALES_ID WHERE s.ID IS NULL')) === 0);
        check('every item has a supplier junction row',
            bad(await p.$queryRawUnsafe('SELECT COUNT(*) c FROM item i LEFT JOIN item_supplier x ON x.ITEM_ID=i.ID WHERE x.ID IS NULL')) === 0);
        check('no negative stock',
            bad(await p.$queryRawUnsafe('SELECT COUNT(*) c FROM stock_balance WHERE AVAILABLE_QUANTITY < 0')) === 0);
        // A manual order discount (the security-alert story) sits between the two: lines sum
        // to the subtotal, the total is the subtotal less the order discount (as POST /sales stores it).
        check('sale subtotal == sum of its lines, total == subtotal − order discount',
            bad(await p.$queryRawUnsafe('SELECT COUNT(*) c FROM sales s JOIN (SELECT SALES_ID, SUM(SUBTOTAL_AMOUNT) t FROM sales_item GROUP BY SALES_ID) x ON x.SALES_ID=s.ID WHERE ABS(s.SUBTOTAL_AMOUNT - x.t) > 0.01 OR ABS(s.TOTAL_AMOUNT - (s.SUBTOTAL_AMOUNT - s.DISCOUNT_AMOUNT)) > 0.01')) === 0);
        // PRICE is the LINE total (unit × qty), what POST /sales writes; with no
        // discount on a demo line it equals the line's SUBTOTAL_AMOUNT.
        check('line PRICE is the line total (== SUBTOTAL_AMOUNT)',
            bad(await p.$queryRawUnsafe('SELECT COUNT(*) c FROM sales_item WHERE STOCK_CONSUMPTION_QTY IS NULL AND ABS(PRICE - SUBTOTAL_AMOUNT) > 0.01')) === 0);
        // Laundry orders can be unpaid until collection (paid = 0 → no payment row, by design).
        check('every sale that took money has a payment',
            bad(await p.$queryRawUnsafe('SELECT COUNT(*) c FROM sales s LEFT JOIN payment pm ON pm.SALES_ID=s.ID WHERE pm.ID IS NULL AND s.PAID_AMOUNT > 0')) === 0);
        check('sales.paidAmount == sum of its payments',
            bad(await p.$queryRawUnsafe('SELECT COUNT(*) c FROM sales s LEFT JOIN (SELECT SALES_ID, SUM(PAID_AMOUNT) t FROM payment GROUP BY SALES_ID) x ON x.SALES_ID=s.ID WHERE ABS(s.PAID_AMOUNT - COALESCE(x.t,0)) > 0.01')) === 0);
        check('status matches paid (Completed ⇔ paid in full), voids aside',
            bad(await p.$queryRawUnsafe("SELECT COUNT(*) c FROM sales WHERE STATUS <> 'Voided' AND (STATUS='Completed') <> (PAID_AMOUNT >= TOTAL_AMOUNT)")) === 0);
        check('orderRef unique',
            bad(await p.$queryRawUnsafe('SELECT COUNT(*) c FROM (SELECT ORDER_REF FROM sales WHERE ORDER_REF IS NOT NULL GROUP BY ORDER_REF HAVING COUNT(*)>1) t')) === 0);

        console.log('\n3. The outlet report — what the prospect actually opens');
        const { start, end } = reportWindow();
        const r: any = await (reportService as any).generateOutletReport(db, 1, start, end, vertical === 'laundry' ? 'Laundry' : 'Retail');
        check('revenue > 0', r.totalRevenue > 0, `got ${r.totalRevenue}`);
        check('profit > 0 and below revenue', r.totalProfit > 0 && r.totalProfit < r.totalRevenue, `got ${r.totalProfit}`);
        check('payment breakdown has >1 method', (r.paymentBreakdown ?? []).length > 1, `got ${(r.paymentBreakdown ?? []).length}`);
        check('top-selling items populated', (r.topSellingItems ?? []).length >= 5, `got ${(r.topSellingItems ?? []).length}`);
        check('top-selling categories populated', (r.topSellingCategories ?? []).length >= 3, `got ${(r.topSellingCategories ?? []).length}`);

        if (vertical === 'laundry') {
            const ops = r.laundryOps;
            check('laundryOps present', !!ops);
            check('kg processed > 0', ops?.totalKgProcessed > 0, `got ${ops?.totalKgProcessed}`);
            check('jasa counted separately from loads', ops?.totalJasa > 0 && ops?.totalLoads > 0, `loads ${ops?.totalLoads} jasa ${ops?.totalJasa}`);
            // The trap this guards: multiplying loadWeightKg by line quantity while the
            // report counts one LINE as one load, which silently inflates avg kg/load
            // past the machine's physical capacity.
            check('avg kg/load within machine capacity (<= 6kg)',
                ops?.averageKgPerLoad > 2 && ops?.averageKgPerLoad <= 6, `got ${ops?.averageKgPerLoad}`);
            const wip = await p.salesItem.count({ where: { itemStatus: { in: ['INTAKE', 'PROCESSING', 'READY'] } } });
            check('pickup screen has work-in-progress orders', wip > 0, `got ${wip}`);
            // Pay-at-pickup: a collected order that left a DP (or nothing) at drop-off paid
            // the balance when it was picked up — dated at COLLECTED_AT, not at the sale.
            const lateRows = bad(await p.$queryRawUnsafe('SELECT COUNT(*) c FROM payment pm JOIN sales s ON s.ID=pm.SALES_ID WHERE pm.CREATED_AT > s.CREATED_AT + INTERVAL 1 MINUTE'));
            const lateMisdated = bad(await p.$queryRawUnsafe('SELECT COUNT(*) c FROM payment pm JOIN sales s ON s.ID=pm.SALES_ID WHERE pm.CREATED_AT > s.CREATED_AT + INTERVAL 1 MINUTE AND (s.COLLECTED_AT IS NULL OR pm.CREATED_AT <> s.COLLECTED_AT OR pm.BUSINESS_DATE <> s.COLLECTED_AT)'));
            check('some balances were paid at pickup', lateRows > 0, `got ${lateRows}`);
            check('every pickup payment is dated at COLLECTED_AT', lateMisdated === 0, `got ${lateMisdated}`);
            const owing = await p.sales.count({ where: { status: 'Partially Paid', collectedAt: null } });
            check('uncollected orders still owe (Partially Paid)', owing > 0, `got ${owing}`);
            check('no collected order left unpaid',
                (await p.sales.count({ where: { status: 'Partially Paid', collectedAt: { not: null } } })) === 0);
            const summary = await monthlySummaryService.generateMonthlySummary(db, 1, start, end, 'Laundry');
            check('monthly summary: collected at pickup > Rp 0', summary.collectedLater.amount > 0,
                `got Rp ${summary.collectedLater.amount} (${summary.collectedLater.count} orders)`);
        } else {
            const low = bad(await p.$queryRawUnsafe('SELECT COUNT(*) c FROM stock_balance WHERE REORDER_THRESHOLD IS NOT NULL AND AVAILABLE_QUANTITY <= REORDER_THRESHOLD'));
            check('dashboard low-stock list is not empty', low > 0, `got ${low}`);
            check('stock movements recorded for sales',
                (await p.stockMovement.count({ where: { movementType: 'Sales' } })) > 0);
        }

        console.log('\n3b. Loyalty baseline — what real-UI captures script against');
        check('one loyalty programme', (await p.loyaltyProgram.count()) === 1);
        check('one reward rule (Rp 500rb milestone)', (await p.rewardRule.count()) === 1);
        const tierCount = await p.loyaltyTier.count();
        check(vertical === 'laundry' ? 'three tiers (Perunggu/Perak/Emas)' : 'no tiers (retail plan lacks Advanced Loyalty)',
            tierCount === (vertical === 'laundry' ? 3 : 0), `got ${tierCount}`);
        const customers = await p.customer.findMany({ orderBy: { id: 'asc' } });
        for (const [idx, spend, pts] of LOYALTY_TARGETS) {
            const acc = await p.loyaltyAccount.findFirst({ where: { customerId: customers[idx].id } });
            check(`${customers[idx].firstName} ends at Rp ${spend} / ${pts} poin`,
                Number(acc?.totalSpend) === spend && Number(acc?.currentPoints) === pts,
                `got Rp ${acc?.totalSpend} / ${acc?.currentPoints}`);
        }
        check('point batches reconcile with account balances (FIFO intact)',
            bad(await p.$queryRawUnsafe('SELECT COUNT(*) c FROM loyalty_account a LEFT JOIN (SELECT LOYALTY_ACCOUNT_ID id, SUM(REMAINING_POINTS) r FROM loyalty_point_batch GROUP BY LOYALTY_ACCOUNT_ID) b ON b.id=a.ID WHERE ABS(a.CURRENT_POINTS - COALESCE(b.r,0)) > 0.0001')) === 0);
        check('vouchers == floor(spend / threshold) per customer (next sale issues no burst)',
            bad(await p.$queryRawUnsafe('SELECT COUNT(*) c FROM loyalty_account a JOIN reward_rule r ON 1=1 LEFT JOIN (SELECT CUSTOMER_ID id, COUNT(*) n FROM voucher GROUP BY CUSTOMER_ID) v ON v.id=a.CUSTOMER_ID WHERE COALESCE(v.n,0) <> FLOOR(a.TOTAL_SPEND / r.SPEND_THRESHOLD)')) === 0);
        check('no English / RM text in loyalty rows',
            bad(await p.$queryRawUnsafe("SELECT (SELECT COUNT(*) FROM loyalty_transaction WHERE DESCRIPTION LIKE '%Earned%') + (SELECT COUNT(*) FROM voucher WHERE LABEL LIKE '% off%' OR LABEL LIKE '%RM %') c")) === 0);

        console.log('\n3c. Security alerts — written by the real anomaly engine');
        if (vertical === 'retail') {
            const outlet = await p.outlet.findFirst({ where: { deleted: false }, orderBy: { id: 'asc' } });
            check(`outlet is named "${RETAIL_SHOP.outletName}" (no English in alert copy)`, outlet?.outletName === RETAIL_SHOP.outletName, `got ${outlet?.outletName}`);
            const cashiers = await p.user.findMany({ where: { username: { in: DEMO_CASHIERS.map((c) => c.username) } } });
            check('two cashiers, once each (preserved table, upserted)', cashiers.length === 2, `got ${cashiers.length}`);
            check('within Pro\'s 3 free users', (await p.user.count({ where: { deleted: false } })) <= 3);
            const rule = await p.anomalyRuleConfig.findUnique({ where: { ruleId: 'REVERSAL_BURST' } });
            check('owner limit: 2 voids per cashier a day', (rule?.params as any)?.maxPerDay === 2, `got ${JSON.stringify(rule?.params)}`);

            const { events } = await listEvents(p, null, { limit: 30 });
            const byRule = new Map<string, any>(events.map((e: any) => [e.ruleId, e]));
            check('exactly three alerts', events.length === 3, `got ${events.map((e: any) => e.ruleId).join(', ')}`);
            const burst = byRule.get('REVERSAL_BURST');
            check('"Andi membatalkan 3 transaksi hari ini" (CRITICAL, open)',
                burst?.title?.id === 'Andi membatalkan 3 transaksi hari ini' && burst?.severity === 'CRITICAL' && burst?.status === 'OPEN',
                `got ${burst?.title?.id} / ${burst?.severity} / ${burst?.status}`);
            check('burst body: Rp 168.000 · limit 2 · outlet',
                burst?.body?.id === `Total Rp 168.000 · batas Anda 2 per hari · ${RETAIL_SHOP.outletName}`, `got ${burst?.body?.id}`);
            check('quick void: cash, 6 minutes after payment',
                byRule.get('QUICK_REVERSAL')?.title?.id === 'Andi membatalkan penjualan tunai 6 menit setelah dibayar', `got ${byRule.get('QUICK_REVERSAL')?.title?.id}`);
            check('large discount: Sari, 30 %',
                byRule.get('LARGE_DISCOUNT')?.title?.id === 'Sari memberi diskon 30% pada satu penjualan', `got ${byRule.get('LARGE_DISCOUNT')?.title?.id}`);
            check('no below-cost alert from the discounted sale', !byRule.has('BELOW_COST'));
            check('newest first: the burst tops the list', events[0]?.ruleId === 'REVERSAL_BURST', `got ${events[0]?.ruleId}`);
            const wibDay = (d: Date) => new Date(d.getTime() + WIB * 60_000).toISOString().slice(0, 10);
            check('every alert is dated today (WIB) at its action, not at seed time',
                events.every((e: any) => wibDay(new Date(e.createdAt)) === wibDay(new Date()) && new Date(e.lastOccurredAt).getTime() === new Date(e.updatedAt).getTime()),
                JSON.stringify(events.map((e: any) => [e.ruleId, e.createdAt, e.lastOccurredAt, e.updatedAt])));
            const detail: any = burst ? await getEvent(p, null, burst.id) : null;
            const sales = detail?.sales ?? [];
            check('burst detail lists the 3 voided sales, each with who and why',
                sales.length === 3 && sales.every((s: any) => s.status === 'Voided' && s.reversedBy === 'Andi' && s.reversalReasonCode && s.reversedAt),
                JSON.stringify(sales.map((s: any) => [s.id, s.status, s.reversedBy, s.reversalReasonCode])));
            check('voids restored their stock (Sales Void movements)',
                (await p.stockMovement.count({ where: { movementType: 'Sales Void' } })) === 5, 'expected the 5 voided lines put back');
            const voidedPays = bad(await p.$queryRawUnsafe("SELECT COUNT(*) c FROM payment pm JOIN sales s ON s.ID=pm.SALES_ID WHERE s.STATUS='Voided' AND pm.STATUS<>'Voided'"));
            check('voided sales have voided payments', voidedPays === 0, `got ${voidedPays}`);
        } else {
            check('no alerts seeded on laundry', (await p.anomalyEvent.count()) === 0);
        }

        console.log('\n4. Login works with the credentials the FE hard-codes');
        const username = DEMO_TENANTS[vertical].tenantName;
        let loggedIn = false;
        try {
            const auth = await authService.authenticate({ username, password: username }, '127.0.0.1');
            loggedIn = !!(auth?.accessToken || auth?.token || auth?.jwtToken);
        } catch (e: any) { loggedIn = false; console.log(`     (login error: ${e.message})`); }
        check(`${username} / ${username} authenticates`, loggedIn);
    }

    console.log('\n5. The nightly cron path (createIfMissing:false) reseeds existing tenants');
    const results = await resetDemoTenants();
    check('both demo tenants reset', results.filter(r => !r.skipped).length === 2, `got ${results.filter(r => !r.skipped).length}`);
    check('cron reported sales for each', results.every(r => r.skipped || r.sales > 0));

    console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'} — ${pass} passed, ${fail} failed\n`);
    process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('\nFATAL:', e); process.exit(1); });
