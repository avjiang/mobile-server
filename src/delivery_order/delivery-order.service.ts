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

        // Build query conditions
        const where = {
            outletId: parsedOutletId,
            deleted: false,
            OR: [
                { createdAt: { gte: lastSync } },
                { updatedAt: { gte: lastSync } },
                { deletedAt: { gte: lastSync } },
            ],
        };
        // Count total matching records
        const total = await tenantPrisma.deliveryOrder.count({ where });

        // Fetch paginated delivery orders with minimal data
        const deliveryOrders = await tenantPrisma.deliveryOrder.findMany({
            where,
            skip,
            take,
            include: {
                _count: {
                    select: {
                        deliveryOrderItems: {
                            where: { deleted: false }
                        }
                    }
                }
            }
        });

        // Batch fetch delivery orders for all delivery orders (if needed for additional data)
        const deliveryOrderIds = deliveryOrders.map(do_ => do_.id);

        // Batch fetch purchase order for each delivery order (keeping purchase order fetch for reference)
        const purchaseOrders = await tenantPrisma.purchaseOrder.findMany({
            where: {
                id: { in: deliveryOrders.map(do_ => do_.purchaseOrderId).filter((id): id is number => typeof id === 'number') },
                deleted: false
            },
            select: {
                id: true,
                purchaseOrderNumber: true,
                purchaseOrderDate: true
            }
        });

        // Create lookup map for O(1) access
        const purchaseOrderMap = new Map();
        purchaseOrders.forEach(po => {
            purchaseOrderMap.set(po.id, po);
        });

        // Enrich delivery orders with purchase order info
        const enrichedDeliveryOrders = deliveryOrders.map(do_ => {
            const purchaseOrder = purchaseOrderMap.get(do_.purchaseOrderId);

            return {
                ...do_,
                itemCount: do_._count.deliveryOrderItems,
                purchaseOrderNumber: purchaseOrder?.purchaseOrderNumber || null,
                purchaseOrderDate: purchaseOrder?.purchaseOrderDate || null,
                _count: undefined // Remove the _count field from response
            };
        });

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
                    where: {
                        deleted: false
                    },
                },
            }
        });

        if (!deliveryOrder) {
            throw new NotFoundError("Delivery Order");
        }
        // Return delivery order with itemCount added
        return {
            ...deliveryOrder
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

        // Batch validate all outlets exist
        if (outletIds.length > 0) {
            const existingOutlets = await tenantPrisma.outlet.findMany({
                where: {
                    id: { in: outletIds },
                    deleted: false
                },
                select: { id: true }
            });
            const existingOutletIds = new Set(existingOutlets.map(o => o.id));
            const missingOutletIds = outletIds.filter(id => !existingOutletIds.has(id));

            if (missingOutletIds.length > 0) {
                throw new RequestValidateError(`Outlets with IDs ${missingOutletIds.join(', ')} do not exist`);
            }
        }

        // Batch validate all customers exist
        if (customerIds.length > 0) {
            const existingCustomers = await tenantPrisma.customer.findMany({
                where: {
                    id: { in: customerIds },
                    deleted: false
                },
                select: { id: true }
            });
            const existingCustomerIds = new Set(existingCustomers.map(c => c.id));
            const missingCustomerIds = customerIds.filter((id) => !existingCustomerIds.has(id));

            if (missingCustomerIds.length > 0) {
                throw new RequestValidateError(`Customers with IDs ${missingCustomerIds.join(', ')} do not exist`);
            }
        }

        // Batch validate all purchase orders exist
        if (purchaseOrderIds.length > 0) {
            const existingPurchaseOrders = await tenantPrisma.purchaseOrder.findMany({
                where: {
                    id: { in: purchaseOrderIds },
                    deleted: false
                },
                select: { id: true }
            });
            const existingPurchaseOrderIds = new Set(existingPurchaseOrders.map(po => po.id));
            const missingPurchaseOrderIds = purchaseOrderIds.filter((id) => !existingPurchaseOrderIds.has(id));

            if (missingPurchaseOrderIds.length > 0) {
                throw new RequestValidateError(`Purchase orders with IDs ${missingPurchaseOrderIds.join(', ')} do not exist`);
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
                    },
                    include: {
                        deliveryOrderItems: {
                            include: {
                                item: true
                            }
                        }
                    }
                });

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

                    // Fetch the created items to include in response
                    const deliveryOrderItems = await tx.deliveryOrderItem.findMany({
                        where: { deliveryOrderId: newDeliveryOrder.id },
                    });

                    createdDeliveryOrders.push({
                        ...newDeliveryOrder,
                        deliveryOrderItems
                    });
                } else {
                    createdDeliveryOrders.push(newDeliveryOrder);
                }
            }

            return createdDeliveryOrders;
        });

        return result;
    }
    catch (error) {
        throw error
    }
}

