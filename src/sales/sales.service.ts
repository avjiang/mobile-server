import { Payment, Prisma, PrismaClient, Sales, SalesItem, StockBalance, StockMovement } from "../../prisma/client/generated/client"
import { Decimal } from 'decimal.js';
import { BusinessLogicError, NotFoundError } from "../api-helpers/error"
import { SalesRequestBody, SalesCreationRequest, CreateSalesRequest, CalculateSalesObject, CalculateSalesItemObject, DiscountBy, DiscountType, CalculateSalesDto } from "./sales.request"
import { getTenantPrisma } from '../db';
import { SyncRequest } from "src/item/item.request";
import PushyService from '../pushy/pushy.service';
import { randomUUID } from 'crypto';

// Helper function to send sales notifications
async function sendSalesNotification(
    tenantId: number,
    outletId: number,
    title: string,
    message: string,
    data: any
): Promise<void> {
    try {
        const notificationPayload = {
            title,
            message,
            data: {
                notificationId: randomUUID(),
                type: 'SALES',
                tenantId,
                timestamp: new Date().toISOString(),
                ...data
            }
        };

        await PushyService.sendToTopic(
            `tenant_${tenantId}_outlet_${outletId}_sales`,
            notificationPayload,
            tenantId
        );
    } catch (error) {
        // Log error but don't fail the sale transaction
        console.error('Failed to send sales notification:', error);
    }
}

// Helper function to send inventory notifications
async function sendInventoryNotification(
    tenantId: number,
    outletId: number,
    title: string,
    message: string,
    data: any
): Promise<void> {
    try {
        const notificationPayload = {
            title,
            message,
            data: {
                notificationId: randomUUID(),
                type: 'INVENTORY',
                tenantId,
                timestamp: new Date().toISOString(),
                ...data
            }
        };

        await PushyService.sendToTopic(
            `tenant_${tenantId}_outlet_${outletId}_inventory`,
            notificationPayload,
            tenantId
        );
    } catch (error) {
        // Log error but don't fail the transaction
        console.error('Failed to send inventory notification:', error);
    }
}

let getAll = async (databaseName: string, request: SyncRequest) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { outletId, skip = 0, take = 100, lastSyncTimestamp } = request;

    try {
        // Parse last sync timestamp with optimization for null/first sync
        let lastSync: Date;

        if (lastSyncTimestamp && lastSyncTimestamp !== 'null') {
            lastSync = new Date(lastSyncTimestamp);
        } else {
            // Option 1: Limit to recent data (e.g., last 30 days) for first sync
            // const daysBack = 30;
            // lastSync = new Date();
            // lastSync.setDate(lastSync.getDate() - daysBack);

            // Option 2: Or use current business date only
            lastSync = new Date();
            lastSync.setHours(0, 0, 0, 0); // Start of today
        }

        // Ensure outletId is a number
        const parsedOutletId = typeof outletId === 'string' ? parseInt(outletId, 10) : outletId;

        // Build query conditions
        const where = {
            outletId: parsedOutletId,
            deleted: false,
            OR: [
                { createdAt: { gte: lastSync } },
                { updatedAt: { gte: lastSync } }
            ],
        };

        // Count total records
        const total = await tenantPrisma.sales.count({ where });

        const salesArray = await tenantPrisma.sales.findMany({
            where,
            select: {
                id: true,
                businessDate: true,
                salesType: true,
                customerId: true,
                customerName: true,
                phoneNumber: true,
                totalAmount: true,
                paidAmount: true,
                status: true,
                remark: true,
                shipStreet: true,
                // customer: {
                //     select: {
                //         firstName: true,
                //         lastName: true,
                //     },
                // },
                payments: {
                    select: {
                        method: true
                    }
                },
                salesItems: true
            },
            skip,
            take,
            orderBy: [
                { updatedAt: 'desc' },
                { createdAt: 'desc' }
            ]
        })

        // Transform results to include customerName
        const transformedSales = salesArray.map(sale => ({
            id: sale.id,
            businessDate: sale.businessDate,
            salesType: sale.salesType,
            customerId: sale.customerId,
            customerName: sale.customerName,
            phoneNumber: sale.phoneNumber,
            totalAmount: sale.totalAmount,
            paidAmount: sale.paidAmount,
            status: sale.status,
            shipStreet: sale.shipStreet,
            remark: sale.remark,
            totalItems: sale.salesItems.length,
            payments: sale.payments || [],
        }));

        // Return with pagination metadata and server timestamp
        return {
            data: transformedSales,
            total,
            serverTimestamp: new Date().toISOString(),
            isFirstSync: !lastSyncTimestamp || lastSyncTimestamp === 'null'
        };
    }
    catch (error) {
        throw error
    }
}

let getByDateRange = async (databaseName: string, request: SyncRequest & { startDate: string, endDate: string }) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { outletId, skip = 0, take = 100, lastSyncTimestamp, startDate, endDate } = request;

    try {
        // Parse last sync timestamp or use a default (e.g., epoch start)
        const lastSync = (lastSyncTimestamp && lastSyncTimestamp !== 'null') ?
            new Date(lastSyncTimestamp) : new Date(0);

        // Ensure outletId is a number
        const parsedOutletId = typeof outletId === 'string' ? parseInt(outletId, 10) : outletId;

        // Parse and validate date range
        const parsedStartDate = new Date(startDate);
        parsedStartDate.setHours(0, 0, 0, 0); // Start of day

        const parsedEndDate = new Date(endDate);
        parsedEndDate.setHours(23, 59, 59, 999); // End of day

        // Ensure dates are valid
        if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
            throw new Error('Invalid date format');
        }

        // Build query conditions with date range
        const where = {
            outletId: parsedOutletId,
            businessDate: {
                gte: parsedStartDate,
                lte: parsedEndDate
            },
            deleted: false,
        };

        // Count total records
        const total = await tenantPrisma.sales.count({ where });

        const salesArray = await tenantPrisma.sales.findMany({
            where,
            select: {
                id: true,
                businessDate: true,
                salesType: true,
                customerId: true,
                customerName: true,
                phoneNumber: true,
                shipStreet: true,
                totalAmount: true,
                paidAmount: true,
                status: true,
                remark: true,
                // customer: {
                //     select: {
                //         firstName: true,
                //         lastName: true,
                //     },
                // },
                payments: {
                    select: {
                        method: true
                    }
                },
                salesItems: true
            },
            skip,
            take,
        });

        // Transform results to include customerName
        const transformedSales = salesArray.map(sale => ({
            id: sale.id,
            businessDate: sale.businessDate,
            salesType: sale.salesType,
            customerId: sale.customerId,
            customerName: sale.customerName,
            phoneNumber: sale.phoneNumber,
            shipStreet: sale.shipStreet,
            totalAmount: sale.totalAmount,
            paidAmount: sale.paidAmount,
            status: sale.status,
            remark: sale.remark,
            totalItems: sale.salesItems.length,
            payments: sale.payments || []
        }));

        // Return with pagination metadata and server timestamp
        return {
            data: transformedSales,
            total,
            serverTimestamp: new Date().toISOString()
        };
    }
    catch (error) {
        throw error;
    }
}

