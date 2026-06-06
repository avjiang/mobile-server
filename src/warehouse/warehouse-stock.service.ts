/**
 * Warehouse stock service.
 *
 * Faithful adaptation of the live outlet stock mechanism (see
 * src/stock/stock-balance/stock-balance.service.ts and the FIFO consume in
 * src/sales/sales.service.ts) applied to the warehouse_* tables.
 *
 * Design parity with outlet stock (decision 2026-06-06):
 *  - FIFO is tracked on WarehouseStockReceipt.quantity (mutated on consume,
 *    soft-deleted at 0) — identical to StockReceipt. There is NO availableQuantity
 *    column (it was dropped to match stock_receipt).
 *  - Movement audit mirrors StockMovement (previous + delta + movementType).
 *  - Variant rules mirror outlet: items with variants require itemVariantId.
 *
 * The one intentional difference: warehouse balances are created on first receipt
 * (upsert), because — unlike outlets — items are not pre-seeded with a warehouse
 * balance row at item-creation time.
 */
import { Decimal } from "decimal.js";
import { PrismaClient } from "../../prisma/client/generated/client";
import { NotFoundError, RequestValidateError } from "../api-helpers/error";
import { getTenantPrisma } from "../db";
import {
    WarehouseStockAdjustment,
    WarehouseStockClearance,
    WarehouseStockReceiveBody,
} from "./warehouse-stock.request";

const MAX_QTY = 999999;
const MAX_COST = 999999999;

// Movement type constants — reuse the same vocabulary as outlet stock movements.
const MOVEMENT_RECEIPT = "Stock Receipt";
const MOVEMENT_ADJUSTMENT = "Stock Adjustment";
const MOVEMENT_CLEARANCE = "Stock Clearance";

type Tx = any; // Prisma interactive-transaction client (tenant)

interface ConsumeResult {
    layers: { receiptId: number; quantityUsed: Decimal; cost: Decimal }[];
    totalCost: Decimal;
}

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

/** Ensure a warehouse exists and is active, returning it. */
async function requireActiveWarehouse(tx: Tx, warehouseId: number) {
    const warehouse = await tx.warehouse.findFirst({
        where: { id: warehouseId, deleted: false },
        select: { id: true },
    });
    if (!warehouse) throw new NotFoundError(`Warehouse ${warehouseId} not found`);
    return warehouse;
}

/** Touch the parent (null-variant) balance row so variant changes sync. */
async function touchParentBalance(tx: Tx, warehouseId: number, itemId: number) {
    await tx.warehouseStockBalance.updateMany({
        where: { warehouseId, itemId, itemVariantId: null, deleted: false },
        data: { updatedAt: new Date() },
    });
}

/**
 * Apply a single inbound stock layer to a warehouse: create a receipt, upsert the
 * balance (+qty), and write a movement. Shared by receive + transfer-in + reactivation.
 */
async function applyReceiptLayer(
    tx: Tx,
    p: {
        warehouseId: number;
        itemId: number;
        itemVariantId: number | null;
        quantity: Decimal;
        cost: Decimal;
        receiptDate?: Date;
        movementType: string;
        documentId?: number;
        reason: string;
        remark?: string;
        performedBy?: string | null;
    }
): Promise<void> {
    const now = new Date();
    const balance = await tx.warehouseStockBalance.findFirst({
        where: {
            warehouseId: p.warehouseId,
            itemId: p.itemId,
            itemVariantId: p.itemVariantId,
            deleted: false,
        },
        select: { id: true, availableQuantity: true, onHandQuantity: true },
    });

    const prevAvail = balance ? new Decimal(balance.availableQuantity) : new Decimal(0);
    const prevOnHand = balance ? new Decimal(balance.onHandQuantity) : new Decimal(0);

    await tx.warehouseStockReceipt.create({
        data: {
            itemId: p.itemId,
            warehouseId: p.warehouseId,
            itemVariantId: p.itemVariantId,
            quantity: p.quantity,
            cost: p.cost,
            receiptDate: p.receiptDate ?? now,
            remark: p.remark ?? "",
            deleted: false,
            version: 1,
        },
    });

    if (balance) {
        await tx.warehouseStockBalance.update({
            where: { id: balance.id },
            data: {
                availableQuantity: prevAvail.add(p.quantity),
                onHandQuantity: prevOnHand.add(p.quantity),
                version: { increment: 1 },
                updatedAt: now,
                lastRestockDate: now,
            },
        });
    } else {
        await tx.warehouseStockBalance.create({
            data: {
                itemId: p.itemId,
                warehouseId: p.warehouseId,
                itemVariantId: p.itemVariantId,
                availableQuantity: p.quantity,
                onHandQuantity: p.quantity,
                deleted: false,
                version: 1,
                lastRestockDate: now,
            },
        });
    }

    await tx.warehouseStockMovement.create({
        data: {
            itemId: p.itemId,
            warehouseId: p.warehouseId,
            itemVariantId: p.itemVariantId,
            previousAvailableQuantity: prevAvail,
            previousOnHandQuantity: prevOnHand,
            availableQuantityDelta: p.quantity,
            onHandQuantityDelta: p.quantity,
            movementType: p.movementType,
            documentId: p.documentId ?? 0,
            reason: p.reason,
            remark: p.remark ?? "",
            deleted: false,
            performedBy: p.performedBy ?? null,
        },
    });

    if (p.itemVariantId !== null) {
        await touchParentBalance(tx, p.warehouseId, p.itemId);
    }
}

