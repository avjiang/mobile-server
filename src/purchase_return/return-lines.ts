import { Decimal } from 'decimal.js';

export interface ReturnLine {
    itemId: number;
    itemVariantId?: number | null;
    quantity: Decimal.Value;
    returnReason?: string | null;
    remark?: string | null;
    stockReceiptId?: number | null;
}

export type MergedReturnLine<T extends ReturnLine> = Omit<T, 'quantity'> & { quantity: Decimal };

/**
 * A return's lines of the same item (and variant, and receipt) as one line with
 * the quantities summed. Stock is checked and moved once per item: checking each
 * line against the same balance read let two lines of one item pass separately
 * and take stock below zero together, and shrink the receipt from a stale size.
 * Reasons and remarks of the merged lines are kept, joined.
 */
export function mergeReturnLines<T extends ReturnLine>(lines: T[]): MergedReturnLine<T>[] {
    const merged = new Map<string, MergedReturnLine<T>>();
    for (const line of lines) {
        const key = `${line.itemId}-${line.itemVariantId || 'null'}-${line.stockReceiptId ?? 'null'}`;
        const seen = merged.get(key);
        if (!seen) {
            merged.set(key, { ...line, quantity: new Decimal(line.quantity) });
            continue;
        }
        seen.quantity = seen.quantity.plus(new Decimal(line.quantity));
        seen.returnReason = joinDistinct(seen.returnReason, line.returnReason, ', ');
        seen.remark = joinDistinct(seen.remark, line.remark, '; ');
    }
    return [...merged.values()];
}

function joinDistinct(a: string | null | undefined, b: string | null | undefined, sep: string): string | null {
    const parts = (a ? a.split(sep) : []);
    if (b && !parts.includes(b)) parts.push(b);
    return parts.length > 0 ? parts.join(sep) : (a ?? null);
}
