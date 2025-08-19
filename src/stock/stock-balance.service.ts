import { Prisma, PrismaClient, StockBalance, StockMovement } from "prisma/client"
import { Decimal } from 'decimal.js';
import { NotFoundError, VersionMismatchDetail, VersionMismatchError } from "../api-helpers/error"
import { StockAdjustment, StockAdjustmentRequestBody } from "./stock-balance.request"
import stockMovementService from "./stock-movement.service"
import { getTenantPrisma } from '../db';
import { } from '../db';
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
): Promise<{ stockBalances: StockBalance[]; total: number; serverTimestamp: string }> => {
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
                deleted: false
            };

        // Count total matching records
        const total = await tenantPrisma.stockBalance.count({ where });

        // Fetch paginated stocks with related item info
        const stocks = await tenantPrisma.stockBalance.findMany({
            where,
            skip,
            take,
        });
        return {
            stockBalances: stocks,
            total,
            serverTimestamp: new Date().toISOString(),
        };
    } catch (error) {
        throw error;
    }
};

let getStockByItemId = async (databaseName: string, itemId: number) => {
    try {
        const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
        const stock = await tenantPrisma.stockBalance.findFirst({
            where: {
                itemId: itemId,
                deleted: false
            }
        });
        if (!stock) {
            throw new NotFoundError("Stock Balance");
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
            const stockMovements = [];
            const stockUpdates: { id: number; availableQuantity: Decimal; onHandQuantity: Decimal; clientVersion: number }[] = [];
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

            // Step 2: Batch fetch all stock balances in a single query
            const stockBalanceKeys = stockAdjustments.map(adj => ({ itemId: adj.itemId, outletId: adj.outletId }));
            const stockBalances = await tx.stockBalance.findMany({
                where: {
                    OR: stockBalanceKeys,
                    deleted: false
                },
                select: { id: true, itemId: true, outletId: true, availableQuantity: true, onHandQuantity: true, version: true }
            });

            // Create a map for quick lookup
            const stockBalanceMap = new Map(
                stockBalances.map(stock => [`${stock.itemId}-${stock.outletId}`, stock])
            );

            // Step 3: Validate all adjustments against fetched stocks
            const validatedAdjustments = stockAdjustments.map(adjustment => {
                const stockKey = `${adjustment.itemId}-${adjustment.outletId}`;
                const stock = stockBalanceMap.get(stockKey);

                if (!stock) {
                    throw new NotFoundError(`Stock not found for itemId ${adjustment.itemId} and outletId ${adjustment.outletId}`);
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

            // Step 5: Batch fetch all stock receipts that might be affected
            const receiptKeys = validatedAdjustments
                .filter(({ adjustment }) => adjustment.overrideQuantity !== undefined || (adjustment.adjustQuantity && adjustment.adjustQuantity < 0))
                .map(({ adjustment }) => ({ itemId: adjustment.itemId, outletId: adjustment.outletId }));

            const stockReceipts = receiptKeys.length > 0 ? await tx.stockReceipt.findMany({
                where: {
                    OR: receiptKeys,
                    quantity: { gt: 0 },
                    deleted: false,
                },
                orderBy: [{ itemId: 'asc' }, { outletId: 'asc' }, { receiptDate: 'asc' }]
            }) : [];

            // Group receipts by itemId-outletId for quick lookup
            const receiptsByKey = stockReceipts.reduce((acc, receipt) => {
                const key = `${receipt.itemId}-${receipt.outletId}`;
                if (!acc[key]) acc[key] = [];
                acc[key].push(receipt);
                return acc;
            }, {} as Record<string, typeof stockReceipts>);

            // Step 6: Process adjustments and prepare bulk operations
            const receiptUpdates: { id: number; quantity: Decimal; deleted?: boolean; deletedAt?: Date }[] = [];
            const receiptCreates: any[] = [];

            for (const { adjustment, stock } of validatedAdjustments) {
                const receiptKey = `${adjustment.itemId}-${adjustment.outletId}`;
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

                // Prepare stock movement
                stockMovements.push({
                    itemId: adjustment.itemId,
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

                // Prepare stock balance update
                stockUpdates.push({
                    id: stock.id,
                    availableQuantity: newAvailableQuantity,
                    onHandQuantity: newOnHandQuantity,
                    clientVersion: adjustment.version,
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
                        throw new RequestValidateError(`Insufficient StockReceipt quantity for item ${adjustment.itemId}`);
                    }
                } else if (deltaQuantity.greaterThan(0)) {
                    // Handle positive adjustments
                    receiptCreates.push({
                        itemId: adjustment.itemId,
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

            adjustedCount = stockUpdates.length;
        });

        return adjustedCount;
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

export = { getAllStock, getStockByItemId, stockAdjustment, updateManyStocks, removeStock }