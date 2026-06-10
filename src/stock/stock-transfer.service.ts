/**
 * Stock Transfer — generalized location ↔ location stock movement.
 *
 * Handles warehouse→outlet (replenishment), outlet→warehouse (centralizing), and
 * outlet→outlet (multi-outlet) in one primitive. Per AD2/AD5: it rides the shared
 * location-stock-engine, so it never duplicates FIFO logic.
 *
 * FIFO cost + receiptDate are preserved across the move: stock is consumed from the
 * source oldest-first, and each consumed cost layer is re-created in the destination
 * with the same cost and original receiptDate (so destination FIFO order is identical).
 * Paired movements: "Transfer Out" (source) + "Transfer In" (destination).
 *
 * The warehouse drain on plan-downgrade (Phase 2b) is the "transfer everything"
 * special case of this same primitive.
 */
import { Decimal } from "decimal.js";
import { PrismaClient } from "../../prisma/client/generated/client";
import { NotFoundError, RequestValidateError } from "../api-helpers/error";
import { getTenantPrisma } from "../db";
import {
    outletRef,
    warehouseRef,
    consumeFIFO,
    receiveLayers,
    LocationRef,
} from "./location-stock-engine";
import { validateItemsAndVariants } from "../warehouse/warehouse-stock.service";

const MAX_QTY = 999999;

export type LocationType = "OUTLET" | "WAREHOUSE";

export interface TransferItem {
    itemId: number;
    itemVariantId?: number | null;
    quantity: number;
}

export interface TransferBody {
    sourceType: LocationType;
    sourceId: number;
    destType: LocationType;
    destId: number;
    items: TransferItem[];
    reason?: string;
    performedBy?: string | null;
}

type Tx = any;

async function requireLocation(tx: Tx, type: LocationType, id: number): Promise<void> {
    if (type === "WAREHOUSE") {
        const w = await tx.warehouse.findFirst({ where: { id, deleted: false }, select: { id: true } });
        if (!w) throw new NotFoundError(`Warehouse ${id} not found`);
    } else {
        const o = await tx.outlet.findFirst({ where: { id, deleted: false }, select: { id: true } });
        if (!o) throw new NotFoundError(`Outlet ${id} not found`);
    }
}

function refFor(tx: Tx, type: LocationType, id: number): LocationRef {
    return type === "WAREHOUSE" ? warehouseRef(tx, id) : outletRef(tx, id);
}

async function transferStock(databaseName: string, body: TransferBody) {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);

    if (!body.items || body.items.length === 0) {
        throw new RequestValidateError("At least one item is required");
    }
    if (body.sourceType === body.destType && body.sourceId === body.destId) {
        throw new RequestValidateError("Source and destination must be different locations");
    }
    for (const it of body.items) {
        if (!(it.quantity > 0)) {
            throw new RequestValidateError(`Quantity must be greater than 0 for item ${it.itemId}`);
        }
        if (it.quantity > MAX_QTY) {
            throw new RequestValidateError(`Quantity exceeds maximum (${MAX_QTY}) for item ${it.itemId}`);
        }
    }

    let itemsTransferred = 0;
    let totalQuantity = new Decimal(0);
    let totalValue = new Decimal(0);

    await tenantPrisma.$transaction(async (tx) => {
        await requireLocation(tx, body.sourceType, body.sourceId);
        await requireLocation(tx, body.destType, body.destId);
        const itemMap = await validateItemsAndVariants(tx, body.items);
        const src = refFor(tx, body.sourceType, body.sourceId);
        const dst = refFor(tx, body.destType, body.destId);

        for (const it of body.items) {
            const variantId = it.itemVariantId ?? null;
            const item = itemMap.get(it.itemId)!;

            const result = await consumeFIFO(src, {
                itemId: it.itemId,
                itemVariantId: variantId,
                quantity: new Decimal(it.quantity),
                fallbackCost: item.cost,
                movementType: "Transfer Out",
                reason: body.reason || `Transfer to ${dst.label}`,
                performedBy: body.performedBy ?? null,
            });

            await receiveLayers(dst, {
                itemId: it.itemId,
                itemVariantId: variantId,
                layers: result.layers.map((l) => ({
                    quantity: l.quantityUsed,
                    cost: l.cost,
                    receiptDate: l.receiptDate,
                    // Preserve procurement provenance across the move so invoice
                    // re-pricing reaches transferred layers at their new location.
                    deliveryOrderId: l.deliveryOrderId,
                })),
                movementType: "Transfer In",
                reason: body.reason || `Transfer from ${src.label}`,
                performedBy: body.performedBy ?? null,
            });

            itemsTransferred++;
            totalQuantity = totalQuantity.add(it.quantity);
            totalValue = totalValue.add(result.totalCost);
        }
    });

    return {
        itemsTransferred,
        totalQuantity: totalQuantity.toString(),
        totalValue: totalValue.toString(),
    };
}

