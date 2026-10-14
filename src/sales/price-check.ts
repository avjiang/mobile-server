/**
 * Wholesale price check at sale create — LOG-ONLY, never rejects (Phase 4 of the
 * wholesale build; FE docs/modules/SALES.md § Wholesale pricing, owner decision D4).
 *
 * The FE resolver (FE lib/screens/responsive/sales/cart/line_pricing.dart) prices
 * every retail line from the item's units / quantity breaks / level prices and
 * tags it with a `priceSource`. The server recomputes the price it EXPECTS from
 * its own rows with the same rule (`resolvePrice`, a straight port), and when a
 * non-MANUAL line's price is off by more than Rp 1 it logs one warning line and
 * accepts the sale exactly as sent.
 *
 * Why never reject: a mismatch almost always means a device whose synced tiers
 * are stale (the owner changed a price after the device last synced), or a
 * tampered client. Rejecting would drop real sales, so this only makes them
 * visible in the logs. A hand-typed price (`MANUAL`, Edit Sale Price) and lines
 * the resolver never priced (`priceSource` null: laundry services, older apps)
 * are not checked.
 *
 * Skipped entirely:
 *  - late sales (offline outbox, same LATE_SALE_AFTER_MS rule as manual-discount):
 *    their prices were right when they were rung;
 *  - Retail Lite (wholesale is off there, the FE prices everything at base);
 *  - sales with no checkable line (no IO at all — every pre-wholesale sale).
 *
 * The rule's test cases live in ONE table shared with the Dart tests:
 * ./__tests__/wholesale-price-cases.json (mirrored byte-for-byte in FE
 * test/screens/sales/wholesale_price_cases.json).
 */
import { Decimal } from "decimal.js";
import { pricingAuditOf, PriceSource } from "./price-audit";
import { isLateSale, RUPIAH_TOLERANCE, saleRungAt } from "./manual-discount";

type Num = Decimal.Value | { toString(): string } | null | undefined;

/** One `item_price_tier` row (break or level price). */
export interface PriceTierRow {
    id: number;
    price: Num;
    minQuantity?: Num;
    priceLevelId?: number | null;
    itemUnitId?: number | null;
    itemVariantId?: number | null;
    deleted?: boolean | null;
}

export interface PriceResolution {
    price: Decimal;
    source: Exclude<PriceSource, "MANUAL">;
    tierId: number | null;
}

/** Quantities are decimals (1.2 m of pipe); a break at 12 must hold at 12.0. */
const QTY_EPSILON = 1e-9;

const dec = (v: Num): Decimal | null => {
    if (v === null || v === undefined || v === "") return null;
    try {
        const d = new Decimal(v.toString());
        return d.isFinite() ? d : null;
    } catch {
        return null;
    }
};

/**
 * Port of the Dart `resolvePrice`: start from `basePrice` (the unit's price, else
 * the variant's, else the item's); candidates are live tiers for the same variant
 * (or all variants), the SAME unit (null = base unit), level null or
 * `priceLevelId`, with minQuantity ≤ qty; the LOWEST price wins. A tier no cheaper
 * than the base never wins; at an equal price a level row beats an everyone row.
 */