let getPartiallyPaidSales = async (databaseName: string, request: SyncRequest) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { outletId, skip = 0, take = 100, lastSyncTimestamp } = request;

    try {
        // Parse last sync timestamp or use a default (e.g., epoch start)
        const lastSync = (lastSyncTimestamp && lastSyncTimestamp !== 'null') ?
            new Date(lastSyncTimestamp) : new Date(0);

        // Ensure outletId is a number
        const parsedOutletId = typeof outletId === 'string' ? parseInt(outletId, 10) : outletId;

        // Build query conditions for partially paid sales
        const where = {
            outletId: parsedOutletId,
            status: "Partially Paid",
            deleted: false,
            OR: [
                { createdAt: { gte: lastSync } },
                { updatedAt: { gte: lastSync } }
            ],
        };

        // Count total records
        const total = await tenantPrisma.sales.count({ where });

        // Fetch paginated items with explicit ordering - newest first
        const partiallyPaidSales = await tenantPrisma.sales.findMany({
            where,
            select: {
                id: true,
                businessDate: true,
                salesType: true,
                customerId: true,
                customerName: true,
                phoneNumber: true,
                shipStreet: true,
                totalAmount: true,
                paidAmount: true,
                status: true,
                remark: true,
                // customer: {
                //     select: {
                //         firstName: true,
                //         lastName: true,
                //     },
                // },
                payments: {
                    select: {
                        method: true
                    }
                },
                salesItems: true
            },
            skip,
            take,
        });

        // Transform the results to include more readable data
        const transformedSales = partiallyPaidSales.map(sale => ({
            id: sale.id,
            businessDate: sale.businessDate,
            salesType: sale.salesType,
            customerId: sale.customerId,
            customerName: sale.customerName,
            phoneNumber: sale.phoneNumber,
            shipStreet: sale.shipStreet,
            totalAmount: sale.totalAmount,
            paidAmount: sale.paidAmount,
            status: sale.status,
            remark: sale.remark,
            totalItems: sale.salesItems.length,
            payments: sale.payments || []
        }));

        // Return with pagination metadata and server timestamp
        return {
            data: transformedSales,
            total,
            serverTimestamp: new Date().toISOString()
        };
    } catch (error) {
        throw error;
    }
}

let getById = async (databaseName: string, id: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const sales = await tenantPrisma.sales.findUnique({
            where: {
                id: id
            },
            include: {
                salesItems: true,
                payments: true,
                registerLogs: true
            }
        })
        if (!sales) {
            throw new NotFoundError("Sales")
        }

        return sales
    }
    catch (error) {
        throw error
    }
}

