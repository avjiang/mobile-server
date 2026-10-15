/**
 * VOID_RATE_OUTLIER (nightly) — over the last 7 days one cashier reverses far
 * more often than the outlet's other cashiers together: at least
 * `minReversals`, and a rate (reversals ÷ sales they rang) of at least
 * `multiple` × the others' rate. The others need ≥ 10 sales to compare with.
 */
import { getRule, RULE_ID } from '../registry';
import { Finding } from './types';

export const OUTLIER_MIN_OTHER_SALES = 10;

export interface VoidRateContext {
    userId: number;
    username: string;
    outletId: number;
    /** Monday of the WIB week (dedupe). */
    week: string;
    userSales: number;
    userReversals: number;
    othersSales: number;
    othersReversals: number;
    params: { multiple: number; minReversals: number };
}

const pct = (n: number) => Math.round(n * 1000) / 10;

export function detectVoidRateOutlier(ctx: VoidRateContext): Finding | null {
    const rule = getRule(RULE_ID.VOID_RATE_OUTLIER)!;
    if (ctx.userReversals < ctx.params.minReversals || ctx.othersSales < OUTLIER_MIN_OTHER_SALES) return null;
    // A cashier who reversed more than they rang (others' sales) still counts: rate over max(1, sales).
    const rate = ctx.userReversals / Math.max(1, ctx.userSales);
    const others = ctx.othersReversals / ctx.othersSales;
    if (others > 0 && rate < ctx.params.multiple * others) return null;
    return {
        ruleId: rule.id,
        severity: rule.severity,
        dedupKey: `${rule.id}|${ctx.userId}|${ctx.outletId}|${ctx.week}`,
        userId: ctx.userId,
        username: ctx.username,
        outletId: ctx.outletId,
        siteId: null,
        documentType: 'SALES',
        documentIds: [],
        amount: null,
        count: ctx.userReversals,
        detail: {
            count: ctx.userReversals,
            sales: ctx.userSales,
            rate: pct(rate),
            othersRate: pct(others),
            multiple: ctx.params.multiple,
            week: ctx.week,
        },
        notify: true,
        escalation: false,
    };
}
