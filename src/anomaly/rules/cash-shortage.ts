/**
 * CASH_SHORTAGE — the cash counted at session close is below what the server
 * says should be in the drawer (opening float + cash payments − cash expenses
 * of the session) by more than `minShortage`. The phone's own "expected"
 * figure is never trusted. BETA until the app sends a cash count everywhere.
 */
import { Decimal } from 'decimal.js';
import { getRule, RULE_ID } from '../registry';
import { AnomalyActor, Finding } from './types';

export interface CashShortageContext {
    actor: AnomalyActor;
    outletId: number;
    siteId: number | null;
    sessionId: number;
    /** Server-computed. */
    expected: Decimal.Value;
    /** What the cashier counted. */
    declared: Decimal.Value;
    params: { minShortage: number };
}

export function detectCashShortage(ctx: CashShortageContext): Finding | null {
    const rule = getRule(RULE_ID.CASH_SHORTAGE)!;
    const expected = new Decimal(ctx.expected);
    const declared = new Decimal(ctx.declared);
    const shortage = expected.minus(declared);
    if (!shortage.gt(ctx.params.minShortage)) return null;
    return {
        ruleId: rule.id,
        severity: rule.severity,
        dedupKey: `${rule.id}|${ctx.sessionId}`,
        userId: ctx.actor.userId,
        username: ctx.actor.username,
        outletId: ctx.outletId,
        siteId: ctx.siteId,
        documentType: 'SESSION',
        documentIds: [ctx.sessionId],
        amount: shortage,
        count: 1,
        detail: {
            expected: expected.toNumber(),
            declared: declared.toNumber(),
            amount: shortage.toNumber(),
            minShortage: ctx.params.minShortage,
            session: ctx.sessionId,
        },
        notify: true,
        escalation: false,
    };
}

/** Expected cash: opening float + cash taken − cash paid out (all Decimal-safe). */
export function expectedCash(args: { openingAmount: Decimal.Value; cashPayments: Decimal.Value[]; cashExpenses: Decimal.Value[] }): Decimal {
    const sum = (xs: Decimal.Value[]) => xs.reduce<Decimal>((s, x) => s.plus(x ?? 0), new Decimal(0));
    return new Decimal(args.openingAmount ?? 0).plus(sum(args.cashPayments)).minus(sum(args.cashExpenses));
}
