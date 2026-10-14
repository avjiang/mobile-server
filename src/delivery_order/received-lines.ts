import { Decimal } from 'decimal.js';

export interface ReceivedLine {
    itemId: number;
    itemVariantId?: number | null;
    receivedQuantity: Decimal.Value | null | undefined;
}

/**
 * True when [incoming] receives exactly what [booked] already did: the same
 * items and variants in the same quantities, in any order. Only these fields
 * move stock, so a save that resends the lines unchanged (the app always sends
 * them) is not an edit of what was received.
 */
export function sameReceivedLines(booked: ReceivedLine[], incoming: ReceivedLine[]): boolean {
    return tally(booked) === tally(incoming);
}

function tally(lines: ReceivedLine[]): string {
    const totals = new Map<string, Decimal>();
    for (const l of lines) {
        const key = `${l.itemId}-${l.itemVariantId || 'null'}`;
        totals.set(key, (totals.get(key) ?? new Decimal(0)).plus(new Decimal(l.receivedQuantity ?? 0)));
    }
    return [...totals.entries()]
        .filter(([, qty]) => !qty.isZero())
        .map(([key, qty]) => `${key}:${qty.toString()}`)
        .sort()
        .join('|');
}
