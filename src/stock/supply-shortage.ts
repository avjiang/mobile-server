/**
 * Laundry supply shortfall — pure maths (no Prisma), unit-tested in
 * src/stock/__tests__/supply-shortage.test.ts.
 *
 * Owner rule (2026-10-02): running out of a laundry SUPPLY (item.itemType
 * 'supply': detergent, softener, plastic, LPG…) never blocks a wash. The sale
 * goes through and the outlet balance goes NEGATIVE. Two consequences live here:
 *
 *  1. Stock-in settles the debt first. The missing amount was already used up
 *     physically, so when stock arrives into a negative balance only the positive
 *     remainder becomes a FIFO receipt layer (`receiptQtyAfterDebt`,
 *     `settleLayers`). The balance + movement still record the full delta.
 *
 *  2. The shortage report (GET stockMovement/supply-shortages) walks the item's
 *     movements newest → oldest to find the current negative "episode" and how
 *     much of each wash was short (`shortPortion`, `shortageEpisode`).
 */
import { Decimal } from "decimal.js";

type Num = Decimal.Value | { toString(): string };

const dec = (v: Num | null | undefined): Decimal =>
    v === null || v === undefined ? new Decimal(0) : new Decimal(v.toString());

/**
 * FIFO receipt quantity for a single stock-in of `delta` into a balance that was
 * `previousAvailable`: `max(0, previous + delta)` capped at `delta`. A balance that
 * is not negative keeps the whole delta. Returns 0 (→ create no receipt) when the
 * stock-in only pays back part of the debt.
 */
export function receiptQtyAfterDebt(previousAvailable: Num, delta: Num): Decimal {
    const prev = dec(previousAvailable);
    const d = dec(delta);
    if (d.lte(0)) return new Decimal(0);
    if (prev.gte(0)) return d;
    return Decimal.min(d, Decimal.max(0, prev.plus(d)));
}

/**
 * Multi-layer variant of `receiptQtyAfterDebt` (a transfer can bring several FIFO
 * layers at once): the debt (`-previousAvailable` when negative) is absorbed by
 * the layers in order, oldest first. Returns the quantity each layer keeps
 * (same length/order as the input; 0 = create no receipt for that layer).
 */
export function settleLayers(previousAvailable: Num, layerQuantities: Num[]): Decimal[] {
    let debt = Decimal.max(0, dec(previousAvailable).neg());
    return layerQuantities.map((q) => {
        const qty = Decimal.max(0, dec(q));
        const absorbed = Decimal.min(debt, qty);
        debt = debt.minus(absorbed);
        return qty.minus(absorbed);
    });
}

/**
 * How much of one movement (balance `previous` → `previous + delta`) went below
 * zero: `max(0, -(prev+delta)) - max(0, -prev)`, clamped to `[0, -delta]`.
 *   prev 100, delta -150 → 50   (crossing: only the part below zero)
 *   prev -20, delta  -30 → 30   (already negative: all of it)
 *   prev 100, delta  -30 → 0    (stayed positive)
 *   any positive delta   → 0
 */
export function shortPortion(previousAvailable: Num, delta: Num): Decimal {
    const prev = dec(previousAvailable);
    const d = dec(delta);
    if (d.gte(0)) return new Decimal(0);
    const after = prev.plus(d);
    const raw = Decimal.max(0, after.neg()).minus(Decimal.max(0, prev.neg()));
    return Decimal.min(d.neg(), Decimal.max(0, raw));
}

export interface ShortageMovement {
    id: number;
    previousAvailableQuantity: Num;
    availableQuantityDelta: Num;
    movementType: string;
    documentId: number;
    createdAt: Date | null;
}

export interface ShortageEpisode {
    /** createdAt of the movement that took the balance below zero (oldest seen when the walk was cut short). */
    since: Date | null;
    /** One entry per sale with a non-zero short portion, newest first. */
    sales: { salesId: number; shortQuantity: Decimal; createdAt: Date | null }[];
}

/**
 * Walks an item's movements NEWEST → OLDEST (the caller passes them in that order)
 * through the current negative episode: every movement up to and including the
 * first one whose `previousAvailableQuantity >= 0` (that movement crossed below
 * zero and gives `since`). For each 'Sales' movement in the episode its short
 * portion is attributed to the sale (`documentId`); zero portions and sales in
 * `excludedSalesIds` (voided / returned / refunded) are skipped. Portions of the
 * same sale are summed. Only meaningful when the current balance is negative.
 */
export function shortageEpisode(
    movementsNewestFirst: ShortageMovement[],
    excludedSalesIds: ReadonlySet<number> = new Set(),
): ShortageEpisode {
    const episode: ShortageMovement[] = [];
    for (const m of movementsNewestFirst) {
        episode.push(m);
        if (dec(m.previousAvailableQuantity).gte(0)) break;
    }
    const since = episode.length > 0 ? episode[episode.length - 1].createdAt : null;

    const bySale = new Map<number, { salesId: number; shortQuantity: Decimal; createdAt: Date | null }>();
    for (const m of episode) {
        if (m.movementType !== 'Sales') continue;
        if (excludedSalesIds.has(m.documentId)) continue;
        const portion = shortPortion(m.previousAvailableQuantity, m.availableQuantityDelta);
        if (portion.lte(0)) continue;
        const existing = bySale.get(m.documentId);
        if (existing) {
            existing.shortQuantity = existing.shortQuantity.plus(portion);
        } else {
            bySale.set(m.documentId, { salesId: m.documentId, shortQuantity: portion, createdAt: m.createdAt });
        }
    }
    // Map insertion order follows the newest-first walk.
    return { since, sales: [...bySale.values()] };
}

/** The 'Sales' movement document ids inside the current episode (to look up their sale status). */
export function episodeSalesIds(movementsNewestFirst: ShortageMovement[]): number[] {
    const ids = new Set<number>();
    for (const m of movementsNewestFirst) {
        if (m.movementType === 'Sales') ids.add(m.documentId);
        if (dec(m.previousAvailableQuantity).gte(0)) break;
    }
    return [...ids];
}