async function completeNewSales(
    databaseName: string,
    tenantId: number,
    performedBy: { userId: number, username: string },
    salesBody: CreateSalesRequest,
    payments: Payment[]
) {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);

    // Store stock updates outside transaction for notification use
    let stockUpdatesForNotification: any[] = [];

    try {
        const result = await tenantPrisma.$transaction(async (tx) => {
            const itemIds = salesBody.salesItems.map((item) => item.itemId);

            // Batch all initial queries
            const [stockBalances, stockReceipts, customer] = await Promise.all([
                // Get stock balances for validation
                tx.stockBalance.findMany({
                    where: {
                        itemId: { in: itemIds },
                        outletId: salesBody.outletId,
                        deleted: false,
                    },
                    select: {
                        id: true, // Added for direct updates
                        itemId: true,
                        availableQuantity: true,
                        reorderThreshold: true, // For low stock notifications
                        item: {
                            select: {
                                itemName: true,
                                itemCode: true,
                                cost: true, // Fallback cost
                            },
                        },
                    },
                }),

                // Get all stock receipts needed for FIFO in one query
                tx.stockReceipt.findMany({
                    where: {
                        itemId: { in: itemIds },
                        outletId: salesBody.outletId,
                        deleted: false,
                        quantity: { gt: 0 },
                    },
                    select: {
                        id: true,
                        itemId: true,
                        quantity: true,
                        cost: true,
                        receiptDate: true,
                        createdAt: true,
                    },
                    orderBy: [{ receiptDate: 'asc' }, { createdAt: 'asc' }],
                }),

                // Validate customer if provided    
                salesBody.customerId ? tx.customer.findUnique({
                    where: { id: salesBody.customerId },
                    select: { id: true, deleted: true }
                }) : null
            ]);

            // Validate customer
            if (salesBody.customerId && (!customer || customer.deleted)) {
                throw new Error(`Invalid customerId: ${salesBody.customerId}`);
            }

            // Create lookup maps for better performance
            const stockBalanceMap = new Map(stockBalances.map(sb => [sb.itemId, sb]));
            const stockReceiptsByItem = new Map<number, typeof stockReceipts>();
            stockReceipts.forEach(receipt => {
                if (!stockReceiptsByItem.has(receipt.itemId)) {
                    stockReceiptsByItem.set(receipt.itemId, []);
                }
                stockReceiptsByItem.get(receipt.itemId)!.push(receipt);
            });

            // Validate stock availability and calculate FIFO costs in one pass
            const stockValidationErrors: string[] = [];
            const salesItemsWithFIFOCost: Array<typeof salesBody.salesItems[0] & {
                usedReceipts: { id: number; quantityUsed: Decimal; cost: Decimal }[]
            }> = [];

            for (const item of salesBody.salesItems) {
                const stockBalance = stockBalanceMap.get(item.itemId);
                if (!stockBalance) {
                    stockValidationErrors.push(`Stock balance not found for item ${item.itemName || item.itemId}`);
                    continue;
                }

                if (new Decimal(stockBalance.availableQuantity).lt(item.quantity)) {
                    stockValidationErrors.push(
                        `Insufficient stock for ${stockBalance.item.itemName} (${stockBalance.item.itemCode}). ` +
                        `Available: ${stockBalance.availableQuantity}, Required: ${item.quantity}`
                    );
                    continue;
                }

                // Calculate FIFO cost
                const itemReceipts = stockReceiptsByItem.get(item.itemId) || [];
                let remainingQuantity = new Decimal(item.quantity);
                let usedReceipts: { id: number; quantityUsed: Decimal; cost: Decimal }[] = [];

                if (itemReceipts.length === 0) {
                    // Fallback to item cost
                    usedReceipts.push({
                        id: -1,
                        quantityUsed: remainingQuantity,
                        cost: new Decimal(stockBalance.item.cost || 0)
                    });
                } else {
                    // Use FIFO
                    for (const receipt of itemReceipts) {
                        if (remainingQuantity.lte(0)) break;

                        const quantityToUse = Decimal.min(remainingQuantity, new Decimal(receipt.quantity));
                        remainingQuantity = remainingQuantity.minus(quantityToUse);

                        usedReceipts.push({
                            id: receipt.id,
                            quantityUsed: quantityToUse,
                            cost: new Decimal(receipt.cost),
                        });
                    }

                    // If still remaining, use last receipt's cost
                    if (remainingQuantity.gt(0) && itemReceipts.length > 0) {
                        const lastReceipt = itemReceipts[itemReceipts.length - 1];
                        usedReceipts.push({
                            id: -1,
                            quantityUsed: remainingQuantity,
                            cost: new Decimal(lastReceipt.cost),
                        });
                    }
                }

                salesItemsWithFIFOCost.push({ ...item, usedReceipts });
            }

            if (stockValidationErrors.length > 0) {
                throw new BusinessLogicError(`Stock validation failed: ${stockValidationErrors.join('; ')}`);
            }

            // Calculate payments and sales status
            const totalSalesAmount = new Decimal(salesBody.totalAmount);
            const totalPaymentAmount = payments.reduce((sum, payment) => sum.plus(new Decimal(payment.tenderedAmount)), new Decimal(0));
            const salesStatus = totalPaymentAmount.gte(totalSalesAmount) ? 'Completed' : 'Partially Paid';
            const changeAmount = totalPaymentAmount.gte(totalSalesAmount) ? totalPaymentAmount.minus(totalSalesAmount) : new Decimal(0);

            // Calculate total profit and prepare sales item data
            let totalProfit = new Decimal(0);
            const salesItemData: any[] = [];
            const stockReceiptUpdates: { id: number; newQuantity: Decimal }[] = [];

            salesItemsWithFIFOCost.forEach((item) => {
                const totalQuantity = new Decimal(item.quantity);
                const discountPerUnit = (item.discountAmount ? new Decimal(item.discountAmount) : new Decimal(0)).dividedBy(totalQuantity);
                const serviceChargePerUnit = (item.serviceChargeAmount ? new Decimal(item.serviceChargeAmount) : new Decimal(0)).dividedBy(totalQuantity);
                const taxPerUnit = item.taxAmount ? new Decimal(item.taxAmount) : new Decimal(0);

                item.usedReceipts.forEach((receipt) => {
                    const receiptQuantity = new Decimal(receipt.quantityUsed);
                    const receiptCost = new Decimal(receipt.cost);

                    const revenueForQuantity = new Decimal(item.price).times(receiptQuantity);
                    const costForQuantity = receiptCost.times(receiptQuantity);
                    const totalDiscountForQuantity = discountPerUnit.times(receiptQuantity);
                    const totalTaxForQuantity = taxPerUnit.times(receiptQuantity);
                    const totalServiceChargeForQuantity = serviceChargePerUnit.times(receiptQuantity);
                    const totalPriceBeforeTax = new Decimal(item.priceBeforeTax).times(receiptQuantity);
                    const totalSubtotalForQuantity = (new Decimal(item.subtotalAmount).dividedBy(totalQuantity)).times(receiptQuantity);

                    const profit = revenueForQuantity.minus(costForQuantity).minus(totalDiscountForQuantity).minus(totalServiceChargeForQuantity);
                    totalProfit = totalProfit.plus(profit);

                    salesItemData.push({
                        itemId: item.itemId,
                        itemName: item.itemName,
                        itemCode: item.itemCode,
                        itemBrand: item.itemBrand,
                        itemModel: item.itemModel,
                        quantity: receiptQuantity,
                        cost: costForQuantity,
                        price: revenueForQuantity,
                        priceBeforeTax: totalPriceBeforeTax,
                        profit: profit,
                        discountPercentage: item.discountPercentage,
                        discountAmount: totalDiscountForQuantity,
                        serviceChargeAmount: totalServiceChargeForQuantity,
                        taxAmount: totalTaxForQuantity,
                        subtotalAmount: totalSubtotalForQuantity,
                        remark: item.remark || '',
                        deleted: false,
                    });

                    // Prepare stock receipt updates
                    if (receipt.id !== -1) {
                        const existingReceipt = stockReceipts.find(sr => sr.id === receipt.id);
                        if (existingReceipt) {
                            const newQuantity = new Decimal(existingReceipt.quantity).minus(new Decimal(receipt.quantityUsed));
                            stockReceiptUpdates.push({ id: receipt.id, newQuantity });
                        }
                    }
                });
            });

            // Create sales record
            const createdSales = await tx.sales.create({
                data: {
                    outletId: salesBody.outletId,
                    businessDate: salesBody.businessDate,
                    salesType: salesBody.salesType.replace(/\b\w/g, (char) => char.toUpperCase()),
                    customerName: salesBody.customerName || '',
                    customerId: salesBody.customerId || null,
                    phoneNumber: salesBody.phoneNumber || '',
                    billStreet: salesBody.billStreet,
                    billCity: salesBody.billCity,
                    billState: salesBody.billState,
                    billPostalCode: salesBody.billPostalCode,
                    billCountry: salesBody.billCountry,
                    shipStreet: salesBody.shipStreet,
                    shipCity: salesBody.shipCity,
                    shipState: salesBody.shipState,
                    shipPostalCode: salesBody.shipPostalCode,
                    shipCountry: salesBody.shipCountry,
                    totalItemDiscountAmount: salesBody.totalItemDiscountAmount,
                    discountPercentage: salesBody.discountPercentage,
                    discountAmount: salesBody.discountAmount,
                    serviceChargeAmount: salesBody.serviceChargeAmount,
                    taxAmount: salesBody.taxAmount,
                    roundingAmount: salesBody.roundingAmount,
                    subtotalAmount: salesBody.subtotalAmount,
                    totalAmount: salesBody.totalAmount,
                    paidAmount: totalPaymentAmount,
                    changeAmount: changeAmount,
                    status: salesStatus,
                    remark: salesBody.remark,
                    sessionId: salesBody.sessionId,
                    completedSessionId: totalPaymentAmount.gte(totalSalesAmount) ? salesBody.sessionId : null,
                    eodId: salesBody.eodId,
                    salesQuotationId: salesBody.salesQuotationId,
                    performedBy: salesBody.performedBy,
                    deleted: false,
                    profitAmount: totalProfit,
                },
            });

            // Batch create sales items
            await tx.salesItem.createMany({
                data: salesItemData.map(item => ({
                    ...item,
                    salesId: createdSales.id,
                }))
            });

            // Batch create payments
            await tx.payment.createMany({
                data: payments.map(payment => ({
                    ...payment,
                    salesId: createdSales.id,
                }))
            });

            // Batch update stock receipts (parallel execution for performance)
            if (stockReceiptUpdates.length > 0) {
                await Promise.all(
                    stockReceiptUpdates.map((update) =>
                        tx.stockReceipt.update({
                            where: { id: update.id },
                            data: {
                                quantity: update.newQuantity,
                                updatedAt: new Date(),
                                version: { increment: 1 },
                                deleted: update.newQuantity.eq(0) ? true : undefined,
                                deletedAt: update.newQuantity.eq(0) ? new Date() : undefined,
                            },
                        })
                    )
                );
            }

            // Prepare stock balance updates and movements
            const stockUpdates = salesBody.salesItems.map(item => {
                const stockBalance = stockBalanceMap.get(item.itemId)!;
                const newAvailableQuantity = new Decimal(stockBalance.availableQuantity)
                    .minus(new Decimal(item.quantity));

                // Check reorder threshold
                const reorderThreshold = stockBalance.reorderThreshold
                    ? new Decimal(stockBalance.reorderThreshold)
                    : null;

                const needsReorder = reorderThreshold
                    ? newAvailableQuantity.lte(reorderThreshold) &&
                    new Decimal(stockBalance.availableQuantity).gt(reorderThreshold)
                    : false;

                return {
                    stockBalanceId: stockBalance.id, // Use actual stock balance ID
                    outletId: salesBody.outletId,
                    itemId: item.itemId,
                    itemName: stockBalance.item.itemName,
                    itemCode: stockBalance.item.itemCode,
                    quantity: new Decimal(item.quantity),
                    previousAvailable: new Decimal(stockBalance.availableQuantity),
                    previousOnHand: new Decimal(stockBalance.availableQuantity), // Assuming same as available
                    newAvailableQuantity: newAvailableQuantity,
                    reorderThreshold: reorderThreshold?.toNumber(),
                    willBeOutOfStock: newAvailableQuantity.eq(0),
                    needsReorder: needsReorder,
                };
            });

            // Store for notifications outside transaction
            stockUpdatesForNotification = stockUpdates;

            // Batch update stock balances and create movements (optimized - no redundant queries)
            await Promise.all([
                // Update stock balances directly using stored IDs
                ...stockUpdates.map((update) =>
                    tx.stockBalance.update({
                        where: { id: update.stockBalanceId },
                        data: {
                            availableQuantity: { decrement: update.quantity.toNumber() },
                            onHandQuantity: { decrement: update.quantity.toNumber() },
                            version: { increment: 1 },
                            updatedAt: new Date(),
                        },
                    })
                ),

                // Batch create stock movements
                tx.stockMovement.createMany({
                    data: stockUpdates.map(update => ({
                        itemId: update.itemId,
                        outletId: update.outletId,
                        previousAvailableQuantity: update.previousAvailable.toNumber(),
                        previousOnHandQuantity: update.previousOnHand.toNumber(),
                        availableQuantityDelta: -update.quantity.toNumber(),
                        onHandQuantityDelta: -update.quantity.toNumber(),
                        movementType: 'Sales',
                        documentId: createdSales.id,
                        reason: 'Sales transaction',
                        remark: `Sales #${createdSales.id}`,
                    }))
                })
            ]);

            return createdSales;
        });

        // Prepare all notifications
        const outOfStockItems = stockUpdatesForNotification.filter((u: any) => u.willBeOutOfStock);
        const lowStockItems = stockUpdatesForNotification.filter((u: any) => u.needsReorder && !u.willBeOutOfStock);

        // Send all notifications in parallel (fire-and-forget, don't block response)
        Promise.all([
            // Sales notification
            sendSalesNotification(
                tenantId,
                salesBody.outletId,
                'New Sale Completed',
                `Sale #${result.id} - IDR ${new Decimal(result.totalAmount).toFixed(0)}`,
                {
                    type: 'sale_completed',
                    salesId: result.id,
                    amount: new Decimal(result.totalAmount).toNumber(),
                    customerName: result.customerName || 'Walk-in Customer',
                    status: result.status,
                    itemCount: salesBody.salesItems.length,
                    outletId: salesBody.outletId,
                    triggeringUserId: performedBy.userId,
                    triggeringUsername: performedBy.username,
                    timestamp: new Date().toISOString()
                }
            ),

            // Out-of-stock notification (if needed)
            ...(outOfStockItems.length > 0 ? [
                sendInventoryNotification(
                    tenantId,
                    salesBody.outletId,
                    outOfStockItems.length === 1
                        ? 'Out of Stock Alert'
                        : `${outOfStockItems.length} Items Out of Stock`,
                    outOfStockItems.length === 1
                        ? `${outOfStockItems[0].itemName} is now out of stock`
                        : outOfStockItems.length <= 3
                            ? outOfStockItems.map((i: any) => i.itemName).join(', ')
                            : `${outOfStockItems.slice(0, 2).map((i: any) => i.itemName).join(', ')} and ${outOfStockItems.length - 2} more`,
                    {
                        type: 'out_of_stock',
                        priority: 'high',
                        count: outOfStockItems.length,
                        items: outOfStockItems.map((item: any) => ({
                            itemId: item.itemId,
                            itemName: item.itemName,
                            itemCode: item.itemCode,
                            previousStock: item.previousAvailable.toNumber(),
                            currentStock: 0,
                            soldQuantity: item.quantity.toNumber()
                        })),
                        outletId: salesBody.outletId,
                        salesId: result.id,
                        triggeringUserId: performedBy.userId,
                        triggeringUsername: performedBy.username,
                        timestamp: new Date().toISOString()
                    }
                )
            ] : []),

            // Low-stock notification (if needed)
            ...(lowStockItems.length > 0 ? [
                sendInventoryNotification(
                    tenantId,
                    salesBody.outletId,
                    lowStockItems.length === 1
                        ? 'Low Stock Warning'
                        : `${lowStockItems.length} Items Low on Stock`,
                    lowStockItems.length === 1
                        ? `${lowStockItems[0].itemName} is running low (${lowStockItems[0].newAvailableQuantity.toFixed(0)} left)`
                        : lowStockItems.length <= 3
                            ? lowStockItems.map((i: any) => i.itemName).join(', ')
                            : `${lowStockItems.slice(0, 2).map((i: any) => i.itemName).join(', ')} and ${lowStockItems.length - 2} more`,
                    {
                        type: 'low_stock',
                        priority: 'normal',
                        count: lowStockItems.length,
                        items: lowStockItems.map((item: any) => ({
                            itemId: item.itemId,
                            itemName: item.itemName,
                            itemCode: item.itemCode,
                            previousStock: item.previousAvailable.toNumber(),
                            currentStock: item.newAvailableQuantity.toNumber(),
                            reorderThreshold: item.reorderThreshold,
                            soldQuantity: item.quantity.toNumber()
                        })),
                        outletId: salesBody.outletId,
                        salesId: result.id,
                        triggeringUserId: performedBy.userId,
                        triggeringUsername: performedBy.username,
                        timestamp: new Date().toISOString()
                    }
                )
            ] : [])
        ]).catch(error => {
            // Log notification errors but don't fail the response
            console.error('Failed to send notifications:', error);
        });

        return getById(databaseName, result.id);
    } catch (error) {
        throw error;
    }
}

