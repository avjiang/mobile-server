/**
 * SUPPLIER_PRICE_RISE — a delivery order's unit price is above that supplier's
 * usual price for the item by `minPercent` AND `minRupiah` per unit. Usual =
 * the agreed ItemSupplier.cost, else the supplier's previous received price.
 * INFO, or WARNING when the biggest rise is twice `minPercent`.
 */
import { Decimal } from 'decimal.js';
import { getRule, itemsPhrase, RULE_ID } from '../registry';
import { AnomalyActor, Finding } from './types';

export interface PriceLine {
    name: string;
    unitPrice: Decimal.Value;
    quantity: Decimal.Value;
    /** The usual price, null when there is none to compare with. */
    baseline: Decimal.Value | null;
}

export interface SupplierPriceRiseContext {
    actor: AnomalyActor;
    outletId: number;
    siteId: number | null;
    deliveryOrderId: number;
    document: string;
    supplier: string;
    lines: PriceLine[];
    params: { minPercent: number; minRupiah: number };
}

export function detectSupplierPriceRise(ctx: SupplierPriceRiseContext): Finding | null {
    const rule = getRule(RULE_ID.SUPPLIER_PRICE_RISE)!;
    const rising: { name: string; was: number; now: number; percent: number }[] = [];
    let extra = new Decimal(0);
    let maxPercent = new Decimal(0);
    for (const l of ctx.lines) {
        if (l.baseline === null || l.baseline === undefined) continue;
        const was = new Decimal(l.baseline);
        const now = new Decimal(l.unitPrice);
        if (was.lte(0) || now.lte(was)) continue;
        const rise = now.minus(was);
        const percent = rise.dividedBy(was).times(100);
        if (percent.lt(ctx.params.minPercent) || rise.lt(ctx.params.minRupiah)) continue;
        extra = extra.plus(rise.times(l.quantity ?? 0));
        if (percent.gt(maxPercent)) maxPercent = percent;
        rising.push({
            name: l.name,
            was: was.toDecimalPlaces(0).toNumber(),
            now: now.toDecimalPlaces(0).toNumber(),
            percent: percent.toDecimalPlaces(0).toNumber(),
        });
    }
    if (rising.length === 0) return null;
    return {
        ruleId: rule.id,
        severity: maxPercent.gte(ctx.params.minPercent * 2) ? 'WARNING' : 'INFO',
        dedupKey: `${rule.id}|${ctx.deliveryOrderId}`,
        userId: ctx.actor.userId,
        username: ctx.actor.username,
        outletId: ctx.outletId,
        siteId: ctx.siteId,
        documentType: 'DELIVERY_ORDER',
        documentIds: [ctx.deliveryOrderId],
        amount: extra,
        count: rising.length,
        detail: {
            supplier: ctx.supplier,
            document: ctx.document,
            items: itemsPhrase(rising.map((r) => r.name)),
            percent: maxPercent.toDecimalPlaces(0).toNumber(),
            amount: extra.toDecimalPlaces(0).toNumber(),
            minPercent: ctx.params.minPercent,
            lines: rising,
        },
        notify: true,
        escalation: false,
    };
}
