/**
 * REPEATED_SHORTAGE (nightly) — one person's cash came up short `minCount` or
 * more times in the last 7 days (any shortage, even under CASH_SHORTAGE's
 * limit — small, repeated losses are the pattern). BETA with CASH_SHORTAGE.
 */
import { Decimal } from 'decimal.js';
import { getRule, RULE_ID } from '../registry';
import { Finding } from './types';

export interface RepeatedShortageContext {
    userId: number;
    username: string;
    outletId: number;
    week: string;
    shortages: { sessionId: number; amount: Decimal.Value }[];
    params: { minCount: number };
}

export function detectRepeatedShortage(ctx: RepeatedShortageContext): Finding | null {
    const rule = getRule(RULE_ID.REPEATED_SHORTAGE)!;
    const short = ctx.shortages.filter((s) => new Decimal(s.amount).gt(0));
    if (short.length < ctx.params.minCount) return null;
    const total = short.reduce((sum, s) => sum.plus(s.amount), new Decimal(0));
    return {
        ruleId: rule.id,
        severity: rule.severity,
        dedupKey: `${rule.id}|${ctx.userId}|${ctx.week}`,
        userId: ctx.userId,
        username: ctx.username,
        outletId: ctx.outletId,
        siteId: null,
        documentType: 'SESSION',
        documentIds: short.map((s) => s.sessionId),
        amount: total,
        count: short.length,
        detail: { count: short.length, amount: total.toNumber(), minCount: ctx.params.minCount, week: ctx.week },
        notify: true,
        escalation: false,
    };
}
