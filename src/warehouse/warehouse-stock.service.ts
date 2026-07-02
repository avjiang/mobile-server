/**
 * Warehouse stock service.
 *
 * Thin orchestration over the location-agnostic engine (src/stock/location-stock-engine.ts)
 * bound to the warehouse_* tables. The engine faithfully mirrors the live outlet stock
 * mechanism (FIFO on receipt.quantity, StockMovement-style audit). The live outlet
 * paths are deliberately left untouched (2026-06-06 "faithful adaptation" decision).
 *
 * One intentional difference from outlet stock: warehouse balances are created on
 * first receipt (the engine upserts), because items are not pre-seeded with a
 * warehouse balance row at item-creation time.
 */
import { Decimal } from "decimal.js";
import { PrismaClient } from "../../prisma/client/generated/client";
import { NotFoundError, RequestValidateError } from "../api-helpers/error";
import { getTenantPrisma } from "../db";
import {
    warehouseRef,
    receiveLayers,
    consumeFIFO,
    clearLocation,
} from "../stock/location-stock-engine";
import {
    WarehouseStockAdjustment,
    WarehouseStockClearance,
    WarehouseStockReceiveBody,
} from "./warehouse-stock.request";

const MAX_QTY = 999999;
const MAX_COST = 999999999;

const MOVEMENT_RECEIPT = "Stock Receipt";
const MOVEMENT_ADJUSTMENT = "Stock Adjustment";
const MOVEMENT_CLEARANCE = "Stock Clearance";

type Tx = any;

/**
 * Validate variant rules for a batch of (itemId, itemVariantId) targets and
 * return a map of itemId -> { hasVariants, itemName, cost }.
 */
async function validateItemsAndVariants(
    tx: Tx,
    targets: { itemId: number; itemVariantId?: number | null }[]
): Promise<Map<number, { hasVariants: boolean; itemName: string; cost: Decimal }>> {
    const itemIds = [...new Set(targets.map((t) => t.itemId))];
    const items = await tx.item.findMany({
        where: { id: { in: itemIds }, deleted: false },
        select: { id: true, hasVariants: true, itemName: true, cost: true },
    });
    const itemMap = new Map<number, { hasVariants: boolean; itemName: string; cost: Decimal }>(
        items.map((i: any) => [
            i.id,
            { hasVariants: i.hasVariants, itemName: i.itemName, cost: new Decimal(i.cost || 0) },
        ])
    );

    for (const t of targets) {
        const item = itemMap.get(t.itemId);
        if (!item) throw new NotFoundError(`Item with ID ${t.itemId} not found`);
        if (item.hasVariants && (t.itemVariantId === null || t.itemVariantId === undefined)) {
            throw new RequestValidateError(
                `Item "${item.itemName}" has variants. You must specify itemVariantId.`
            );
        }
        if (!item.hasVariants && t.itemVariantId) {
            throw new RequestValidateError(
                `Item "${item.itemName}" does not have variants. Remove itemVariantId from request.`
            );
        }
    }
    return itemMap;
}

/** Ensure a warehouse exists and is active. */
async function requireActiveWarehouse(tx: Tx, warehouseId: number) {
    const warehouse = await tx.warehouse.findFirst({
        where: { id: warehouseId, deleted: false },
        select: { id: true },
    });
    if (!warehouse) throw new NotFoundError(`Warehouse ${warehouseId} not found`);
    return warehouse;
}

/**
 * Receive stock into a warehouse (self-service for Pro tenants).
 */
async function receiveWarehouseStock(databaseName: string, body: WarehouseStockReceiveBody) {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);

    if (!body.items || body.items.length === 0) {
        throw new RequestValidateError("At least one item is required");
    }
    for (const it of body.items) {
        if (it.quantity === undefined || it.quantity <= 0) {
            throw new RequestValidateError(`Quantity must be greater than 0 for item ${it.itemId}`);
        }
        if (it.quantity > MAX_QTY) {
            throw new RequestValidateError(`Quantity exceeds maximum (${MAX_QTY}) for item ${it.itemId}`);
        }
        if (it.cost !== undefined && (it.cost < 0 || it.cost > MAX_COST)) {
            throw new RequestValidateError(`Cost out of range for item ${it.itemId}`);
        }
    }

    let received = 0;
    await tenantPrisma.$transaction(async (tx) => {
        await requireActiveWarehouse(tx, body.warehouseId);
        const itemMap = await validateItemsAndVariants(tx, body.items);
        const ref = warehouseRef(tx, body.warehouseId);

        for (const it of body.items) {
            const item = itemMap.get(it.itemId)!;
            const cost = it.cost !== undefined ? new Decimal(it.cost) : item.cost;
            await receiveLayers(ref, {
                itemId: it.itemId,
                itemVariantId: it.itemVariantId ?? null,
                layers: [{ quantity: new Decimal(it.quantity), cost }],
                movementType: MOVEMENT_RECEIPT,
                reason: body.reason || "Warehouse stock receipt",
                remark: it.remark,
                performedBy: body.performedBy ?? null,
            });
            received++;
        }
    });

    return { warehouseId: body.warehouseId, received };
}

