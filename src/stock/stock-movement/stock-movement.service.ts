import { Prisma, PrismaClient } from "../../../prisma/client/generated/client"
import { getTenantPrisma } from '../../db';

let getStockChecksByItemIdAndOutlet = async (databaseName: string, itemId: number, outletId: number, itemVariantId?: number | null) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName)
    try {
        const whereCondition: any = {
            itemId: itemId,
            outletId: outletId
        }
        // Only add itemVariantId filter if explicitly provided (including null)
        if (itemVariantId !== undefined) {
            whereCondition.itemVariantId = itemVariantId
        }

        const stockMovements = await tenantPrisma.stockMovement.findMany({
            where: whereCondition,
            include: {
                outlet: {
                    select: {
                        outletName: true
                    }
                },
                itemVariant: {
                    select: {
                        variantSku: true,
                        variantName: true,
                    }
                }
            },
            take: 25,
            orderBy: {
                createdAt: 'desc' // This will sort from newest to oldest
            }
        })
        return stockMovements.map(movement => ({
            ...movement,
            outletName: movement.outlet.outletName,
            outlet: undefined
        }))
    }
    catch (error) {
        throw error
    }
}

// ── Stock Movement Report ────────────────────────────────────────────────────
// Three read surfaces over the immutable `stock_movement` audit table, all bounded
// to a single outlet + period (rule: never sum all prior history; opening/closing
// come from the first/last in-range row's PREVIOUS_AVAILABLE_QUANTITY). The
// composite index (OUTLET_ID, CREATED_AT) added 2026-06-30 serves every scan here.
// See docs/modules/STOCK_AND_COST.md (Stock Movement Report) / REPORT.md.

// Raw rows skip Prisma's Decimal/BigInt coercion: Decimal(15,4) comes back as a
// JS string and COUNT() as BigInt. Normalize every numeric field through this.
const num = (v: any): number => {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'bigint') return Number(v);
    return Number(v);
};

/**
 * Movement Summary — one row per item AND per variant (variants are NOT rolled up
 * to the parent), with opening / total-in / total-out / net / closing for the
 * period. Single $queryRaw: the in/out split needs conditional aggregation Prisma
 * groupBy can't express, and opening/closing are the earliest/latest row's stored
 * balance picked via GROUP_CONCAT(... ORDER BY ...) + SUBSTRING_INDEX(...,1) — the
 * first element is always at the head of the concat, so the default
 * group_concat_max_len truncation (which drops the tail) can never affect it.
 */
let getMovementSummary = async (databaseName: string, outletId: number, gte: Date, lte: Date) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName)
    const rows: any[] = await tenantPrisma.$queryRaw(Prisma.sql`
        SELECT
            sm.ITEM_ID AS itemId,
            sm.ITEM_VARIANT_ID AS itemVariantId,
            i.ITEM_NAME AS itemName,
            iv.VARIANT_NAME AS variantName,
            COALESCE(iv.COST, i.COST) AS unitCost,
            SUM(CASE WHEN sm.AVAILABLE_QUANTITY_DELTA > 0 THEN sm.AVAILABLE_QUANTITY_DELTA ELSE 0 END) AS totalIn,
            SUM(CASE WHEN sm.AVAILABLE_QUANTITY_DELTA < 0 THEN sm.AVAILABLE_QUANTITY_DELTA ELSE 0 END) AS totalOut,
            SUM(sm.AVAILABLE_QUANTITY_DELTA) AS netDelta,
            CAST(SUBSTRING_INDEX(
                GROUP_CONCAT(sm.PREVIOUS_AVAILABLE_QUANTITY ORDER BY sm.CREATED_AT ASC, sm.ID ASC), ',', 1
            ) AS DECIMAL(15,4)) AS opening,
            CAST(SUBSTRING_INDEX(
                GROUP_CONCAT((sm.PREVIOUS_AVAILABLE_QUANTITY + sm.AVAILABLE_QUANTITY_DELTA) ORDER BY sm.CREATED_AT DESC, sm.ID DESC), ',', 1
            ) AS DECIMAL(15,4)) AS closing
        FROM stock_movement sm
        JOIN item i ON i.ID = sm.ITEM_ID
        LEFT JOIN item_variant iv ON iv.ID = sm.ITEM_VARIANT_ID
        WHERE sm.OUTLET_ID = ${outletId}
            AND sm.IS_DELETED = 0
            AND sm.CREATED_AT >= ${gte}
            AND sm.CREATED_AT <= ${lte}
        GROUP BY sm.ITEM_ID, sm.ITEM_VARIANT_ID, i.ITEM_NAME, iv.VARIANT_NAME, i.COST, iv.COST
        ORDER BY i.ITEM_NAME ASC, iv.VARIANT_NAME ASC
    `);

    return rows.map(r => ({
        itemId: num(r.itemId),
        itemVariantId: r.itemVariantId === null ? null : num(r.itemVariantId),
        itemName: r.itemName,
        variantName: r.variantName ?? null,
        unitCost: num(r.unitCost),
        opening: num(r.opening),
        totalIn: num(r.totalIn),
        totalOut: num(r.totalOut),
        netDelta: num(r.netDelta),
        closing: num(r.closing),
    }));
};

