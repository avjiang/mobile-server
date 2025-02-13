import { PrismaClient, StockCheck } from "@prisma/client"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"

const prisma = new PrismaClient()

//stock check function
let getAllStockCheck = async () => {
    try {
        const stockChecks = await prisma.stockCheck.findMany()
        return stockChecks
    }
    catch (error) {
        throw error
    }
}

let getStockChecksByItemIdAndOutlet = async (itemId: number, outletId: number) => {
    try {
        const stockChecks = await prisma.stockCheck.findMany({
            where: {
                itemId: itemId,
                outletId: outletId
            }
        })
        return stockChecks
    }
    catch (error) {
        throw error
    }
}

let createManyStockChecks = async (stockChecks: StockCheck[]) => {
    try {
        const createdStockChecks = await prisma.stockCheck.createMany({
            data: stockChecks
        })

        return createdStockChecks.count
    }
    catch (error) {
        throw error
    }
}

let updateManyStockChecks = async (stockChecks: StockCheck[]) => {
    try {
        var updatedCount = 0
        await prisma.$transaction(async (tx) => {

            for (const stockCheck of stockChecks) {
                await tx.stockCheck.update({
                    where: {
                        id: stockCheck.id
                    },
                    data: stockCheck
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

export = { getAllStockCheck, getStockChecksByItemIdAndOutlet, createManyStockChecks, updateManyStockChecks }