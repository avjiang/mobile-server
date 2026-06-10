import { Prisma } from "../../prisma/client/generated/client";
import { Decimal } from 'decimal.js';

/**
 * Sales cost restatement — keeps the profit snapshots on sales lines truthful when a
 * stock receipt's per-unit cost changes AFTER units were already sold from it.
 *
 * Sales lines snapshot cost/profit at sale time (reports aggregate these stored values
 * directly). Piece-based FIFO lines record which receipt priced them via
 * SalesItem.stockReceiptId / warehouseStockReceiptId, so when a receipt is re-priced
 * (supplier-invoice discount, invoice cancel/delete revert, manual capital edit) the
 * affected lines are found by an indexed lookup — no scanning — and their cost + profit
 * are rewritten, then the parent Sales.PROFIT_AMOUNT is re-summed.
 *
 * Not covered (links are NULL by design): consumption/weighted-average lines and
 * fallback-cost lines (sold when receipts were depleted), plus all sales that predate
 * the link column.
 *
 * Raw SQL is used for set-based arithmetic updates; UPDATED_AT and VERSION are bumped
 * manually so FE delta sync picks the restated rows up.
 */

export interface ReceiptCostChange {
    location: 'OUTLET' | 'WAREHOUSE';
    receiptId: number;
    newCost: Decimal; // per-unit
}

export const restateSalesCostsForReceipts = async (
    tx: Prisma.TransactionClient,
    changes: ReceiptCostChange[]
): Promise<number> => {
    if (changes.length === 0) return 0;

    const affectedSalesIds = new Set<number>();

    for (const change of changes) {
        const linkColumn = change.location === 'OUTLET'
            ? Prisma.raw('STOCK_RECEIPT_ID')
            : Prisma.raw('WAREHOUSE_STOCK_RECEIPT_ID');
        // Bind the per-unit cost as DECIMAL so the comparison/arithmetic stays exact
        const newLineCost = Prisma.sql`CAST(${change.newCost.toFixed(4)} AS DECIMAL(15, 4)) * QUANTITY`;

        const staleRows = await tx.$queryRaw<{ SALES_ID: number }[]>(Prisma.sql`
            SELECT DISTINCT SALES_ID FROM sales_item
            WHERE ${linkColumn} = ${change.receiptId}
              AND IS_DELETED = 0
              AND COST <> ${newLineCost}`);
        if (staleRows.length === 0) continue;
        staleRows.forEach(row => affectedSalesIds.add(Number(row.SALES_ID)));

        await tx.$executeRaw(Prisma.sql`
            UPDATE sales_item
            SET COST = ${newLineCost},
                PROFIT = PRICE - (${newLineCost}) - DISCOUNT_AMOUNT - SERVICE_CHARGE_AMOUNT,
                UPDATED_AT = NOW(),
                VERSION = COALESCE(VERSION, 1) + 1
            WHERE ${linkColumn} = ${change.receiptId}
              AND IS_DELETED = 0
              AND COST <> ${newLineCost}`);
    }

    if (affectedSalesIds.size === 0) return 0;

    // Re-sum the parent sale headers (PROFIT_AMOUNT is exactly the sum of line profits
    // at creation time, so this aggregate restatement is exact).
    const salesIds = [...affectedSalesIds];
    await tx.$executeRaw(Prisma.sql`
        UPDATE sales s
        JOIN (
            SELECT SALES_ID, SUM(PROFIT) AS TOTAL_PROFIT
            FROM sales_item
            WHERE SALES_ID IN (${Prisma.join(salesIds)}) AND IS_DELETED = 0
            GROUP BY SALES_ID
        ) li ON li.SALES_ID = s.ID
        SET s.PROFIT_AMOUNT = li.TOTAL_PROFIT,
            s.UPDATED_AT = NOW(),
            s.VERSION = COALESCE(s.VERSION, 1) + 1`);

    return salesIds.length;
};
