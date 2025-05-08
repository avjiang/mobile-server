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

let stockAdjustment = async (databaseName: string, stockAdjustments: StockAdjustment[]) => {
    const tenantPrisma = getTenantPrisma(databaseName);
    let adjustedCount = 0;

    try {
        await tenantPrisma.$transaction(async (tx) => {
            const stockMovements = [];
            const stockUpdates: { id: number; availableQuantity: number; onHandQuantity: number; clientVersion: number }[] = [];
            const versionMismatches: VersionMismatchDetail[] = [];

            // Step 1: Check all adjustments for version mismatches
            for (const adjustment of stockAdjustments) {
                // Validate adjustment quantities
                if (adjustment.adjustQuantity !== undefined && adjustment.overrideQuantity !== undefined) {
                    throw new RequestValidateError('Provide either adjustQuantity or overrideQuantity, not both');
                }
                if (adjustment.adjustQuantity === undefined && adjustment.overrideQuantity === undefined) {
                    throw new RequestValidateError('Either adjustQuantity or overrideQuantity must be provided');
                }
                if (adjustment.version === undefined || adjustment.version < 1) {
                    throw new RequestValidateError('Valid version number must be provided');
                }
                // Fetch stock with version
                const stock = await tx.stockBalance.findFirst({
                    where: { itemId: adjustment.itemId, outletId: adjustment.outletId, deleted: false },
                    select: { id: true, availableQuantity: true, onHandQuantity: true, version: true },
                });
                if (!stock) {
                    throw new NotFoundError(`Stock for itemId ${adjustment.itemId} not found`);
                }
                // Check for version mismatch
                const currentVersion = stock.version || 1;
                if (currentVersion !== adjustment.version) {
                    versionMismatches.push({
                        itemId: adjustment.itemId,
                        expectedVersion: adjustment.version,
                        foundVersion: currentVersion,
                    });
                }
            }
            // Step 2: If there are version mismatches, throw an error
            if (versionMismatches.length > 0) {
                const message = `Version mismatches detected for ${versionMismatches.length} item(s)`;
                throw new VersionMismatchError(message, versionMismatches);
            }
            // Step 3: Process adjustments only if no mismatches
            for (const adjustment of stockAdjustments) {
                // Fetch stock again (since we're in a transaction, this is safe and ensures latest data)
                const stock = await tx.stockBalance.findFirst({
                    where: { itemId: adjustment.itemId, outletId: adjustment.outletId, deleted: false },
                    select: { id: true, availableQuantity: true, onHandQuantity: true, version: true },
                });
                if (!stock) {
                    throw new NotFoundError(`Stock for itemId ${adjustment.itemId} not found`);
                }
                // Store previous values
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
                    reason: adjustment.reason,
                    remark: adjustment.remark,
                    deleted: false,
                });
                // Prepare stock balance update
                stockUpdates.push({
                    id: stock.id,
                    availableQuantity: newAvailableQuantity,
                    onHandQuantity: newOnHandQuantity,
                    clientVersion: adjustment.version,
                });
            }
            // Step 4: Bulk insert stock movements
            await tx.stockMovement.createMany({
                data: stockMovements,
            });
            // Step 5: Bulk update stock balances with version check
            await Promise.all(
                stockUpdates.map((update) =>
                    tx.stockBalance.update({
                        where: {
                            id: update.id,
                            version: update.clientVersion, // Ensure version matches client-provided version
                        },
                        data: {
                            availableQuantity: update.availableQuantity,
                            onHandQuantity: update.onHandQuantity,
                            version: { increment: 1 }, // Increment version
                            updatedAt: new Date(),
                        },
                    })
                )
            );
            adjustedCount = stockUpdates.length;
        });

        return adjustedCount;
    } catch (error) {
        if (error instanceof VersionMismatchError) {
            throw error; // Propagate VersionMismatchError with all mismatches
        }
        // if (error.code === 'P2025') {
        //     // Prisma error for record not found or version mismatch during update
        //     throw new BaseError(409, 'Stock balance was modified by another process. Please fetch the latest data and retry.');
        // }
        throw error;
    }
};

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