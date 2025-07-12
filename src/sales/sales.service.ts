import { Payment, Prisma, PrismaClient, Sales, SalesItem, StockBalance, StockMovement } from "@prisma/client"
import { BusinessLogicError, NotFoundError } from "../api-helpers/error"
import { SalesRequestBody, SalesCreationRequest, CreateSalesRequest, CalculateSalesObject, CalculateSalesItemObject, DiscountBy, DiscountType, CalculateSalesDto } from "./sales.request"
import { getTenantPrisma } from '../db';
import { SyncRequest } from "src/item/item.request";

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
                totalAmount: true,
                paidAmount: true,
                status: true,
                remark: true,
                shipStreet: true,
                customer: {
                    select: {
                        firstName: true,
                        lastName: true,
                    },
                },
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
                shipStreet: true,
                totalAmount: true,
                paidAmount: true,
                status: true,
                remark: true,
                customer: {
                    select: {
                        firstName: true,
                        lastName: true,
                    },
                },
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
                shipStreet: true,
                totalAmount: true,
                paidAmount: true,
                status: true,
                remark: true,
                customer: {
                    select: {
                        firstName: true,
                        lastName: true,
                    },
                },
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

let create = async (databaseName: string, salesBody: SalesCreationRequest) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const createdSales = await tenantPrisma.$transaction(async (tx) => {
            //calculate profit amount
            let updatedSales = performProfitCalculation(salesBody.sales)

            //separate sales & salesitem to perform update to different tables
            const sales = await tx.sales.create({
                data: {
                    outletId: updatedSales.outletId,
                    businessDate: updatedSales.businessDate,
                    salesType: updatedSales.salesType,
                    customerId: updatedSales.customerId,
                    billStreet: updatedSales.billStreet,
                    billCity: updatedSales.billCity,
                    billState: updatedSales.billState,
                    billPostalCode: updatedSales.billPostalCode,
                    billCountry: updatedSales.billCountry,
                    shipStreet: updatedSales.shipStreet,
                    shipCity: updatedSales.shipCity,
                    shipState: updatedSales.shipState,
                    shipPostalCode: updatedSales.shipPostalCode,
                    shipCountry: updatedSales.shipCountry,
                    totalItemDiscountAmount: updatedSales.totalItemDiscountAmount,
                    discountPercentage: updatedSales.discountPercentage,
                    discountAmount: updatedSales.discountAmount,
                    profitAmount: updatedSales.profitAmount,
                    serviceChargeAmount: updatedSales.serviceChargeAmount,
                    taxAmount: updatedSales.taxAmount,
                    roundingAmount: updatedSales.roundingAmount,
                    subtotalAmount: updatedSales.subtotalAmount,
                    totalAmount: updatedSales.totalAmount,
                    paidAmount: updatedSales.paidAmount,
                    changeAmount: updatedSales.changeAmount,
                    status: updatedSales.status,
                    remark: updatedSales.remark,
                    sessionId: updatedSales.sessionId,
                    eodId: updatedSales.eodId,
                    salesQuotationId: updatedSales.salesQuotationId,
                    performedBy: updatedSales.performedBy,
                    deleted: updatedSales.deleted,
                }
            })

            await Promise.all(updatedSales.salesItems.map(async (salesItem) => {
                return tx.salesItem.create({
                    data: {
                        salesId: sales.id,
                        itemId: salesItem.itemId,
                        itemName: salesItem.itemName,
                        itemCode: salesItem.itemCode,
                        itemBrand: salesItem.itemBrand,
                        quantity: salesItem.quantity,
                        cost: salesItem.cost,
                        price: salesItem.price,
                        profit: salesItem.profit,
                        discountPercentage: salesItem.discountPercentage,
                        discountAmount: salesItem.discountAmount,
                        serviceChargeAmount: salesItem.serviceChargeAmount,
                        taxAmount: salesItem.taxAmount,
                        subtotalAmount: salesItem.subtotalAmount,
                        remark: salesItem.remark,
                        deleted: salesItem.deleted
                    }
                })
            }))

            return sales
        })

        return getById(databaseName, createdSales.id)
    }
    catch (error) {
        throw error
    }
}

