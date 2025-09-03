import { PrismaClient, StockReceipt } from "../../../prisma/client/generated/client"
import { getTenantPrisma } from '../../db';
import { StockReceiptInput, StockReceiptsRequestBody } from "./stock-receipt.request";

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

let updateStockReceipts = async (databaseName: string, requestBody: StockReceiptsRequestBody) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const updatePromises = requestBody.stockReceipts.map(async (stockReceiptData) => {
            const { id, version, ...updateData } = stockReceiptData;

            return await tenantPrisma.stockReceipt.update({
                where: {
                    id: id
                },
                data: {
                    ...updateData,
                    updatedAt: new Date(),
                    version: { increment: 1 },
                }
            });
        });

        const updatedStockReceipts = await Promise.all(updatePromises);
        return updatedStockReceipts;
    }
    catch (error) {
        throw error;
    }
}

export = { getItemStockReceipt, updateStockReceipts }