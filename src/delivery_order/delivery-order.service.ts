import { Prisma, PrismaClient, StockBalance, StockMovement, DeliveryOrder } from "../../prisma/client/generated/client"
import { Decimal } from 'decimal.js';
import { NotFoundError, VersionMismatchDetail, VersionMismatchError } from "../api-helpers/error"
import { getTenantPrisma } from '../db';
import { } from '../db';
import { SyncRequest } from "src/item/item.request";
import { create } from "domain";
import { CreateDeliveryOrderRequestBody, DeliveryOrderInput } from "./delivery-order.request";

class RequestValidateError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RequestValidateError';
    }
}

let getAll = async (
    databaseName: string,
    syncRequest: SyncRequest
): Promise<{ deliveryOrders: any[]; total: number; serverTimestamp: string }> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { lastSyncTimestamp, outletId, skip = 0, take = 100 } = syncRequest;

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

        const where = {
            outletId: parsedOutletId,
            deleted: false,
            OR: [
                { createdAt: { gte: lastSync } },
                { updatedAt: { gte: lastSync } },
                { deletedAt: { gte: lastSync } },
                // Delivery order has delivery order items that were modified
                {
                    deliveryOrderItems: {
                        some: {
                            OR: [
                                { createdAt: { gte: lastSync } },
                                { updatedAt: { gte: lastSync } },
                                { deletedAt: { gte: lastSync } }
                            ]
                        }
                    }
                },
                // Delivery order has invoice that was modified
                {
                    invoice: {
                        OR: [
                            { createdAt: { gte: lastSync } },
                            { updatedAt: { gte: lastSync } },
                            { deletedAt: { gte: lastSync } }
                        ]
                    }
                },
                // Delivery order has invoice settlement that was modified
                {
                    invoice: {
                        invoiceSettlement: {
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

        // Execute count and fetch in parallel for better performance
        const [total, deliveryOrders] = await Promise.all([
            tenantPrisma.deliveryOrder.count({ where }),
            tenantPrisma.deliveryOrder.findMany({
                where,
                skip,
                take,
                select: {
                    id: true,
                    outletId: true,
                    customerId: true,
                    purchaseOrderId: true,
                    invoiceId: true, // Add invoiceId field
                    supplierId: true, // Add supplierId field
                    deliveryDate: true,
                    deliveryStreet: true,
                    deliveryCity: true,
                    deliveryState: true,
                    deliveryPostalCode: true,
                    deliveryCountry: true,
                    trackingNumber: true,
                    status: true,
                    remark: true,
                    performedBy: true,
                    version: true,
                    createdAt: true,
                    updatedAt: true,
                    deletedAt: true,
                    _count: {
                        select: {
                            deliveryOrderItems: {
                                where: { deleted: false }
                            }
                        }
                    },
                    purchaseOrder: {
                        select: {
                            id: true,
                            purchaseOrderNumber: true,
                            purchaseOrderDate: true
                        },
                        where: { deleted: false }
                    },
                    invoice: { // Update to singular invoice relationship
                        select: {
                            id: true,
                            invoiceNumber: true,
                            invoiceDate: true,
                            invoiceSettlement: {
                                select: {
                                    id: true,
                                    settlementNumber: true,
                                    settlementDate: true
                                },
                                where: { deleted: false }
                            }
                        },
                        where: { deleted: false }
                    }
                }
            })
        ]);

        // Remove the batch invoice counting logic since we now get invoice directly
        // Transform response to maintain backward compatibility
        const enrichedDeliveryOrders = deliveryOrders.map(do_ => ({
            ...do_,
            itemCount: do_._count.deliveryOrderItems,
            purchaseOrderNumber: do_.purchaseOrder?.purchaseOrderNumber || null,
            purchaseOrderDate: do_.purchaseOrder?.purchaseOrderDate || null,
            invoiceNumber: do_.invoice?.invoiceNumber || null,
            invoiceDate: do_.invoice?.invoiceDate || null,
            invoiceSettlementId: do_.invoice?.invoiceSettlement?.id || null,
            invoiceSettlementNumber: do_.invoice?.invoiceSettlement?.settlementNumber || null,
            invoiceSettlementDate: do_.invoice?.invoiceSettlement?.settlementDate || null,
            _count: undefined,
            purchaseOrder: undefined,
            invoice: undefined
        }));

        return {
            deliveryOrders: enrichedDeliveryOrders,
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
        const deliveryOrder = await tenantPrisma.deliveryOrder.findUnique({
            where: {
                id: id,
                deleted: false
            },
            include: {
                deliveryOrderItems: {
                    where: { deleted: false },
                    select: {
                        id: true,
                        itemId: true,
                        orderedQuantity: true,
                        receivedQuantity: true,
                        unitPrice: true,
                        deliveryFee: true,
                        remark: true,
                        createdAt: true,
                        updatedAt: true,
                    }
                },
                purchaseOrder: {
                    where: { deleted: false },
                    select: {
                        id: true,
                        purchaseOrderNumber: true,
                        purchaseOrderDate: true,
                        discountType: true,
                        discountAmount: true,
                        serviceChargeAmount: true,
                        taxAmount: true,
                        roundingAmount: true,
                        subtotalAmount: true,
                        totalAmount: true,
                        status: true,
                        remark: true,
                        currency: true,
                        supplierId: true,
                        purchaseOrderItems: {
                            where: { deleted: false },
                            select: {
                                id: true,
                                itemId: true,
                                quantity: true,
                                taxAmount: true,
                                unitPrice: true,
                                subtotal: true,
                            }
                        }
                    }
                },
                invoice: {
                    where: { deleted: false },
                    select: {
                        id: true,
                        invoiceNumber: true,
                        invoiceDate: true,
                        taxInvoiceNumber: true,
                        dueDate: true,
                        paymentDate: true,
                        subtotalAmount: true,
                        taxAmount: true,
                        discountType: true,
                        discountAmount: true,
                        totalAmount: true,
                        currency: true,
                        status: true,
                        remark: true,
                        supplier: {
                            select: {
                                id: true,
                                companyName: true,
                                mobile: true,
                                email: true
                            }
                        },
                        invoiceItems: {
                            where: { deleted: false },
                            select: {
                                id: true,
                                itemId: true,
                                quantity: true,
                                taxAmount: true,
                                unitPrice: true,
                                subtotal: true,
                            }
                        }
                    }
                }
            }
        });

        if (!deliveryOrder) {
            throw new NotFoundError("Delivery Order");
        }

        // Get invoiceSettlement with linked invoices if invoice exists
        let invoiceSettlement = null;
        if (deliveryOrder.invoice?.id) {
            const invoice = await tenantPrisma.invoice.findUnique({
                where: { id: deliveryOrder.invoice.id },
                select: {
                    invoiceSettlement: {
                        where: { deleted: false },
                        select: {
                            id: true,
                            settlementNumber: true,
                            settlementDate: true,
                            settlementType: true,
                            paymentMethod: true,
                            settlementAmount: true,
                            currency: true,
                            exchangeRate: true,
                            reference: true,
                            remark: true,
                            status: true,
                            performedBy: true,
                            totalRebateAmount: true,
                            rebateReason: true,
                            totalInvoiceCount: true,
                            totalInvoiceAmount: true,
                            createdAt: true,
                            updatedAt: true
                        }
                    }
                }
            });

            // If invoice settlement exists, get all linked invoices with minimal info
            if (invoice?.invoiceSettlement) {
                const invoices = await tenantPrisma.invoice.findMany({
                    where: {
                        invoiceSettlementId: invoice.invoiceSettlement.id,
                        deleted: false
                    },
                    select: {
                        invoiceNumber: true,
                        subtotalAmount: true,
                        totalAmount: true,
                        status: true,
                        taxInvoiceNumber: true
                    }
                });

                invoiceSettlement = {
                    ...invoice.invoiceSettlement,
                    invoices
                };
            }
        }

        // Transform the response to include enhanced invoiceSettlement
        const transformedResult = {
            ...deliveryOrder,
            invoiceSettlement
        };

        return transformedResult;
    }
    catch (error) {
        throw error;
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

        // Build query conditions with date range for delivery orders
        const where = {
            outletId: parsedOutletId,
            deliveryDate: {
                gte: parsedStartDate,
                lte: parsedEndDate
            },
            deleted: false,
            OR: [
                // Delivery order itself was modified
                { createdAt: { gte: lastSync } },
                { updatedAt: { gte: lastSync } },
                { deletedAt: { gte: lastSync } },
                // Delivery order has delivery order items that were modified
                {
                    deliveryOrderItems: {
                        some: {
                            OR: [
                                { createdAt: { gte: lastSync } },
                                { updatedAt: { gte: lastSync } },
                                { deletedAt: { gte: lastSync } }
                            ]
                        }
                    }
                },
                // Delivery order has invoice that was modified
                {
                    invoice: {
                        OR: [
                            { createdAt: { gte: lastSync } },
                            { updatedAt: { gte: lastSync } },
                            { deletedAt: { gte: lastSync } }
                        ]
                    }
                },
                // Delivery order has invoice settlement that was modified
                {
                    invoice: {
                        invoiceSettlement: {
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

        // Count total matching records
        const total = await tenantPrisma.deliveryOrder.count({ where });

        // Fetch paginated delivery orders with minimal data
        const deliveryOrders = await tenantPrisma.deliveryOrder.findMany({
            where,
            skip,
            take,
            select: {
                id: true,
                outletId: true,
                customerId: true,
                purchaseOrderId: true,
                invoiceId: true,
                supplierId: true, // Add supplierId field
                deliveryDate: true,
                deliveryStreet: true,
                deliveryCity: true,
                deliveryState: true,
                deliveryPostalCode: true,
                deliveryCountry: true,
                trackingNumber: true,
                status: true,
                remark: true,
                performedBy: true,
                version: true,
                createdAt: true,
                updatedAt: true,
                deletedAt: true,
                _count: {
                    select: {
                        deliveryOrderItems: {
                            where: { deleted: false }
                        }
                    }
                },
                purchaseOrder: {
                    select: {
                        id: true,
                        purchaseOrderNumber: true,
                        purchaseOrderDate: true
                    },
                    where: { deleted: false }
                },
                invoice: { // Update to singular relationship
                    select: {
                        id: true,
                        invoiceNumber: true,
                        invoiceDate: true,
                        invoiceSettlement: {
                            select: {
                                id: true,
                                settlementNumber: true,
                                settlementDate: true
                            },
                            where: { deleted: false }
                        }
                    },
                    where: { deleted: false }
                }
            }
        });

        // Remove batch invoice counting since we get invoice directly
        // Enrich delivery orders with counts
        const enrichedDeliveryOrders = deliveryOrders.map(do_ => ({
            ...do_,
            itemCount: do_._count.deliveryOrderItems,
            purchaseOrderNumber: do_.purchaseOrder?.purchaseOrderNumber || null,
            purchaseOrderDate: do_.purchaseOrder?.purchaseOrderDate || null,
            invoiceNumber: do_.invoice?.invoiceNumber || null,
            invoiceDate: do_.invoice?.invoiceDate || null,
            invoiceSettlementId: do_.invoice?.invoiceSettlement?.id || null,
            invoiceSettlementNumber: do_.invoice?.invoiceSettlement?.settlementNumber || null,
            invoiceSettlementDate: do_.invoice?.invoiceSettlement?.settlementDate || null,
            _count: undefined,
            purchaseOrder: undefined,
            invoice: undefined
        }));

        return {
            deliveryOrders: enrichedDeliveryOrders,
            total,
            serverTimestamp: new Date().toISOString(),
        };
    }
    catch (error) {
        throw error;
    }
}

let createMany = async (databaseName: string, requestBody: CreateDeliveryOrderRequestBody): Promise<DeliveryOrder[]> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const { deliveryOrders } = requestBody;

        if (!deliveryOrders || !Array.isArray(deliveryOrders)) {
            throw new RequestValidateError('deliveryOrders must be a non-empty array');
        }

        // Extract unique IDs for batch validation
        const outletIds = [...new Set(deliveryOrders.map(do_ => do_.outletId).filter(Boolean))];
        const customerIds = [...new Set(deliveryOrders.map(do_ => do_.customerId).filter((id): id is number => typeof id === 'number'))];
        const purchaseOrderIds = [...new Set(deliveryOrders.map(do_ => do_.purchaseOrderId).filter((id): id is number => typeof id === 'number'))];

        // Batch validation in parallel for better performance
        const validationPromises = [];

        if (outletIds.length > 0) {
            validationPromises.push(
                tenantPrisma.outlet.findMany({
                    where: { id: { in: outletIds }, deleted: false },
                    select: { id: true }
                }).then(outlets => ({ type: 'outlets', existing: outlets.map(o => o.id), requested: outletIds }))
            );
        }

        if (customerIds.length > 0) {
            validationPromises.push(
                tenantPrisma.customer.findMany({
                    where: { id: { in: customerIds }, deleted: false },
                    select: { id: true }
                }).then(customers => ({ type: 'customers', existing: customers.map(c => c.id), requested: customerIds }))
            );
        }

        if (purchaseOrderIds.length > 0) {
            validationPromises.push(
                tenantPrisma.purchaseOrder.findMany({
                    where: { id: { in: purchaseOrderIds }, deleted: false },
                    select: { id: true }
                }).then(pos => ({ type: 'purchaseOrders', existing: pos.map(po => po.id), requested: purchaseOrderIds }))
            );
        }

        // Execute all validations in parallel
        const validationResults = await Promise.all(validationPromises);

        // Process validation results
        for (const result of validationResults) {
            const existingIds = new Set(result.existing);
            const missingIds = result.requested.filter((id: number) => !existingIds.has(id));

            if (missingIds.length > 0) {
                const entityName = result.type.charAt(0).toUpperCase() + result.type.slice(1, -1); // Remove 's' and capitalize
                throw new RequestValidateError(`${entityName} with IDs ${missingIds.join(', ')} do not exist`);
            }
        }

        // Use single transaction for all creations
        const result = await tenantPrisma.$transaction(async (tx) => {
            const createdDeliveryOrders: any[] = [];

            for (const deliveryOrderData of deliveryOrders) {
                // Create delivery order
                const newDeliveryOrder = await tx.deliveryOrder.create({
                    data: {
                        outletId: deliveryOrderData.outletId,
                        customerId: deliveryOrderData.customerId,
                        purchaseOrderId: deliveryOrderData.purchaseOrderId,
                        supplierId: deliveryOrderData.supplierId || null,
                        sessionId: deliveryOrderData.sessionId || null,
                        deliveryDate: deliveryOrderData.deliveryDate,
                        deliveryStreet: deliveryOrderData.deliveryStreet,
                        deliveryCity: deliveryOrderData.deliveryCity,
                        deliveryState: deliveryOrderData.deliveryState,
                        deliveryPostalCode: deliveryOrderData.deliveryPostalCode,
                        deliveryCountry: deliveryOrderData.deliveryCountry,
                        trackingNumber: deliveryOrderData.trackingNumber,
                        status: deliveryOrderData.status || 'PENDING',
                        remark: deliveryOrderData.remark,
                        performedBy: deliveryOrderData.performedBy
                    }
                });

                let deliveryOrderItems: any[] = [];

                // Create delivery order items if provided
                if (deliveryOrderData.deliveryOrderItems && Array.isArray(deliveryOrderData.deliveryOrderItems) && deliveryOrderData.deliveryOrderItems.length > 0) {
                    await tx.deliveryOrderItem.createMany({
                        data: deliveryOrderData.deliveryOrderItems.map((item) => ({
                            deliveryOrderId: newDeliveryOrder.id,
                            itemId: item.itemId,
                            orderedQuantity: item.orderedQuantity,
                            receivedQuantity: item.receivedQuantity,
                            unitPrice: item.unitPrice,
                            deliveryFee: item.deliveryFee || 0, // Handle optional delivery fee
                            remark: item.remark || null,
                        })),
                    });

                    deliveryOrderItems = await tx.deliveryOrderItem.findMany({
                        where: { deliveryOrderId: newDeliveryOrder.id },
                    });

                    // Batch stock operations for better performance
                    await updateStockBalancesAndMovements(tx, deliveryOrderData.deliveryOrderItems, newDeliveryOrder, deliveryOrderData.performedBy || "Cashier");

                    // Check purchase order status with partial delivery support
                    if (newDeliveryOrder.purchaseOrderId) {
                        await checkAndUpdatePurchaseOrderStatusWithPartialDelivery(tx, newDeliveryOrder.purchaseOrderId);
                    }
                }

                createdDeliveryOrders.push({
                    ...newDeliveryOrder,
                    deliveryOrderItems
                });
            }

            return createdDeliveryOrders;
        });

        return result as DeliveryOrder[];
    }
    catch (error) {
        throw error
    }
}

// Optimized helper function for batch stock operations
const updateStockBalancesAndMovements = async (tx: Prisma.TransactionClient, items: any[], deliveryOrder: any, performedBy: string) => {
    const stockOperations = [];
    const movementOperations = [];
    const receiptOperations = [];

    // Get all current stock balances in one query
    const currentStockBalances = await tx.stockBalance.findMany({
        where: {
            itemId: { in: items.map(item => item.itemId) },
            outletId: deliveryOrder.outletId,
            deleted: false
        }
    });

    const stockBalanceMap = new Map();
    currentStockBalances.forEach((balance: any) => {
        stockBalanceMap.set(balance.itemId, balance);
    });

    for (const item of items) {
        if (item.receivedQuantity > 0) {
            const currentBalance = stockBalanceMap.get(item.itemId);
            // Convert to Decimal objects for proper arithmetic
            const previousAvailableQuantity = new Decimal(currentBalance?.availableQuantity || 0);
            const previousOnHandQuantity = new Decimal(currentBalance?.onHandQuantity || 0);
            const quantityDelta = new Decimal(item.receivedQuantity);

            // Use Decimal.add() for proper arithmetic
            const newAvailableQuantity = previousAvailableQuantity.add(quantityDelta);
            const newOnHandQuantity = previousOnHandQuantity.add(quantityDelta);

            const deliveryFee = new Decimal(item.deliveryFee || 0);
            const unitPrice = new Decimal(item.unitPrice || 0);
            const subtotalCost = unitPrice.plus(deliveryFee);

            // Fix stock balance operation to match the actual unique constraint
            stockOperations.push({
                where: {
                    itemId_outletId_reorderThreshold_deleted_availableQuantity: {
                        itemId: item.itemId,
                        outletId: deliveryOrder.outletId,
                        reorderThreshold: currentBalance?.reorderThreshold ?? null,
                        deleted: false,
                        availableQuantity: previousAvailableQuantity
                    }
                },
                update: {
                    availableQuantity: newAvailableQuantity,
                    onHandQuantity: newOnHandQuantity,
                    lastRestockDate: new Date(),
                    updatedAt: new Date()
                },
                create: {
                    itemId: item.itemId,
                    outletId: deliveryOrder.outletId,
                    availableQuantity: quantityDelta,
                    onHandQuantity: quantityDelta,
                    reorderThreshold: null,
                    lastRestockDate: new Date()
                }
            });

            // Prepare movement operation - convert Decimal to number for storage
            movementOperations.push({
                itemId: item.itemId,
                outletId: deliveryOrder.outletId,
                previousAvailableQuantity: previousAvailableQuantity,
                previousOnHandQuantity: previousOnHandQuantity,
                availableQuantityDelta: quantityDelta,
                onHandQuantityDelta: quantityDelta,
                movementType: 'DELIVERY_RECEIPT',
                documentId: deliveryOrder.id,
                reason: `Stock received from delivery order #${deliveryOrder.id}`,
                remark: item.remark || '',
                performedBy: performedBy || 'SYSTEM'
            });

            // Prepare receipt operation with cost from delivery order item
            receiptOperations.push({
                itemId: item.itemId,
                outletId: deliveryOrder.outletId,
                quantity: quantityDelta,
                cost: subtotalCost,
                receiptDate: new Date()
            });
        }
    }

    // Execute stock balance upserts sequentially to avoid unique constraint conflicts
    for (const stockOp of stockOperations) {
        await tx.stockBalance.upsert(stockOp);
    }

    // Execute movements and receipts in batch
    await Promise.all([
        movementOperations.length > 0 ? tx.stockMovement.createMany({ data: movementOperations }) : Promise.resolve(),
        receiptOperations.length > 0 ? tx.stockReceipt.createMany({ data: receiptOperations }) : Promise.resolve()
    ]);
};

let update = async (deliveryOrder: DeliveryOrderInput, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const { id, ...updateData } = deliveryOrder;

        if (!id) {
            throw new RequestValidateError('Delivery order ID is required');
        }

        // Single query to get existing delivery order
        const existingDeliveryOrder = await tenantPrisma.deliveryOrder.findUnique({
            where: { id: id, deleted: false },
            select: {
                id: true,
                outletId: true,
                customerId: true,
                purchaseOrderId: true,
                version: true,
                deliveryOrderItems: {
                    where: { deleted: false },
                    select: { id: true }
                }
            }
        });

        if (!existingDeliveryOrder) {
            throw new NotFoundError("Delivery Order");
        }

        // Batch validation queries in parallel
        const validationPromises = [];

        if (updateData.outletId && updateData.outletId !== existingDeliveryOrder.outletId) {
            validationPromises.push(
                tenantPrisma.outlet.findFirst({
                    where: { id: updateData.outletId, deleted: false },
                    select: { id: true }
                }).then(outlet => ({ type: 'outlet', exists: !!outlet, id: updateData.outletId }))
            );
        }

        if (updateData.customerId && updateData.customerId !== existingDeliveryOrder.customerId) {
            validationPromises.push(
                tenantPrisma.customer.findFirst({
                    where: { id: updateData.customerId, deleted: false },
                    select: { id: true }
                }).then(customer => ({ type: 'customer', exists: !!customer, id: updateData.customerId }))
            );
        }

        if (updateData.purchaseOrderId && updateData.purchaseOrderId !== existingDeliveryOrder.purchaseOrderId) {
            validationPromises.push(
                tenantPrisma.purchaseOrder.findFirst({
                    where: { id: updateData.purchaseOrderId, deleted: false },
                    select: { id: true }
                }).then(purchaseOrder => ({ type: 'purchaseOrder', exists: !!purchaseOrder, id: updateData.purchaseOrderId }))
            );
        }

        if (updateData.deliveryOrderItems && Array.isArray(updateData.deliveryOrderItems)) {
            const itemIds = [...new Set(updateData.deliveryOrderItems.map(item => item.itemId).filter(Boolean))];
            if (itemIds.length > 0) {
                validationPromises.push(
                    tenantPrisma.item.findMany({
                        where: { id: { in: itemIds }, deleted: false },
                        select: { id: true }
                    }).then(items => ({
                        type: 'items',
                        existing: items.map(item => item.id),
                        requested: itemIds
                    }))
                );
            }
        }

        // Execute validations in parallel
        if (validationPromises.length > 0) {
            const validationResults = await Promise.all(validationPromises);

            for (const result of validationResults) {
                if (result.type === 'items' && 'existing' in result && 'requested' in result) {
                    const existingItemIds = new Set<number>(result.existing);
                    const missingItemIds = result.requested.filter((id: number) => !existingItemIds.has(id));
                    if (missingItemIds.length > 0) {
                        throw new RequestValidateError(`Items with IDs ${missingItemIds.join(', ')} do not exist`);
                    }
                } else if ('exists' in result && !result.exists) {
                    throw new RequestValidateError(`${result.type} with ID ${result.id} does not exist`);
                }
            }
        }

        // Use transaction for consistency
        const result = await tenantPrisma.$transaction(async (tx) => {
            // Update delivery order
            const updatedDeliveryOrder = await tx.deliveryOrder.update({
                where: { id: id },
                data: {
                    outletId: updateData.outletId,
                    customerId: updateData.customerId,
                    purchaseOrderId: updateData.purchaseOrderId,
                    deliveryDate: updateData.deliveryDate,
                    deliveryStreet: updateData.deliveryStreet,
                    deliveryCity: updateData.deliveryCity,
                    deliveryState: updateData.deliveryState,
                    deliveryPostalCode: updateData.deliveryPostalCode,
                    deliveryCountry: updateData.deliveryCountry,
                    trackingNumber: updateData.trackingNumber,
                    status: updateData.status,
                    remark: updateData.remark,
                    performedBy: updateData.performedBy,
                    version: { increment: 1 }
                }
            });

            // Handle delivery order items efficiently
            if (updateData.deliveryOrderItems && Array.isArray(updateData.deliveryOrderItems)) {
                // Use deleteMany for better performance
                await tx.deliveryOrderItem.deleteMany({
                    where: { deliveryOrderId: id, deleted: false }
                });

                if (updateData.deliveryOrderItems.length > 0) {
                    await tx.deliveryOrderItem.createMany({
                        data: updateData.deliveryOrderItems.map(item => ({
                            deliveryOrderId: id,
                            itemId: item.itemId,
                            orderedQuantity: item.orderedQuantity,
                            receivedQuantity: item.receivedQuantity,
                            unitPrice: item.unitPrice,
                            deliveryFee: item.deliveryFee || 0, // Handle optional delivery fee
                            remark: item.remark || null,
                            updatedAt: new Date()
                        }))
                    });
                }

                if (updatedDeliveryOrder.purchaseOrderId) {
                    await checkAndUpdatePurchaseOrderStatus(tx, updatedDeliveryOrder.purchaseOrderId);
                }
            }

            // Single optimized query for final result
            return await tx.deliveryOrder.findUnique({
                where: { id: id },
                include: {
                    purchaseOrder: {
                        select: {
                            id: true,
                            purchaseOrderNumber: true,
                            supplierId: true,
                            deleted: true
                        }
                    },
                    deliveryOrderItems: {
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

const checkAndUpdatePurchaseOrderStatusWithPartialDelivery = async (tx: Prisma.TransactionClient, purchaseOrderId: number) => {
    // Use a single query with aggregation for better performance
    const [orderData, deliveryData] = await Promise.all([
        tx.purchaseOrderItem.groupBy({
            by: ['itemId'],
            where: { purchaseOrderId: purchaseOrderId, deleted: false },
            _sum: { quantity: true }
        }),
        tx.deliveryOrderItem.groupBy({
            by: ['itemId'],
            where: {
                deliveryOrder: { purchaseOrderId: purchaseOrderId, deleted: false },
                deleted: false
            },
            _sum: { receivedQuantity: true }
        })
    ]);

    // Create maps for O(1) lookup - ensure all values are Decimal instances
    const orderedMap = new Map(
        orderData.map(item => [
            item.itemId,
            new Decimal(item._sum.quantity || 0)
        ])
    );

    const receivedMap = new Map(
        deliveryData.map(item => [
            item.itemId,
            new Decimal(item._sum.receivedQuantity || 0)
        ])
    );

    if (orderedMap.size === 0) return; // No items to check

    let hasAnyDelivery = false;
    let allItemsFullyDelivered = true;

    // Check delivery status for each item
    for (const [itemId, orderedQty] of orderedMap) {
        const receivedQty = receivedMap.get(itemId) || new Decimal(0);

        // Fix 1: Compare with Decimal zero instead of primitive 0
        if (receivedQty.gt(new Decimal(0))) {
            hasAnyDelivery = true;
        }

        // Fix 2: Compare Decimal objects directly
        if (receivedQty.lt(orderedQty)) {
            allItemsFullyDelivered = false;
        }
    }

    // Determine and update status
    let newStatus: string;
    if (allItemsFullyDelivered && hasAnyDelivery) {
        newStatus = 'DELIVERED';
    } else if (hasAnyDelivery) {
        newStatus = 'PARTIALLY DELIVERED';
    } else {
        return; // No deliveries yet, keep current status
    }

    await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: { status: newStatus, version: { increment: 1 } }
    });
};

// Update the existing function to use the new logic
const checkAndUpdatePurchaseOrderStatus = async (tx: Prisma.TransactionClient, purchaseOrderId: number) => {
    await checkAndUpdatePurchaseOrderStatusWithPartialDelivery(tx, purchaseOrderId);
};

export = { getAll, getById, getByDateRange, createMany, update };