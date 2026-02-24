import { Prisma, PrismaClient, PurchaseReturn } from "../../prisma/client/generated/client"
import { Decimal } from 'decimal.js';
import { NotFoundError } from "../api-helpers/error"
import { getTenantPrisma } from '../db';
import { CancelPurchaseReturnInput, CreatePurchaseReturnRequestBody, PurchaseReturnInput, PurchaseReturnSyncRequest } from "./purchase-return.request";

class RequestValidateError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RequestValidateError';
    }
}

const VALID_RETURN_REASONS = ['DEFECT', 'SPOILT', 'BROKEN', 'WRONG_ITEM', 'OTHER'];

let getAll = async (
    databaseName: string,
    syncRequest: PurchaseReturnSyncRequest
): Promise<{ purchaseReturns: any[]; total: number; serverTimestamp: string }> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { lastSyncTimestamp, outletId, skip = 0, take = 100 } = syncRequest;

    try {
        let lastSync: Date;

        if (lastSyncTimestamp && lastSyncTimestamp !== 'null') {
            lastSync = new Date(lastSyncTimestamp);
        } else {
            lastSync = new Date();
            lastSync.setHours(0, 0, 0, 0);
        }

        const parsedOutletId = typeof outletId === 'string' ? parseInt(outletId, 10) : outletId;

        const where: any = {
            OR: [
                { createdAt: { gte: lastSync } },
                { updatedAt: { gte: lastSync } },
                { deletedAt: { gte: lastSync } },
                {
                    purchaseReturnItems: {
                        some: {
                            OR: [
                                { createdAt: { gte: lastSync } },
                                { updatedAt: { gte: lastSync } },
                                { deletedAt: { gte: lastSync } }
                            ]
                        }
                    }
                }
            ],
        };

        if (parsedOutletId) {
            where.outletId = parsedOutletId;
        }

        const [total, purchaseReturns] = await Promise.all([
            tenantPrisma.purchaseReturn.count({ where }),
            tenantPrisma.purchaseReturn.findMany({
                where,
                skip,
                take,
                select: {
                    id: true,
                    returnNumber: true,
                    invoiceId: true,
                    outletId: true,
                    supplierId: true,
                    returnDate: true,
                    status: true,
                    totalReturnAmount: true,
                    remark: true,
                    performedBy: true,
                    cancelReason: true,
                    cancelledBy: true,
                    cancelledAt: true,
                    deleted: true,
                    deletedAt: true,
                    createdAt: true,
                    updatedAt: true,
                    version: true,
                    _count: {
                        select: {
                            purchaseReturnItems: {
                                where: { deleted: false }
                            }
                        }
                    },
                    purchaseReturnItems: {
                        where: { deleted: false },
                        select: {
                            id: true,
                            itemId: true,
                            itemVariantId: true,
                            variantSku: true,
                            variantName: true,
                            quantity: true,
                            unitPrice: true,
                            returnReason: true,
                            remark: true,
                            createdAt: true,
                            updatedAt: true
                        }
                    },
                    invoice: {
                        select: {
                            id: true,
                            invoiceNumber: true,
                            totalAmount: true,
                            invoiceDate: true
                        }
                    },
                    supplier: {
                        select: {
                            id: true,
                            companyName: true
                        }
                    }
                }
            })
        ]);

        const enrichedPurchaseReturns = purchaseReturns.map(pr => ({
            ...pr,
            itemCount: pr._count.purchaseReturnItems,
            invoiceNumber: pr.invoice?.invoiceNumber || null,
            supplierName: pr.supplier?.companyName || null,
            _count: undefined
        }));

        return {
            purchaseReturns: enrichedPurchaseReturns,
            total,
            serverTimestamp: new Date().toISOString(),
        };
    } catch (error) {
        throw error;
    }
};

let getById = async (id: number, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const purchaseReturn = await tenantPrisma.purchaseReturn.findUnique({
            where: {
                id: id,
                deleted: false
            },
            include: {
                purchaseReturnItems: {
                    where: { deleted: false },
                    select: {
                        id: true,
                        itemId: true,
                        itemVariantId: true,
                        variantSku: true,
                        variantName: true,
                        quantity: true,
                        unitPrice: true,
                        returnReason: true,
                        remark: true,
                        createdAt: true,
                        updatedAt: true,
                        item: {
                            select: {
                                id: true,
                                itemName: true,
                                itemCode: true,
                                unitOfMeasure: true
                            }
                        },
                        itemVariant: {
                            select: {
                                id: true,
                                variantSku: true,
                                variantName: true
                            }
                        }
                    }
                },
                invoice: {
                    select: {
                        id: true,
                        invoiceNumber: true,
                        taxInvoiceNumber: true,
                        totalAmount: true,
                        invoiceDate: true,
                        purchaseOrder: {
                            select: {
                                id: true,
                                purchaseOrderNumber: true
                            }
                        }
                    }
                },
                supplier: {
                    select: {
                        id: true,
                        companyName: true,
                        mobile: true,
                        email: true
                    }
                }
            }
        });

        if (!purchaseReturn) {
            throw new NotFoundError("Purchase Return");
        }

        return purchaseReturn;
    }
    catch (error) {
        throw error;
    }
}

