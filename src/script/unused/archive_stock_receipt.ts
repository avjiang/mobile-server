import { getTenantPrisma } from "src/db";

// Example cron schedule (Node.js with node-cron)
// import cron from 'node-cron';
// cron.schedule('0 50 2 * * *', () => archiveStockReceipts('tenantDB'), { timezone: 'Asia/Singapore' });

async function archiveStockReceipts(databaseName: string) {
    const tenantPrisma = getTenantPrisma(databaseName);
    const thresholdDate = new Date();
    thresholdDate.setMonth(thresholdDate.getMonth() - 6);
    try {
        await tenantPrisma.$transaction(async (tx) => {
            // Find records to archive
            const oldReceipts = await tx.stockReceipt.findMany({
                where: {
                    quantity: { equals: 0 },
                    receiptDate: { lte: thresholdDate },
                    deleted: false, // Optional: only archive non-deleted records
                },
            });

            if (oldReceipts.length === 0) {
                console.log('No StockReceipt records to archive.');
                return;
            }

            // Archive records
            await tx.stockReceiptArchive.createMany({
                data: oldReceipts.map((receipt) => ({
                    itemId: receipt.itemId,
                    outletId: receipt.outletId,
                    quantity: receipt.quantity,
                    cost: receipt.cost,
                    receiptDate: receipt.receiptDate,
                    createdAt: receipt.createdAt,
                    updatedAt: receipt.updatedAt,
                    deleted: receipt.deleted,
                    deletedAt: receipt.deletedAt,
                    version: receipt.version,
                })),
            });

            // Delete archived records from StockReceipt
            await tx.stockReceipt.deleteMany({
                where: {
                    quantity: { equals: 0 },
                    receiptDate: { lte: thresholdDate },
                    deleted: false,
                },
            });

            console.log(`Archived ${oldReceipts.length} StockReceipt records with quantity = 0.`);
        });
    } catch (error) {
        console.error('Error archiving StockReceipts:', error);
        throw error;
    }
}