/**
 * Consume `quantity` from a warehouse location FIFO (oldest receiptDate first),
 * mutating receipt.quantity and soft-deleting depleted receipts. Decrements the
 * balance and writes a movement. Returns the FIFO cost layers (for COGS).
 *
 * Mirrors the outlet FIFO consume in sales.service.ts. Throws if insufficient.
 */
async function consumeFIFO(
    tx: Tx,
    p: {
        warehouseId: number;
        itemId: number;
        itemVariantId: number | null;
        quantity: Decimal;
        fallbackCost: Decimal;
        movementType: string;
        documentId?: number;
        reason: string;
        remark?: string;
        performedBy?: string | null;
    }
): Promise<ConsumeResult> {
    const now = new Date();

    const balance = await tx.warehouseStockBalance.findFirst({
        where: {
            warehouseId: p.warehouseId,
            itemId: p.itemId,
            itemVariantId: p.itemVariantId,
            deleted: false,
        },
        select: { id: true, availableQuantity: true, onHandQuantity: true },
    });
    if (!balance) {
        throw new RequestValidateError(
            `No warehouse stock for item ${p.itemId} in warehouse ${p.warehouseId}`
        );
    }

    const prevAvail = new Decimal(balance.availableQuantity);
    const prevOnHand = new Decimal(balance.onHandQuantity);
    if (prevAvail.lessThan(p.quantity)) {
        throw new RequestValidateError(
            `Insufficient warehouse stock for item ${p.itemId}. Available ${prevAvail}, required ${p.quantity}`
        );
    }

    const receipts = await tx.warehouseStockReceipt.findMany({
        where: {
            warehouseId: p.warehouseId,
            itemId: p.itemId,
            itemVariantId: p.itemVariantId,
            quantity: { gt: 0 },
            deleted: false,
        },
        orderBy: { receiptDate: "asc" },
        select: { id: true, quantity: true, cost: true },
    });

    const layers: { receiptId: number; quantityUsed: Decimal; cost: Decimal }[] = [];
    let totalCost = new Decimal(0);
    let remaining = p.quantity;

    for (const receipt of receipts) {
        if (remaining.lessThanOrEqualTo(0)) break;
        const avail = new Decimal(receipt.quantity);
        const used = Decimal.min(avail, remaining);
        const cost = new Decimal(receipt.cost);
        layers.push({ receiptId: receipt.id, quantityUsed: used, cost });
        totalCost = totalCost.add(cost.times(used));
        remaining = remaining.sub(used);

        const newQty = avail.sub(used);
        await tx.warehouseStockReceipt.update({
            where: { id: receipt.id },
            data: {
                quantity: newQty,
                version: { increment: 1 },
                updatedAt: now,
                ...(newQty.equals(0) ? { deleted: true, deletedAt: now } : {}),
            },
        });
    }

    // Cover any FIFO shortfall (receipts under-cover balance) with fallback cost.
    if (remaining.greaterThan(0)) {
        totalCost = totalCost.add(p.fallbackCost.times(remaining));
        layers.push({ receiptId: 0, quantityUsed: remaining, cost: p.fallbackCost });
        remaining = new Decimal(0);
    }

    await tx.warehouseStockBalance.update({
        where: { id: balance.id },
        data: {
            availableQuantity: prevAvail.sub(p.quantity),
            onHandQuantity: prevOnHand.sub(p.quantity),
            version: { increment: 1 },
            updatedAt: now,
        },
    });

    await tx.warehouseStockMovement.create({
        data: {
            itemId: p.itemId,
            warehouseId: p.warehouseId,
            itemVariantId: p.itemVariantId,
            previousAvailableQuantity: prevAvail,
            previousOnHandQuantity: prevOnHand,
            availableQuantityDelta: p.quantity.negated(),
            onHandQuantityDelta: p.quantity.negated(),
            movementType: p.movementType,
            documentId: p.documentId ?? 0,
            reason: p.reason,
            remark: p.remark ?? "",
            deleted: false,
            performedBy: p.performedBy ?? null,
        },
    });

    if (p.itemVariantId !== null) {
        await touchParentBalance(tx, p.warehouseId, p.itemId);
    }

    return { layers, totalCost };
}