let getByDateRange = async (databaseName: string, request: { outletId?: string, skip?: number, take?: number, startDate: string, endDate: string }) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { outletId, skip = 0, take = 100, startDate, endDate } = request;

    try {
        const parsedOutletId = typeof outletId === 'string' ? parseInt(outletId, 10) : outletId;

        const parsedStartDate = new Date(startDate);
        parsedStartDate.setHours(0, 0, 0, 0);

        const parsedEndDate = new Date(endDate);
        parsedEndDate.setHours(23, 59, 59, 999);

        if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
            throw new Error('Invalid date format');
        }

        const where: any = {
            returnDate: {
                gte: parsedStartDate,
                lte: parsedEndDate
            },
        };

        if (parsedOutletId) {
            where.outletId = parsedOutletId;
        }

        const [total, purchaseReturns] = await Promise.all([
            tenantPrisma.purchaseReturn.count({ where }),
            tenantPrisma.purchaseReturn.findMany({
                where,
                skip,
                take,
                orderBy: { id: 'asc' },
                select: {
                    id: true,
                    returnNumber: true,
                    invoiceId: true,
                    outletId: true,
                    supplierId: true,
                    returnDate: true,
                    status: true,
                    totalReturnAmount: true,
                    remark: true,
                    performedBy: true,
                    cancelReason: true,
                    cancelledBy: true,
                    cancelledAt: true,
                    deleted: true,
                    deletedAt: true,
                    createdAt: true,
                    updatedAt: true,
                    version: true,
                    _count: {
                        select: {
                            purchaseReturnItems: {
                                where: { deleted: false }
                            }
                        }
                    },
                    purchaseReturnItems: {
                        where: { deleted: false },
                        select: {
                            id: true,
                            itemId: true,
                            itemVariantId: true,
                            variantSku: true,
                            variantName: true,
                            quantity: true,
                            unitPrice: true,
                            returnReason: true,
                            remark: true,
                            createdAt: true,
                            updatedAt: true
                        }
                    },
                    invoice: {
                        select: {
                            id: true,
                            invoiceNumber: true,
                            totalAmount: true,
                            invoiceDate: true
                        }
                    },
                    supplier: {
                        select: {
                            id: true,
                            companyName: true
                        }
                    }
                }
            })
        ]);

        const enrichedPurchaseReturns = purchaseReturns.map(pr => ({
            ...pr,
            itemCount: pr._count.purchaseReturnItems,
            invoiceNumber: pr.invoice?.invoiceNumber || null,
            supplierName: pr.supplier?.companyName || null,
            _count: undefined
        }));

        return {
            purchaseReturns: enrichedPurchaseReturns,
            total,
            serverTimestamp: new Date().toISOString(),
        };
    }
    catch (error) {
        throw error;
    }
}

let getByInvoiceId = async (invoiceId: number, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const purchaseReturns = await tenantPrisma.purchaseReturn.findMany({
            where: {
                invoiceId: invoiceId,
                deleted: false
            },
            include: {
                purchaseReturnItems: {
                    where: { deleted: false },
                    select: {
                        id: true,
                        itemId: true,
                        itemVariantId: true,
                        variantSku: true,
                        variantName: true,
                        quantity: true,
                        unitPrice: true,
                        returnReason: true,
                        remark: true,
                        createdAt: true,
                        updatedAt: true,
                        item: {
                            select: {
                                id: true,
                                itemName: true,
                                itemCode: true
                            }
                        }
                    }
                }
            }
        });

        return { purchaseReturns };
    }
    catch (error) {
        throw error;
    }
}

