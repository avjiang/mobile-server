import { PrismaClient, StockCheck } from "@prisma/client"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { getTenantPrisma } from '../db';

//stock check function
let getAllStockCheck = async (databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName)
    try {
        const stockChecks = await tenantPrisma.stockCheck.findMany()
        return stockChecks
    }
    catch (error) {
        throw error
    }
}

let getStockChecksByItemIdAndOutlet = async (databaseName: string, itemId: number, outletId: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName)
    try {
        const stockChecks = await tenantPrisma.stockCheck.findMany({
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

let createManyStockChecks = async (databaseName: string, stockChecks: StockCheck[]) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName)
    try {
        const createdStockChecks = await tenantPrisma.stockCheck.createMany({
            data: stockChecks
        })

        return createdStockChecks.count
    }
    catch (error) {
        throw error
    }
}

let updateManyStockChecks = async (databaseName: string, stockChecks: StockCheck[]) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName)
    try {
        var updatedCount = 0
        await tenantPrisma.$transaction(async (tx) => {

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