/**
 * Receive stock into a warehouse (self-service for Pro tenants).
 * Creates FIFO receipt layers, upserts balances, writes movements.
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

        for (const it of body.items) {
            const item = itemMap.get(it.itemId)!;
            const cost = it.cost !== undefined ? new Decimal(it.cost) : item.cost;
            await applyReceiptLayer(tx, {
                warehouseId: body.warehouseId,
                itemId: it.itemId,
                itemVariantId: it.itemVariantId ?? null,
                quantity: new Decimal(it.quantity),
                cost,
                movementType: MOVEMENT_RECEIPT,
                documentId: 0,
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
 * Adjust warehouse stock: positive `adjustQuantity` adds a receipt layer; negative
 * consumes FIFO; `overrideQuantity` sets an absolute level (clears + re-receives).
 * Mirrors outlet stockAdjustment semantics.
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

        for (const a of adjustments) {
            const variantId = a.itemVariantId ?? null;
            const item = itemMap.get(a.itemId)!;
            const cost = a.cost !== undefined ? new Decimal(a.cost) : item.cost;

            if (a.overrideQuantity !== undefined) {
                // Clear to zero, then receive the target quantity (if > 0).
                await clearWarehouseStockInTx(tx, {
                    warehouseId: a.warehouseId,
                    itemId: a.itemId,
                    itemVariantId: variantId,
                    reason: a.reason || "Stock override",
                    remark: a.remark,
                    performedBy: a.performedBy ?? null,
                });
                const target = new Decimal(a.overrideQuantity);
                if (target.greaterThan(0)) {
                    await applyReceiptLayer(tx, {
                        warehouseId: a.warehouseId,
                        itemId: a.itemId,
                        itemVariantId: variantId,
                        quantity: target,
                        cost,
                        movementType: MOVEMENT_ADJUSTMENT,
                        reason: a.reason || "Stock override",
                        remark: a.remark,
                        performedBy: a.performedBy ?? null,
                    });
                }
            } else {
                const delta = new Decimal(a.adjustQuantity || 0);
                if (delta.greaterThan(0)) {
                    await applyReceiptLayer(tx, {
                        warehouseId: a.warehouseId,
                        itemId: a.itemId,
                        itemVariantId: variantId,
                        quantity: delta,
                        cost,
                        movementType: MOVEMENT_ADJUSTMENT,
                        reason: a.reason || "Stock adjustment",
                        remark: a.remark,
                        performedBy: a.performedBy ?? null,
                    });
                } else if (delta.lessThan(0)) {
                    await consumeFIFO(tx, {
                        warehouseId: a.warehouseId,
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

/** Internal: clear a single warehouse balance to zero within an existing tx. */
async function clearWarehouseStockInTx(
    tx: Tx,
    p: {
        warehouseId: number;
        itemId: number;
        itemVariantId: number | null;
        reason: string;
        remark?: string;
        performedBy?: string | null;
    }
): Promise<void> {
    const now = new Date();
    const balance = await tx.warehouseStockBalance.findFirst({
        where: {
            warehouseId: p.warehouseId,
            itemId: p.itemId,
            itemVariantId: p.itemVariantId,
            deleted: false,
        },
        select: { id: true, availableQuantity: true, onHandQuantity: true },
    });
    if (!balance) return; // nothing to clear

    const prevAvail = new Decimal(balance.availableQuantity);
    const prevOnHand = new Decimal(balance.onHandQuantity);

    await tx.warehouseStockReceipt.updateMany({
        where: {
            warehouseId: p.warehouseId,
            itemId: p.itemId,
            itemVariantId: p.itemVariantId,
            quantity: { gt: 0 },
            deleted: false,
        },
        data: { deleted: true, deletedAt: now, updatedAt: now },
    });

    await tx.warehouseStockBalance.update({
        where: { id: balance.id },
        data: {
            availableQuantity: new Decimal(0),
            onHandQuantity: new Decimal(0),
            version: { increment: 1 },
            updatedAt: now,
        },
    });

    await tx.warehouseStockMovement.create({
        data: {
            itemId: p.itemId,
            warehouseId: p.warehouseId,
            itemVariantId: p.itemVariantId,
            previousAvailableQuantity: prevAvail,
            previousOnHandQuantity: prevOnHand,
            availableQuantityDelta: prevAvail.negated(),
            onHandQuantityDelta: prevOnHand.negated(),
            movementType: MOVEMENT_CLEARANCE,
            documentId: 0,
            reason: p.reason,
            remark: p.remark ?? "Stock cleared to zero",
            deleted: false,
            performedBy: p.performedBy ?? null,
        },
    });

    if (p.itemVariantId !== null) {
        await touchParentBalance(tx, p.warehouseId, p.itemId);
    }
}

/** Clear a single warehouse balance to zero (public). */
async function clearWarehouseStock(databaseName: string, clearance: WarehouseStockClearance) {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    await tenantPrisma.$transaction(async (tx) => {
        await requireActiveWarehouse(tx, clearance.warehouseId);
        await validateItemsAndVariants(tx, [clearance]);
        await clearWarehouseStockInTx(tx, {
            warehouseId: clearance.warehouseId,
            itemId: clearance.itemId,
            itemVariantId: clearance.itemVariantId ?? null,
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
    // primitives reused by transfer (G2), sales (G3) and drain (2b):
    applyReceiptLayer,
    consumeFIFO,
    clearWarehouseStockInTx,
    requireActiveWarehouse,
    validateItemsAndVariants,
};
