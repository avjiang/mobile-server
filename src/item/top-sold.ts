/**
 * Home "Top 5 items" (GET /item/getItemSoldRanking) — shaping the grouped
 * sales lines into the rows the dashboard card shows.
 *
 * Rank: units sold (Σ sales_item.QUANTITY), unchanged — the card's bars step
 * down with the rank, and a cashier without report access sees units alone.
 *
 * Revenue: Σ sales_item.SUBTOTAL_AMOUNT — the line's price × qty less its own
 * manual discount (PRICE − DISCOUNT_AMOUNT). That is the per-item revenue the
 * reports already use (`topSellingItems[].revenue`, category revenue,
 * most-profitable items), so the Home card and the report agree to the rupiah.
 * The order-level manual discount is not spread over the lines, exactly as in
 * the reports. It used to be the item's CATALOGUE price × units, which ignored
 * both the discount and any price the cashier changed at the till.
 */
import { Decimal } from "decimal.js";

type Num = Decimal.Value | { toString(): string } | null | undefined;

const dec = (v: Num): Decimal =>
    v === null || v === undefined || v === "" ? new Decimal(0) : new Decimal(v.toString());

export interface TopSoldGroupRow {
    itemId: number;
    _sum: { quantity?: Num; subtotalAmount?: Num };
}

export interface TopSoldItemRecord {
    id: number;
    stockBalance?: { availableQuantity?: Num }[];
    [key: string]: unknown;
}

export const buildTopSoldItems = <T extends TopSoldItemRecord>(
    rows: TopSoldGroupRow[],
    items: T[],
) => {
    const itemMap = new Map(items.map((item) => [item.id, item]));
    return rows
        .map((row) => {
            const item = itemMap.get(row.itemId);
            if (!item) return null;
            return {
                item: { ...item, stockQuantity: item.stockBalance?.[0]?.availableQuantity || 0 },
                quantitySold: dec(row._sum.quantity).toNumber(),
                totalRevenue: dec(row._sum.subtotalAmount).toNumber(),
            };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
};