let calculateSales = async (databaseName: string, salesRequestBody: CalculateSalesDto) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        let sales = await performSalesCalculation(salesRequestBody.sales)
        let salesResponse: CalculateSalesDto = {
            sales: sales
        }
        return salesResponse

    }
    catch (error) {
        throw error
    }
}

let performSalesCalculation = async (sales: CalculateSalesObject) => {
    try {
        let items = sales.salesItems
        var subtotal = new Decimal(0);
        var totalItemDiscountAmount = new Decimal(0);

        items.forEach(function (item) {
            item.subtotalAmount = new Decimal(item.price).times(new Decimal(item.quantity));
            item = calculateItemDiscount(item);
            item.subtotalAmount = item.subtotalAmount.minus(item.discountAmount);
            totalItemDiscountAmount = totalItemDiscountAmount.plus(item.discountAmount);
            subtotal = subtotal.plus(item.subtotalAmount);
        })

        sales.totalItemDiscountAmount = totalItemDiscountAmount;
        sales.subtotalAmount = subtotal;
        sales = calculateSalesDiscount(sales);
        sales.taxAmount = new Decimal(0);
        sales.serviceChargeAmount = new Decimal(0);
        sales.roundingAmount = new Decimal(0);
        sales.totalAmount = sales.subtotalAmount.plus(sales.taxAmount).plus(sales.serviceChargeAmount).plus(sales.roundingAmount).minus(sales.discountAmount);

        return sales;
    }
    catch (error) {
        throw error
    }
}

