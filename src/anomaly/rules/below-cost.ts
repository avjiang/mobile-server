/**
 * BELOW_COST — an item on a sale went for less than it cost. Per item (a FIFO
 * split stores one item as several lines, summed here): price − line discount −
 * its share of the order discount < cost. Every SalesItem money column is a
 * LINE total. Lines with cost 0 are skipped (no cost on record, e.g. a service).
 */
import { Decimal } from 'decimal.js';
import { getRule, itemsPhrase, RULE_ID } from '../registry';
import { AnomalyActor, Finding, saleLabel } from './types';

export interface BelowCostLine {
    itemId: number;
    itemVariantId: number | null;
    itemName: string;
    variantName?: string | null;
    price: Decimal.Value;
    cost: Decimal.Value;
    discountAmount: Decimal.Value;
}

export interface BelowCostContext {
    actor: AnomalyActor;
    sale: { id: number; friendlyNumber?: string | null; outletId: number; siteId: number | null; orderDiscount: Decimal.Value };
    lines: BelowCostLine[];
}

export function detectBelowCost(ctx: BelowCostContext): Finding | null {
    const rule = getRule(RULE_ID.BELOW_COST)!;

    const byItem = new Map<string, { name: string; price: Decimal; cost: Decimal; discount: Decimal }>();
    for (const l of ctx.lines) {
        const key = `${l.itemId}|${l.itemVariantId ?? ''}`;
        const name = l.variantName ? `${l.itemName} (${l.variantName})` : l.itemName;
        const cur = byItem.get(key) ?? { name, price: new Decimal(0), cost: new Decimal(0), discount: new Decimal(0) };
        cur.price = cur.price.plus(l.price ?? 0);
        cur.cost = cur.cost.plus(l.cost ?? 0);
        cur.discount = cur.discount.plus(l.discountAmount ?? 0);
        byItem.set(key, cur);
    }

    const items = [...byItem.values()];
    const netBeforeOrder = items.map((i) => Decimal.max(i.price.minus(i.discount), 0));
    const totalNet = netBeforeOrder.reduce((s, n) => s.plus(n), new Decimal(0));
    const orderDiscount = Decimal.max(new Decimal(ctx.sale.orderDiscount ?? 0), 0);

    const losing: { name: string; sold: number; cost: number; loss: number }[] = [];
    let totalLoss = new Decimal(0);
    items.forEach((item, i) => {
        if (item.cost.lte(0)) return;
        const share = totalNet.gt(0) ? orderDiscount.times(netBeforeOrder[i]).dividedBy(totalNet) : new Decimal(0);
        const sold = netBeforeOrder[i].minus(share);
        // Rp 1 tolerance for client-side rounding.
        if (sold.plus(1).lt(item.cost)) {
            const loss = item.cost.minus(sold);
            totalLoss = totalLoss.plus(loss);
            losing.push({
                name: item.name,
                sold: sold.toDecimalPlaces(0).toNumber(),
                cost: item.cost.toDecimalPlaces(0).toNumber(),
                loss: loss.toDecimalPlaces(0).toNumber(),
            });
        }
    });
    if (losing.length === 0) return null;

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
        amount: totalLoss,
        count: losing.length,
        detail: {
            items: itemsPhrase(losing.map((l) => l.name)),
            lines: losing,
            amount: totalLoss.toDecimalPlaces(0).toNumber(),
            sale: saleLabel(ctx.sale),
        },
        notify: true,
        escalation: false,
    };
}
