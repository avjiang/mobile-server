/**
 * REVERSAL_BURST — one user voids, returns or refunds more than `maxPerDay`
 * sales in one WIB day. Push when the count first passes the limit, and once
 * more (escalation) when it reaches twice that — never one push per extra void.
 */
import { Decimal } from 'decimal.js';
import { getRule, RULE_ID } from '../registry';
import { AnomalyActor, Finding } from './types';

export type ReversalKind = 'void' | 'return' | 'refund';

export interface ReversalBurstContext {
    actor: AnomalyActor;
    outletId: number;
    siteId: number | null;
    /** yyyy-mm-dd in WIB — the day the reversals are counted in. */
    wibDay: string;
    /** Every reversal by this user today, this one included. */
    reversalsToday: { salesId: number; amount: Decimal.Value; kind: ReversalKind }[];
    params: { maxPerDay: number };
}

export function detectReversalBurst(ctx: ReversalBurstContext): Finding | null {
    const rule = getRule(RULE_ID.REVERSAL_BURST)!;
    const count = ctx.reversalsToday.length;
    const limit = ctx.params.maxPerDay;
    if (count <= limit) return null;

    const firstCrossing = limit + 1;
    const escalateAt = 2 * firstCrossing;
    const amount = ctx.reversalsToday.reduce((sum, r) => sum.plus(r.amount), new Decimal(0));
    const kinds = { void: 0, return: 0, refund: 0 };
    for (const r of ctx.reversalsToday) kinds[r.kind] += 1;

    return {
        ruleId: rule.id,
        severity: rule.severity,
        dedupKey: `${rule.id}|${ctx.actor.userId}|${ctx.wibDay}`,
        userId: ctx.actor.userId,
        username: ctx.actor.username,
        outletId: ctx.outletId,
        siteId: ctx.siteId,
        documentType: 'SALES',
        documentIds: ctx.reversalsToday.map((r) => r.salesId),
        amount,
        count,
        detail: { count, maxPerDay: limit, amount: amount.toNumber(), kinds, day: ctx.wibDay },
        notify: count === firstCrossing || count === escalateAt,
        escalation: count === escalateAt,
    };
}