/**
 * Movement by Type — net quantity grouped by movementType for the outlet+period.
 * Clean Prisma groupBy (no conditional logic). FE maps the raw movementType to a
 * localized EN/ID label; unmapped values fall back to the raw string.
 */
let getMovementByType = async (databaseName: string, outletId: number, gte: Date, lte: Date) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName)
    const groups = await tenantPrisma.stockMovement.groupBy({
        by: ['movementType'],
        where: {
            outletId: outletId,
            deleted: false,
            createdAt: { gte, lte },
        },
        _sum: { availableQuantityDelta: true },
        _count: { _all: true },
    });
    return groups
        .map(g => ({
            movementType: g.movementType,
            netDelta: num(g._sum.availableQuantityDelta),
            count: num(g._count._all),
        }))
        .sort((a, b) => Math.abs(b.netDelta) - Math.abs(a.netDelta));
};

/**
 * Movement by Type — DETAIL drill-down: the individual movements of ONE
 * movementType for the outlet + period (across all items), paginated. Powers the
 * "Per Jenis" row tap. Ordered newest-first; returns each movement's item (+
 * variant) name, timestamp, signed qty delta, and document/remark so the user
 * can see what made up the aggregate net figure.
 */
let getMovementByTypeDetail = async (
    databaseName: string,
    outletId: number,
    movementType: string,
    gte: Date,
    lte: Date,
    skip: number,
    take: number,
) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName)
    const where: any = {
        outletId,
        movementType,
        deleted: false,
        createdAt: { gte, lte },
    };

    const [rows, total] = await Promise.all([
        tenantPrisma.stockMovement.findMany({
            where,
            include: {
                item: { select: { itemName: true } },
                itemVariant: { select: { variantName: true } },
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip,
            take,
        }),
        tenantPrisma.stockMovement.count({ where }),
    ]);

    return {
        movementType,
        total: num(total),
        skip,
        take,
        rows: rows.map(m => ({
            id: m.id,
            createdAt: m.createdAt,
            itemId: m.itemId,
            itemName: m.item?.itemName ?? null,
            itemVariantId: m.itemVariantId,
            variantName: m.itemVariant?.variantName ?? null,
            documentId: m.documentId,
            reason: m.reason,
            remark: m.remark,
            performedBy: m.performedBy ?? '',
            availableQuantityDelta: num(m.availableQuantityDelta),
        })),
    };
};

/**
 * Stock Card — paginated chronological ledger for ONE item (+ optional variant)
 * over the period, plus the period opening/closing/in/out so the FE cover page
 * and PDF need no extra calls. Running balance is free: each row already stores
 * PREVIOUS_AVAILABLE_QUANTITY, so running = previous + delta (computed FE-side).
 */
