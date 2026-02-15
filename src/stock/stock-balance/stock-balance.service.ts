import { Prisma, PrismaClient, StockBalance, StockMovement } from "../../../prisma/client/generated/client"
import { Decimal } from 'decimal.js';
import { NotFoundError, VersionMismatchDetail, VersionMismatchError } from "../../api-helpers/error"
import { StockAdjustment, StockAdjustmentRequestBody } from "./stock-balance.request"
import { getTenantPrisma } from '../../db';
import { } from '../../db';
import { SyncRequest } from "src/item/item.request";

class RequestValidateError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RequestValidateError';
    }
}

// stock function
let getAllStock = async (
    databaseName: string,
    syncRequest: SyncRequest
): Promise<{ stockBalances: any[]; total: number; serverTimestamp: string }> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { lastSyncTimestamp, lastVersion, skip = 0, take = 100 } = syncRequest;

    try {
        // Parse last sync timestamp or use a default (e.g., epoch start)
        const lastSync = (lastSyncTimestamp && lastSyncTimestamp !== 'null') ?
            new Date(lastSyncTimestamp) : new Date(0);

        // Build query conditions
        const where = lastVersion
            ? { version: { gt: lastVersion } }
            : {
                OR: [
                    { createdAt: { gte: lastSync } },
                    { updatedAt: { gte: lastSync } },
                    { deletedAt: { gte: lastSync } },
                ],
            };

        // Fetch stocks with variant info for nesting
        const stocks = await tenantPrisma.stockBalance.findMany({
            where,
            include: {
                itemVariant: {
                    select: {
                        id: true,
                        variantSku: true,
                        variantName: true,
                    }
                },
                item: {
                    select: {
                        id: true,
                        hasVariants: true,
                    }
                }
            },
            skip,
            take,
        });

        // Group variant stocks under parent items by itemId-outletId
        const stockMap = new Map<string, any>();

        for (const stock of stocks) {
            const key = `${stock.itemId}-${stock.outletId}`;

            if (stock.itemVariantId === null) {
                // This is a base item stock (no variant)
                if (!stockMap.has(key)) {
                    const { itemVariant, item, ...stockData } = stock;
                    stockMap.set(key, {
                        ...stockData,
                        variants: item?.hasVariants ? [] : null,
                    });
                } else {
                    // Base stock already exists from variant, update it
                    const existing = stockMap.get(key);
                    const { itemVariant, item, ...stockData } = stock;
                    stockMap.set(key, {
                        ...stockData,
                        variants: existing.variants,
                    });
                }
            } else {
                // This is a variant stock
                if (!stockMap.has(key)) {
                    // Create placeholder for parent (will be updated if parent stock exists)
                    stockMap.set(key, {
                        id: null,
                        itemId: stock.itemId,
                        outletId: stock.outletId,
                        availableQuantity: new Decimal(0),
                        onHandQuantity: new Decimal(0),
                        itemVariantId: null,
                        deleted: false,
                        version: 0,
                        variants: [],
                    });
                }

                const parent = stockMap.get(key);
                if (!parent.variants) parent.variants = [];

                // Add variant to parent's variants array
                const { itemVariant, item, ...stockData } = stock;
                parent.variants.push({
                    ...stockData,
                    variantSku: itemVariant?.variantSku,
                    variantName: itemVariant?.variantName,
                });
            }
        }

        // Count total matching records from DB (not just current page)
        const total = await tenantPrisma.stockBalance.count({ where });

        return {
            stockBalances: Array.from(stockMap.values()),
            total,
            serverTimestamp: new Date().toISOString(),
        };
    } catch (error) {
        throw error;
    }
};

let getStockByItemId = async (databaseName: string, itemId: number, itemVariantId?: number | null) => {
    try {
        const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);

        // Build where condition - include itemVariantId if provided
        const whereCondition: any = {
            itemId: itemId,
            deleted: false
        };

        // Only add itemVariantId filter if explicitly provided (including null)
        if (itemVariantId !== undefined) {
            whereCondition.itemVariantId = itemVariantId;
        }

        const stock = await tenantPrisma.stockBalance.findFirst({
            where: whereCondition,
            include: {
                itemVariant: {
                    select: {
                        variantSku: true,
                        variantName: true,
                    }
                }
            }
        });
        if (!stock) {
            const variantInfo = itemVariantId ? ` and variantId ${itemVariantId}` : '';
            throw new NotFoundError(`Stock Balance for itemId ${itemId}${variantInfo}`);
        }
        return stock;
    }
    catch (error) {
        throw error;
    }
}

