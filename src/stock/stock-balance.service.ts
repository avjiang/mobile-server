import { Prisma, PrismaClient, StockBalance, StockMovement } from "@prisma/client"
import { NotFoundError } from "../api-helpers/error"
import { StockAdjustment, StockAdjustmentRequestBody } from "./stock-balance.request"
import stockMovementService from "./stock-movement.service"

import { getTenantPrisma } from '../db';
import { } from '../db';

class RequestValidateError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RequestValidateError';
    }
}

// stock function 
let getAllStock = async (databaseName: string) => {
    try {
        const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
        const stocks = await tenantPrisma.stockBalance.findMany()
        return stocks
    }
    catch (error) {
        throw error
    }
}

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
            // Prepare stock movements
            const stockMovements = [];
            const stockUpdates: { id: number; availableQuantity: number; onHandQuantity: number }[] = [];

            for (const adjustment of stockAdjustments) {
                // Validate adjustment quantities
                if (adjustment.adjustQuantity !== undefined && adjustment.overrideQuantity !== undefined) {
                    throw new RequestValidateError('Provide either adjustQuantity or overrideQuantity, not both');
                }
                if (adjustment.adjustQuantity === undefined && adjustment.overrideQuantity === undefined) {
                    throw new RequestValidateError('Either adjustQuantity or overrideQuantity must be provided');
                }

                const stock = await tx.stockBalance.findFirst({
                    where: { itemId: adjustment.itemId, outletId: adjustment.outletId, deleted: false },
                });

                if (!stock) {
                    throw new NotFoundError(`Stock for itemId ${adjustment.itemId} not found`);
                }

                let newAvailableQuantity: number;
                let newOnHandQuantity: number;
                let deltaQuantity: number;

                if (adjustment.overrideQuantity !== undefined) {
                    // Override: Set quantities to the provided value
                    newAvailableQuantity = adjustment.overrideQuantity;
                    newOnHandQuantity = adjustment.overrideQuantity;
                    deltaQuantity = adjustment.overrideQuantity - stock.availableQuantity;
                } else {
                    // Delta: Adjust quantities by the provided delta
                    newAvailableQuantity = stock.availableQuantity + (adjustment.adjustQuantity || 0);
                    newOnHandQuantity = stock.onHandQuantity + (adjustment.adjustQuantity || 0);
                    deltaQuantity = adjustment.adjustQuantity || 0;
                }

                // Ensure quantities are non-negative (optional, based on business rules)
                if (newAvailableQuantity < 0 || newOnHandQuantity < 0) {
                    throw new RequestValidateError(`Adjustment for itemId ${adjustment.itemId} would result in negative stock`);
                }

                // Prepare stock movement
                stockMovements.push({
                    itemId: adjustment.itemId,
                    outletId: adjustment.outletId,
                    availableQuantityDelta: deltaQuantity,
                    onHandQuantityDelta: deltaQuantity,
                    movementType: 'Stock Adjustment',
                    documentId: 0,
                    reason: adjustment.reason,
                    remark: adjustment.remark,
                    created: new Date(),
                    deleted: false,
                });

                // Prepare stock balance update
                stockUpdates.push({
                    id: stock.id,
                    availableQuantity: newAvailableQuantity,
                    onHandQuantity: newOnHandQuantity,
                });
            }

            // Bulk insert stock movements
            await tx.stockMovement.createMany({
                data: stockMovements,
            });

            // Bulk update stock balances
            await Promise.all(
                stockUpdates.map((update) =>
                    tx.stockBalance.update({
                        where: { id: update.id },
                        data: {
                            availableQuantity: update.availableQuantity,
                            onHandQuantity: update.onHandQuantity,
                            lastUpdated: new Date(),
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