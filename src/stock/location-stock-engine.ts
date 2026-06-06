/**
 * Location-agnostic stock engine.
 *
 * A single FIFO receive/consume/clear implementation that operates on EITHER the
 * outlet stock tables (stock_balance / stock_receipt / stock_movement, keyed by
 * outletId) or the warehouse stock tables (warehouse_stock_*, keyed by warehouseId).
 *
 * This is NEW, isolated code — it deliberately does NOT replace the live outlet
 * paths in stock-balance.service.ts / sales.service.ts (those stay untouched per
 * the 2026-06-06 "faithful adaptation" decision). It is used by the warehouse stock
 * service and by Stock Transfer / drain, so those features never duplicate FIFO logic.
 *
 * Mechanism mirrors the live outlet stock model: FIFO is tracked on
 * receipt.quantity (mutated on consume, soft-deleted at 0). Movement rows mirror
 * StockMovement (previous + delta + movementType).
 *
 * Schema note: outlet stock_receipt has no REMARK column; warehouse_stock_receipt
 * does. `supportsReceiptRemark` gates that single field.
 */
import { Decimal } from "decimal.js";
import { RequestValidateError } from "../api-helpers/error";

type Tx = any; // Prisma interactive-transaction client (tenant)

export interface LocationRef {
    receipt: any; // tx.stockReceipt | tx.warehouseStockReceipt
    balance: any; // tx.stockBalance | tx.warehouseStockBalance
    movement: any; // tx.stockMovement | tx.warehouseStockMovement
    warehouseDelegate: any; // tx.outlet | tx.warehouse — for existence checks
    locationField: "outletId" | "warehouseId";
    locationId: number;
    supportsReceiptRemark: boolean;
    label: string; // human-readable for error messages
}

export interface FifoLayer {
    quantity: Decimal;
    cost: Decimal;
    receiptDate?: Date;
}

export interface ConsumeResult {
    layers: { quantityUsed: Decimal; cost: Decimal; receiptDate: Date }[];
    totalCost: Decimal;
}

export function outletRef(tx: Tx, outletId: number): LocationRef {
    return {
        receipt: tx.stockReceipt,
        balance: tx.stockBalance,
        movement: tx.stockMovement,
        warehouseDelegate: tx.outlet,
        locationField: "outletId",
        locationId: outletId,
        supportsReceiptRemark: false,
        label: `outlet ${outletId}`,
    };
}

export function warehouseRef(tx: Tx, warehouseId: number): LocationRef {
    return {
        receipt: tx.warehouseStockReceipt,
        balance: tx.warehouseStockBalance,
        movement: tx.warehouseStockMovement,
        warehouseDelegate: tx.warehouse,
        locationField: "warehouseId",
        locationId: warehouseId,
        supportsReceiptRemark: true,
        label: `warehouse ${warehouseId}`,
    };
}

/** Touch the parent (null-variant) balance row so variant changes sync. */
async function touchParentBalance(ref: LocationRef, itemId: number) {
    await ref.balance.updateMany({
        where: { [ref.locationField]: ref.locationId, itemId, itemVariantId: null, deleted: false },
        data: { updatedAt: new Date() },
    });
}

/**
 * Receive one or more FIFO layers into a location: create receipt rows (preserving
 * each layer's cost + receiptDate), upsert the balance (+total), write a single
 * movement for the aggregate delta.
 */
export async function receiveLayers(
    ref: LocationRef,
    p: {
        itemId: number;
        itemVariantId: number | null;
        layers: FifoLayer[];
        movementType: string;
        documentId?: number;
        reason: string;
        remark?: string;
        performedBy?: string | null;
    }
): Promise<Decimal> {
    const now = new Date();
    const total = p.layers.reduce((s, l) => s.add(l.quantity), new Decimal(0));
    if (total.lessThanOrEqualTo(0)) return new Decimal(0);

    const where = {
        [ref.locationField]: ref.locationId,
        itemId: p.itemId,
        itemVariantId: p.itemVariantId,
        deleted: false,
    };
    const balance = await ref.balance.findFirst({
        where,
        select: { id: true, availableQuantity: true, onHandQuantity: true },
    });
    const prevAvail = balance ? new Decimal(balance.availableQuantity) : new Decimal(0);
    const prevOnHand = balance ? new Decimal(balance.onHandQuantity) : new Decimal(0);

    for (const layer of p.layers) {
        const receiptData: any = {
            itemId: p.itemId,
            [ref.locationField]: ref.locationId,
            itemVariantId: p.itemVariantId,
            quantity: layer.quantity,
            cost: layer.cost,
            receiptDate: layer.receiptDate ?? now,
            deleted: false,
            version: 1,
        };
        if (ref.supportsReceiptRemark) receiptData.remark = p.remark ?? "";
        await ref.receipt.create({ data: receiptData });
    }

    if (balance) {
        await ref.balance.update({
            where: { id: balance.id },
            data: {
                availableQuantity: prevAvail.add(total),
                onHandQuantity: prevOnHand.add(total),
                version: { increment: 1 },
                updatedAt: now,
                lastRestockDate: now,
            },
        });
    } else {
        await ref.balance.create({
            data: {
                itemId: p.itemId,
                [ref.locationField]: ref.locationId,
                itemVariantId: p.itemVariantId,
                availableQuantity: total,
                onHandQuantity: total,
                deleted: false,
                version: 1,
                lastRestockDate: now,
            },
        });
    }

    await ref.movement.create({
        data: {
            itemId: p.itemId,
            [ref.locationField]: ref.locationId,
            itemVariantId: p.itemVariantId,
            previousAvailableQuantity: prevAvail,
            previousOnHandQuantity: prevOnHand,
            availableQuantityDelta: total,
            onHandQuantityDelta: total,
            movementType: p.movementType,
            documentId: p.documentId ?? 0,
            reason: p.reason,
            remark: p.remark ?? "",
            deleted: false,
            performedBy: p.performedBy ?? null,
        },
    });

    if (p.itemVariantId !== null) await touchParentBalance(ref, p.itemId);
    return total;
}