let calculateItemDiscount = (item: CalculateSalesItemObject) => {
    switch (item.discountType) {
        case DiscountType.Manual:
            let subtotalBeforeDiscount = new Decimal(item.subtotalAmount)
            switch (item.discountBy) {
                case DiscountBy.Amount:
                    let discountPercentage = (new Decimal(item.discountAmount).times(100)).dividedBy(subtotalBeforeDiscount);
                    if (discountPercentage.gt(100)) {
                        item.discountPercentage = new Decimal(100);
                        item.discountAmount = subtotalBeforeDiscount;
                    }
                    else {
                        item.discountPercentage = discountPercentage;
                        item.discountAmount = new Decimal(item.discountAmount);
                    }
                    break
                case DiscountBy.Percentage:
                    item.discountAmount = subtotalBeforeDiscount.times(new Decimal(item.discountPercentage).dividedBy(100));
                    item.discountPercentage = new Decimal(item.discountPercentage);
                    break
                default:
                    item.discountAmount = new Decimal(0);
                    item.discountPercentage = new Decimal(0);
                    break
            }
            break
        default:
            // Ensure discountAmount and discountPercentage are Decimal for non-manual discount types
            item.discountAmount = new Decimal(item.discountAmount || 0);
            item.discountPercentage = new Decimal(item.discountPercentage || 0);
            break
    }
    return item
}

let calculateSalesDiscount = (sales: CalculateSalesObject) => {
    switch (sales.discountBy) {
        case DiscountBy.Amount:
            let discountPercentage = (new Decimal(sales.discountAmount).times(100)).dividedBy(new Decimal(sales.subtotalAmount));
            if (discountPercentage.gt(100)) {
                sales.discountPercentage = new Decimal(100);
                sales.discountAmount = new Decimal(sales.subtotalAmount);
            }
            else {
                sales.discountPercentage = discountPercentage;
                sales.discountAmount = new Decimal(sales.discountAmount);
            }
            break
        case DiscountBy.Percentage:
            sales.discountAmount = new Decimal(sales.subtotalAmount).times(new Decimal(sales.discountPercentage).dividedBy(100));
            sales.discountPercentage = new Decimal(sales.discountPercentage);
            break
        default:
            sales.discountAmount = new Decimal(0);
            sales.discountPercentage = new Decimal(0);
            break
    }
    return sales
}

let update = async (databaseName: string, salesRequest: SalesRequestBody) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        await tenantPrisma.$transaction(async (tx) => {
            //separate sales & salesitem to perform update to different tables
            let { items, ...sales } = salesRequest.sales
            items.forEach(async function (salesItem) {
                await tx.salesItem.update({
                    where: {
                        id: salesItem.id
                    },
                    data: salesItem
                })
            })
            await tx.sales.update({
                where: {
                    id: sales.id
                },
                data: sales
            })
        })
    }
    catch (error) {
        throw error
    }
}

let remove = async (databaseName: string, id: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        await tenantPrisma.$transaction(async (tx) => {
            await tx.sales.update({
                where: {
                    id: id
                },
                data: {
                    deleted: true
                }
            })
            await tx.salesItem.updateMany({
                where: {
                    salesId: id
                },
                data: {
                    deleted: true
                }
            })
        })
    }
    catch (error) {
        throw error
    }
}