async function getFIFOCostForSalesItem(
    tenantPrisma: Prisma.TransactionClient,
    itemId: number,
    outletId: number,
    quantity: number
): Promise<{ usedReceipts: { id: number; quantityUsed: number; cost: number }[] }> {
    try {
        // Get stock receipts ordered by FIFO (oldest first)
        const stockReceipts = await tenantPrisma.stockReceipt.findMany({
            where: {
                itemId: itemId,
                outletId: outletId,
                deleted: false,
                quantity: { gt: 0 },
            },
            orderBy: [{ receiptDate: 'asc' }, { createdAt: 'asc' }],
        });

        if (stockReceipts.length === 0) {
            // Fallback to item cost if no stock receipts found
            const item = await tenantPrisma.item.findUnique({
                where: { id: itemId },
            });
            return {
                usedReceipts: [{ id: -1, quantityUsed: quantity, cost: item?.cost || 0 }],
            };
        }

        let remainingQuantity = quantity;
        let usedReceipts: { id: number; quantityUsed: number; cost: number }[] = [];

        // Use FIFO to assign quantities and costs from stock receipts
        for (const receipt of stockReceipts) {
            if (remainingQuantity <= 0) break;

            const quantityToUse = Math.min(remainingQuantity, receipt.quantity);
            remainingQuantity -= quantityToUse;

            usedReceipts.push({
                id: receipt.id,
                quantityUsed: quantityToUse,
                cost: receipt.cost,
            });
        }

        // If remaining quantity exists, use the last receipt's cost
        if (remainingQuantity > 0 && stockReceipts.length > 0) {
            const lastReceipt = stockReceipts[stockReceipts.length - 1];
            usedReceipts.push({
                id: -1,
                quantityUsed: remainingQuantity,
                cost: lastReceipt.cost,
            });
        }

        if (remainingQuantity > 0 && usedReceipts.length === 0) {
            throw new Error(`Insufficient stock receipts for item ${itemId}`);
        }
        return { usedReceipts };
    } catch (error) {
        throw error;
    }
}

async function updateStockReceiptsAfterSale(
    tenantPrisma: Prisma.TransactionClient,
    usedReceipts: { id: number; quantityUsed: number; cost: number }[]
) {
    try {
        // Update stock receipt quantities based on FIFO usage
        await Promise.all(
            usedReceipts
                .filter((usage) => usage.id !== -1) // Skip fallback receipts
                .map(async (usage) => {
                    const receipt = await tenantPrisma.stockReceipt.findUnique({
                        where: { id: usage.id },
                    });
                    if (!receipt) {
                        throw new Error(`StockReceipt with id ${usage.id} not found`);
                    }
                    const newQuantity = receipt.quantity - usage.quantityUsed;
                    await tenantPrisma.stockReceipt.update({
                        where: { id: usage.id },
                        data: {
                            quantity: newQuantity,
                            updatedAt: new Date(),
                            version: { increment: 1 },
                            deleted: newQuantity === 0 ? true : undefined,
                            deletedAt: newQuantity === 0 ? new Date() : undefined,
                        },
                    });
                })
        );
    } catch (error) {
        throw error;
    }
}

