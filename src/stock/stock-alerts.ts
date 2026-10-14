/**
 * Low-stock / out-of-stock alerts — ONE rule for every path that lowers an
 * OUTLET's stock (sale, stock adjustment, purchase return, transfer out of an
 * outlet, delivery-order cancellation).
 *
 * The rule fires on a CROSSING only, never on "is currently below":
 *   - out of stock: previous > 0 and new <= 0
 *   - low stock:    a reorder threshold is set, previous > threshold and
 *                   new <= threshold, and the row is not already out of stock
 * so a supply that already sits under its threshold (or in the negative) does
 * not push again on every movement.
 *
 * Warehouses have no notification topic — callers only pass outlet rows.
 *
 * Push payloads are the ones the sales path has always sent (topic
 * `tenant_{t}_outlet_{o}_inventory`, `type: 'out_of_stock' | 'low_stock'`, an
 * `items` list), plus `source` naming the operation. `soldQuantity` is kept
 * for sales; every other source carries the moved amount as `quantity`.
 */
import { Decimal } from 'decimal.js';
import { randomUUID } from 'crypto';
import PushyService from '../pushy/pushy.service';
import {
    formatLowStockMessage,
    formatOutOfStockMessage,
    getLowStockTitle,
    getOutOfStockTitle,
} from '../pushy/notification-messages';

export type StockAlertSource =
    | 'sale'
    | 'stock_adjustment'
    | 'purchase_return'
    | 'stock_transfer'
    | 'delivery_order_reversal';

export interface StockAlertRow {
    itemId: number;
    itemVariantId: number | null;
    itemName: string;
    itemCode: string | null;
    variantName?: string | null;
    previousAvailable: Decimal;
    newAvailable: Decimal;
    reorderThreshold: Decimal | null;
    /** Amount this operation moved out (sold / adjusted down / returned / transferred). */
    quantity: Decimal;
}

/** Who caused the change. The app hides the push from them (id AND username must match). */
export interface StockAlertActor {
    tenantId: number;
    userId: number;
    username: string;
}

export interface StockAlertParams {
    tenantId: number;
    outletId: number;
    rows: StockAlertRow[];
    triggeringUserId: number;
    triggeringUsername: string;
    source: StockAlertSource;
    salesId?: number;
}

export interface StockAlertNotification {
    topic: string;
    payload: { title: string; message: string; data: Record<string, any> };
}

const keyOf = (r: StockAlertRow) => `${r.itemId}-${r.itemVariantId ?? 'null'}`;

/**
 * Collapse rows for the same item/variant touched more than once by one
 * operation: the first `previousAvailable`, the last `newAvailable` (and
 * threshold), the summed `quantity`. Order of first appearance is kept.
 */
export function mergeStockAlertRows(rows: StockAlertRow[]): StockAlertRow[] {
    const merged = new Map<string, StockAlertRow>();
    for (const r of rows) {
        const key = keyOf(r);
        const seen = merged.get(key);
        if (!seen) {
            merged.set(key, { ...r });
            continue;
        }
        merged.set(key, {
            ...seen,
            itemName: seen.itemName || r.itemName,
            itemCode: seen.itemCode ?? r.itemCode,
            variantName: seen.variantName ?? r.variantName,
            newAvailable: r.newAvailable,
            reorderThreshold: r.reorderThreshold,
            quantity: new Decimal(seen.quantity).add(r.quantity),
        });
    }
    return [...merged.values()];
}

/** The crossing rule (see the file header). Rows are merged first. */
export function classifyStockAlerts(rows: StockAlertRow[]): {
    outOfStock: StockAlertRow[];
    lowStock: StockAlertRow[];
} {
    const outOfStock: StockAlertRow[] = [];
    const lowStock: StockAlertRow[] = [];
    for (const r of mergeStockAlertRows(rows)) {
        const prev = new Decimal(r.previousAvailable);
        const next = new Decimal(r.newAvailable);
        if (prev.gt(0) && next.lte(0)) {
            outOfStock.push(r);
            continue;
        }
        if (r.reorderThreshold !== null && r.reorderThreshold !== undefined) {
            const threshold = new Decimal(r.reorderThreshold);
            if (prev.gt(threshold) && next.lte(threshold)) lowStock.push(r);
        }
    }
    return { outOfStock, lowStock };
}

