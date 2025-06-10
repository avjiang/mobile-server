import { Prisma, PrismaClient, StockBalance, StockMovement } from "@prisma/client"
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

        // // Transform to expected response format
        // const response = stocks.map(stock => ({
        //     ...stock,
        //     item: undefined, // Remove the nested item object
        //     itemName: stock.item?.itemName || "",
        //     itemCode: stock.item?.itemCode || "",
        //     // Add other item fields you need here
        // }));

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
            const stockUpdates: { id: number; availableQuantity: number; onHandQuantity: number; clientVersion: number }[] = [];
            const versionMismatches: VersionMismatchDetail[] = [];

            // Step 1: Fetch and validate adjustments
            const stockBalances = await Promise.all(
                stockAdjustments.map(async (adjustment) => {
                    // Validate input
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

                    // Fetch stock
                    const stock = await tx.stockBalance.findFirst({
                        where: { itemId: adjustment.itemId, outletId: adjustment.outletId, deleted: false },
                        select: { id: true, availableQuantity: true, onHandQuantity: true, version: true },
                    });

                    if (!stock) {
                        throw new NotFoundError(`Stock not found for itemId ${adjustment.itemId} not found`);
                    }

                    // Check version
                    const currentVersion = stock.version || 1;
                    if (currentVersion !== adjustment.version) {
                        versionMismatches.push({
                            itemId: adjustment.itemId,
                            expectedVersion: adjustment.version,
                            foundVersion: currentVersion,
                        });
                    }
                    return { adjustment, stock };
                })
            );

            // Step 2: Throw if version mismatches
            if (versionMismatches.length > 0) {
                throw new VersionMismatchError(`Version mismatches detected for ${versionMismatches.length} item(s)`, versionMismatches);
            }

            // Step 3: Process adjustments
            for (const { adjustment, stock } of stockBalances) {
                const previousAvailableQuantity = stock.availableQuantity;
                const previousOnHandQuantity = stock.onHandQuantity;

                let newAvailableQuantity: number;
                let newOnHandQuantity: number;
                let deltaQuantity: number;

                if (adjustment.overrideQuantity !== undefined) {
                    newAvailableQuantity = adjustment.overrideQuantity;
                    newOnHandQuantity = adjustment.overrideQuantity;
                    deltaQuantity = adjustment.overrideQuantity - stock.availableQuantity;
                } else {
                    newAvailableQuantity = stock.availableQuantity + (adjustment.adjustQuantity || 0);
                    newOnHandQuantity = stock.onHandQuantity + (adjustment.adjustQuantity || 0);
                    deltaQuantity = adjustment.adjustQuantity || 0;
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

                // Handle StockReceipt
                if (adjustment.overrideQuantity !== undefined) {
                    // Fetch existing receipts
                    const receipts = await tx.stockReceipt.findMany({
                        where: {
                            itemId: adjustment.itemId,
                            outletId: adjustment.outletId,
                            quantity: { gt: 0 },
                            deleted: false,
                        },
                        orderBy: { receiptDate: 'asc' }, // FIFO: oldest first
                    });

                    // Calculate total current receipt quantity
                    const totalReceiptQuantity = receipts.reduce((sum, receipt) => sum + receipt.quantity, 0);

                    if (deltaQuantity < 0) {
                        // Reduce stock using FIFO
                        let remainingReduction = Math.abs(deltaQuantity);
                        for (const receipt of receipts) {
                            if (remainingReduction <= 0) break;
                            const reduction = Math.min(receipt.quantity, remainingReduction);
                            await tx.stockReceipt.update({
                                where: { id: receipt.id },
                                data: {
                                    quantity: receipt.quantity - reduction,
                                    updatedAt: new Date(),
                                    version: { increment: 1 },
                                    deleted: receipt.quantity - reduction === 0 ? true : undefined,
                                    deletedAt: receipt.quantity - reduction === 0 ? new Date() : undefined,
                                },
                            });
                            remainingReduction -= reduction;
                        }
                        if (remainingReduction > 0) {
                            throw new RequestValidateError(`Insufficient StockReceipt quantity for item ${adjustment.itemId}`);
                        }
                    } else if (deltaQuantity > 0) {
                        // Clear existing receipts if overrideQuantity < totalReceiptQuantity
                        if (newAvailableQuantity < totalReceiptQuantity) {
                            let remainingReduction = totalReceiptQuantity - newAvailableQuantity;
                            for (const receipt of receipts) {
                                if (remainingReduction <= 0) break;
                                const reduction = Math.min(receipt.quantity, remainingReduction);
                                await tx.stockReceipt.update({
                                    where: { id: receipt.id },
                                    data: {
                                        quantity: receipt.quantity - reduction,
                                        updatedAt: new Date(),
                                        version: { increment: 1 },
                                        deleted: receipt.quantity - reduction === 0 ? true : undefined,
                                        deletedAt: receipt.quantity - reduction === 0 ? new Date() : undefined,
                                    },
                                });
                                remainingReduction -= reduction;
                            }
                        }
                        // Create new receipt for the new balance
                        if (newAvailableQuantity > 0) {
                            await tx.stockReceipt.create({
                                data: {
                                    itemId: adjustment.itemId,
                                    outletId: adjustment.outletId,
                                    quantity: newAvailableQuantity,
                                    cost: adjustment.cost,
                                    receiptDate: new Date(),
                                    createdAt: new Date(),
                                    deleted: false,
                                    version: 1,
                                },
                            });
                        }
                    }
                } else if (deltaQuantity < 0) {
                    // Handle negative adjustments
                    const receipts = await tx.stockReceipt.findMany({
                        where: {
                            itemId: adjustment.itemId,
                            outletId: adjustment.outletId,
                            quantity: { gt: 0 },
                            deleted: false,
                        },
                        orderBy: { receiptDate: 'asc' },
                    });

                    let remainingReduction = Math.abs(deltaQuantity);
                    for (const receipt of receipts) {
                        if (remainingReduction <= 0) break;
                        const reduction = Math.min(receipt.quantity, remainingReduction);
                        await tx.stockReceipt.update({
                            where: { id: receipt.id },
                            data: {
                                quantity: receipt.quantity - reduction,
                                updatedAt: new Date(),
                                version: { increment: 1 },
                                deleted: receipt.quantity - reduction === 0 ? true : undefined,
                                deletedAt: receipt.quantity - reduction === 0 ? new Date() : undefined,
                            },
                        });
                        remainingReduction -= reduction;
                    }
                    if (remainingReduction > 0) {
                        throw new RequestValidateError(`Insufficient StockReceipt quantity for item ${adjustment.itemId}`);
                    }
                } else if (deltaQuantity > 0) {
                    // Handle positive adjustments
                    await tx.stockReceipt.create({
                        data: {
                            itemId: adjustment.itemId,
                            outletId: adjustment.outletId,
                            quantity: deltaQuantity,
                            cost: adjustment.cost,
                            receiptDate: new Date(),
                            createdAt: new Date(),
                            deleted: false,
                            version: 1,
                        },
                    });
                }
            }

            // Step 4: Bulk insert stock movements
            await tx.stockMovement.createMany({
                data: stockMovements,
            });

            // Step 5: Bulk update stock balances
            await Promise.all(
                stockUpdates.map((update) =>
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
            );
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