let createMany = async (databaseName: string, requestBody: CreatePurchaseReturnRequestBody): Promise<PurchaseReturn[]> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const { purchaseReturns } = requestBody;

        if (!purchaseReturns || !Array.isArray(purchaseReturns)) {
            throw new RequestValidateError('purchaseReturns must be a non-empty array');
        }

        // Validate return reasons
        for (const pr of purchaseReturns) {
            if (pr.purchaseReturnItems) {
                for (const item of pr.purchaseReturnItems) {
                    if (!VALID_RETURN_REASONS.includes(item.returnReason)) {
                        throw new RequestValidateError(`Invalid return reason: ${item.returnReason}. Valid reasons: ${VALID_RETURN_REASONS.join(', ')}`);
                    }
                    if (item.returnReason === 'OTHER' && !item.remark) {
                        throw new RequestValidateError('Remark is required when return reason is OTHER');
                    }
                }
            }
        }

        // Extract unique IDs for batch validation
        const outletIds = [...new Set(purchaseReturns.map(pr => pr.outletId).filter(Boolean))];
        const supplierIds = [...new Set(purchaseReturns.map(pr => pr.supplierId).filter(Boolean))];
        const invoiceIds = [...new Set(purchaseReturns.map(pr => pr.invoiceId).filter(Boolean))];

        // Batch validation in parallel
        const validationPromises = [];

        if (outletIds.length > 0) {
            validationPromises.push(
                tenantPrisma.outlet.findMany({
                    where: { id: { in: outletIds }, deleted: false },
                    select: { id: true }
                }).then(outlets => ({ type: 'outlets', existing: outlets.map(o => o.id), requested: outletIds }))
            );
        }

        if (supplierIds.length > 0) {
            validationPromises.push(
                tenantPrisma.supplier.findMany({
                    where: { id: { in: supplierIds }, deleted: false },
                    select: { id: true }
                }).then(suppliers => ({ type: 'suppliers', existing: suppliers.map(s => s.id), requested: supplierIds }))
            );
        }

        if (invoiceIds.length > 0) {
            validationPromises.push(
                tenantPrisma.invoice.findMany({
                    where: { id: { in: invoiceIds }, deleted: false },
                    select: { id: true, status: true, invoiceSettlementId: true }
                }).then(invoices => ({
                    type: 'invoices',
                    existing: invoices.map(i => i.id),
                    requested: invoiceIds,
                    statuses: invoices.reduce((acc, inv) => ({ ...acc, [inv.id]: inv.status }), {} as Record<number, string>),
                    settlementIds: invoices.reduce((acc, inv) => ({ ...acc, [inv.id]: inv.invoiceSettlementId }), {} as Record<number, number | null>)
                }))
            );
        }

        const validationResults = await Promise.all(validationPromises);

        // Extract settlementIds map for later use
        let invoiceSettlementIds: Record<number, number | null> = {};

        for (const result of validationResults) {
            const existingIds = new Set(result.existing);
            const missingIds = result.requested.filter((id: number) => !existingIds.has(id));

            if (missingIds.length > 0) {
                const entityName = result.type.charAt(0).toUpperCase() + result.type.slice(1, -1);
                throw new RequestValidateError(`${entityName} with IDs ${missingIds.join(', ')} do not exist`);
            }

            // Additional validation for invoices - ensure they are PAID
            if (result.type === 'invoices' && 'statuses' in result) {
                const statuses = result.statuses as Record<number, string>;
                for (const invoiceId of result.requested) {
                    const status = statuses[invoiceId];
                    if (status?.toUpperCase() !== 'PAID') {
                        throw new RequestValidateError(`Invoice with ID ${invoiceId} is not settled. Only PAID invoices can have returns.`);
                    }
                }
                // Extract settlementIds for use during creation
                if ('settlementIds' in result) {
                    invoiceSettlementIds = result.settlementIds as Record<number, number | null>;
                }
            }
        }

        // Validate return quantities don't exceed available quantities (invoice qty - already returned qty)
        await validateReturnQuantities(tenantPrisma, purchaseReturns);

        // Use single transaction for all creations
        const result = await tenantPrisma.$transaction(async (tx) => {
            const createdPurchaseReturns: any[] = [];

            for (const purchaseReturnData of purchaseReturns) {
                // Calculate total return amount
                let totalReturnAmount = new Decimal(0);
                if (purchaseReturnData.purchaseReturnItems) {
                    for (const item of purchaseReturnData.purchaseReturnItems) {
                        const qty = new Decimal(item.quantity);
                        const price = new Decimal(item.unitPrice);
                        totalReturnAmount = totalReturnAmount.plus(qty.times(price));
                    }
                }

                // Create purchase return with auto-linked invoiceSettlementId
                const settlementId = invoiceSettlementIds[purchaseReturnData.invoiceId] || null;
                const newPurchaseReturn = await tx.purchaseReturn.create({
                    data: {
                        returnNumber: purchaseReturnData.returnNumber,
                        invoiceId: purchaseReturnData.invoiceId,
                        invoiceSettlementId: settlementId,
                        outletId: purchaseReturnData.outletId,
                        supplierId: purchaseReturnData.supplierId,
                        returnDate: purchaseReturnData.returnDate,
                        status: 'COMPLETED', // Always start as COMPLETED
                        totalReturnAmount: totalReturnAmount,
                        remark: purchaseReturnData.remark || null,
                        performedBy: purchaseReturnData.performedBy || null
                    }
                });

                let purchaseReturnItems: any[] = [];

                // Create purchase return items and handle stock operations
                if (purchaseReturnData.purchaseReturnItems && Array.isArray(purchaseReturnData.purchaseReturnItems) && purchaseReturnData.purchaseReturnItems.length > 0) {
                    await tx.purchaseReturnItem.createMany({
                        data: purchaseReturnData.purchaseReturnItems.map((item) => ({
                            purchaseReturnId: newPurchaseReturn.id,
                            itemId: item.itemId,
                            itemVariantId: item.itemVariantId || null,
                            variantSku: item.variantSku || null,
                            variantName: item.variantName || null,
                            quantity: new Decimal(item.quantity),
                            unitPrice: new Decimal(item.unitPrice),
                            returnReason: item.returnReason,
                            remark: item.remark || null,
                        })),
                    });

                    // Handle stock operations - reduce stock and get receipt mappings
                    const stockReceiptIdMap = await reduceStockBalancesAndCreateMovements(
                        tx,
                        purchaseReturnData.purchaseReturnItems,
                        newPurchaseReturn,
                        purchaseReturnData.invoiceId,
                        purchaseReturnData.performedBy || "SYSTEM"
                    );

                    // Fetch created items and update them with stockReceiptId
                    purchaseReturnItems = await tx.purchaseReturnItem.findMany({
                        where: { purchaseReturnId: newPurchaseReturn.id },
                    });

                    // Update each PurchaseReturnItem with its corresponding stockReceiptId
                    for (const prItem of purchaseReturnItems) {
                        const itemKey = `${prItem.itemId}-${prItem.itemVariantId || 'null'}`;
                        const stockReceiptId = stockReceiptIdMap.get(itemKey);
                        if (stockReceiptId) {
                            await tx.purchaseReturnItem.update({
                                where: { id: prItem.id },
                                data: { stockReceiptId: stockReceiptId }
                            });
                            prItem.stockReceiptId = stockReceiptId;
                        }
                    }
                }

                createdPurchaseReturns.push({
                    ...newPurchaseReturn,
                    purchaseReturnItems
                });
            }

            return createdPurchaseReturns;
        });

        return result as PurchaseReturn[];
    }
    catch (error) {
        throw error;
    }
}

