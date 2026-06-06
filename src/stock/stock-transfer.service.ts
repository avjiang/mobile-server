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
 * FIFO cost + receiptDate preserved; paired Transfer Out/In movements. Reuses the
 * exact same engine as a normal transfer, so warehouse and outlet stock can never
 * diverge. Per-balance loop (downgrade is rare; volume is bounded by the tenant's
 * catalogue) — a set-based raw-SQL variant is documented in the completion plan as a
 * future optimization if profiling ever warrants it.
 *
 * The CALLER must ensure a target outlet exists before invoking (refuse the
 * downgrade otherwise — never strand stock).
 */
async function drainAllWarehousesToOutlet(
    tx: Tx,
    targetOutletId: number,
    performedBy?: string | null
): Promise<{ itemsDrained: number; totalQuantity: string; totalValue: string }> {
    const balances = await tx.warehouseStockBalance.findMany({
        where: { deleted: false, availableQuantity: { gt: 0 } },
        select: { warehouseId: true, itemId: true, itemVariantId: true, availableQuantity: true },
    });

    const dst = outletRef(tx, targetOutletId);
    let itemsDrained = 0;
    let totalQuantity = new Decimal(0);
    let totalValue = new Decimal(0);

    for (const b of balances) {
        const qty = new Decimal(b.availableQuantity);
        if (qty.lessThanOrEqualTo(0)) continue;

        const item = await tx.item.findUnique({
            where: { id: b.itemId },
            select: { cost: true },
        });
        const src = warehouseRef(tx, b.warehouseId);

        const result = await consumeFIFO(src, {
            itemId: b.itemId,
            itemVariantId: b.itemVariantId,
            quantity: qty,
            fallbackCost: new Decimal(item?.cost || 0),
            movementType: "Transfer Out",
            reason: "Auto-drain on plan downgrade",
            performedBy: performedBy ?? "SYSTEM",
        });

        await receiveLayers(dst, {
            itemId: b.itemId,
            itemVariantId: b.itemVariantId,
            layers: result.layers.map((l) => ({
                quantity: l.quantityUsed,
                cost: l.cost,
                receiptDate: l.receiptDate,
            })),
            movementType: "Transfer In",
            reason: "Auto-drain on plan downgrade",
            performedBy: performedBy ?? "SYSTEM",
        });

        itemsDrained++;
        totalQuantity = totalQuantity.add(qty);
        totalValue = totalValue.add(result.totalCost);
    }

    return {
        itemsDrained,
        totalQuantity: totalQuantity.toString(),
        totalValue: totalValue.toString(),
    };
}

export { transferStock, drainAllWarehousesToOutlet };