export function resolvePrice(args: {
    basePrice: Num;
    baseIsUnit?: boolean;
    variantId?: number | null;
    unitId?: number | null;
    qty: Num;
    priceLevelId?: number | null;
    tiers?: readonly PriceTierRow[];
}): PriceResolution {
    const base = dec(args.basePrice) ?? new Decimal(0);
    const qty = dec(args.qty) ?? new Decimal(0);
    const variantId = args.variantId ?? null;
    const unitId = args.unitId ?? null;
    const levelId = args.priceLevelId ?? null;
    let best: PriceResolution = { price: base, source: args.baseIsUnit ? "UNIT" : "BASE", tierId: null };
    for (const t of args.tiers ?? []) {
        const price = dec(t.price);
        if (price === null || t.deleted === true) continue;
        if (t.itemVariantId != null && t.itemVariantId !== variantId) continue;
        if ((t.itemUnitId ?? null) !== unitId) continue;
        if (t.priceLevelId != null && t.priceLevelId !== levelId) continue;
        const min = dec(t.minQuantity) ?? new Decimal(1);
        if (min.gt(qty.plus(QTY_EPSILON))) continue;
        const source = t.priceLevelId != null ? "LEVEL" : "TIER";
        const cheaper = price.lt(best.price);
        const sameButMoreSpecific = price.eq(best.price) && best.source === "TIER" && source === "LEVEL";
        if (cheaper || sameButMoreSpecific) best = { price, source, tierId: t.id };
    }
    return best;
}

/** What the server knows about the items on a sale (all keyed by id). */
export interface PriceBook {
    items: Map<number, { price: Num; isOpenPrice?: boolean | null }>;
    variants: Map<number, { itemId: number; price: Num }>;
    units: Map<number, { itemId: number; price: Num }>;
    /** Live tiers per itemId. */
    tiers: Map<number, PriceTierRow[]>;
    /** The sale customer's CURRENT price level (null = ecer / no customer). */
    customerPriceLevelId: number | null;
}

export interface PriceCheckLine {
    itemId?: number | null;
    itemVariantId?: number | null;
    quantity?: Num;
    price?: Num;
    priceSource?: unknown;
    itemUnitId?: unknown;
    priceLevelId?: unknown;
}

export interface PriceMismatch {
    line: number;
    itemId: number;
    itemVariantId: number | null;
    itemUnitId: number | null;
    quantity: string;
    sentPrice: string;
    sentSource: PriceSource;
    expectedPrice: string;
    expectedSource: PriceResolution["source"];
    expectedTierId: number | null;
}

/** The resolver source a line was tagged with, when it is one we can check. */
function checkableSource(line: PriceCheckLine): PriceSource | null {
    const src = pricingAuditOf({ priceSource: line.priceSource }).priceSource;
    return src === null || src === "MANUAL" ? null : src;
}

/** True when at least one line carries a resolver price (BASE/UNIT/TIER/LEVEL). */
export function hasCheckableLine(lines: readonly PriceCheckLine[] | null | undefined): boolean {
    return (lines ?? []).some((l) => checkableSource(l) !== null);
}

/**
 * Pure: compare every checkable line with the price the server's rows give.
 * A line the server cannot price (unknown item / unit, no price) is skipped —
 * nothing to compare against.
 */
export function findPriceMismatches(lines: readonly PriceCheckLine[], book: PriceBook): PriceMismatch[] {
    const out: PriceMismatch[] = [];
    lines.forEach((line, i) => {
        const sentSource = checkableSource(line);
        if (sentSource === null || line.itemId == null) return;
        const item = book.items.get(line.itemId);
        if (!item) return;
        const unitId = pricingAuditOf({ itemUnitId: line.itemUnitId }).itemUnitId;
        const unit = unitId != null ? book.units.get(unitId) : undefined;
        if (unitId != null && (!unit || unit.itemId !== line.itemId)) return;
        const variantId = line.itemVariantId ?? null;
        const variant = variantId != null ? book.variants.get(variantId) : undefined;
        const base = unit ? dec(unit.price) : (dec(variant?.price) ?? dec(item.price));
        const sent = dec(line.price);
        if (base === null || sent === null) return;

        const expected = resolvePrice({
            basePrice: base,
            baseIsUnit: unit !== undefined,
            variantId,
            unitId,
            qty: line.quantity,
            priceLevelId: book.customerPriceLevelId,
            tiers: item.isOpenPrice === true ? [] : (book.tiers.get(line.itemId) ?? []),
        });
        if (sent.minus(expected.price).abs().lte(RUPIAH_TOLERANCE)) return;
        out.push({
            line: i + 1,
            itemId: line.itemId,
            itemVariantId: variantId,
            itemUnitId: unitId,
            quantity: (dec(line.quantity) ?? new Decimal(0)).toString(),
            sentPrice: sent.toString(),
            sentSource,
            expectedPrice: expected.price.toString(),
            expectedSource: expected.source,
            expectedTierId: expected.tierId,
        });
    });
    return out;
}