let getTotalSalesData = async (databaseName: string, sessionID: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // Run all queries concurrently for better performance
        const [
            activeSales,
            voidedSales,
            returnedSales,
            refundedSales,
            completedSales,
            partiallyPaidSales
        ] = await Promise.all([
            // Active sales (Completed + Partially Paid)
            tenantPrisma.sales.aggregate({
                where: {
                    sessionId: sessionID,
                    deleted: false,
                    status: {
                        in: ["Completed", "Partially Paid"]
                    }
                },
                _count: { id: true },
                _sum: {
                    totalAmount: true,
                    paidAmount: true,
                    profitAmount: true,
                    changeAmount: true
                }
            }),

            // Voided sales
            tenantPrisma.sales.count({
                where: {
                    sessionId: sessionID,
                    status: "Voided",
                    deleted: false
                }
            }),

            // Returned sales
            tenantPrisma.sales.count({
                where: {
                    sessionId: sessionID,
                    status: "Returned",
                    deleted: false
                }
            }),

            // Refunded sales
            tenantPrisma.sales.count({
                where: {
                    sessionId: sessionID,
                    status: "Refunded",
                    deleted: false
                }
            }),

            // Completed sales
            tenantPrisma.sales.count({
                where: {
                    sessionId: sessionID,
                    status: "Completed",
                    deleted: false
                }
            }),

            // Partially paid sales
            tenantPrisma.sales.aggregate({
                where: {
                    sessionId: sessionID,
                    status: "Partially Paid",
                    deleted: false
                },
                _count: { id: true },
                _sum: {
                    totalAmount: true,
                    paidAmount: true
                }
            })
        ]);

        // Calculate derived metrics using Decimal arithmetic
        const netRevenue = (activeSales._sum?.totalAmount || new Decimal(0));
        const netProfit = (activeSales._sum?.profitAmount || new Decimal(0));

        const totalTransactions = (activeSales._count?.id || 0) + voidedSales +
            returnedSales + refundedSales;

        const averageTransactionValue = activeSales._count.id > 0 ?
            netRevenue.dividedBy(activeSales._count.id) : new Decimal(0);

        const outstandingAmount = (partiallyPaidSales._sum?.totalAmount || new Decimal(0)).minus(
            partiallyPaidSales._sum?.paidAmount || new Decimal(0));

        return {
            // Summary metrics
            salesCount: activeSales._count?.id || 0,
            totalRevenue: netRevenue,
            totalProfit: netProfit,

            // Enhanced metrics
            averageTransactionValue: Math.round(averageTransactionValue.toNumber() * 100) / 100,
            totalPaidAmount: activeSales._sum?.paidAmount || new Decimal(0),
            totalChangeGiven: activeSales._sum?.changeAmount || new Decimal(0),
            outstandingAmount: outstandingAmount,

            // Transaction counts by status
            transactionCounts: {
                total: totalTransactions,
                completed: completedSales,
                partiallyPaid: partiallyPaidSales._count?.id || 0,
                voided: voidedSales,
                returned: returnedSales,
                refunded: refundedSales,
                // active: activeSales._count?.id || 0
            },
        };
    }
    catch (error) {
        throw error
    }
}

let addPaymentToPartiallyPaidSales = async (
    databaseName: string,
    tenantId: number,
    performedBy: { userId: number, username: string },
    salesId: number,
    payments: Payment[]
) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const result = await tenantPrisma.$transaction(async (tx) => {
            // Get the sales record
            const sales = await tx.sales.findUnique({
                where: {
                    id: salesId
                }
            });
            if (!sales) {
                throw new NotFoundError("Sales");
            }
            if (sales.status !== "Partially Paid") {
                throw new BusinessLogicError("Only partially paid sales can receive additional payments");
            }
            // Calculate the remaining amount to be paid
            const remainingAmount = new Decimal(sales.totalAmount).minus(new Decimal(sales.paidAmount));
            if (remainingAmount.lte(0)) {
                throw new BusinessLogicError("This sales record is already fully paid");
            }

            // Calculate total of new payments
            const totalNewPaymentAmount = payments.reduce((sum, payment) => sum.plus(new Decimal(payment.tenderedAmount)), new Decimal(0));
            if (totalNewPaymentAmount.lte(0)) {
                throw new BusinessLogicError("Total payment amount must be greater than zero");
            }

            // Update payments with salesId
            const paymentsWithSalesId = payments.map(payment => ({
                ...payment,
                salesId: salesId
            }));
            // Create the payment records
            await tx.payment.createMany({
                data: paymentsWithSalesId
            });
            // Update the sales record
            const updatedPaidAmount = new Decimal(sales.paidAmount).plus(totalNewPaymentAmount);
            const isFullyPaid = updatedPaidAmount.gte(new Decimal(sales.totalAmount));

            // Calculate change amount if payment exceeds the remaining amount
            const changeAmount = isFullyPaid ?
                updatedPaidAmount.minus(new Decimal(sales.totalAmount)) :
                new Decimal(0); // No change if still partially paid

            // Update sales status and payment details
            const updatedSales = await tx.sales.update({
                where: {
                    id: salesId
                },
                data: {
                    paidAmount: updatedPaidAmount,
                    changeAmount: changeAmount,
                    status: isFullyPaid ? "Completed" : "Partially Paid"
                }
            });

            return { updatedSales, totalNewPaymentAmount, remainingAmount };
        });

        // Send notification after successful transaction
        const statusMessage = result.updatedSales.status === 'Completed' ? 'Debt Sales Payment Completed' : 'Payment Added';
        await sendSalesNotification(
            tenantId,
            result.updatedSales.outletId,
            statusMessage,
            `Sales #${result.updatedSales.id} - Payment IDR ${result.totalNewPaymentAmount.toFixed(0)}`,
            {
                type: result.updatedSales.status === 'Completed' ? 'payment_completed' : 'payment_added',
                salesId: result.updatedSales.id,
                paymentAmount: result.totalNewPaymentAmount.toNumber(),
                remainingAmount: result.remainingAmount.toNumber(),
                newStatus: result.updatedSales.status,
                outletId: result.updatedSales.outletId,
                triggeringUserId: performedBy.userId,
                triggeringUsername: performedBy.username,
                timestamp: new Date().toISOString()
            }
        );

        // Return the complete updated sales record with all relationships
        return getById(databaseName, salesId);
    }
    catch (error) {
        throw error;
    }
}

