import { Prisma, PrismaClient, StockBalance, StockMovement } from "@prisma/client"
import { NotFoundError } from "../api-helpers/error"
import { StockAdjustment, StockAdjustmentRequestBody } from "./stock-balance.request"
import stockMovementService from "./stock-movement.service"

import { getTenantPrisma } from '../db';
import { } from '../db';

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
    try {
        const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
        var adjustedCount = 0

        await tenantPrisma.$transaction(async (tx) => {
            let stocks: StockBalance[] = []
            let stockChecks: StockMovement[] = []

            for (const stockAdjustment of stockAdjustments) {
                let stock = await getStockByItemId(databaseName, stockAdjustment.itemId)
                if (!stock) {
                    throw new NotFoundError(`Stock for ${stockAdjustment.itemId}`)
                }

                let updatedAvailableQuantity = stock.availableQuantity + stockAdjustment.adjustQuantity
                let updatedOnHandQuantity = stock.onHandQuantity + stockAdjustment.adjustQuantity
                stock.availableQuantity = updatedAvailableQuantity
                stock.onHandQuantity = updatedOnHandQuantity

                let stockCheck: StockMovement = {
                    id: 0,
                    created: new Date,
                    itemId: stockAdjustment.itemId,
                    availableQuantityDelta: stockAdjustment.adjustQuantity,
                    onHandQuantityDelta: stockAdjustment.adjustQuantity,
                    documentId: 0,
                    movementType: "Stock Adjustment",
                    reason: stockAdjustment.reason,
                    remark: stockAdjustment.remark,
                    outletId: stockAdjustment.outletId,
                    deleted: false
                }

                stocks.push(stock)
                stockChecks.push(stockCheck)
            }

            await tx.stockMovement.createMany({
                data: stockChecks
            })

            for (const stock of stocks) {
                await tx.stockBalance.update({
                    where: {
                        id: stock.id
                    },
                    data: stock
                })
                adjustedCount = adjustedCount + 1
            }
        })
        return adjustedCount
    }
    catch (error) {
        throw error
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