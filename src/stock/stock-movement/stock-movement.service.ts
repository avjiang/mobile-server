import { PrismaClient } from "../../../prisma/client/generated/client"
import { getTenantPrisma } from '../../db';

let getStockChecksByItemIdAndOutlet = async (databaseName: string, itemId: number, outletId: number, itemVariantId?: number | null) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName)
    try {
        const whereCondition: any = {
            itemId: itemId,
            outletId: outletId
        }
        // Only add itemVariantId filter if explicitly provided (including null)
        if (itemVariantId !== undefined) {
            whereCondition.itemVariantId = itemVariantId
        }

        const stockMovements = await tenantPrisma.stockMovement.findMany({
            where: whereCondition,
            include: {
                outlet: {
                    select: {
                        outletName: true
                    }
                },
                itemVariant: {
                    select: {
                        variantSku: true,
                        variantName: true,
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

export = { getStockChecksByItemIdAndOutlet }
