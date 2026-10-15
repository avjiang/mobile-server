/**
 * QUICK_REVERSAL — a CASH sale reversed by the same user who rang it, within
 * `withinMinutes` of its last payment (the classic "take the cash, void the
 * sale"). Card / transfer corrections right after payment are normal, so only
 * cash counts. Sales rung before PERFORMED_BY_USER_ID existed are skipped.
 */
import { Decimal } from 'decimal.js';
import { getRule, RULE_ID } from '../registry';
import { AnomalyActor, Finding, saleLabel } from './types';
import { ReversalKind } from './reversal-burst';

export interface QuickReversalContext {
    actor: AnomalyActor;
    kind: ReversalKind;
    reversedAt: Date;
    sale: {
        id: number;
        friendlyNumber?: string | null;
        outletId: number;
        siteId: number | null;
        performedByUserId: number | null;
        totalAmount: Decimal.Value;
        createdAt: Date | null;
        payments: { method: string; createdAt: Date | null }[];
    };
    params: { withinMinutes: number };
}

export function detectQuickReversal(ctx: QuickReversalContext): Finding | null {
    const rule = getRule(RULE_ID.QUICK_REVERSAL)!;
    const { sale } = ctx;
    if (sale.performedByUserId === null || sale.performedByUserId !== ctx.actor.userId) return null;
    if (!sale.payments.some((p) => (p.method ?? '').trim().toLowerCase() === 'cash')) return null;

    const paidTimes = sale.payments.map((p) => p.createdAt?.getTime()).filter((t): t is number => t !== undefined);
    const paidAt = paidTimes.length ? Math.max(...paidTimes) : sale.createdAt?.getTime();
    if (paidAt === undefined) return null;

    const elapsedMs = ctx.reversedAt.getTime() - paidAt;
    if (elapsedMs < 0 || elapsedMs >= ctx.params.withinMinutes * 60_000) return null;
    const minutes = Math.max(1, Math.round(elapsedMs / 60_000));
    const amount = new Decimal(sale.totalAmount);

    return {
        ruleId: rule.id,
        severity: rule.severity,
        dedupKey: `${rule.id}|${sale.id}`,
        userId: ctx.actor.userId,
        username: ctx.actor.username,
        outletId: sale.outletId,
        siteId: sale.siteId,
        documentType: 'SALES',
        documentIds: [sale.id],
        amount,
        count: 1,
        detail: {
            minutes,
            withinMinutes: ctx.params.withinMinutes,
            kind: ctx.kind,
            sale: saleLabel(sale),
            amount: amount.toNumber(),
        },
        notify: true,
        escalation: false,
    };
}
