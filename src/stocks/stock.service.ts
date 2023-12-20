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

let getStockByItemCodeAndOutlet = async (itemCode: string, outletId: number) => {
    try {
        const stock = await prisma.stock.findFirst({
            where: {
                itemCode: itemCode,
                outletId: outletId
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

let createManyStocks = async (stocks: Stock[]) => {
    try {
        const createdStocks = await prisma.stock.createMany({
            data: stocks
        })

        return createdStocks.count
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
                let stock = await tx.stock.findFirst({
                    where: {
                        itemCode: stockAdjustment.itemCode,
                        outletId: stockAdjustment.outletId
                    }
                })
                if (!stock) {
                    throw new NotFoundError(`Stock for ${stockAdjustment.itemCode}`)
                }

                let updatedAvailableQuantity = parseFloat(stock.availableQuantity.toString()) + stockAdjustment.adjustQuantity
                let updatedOnHandQuantity = parseFloat(stock.onHandQuantity.toString()) + stockAdjustment.adjustQuantity
                stock.availableQuantity = new Prisma.Decimal(updatedAvailableQuantity)
                stock.onHandQuantity = new Prisma.Decimal(updatedOnHandQuantity)

                let stockCheck: StockCheck = {
                    id: 0,
                    created: new Date,
                    itemCode: stockAdjustment.itemCode,
                    availableQuantity: new Prisma.Decimal(stockAdjustment.adjustQuantity),
                    onHandQuantity: new Prisma.Decimal(stockAdjustment.adjustQuantity),
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
        // const updatedStocks = await prisma.stock.updateMany({
        //     where: {
        //         OR: stocks.map(stock => ({ id: stock.id }))
        //     },
        //     data: stocks
        // })
        // return updatedStocks

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

export = { getAllStock, getStockByItemCodeAndOutlet, createManyStocks, stockAdjustment, updateManyStocks, removeStock }