async function completeNewSales(databaseName: string, salesBody: CreateSalesRequest, payments: Payment[]) {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
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
                        itemId: true,
                        availableQuantity: true,
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
                usedReceipts: { id: number; quantityUsed: number; cost: number }[]
            }> = [];

            for (const item of salesBody.salesItems) {
                const stockBalance = stockBalanceMap.get(item.itemId);
                if (!stockBalance) {
                    stockValidationErrors.push(`Stock balance not found for item ${item.itemName || item.itemId}`);
                    continue;
                }

                if (stockBalance.availableQuantity < item.quantity) {
                    stockValidationErrors.push(
                        `Insufficient stock for ${stockBalance.item.itemName} (${stockBalance.item.itemCode}). ` +
                        `Available: ${stockBalance.availableQuantity}, Required: ${item.quantity}`
                    );
                    continue;
                }

                // Calculate FIFO cost
                const itemReceipts = stockReceiptsByItem.get(item.itemId) || [];
                let remainingQuantity = item.quantity;
                let usedReceipts: { id: number; quantityUsed: number; cost: number }[] = [];

                if (itemReceipts.length === 0) {
                    // Fallback to item cost
                    usedReceipts.push({
                        id: -1,
                        quantityUsed: item.quantity,
                        cost: stockBalance.item.cost || 0
                    });
                } else {
                    // Use FIFO
                    for (const receipt of itemReceipts) {
                        if (remainingQuantity <= 0) break;

                        const quantityToUse = Math.min(remainingQuantity, receipt.quantity);
                        remainingQuantity -= quantityToUse;

                        usedReceipts.push({
                            id: receipt.id,
                            quantityUsed: quantityToUse,
                            cost: receipt.cost,
                        });
                    }

                    // If still remaining, use last receipt's cost
                    if (remainingQuantity > 0 && itemReceipts.length > 0) {
                        const lastReceipt = itemReceipts[itemReceipts.length - 1];
                        usedReceipts.push({
                            id: -1,
                            quantityUsed: remainingQuantity,
                            cost: lastReceipt.cost,
                        });
                    }
                }

                salesItemsWithFIFOCost.push({ ...item, usedReceipts });
            }

            if (stockValidationErrors.length > 0) {
                throw new BusinessLogicError(`Stock validation failed: ${stockValidationErrors.join('; ')}`);
            }

            // Calculate payments and sales status
            const totalSalesAmount = salesBody.totalAmount;
            const totalPaymentAmount = payments.reduce((sum, payment) => sum + payment.tenderedAmount, 0);
            const salesStatus = totalPaymentAmount >= totalSalesAmount ? 'Completed' : 'Partially Paid';
            const changeAmount = totalPaymentAmount >= totalSalesAmount ? totalPaymentAmount - totalSalesAmount : 0;

            // Calculate total profit and prepare sales item data
            let totalProfit = 0;
            const salesItemData: any[] = [];
            const stockReceiptUpdates: { id: number; newQuantity: number }[] = [];

            salesItemsWithFIFOCost.forEach((item) => {
                const totalQuantity = item.quantity;
                const discountPerUnit = (item.discountAmount || 0) / totalQuantity;
                const serviceChargePerUnit = (item.serviceChargeAmount || 0) / totalQuantity;
                const taxPerUnit = item.taxAmount ?? 0;

                item.usedReceipts.forEach((receipt) => {
                    const revenueForQuantity = item.price * receipt.quantityUsed;
                    const costForQuantity = receipt.cost * receipt.quantityUsed;
                    const totalDiscountForQuantity = discountPerUnit * receipt.quantityUsed;
                    const totalTaxForQuantity = taxPerUnit * receipt.quantityUsed;
                    const totalServiceChargeForQuantity = serviceChargePerUnit * receipt.quantityUsed;
                    const totalSubtotalForQuantity = (item.subtotalAmount / totalQuantity) * receipt.quantityUsed;

                    const profit = revenueForQuantity - costForQuantity - totalDiscountForQuantity - totalTaxForQuantity - totalServiceChargeForQuantity;
                    totalProfit += profit;

                    salesItemData.push({
                        itemId: item.itemId,
                        itemName: item.itemName,
                        itemCode: item.itemCode,
                        itemBrand: item.itemBrand,
                        quantity: receipt.quantityUsed,
                        cost: costForQuantity,
                        price: revenueForQuantity,
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
                            const newQuantity = existingReceipt.quantity - receipt.quantityUsed;
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
                    completedSessionId: totalPaymentAmount >= totalSalesAmount ? salesBody.sessionId : null,
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

            // Batch update stock receipts
            await Promise.all(
                stockReceiptUpdates.map(async (update) => {
                    await tx.stockReceipt.update({
                        where: { id: update.id },
                        data: {
                            quantity: update.newQuantity,
                            updatedAt: new Date(),
                            version: { increment: 1 },
                            deleted: update.newQuantity === 0 ? true : undefined,
                            deletedAt: update.newQuantity === 0 ? new Date() : undefined,
                        },
                    });
                })
            );

            // Prepare stock balance updates and movements
            const stockUpdates = salesBody.salesItems.map(item => {
                const stockBalance = stockBalanceMap.get(item.itemId)!;
                return {
                    id: stockBalance.itemId, // Using itemId as identifier
                    outletId: salesBody.outletId,
                    itemId: item.itemId,
                    quantity: item.quantity,
                    previousAvailable: stockBalance.availableQuantity,
                    previousOnHand: stockBalance.availableQuantity, // Assuming same as available
                };
            });

            // Batch update stock balances and create movements
            await Promise.all([
                ...stockUpdates.map(async (update) => {
                    const stockBalance = await tx.stockBalance.findFirst({
                        where: {
                            itemId: update.itemId,
                            outletId: update.outletId,
                            deleted: false,
                        },
                    });

                    if (stockBalance) {
                        await tx.stockBalance.update({
                            where: { id: stockBalance.id },
                            data: {
                                availableQuantity: { decrement: update.quantity },
                                onHandQuantity: { decrement: update.quantity },
                                version: { increment: 1 },
                                updatedAt: new Date(),
                            },
                        });
                    }
                }),

                // Batch create stock movements
                tx.stockMovement.createMany({
                    data: stockUpdates.map(update => ({
                        itemId: update.itemId,
                        outletId: update.outletId,
                        previousAvailableQuantity: update.previousAvailable,
                        previousOnHandQuantity: update.previousOnHand,
                        availableQuantityDelta: -update.quantity,
                        onHandQuantityDelta: -update.quantity,
                        movementType: 'Sales',
                        documentId: createdSales.id,
                        reason: 'Sales transaction',
                        remark: `Sales #${createdSales.id}`,
                    }))
                })
            ]);

            return createdSales;
        });

        return getById(databaseName, result.id);
    } catch (error) {
        throw error;
    }
}

let completeSales = async (databaseName: string, salesId: number, payments: Payment[]) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        await tenantPrisma.$transaction(async (tx) => {

            //get sales grand total
            var sales = await tx.sales.findUnique({
                where: {
                    id: salesId
                }
            })

            if (!sales) {
                throw new NotFoundError("Sales")
            }

            if (sales.status == 'completed') {
                throw new BusinessLogicError("Sales already completed")
            }

            //throw error if payment amount is less than sales total amount
            let totalSalesAmount = sales.totalAmount
            let totalPaymentAmount = payments.reduce((sum, currentPayment) => sum + currentPayment.tenderedAmount, 0)
            if (totalPaymentAmount < totalSalesAmount) {
                throw new BusinessLogicError("Total payment amount is less than the sales grand total amount")
            }

            //update sales properties
            var changeAmount = performPaymentCalculation(totalSalesAmount, totalPaymentAmount)
            sales.paidAmount = totalPaymentAmount
            sales.changeAmount = changeAmount
            sales.status = "completed"

            await tx.sales.update({
                where: {
                    id: sales.id
                },
                data: sales
            })

            //insert payments
            await tx.payment.createMany({
                data: payments
            })

            //update stock related data
            let salesItems = await tx.salesItem.findMany({
                where: {
                    salesId: salesId
                }
            })

            // Lazy-load to avoid circular dependency
            const { getByIdRaw } = require("../item/item.service")

            let stocks: StockBalance[] = []
            let stockChecks: StockMovement[] = []

            for (const salesItem of salesItems) {
                var item = await getByIdRaw(salesItem.itemId)
                if (item != null) {
                    var stockIndex = stocks.findIndex(stock => stock.id === item!.stockId)
                    if (stockIndex < 0) {
                        stockIndex = stocks.push(item.stock) - 1
                    }

                    let minusQuantity = salesItem.quantity * -1
                    let updatedAvailableQuantity = stocks[stockIndex].availableQuantity + minusQuantity
                    let updatedOnHandQuantity = stocks[stockIndex].onHandQuantity + minusQuantity
                    stocks[stockIndex].availableQuantity = updatedAvailableQuantity
                    stocks[stockIndex].onHandQuantity = updatedOnHandQuantity

                    let stockCheck: StockMovement = {
                        id: 0,
                        itemId: salesItem.itemId,
                        outletId: sales.outletId,
                        previousAvailableQuantity: item.stock.availableQuantity,
                        previousOnHandQuantity: item.stock.onHandQuantity,
                        availableQuantityDelta: minusQuantity,
                        onHandQuantityDelta: minusQuantity,
                        documentId: salesId,
                        movementType: 'Sales',
                        reason: '',
                        remark: '',
                        deleted: false,
                        version: 1,
                        performedBy: sales.performedBy,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    }
                    stockChecks.push(stockCheck)
                }
            }

            await tx.stockMovement.createMany({
                data: stockChecks
            })

            for (const stock of stocks) {
                await tx.stockBalance.update({
                    where: {
                        id: stock.id
                    },
                    data: stock
                })
            }
        })

        return getById(databaseName, salesId)
    }
    catch (error) {
        throw error
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

let performProfitCalculation = (sales: CreateSalesRequest) => {
    try {
        let items = sales.salesItems
        var totalProfitAmount = 0.00

        items.forEach(function (item) {
            let itemPrice = item.price
            let itemCost = item.cost
            let itemQuantity = item.quantity
            var profit = itemPrice - itemCost
            var subTotalProfit = itemQuantity * profit
            item.profit = profit
            totalProfitAmount = totalProfitAmount + subTotalProfit
        })

        sales.profitAmount = totalProfitAmount
        return sales
    }
    catch (error) {
        throw error
    }
}

let performPaymentCalculation = (salesTotalAmount: number, paidAmount: number) => {
    try {
        // Only return a positive change amount if paid amount exceeds total amount
        var changeAmount = paidAmount >= salesTotalAmount ? paidAmount - salesTotalAmount : 0;
        return changeAmount;
    }
    catch (error) {
        throw error
    }
}

let performSalesCalculation = async (sales: CalculateSalesObject) => {
    try {
        let items = sales.salesItems
        var subtotal = 0.00
        var totalItemDiscountAmount = 0.00

        items.forEach(function (item) {
            item.subtotalAmount = item.price * item.quantity
            item = calculateItemDiscount(item)
            item.subtotalAmount = item.subtotalAmount - item.discountAmount
            totalItemDiscountAmount = totalItemDiscountAmount + item.discountAmount
            subtotal = subtotal + item.subtotalAmount
        })

        sales.totalItemDiscountAmount = totalItemDiscountAmount
        sales.subtotalAmount = subtotal
        sales = calculateSalesDiscount(sales)
        sales.taxAmount = 0
        sales.serviceChargeAmount = 0
        sales.roundingAmount = 0
        sales.totalAmount = sales.subtotalAmount + sales.taxAmount + sales.serviceChargeAmount + sales.roundingAmount - sales.discountAmount

        return sales
    }
    catch (error) {
        throw error
    }
}

let calculateSalesDiscount = (sales: CalculateSalesObject) => {
    switch (sales.discountBy) {
        case DiscountBy.Amount:
            let discountPercentage = (sales.discountAmount * 100) / sales.subtotalAmount
            if (discountPercentage > 100) {
                sales.discountPercentage = 100
                sales.discountAmount = sales.subtotalAmount
            }
            else {
                sales.discountPercentage = discountPercentage
            }
            break
        case DiscountBy.Percentage:
            sales.discountAmount = sales.subtotalAmount * (sales.discountPercentage / 100)
            break
        default:
            sales.discountAmount = 0
            sales.discountPercentage = 0
            break
    }
    return sales
}

let calculateItemDiscount = (item: CalculateSalesItemObject) => {
    switch (item.discountType) {
        case DiscountType.Manual:
            let subtotalBeforeDiscount = item.subtotalAmount
            switch (item.discountBy) {
                case DiscountBy.Amount:
                    let discountPercentage = (item.discountAmount * 100) / subtotalBeforeDiscount
                    if (discountPercentage > 100) {
                        item.discountPercentage = 100
                        item.discountAmount = subtotalBeforeDiscount
                    }
                    else {
                        item.discountPercentage = discountPercentage
                    }
                    break
                case DiscountBy.Percentage:
                    item.discountAmount = subtotalBeforeDiscount * (item.discountPercentage / 100)
                    break
                default:
                    item.discountAmount = 0
                    item.discountPercentage = 0
                    break
            }
            break
    }
    return item
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

        // Calculate derived metrics
        const netRevenue = (activeSales._sum?.totalAmount || 0);
        const netProfit = (activeSales._sum?.profitAmount || 0);

        const totalTransactions = (activeSales._count?.id || 0) + voidedSales +
            returnedSales + refundedSales;

        const averageTransactionValue = activeSales._count.id > 0 ?
            netRevenue / activeSales._count.id : 0;

        const outstandingAmount = (partiallyPaidSales._sum?.totalAmount || 0) -
            (partiallyPaidSales._sum?.paidAmount || 0);

        return {
            // Summary metrics
            salesCount: activeSales._count?.id || 0,
            totalRevenue: netRevenue,
            totalProfit: netProfit,

            // Enhanced metrics
            averageTransactionValue: Math.round(averageTransactionValue * 100) / 100,
            totalPaidAmount: activeSales._sum?.paidAmount || 0,
            totalChangeGiven: activeSales._sum?.changeAmount || 0,
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

            // // Performance indicators
            // performanceMetrics: {
            //     profitMargin: netRevenue > 0 ?
            //         Math.round((netProfit / netRevenue * 100) * 100) / 100 : 0,
            //     voidRate: totalTransactions > 0 ?
            //         Math.round((voidedSales / totalTransactions * 100) * 100) / 100 : 0,
            //     returnRate: totalTransactions > 0 ?
            //         Math.round((returnedSales / totalTransactions * 100) * 100) / 100 : 0,
            //     refundRate: totalTransactions > 0 ?
            //         Math.round((refundedSales / totalTransactions * 100) * 100) / 100 : 0,
            //     partialPaymentRate: totalTransactions > 0 ?
            //         Math.round(((partiallyPaidSales._count?.id || 0) / totalTransactions * 100) * 100) / 100 : 0
            // }
        };
    }
    catch (error) {
        throw error
    }
}

let addPaymentToPartiallyPaidSales = async (databaseName: string, salesId: number, payments: Payment[]) => {
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
            const remainingAmount = sales.totalAmount - sales.paidAmount;
            if (remainingAmount <= 0) {
                throw new BusinessLogicError("This sales record is already fully paid");
            }
            // Calculate total of new payments
            const totalNewPaymentAmount = payments.reduce((sum, payment) => sum + payment.tenderedAmount, 0);
            if (totalNewPaymentAmount <= 0) {
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
            const updatedPaidAmount = sales.paidAmount + totalNewPaymentAmount;
            const isFullyPaid = updatedPaidAmount >= sales.totalAmount;

            // Calculate change amount if payment exceeds the remaining amount
            const changeAmount = isFullyPaid ?
                updatedPaidAmount - sales.totalAmount :
                0; // No change if still partially paid

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

            return updatedSales;
        });

        // Return the complete updated sales record with all relationships
        return getById(databaseName, salesId);
    }
    catch (error) {
        throw error;
    }
}

let voidSales = async (databaseName: string, salesId: number) => {
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
                                previousAvailableQuantity: stockBalance.availableQuantity,
                                previousOnHandQuantity: stockBalance.onHandQuantity,
                                availableQuantityDelta: salesItem.quantity,
                                onHandQuantityDelta: salesItem.quantity,
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
        return getById(databaseName, salesId);
    }
    catch (error) {
        throw error;
    }
}

let returnSales = async (databaseName: string, salesId: number) => {
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
        return getById(databaseName, salesId);
    }
    catch (error) {
        throw error;
    }
}

let refundSales = async (databaseName: string, salesId: number) => {
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
        return getById(databaseName, salesId);
    }
    catch (error) {
        throw error;
    }
}

export = {
    getAll,
    getByDateRange,
    getById,
    calculateSales,
    create,
    completeSales,
    completeNewSales,
    update,
    remove,
    getTotalSalesData,
    getPartiallyPaidSales,
    addPaymentToPartiallyPaidSales,
    voidSales,
    returnSales,
    refundSales
}