import { PrismaClient, StockMovement } from "prisma/client"
import { getTenantPrisma } from '../db';

let getAllStockCheck = async (databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName)
    try {
        const stockChecks = await tenantPrisma.stockMovement.findMany()
        return stockChecks
    }
    catch (error) {
        throw error
    }
}

let getStockChecksByItemIdAndOutlet = async (databaseName: string, itemId: number, outletId: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName)
    try {
        const stockMovements = await tenantPrisma.stockMovement.findMany({
            where: {
                itemId: itemId,
                outletId: outletId
            },
            include: {
                outlet: {
                    select: {
                        outletName: true
                    }
                }
            },
            take: 25,
            orderBy: {
                createdAt: 'desc' // This will sort from newest to oldest
            }
        })
        return stockMovements.map(movement => ({
            ...movement,
            outletName: movement.outlet.outletName,
            outlet: undefined
        }))
    }
    catch (error) {
        throw error
    }
}

let createManyStockChecks = async (databaseName: string, stockChecks: StockMovement[]) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName)
    try {
        const createdStockChecks = await tenantPrisma.stockMovement.createMany({
            data: stockChecks
        })

        return createdStockChecks.count
    }
    catch (error) {
        throw error
    }
}

let updateManyStockChecks = async (databaseName: string, stockChecks: StockMovement[]) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName)
    try {
        var updatedCount = 0
        await tenantPrisma.$transaction(async (tx) => {

            for (const stockCheck of stockChecks) {
                await tx.stockMovement.update({
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