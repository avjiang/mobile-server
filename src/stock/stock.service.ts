import { Prisma, PrismaClient, Stock, StockCheck } from "@prisma/client"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { StockAdjustment, StockAdjustmentRequestBody } from "./stock.request"
import stockcheckService from "./stockcheck.service"

const prisma = new PrismaClient()

// stock function 
let getAllStock = async () => {
    try {
        const stocks = await prisma.stock.findMany()
        return stocks
    }
    catch (error) {
        throw error
    }
}

let getStockByItemId = async (itemId: number) => {
    try {
        const stock = await prisma.stock.findUnique({
            where: {
                id: (await prisma.item.findUnique({
                    where: { id: itemId },
                    select: { stockId: true },
                }))?.stockId,
            }
        })
        if (!stock) {
            throw new NotFoundError("Stock")
        }
        return stock
    }
    catch (error) {
        throw error
    }
}

let stockAdjustment = async (stockAdjustments: StockAdjustment[]) => {
    try {
        var adjustedCount = 0

        await prisma.$transaction(async (tx) => {
            let stocks: Stock[] = []
            let stockChecks: StockCheck[] = []

            for (const stockAdjustment of stockAdjustments) {
                let stock = await getStockByItemId(stockAdjustment.itemId)
                if (!stock) {
                    throw new NotFoundError(`Stock for ${stockAdjustment.itemId}`)
                }

                let updatedAvailableQuantity = stock.availableQuantity + stockAdjustment.adjustQuantity
                let updatedOnHandQuantity = stock.onHandQuantity + stockAdjustment.adjustQuantity
                stock.availableQuantity = updatedAvailableQuantity
                stock.onHandQuantity = updatedOnHandQuantity

                let stockCheck: StockCheck = {
                    id: 0,
                    created: new Date,
                    itemId: stockAdjustment.itemId,
                    availableQuantity: stockAdjustment.adjustQuantity,
                    onHandQuantity: stockAdjustment.adjustQuantity,
                    documentId: 0,
                    documentType: "Stock Adjustment",
                    reason: stockAdjustment.reason,
                    remark: stockAdjustment.remark,
                    outletId: stockAdjustment.outletId,
                    deleted: false
                }

                stocks.push(stock)
                stockChecks.push(stockCheck)
            }

            await tx.stockCheck.createMany({
                data: stockChecks
            })

            for (const stock of stocks) {
                await tx.stock.update({
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

let updateManyStocks = async (stocks: Stock[]) => {
    try {
        var updatedCount = 0
        await prisma.$transaction(async (tx) => {

            for (const stock of stocks) {
                await tx.stock.update({
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

let removeStock = async (id: number) => {
    try {
        const stock = await prisma.stock.findUnique({
            where: {
                id: id
            }
        })
        if (!stock) {
            throw new NotFoundError("Stock")
        }
        const updatedStock = await prisma.stock.update({
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