let getStockCard = async (
    databaseName: string,
    outletId: number,
    itemId: number,
    itemVariantId: number | null | undefined,
    gte: Date,
    lte: Date,
    skip: number,
    take: number,
) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName)

    const where: any = {
        outletId,
        itemId,
        deleted: false,
        createdAt: { gte, lte },
    };
    if (itemVariantId !== undefined) {
        where.itemVariantId = itemVariantId;
    }

    const [rows, total, firstRow, lastRow, sums] = await Promise.all([
        tenantPrisma.stockMovement.findMany({
            where,
            include: {
                itemVariant: { select: { variantName: true, variantSku: true } },
                item: { select: { itemName: true } },
                outlet: { select: { outletName: true } },
            },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            skip,
            take,
        }),
        tenantPrisma.stockMovement.count({ where }),
        // Opening = earliest in-range row's PREVIOUS_AVAILABLE_QUANTITY (index-served LIMIT 1).
        tenantPrisma.stockMovement.findFirst({
            where,
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            select: { previousAvailableQuantity: true },
        }),
        // Closing = latest in-range row's PREVIOUS_AVAILABLE_QUANTITY + delta.
        tenantPrisma.stockMovement.findFirst({
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            select: { previousAvailableQuantity: true, availableQuantityDelta: true },
        }),
        tenantPrisma.stockMovement.aggregate({
            where,
            _sum: { availableQuantityDelta: true },
        }),
    ]);

    // In/out split needs the conditional sums; one extra bounded raw aggregate.
    const split: any[] = await tenantPrisma.$queryRaw(Prisma.sql`
        SELECT
            SUM(CASE WHEN AVAILABLE_QUANTITY_DELTA > 0 THEN AVAILABLE_QUANTITY_DELTA ELSE 0 END) AS totalIn,
            SUM(CASE WHEN AVAILABLE_QUANTITY_DELTA < 0 THEN AVAILABLE_QUANTITY_DELTA ELSE 0 END) AS totalOut
        FROM stock_movement
        WHERE OUTLET_ID = ${outletId}
            AND ITEM_ID = ${itemId}
            ${itemVariantId === undefined
                ? Prisma.empty
                : itemVariantId === null
                    ? Prisma.sql`AND ITEM_VARIANT_ID IS NULL`
                    : Prisma.sql`AND ITEM_VARIANT_ID = ${itemVariantId}`}
            AND IS_DELETED = 0
            AND CREATED_AT >= ${gte}
            AND CREATED_AT <= ${lte}
    `);

    const opening = firstRow ? num(firstRow.previousAvailableQuantity) : 0;
    const closing = lastRow
        ? num(lastRow.previousAvailableQuantity) + num(lastRow.availableQuantityDelta)
        : opening;

    const sample = rows[0];
    return {
        itemName: sample?.item?.itemName ?? null,
        variantName: sample?.itemVariant?.variantName ?? null,
        outletName: sample?.outlet?.outletName ?? null,
        opening,
        closing,
        totalIn: num(split[0]?.totalIn),
        totalOut: num(split[0]?.totalOut),
        netDelta: num(sums._sum.availableQuantityDelta),
        total: num(total),
        skip,
        take,
        rows: rows.map(m => ({
            id: m.id,
            createdAt: m.createdAt,
            movementType: m.movementType,
            documentId: m.documentId,
            reason: m.reason,
            remark: m.remark,
            performedBy: m.performedBy ?? '',
            itemVariantId: m.itemVariantId,
            variantName: m.itemVariant?.variantName ?? null,
            previousAvailableQuantity: num(m.previousAvailableQuantity),
            availableQuantityDelta: num(m.availableQuantityDelta),
            runningBalance: num(m.previousAvailableQuantity) + num(m.availableQuantityDelta),
        })),
    };
};

// Movement types that represent stock LOST without a sale — the shrinkage
// buckets. A negative-delta Stock Adjustment (count corrected down) or any Stock
// Clearance (written off: expired/broken/spoilt) is inventory paid for but never
// turned into revenue. Sales/voids/returns are excluded — they're normal trade.
const SHRINKAGE_TYPES = ['Stock Adjustment', 'Stock Clearance'];

/**
 * Owner-facing INSIGHTS for the outlet + period, in three parts:
 *  • shrinkage — value (at standard cost) of stock lost without a sale, split by
 *    type; only negative-delta Stock Adjustment + Stock Clearance count.
 *  • lowStock — items at/below their reorder threshold RIGHT NOW (current
 *    StockBalance, not period-bound) — the reorder action list.
 *  • deadStock — tracked items holding positive stock that had ZERO movement in
 *    the period (tied-up capital), valued at standard cost, top 20 by value.
 * Every list is LIMIT-bounded so the call stays cheap. Value basis is standard
 * cost: COALESCE(variant.cost, item.cost). See REPORT.md / STOCK_AND_COST.md.
 */
