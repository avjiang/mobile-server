import { Prisma, PrismaClient, StockBalance, StockMovement, DeliveryOrder } from "@prisma/client"
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
                    }
                }
            })
        ]);

        // Transform response to maintain backward compatibility
        const enrichedDeliveryOrders = deliveryOrders.map(do_ => ({
            ...do_,
            itemCount: do_._count.deliveryOrderItems,
            purchaseOrderNumber: do_.purchaseOrder?.purchaseOrderNumber || null,
            purchaseOrderDate: do_.purchaseOrder?.purchaseOrderDate || null,
            _count: undefined,
            purchaseOrder: undefined
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
                        remark: true,
                        createdAt: true,
                        updatedAt: true
                    }
                },
            }
        });

        if (!deliveryOrder) {
            throw new NotFoundError("Delivery Order");
        }
        return deliveryOrder;
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
            const createdDeliveryOrders = [];

            for (const deliveryOrderData of deliveryOrders) {
                // Create delivery order
                const newDeliveryOrder = await tx.deliveryOrder.create({
                    data: {
                        outletId: deliveryOrderData.outletId,
                        customerId: deliveryOrderData.customerId,
                        purchaseOrderId: deliveryOrderData.purchaseOrderId,
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

        return result;
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
            const previousAvailableQuantity = currentBalance?.availableQuantity || 0;
            const previousOnHandQuantity = currentBalance?.onHandQuantity || 0;
            const quantityDelta = item.receivedQuantity;

            // Prepare stock balance operation - fix the where clause
            stockOperations.push({
                where: {
                    itemId_outletId_reorderThreshold_deleted_availableQuantity: {
                        itemId: item.itemId,
                        outletId: deliveryOrder.outletId,
                        reorderThreshold: currentBalance?.reorderThreshold ?? 0,
                        deleted: false,
                        availableQuantity: previousAvailableQuantity // Use current quantity, not new quantity
                    }
                },
                update: {
                    availableQuantity: previousAvailableQuantity + quantityDelta,
                    onHandQuantity: previousOnHandQuantity + quantityDelta,
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

            // Prepare movement operation
            movementOperations.push({
                itemId: item.itemId,
                outletId: deliveryOrder.outletId,
                previousAvailableQuantity: previousAvailableQuantity,
                previousOnHandQuantity: previousOnHandQuantity,
                availableQuantityDelta: quantityDelta,
                onHandQuantityDelta: quantityDelta,
                movementType: 'DELIVERY_RECEIPT',
                documentId: deliveryOrder.id,
                reason: 'Stock received from delivery order',
                remark: item.remark || `Delivery Order #${deliveryOrder.id}`,
                performedBy: performedBy || 'SYSTEM'
            });

            // Prepare receipt operation with cost from delivery order item
            receiptOperations.push({
                itemId: item.itemId,
                outletId: deliveryOrder.outletId,
                quantity: quantityDelta,
                cost: item.unitPrice || 0,
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
                                    sku: true,
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

// Updated helper function with partial delivery logic
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

    // Create maps for O(1) lookup
    const orderedMap = new Map(orderData.map(item => [item.itemId, item._sum.quantity || 0]));
    const receivedMap = new Map(deliveryData.map(item => [item.itemId, item._sum.receivedQuantity || 0]));

    if (orderedMap.size === 0) return; // No items to check

    let hasAnyDelivery = false;
    let allItemsFullyDelivered = true;

    // Check delivery status for each item
    Array.from(orderedMap.entries()).forEach(([itemId, orderedQty]) => {
        const receivedQty = receivedMap.get(itemId) || 0;

        if (receivedQty > 0) {
            hasAnyDelivery = true;
        }

        if (receivedQty < orderedQty) {
            allItemsFullyDelivered = false;
        }
    });

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

export = { getAll, getById, createMany, update };