/**
 * Adjust warehouse stock: positive `adjustQuantity` adds a layer; negative consumes
 * FIFO; `overrideQuantity` sets an absolute level (clear + re-receive).
 */
async function adjustWarehouseStock(databaseName: string, adjustments: WarehouseStockAdjustment[]) {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);

    if (!adjustments || adjustments.length === 0) {
        throw new RequestValidateError("At least one adjustment is required");
    }
    for (const a of adjustments) {
        const hasAdjust = a.adjustQuantity !== undefined;
        const hasOverride = a.overrideQuantity !== undefined;
        if (hasAdjust && hasOverride) {
            throw new RequestValidateError("Provide either adjustQuantity or overrideQuantity, not both");
        }
        if (!hasAdjust && !hasOverride) {
            throw new RequestValidateError("Either adjustQuantity or overrideQuantity must be provided");
        }
        if (hasOverride && a.overrideQuantity! < 0) {
            throw new RequestValidateError("Override quantity cannot be negative");
        }
        const mag = Math.abs(a.adjustQuantity ?? a.overrideQuantity ?? 0);
        if (mag > MAX_QTY) throw new RequestValidateError(`Quantity exceeds maximum (${MAX_QTY})`);
        if (a.cost !== undefined && (a.cost < 0 || a.cost > MAX_COST)) {
            throw new RequestValidateError("Cost out of range");
        }
    }

    let adjusted = 0;
    await tenantPrisma.$transaction(async (tx) => {
        await requireActiveWarehouse(tx, adjustments[0].warehouseId);
        const itemMap = await validateItemsAndVariants(tx, adjustments);
        const ref = warehouseRef(tx, adjustments[0].warehouseId);

        for (const a of adjustments) {
            const variantId = a.itemVariantId ?? null;
            const item = itemMap.get(a.itemId)!;
            const cost = a.cost !== undefined ? new Decimal(a.cost) : item.cost;

            if (a.overrideQuantity !== undefined) {
                await clearLocation(ref, {
                    itemId: a.itemId,
                    itemVariantId: variantId,
                    movementType: MOVEMENT_ADJUSTMENT,
                    reason: a.reason || "Stock override",
                    remark: a.remark,
                    performedBy: a.performedBy ?? null,
                });
                const target = new Decimal(a.overrideQuantity);
                if (target.greaterThan(0)) {
                    await receiveLayers(ref, {
                        itemId: a.itemId,
                        itemVariantId: variantId,
                        layers: [{ quantity: target, cost }],
                        movementType: MOVEMENT_ADJUSTMENT,
                        reason: a.reason || "Stock override",
                        remark: a.remark,
                        performedBy: a.performedBy ?? null,
                    });
                }
            } else {
                const delta = new Decimal(a.adjustQuantity || 0);
                if (delta.greaterThan(0)) {
                    await receiveLayers(ref, {
                        itemId: a.itemId,
                        itemVariantId: variantId,
                        layers: [{ quantity: delta, cost }],
                        movementType: MOVEMENT_ADJUSTMENT,
                        reason: a.reason || "Stock adjustment",
                        remark: a.remark,
                        performedBy: a.performedBy ?? null,
                    });
                } else if (delta.lessThan(0)) {
                    await consumeFIFO(ref, {
                        itemId: a.itemId,
                        itemVariantId: variantId,
                        quantity: delta.abs(),
                        fallbackCost: cost,
                        movementType: MOVEMENT_ADJUSTMENT,
                        reason: a.reason || "Stock adjustment",
                        remark: a.remark,
                        performedBy: a.performedBy ?? null,
                    });
                }
            }
            adjusted++;
        }
    });

    return { adjusted };
}

/** Clear a single warehouse balance to zero. */
async function clearWarehouseStock(databaseName: string, clearance: WarehouseStockClearance) {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    await tenantPrisma.$transaction(async (tx) => {
        await requireActiveWarehouse(tx, clearance.warehouseId);
        await validateItemsAndVariants(tx, [clearance]);
        const ref = warehouseRef(tx, clearance.warehouseId);
        await clearLocation(ref, {
            itemId: clearance.itemId,
            itemVariantId: clearance.itemVariantId ?? null,
            movementType: MOVEMENT_CLEARANCE,
            reason: clearance.reason || "Stock clearance",
            remark: clearance.remark,
            performedBy: clearance.performedBy ?? null,
        });
    });
    return { cleared: 1 };
}

export {
    receiveWarehouseStock,
    adjustWarehouseStock,
    clearWarehouseStock,
    validateItemsAndVariants,
    requireActiveWarehouse,
};