let getInsights = async (databaseName: string, outletId: number, gte: Date, lte: Date) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName)

    const shrinkageRows: any[] = await tenantPrisma.$queryRaw(Prisma.sql`
        SELECT
            sm.MOVEMENT_TYPE AS movementType,
            SUM(ABS(sm.AVAILABLE_QUANTITY_DELTA)) AS quantity,
            SUM(ABS(sm.AVAILABLE_QUANTITY_DELTA) * COALESCE(iv.COST, i.COST)) AS value
        FROM stock_movement sm
        JOIN item i ON i.ID = sm.ITEM_ID
        LEFT JOIN item_variant iv ON iv.ID = sm.ITEM_VARIANT_ID
        WHERE sm.OUTLET_ID = ${outletId}
            AND sm.IS_DELETED = 0
            AND sm.CREATED_AT >= ${gte}
            AND sm.CREATED_AT <= ${lte}
            AND sm.MOVEMENT_TYPE IN (${Prisma.join(SHRINKAGE_TYPES)})
            AND sm.AVAILABLE_QUANTITY_DELTA < 0
        GROUP BY sm.MOVEMENT_TYPE
    `);

    const lowStockRows: any[] = await tenantPrisma.$queryRaw(Prisma.sql`
        SELECT
            i.ID AS itemId,
            sb.ITEM_VARIANT_ID AS itemVariantId,
            i.ITEM_NAME AS itemName,
            iv.VARIANT_NAME AS variantName,
            sb.AVAILABLE_QUANTITY AS availableQuantity,
            sb.REORDER_THRESHOLD AS reorderThreshold
        FROM stock_balance sb
        JOIN item i ON i.ID = sb.ITEM_ID
        LEFT JOIN item_variant iv ON iv.ID = sb.ITEM_VARIANT_ID
        WHERE sb.OUTLET_ID = ${outletId}
            AND sb.IS_DELETED = 0
            AND i.IS_DELETED = 0
            AND i.TRACK_STOCK = 1
            AND sb.REORDER_THRESHOLD IS NOT NULL
            AND sb.REORDER_THRESHOLD > 0
            AND sb.AVAILABLE_QUANTITY <= sb.REORDER_THRESHOLD
        ORDER BY (sb.AVAILABLE_QUANTITY - sb.REORDER_THRESHOLD) ASC
        LIMIT 50
    `);

    const deadStockRows: any[] = await tenantPrisma.$queryRaw(Prisma.sql`
        SELECT
            i.ID AS itemId,
            sb.ITEM_VARIANT_ID AS itemVariantId,
            i.ITEM_NAME AS itemName,
            iv.VARIANT_NAME AS variantName,
            sb.AVAILABLE_QUANTITY AS availableQuantity,
            (sb.AVAILABLE_QUANTITY * COALESCE(iv.COST, i.COST)) AS value
        FROM stock_balance sb
        JOIN item i ON i.ID = sb.ITEM_ID
        LEFT JOIN item_variant iv ON iv.ID = sb.ITEM_VARIANT_ID
        WHERE sb.OUTLET_ID = ${outletId}
            AND sb.IS_DELETED = 0
            AND i.IS_DELETED = 0
            AND i.TRACK_STOCK = 1
            AND sb.AVAILABLE_QUANTITY > 0
            AND NOT EXISTS (
                SELECT 1 FROM stock_movement sm
                WHERE sm.ITEM_ID = sb.ITEM_ID
                    AND sm.OUTLET_ID = sb.OUTLET_ID
                    AND COALESCE(sm.ITEM_VARIANT_ID, 0) = COALESCE(sb.ITEM_VARIANT_ID, 0)
                    AND sm.IS_DELETED = 0
                    AND sm.CREATED_AT >= ${gte}
                    AND sm.CREATED_AT <= ${lte}
            )
        ORDER BY value DESC
        LIMIT 20
    `);

    const shrinkage = shrinkageRows.map(r => ({
        movementType: r.movementType,
        quantity: num(r.quantity),
        value: num(r.value),
    }));

    return {
        shrinkage: {
            totalQuantity: shrinkage.reduce((s, r) => s + r.quantity, 0),
            totalValue: shrinkage.reduce((s, r) => s + r.value, 0),
            byType: shrinkage,
        },
        lowStock: lowStockRows.map(r => ({
            itemId: num(r.itemId),
            itemVariantId: r.itemVariantId === null ? null : num(r.itemVariantId),
            itemName: r.itemName,
            variantName: r.variantName ?? null,
            availableQuantity: num(r.availableQuantity),
            reorderThreshold: num(r.reorderThreshold),
        })),
        deadStock: deadStockRows.map(r => ({
            itemId: num(r.itemId),
            itemVariantId: r.itemVariantId === null ? null : num(r.itemVariantId),
            itemName: r.itemName,
            variantName: r.variantName ?? null,
            availableQuantity: num(r.availableQuantity),
            value: num(r.value),
        })),
    };
};

export = { getStockChecksByItemIdAndOutlet, getMovementSummary, getMovementByType, getMovementByTypeDetail, getStockCard, getInsights }
