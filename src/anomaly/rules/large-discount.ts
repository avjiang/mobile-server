/**
 * LARGE_DISCOUNT — the manual discount on one sale (line discounts + order
 * discount; never loyalty / voucher / package) is above `maxPercent` of the
 * sale's gross (Σ price × qty), or an offline sale over the cashier cap was
 * accepted late (manual-discount.ts `accept-late`).
 */
import { Decimal } from 'decimal.js';
import { getRule, RULE_ID } from '../registry';
import { AnomalyActor, Finding, saleLabel } from './types';

export interface LargeDiscountContext {
    actor: AnomalyActor;
    sale: { id: number; friendlyNumber?: string | null; outletId: number; siteId: number | null };
    /** From manual-discount.ts `summarizeManualDiscount`. */
    summary: { gross: Decimal; total: Decimal };
    /** The sale was over the cashier cap and accepted only because it arrived late. */
    acceptedLate: boolean;
    params: { maxPercent: number };
}

export function detectLargeDiscount(ctx: LargeDiscountContext): Finding | null {
    const rule = getRule(RULE_ID.LARGE_DISCOUNT)!;
    const { gross, total } = ctx.summary;
    if (!total.isFinite() || total.lte(0)) return null;
    const percent = gross.gt(0) ? total.dividedBy(gross).times(100) : new Decimal(100);
    const over = percent.gt(ctx.params.maxPercent);
    if (!over && !ctx.acceptedLate) return null;

    const shown = percent.toDecimalPlaces(1, Decimal.ROUND_HALF_UP);
    return {
        ruleId: rule.id,
        severity: rule.severity,
        dedupKey: `${rule.id}|${ctx.sale.id}`,
        userId: ctx.actor.userId,
        username: ctx.actor.username,
        outletId: ctx.sale.outletId,
        siteId: ctx.sale.siteId,
        documentType: 'SALES',
        documentIds: [ctx.sale.id],
        amount: total,
        count: 1,
        detail: {
            percent: shown.isInteger() ? shown.toFixed(0) : shown.toFixed(1),
            maxPercent: ctx.params.maxPercent,
            acceptedLate: ctx.acceptedLate,
            gross: gross.toNumber(),
            amount: total.toNumber(),
            sale: saleLabel(ctx.sale),
        },
        notify: true,
        escalation: false,
    };
}