// Helper function to validate return quantities don't exceed available quantities
// Fetches invoice items and existing returns in efficient batch queries
const validateReturnQuantities = async (
    prisma: PrismaClient,
    purchaseReturns: PurchaseReturnInput[]
): Promise<void> => {
    // Get unique invoice IDs
    const invoiceIds = [...new Set(purchaseReturns.map(pr => pr.invoiceId).filter(Boolean))];

    if (invoiceIds.length === 0) return;

    // Batch fetch: invoices with items and existing COMPLETED returns
    const invoices = await prisma.invoice.findMany({
        where: {
            id: { in: invoiceIds },
            deleted: false
        },
        select: {
            id: true,
            invoiceNumber: true,
            invoiceItems: {
                where: { deleted: false },
                select: {
                    id: true,
                    itemId: true,
                    itemVariantId: true,
                    quantity: true
                }
            },
            purchaseReturns: {
                where: {
                    status: 'COMPLETED',
                    deleted: false
                },
                select: {
                    id: true,
                    purchaseReturnItems: {
                        where: { deleted: false },
                        select: {
                            itemId: true,
                            itemVariantId: true,
                            quantity: true
                        }
                    }
                }
            }
        }
    });

    // Build lookup maps for O(1) access
    const invoiceMap = new Map<number, typeof invoices[0]>();
    invoices.forEach(inv => invoiceMap.set(inv.id, inv));

    // For each invoice, build a map of (itemId-variantId) -> { invoiceQty, alreadyReturnedQty }
    const invoiceItemQuantityMap = new Map<number, Map<string, { invoiceQty: Decimal; alreadyReturned: Decimal; invoiceNumber: string }>>();

    for (const invoice of invoices) {
        const itemMap = new Map<string, { invoiceQty: Decimal; alreadyReturned: Decimal; invoiceNumber: string }>();

        // Initialize with invoice item quantities
        for (const item of invoice.invoiceItems) {
            const key = `${item.itemId}-${item.itemVariantId || 'null'}`;
            itemMap.set(key, {
                invoiceQty: new Decimal(item.quantity),
                alreadyReturned: new Decimal(0),
                invoiceNumber: invoice.invoiceNumber
            });
        }

        // Add up already returned quantities from existing COMPLETED returns
        for (const pr of invoice.purchaseReturns) {
            for (const prItem of pr.purchaseReturnItems) {
                const key = `${prItem.itemId}-${prItem.itemVariantId || 'null'}`;
                const existing = itemMap.get(key);
                if (existing) {
                    existing.alreadyReturned = existing.alreadyReturned.plus(new Decimal(prItem.quantity));
                }
            }
        }

        invoiceItemQuantityMap.set(invoice.id, itemMap);
    }

    // Validate each return request
    const validationErrors: Array<{
        itemId: number;
        itemVariantId: number | null;
        requestedQuantity: string;
        availableQuantity: string;
        previouslyReturned: string;
        originalQuantity: string;
        invoiceNumber: string;
    }> = [];

    for (const pr of purchaseReturns) {
        const itemMap = invoiceItemQuantityMap.get(pr.invoiceId);
        if (!itemMap) continue;

        const invoice = invoiceMap.get(pr.invoiceId);
        const invoiceNumber = invoice?.invoiceNumber || `ID:${pr.invoiceId}`;

        for (const item of (pr.purchaseReturnItems || [])) {
            const key = `${item.itemId}-${item.itemVariantId || 'null'}`;
            const itemData = itemMap.get(key);

            if (!itemData) {
                // Item not found in invoice - this is an error
                validationErrors.push({
                    itemId: item.itemId,
                    itemVariantId: item.itemVariantId || null,
                    requestedQuantity: String(item.quantity),
                    availableQuantity: '0',
                    previouslyReturned: '0',
                    originalQuantity: '0',
                    invoiceNumber
                });
                continue;
            }

            const requestedQty = new Decimal(item.quantity);
            const availableQty = itemData.invoiceQty.minus(itemData.alreadyReturned);

            if (requestedQty.gt(availableQty)) {
                validationErrors.push({
                    itemId: item.itemId,
                    itemVariantId: item.itemVariantId || null,
                    requestedQuantity: requestedQty.toFixed(4),
                    availableQuantity: availableQty.toFixed(4),
                    previouslyReturned: itemData.alreadyReturned.toFixed(4),
                    originalQuantity: itemData.invoiceQty.toFixed(4),
                    invoiceNumber
                });
            }
        }
    }

    if (validationErrors.length > 0) {
        const errorDetails = validationErrors.map(e =>
            `Item ${e.itemId}${e.itemVariantId ? ` (variant ${e.itemVariantId})` : ''}: ` +
            `requested ${e.requestedQuantity}, available ${e.availableQuantity} ` +
            `(invoice qty: ${e.originalQuantity}, already returned: ${e.previouslyReturned})`
        ).join('; ');

        throw new RequestValidateError(
            `Return quantity exceeds available quantity for one or more items. ${errorDetails}`
        );
    }
};

