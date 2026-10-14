// Wholesale pricing audit on a sales line (FE docs/future/MULTI_TIER_PRICING.md
// §2.2 / §2.5 / §4). The FE price resolver sets six fields on every line; the
// server stores them AS SENT — no derivation, and never a reason to reject a sale
// (an offline-outbox sale must always land). Anything malformed is stored as NULL,
// which reads as "Ecer / base unit / sold before the feature".
//
// Phase 0 only persists `unitFactor`; the `quantity × unitFactor` stock maths is
// Phase 1 (getEffectiveStockQty).

import { Decimal } from "decimal.js";

/** BASE = ecer · UNIT/TIER/LEVEL = grosir · MANUAL = "Harga diubah" (hand-typed). */
export const PRICE_SOURCES = ['BASE', 'UNIT', 'TIER', 'LEVEL', 'MANUAL'] as const;
export type PriceSource = typeof PRICE_SOURCES[number];

/** Matches `sales_item.UNIT_NAME` (VARCHAR(32)). */
const UNIT_NAME_MAX = 32;

export interface SalesLinePricingAudit {
    priceSource: PriceSource | null;
    listPrice: Decimal | null;
    priceLevelId: number | null;
    itemUnitId: number | null;
    unitName: string | null;
    unitFactor: Decimal | null;
}

const positiveInt = (v: unknown): number | null => {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
};

const decimalOrNull = (v: unknown, { allowZero }: { allowZero: boolean }): Decimal | null => {
    if (v === undefined || v === null || v === '') return null;
    try {
        const d = new Decimal(v as any);
        if (!d.isFinite() || d.isNegative()) return null;
        if (!allowZero && d.isZero()) return null;
        return d;
    } catch {
        return null;
    }
};

/** The six audit columns for one request line, normalised; never throws. */
export function pricingAuditOf(line: {
    priceSource?: unknown;
    listPrice?: unknown;
    priceLevelId?: unknown;
    itemUnitId?: unknown;
    unitName?: unknown;
    unitFactor?: unknown;
}): SalesLinePricingAudit {
    const src = typeof line?.priceSource === 'string' ? line.priceSource.trim().toUpperCase() : '';
    const unitName = typeof line?.unitName === 'string' ? line.unitName.trim().slice(0, UNIT_NAME_MAX) : '';
    return {
        priceSource: (PRICE_SOURCES as readonly string[]).includes(src) ? (src as PriceSource) : null,
        listPrice: decimalOrNull(line?.listPrice, { allowZero: true }),
        priceLevelId: positiveInt(line?.priceLevelId),
        itemUnitId: positiveInt(line?.itemUnitId),
        unitName: unitName === '' ? null : unitName,
        unitFactor: decimalOrNull(line?.unitFactor, { allowZero: false }),
    };
}
