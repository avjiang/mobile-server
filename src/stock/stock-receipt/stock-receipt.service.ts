import { PrismaClient, StockReceipt } from "../../../prisma/client/generated/client"
import { getTenantPrisma } from '../../db';

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
            orderBy: {
                receiptDate: 'desc'
            }
        })

        return stockReceipts.map(receipt => ({
            ...receipt,
            outlet: undefined,
            item: undefined
        }))
    }
    catch (error) {
        throw error
    }
}

interface StockReceiptInput {
    id: number;
    itemId?: number;
    outletId?: number;
    quantity?: number;
    cost?: number;
    receiptDate?: Date;
    version?: number;
}

let updateStockReceipt = async (databaseName: string, stockReceiptData: StockReceiptInput) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // Extract id, version, and other fields from the stockReceipt object
        const { id, version, ...updateData } = stockReceiptData;

        const updatedStockReceipt = await tenantPrisma.stockReceipt.update({
            where: {
                id: id
            },
            data: {
                ...updateData,
                updatedAt: new Date(),
            }
        });

        return updatedStockReceipt;
    }
    catch (error) {
        throw error;
    }
}

export = { getItemStockReceipt, updateStockReceipt }