let update = async (deliveryOrder: DeliveryOrderInput, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const { id, ...updateData } = deliveryOrder;

        if (!id) {
            throw new RequestValidateError('Delivery order ID is required');
        }

        // Single query to get existing delivery order with related data
        const existingDeliveryOrder = await tenantPrisma.deliveryOrder.findUnique({
            where: {
                id: id,
                deleted: false
            },
            include: {
                deliveryOrderItems: {
                    where: { deleted: false }
                }
            }
        });

        if (!existingDeliveryOrder) {
            throw new NotFoundError("Delivery Order");
        }

        // Batch validation queries for better performance
        const validationPromises = [];

        // Validate outlet if being updated
        if (updateData.outletId && updateData.outletId !== existingDeliveryOrder.outletId) {
            validationPromises.push(
                tenantPrisma.outlet.findFirst({
                    where: { id: updateData.outletId, deleted: false },
                    select: { id: true }
                }).then(outlet => ({ type: 'outlet', exists: !!outlet, id: updateData.outletId }))
            );
        }

        // Validate customer if being updated
        if (updateData.customerId && updateData.customerId !== existingDeliveryOrder.customerId) {
            validationPromises.push(
                tenantPrisma.customer.findFirst({
                    where: { id: updateData.customerId, deleted: false },
                    select: { id: true }
                }).then(customer => ({ type: 'customer', exists: !!customer, id: updateData.customerId }))
            );
        }

        // Validate purchase order if being updated
        if (updateData.purchaseOrderId && updateData.purchaseOrderId !== existingDeliveryOrder.purchaseOrderId) {
            validationPromises.push(
                tenantPrisma.purchaseOrder.findFirst({
                    where: { id: updateData.purchaseOrderId, deleted: false },
                    select: { id: true }
                }).then(purchaseOrder => ({ type: 'purchaseOrder', exists: !!purchaseOrder, id: updateData.purchaseOrderId }))
            );
        }

        // Validate items if being updated
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

        // Execute all validations in parallel
        const validationResults = await Promise.all(validationPromises);

        // Process validation results
        for (const result of validationResults) {
            switch (result.type) {
                case 'outlet':
                    if ('exists' in result && 'id' in result && !result.exists) {
                        throw new RequestValidateError(`Outlet with ID ${result.id} does not exist`);
                    }
                    break;
                case 'customer':
                    if ('exists' in result && 'id' in result && !result.exists) {
                        throw new RequestValidateError(`Customer with ID ${result.id} does not exist`);
                    }
                    break;
                case 'purchaseOrder':
                    if ('exists' in result && 'id' in result && !result.exists) {
                        throw new RequestValidateError(`Purchase order with ID ${result.id} does not exist`);
                    }
                    break;
                case 'items':
                    if ('existing' in result && 'requested' in result) {
                        const existingItemIds = new Set<number>(result.existing);
                        const missingItemIds = result.requested.filter((id: number) => !existingItemIds.has(id));
                        if (missingItemIds.length > 0) {
                            throw new RequestValidateError(`Items with IDs ${missingItemIds.join(', ')} do not exist`);
                        }
                    }
                    break;
            }
        }

        // Use transaction to ensure data consistency
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

            // Handle delivery order items if provided
            if (updateData.deliveryOrderItems && Array.isArray(updateData.deliveryOrderItems)) {
                // Simple approach: delete all existing items and recreate
                // This ensures clean data and consistent updatedAt timestamps

                // 1. Hard delete all existing delivery order items
                await tx.deliveryOrderItem.deleteMany({
                    where: {
                        deliveryOrderId: id,
                        deleted: false
                    }
                });

                // 2. Create all new items (if any provided)
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
            }

            // Single query to fetch final result with all relationships
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

export = { getAll, getById, createMany, update };