async function stockAdjustment(databaseName: string, stockAdjustments: StockAdjustment[]): Promise<number> {
    const tenantPrisma = getTenantPrisma(databaseName);
    let adjustedCount = 0;

    try {
        await tenantPrisma.$transaction(async (tx) => {
            const stockMovements: any[] = [];
            const stockUpdates: { id: number; availableQuantity: Decimal; onHandQuantity: Decimal; clientVersion: number; itemId: number; outletId: number; itemVariantId: number | null }[] = [];
            const versionMismatches: VersionMismatchDetail[] = [];

            // Step 1: Validate input first (before any DB queries)
            for (const adjustment of stockAdjustments) {
                if (adjustment.adjustQuantity !== undefined && adjustment.overrideQuantity !== undefined) {
                    throw new RequestValidateError('Provide either adjustQuantity or overrideQuantity, not both');
                }
                if (adjustment.adjustQuantity === undefined && adjustment.overrideQuantity === undefined) {
                    throw new RequestValidateError('Either adjustQuantity or overrideQuantity must be provided');
                }
                if (adjustment.version === undefined || adjustment.version < 0) {
                    throw new RequestValidateError('Valid version number must be provided');
                }
                if (adjustment.overrideQuantity !== undefined && adjustment.overrideQuantity < 0) {
                    throw new RequestValidateError('Override quantity cannot be negative');
                }
            }

            // Step 1.5: Validate variant requirements
            const itemIds = [...new Set(stockAdjustments.map(adj => adj.itemId))];
            const items = await tx.item.findMany({
                where: { id: { in: itemIds }, deleted: false },
                select: { id: true, hasVariants: true, itemName: true }
            });
            const itemMap = new Map(items.map(item => [item.id, item]));

            for (const adjustment of stockAdjustments) {
                const item = itemMap.get(adjustment.itemId);
                if (!item) {
                    throw new NotFoundError(`Item with ID ${adjustment.itemId} not found`);
                }

                // Validate variant rules
                if (item.hasVariants && (adjustment.itemVariantId === null || adjustment.itemVariantId === undefined)) {
                    throw new RequestValidateError(
                        `Item "${item.itemName}" has variants. You must specify itemVariantId to adjust variant stock. ` +
                        `Adjusting main item stock directly is not allowed.`
                    );
                }
                if (!item.hasVariants && adjustment.itemVariantId) {
                    throw new RequestValidateError(
                        `Item "${item.itemName}" does not have variants. Remove itemVariantId from request.`
                    );
                }
            }

            // Step 2: Batch fetch all stock balances in a single query (with variant support)
            const stockBalances = await tx.stockBalance.findMany({
                where: {
                    OR: stockAdjustments.map(adj => ({
                        itemId: adj.itemId,
                        outletId: adj.outletId,
                        itemVariantId: adj.itemVariantId || null,
                    })),
                    deleted: false
                },
                select: { id: true, itemId: true, outletId: true, itemVariantId: true, availableQuantity: true, onHandQuantity: true, version: true }
            });

            // Create a map for quick lookup using composite key (with variant support)
            const stockBalanceMap = new Map(
                stockBalances.map(stock => [`${stock.itemId}-${stock.itemVariantId || 'null'}-${stock.outletId}`, stock])
            );

            // Step 3: Validate all adjustments against fetched stocks
            const validatedAdjustments = stockAdjustments.map(adjustment => {
                const stockKey = `${adjustment.itemId}-${adjustment.itemVariantId || 'null'}-${adjustment.outletId}`;
                const stock = stockBalanceMap.get(stockKey);

                if (!stock) {
                    const variantInfo = adjustment.itemVariantId ? ` and variantId ${adjustment.itemVariantId}` : '';
                    throw new NotFoundError(`Stock not found for itemId ${adjustment.itemId}${variantInfo} and outletId ${adjustment.outletId}`);
                }

                const currentVersion = stock.version || 1;
                if (currentVersion !== adjustment.version) {
                    versionMismatches.push({
                        itemId: adjustment.itemId,
                        expectedVersion: adjustment.version,
                        foundVersion: currentVersion,
                    });
                }

                return { adjustment, stock };
            });

            // Step 4: Throw if version mismatches
            if (versionMismatches.length > 0) {
                throw new VersionMismatchError(`Version mismatches detected for ${versionMismatches.length} item(s)`, versionMismatches);
            }

            // Step 5: Batch fetch all stock receipts that might be affected (with variant support)
            const receiptKeys = validatedAdjustments
                .filter(({ adjustment }) => adjustment.overrideQuantity !== undefined || (adjustment.adjustQuantity && adjustment.adjustQuantity < 0))
                .map(({ adjustment }) => ({
                    itemId: adjustment.itemId,
                    outletId: adjustment.outletId,
                    itemVariantId: adjustment.itemVariantId || null
                }));

            const stockReceipts = receiptKeys.length > 0 ? await tx.stockReceipt.findMany({
                where: {
                    OR: receiptKeys.map(key => ({
                        itemId: key.itemId,
                        outletId: key.outletId,
                        itemVariantId: key.itemVariantId,
                        quantity: { gt: 0 },
                        deleted: false,
                    })),
                },
                orderBy: [{ itemId: 'asc' }, { outletId: 'asc' }, { receiptDate: 'asc' }]
            }) : [];

            // Group receipts by composite key (with variant support)
            const receiptsByKey = stockReceipts.reduce((acc, receipt) => {
                const key = `${receipt.itemId}-${receipt.itemVariantId || 'null'}-${receipt.outletId}`;
                if (!acc[key]) acc[key] = [];
                acc[key].push(receipt);
                return acc;
            }, {} as Record<string, typeof stockReceipts>);

            // Step 6: Process adjustments and prepare bulk operations
            const receiptUpdates: { id: number; quantity: Decimal; deleted?: boolean; deletedAt?: Date }[] = [];
            const receiptCreates: any[] = [];

            for (const { adjustment, stock } of validatedAdjustments) {
                const receiptKey = `${adjustment.itemId}-${adjustment.itemVariantId || 'null'}-${adjustment.outletId}`;
                const receipts = receiptsByKey[receiptKey] || [];

                const previousAvailableQuantity = stock.availableQuantity;
                const previousOnHandQuantity = stock.onHandQuantity;

                let newAvailableQuantity: Decimal;
                let newOnHandQuantity: Decimal;
                let deltaQuantity: Decimal;

                if (adjustment.overrideQuantity !== undefined) {
                    newAvailableQuantity = new Decimal(adjustment.overrideQuantity);
                    newOnHandQuantity = new Decimal(adjustment.overrideQuantity);
                    deltaQuantity = newAvailableQuantity.sub(stock.availableQuantity);
                } else {
                    const adjustValue = new Decimal(adjustment.adjustQuantity || 0);
                    newAvailableQuantity = stock.availableQuantity.add(adjustValue);
                    newOnHandQuantity = stock.onHandQuantity.add(adjustValue);
                    deltaQuantity = adjustValue;
                }

                // Prepare stock movement (with variant support)
                stockMovements.push({
                    itemId: adjustment.itemId,
                    itemVariantId: adjustment.itemVariantId || null,  // Variant support
                    outletId: adjustment.outletId,
                    previousAvailableQuantity,
                    previousOnHandQuantity,
                    availableQuantityDelta: deltaQuantity,
                    onHandQuantityDelta: deltaQuantity,
                    movementType: 'Stock Adjustment',
                    documentId: 0,
                    reason: adjustment.reason || 'Manual stock adjustment',
                    remark: adjustment.remark,
                    deleted: false,
                    createdAt: new Date(),
                    performedBy: adjustment.performedBy ?? null,
                });

                // Prepare stock balance update (with variant info for delta sync)
                stockUpdates.push({
                    id: stock.id,
                    availableQuantity: newAvailableQuantity,
                    onHandQuantity: newOnHandQuantity,
                    clientVersion: adjustment.version,
                    itemId: adjustment.itemId,
                    outletId: adjustment.outletId,
                    itemVariantId: adjustment.itemVariantId || null,
                });

                // Handle StockReceipt adjustments
                if (adjustment.overrideQuantity !== undefined) {
                    // For override operations, we need to replace all existing receipts
                    // Mark all existing receipts as deleted
                    for (const receipt of receipts) {
                        receiptUpdates.push({
                            id: receipt.id,
                            quantity: receipt.quantity, // Keep original quantity for audit
                            deleted: true,
                            deletedAt: new Date(),
                        });
                    }

                    // Create new receipt for the override quantity (if > 0)
                    if (newAvailableQuantity.greaterThan(0)) {
                        receiptCreates.push({
                            itemId: adjustment.itemId,
                            itemVariantId: adjustment.itemVariantId || null,  // Variant support
                            outletId: adjustment.outletId,
                            quantity: newAvailableQuantity,
                            cost: new Decimal(adjustment.cost || 0),
                            receiptDate: new Date(),
                            createdAt: new Date(),
                            deleted: false,
                            version: 1,
                        });
                    }
                } else if (deltaQuantity.lessThan(0)) {
                    // Handle negative adjustments
                    let remainingReduction = deltaQuantity.abs();
                    for (const receipt of receipts) {
                        if (remainingReduction.lessThanOrEqualTo(0)) break;
                        const reduction = Decimal.min(receipt.quantity, remainingReduction);
                        const newQuantity = receipt.quantity.sub(reduction);
                        receiptUpdates.push({
                            id: receipt.id,
                            quantity: newQuantity,
                            deleted: newQuantity.equals(0) ? true : undefined,
                            deletedAt: newQuantity.equals(0) ? new Date() : undefined,
                        });
                        remainingReduction = remainingReduction.sub(reduction);
                    }
                    if (remainingReduction.greaterThan(0)) {
                        const variantInfo = adjustment.itemVariantId ? ` variantId ${adjustment.itemVariantId}` : '';
                        throw new RequestValidateError(`Insufficient StockReceipt quantity for item ${adjustment.itemId}${variantInfo}`);
                    }
                } else if (deltaQuantity.greaterThan(0)) {
                    // Handle positive adjustments
                    receiptCreates.push({
                        itemId: adjustment.itemId,
                        itemVariantId: adjustment.itemVariantId || null,  // Variant support
                        outletId: adjustment.outletId,
                        quantity: deltaQuantity,
                        cost: new Decimal(adjustment.cost || 0),
                        receiptDate: new Date(),
                        createdAt: new Date(),
                        deleted: false,
                        version: 1,
                    });
                }
            }

            // Step 7: Execute all bulk operations
            await Promise.all([
                // Bulk insert stock movements
                stockMovements.length > 0 && tx.stockMovement.createMany({ data: stockMovements }),

                // Bulk create receipts
                receiptCreates.length > 0 && tx.stockReceipt.createMany({ data: receiptCreates }),

                // Bulk update receipts
                ...receiptUpdates.map(update =>
                    tx.stockReceipt.update({
                        where: { id: update.id },
                        data: {
                            quantity: update.quantity,
                            updatedAt: new Date(),
                            version: { increment: 1 },
                            ...(update.deleted && { deleted: update.deleted, deletedAt: update.deletedAt })
                        }
                    })
                ),

                // Bulk update stock balances
                ...stockUpdates.map(update =>
                    tx.stockBalance.update({
                        where: {
                            id: update.id,
                            version: update.clientVersion,
                        },
                        data: {
                            availableQuantity: update.availableQuantity,
                            onHandQuantity: update.onHandQuantity,
                            version: { increment: 1 },
                            updatedAt: new Date(),
                            lastRestockDate: new Date(),
                        },
                    })
                )
            ].filter(Boolean));

            // Step 8: Touch parent stock's updatedAt for delta sync (variant support)
            // When variant stock changes, update parent stock so sync API returns it
            const variantUpdates = stockUpdates.filter(u => u.itemVariantId !== null);
            if (variantUpdates.length > 0) {
                const parentStockKeys = [...new Set(variantUpdates.map(u => `${u.itemId}-${u.outletId}`))];
                for (const key of parentStockKeys) {
                    const [itemId, outletId] = key.split('-').map(Number);
                    await tx.stockBalance.updateMany({
                        where: {
                            itemId,
                            outletId,
                            itemVariantId: null,
                            deleted: false
                        },
                        data: { updatedAt: new Date() }
                    });
                }
            }

            adjustedCount = stockUpdates.length;
        });

        return adjustedCount;
    } catch (error) {
        throw error;
    }
}

