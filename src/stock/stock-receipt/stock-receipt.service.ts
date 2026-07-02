import { PrismaClient, StockReceipt } from "../../../prisma/client/generated/client"
import { Decimal } from 'decimal.js';
import { getTenantPrisma } from '../../db';
import { StockReceiptInput, StockReceiptsRequestBody } from "./stock-receipt.request";
import { restateSalesCostsForReceipts, ReceiptCostChange } from "../sales-cost-restatement";

let getItemStockReceipt = async (databaseName: string, itemId: number, outletId?: number, itemVariantId?: number | null) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName)
    try {
        const whereCondition: any = {
            itemId: itemId,
            deleted: false
        }
        if (outletId) {
            whereCondition.outletId = outletId
        }
        // Only add itemVariantId filter if explicitly provided (including null)
        if (itemVariantId !== undefined) {
            whereCondition.itemVariantId = itemVariantId
        }

        const stockReceipts = await tenantPrisma.stockReceipt.findMany({
            where: whereCondition,
            include: {
                itemVariant: {
                    select: {
                        variantSku: true,
                        variantName: true,
                    }
                }
            },
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
        return await tenantPrisma.$transaction(async (tx) => {
            const updatedStockReceipts: StockReceipt[] = [];
            const costChanges: ReceiptCostChange[] = [];

            for (const stockReceiptData of requestBody.stockReceipts) {
                const { id, version, itemId, outletId, itemVariantId, ...updateData } = stockReceiptData;

                const updated = await tx.stockReceipt.update({
                    where: {
                        id: id
                    },
                    data: {
                        ...updateData,
                        updatedAt: new Date(),
                        version: { increment: 1 },
                    }
                });
                updatedStockReceipts.push(updated);

                // Manual capital/cost edit — restate sales lines that already consumed
                // this receipt so stored profit stays truthful (same mechanism as
                // invoice re-pricing).
                if (updateData.cost !== undefined && updateData.cost !== null) {
                    costChanges.push({ location: 'OUTLET', receiptId: id, newCost: new Decimal(updateData.cost) });
                }
            }

            await restateSalesCostsForReceipts(tx, costChanges);
            return updatedStockReceipts;
        });
    }
    catch (error) {
        throw error;
    }
}

export = { getItemStockReceipt, updateStockReceipts }