/**
 * Consume `quantity` from a location FIFO (oldest receiptDate first), mutating
 * receipt.quantity and soft-deleting depleted receipts. Decrements the balance and
 * writes one movement. Returns FIFO cost layers (for COGS / transfer preservation).
 */
export async function consumeFIFO(
    ref: LocationRef,
    p: {
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
    const where = {
        [ref.locationField]: ref.locationId,
        itemId: p.itemId,
        itemVariantId: p.itemVariantId,
        deleted: false,
    };

    const balance = await ref.balance.findFirst({
        where,
        select: { id: true, availableQuantity: true, onHandQuantity: true },
    });
    if (!balance) {
        throw new RequestValidateError(`No stock for item ${p.itemId} in ${ref.label}`);
    }
    const prevAvail = new Decimal(balance.availableQuantity);
    const prevOnHand = new Decimal(balance.onHandQuantity);
    if (prevAvail.lessThan(p.quantity)) {
        throw new RequestValidateError(
            `Insufficient stock for item ${p.itemId} in ${ref.label}. Available ${prevAvail}, required ${p.quantity}`
        );
    }

    const receipts = await ref.receipt.findMany({
        where: { ...where, quantity: { gt: 0 } },
        orderBy: { receiptDate: "asc" },
        select: { id: true, quantity: true, cost: true, receiptDate: true },
    });

    const layers: { quantityUsed: Decimal; cost: Decimal; receiptDate: Date }[] = [];
    let totalCost = new Decimal(0);
    let remaining = p.quantity;

    for (const r of receipts) {
        if (remaining.lessThanOrEqualTo(0)) break;
        const avail = new Decimal(r.quantity);
        const used = Decimal.min(avail, remaining);
        const cost = new Decimal(r.cost);
        layers.push({ quantityUsed: used, cost, receiptDate: r.receiptDate });
        totalCost = totalCost.add(cost.times(used));
        remaining = remaining.sub(used);
        const newQty = avail.sub(used);
        await ref.receipt.update({
            where: { id: r.id },
            data: {
                quantity: newQty,
                version: { increment: 1 },
                updatedAt: now,
                ...(newQty.equals(0) ? { deleted: true, deletedAt: now } : {}),
            },
        });
    }

    if (remaining.greaterThan(0)) {
        totalCost = totalCost.add(p.fallbackCost.times(remaining));
        layers.push({ quantityUsed: remaining, cost: p.fallbackCost, receiptDate: now });
        remaining = new Decimal(0);
    }

    await ref.balance.update({
        where: { id: balance.id },
        data: {
            availableQuantity: prevAvail.sub(p.quantity),
            onHandQuantity: prevOnHand.sub(p.quantity),
            version: { increment: 1 },
            updatedAt: now,
        },
    });

    await ref.movement.create({
        data: {
            itemId: p.itemId,
            [ref.locationField]: ref.locationId,
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

    if (p.itemVariantId !== null) await touchParentBalance(ref, p.itemId);
    return { layers, totalCost };
}

/** Clear a single balance to zero (soft-delete its receipts), writing one movement. */
export async function clearLocation(
    ref: LocationRef,
    p: {
        itemId: number;
        itemVariantId: number | null;
        movementType: string;
        reason: string;
        remark?: string;
        performedBy?: string | null;
    }
): Promise<void> {
    const now = new Date();
    const where = {
        [ref.locationField]: ref.locationId,
        itemId: p.itemId,
        itemVariantId: p.itemVariantId,
        deleted: false,
    };
    const balance = await ref.balance.findFirst({
        where,
        select: { id: true, availableQuantity: true, onHandQuantity: true },
    });
    if (!balance) return;

    const prevAvail = new Decimal(balance.availableQuantity);
    const prevOnHand = new Decimal(balance.onHandQuantity);

    await ref.receipt.updateMany({
        where: { ...where, quantity: { gt: 0 } },
        data: { deleted: true, deletedAt: now, updatedAt: now },
    });
    await ref.balance.update({
        where: { id: balance.id },
        data: {
            availableQuantity: new Decimal(0),
            onHandQuantity: new Decimal(0),
            version: { increment: 1 },
            updatedAt: now,
        },
    });
    await ref.movement.create({
        data: {
            itemId: p.itemId,
            [ref.locationField]: ref.locationId,
            itemVariantId: p.itemVariantId,
            previousAvailableQuantity: prevAvail,
            previousOnHandQuantity: prevOnHand,
            availableQuantityDelta: prevAvail.negated(),
            onHandQuantityDelta: prevOnHand.negated(),
            movementType: p.movementType,
            documentId: 0,
            reason: p.reason,
            remark: p.remark ?? "Stock cleared to zero",
            deleted: false,
            performedBy: p.performedBy ?? null,
        },
    });

    if (p.itemVariantId !== null) await touchParentBalance(ref, p.itemId);
}