async function clearStock(databaseName: string, stockClearance: StockAdjustment): Promise<number> {
    const tenantPrisma = getTenantPrisma(databaseName);

    try {
        // Validate input
        if (stockClearance.version === undefined || stockClearance.version < 0) {
            throw new RequestValidateError('Valid version number must be provided');
        }

        await tenantPrisma.$transaction(async (tx) => {
            // Validate variant requirements
            const item = await tx.item.findUnique({
                where: { id: stockClearance.itemId, deleted: false },
                select: { id: true, hasVariants: true, itemName: true }
            });

            if (!item) {
                throw new NotFoundError(`Item with ID ${stockClearance.itemId} not found`);
            }

            // Validate variant rules
            if (item.hasVariants && (stockClearance.itemVariantId === null || stockClearance.itemVariantId === undefined)) {
                throw new RequestValidateError(
                    `Item "${item.itemName}" has variants. You must specify itemVariantId to clear variant stock.`
                );
            }
            if (!item.hasVariants && stockClearance.itemVariantId) {
                throw new RequestValidateError(
                    `Item "${item.itemName}" does not have variants. Remove itemVariantId from request.`
                );
            }

            // Fetch the stock balance (with variant support)
            const stock = await tx.stockBalance.findFirst({
                where: {
                    itemId: stockClearance.itemId,
                    outletId: stockClearance.outletId,
                    itemVariantId: stockClearance.itemVariantId || null,  // Variant support
                    deleted: false
                },
                select: { id: true, availableQuantity: true, onHandQuantity: true, version: true }
            });

            if (!stock) {
                const variantInfo = stockClearance.itemVariantId ? ` and variantId ${stockClearance.itemVariantId}` : '';
                throw new NotFoundError(`Stock not found for itemId ${stockClearance.itemId}${variantInfo} and outletId ${stockClearance.outletId}`);
            }

            // Fetch all active stock receipts for this item/outlet/variant
            const stockReceipts = await tx.stockReceipt.findMany({
                where: {
                    itemId: stockClearance.itemId,
                    outletId: stockClearance.outletId,
                    itemVariantId: stockClearance.itemVariantId || null,  // Variant support
                    quantity: { gt: 0 },
                    deleted: false,
                },
                select: { id: true, quantity: true }
            });

            const previousAvailableQuantity = stock.availableQuantity;
            const previousOnHandQuantity = stock.onHandQuantity;
            const newQuantity = new Decimal(0);
            const deltaQuantity = newQuantity.sub(stock.availableQuantity);

            // Create stock movement record (with variant support)
            await tx.stockMovement.create({
                data: {
                    itemId: stockClearance.itemId,
                    itemVariantId: stockClearance.itemVariantId || null,  // Variant support
                    outletId: stockClearance.outletId,
                    previousAvailableQuantity,
                    previousOnHandQuantity,
                    availableQuantityDelta: deltaQuantity,
                    onHandQuantityDelta: deltaQuantity,
                    movementType: 'Stock Clearance',
                    documentId: 0,
                    reason: stockClearance.reason || 'Stock clearance',
                    remark: stockClearance.remark || 'Stock cleared to zero',
                    deleted: false,
                    createdAt: new Date(),
                    performedBy: stockClearance.performedBy ?? null,
                }
            });

            // Mark all stock receipts as deleted
            if (stockReceipts.length > 0) {
                await Promise.all(stockReceipts.map(receipt =>
                    tx.stockReceipt.update({
                        where: { id: receipt.id },
                        data: {
                            quantity: receipt.quantity, // Keep original quantity for audit
                            updatedAt: new Date(),
                            version: { increment: 1 },
                            deleted: true,
                            deletedAt: new Date(),
                        }
                    })
                ));
            }

            // Update stock balance to zero
            await tx.stockBalance.update({
                where: {
                    id: stock.id,
                },
                data: {
                    availableQuantity: newQuantity,
                    onHandQuantity: newQuantity,
                    version: { increment: 1 },
                    updatedAt: new Date(),
                    lastRestockDate: new Date(),
                },
            });

            // Touch parent stock's updatedAt for delta sync (variant support)
            if (stockClearance.itemVariantId) {
                await tx.stockBalance.updateMany({
                    where: {
                        itemId: stockClearance.itemId,
                        outletId: stockClearance.outletId,
                        itemVariantId: null,
                        deleted: false
                    },
                    data: { updatedAt: new Date() }
                });
            }
        });

        return 1; // Always return 1 since we process one item at a time
    } catch (error) {
        throw error;
    }
}

let updateManyStocks = async (databaseName: string, stocks: StockBalance[]) => {
    try {
        const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
        var updatedCount = 0
        await tenantPrisma.$transaction(async (tx) => {

            for (const stock of stocks) {
                await tx.stockBalance.update({
                    where: {
                        id: stock.id
                    },
                    data: stock
                })
                updatedCount = updatedCount + 1
            }
        })
        return updatedCount
    }
    catch (error) {
        throw error
    }
}

let removeStock = async (databaseName: string, id: number) => {
    try {
        const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
        const stock = await tenantPrisma.stockBalance.findUnique({
            where: {
                id: id
            }
        })
        if (!stock) {
            throw new NotFoundError("Stock")
        }
        const updatedStock = await tenantPrisma.stockBalance.update({
            where: {
                id: id
            },
            data: {
                deleted: true
            }
        })
        return updatedStock
    }
    catch (error) {
        throw error
    }
}

export = { getAllStock, getStockByItemId, stockAdjustment, clearStock, updateManyStocks, removeStock }