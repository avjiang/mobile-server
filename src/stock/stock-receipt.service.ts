import { PrismaClient, StockReceipt } from "prisma/client"
import { getTenantPrisma } from '../db';

let getItemStockReceipt = async (databaseName: string, itemId: number, outletId?: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName)
    try {
        const whereCondition: any = {
            itemId: itemId,
            deleted: false
        }
        if (outletId) {
            whereCondition.outletId = outletId
        }

        const stockReceipts = await tenantPrisma.stockReceipt.findMany({
            where: whereCondition,
            // include: {
            //     outlet: {
            //         select: {
            //             outletName: true
            //         }
            //     },
            //     item: {
            //         select: {
            //             itemName: true,
            //             itemCode: true
            //         }
            //     }
            // },
            orderBy: {
                receiptDate: 'desc'
            }
        })

        return stockReceipts.map(receipt => ({
            ...receipt,
            // outletName: receipt.outlet.outletName,
            // itemName: receipt.item.itemName,
            // itemCode: receipt.item.itemCode,
            outlet: undefined,
            item: undefined
        }))
    }
    catch (error) {
        throw error
    }
}

export = { getItemStockReceipt }