// Helper function to reduce stock balances and create movements for returns
// Returns a map of item key -> stockReceiptId for tracking
const reduceStockBalancesAndCreateMovements = async (
    tx: Prisma.TransactionClient,
    items: any[],
    purchaseReturn: any,
    invoiceId: number,
    performedBy: string
): Promise<Map<string, number>> => {
    const movementOperations = [];
    const stockReceiptIdMap = new Map<string, number>(); // itemId-itemVariantId -> stockReceiptId

    // Get delivery orders linked to this invoice
    const deliveryOrders = await tx.deliveryOrder.findMany({
        where: {
            invoiceId: invoiceId,
            deleted: false
        },
        select: { id: true }
    });

    if (deliveryOrders.length === 0) {
        throw new RequestValidateError(`No delivery orders found for invoice ID ${invoiceId}`);
    }

    const deliveryOrderIds = deliveryOrders.map(d => d.id);

    // Get all current stock balances in one query (supports variants)
    const currentStockBalances = await tx.stockBalance.findMany({
        where: {
            OR: items.map(item => ({
                itemId: item.itemId,
                itemVariantId: item.itemVariantId || null,
                outletId: purchaseReturn.outletId,
            })),
            deleted: false
        }
    });

    // Use composite key for variant support: itemId-itemVariantId
    const stockBalanceMap = new Map();
    currentStockBalances.forEach((balance: any) => {
        const key = `${balance.itemId}-${balance.itemVariantId || 'null'}`;
        stockBalanceMap.set(key, balance);
    });

    // Get all stock receipts for this invoice's delivery orders
    const stockReceipts = await tx.stockReceipt.findMany({
        where: {
            deliveryOrderId: { in: deliveryOrderIds },
            deleted: false
        }
    });

    // Create a map for quick lookup: deliveryOrderId-itemId-itemVariantId -> receipt
    const stockReceiptMap = new Map();
    stockReceipts.forEach((receipt: any) => {
        const key = `${receipt.deliveryOrderId}-${receipt.itemId}-${receipt.itemVariantId || 'null'}`;
        stockReceiptMap.set(key, receipt);
    });

    for (const item of items) {
        const returnQuantity = new Decimal(item.quantity);
        if (returnQuantity.gt(0)) {
            const balanceKey = `${item.itemId}-${item.itemVariantId || 'null'}`;
            const currentBalance = stockBalanceMap.get(balanceKey);

            if (!currentBalance) {
                throw new RequestValidateError(`No stock balance found for item ID ${item.itemId}. Cannot process return.`);
            }

            // Convert to Decimal objects for proper arithmetic
            const previousAvailableQuantity = new Decimal(currentBalance.availableQuantity);
            const previousOnHandQuantity = new Decimal(currentBalance.onHandQuantity);

            // Check if we have enough stock to return
            if (previousAvailableQuantity.lt(returnQuantity)) {
                throw new RequestValidateError(`Insufficient stock for item ID ${item.itemId}. Available: ${previousAvailableQuantity}, Requested return: ${returnQuantity}`);
            }

            // Reduce stock quantities
            const newAvailableQuantity = previousAvailableQuantity.sub(returnQuantity);
            const newOnHandQuantity = previousOnHandQuantity.sub(returnQuantity);

            // Update stock balance
            await tx.stockBalance.update({
                where: { id: currentBalance.id },
                data: {
                    availableQuantity: newAvailableQuantity,
                    onHandQuantity: newOnHandQuantity,
                    updatedAt: new Date()
                }
            });

            // Prepare movement operation with negative delta
            movementOperations.push({
                itemId: item.itemId,
                outletId: purchaseReturn.outletId,
                itemVariantId: item.itemVariantId || null,
                previousAvailableQuantity: previousAvailableQuantity,
                previousOnHandQuantity: previousOnHandQuantity,
                availableQuantityDelta: returnQuantity.neg(), // Negative delta for return
                onHandQuantityDelta: returnQuantity.neg(), // Negative delta for return
                movementType: 'Purchase Return',
                documentId: purchaseReturn.id,
                reason: `Return from invoice - ${item.returnReason}`,
                remark: item.remark || '',
                performedBy: performedBy
            });

            // Find the matching StockReceipt and either soft-delete or reduce quantity
            let matchedReceipt: any = null;
            for (const doId of deliveryOrderIds) {
                const receiptKey = `${doId}-${item.itemId}-${item.itemVariantId || 'null'}`;
                const receipt = stockReceiptMap.get(receiptKey);
                if (receipt) {
                    matchedReceipt = receipt;
                    break;
                }
            }

            if (matchedReceipt) {
                const receiptQuantity = new Decimal(matchedReceipt.quantity);

                // Store the receipt ID for this item
                stockReceiptIdMap.set(balanceKey, matchedReceipt.id);

                if (returnQuantity.gte(receiptQuantity)) {
                    // Return quantity >= receipt quantity: soft-delete the receipt
                    await tx.stockReceipt.update({
                        where: { id: matchedReceipt.id },
                        data: {
                            deleted: true,
                            deletedAt: new Date()
                        }
                    });
                } else {
                    // Return quantity < receipt quantity: reduce the receipt quantity
                    const newReceiptQuantity = receiptQuantity.sub(returnQuantity);
                    await tx.stockReceipt.update({
                        where: { id: matchedReceipt.id },
                        data: {
                            quantity: newReceiptQuantity,
                            updatedAt: new Date()
                        }
                    });
                }
            }
            // If no matching receipt found, we skip receipt modification (edge case)
        }
    }

    // Execute movements in batch
    if (movementOperations.length > 0) {
        await tx.stockMovement.createMany({ data: movementOperations });
    }

    return stockReceiptIdMap;
};