let voidSales = async (
    databaseName: string,
    tenantId: number,
    performedBy: { userId: number, username: string },
    salesId: number
) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const result = await tenantPrisma.$transaction(async (tx) => {
            // Get the sales record
            const sales = await tx.sales.findUnique({
                where: {
                    id: salesId,
                    deleted: false
                },
                include: {
                    salesItems: true,
                    payments: true
                }
            });
            if (!sales) {
                throw new NotFoundError("Sales");
            }
            if (sales.status === "Delivered") {
                throw new BusinessLogicError("Cannot void a delivered sale");
            }
            if (sales.status !== "Completed") {
                throw new BusinessLogicError("Only completed sales can be voided");
            }

            // Update sales status to voided
            const updatedSales = await tx.sales.update({
                where: {
                    id: salesId
                },
                data: {
                    status: "Voided"
                }
            });

            // Update payment status to voided
            await tx.payment.updateMany({
                where: {
                    salesId: salesId
                },
                data: {
                    status: "Voided"
                }
            });

            // Restore stock for each sales item
            await Promise.all(
                sales.salesItems.map(async (salesItem) => {
                    // Update Stock Balance - add back the quantities
                    const stockBalance = await tx.stockBalance.findFirst({
                        where: {
                            itemId: salesItem.itemId,
                            outletId: sales.outletId,
                            deleted: false,
                        },
                    });

                    if (stockBalance) {
                        await tx.stockBalance.update({
                            where: {
                                id: stockBalance.id,
                            },
                            data: {
                                availableQuantity: {
                                    increment: salesItem.quantity,
                                },
                                onHandQuantity: {
                                    increment: salesItem.quantity,
                                },
                            },
                        });
                        // Create Stock Movement record for the void
                        await tx.stockMovement.create({
                            data: {
                                itemId: salesItem.itemId,
                                outletId: sales.outletId,
                                previousAvailableQuantity: stockBalance.availableQuantity.toNumber(),
                                previousOnHandQuantity: stockBalance.onHandQuantity.toNumber(),
                                availableQuantityDelta: salesItem.quantity.toNumber(),
                                onHandQuantityDelta: salesItem.quantity.toNumber(),
                                movementType: 'Sales Void',
                                documentId: salesId,
                                reason: '',
                                remark: `Sales #${salesId} voided`,
                            },
                        });
                    }
                })
            );
            return updatedSales;
        });

        // Send notification after successful void
        await sendSalesNotification(
            tenantId,
            result.outletId,
            'Sale Voided',
            `Sale #${result.id} - IDR ${new Decimal(result.totalAmount).toFixed(0)} has been voided`,
            {
                type: 'sale_voided',
                salesId: result.id,
                amount: new Decimal(result.totalAmount).toNumber(),
                customerName: result.customerName || 'Walk-in Customer',
                previousStatus: 'Completed',
                outletId: result.outletId,
                triggeringUserId: performedBy.userId,
                triggeringUsername: performedBy.username,
                timestamp: new Date().toISOString()
            }
        );

        return getById(databaseName, salesId);
    }
    catch (error) {
        throw error;
    }
}

let returnSales = async (
    databaseName: string,
    tenantId: number,
    performedBy: { userId: number, username: string },
    salesId: number
) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const result = await tenantPrisma.$transaction(async (tx) => {
            // Get the sales record
            const sales = await tx.sales.findUnique({
                where: {
                    id: salesId,
                    deleted: false
                },
                include: {
                    salesItems: true,
                    payments: true
                }
            });
            if (!sales) {
                throw new NotFoundError("Sales");
            }
            if (sales.status === "Delivered") {
                throw new BusinessLogicError("Cannot return a delivered sale. Please contact support.");
            }
            if (sales.status !== "Completed") {
                throw new BusinessLogicError("Only completed sales can be returned");
            }

            // Update sales status to returned
            const updatedSales = await tx.sales.update({
                where: {
                    id: salesId
                },
                data: {
                    status: "Returned"
                }
            });

            // Update payment status to returned
            await tx.payment.updateMany({
                where: {
                    salesId: salesId
                },
                data: {
                    status: "Returned"
                }
            });

            // Restore stock for each sales item
            await Promise.all(
                sales.salesItems.map(async (salesItem) => {
                    // Update Stock Balance - add back the quantities
                    const stockBalance = await tx.stockBalance.findFirst({
                        where: {
                            itemId: salesItem.itemId,
                            outletId: sales.outletId,
                            deleted: false,
                        },
                    });

                    if (stockBalance) {
                        await tx.stockBalance.update({
                            where: {
                                id: stockBalance.id,
                            },
                            data: {
                                availableQuantity: {
                                    increment: salesItem.quantity,
                                },
                                onHandQuantity: {
                                    increment: salesItem.quantity,
                                },
                            },
                        });

                        // Create Stock Movement record for the return
                        await tx.stockMovement.create({
                            data: {
                                itemId: salesItem.itemId,
                                outletId: sales.outletId,
                                previousAvailableQuantity: stockBalance.availableQuantity,
                                previousOnHandQuantity: stockBalance.onHandQuantity,
                                availableQuantityDelta: salesItem.quantity,
                                onHandQuantityDelta: salesItem.quantity,
                                movementType: 'Sales Return',
                                documentId: salesId,
                                reason: '',
                                remark: `Sales #${salesId} returned`,
                            },
                        });
                    }
                })
            );
            return updatedSales;
        });

        // Send notification after successful return
        await sendSalesNotification(
            tenantId,
            result.outletId,
            'Sale Returned',
            `Sale #${result.id} - IDR ${new Decimal(result.totalAmount).toFixed(0)} has been returned`,
            {
                type: 'sale_returned',
                salesId: result.id,
                amount: new Decimal(result.totalAmount).toNumber(),
                customerName: result.customerName || 'Walk-in Customer',
                previousStatus: 'Completed',
                outletId: result.outletId,
                triggeringUserId: performedBy.userId,
                triggeringUsername: performedBy.username,
                timestamp: new Date().toISOString()
            }
        );

        return getById(databaseName, salesId);
    }
    catch (error) {
        throw error;
    }
}