/**
 * Drain ALL warehouse stock back to a target outlet — the "transfer everything"
 * special case used by the Pro→Basic downgrade (AD4/AD5). Operates on a caller-
 * supplied tenant transaction so it stays atomic with the rest of the downgrade.
 *
 * SET-BASED raw SQL implementation: a full drain is a wholesale relocation (no FIFO
 * splitting — every receipt moves entirely), so it collapses to a fixed number of
 * statements regardless of row count (O(1) round-trips, not O(rows)). FIFO cost +
 * RECEIPT_DATE are preserved by copying receipt rows verbatim; balances merge
 * additively; paired Transfer Out / Transfer In movements are written.
 *
 * MySQL-specific: NULL-safe variant matching uses `<=>` (not Postgres
 * `IS NOT DISTINCT FROM`); `UPDATE ... JOIN ... SET` (not `UPDATE ... FROM`). Every
 * mutating statement sets `UPDATED_AT = NOW()` (delta-sync + project rule). All
 * statements are parameterised; the only interpolation-free dynamic values are the
 * target outlet id, reason and performedBy, passed as bound `?` parameters.
 *
 * Note (AD2): this is a second, SQL-level relocation path distinct from the row-wise
 * engine used by transferStock(). It is justified only because a full drain is a
 * wholesale move that the engine's per-row FIFO loop cannot express set-based, and
 * downgrade is a bulk/rare operation where round-trip count dominates. A normal
 * (partial-quantity) transfer must split receipts, so it stays on the engine.
 *
 * The CALLER must ensure a target outlet exists before invoking (refuse the
 * downgrade otherwise — never strand stock).
 *
 * Ordering matters: movements (which read the pre-drain state) and the receipt copy
 * + balance merge MUST run before the warehouse stock is zeroed (step 6).
 */