// Helper function to reverse stock operations when purchase return is cancelled
const reverseStockOperationsForCancellation = async (
    tx: Prisma.TransactionClient,
    items: any[],
    purchaseReturn: any,
    performedBy: string
) => {
    const movementOperations = [];

    // Get all current stock balances in one query (supports variants)
    const currentStockBalances = await tx.stockBalance.findMany({
        where: {
            OR: items.map(item => ({
                itemId: item.itemId,
                itemVariantId: item.itemVariantId || null,
                outletId: purchaseReturn.outletId,
            })),
            deleted: false
        }
    });

    // Use composite key for variant support: itemId-itemVariantId
    const stockBalanceMap = new Map();
    currentStockBalances.forEach((balance: any) => {
        const key = `${balance.itemId}-${balance.itemVariantId || 'null'}`;
        stockBalanceMap.set(key, balance);
    });

    // Get stockReceiptIds from items that have them
    const stockReceiptIds = items
        .filter(item => item.stockReceiptId)
        .map(item => item.stockReceiptId);

    // Fetch all affected stock receipts (including deleted ones)
    const affectedReceipts = stockReceiptIds.length > 0 ? await tx.stockReceipt.findMany({
        where: {
            id: { in: stockReceiptIds }
        }
    }) : [];

    // Create a map for quick lookup
    const receiptMap = new Map();
    affectedReceipts.forEach((receipt: any) => {
        receiptMap.set(receipt.id, receipt);
    });

    for (const item of items) {
        const quantity = new Decimal(item.quantity);
        if (quantity.gt(0)) {
            const balanceKey = `${item.itemId}-${item.itemVariantId || 'null'}`;
            const currentBalance = stockBalanceMap.get(balanceKey);

            if (currentBalance) {
                // Convert to Decimal objects for proper arithmetic
                const previousAvailableQuantity = new Decimal(currentBalance.availableQuantity);
                const previousOnHandQuantity = new Decimal(currentBalance.onHandQuantity);

                // Add back the returned quantities
                const newAvailableQuantity = previousAvailableQuantity.add(quantity);
                const newOnHandQuantity = previousOnHandQuantity.add(quantity);

                // Update stock balance
                await tx.stockBalance.update({
                    where: { id: currentBalance.id },
                    data: {
                        availableQuantity: newAvailableQuantity,
                        onHandQuantity: newOnHandQuantity,
                        updatedAt: new Date()
                    }
                });

                // Create positive movement to reverse the return
                movementOperations.push({
                    itemId: item.itemId,
                    outletId: purchaseReturn.outletId,
                    itemVariantId: item.itemVariantId || null,
                    previousAvailableQuantity: previousAvailableQuantity,
                    previousOnHandQuantity: previousOnHandQuantity,
                    availableQuantityDelta: quantity, // Positive delta for reversal
                    onHandQuantityDelta: quantity, // Positive delta for reversal
                    movementType: 'Purchase Return Reversal',
                    documentId: purchaseReturn.id,
                    reason: `Cancelled return #${purchaseReturn.returnNumber}`,
                    remark: 'Purchase return cancelled - stock restored',
                    performedBy: performedBy
                });
            }

            // Restore the StockReceipt if we have a reference
            if (item.stockReceiptId) {
                const receipt = receiptMap.get(item.stockReceiptId);
                if (receipt) {
                    if (receipt.deleted) {
                        // Receipt was soft-deleted, un-delete and restore quantity
                        await tx.stockReceipt.update({
                            where: { id: receipt.id },
                            data: {
                                deleted: false,
                                deletedAt: null,
                                quantity: quantity, // Restore with the return quantity
                                updatedAt: new Date()
                            }
                        });
                    } else {
                        // Receipt was reduced, add back the quantity
                        const currentReceiptQty = new Decimal(receipt.quantity);
                        const restoredQty = currentReceiptQty.add(quantity);
                        await tx.stockReceipt.update({
                            where: { id: receipt.id },
                            data: {
                                quantity: restoredQty,
                                updatedAt: new Date()
                            }
                        });
                    }
                }
            }
        }
    }

    // Execute movements in batch
    if (movementOperations.length > 0) {
        await tx.stockMovement.createMany({ data: movementOperations });
    }
};