let refundSales = async (
    databaseName: string,
    tenantId: number,
    performedBy: { userId: number, username: string },
    salesId: number
) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const result = await tenantPrisma.$transaction(async (tx) => {
            // Get the sales record
            const sales = await tx.sales.findUnique({
                where: {
                    id: salesId,
                    deleted: false
                },
                include: {
                    salesItems: true,
                    payments: true
                }
            });
            if (!sales) {
                throw new NotFoundError("Sales");
            }
            if (sales.status === "Delivered") {
                throw new BusinessLogicError("Cannot refund a delivered sale. Please contact support.");
            }
            if (sales.status !== "Completed") {
                throw new BusinessLogicError("Only completed sales can be refunded");
            }

            // Update sales status to refunded
            const updatedSales = await tx.sales.update({
                where: {
                    id: salesId
                },
                data: {
                    status: "Refunded"
                }
            });

            // Update payment status to refunded
            await tx.payment.updateMany({
                where: {
                    salesId: salesId
                },
                data: {
                    status: "Refunded"
                }
            });

            // Restore stock for each sales item
            await Promise.all(
                sales.salesItems.map(async (salesItem) => {
                    // Update Stock Balance - add back the quantities
                    const stockBalance = await tx.stockBalance.findFirst({
                        where: {
                            itemId: salesItem.itemId,
                            outletId: sales.outletId,
                            deleted: false,
                        },
                    });
                    if (stockBalance) {
                        await tx.stockBalance.update({
                            where: {
                                id: stockBalance.id,
                            },
                            data: {
                                availableQuantity: {
                                    increment: salesItem.quantity,
                                },
                                onHandQuantity: {
                                    increment: salesItem.quantity,
                                },
                            },
                        });

                        // Create Stock Movement record for the refund
                        await tx.stockMovement.create({
                            data: {
                                itemId: salesItem.itemId,
                                outletId: sales.outletId,
                                previousAvailableQuantity: stockBalance.availableQuantity,
                                previousOnHandQuantity: stockBalance.onHandQuantity,
                                availableQuantityDelta: salesItem.quantity,
                                onHandQuantityDelta: salesItem.quantity,
                                movementType: 'Sales Refund',
                                documentId: salesId,
                                reason: '',
                                remark: `Sales #${salesId} refunded`,
                            },
                        });
                    }
                })
            );
            return updatedSales;
        });

        // Send notification after successful refund
        await sendSalesNotification(
            tenantId,
            result.outletId,
            'Sale Refunded',
            `Sale #${result.id} - IDR ${new Decimal(result.totalAmount).toFixed(0)} has been refunded`,
            {
                type: 'sale_refunded',
                salesId: result.id,
                amount: new Decimal(result.totalAmount).toNumber(),
                customerName: result.customerName || 'Walk-in Customer',
                previousStatus: 'Completed',
                outletId: result.outletId,
                triggeringUserId: performedBy.userId,
                triggeringUsername: performedBy.username,
                timestamp: new Date().toISOString()
            }
        );

        return getById(databaseName, salesId);
    }
    catch (error) {
        throw error;
    }
}

let getDeliveryList = async (
    databaseName: string,
    outletId: number,
    businessDateFrom?: Date,
    businessDateTo?: Date,
    customerId?: number
) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const where: any = {
            outletId: outletId,
            salesType: 'DELIVERY',
            status: {
                in: ['Completed', 'Partially Paid']
            },
            deliveredAt: null,
            deleted: false,
        };

        if (businessDateFrom) {
            where.businessDate = { gte: businessDateFrom };
        }
        if (businessDateTo) {
            where.businessDate = { ...where.businessDate, lte: businessDateTo };
        }
        if (customerId) {
            where.customerId = customerId;
        }

        const deliveryList = await tenantPrisma.sales.findMany({
            where,
            select: {
                id: true,
                businessDate: true,
                customerName: true,
                phoneNumber: true,
                shipStreet: true,
                shipCity: true,
                shipState: true,
                shipPostalCode: true,
                shipCountry: true,
                totalAmount: true,
                paidAmount: true,
                status: true,
                remark: true,
                createdAt: true,
                salesItems: {
                    select: {
                        itemName: true,
                        itemCode: true,
                        quantity: true,
                        price: true,
                        subtotalAmount: true,
                    },
                    where: {
                        deleted: false
                    }
                }
            },
            orderBy: {
                businessDate: 'asc'
            }
        });

        return deliveryList;
    } catch (error) {
        throw error;
    }
}

let confirmDeliveryBatch = async (
    databaseName: string,
    tenantId: number,
    performedBy: { userId: number, username: string },
    salesIds: number[],
    deliveryNotes?: string,
    deliveredAt?: Date
) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);

    try {
        const result = await tenantPrisma.$transaction(async (tx) => {
            // Validate all sales exist and are eligible for delivery
            const sales = await tx.sales.findMany({
                where: {
                    id: { in: salesIds },
                    deleted: false
                }
            });

            if (sales.length !== salesIds.length) {
                throw new NotFoundError('One or more sales records not found');
            }

            // Validate each sale
            const validationErrors: string[] = [];
            sales.forEach(sale => {
                if (sale.salesType !== 'DELIVERY') {
                    validationErrors.push(`Sales #${sale.id} is not a delivery sale`);
                }
                if (!['Completed', 'Partially Paid'].includes(sale.status)) {
                    validationErrors.push(
                        `Sales #${sale.id} has invalid status: ${sale.status}. Only Completed or Partially Paid sales can be delivered.`
                    );
                }
                if (sale.deliveredAt !== null) {
                    validationErrors.push(`Sales #${sale.id} has already been delivered`);
                }
            });

            if (validationErrors.length > 0) {
                throw new BusinessLogicError(validationErrors.join('; '));
            }

            // Update all sales to Delivered status
            await tx.sales.updateMany({
                where: {
                    id: { in: salesIds }
                },
                data: {
                    status: 'Delivered',
                    deliveredAt: deliveredAt || new Date(),
                    deliveredBy: performedBy.username,
                    deliveryNotes: deliveryNotes || '',
                    updatedAt: new Date()
                }
            });

            return sales;
        });

        // Send delivery notification
        const outletId = result[0]?.outletId;
        if (outletId) {
            try {
                await PushyService.sendToTopic(
                    `/topics/tenant_${tenantId}_outlet_${outletId}_delivery`,
                    {
                        title: 'Deliveries Confirmed',
                        message: `${salesIds.length} delivery order(s) have been delivered`,
                        data: {
                            type: 'delivery_confirmed',
                            salesIds: salesIds,
                            deliveredBy: performedBy.username,
                            deliveredAt: deliveredAt || new Date(),
                            count: salesIds.length,
                            outletId: outletId,
                            triggeringUserId: performedBy.userId,
                            triggeringUsername: performedBy.username,
                            timestamp: new Date().toISOString()
                        }
                    },
                    tenantId
                );
            } catch (error) {
                console.error('Failed to send delivery notification:', error);
            }
        }

        return {
            successCount: salesIds.length,
            deliveredSalesIds: salesIds,
            deliveredAt: deliveredAt || new Date()
        };
    } catch (error) {
        throw error;
    }
}

export = {
    getAll,
    getByDateRange,
    getById,
    calculateSales,
    completeNewSales,
    update,
    remove,
    getTotalSalesData,
    getPartiallyPaidSales,
    addPaymentToPartiallyPaidSales,
    voidSales,
    returnSales,
    refundSales,
    getDeliveryList,
    confirmDeliveryBatch
}