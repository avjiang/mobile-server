/**
 * `priceMix` block of the session / outlet reports (wholesale pricing, Phase 1r —
 * docs/future/MULTI_TIER_PRICING.md §2.5, owner decision D8).
 *
 *   "priceMix": {
 *     "totalRevenue": 1530000, "totalProfit": 210000, "lineCount": 9,
 *     "grosir": { "revenue": 1280000, "profit": 160000, "lineCount": 3 },
 *     "ecer":   { "revenue":  230000, "profit":  48000, "lineCount": 5 },
 *     "manual": { "revenue":   20000, "profit":   2000, "lineCount": 1 },
 *     "byLevel": [ { "priceLevelId": 2, "name": "Grosir", "revenue": 512000, "profit": 64000, "lineCount": 1 } ]
 *   }
 *
 * Grouping by the line's `priceSource` (set by the FE resolver, stored as sent):
 *   Grosir       = UNIT (carton price), TIER (quantity break) or LEVEL (customer level)
 *   Ecer         = BASE, or null (lines sold before the feature)
 *   Harga diubah = MANUAL (the cashier typed the price)
 *
 * revenue = Σ sales_item.SUBTOTAL_AMOUNT (the line's price × qty less its own manual
 * discount, the reports' per-item revenue); profit = Σ sales_item.PROFIT. Callers pass
 * the SAME sales filter their revenue uses, so the three groups sum to the report's
 * line revenue. A piece line costed over several FIFO receipts is stored as several
 * rows; they count as ONE line (same sale + item + variant + unit + source).
 * `byLevel` splits the Grosir lines that carry a customer price level, by level name.
 */
import { Decimal } from "decimal.js";
import { PrismaClient } from "../../prisma/client/generated/client";

type Num = Decimal.Value | { toString(): string } | null | undefined;

export interface PriceMixLineRow {
    salesId: number;
    itemId: number;
    itemVariantId?: number | null;
    itemUnitId?: number | null;
    priceSource: string | null;
    priceLevelId: number | null;
    subtotalAmount: Num;
    profit: Num;
}

export interface PriceMixGroup {
    revenue: number;
    profit: number;
    lineCount: number;
}

export interface PriceMixLevel extends PriceMixGroup {
    priceLevelId: number;
    name: string;
}

export interface PriceMixReport {
    totalRevenue: number;
    totalProfit: number;
    lineCount: number;
    grosir: PriceMixGroup;
    ecer: PriceMixGroup;
    manual: PriceMixGroup;
    byLevel: PriceMixLevel[];
}

export type PriceMixGroupKey = "grosir" | "ecer" | "manual";

const GROSIR_SOURCES = new Set(["UNIT", "TIER", "LEVEL"]);

export const emptyPriceMix = (): PriceMixReport => ({
    totalRevenue: 0, totalProfit: 0, lineCount: 0,
    grosir: { revenue: 0, profit: 0, lineCount: 0 },
    ecer: { revenue: 0, profit: 0, lineCount: 0 },
    manual: { revenue: 0, profit: 0, lineCount: 0 },
    byLevel: [],
});

const dec = (v: Num) => new Decimal(v === null || v === undefined || v === "" ? 0 : v.toString());

/** D8: which report group a line's priceSource falls in. Unknown / null → Ecer. */
export function priceMixGroupOf(priceSource: string | null | undefined): PriceMixGroupKey {
    const s = (priceSource ?? "").trim().toUpperCase();
    if (s === "MANUAL") return "manual";
    if (GROSIR_SOURCES.has(s)) return "grosir";
    return "ecer";
}

/** Pure: aggregate the period's sales lines into the block. */
export function buildPriceMixReport(
    lines: readonly PriceMixLineRow[],
    levelNames: ReadonlyMap<number, string> = new Map(),
): PriceMixReport {
    type Acc = { revenue: Decimal; profit: Decimal; keys: Set<string> };
    const acc = (): Acc => ({ revenue: new Decimal(0), profit: new Decimal(0), keys: new Set() });
    const groups: Record<PriceMixGroupKey, Acc> = { grosir: acc(), ecer: acc(), manual: acc() };
    const levels = new Map<number, Acc>();
    const all = acc();

    for (const l of lines) {
        const group = priceMixGroupOf(l.priceSource);
        const key = [l.salesId, l.itemId, l.itemVariantId ?? "", l.itemUnitId ?? "", group, l.priceLevelId ?? ""].join("|");
        const rev = dec(l.subtotalAmount);
        const pro = dec(l.profit);
        for (const a of [all, groups[group]]) {
            a.revenue = a.revenue.plus(rev);
            a.profit = a.profit.plus(pro);
            a.keys.add(key);
        }
        if (group === "grosir" && l.priceLevelId != null) {
            const a = levels.get(l.priceLevelId) ?? acc();
            a.revenue = a.revenue.plus(rev);
            a.profit = a.profit.plus(pro);
            a.keys.add(key);
            levels.set(l.priceLevelId, a);
        }
    }

    const out = (a: Acc): PriceMixGroup => ({
        revenue: a.revenue.toNumber(), profit: a.profit.toNumber(), lineCount: a.keys.size,
    });
    return {
        totalRevenue: all.revenue.toNumber(),
        totalProfit: all.profit.toNumber(),
        lineCount: all.keys.size,
        grosir: out(groups.grosir),
        ecer: out(groups.ecer),
        manual: out(groups.manual),
        byLevel: [...levels.entries()]
            .map(([id, a]) => ({ priceLevelId: id, name: levelNames.get(id) ?? `#${id}`, ...out(a) }))
            .sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name)),
    };
}

/**
 * Load + build the block for one report. `salesWhere` is the report's revenue
 * filter on Sales (e.g. `{ completedSessionId, status: "Completed", deleted: false }`).
 * Level names are read only when a line carries a level (deleted levels included:
 * history keeps its name).
 */
export async function loadPriceMixReport(
    tenantPrisma: PrismaClient,
    salesWhere: Record<string, unknown>,
): Promise<PriceMixReport> {
    const lines = await tenantPrisma.salesItem.findMany({
        where: { sales: salesWhere, deleted: false },
        select: {
            salesId: true, itemId: true, itemVariantId: true, itemUnitId: true,
            priceSource: true, priceLevelId: true, subtotalAmount: true, profit: true,
        },
    });
    if (lines.length === 0) return emptyPriceMix();
    const levelIds = [...new Set(lines.map((l) => l.priceLevelId).filter((id): id is number => id != null))];
    const levelNames = new Map<number, string>();
    if (levelIds.length > 0) {
        const levels = await tenantPrisma.priceLevel.findMany({
            where: { id: { in: levelIds } },
            select: { id: true, name: true },
        });
        levels.forEach((l) => levelNames.set(l.id, l.name));
    }
    return buildPriceMixReport(lines, levelNames);
}
