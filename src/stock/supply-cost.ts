/**
 * Latest known unit cost of an item from its outlet FIFO receipts.
 *
 * A stock-tracked laundry supply stores `cost: 0` on its item row by design — its
 * real cost lives in StockReceipt (see item.service getSupplyCosts). When a supply
 * runs short (balance goes negative, see ./supply-shortage.ts) there is no live
 * receipt left to price the shortfall, so we use the most recent purchase price:
 *
 *   latest receipt (receiptDate desc, id desc) AT THE OUTLET, else at any outlet,
 *   else item.cost, else 0.
 *
 * "Receipt" includes layers a sale consumed to zero — FIFO depletion soft-deletes
 * them (deleted = true, quantity = 0), and for a supply that ran out those are
 * exactly the latest purchases. Receipts soft-deleted with quantity left (replaced
 * by a stock override, or a cancelled delivery order) are NOT a purchase price and
 * are ignored.
 */
import { Decimal } from "decimal.js";

type Db = any; // tenant PrismaClient or interactive-transaction client

export async function latestReceiptCosts(
    db: Db,
    itemIds: number[],
    outletId: number | null,
    itemCostFallback: Map<number, Decimal.Value | { toString(): string } | null | undefined> = new Map(),
): Promise<Map<number, Decimal>> {
    const out = new Map<number, Decimal>();
    const ids = [...new Set(itemIds)];
    if (ids.length === 0) return out;

    const receipts: { itemId: number; outletId: number; cost: any }[] = await db.stockReceipt.findMany({
        where: {
            itemId: { in: ids },
            OR: [{ deleted: false }, { quantity: 0 }],
        },
        select: { itemId: true, outletId: true, cost: true },
        orderBy: [{ receiptDate: 'desc' }, { id: 'desc' }],
    });

    const atOutlet = new Map<number, Decimal>();
    const anywhere = new Map<number, Decimal>();
    for (const r of receipts) {
        if (outletId !== null && r.outletId === outletId && !atOutlet.has(r.itemId)) {
            atOutlet.set(r.itemId, new Decimal(r.cost.toString()));
        }
        if (!anywhere.has(r.itemId)) anywhere.set(r.itemId, new Decimal(r.cost.toString()));
    }

    for (const id of ids) {
        const fallback = itemCostFallback.get(id);
        out.set(
            id,
            atOutlet.get(id)
            ?? anywhere.get(id)
            ?? (fallback !== null && fallback !== undefined ? new Decimal(fallback.toString()) : new Decimal(0)),
        );
    }
    return out;
}
