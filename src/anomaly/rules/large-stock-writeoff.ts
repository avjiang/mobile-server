/**
 * LARGE_STOCK_WRITEOFF — one stock-adjustment request lowers an outlet's stock
 * by more than `maxAmount` at FIFO cost. Only negative `adjustQuantity` lines
 * count (the `wastageEntries` stockAdjustment already prices); a recount
 * (`overrideQuantity`) is a correction, not a write-off.
 */
import { Decimal } from 'decimal.js';
import { getRule, itemsPhrase, RULE_ID } from '../registry';
import { AnomalyActor, Finding } from './types';

export interface WriteOffEntry {
    itemId: number;
    itemName: string;
    cost: Decimal.Value;
    reason: string;
}

export interface LargeStockWriteOffContext {
    actor: AnomalyActor;
    outletId: number;
    siteId: number | null;
    /** Unique per adjustment request (one event per request and outlet). */
    requestKey: string;
    entries: WriteOffEntry[];
    params: { maxAmount: number };
}

export function detectLargeStockWriteOff(ctx: LargeStockWriteOffContext): Finding | null {
    const rule = getRule(RULE_ID.LARGE_STOCK_WRITEOFF)!;
    const total = ctx.entries.reduce((s, e) => s.plus(e.cost ?? 0), new Decimal(0));
    if (!total.gt(ctx.params.maxAmount)) return null;

    const lines = ctx.entries
        .map((e) => ({ name: e.itemName, cost: new Decimal(e.cost).toDecimalPlaces(0).toNumber(), reason: e.reason }))
        .sort((a, b) => b.cost - a.cost);
    return {
        ruleId: rule.id,
        severity: rule.severity,
        dedupKey: `${rule.id}|${ctx.requestKey}|${ctx.outletId}`,
        userId: ctx.actor.userId,
        username: ctx.actor.username,
        outletId: ctx.outletId,
        siteId: ctx.siteId,
        documentType: 'STOCK_ADJUSTMENT',
        documentIds: [...new Set(ctx.entries.map((e) => e.itemId))],
        amount: total,
        count: ctx.entries.length,
        detail: {
            items: itemsPhrase(lines.map((l) => l.name)),
            lines,
            maxAmount: ctx.params.maxAmount,
            amount: total.toDecimalPlaces(0).toNumber(),
        },
        notify: true,
        escalation: false,
    };
}