async function drainAllWarehousesToOutlet(
    tx: Tx,
    targetOutletId: number,
    performedBy?: string | null
): Promise<{ itemsDrained: number; totalQuantity: string; totalValue: string }> {
    const who = performedBy ?? "SYSTEM";
    const reason = "Auto-drain on plan downgrade";

    // Summary BEFORE mutation (drives the response; itemsDrained = balance rows moved).
    const summary: any[] = await tx.$queryRawUnsafe(
        `SELECT COUNT(*) AS items, COALESCE(SUM(AVAILABLE_QUANTITY), 0) AS qty
         FROM warehouse_stock_balance WHERE IS_DELETED = 0 AND AVAILABLE_QUANTITY > 0`
    );
    const valueRows: any[] = await tx.$queryRawUnsafe(
        `SELECT COALESCE(SUM(QUANTITY * COST), 0) AS val
         FROM warehouse_stock_receipt WHERE IS_DELETED = 0 AND QUANTITY > 0`
    );
    const itemsDrained = Number(summary?.[0]?.items ?? 0);
    const totalQuantity = String(summary?.[0]?.qty ?? "0");
    const totalValue = String(valueRows?.[0]?.val ?? "0");

    if (itemsDrained === 0) {
        return { itemsDrained: 0, totalQuantity: "0", totalValue: "0" };
    }

    // 1) Warehouse "Transfer Out" movements (previous = current warehouse balance).
    await tx.$executeRawUnsafe(
        `INSERT INTO warehouse_stock_movement
           (ITEM_ID, WAREHOUSE_ID, ITEM_VARIANT_ID, PREVIOUS_AVAILABLE_QUANTITY, PREVIOUS_ON_HAND_QUANTITY,
            AVAILABLE_QUANTITY_DELTA, ON_HAND_QUANTITY_DELTA, MOVEMENT_TYPE, DOCUMENT_ID, REASON, REMARK,
            IS_DELETED, CREATED_AT, UPDATED_AT, VERSION, PERFORMED_BY)
         SELECT w.ITEM_ID, w.WAREHOUSE_ID, w.ITEM_VARIANT_ID, w.AVAILABLE_QUANTITY, w.ON_HAND_QUANTITY,
                -w.AVAILABLE_QUANTITY, -w.ON_HAND_QUANTITY, 'Transfer Out', 0, ?, ?,
                0, NOW(), NOW(), 1, ?
         FROM warehouse_stock_balance w
         WHERE w.IS_DELETED = 0 AND w.AVAILABLE_QUANTITY > 0`,
        reason, reason, who
    );

    // 2) Outlet "Transfer In" movements (previous = current outlet balance, 0 if none).
    //    Quantities aggregate across all warehouses per (item, variant).
    await tx.$executeRawUnsafe(
        `INSERT INTO stock_movement
           (ITEM_ID, OUTLET_ID, ITEM_VARIANT_ID, PREVIOUS_AVAILABLE_QUANTITY, PREVIOUS_ON_HAND_QUANTITY,
            AVAILABLE_QUANTITY_DELTA, ON_HAND_QUANTITY_DELTA, MOVEMENT_TYPE, DOCUMENT_ID, REASON, REMARK,
            IS_DELETED, CREATED_AT, UPDATED_AT, VERSION, PERFORMED_BY)
         SELECT agg.ITEM_ID, ?, agg.ITEM_VARIANT_ID,
                COALESCE(o.AVAILABLE_QUANTITY, 0), COALESCE(o.ON_HAND_QUANTITY, 0),
                agg.qty, agg.onhand, 'Transfer In', 0, ?, ?, 0, NOW(), NOW(), 1, ?
         FROM (
            SELECT ITEM_ID, ITEM_VARIANT_ID, SUM(AVAILABLE_QUANTITY) AS qty, SUM(ON_HAND_QUANTITY) AS onhand
            FROM warehouse_stock_balance WHERE IS_DELETED = 0 AND AVAILABLE_QUANTITY > 0
            GROUP BY ITEM_ID, ITEM_VARIANT_ID
         ) agg
         LEFT JOIN stock_balance o
           ON o.ITEM_ID = agg.ITEM_ID AND o.OUTLET_ID = ?
              AND o.ITEM_VARIANT_ID <=> agg.ITEM_VARIANT_ID AND o.IS_DELETED = 0`,
        targetOutletId, reason, reason, who, targetOutletId
    );

    // 3) Copy warehouse receipts -> outlet receipts (preserve COST + RECEIPT_DATE => FIFO order).
    //    Outlet stock_receipt has no REMARK column, so it is not selected.
    await tx.$executeRawUnsafe(
        `INSERT INTO stock_receipt
           (ITEM_ID, OUTLET_ID, ITEM_VARIANT_ID, DELIVERY_ORDER_ID, QUANTITY, COST, RECEIPT_DATE,
            CREATED_AT, UPDATED_AT, IS_DELETED, VERSION)
         SELECT r.ITEM_ID, ?, r.ITEM_VARIANT_ID, r.DELIVERY_ORDER_ID, r.QUANTITY, r.COST, r.RECEIPT_DATE,
                NOW(), NOW(), 0, 1
         FROM warehouse_stock_receipt r
         WHERE r.IS_DELETED = 0 AND r.QUANTITY > 0`,
        targetOutletId
    );

    // 4) Merge into existing outlet balances (additive).
    await tx.$executeRawUnsafe(
        `UPDATE stock_balance o
         JOIN (
            SELECT ITEM_ID, ITEM_VARIANT_ID, SUM(AVAILABLE_QUANTITY) AS qty, SUM(ON_HAND_QUANTITY) AS onhand
            FROM warehouse_stock_balance WHERE IS_DELETED = 0 AND AVAILABLE_QUANTITY > 0
            GROUP BY ITEM_ID, ITEM_VARIANT_ID
         ) agg ON o.ITEM_ID = agg.ITEM_ID AND o.ITEM_VARIANT_ID <=> agg.ITEM_VARIANT_ID
         SET o.AVAILABLE_QUANTITY = o.AVAILABLE_QUANTITY + agg.qty,
             o.ON_HAND_QUANTITY = o.ON_HAND_QUANTITY + agg.onhand,
             o.UPDATED_AT = NOW(), o.LAST_RESTOCK_DATE = NOW(),
             o.VERSION = COALESCE(o.VERSION, 1) + 1
         WHERE o.OUTLET_ID = ? AND o.IS_DELETED = 0`,
        targetOutletId
    );

    // 5) Insert outlet balances for items not yet stocked at the outlet.
    await tx.$executeRawUnsafe(
        `INSERT INTO stock_balance
           (ITEM_ID, OUTLET_ID, ITEM_VARIANT_ID, AVAILABLE_QUANTITY, ON_HAND_QUANTITY,
            IS_DELETED, LAST_RESTOCK_DATE, CREATED_AT, UPDATED_AT, VERSION)
         SELECT agg.ITEM_ID, ?, agg.ITEM_VARIANT_ID, agg.qty, agg.onhand, 0, NOW(), NOW(), NOW(), 1
         FROM (
            SELECT ITEM_ID, ITEM_VARIANT_ID, SUM(AVAILABLE_QUANTITY) AS qty, SUM(ON_HAND_QUANTITY) AS onhand
            FROM warehouse_stock_balance WHERE IS_DELETED = 0 AND AVAILABLE_QUANTITY > 0
            GROUP BY ITEM_ID, ITEM_VARIANT_ID
         ) agg
         WHERE NOT EXISTS (
            SELECT 1 FROM stock_balance o
            WHERE o.ITEM_ID = agg.ITEM_ID AND o.OUTLET_ID = ?
                  AND o.ITEM_VARIANT_ID <=> agg.ITEM_VARIANT_ID AND o.IS_DELETED = 0
         )`,
        targetOutletId, targetOutletId
    );

    // 6) Zero + soft-delete the now-relocated warehouse stock (receipts, then balances).
    await tx.$executeRawUnsafe(
        `UPDATE warehouse_stock_receipt
         SET QUANTITY = 0, IS_DELETED = 1, DELETED_AT = NOW(), UPDATED_AT = NOW(),
             VERSION = COALESCE(VERSION, 1) + 1
         WHERE IS_DELETED = 0 AND QUANTITY > 0`
    );
    await tx.$executeRawUnsafe(
        `UPDATE warehouse_stock_balance
         SET AVAILABLE_QUANTITY = 0, ON_HAND_QUANTITY = 0, UPDATED_AT = NOW(),
             VERSION = COALESCE(VERSION, 1) + 1
         WHERE IS_DELETED = 0 AND AVAILABLE_QUANTITY > 0`
    );

    return { itemsDrained, totalQuantity, totalValue };
}

export { transferStock, drainAllWarehousesToOutlet };