export interface PriceCheckSale {
    customerId?: number | null;
    businessDate?: Date | string | null;
    clientCreatedAt?: Date | string | null;
    salesItems?: PriceCheckLine[] | null;
}

export interface PriceCheckContext {
    databaseName: string;
    username: string;
    planName?: string | null;
    isLitePlan: (planName?: string | null) => boolean;
    saleRef: string | null;
    now?: Date;
}

export interface PriceCheckDeps {
    /** Load the server's view of the sale's items, variants, units, tiers and customer level. */
    loadBook: (q: { itemIds: number[]; variantIds: number[]; unitIds: number[]; customerId: number | null }) => Promise<PriceBook>;
    warn?: (line: string) => void;
}

export type PriceCheckOutcome =
    | { action: "skipped"; reason: "no-checkable-line" | "late-sale" | "lite-plan" | "error" }
    | { action: "checked"; mismatches: PriceMismatch[] };

/**
 * Run the check for one incoming sale. NEVER throws: every failure (bad data,
 * a DB error) becomes a warning, because a price check must never cost a sale.
 */
export async function checkSaleLinePrices(
    sale: PriceCheckSale,
    ctx: PriceCheckContext,
    deps: PriceCheckDeps,
): Promise<PriceCheckOutcome> {
    const warn = deps.warn ?? console.warn;
    try {
        const lines = sale.salesItems ?? [];
        if (!hasCheckableLine(lines)) return { action: "skipped", reason: "no-checkable-line" };
        if (ctx.isLitePlan(ctx.planName)) return { action: "skipped", reason: "lite-plan" };
        const now = ctx.now ?? new Date();
        if (isLateSale(saleRungAt(sale), now)) return { action: "skipped", reason: "late-sale" };

        const checkable = lines.filter((l) => checkableSource(l) !== null);
        const ids = (pick: (l: PriceCheckLine) => unknown) =>
            [...new Set(checkable.map(pick).filter((v): v is number => typeof v === "number" && v > 0))];
        const book = await deps.loadBook({
            itemIds: ids((l) => l.itemId),
            variantIds: ids((l) => l.itemVariantId),
            unitIds: ids((l) => pricingAuditOf({ itemUnitId: l.itemUnitId }).itemUnitId),
            customerId: sale.customerId && sale.customerId > 0 ? sale.customerId : null,
        });
        const mismatches = findPriceMismatches(lines, book);
        for (const m of mismatches) {
            warn(
                `[price-check] wholesale price mismatch accepted: tenant=${ctx.databaseName} ` +
                `user=${ctx.username} ref=${ctx.saleRef ?? "none"} line=${m.line} item=${m.itemId}` +
                `${m.itemVariantId != null ? ` variant=${m.itemVariantId}` : ""}` +
                `${m.itemUnitId != null ? ` unit=${m.itemUnitId}` : ""} qty=${m.quantity} ` +
                `sent=${m.sentPrice}(${m.sentSource}) expected=${m.expectedPrice}(${m.expectedSource}` +
                `${m.expectedTierId != null ? ` tier=${m.expectedTierId}` : ""}) ` +
                `customerLevel=${book.customerPriceLevelId ?? "none"}`,
            );
        }
        return { action: "checked", mismatches };
    } catch (error) {
        warn(`[price-check] skipped (error): tenant=${ctx.databaseName} ref=${ctx.saleRef ?? "none"} ${String(error)}`);
        return { action: "skipped", reason: "error" };
    }
}