/** The moved amount: `soldQuantity` on a sale (as always), `quantity` elsewhere. */
function movedAmount(source: StockAlertSource, r: StockAlertRow): Record<string, number> {
    const n = new Decimal(r.quantity).toNumber();
    return source === 'sale' ? { soldQuantity: n } : { quantity: n };
}

function wrap(tenantId: number, outletId: number, title: string, message: string, data: Record<string, any>): StockAlertNotification {
    return {
        topic: `tenant_${tenantId}_outlet_${outletId}_inventory`,
        payload: {
            title,
            message,
            // Same envelope the sales path always used: `type` is overwritten by
            // the specific 'out_of_stock' / 'low_stock' from `data`.
            data: {
                notificationId: randomUUID(),
                type: 'INVENTORY',
                tenantId,
                timestamp: new Date().toISOString(),
                ...data,
            },
        },
    };
}

/** Pure: the notifications (0–2) one operation produces. */
export function buildStockAlertNotifications(p: StockAlertParams): StockAlertNotification[] {
    const { outOfStock, lowStock } = classifyStockAlerts(p.rows);
    const common = {
        outletId: p.outletId,
        ...(p.source === 'sale' && p.salesId !== undefined ? { salesId: p.salesId } : {}),
        source: p.source,
        triggeringUserId: p.triggeringUserId,
        triggeringUsername: p.triggeringUsername,
    };
    const out: StockAlertNotification[] = [];

    if (outOfStock.length > 0) {
        out.push(wrap(
            p.tenantId,
            p.outletId,
            getOutOfStockTitle(outOfStock.length),
            formatOutOfStockMessage(outOfStock),
            {
                type: 'out_of_stock',
                priority: 'high',
                count: outOfStock.length,
                items: outOfStock.map((r) => ({
                    itemId: r.itemId,
                    itemName: r.itemName,
                    itemCode: r.itemCode,
                    previousStock: new Decimal(r.previousAvailable).toNumber(),
                    currentStock: 0,
                    ...movedAmount(p.source, r),
                })),
                ...common,
                timestamp: new Date().toISOString(),
            },
        ));
    }

    if (lowStock.length > 0) {
        out.push(wrap(
            p.tenantId,
            p.outletId,
            getLowStockTitle(lowStock.length),
            formatLowStockMessage(lowStock.map((r) => ({
                itemName: r.itemName,
                newAvailableQuantity: new Decimal(r.newAvailable).toNumber(),
            }))),
            {
                type: 'low_stock',
                priority: 'normal',
                count: lowStock.length,
                items: lowStock.map((r) => ({
                    itemId: r.itemId,
                    itemName: r.itemName,
                    itemCode: r.itemCode,
                    previousStock: new Decimal(r.previousAvailable).toNumber(),
                    currentStock: new Decimal(r.newAvailable).toNumber(),
                    reorderThreshold: new Decimal(r.reorderThreshold!).toNumber(),
                    ...movedAmount(p.source, r),
                })),
                ...common,
                timestamp: new Date().toISOString(),
            },
        ));
    }
    return out;
}

/**
 * Fire-and-forget: call it AFTER the stock transaction commits. Never throws
 * and never blocks the caller (the send runs on its own promise).
 */
export function sendStockAlerts(p: StockAlertParams): void {
    try {
        if (!p.rows || p.rows.length === 0) return;
        for (const n of buildStockAlertNotifications(p)) {
            PushyService.sendToTopic(n.topic, n.payload, p.tenantId).catch((error) => {
                console.error('Failed to send inventory notification:', error);
            });
        }
    } catch (error) {
        console.error('Failed to build stock alerts:', error);
    }
}

/**
 * Group rows by outlet and send each group — for operations that can span
 * outlets in one request (purchase returns, adjustments).
 */
export function sendStockAlertsByOutlet(
    byOutlet: Map<number, StockAlertRow[]>,
    actor: StockAlertActor | undefined,
    source: StockAlertSource,
): void {
    if (!actor) return;
    for (const [outletId, rows] of byOutlet) {
        sendStockAlerts({
            tenantId: actor.tenantId,
            outletId,
            rows,
            triggeringUserId: actor.userId,
            triggeringUsername: actor.username,
            source,
        });
    }
}

/** Append a row to the outlet's bucket. */
export function pushAlertRow(byOutlet: Map<number, StockAlertRow[]>, outletId: number, row: StockAlertRow): void {
    const list = byOutlet.get(outletId);
    if (list) list.push(row);
    else byOutlet.set(outletId, [row]);
}