let update = async (purchaseReturn: PurchaseReturnInput, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const { id, ...updateData } = purchaseReturn;

        if (!id) {
            throw new RequestValidateError('Purchase return ID is required');
        }

        if (updateData.status === 'CANCELLED') {
            throw new RequestValidateError('Use the cancel endpoint to cancel a purchase return');
        }

        const existingPurchaseReturn = await tenantPrisma.purchaseReturn.findUnique({
            where: { id: id, deleted: false },
            select: {
                id: true,
                returnNumber: true,
                outletId: true,
                status: true,
                version: true,
                purchaseReturnItems: {
                    where: { deleted: false },
                    select: {
                        id: true,
                        itemId: true,
                        itemVariantId: true,
                        stockReceiptId: true,
                        quantity: true,
                        unitPrice: true,
                        returnReason: true,
                        remark: true
                    }
                }
            }
        });

        if (!existingPurchaseReturn) {
            throw new NotFoundError("Purchase Return");
        }

        // Use transaction for consistency
        const result = await tenantPrisma.$transaction(async (tx) => {
            const isBeingCancelled = updateData.status === 'CANCELLED';
            const wasAlreadyCancelled = existingPurchaseReturn.status === 'CANCELLED';

            // Only reverse stock if changing TO cancelled (not if already cancelled)
            const shouldReverseStock = isBeingCancelled && !wasAlreadyCancelled;

            // Prepare update data - only include defined fields
            const updateFields: any = {
                version: { increment: 1 }
            };

            // Only update allowed fields (remark, performedBy, status)
            if (updateData.remark !== undefined) updateFields.remark = updateData.remark;
            if (updateData.performedBy !== undefined) updateFields.performedBy = updateData.performedBy;
            if (updateData.status !== undefined) updateFields.status = updateData.status;

            // Update purchase return
            const updatedPurchaseReturn = await tx.purchaseReturn.update({
                where: { id: id },
                data: updateFields
            });

            // Handle stock reversal if purchase return is being cancelled
            if (shouldReverseStock && existingPurchaseReturn.purchaseReturnItems.length > 0) {
                await reverseStockOperationsForCancellation(
                    tx,
                    existingPurchaseReturn.purchaseReturnItems,
                    { ...updatedPurchaseReturn, outletId: existingPurchaseReturn.outletId },
                    updateData.performedBy || "SYSTEM"
                );
            }

            // Return updated purchase return with items
            return await tx.purchaseReturn.findUnique({
                where: { id: id },
                include: {
                    purchaseReturnItems: {
                        where: { deleted: false },
                        include: {
                            item: {
                                select: {
                                    id: true,
                                    itemName: true,
                                    itemCode: true,
                                    unitOfMeasure: true
                                }
                            }
                        }
                    },
                    invoice: {
                        select: {
                            id: true,
                            invoiceNumber: true
                        }
                    },
                    supplier: {
                        select: {
                            id: true,
                            companyName: true
                        }
                    }
                }
            });
        });

        return result;
    }
    catch (error) {
        throw error;
    }
}

