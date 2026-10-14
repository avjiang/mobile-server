/**
 * Item rankings in base units (wholesale pricing, Phase 1r —
 * FE docs/modules/REPORT.md §4 priceMix).
 *
 * A carton line stores `quantity` in its sell unit ("2" Dus) and the unit's size in
 * `unitFactor` (40). Ranking on raw Σ quantity would count it as 2; stock is kept in
 * the base unit, so rankings use Σ quantity × coalesce(unitFactor, 1) = 80 pcs.
 * Lines without a unit (every line before the feature, laundry services and supply
 * lines, fractional consumption lines) have unitFactor null → factor 1 → unchanged.
 *
 * The callers group by (item…, unitFactor) without `take`, then merge here per item
 * and rank. The merged rows keep the Prisma `_sum` shape, so the existing mapping
 * code downstream is untouched.
 */
import { Decimal } from "decimal.js";

type Num = Decimal.Value | { toString(): string } | null | undefined;

const dec = (v: Num): Decimal =>
    v === null || v === undefined || v === "" ? new Decimal(0) : new Decimal(v.toString());

/** quantity × coalesce(unitFactor, 1). */
export const baseQty = (quantity: Num, unitFactor: Num): Decimal => {
    const f = unitFactor === null || unitFactor === undefined || unitFactor === "" ? new Decimal(1) : dec(unitFactor);
    return dec(quantity).times(f.gt(0) ? f : 1);
};

type SumKey = "quantity" | "subtotalAmount" | "profit" | "cost";

export interface UnitGroupRow {
    itemId: number;
    unitFactor?: Num;
    _sum: Partial<Record<SumKey, Num>>;
}

export type MergedRow<T extends UnitGroupRow> = Omit<T, "unitFactor" | "_sum"> & {
    _sum: Partial<Record<SumKey, Decimal>>;
};

/**
 * Merge rows that differ only by unitFactor. `keyFields` are the group-by
 * fields other than unitFactor (e.g. itemId, itemName, itemCode, itemBrand).
 * `_sum.quantity` becomes base units; the other sums add up as they are.
 */
export function mergeByBaseQty<T extends UnitGroupRow>(
    rows: readonly T[],
    keyFields: readonly (keyof T & string)[] = ["itemId"],
): MergedRow<T>[] {
    const merged = new Map<string, MergedRow<T>>();
    for (const row of rows) {
        const key = keyFields.map((f) => String((row as Record<string, unknown>)[f] ?? "")).join("\u0000");
        const { unitFactor, _sum, ...rest } = row;
        let m = merged.get(key);
        if (!m) {
            m = { ...(rest as Omit<T, "unitFactor" | "_sum">), _sum: {} } as MergedRow<T>;
            merged.set(key, m);
        }
        for (const k of Object.keys(_sum) as SumKey[]) {
            const add = k === "quantity" ? baseQty(_sum[k], unitFactor) : dec(_sum[k]);
            m._sum[k] = (m._sum[k] ?? new Decimal(0)).plus(add);
        }
    }
    return [...merged.values()];
}

/** Sort merged rows by one `_sum` field and keep the first `take`. Stable on ties. */
export function rankBy<T extends { _sum: Partial<Record<SumKey, Decimal>> }>(
    rows: readonly T[],
    field: SumKey,
    direction: "desc" | "asc",
    take: number,
): T[] {
    const v = (r: T) => r._sum[field] ?? new Decimal(0);
    return rows
        .map((r, i) => ({ r, i }))
        .sort((a, b) => (direction === "desc" ? v(b.r).comparedTo(v(a.r)) : v(a.r).comparedTo(v(b.r))) || a.i - b.i)
        .slice(0, take)
        .map((x) => x.r);
}