let deletePurchaseReturn = async (id: number, databaseName: string, performedBy?: string): Promise<string> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const existingPurchaseReturn = await tenantPrisma.purchaseReturn.findUnique({
            where: { id: id, deleted: false },
            include: {
                purchaseReturnItems: {
                    where: { deleted: false }
                }
            }
        });

        if (!existingPurchaseReturn) {
            throw new NotFoundError("Purchase Return");
        }

        if (existingPurchaseReturn.status === 'CANCELLED') {
            throw new RequestValidateError('Purchase return is already cancelled');
        }

        // Use transaction to ensure consistency
        await tenantPrisma.$transaction(async (tx) => {
            // Reverse stock operations
            if (existingPurchaseReturn.purchaseReturnItems.length > 0) {
                await reverseStockOperationsForCancellation(
                    tx,
                    existingPurchaseReturn.purchaseReturnItems,
                    existingPurchaseReturn,
                    performedBy || "SYSTEM"
                );
            }

            // Soft delete purchase return items first
            await tx.purchaseReturnItem.updateMany({
                where: {
                    purchaseReturnId: id,
                    deleted: false
                },
                data: {
                    deleted: true,
                    deletedAt: new Date()
                }
            });

            // Soft delete and mark as cancelled
            await tx.purchaseReturn.update({
                where: { id: id },
                data: {
                    deleted: true,
                    deletedAt: new Date(),
                    status: 'CANCELLED',
                    cancelledBy: performedBy || "SYSTEM",
                    cancelledAt: new Date(),
                    cancelReason: 'Deleted',
                    version: { increment: 1 }
                }
            });
        });

        return `Purchase return ${existingPurchaseReturn.returnNumber} cancelled successfully`;
    }
    catch (error) {
        throw error;
    }
}

let cancel = async (id: number, cancelData: CancelPurchaseReturnInput, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const existingPurchaseReturn = await tenantPrisma.purchaseReturn.findUnique({
            where: { id: id, deleted: false },
            select: {
                id: true,
                returnNumber: true,
                outletId: true,
                status: true,
                version: true,
                purchaseReturnItems: {
                    where: { deleted: false },
                    select: {
                        id: true,
                        itemId: true,
                        itemVariantId: true,
                        stockReceiptId: true,
                        quantity: true,
                        unitPrice: true,
                        returnReason: true,
                        remark: true
                    }
                }
            }
        });

        if (!existingPurchaseReturn) {
            throw new NotFoundError("Purchase Return");
        }

        if (existingPurchaseReturn.status === 'CANCELLED') {
            throw new RequestValidateError('Purchase return is already cancelled');
        }

        const result = await tenantPrisma.$transaction(async (tx) => {
            // Update status to CANCELLED with audit fields
            const updatedPurchaseReturn = await tx.purchaseReturn.update({
                where: { id: id },
                data: {
                    status: 'CANCELLED',
                    cancelledBy: cancelData.performedBy || "SYSTEM",
                    cancelledAt: cancelData.cancelledAt ? new Date(cancelData.cancelledAt) : new Date(),
                    cancelReason: cancelData.cancelReason || null,
                    version: { increment: 1 }
                }
            });

            // Reverse stock operations
            if (existingPurchaseReturn.purchaseReturnItems.length > 0) {
                await reverseStockOperationsForCancellation(
                    tx,
                    existingPurchaseReturn.purchaseReturnItems,
                    { ...updatedPurchaseReturn, outletId: existingPurchaseReturn.outletId },
                    cancelData.performedBy || "SYSTEM"
                );
            }

            // Return updated record with full details
            return await tx.purchaseReturn.findUnique({
                where: { id: id },
                include: {
                    purchaseReturnItems: {
                        where: { deleted: false },
                        include: {
                            item: {
                                select: {
                                    id: true,
                                    itemName: true,
                                    itemCode: true,
                                    unitOfMeasure: true
                                }
                            }
                        }
                    },
                    invoice: {
                        select: {
                            id: true,
                            invoiceNumber: true
                        }
                    },
                    supplier: {
                        select: {
                            id: true,
                            companyName: true
                        }
                    }
                }
            });
        });

        return result;
    }
    catch (error) {
        throw error;
    }
}

export = { getAll, getById, getByDateRange, getByInvoiceId, createMany, update, cancel, deletePurchaseReturn };
