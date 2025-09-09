import { Prisma, PrismaClient, StockBalance, StockMovement, PurchaseOrder } from "../../prisma/client/generated/client"
import { NotFoundError, VersionMismatchDetail, VersionMismatchError } from "../api-helpers/error"
import { getTenantPrisma } from '../db';
import Decimal from "decimal.js";
import { } from '../db';
import { SyncRequest } from "src/item/item.request";
import { create } from "domain";
import { CreatePurchaseOrderRequestBody, PurchaseOrderInput } from "./purchase-order.request";

class RequestValidateError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RequestValidateError';
    }
}

let getAll = async (
    databaseName: string,
    syncRequest: SyncRequest
): Promise<{ purchaseOrders: any[]; total: number; serverTimestamp: string }> => {
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

        // Build query conditions - include purchase orders that have changed OR have related entities that changed
        const where = {
            outletId: parsedOutletId,
            deleted: false,
            OR: [
                // Purchase order itself was modified
                { createdAt: { gte: lastSync } },
                { updatedAt: { gte: lastSync } },
                { deletedAt: { gte: lastSync } },
                // Purchase order has delivery orders that were modified
                {
                    deliveryOrders: {
                        some: {
                            OR: [
                                { createdAt: { gte: lastSync } },
                                { updatedAt: { gte: lastSync } },
                                { deletedAt: { gte: lastSync } }
                            ]
                        }
                    }
                },
                // Purchase order has invoices that were modified
                {
                    invoices: {
                        some: {
                            OR: [
                                { createdAt: { gte: lastSync } },
                                { updatedAt: { gte: lastSync } },
                                { deletedAt: { gte: lastSync } },
                                // Include invoices with modified settlements
                                {
                                    invoiceSettlement: {
                                        OR: [
                                            { createdAt: { gte: lastSync } },
                                            { updatedAt: { gte: lastSync } },
                                            { deletedAt: { gte: lastSync } }
                                        ]
                                    }
                                }
                            ]
                        }
                    }
                },
                // Purchase order has purchase order items that were modified
                {
                    purchaseOrderItems: {
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
        // Count total matching records
        const total = await tenantPrisma.purchaseOrder.count({ where });

        // Fetch paginated purchase orders with minimal data
        const purchaseOrders = await tenantPrisma.purchaseOrder.findMany({
            where,
            skip,
            take,
            include: {
                _count: {
                    select: {
                        purchaseOrderItems: {
                            where: { deleted: false }
                        }
                    }
                }
            }
        });

        // Batch fetch delivery orders and invoices for all purchase orders
        const purchaseOrderIds = purchaseOrders.map(po => po.id);

        // Count delivery orders for each purchase order
        const deliveryOrderCounts = await tenantPrisma.deliveryOrder.groupBy({
            by: ['purchaseOrderId'],
            where: {
                purchaseOrderId: { in: purchaseOrderIds },
                deleted: false
            },
            _count: {
                id: true
            }
        });

        // Count invoices for each purchase order and include settlement info
        const invoiceData = await tenantPrisma.invoice.findMany({
            where: {
                purchaseOrderId: { in: purchaseOrderIds },
                deleted: false
            },
            select: {
                id: true,
                purchaseOrderId: true,
                invoiceSettlementId: true,
                invoiceSettlement: {
                    select: {
                        id: true,
                        settlementNumber: true,
                        settlementDate: true,
                        status: true,
                        settlementAmount: true
                    }
                }
            }
        });

        // Create lookup maps for O(1) access
        const deliveryOrderCountMap = new Map();
        deliveryOrderCounts.forEach(doc => {
            deliveryOrderCountMap.set(doc.purchaseOrderId, doc._count.id);
        });

        // Process invoice data to create count and settlement maps
        const invoiceCountMap = new Map();
        const settlementInfoMap = new Map();

        purchaseOrderIds.forEach(poId => {
            const poInvoices = invoiceData.filter(inv => inv.purchaseOrderId === poId);

            // Count invoices
            invoiceCountMap.set(poId, poInvoices.length);

            // Count settled invoices and unique settlements
            const settledInvoices = poInvoices.filter(inv => inv.invoiceSettlement);
            const uniqueSettlements = new Set(
                settledInvoices
                    .map(inv => inv.invoiceSettlement?.id)
                    .filter(id => id !== undefined)
            );

            settlementInfoMap.set(poId, {
                settledInvoiceCount: settledInvoices.length,
                uniqueSettlementCount: uniqueSettlements.size
            });
        });

        // Enrich purchase orders with counts and settlement info
        const enrichedPurchaseOrders = purchaseOrders.map(po => {
            const deliveryOrderCount = deliveryOrderCountMap.get(po.id) || 0;
            const invoiceCount = invoiceCountMap.get(po.id) || 0;
            const settlementInfo = settlementInfoMap.get(po.id) || {
                settledInvoiceCount: 0,
                uniqueSettlementCount: 0
            };

            return {
                ...po,
                itemCount: po._count.purchaseOrderItems,
                deliveryOrderCount,
                invoiceCount,
                settledInvoiceCount: settlementInfo.uniqueSettlementCount,
                _count: undefined // Remove the _count field from response
            };
        });

        return {
            purchaseOrders: enrichedPurchaseOrders,
            total,
            serverTimestamp: new Date().toISOString(),
        };
    } catch (error) {
        throw error;
    }
};

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

        // Build query conditions with date range for purchase orders
        const where = {
            outletId: parsedOutletId,
            purchaseOrderDate: {
                gte: parsedStartDate,
                lte: parsedEndDate
            },
            deleted: false,
            OR: [
                // Purchase order itself was modified
                { createdAt: { gte: lastSync } },
                { updatedAt: { gte: lastSync } },
                { deletedAt: { gte: lastSync } },
                // Purchase order has delivery orders that were modified
                {
                    deliveryOrders: {
                        some: {
                            OR: [
                                { createdAt: { gte: lastSync } },
                                { updatedAt: { gte: lastSync } },
                                { deletedAt: { gte: lastSync } }
                            ]
                        }
                    }
                },
                // Purchase order has invoices that were modified
                {
                    invoices: {
                        some: {
                            OR: [
                                { createdAt: { gte: lastSync } },
                                { updatedAt: { gte: lastSync } },
                                { deletedAt: { gte: lastSync } }
                            ]
                        }
                    }
                },
                // Purchase order has purchase order items that were modified
                {
                    purchaseOrderItems: {
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

        // Count total matching records
        const total = await tenantPrisma.purchaseOrder.count({ where });

        // Fetch paginated purchase orders with minimal data
        const purchaseOrders = await tenantPrisma.purchaseOrder.findMany({
            where,
            skip,
            take,
            include: {
                _count: {
                    select: {
                        purchaseOrderItems: {
                            where: { deleted: false }
                        }
                    }
                }
            }
        });

        // Batch fetch delivery orders and invoices for all purchase orders
        const purchaseOrderIds = purchaseOrders.map(po => po.id);

        // Count delivery orders for each purchase order
        const deliveryOrderCounts = await tenantPrisma.deliveryOrder.groupBy({
            by: ['purchaseOrderId'],
            where: {
                purchaseOrderId: { in: purchaseOrderIds },
                deleted: false
            },
            _count: {
                id: true
            }
        });

        // Count invoices for each purchase order and include settlement info
        const invoiceData = await tenantPrisma.invoice.findMany({
            where: {
                purchaseOrderId: { in: purchaseOrderIds },
                deleted: false
            },
            select: {
                id: true,
                purchaseOrderId: true,
                invoiceSettlementId: true,
                invoiceSettlement: {
                    select: {
                        id: true,
                        settlementNumber: true,
                        settlementDate: true,
                        status: true,
                        settlementAmount: true
                    }
                }
            }
        });

        // Create lookup maps for O(1) access
        const deliveryOrderCountMap = new Map();
        deliveryOrderCounts.forEach(doc => {
            deliveryOrderCountMap.set(doc.purchaseOrderId, doc._count.id);
        });

        // Process invoice data to create count and settlement maps
        const invoiceCountMap = new Map();
        const settlementInfoMap = new Map();

        purchaseOrderIds.forEach(poId => {
            const poInvoices = invoiceData.filter(inv => inv.purchaseOrderId === poId);

            // Count invoices
            invoiceCountMap.set(poId, poInvoices.length);

            // Count settled invoices and unique settlements
            const settledInvoices = poInvoices.filter(inv => inv.invoiceSettlement);
            const uniqueSettlements = new Set(
                settledInvoices
                    .map(inv => inv.invoiceSettlement?.id)
                    .filter(id => id !== undefined)
            );

            settlementInfoMap.set(poId, {
                settledInvoiceCount: settledInvoices.length,
                uniqueSettlementCount: uniqueSettlements.size
            });
        });

        // Enrich purchase orders with counts and settlement info
        const enrichedPurchaseOrders = purchaseOrders.map(po => {
            const deliveryOrderCount = deliveryOrderCountMap.get(po.id) || 0;
            const invoiceCount = invoiceCountMap.get(po.id) || 0;
            const settlementInfo = settlementInfoMap.get(po.id) || {
                settledInvoiceCount: 0,
                uniqueSettlementCount: 0
            };

            return {
                ...po,
                itemCount: po._count.purchaseOrderItems,
                deliveryOrderCount,
                invoiceCount,
                settledInvoiceCount: settlementInfo.uniqueSettlementCount,
                _count: undefined // Remove the _count field from response
            };
        });

        return {
            purchaseOrders: enrichedPurchaseOrders,
            total,
            serverTimestamp: new Date().toISOString(),
        };
    }
    catch (error) {
        throw error;
    }
}

let getById = async (id: number, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const purchaseOrder = await tenantPrisma.purchaseOrder.findUnique({
            where: {
                id: id,
                deleted: false
            },
            include: {
                purchaseOrderItems: {
                    where: {
                        deleted: false
                    },
                },
                deliveryOrders: {
                    where: {
                        deleted: false
                    },
                    include: {
                        deliveryOrderItems: {
                            where: {
                                deleted: false
                            }
                        }
                    }
                },
                invoices: {
                    where: {
                        deleted: false
                    },
                    include: {
                        invoiceItems: {
                            where: {
                                deleted: false
                            }
                        },
                        invoiceSettlement: true
                    }
                }
            }
        });

        if (!purchaseOrder) {
            throw new NotFoundError("Purchase Order");
        }

        // Extract and deduplicate invoice settlements
        const settlementMap = new Map();
        purchaseOrder.invoices.forEach(invoice => {
            if (invoice.invoiceSettlement) {
                settlementMap.set(invoice.invoiceSettlement.id, invoice.invoiceSettlement);
            }
        });
        const invoiceSettlements = Array.from(settlementMap.values());

        // For each settlement, get all linked invoices with minimal info
        const enhancedSettlements = await Promise.all(
            invoiceSettlements.map(async (settlement) => {
                const invoices = await tenantPrisma.invoice.findMany({
                    where: {
                        invoiceSettlementId: settlement.id,
                        deleted: false
                    },
                    select: {
                        invoiceNumber: true,
                        subtotalAmount: true,
                        totalAmount: true,
                        status: true,
                        taxInvoiceNumber: true,
                    }
                });

                return {
                    ...settlement,
                    invoices
                };
            })
        );

        // Count settled invoices
        const invoiceSettlementCount = purchaseOrder.invoices.filter(invoice => invoice.invoiceSettlement).length;

        // Remove invoiceSettlement from invoices
        const invoicesWithoutSettlement = purchaseOrder.invoices.map(invoice => {
            const { invoiceSettlement, ...invoiceWithoutSettlement } = invoice;
            return invoiceWithoutSettlement;
        });

        // Return purchase order with counts and restructured data
        return {
            ...purchaseOrder,
            invoices: invoicesWithoutSettlement,
            invoiceSettlements: enhancedSettlements,
            itemCount: purchaseOrder.purchaseOrderItems.length,
            deliveryOrderCount: purchaseOrder.deliveryOrders.length,
            invoiceCount: purchaseOrder.invoices.length,
            invoiceSettlementCount
        };
    }
    catch (error) {
        throw error;
    }
}

let createMany = async (databaseName: string, requestBody: CreatePurchaseOrderRequestBody): Promise<PurchaseOrder[]> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const { purchaseOrders } = requestBody;
        if (!purchaseOrders || !Array.isArray(purchaseOrders)) {
            throw new RequestValidateError('purchaseOrders must be a non-empty array');
        }

        // Extract unique IDs for batch validation
        const outletIds = [...new Set(purchaseOrders.map(po => po.outletId).filter(Boolean))];
        const supplierIds = [...new Set(purchaseOrders.map(po => po.supplierId).filter(Boolean))];
        const purchaseOrderNumbers = purchaseOrders.map(po => po.purchaseOrderNumber);

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

        // Batch validate all suppliers exist
        if (supplierIds.length > 0) {
            const existingSuppliers = await tenantPrisma.supplier.findMany({
                where: {
                    id: { in: supplierIds },
                    deleted: false
                },
                select: { id: true }
            });
            const existingSupplierIds = new Set(existingSuppliers.map(s => s.id));
            const missingSupplierIds = supplierIds.filter(id => !existingSupplierIds.has(id));

            if (missingSupplierIds.length > 0) {
                throw new RequestValidateError(`Suppliers with IDs ${missingSupplierIds.join(', ')} do not exist`);
            }
        }

        // Batch check for duplicate purchase order numbers
        const existingPurchaseOrders = await tenantPrisma.purchaseOrder.findMany({
            where: {
                purchaseOrderNumber: { in: purchaseOrderNumbers },
                deleted: false
            },
            select: { purchaseOrderNumber: true }
        });

        if (existingPurchaseOrders.length > 0) {
            const duplicateNumbers = existingPurchaseOrders.map(po => po.purchaseOrderNumber);
            throw new RequestValidateError(`Purchase orders with numbers ${duplicateNumbers.join(', ')} already exist`);
        }

        // Validate required fields
        for (const purchaseOrderData of purchaseOrders) {
            if (!purchaseOrderData.purchaseOrderNumber) {
                throw new RequestValidateError('purchaseOrderNumber is required');
            }
        }

        // Use single transaction for all creations
        const result = await tenantPrisma.$transaction(async (tx) => {
            const createdPurchaseOrders = [];

            for (const purchaseOrderData of purchaseOrders) {
                // Create purchase order
                const newPurchaseOrder = await tx.purchaseOrder.create({
                    data: {
                        purchaseOrderNumber: purchaseOrderData.purchaseOrderNumber,
                        outletId: purchaseOrderData.outletId,
                        supplierId: purchaseOrderData.supplierId,
                        sessionId: purchaseOrderData.sessionId || null,
                        purchaseOrderDate: purchaseOrderData.purchaseOrderDate,
                        discountType: purchaseOrderData.discountType || '',
                        discountAmount: purchaseOrderData.discountAmount ? new Decimal(purchaseOrderData.discountAmount) : new Decimal(0),
                        serviceChargeAmount: purchaseOrderData.serviceChargeAmount ? new Decimal(purchaseOrderData.serviceChargeAmount) : new Decimal(0),
                        taxAmount: purchaseOrderData.taxAmount ? new Decimal(purchaseOrderData.taxAmount) : new Decimal(0),
                        roundingAmount: purchaseOrderData.roundingAmount ? new Decimal(purchaseOrderData.roundingAmount) : new Decimal(0),
                        subtotalAmount: new Decimal(purchaseOrderData.subtotalAmount),
                        totalAmount: new Decimal(purchaseOrderData.totalAmount),
                        status: purchaseOrderData.status || 'CONFIRMED',
                        remark: purchaseOrderData.remark,
                        currency: purchaseOrderData.currency || 'IDR',
                        performedBy: purchaseOrderData.performedBy,
                        isTaxInclusive: purchaseOrderData.isTaxInclusive !== undefined ? purchaseOrderData.isTaxInclusive : true,
                    },
                    include: {
                        purchaseOrderItems: {
                            include: {
                                item: true
                            }
                        }
                    }
                });

                // Create purchase order items if provided
                if (purchaseOrderData.purchaseOrderItems && Array.isArray(purchaseOrderData.purchaseOrderItems) && purchaseOrderData.purchaseOrderItems.length > 0) {
                    await tx.purchaseOrderItem.createMany({
                        data: purchaseOrderData.purchaseOrderItems.map((item) => ({
                            purchaseOrderId: newPurchaseOrder.id,
                            itemId: item.itemId,
                            quantity: new Decimal(item.quantity),
                            unitPrice: new Decimal(item.unitPrice),
                            discountType: item.discountType || '',
                            discountAmount: item.discountAmount ? new Decimal(item.discountAmount) : new Decimal(0),
                            subtotal: new Decimal(item.subtotal),
                            taxAmount: item.taxAmount ? new Decimal(item.taxAmount) : new Decimal(0),
                            remark: item.remark || null,
                        })),
                    });

                    // Fetch the created items to include in response
                    const purchaseOrderItems = await tx.purchaseOrderItem.findMany({
                        where: { purchaseOrderId: newPurchaseOrder.id },
                    });

                    createdPurchaseOrders.push({
                        ...newPurchaseOrder,
                        purchaseOrderItems
                    });
                } else {
                    createdPurchaseOrders.push(newPurchaseOrder);
                }
            }

            return createdPurchaseOrders;
        });

        return result;
    }
    catch (error) {
        throw error
    }
}

let cancel = async (purchaseOrder: PurchaseOrderInput, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const { id, ...updateData } = purchaseOrder;

        if (!id) {
            throw new RequestValidateError('Purchase order ID is required');
        }

        // Single query to get existing purchase order with related data
        const existingPurchaseOrder = await tenantPrisma.purchaseOrder.findUnique({
            where: {
                id: id,
                deleted: false
            },
        });

        if (!existingPurchaseOrder) {
            throw new NotFoundError("Purchase Order");
        }

        // Use transaction to ensure data consistency
        const result = await tenantPrisma.$transaction(async (tx) => {
            // Update purchase order status to Cancelled
            const updatedPurchaseOrder = await tx.purchaseOrder.update({
                where: { id: id },
                data: {
                    status: 'CANCELLED',
                    version: { increment: 1 }
                }
            });

            // Single query to fetch final result with all relationships (same as getById)
            const updatedPurchaseOrderWithRelations = await tx.purchaseOrder.findUnique({
                where: { id: id },
                include: {
                    purchaseOrderItems: {
                        where: {
                            deleted: false
                        },
                    },
                    deliveryOrders: {
                        where: {
                            deleted: false
                        }
                    },
                    invoices: {
                        where: {
                            deleted: false
                        }
                    }
                }
            });

            return updatedPurchaseOrderWithRelations;
        });

        return result;
    }
    catch (error) {
        throw error;
    }
}


let update = async (purchaseOrder: PurchaseOrderInput, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const { id, ...updateData } = purchaseOrder;

        if (!id) {
            throw new RequestValidateError('Purchase order ID is required');
        }

        // Single query to get existing purchase order with related data
        const existingPurchaseOrder = await tenantPrisma.purchaseOrder.findUnique({
            where: {
                id: id,
                deleted: false
            },
            include: {
                purchaseOrderItems: {
                    where: { deleted: false }
                }
            }
        });

        if (!existingPurchaseOrder) {
            throw new NotFoundError("Purchase Order");
        }

        // Batch validation queries for better performance
        const validationPromises = [];

        // Validate outlet if being updated
        if (updateData.outletId && updateData.outletId !== existingPurchaseOrder.outletId) {
            validationPromises.push(
                tenantPrisma.outlet.findFirst({
                    where: { id: updateData.outletId, deleted: false },
                    select: { id: true }
                }).then(outlet => ({ type: 'outlet', exists: !!outlet, id: updateData.outletId }))
            );
        }

        // Validate supplier if being updated
        if (updateData.supplierId && updateData.supplierId !== existingPurchaseOrder.supplierId) {
            validationPromises.push(
                tenantPrisma.supplier.findFirst({
                    where: { id: updateData.supplierId, deleted: false },
                    select: { id: true }
                }).then(supplier => ({ type: 'supplier', exists: !!supplier, id: updateData.supplierId }))
            );
        }

        // Validate purchase order number if being changed
        if (updateData.purchaseOrderNumber &&
            updateData.purchaseOrderNumber !== existingPurchaseOrder.purchaseOrderNumber) {
            validationPromises.push(
                tenantPrisma.purchaseOrder.findFirst({
                    where: {
                        purchaseOrderNumber: updateData.purchaseOrderNumber,
                        deleted: false,
                        id: { not: id }
                    },
                    select: { id: true }
                }).then(duplicate => ({
                    type: 'purchaseOrderNumber',
                    exists: !!duplicate,
                    value: updateData.purchaseOrderNumber
                }))
            );
        }

        // Validate items if being updated
        if (updateData.purchaseOrderItems && Array.isArray(updateData.purchaseOrderItems)) {
            const itemIds = [...new Set(updateData.purchaseOrderItems.map(item => item.itemId).filter(Boolean))];
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
                case 'supplier':
                    if ('exists' in result && 'id' in result && !result.exists) {
                        throw new RequestValidateError(`Supplier with ID ${result.id} does not exist`);
                    }
                    break;
                case 'purchaseOrderNumber':
                    if ('exists' in result && 'value' in result && result.exists) {
                        throw new RequestValidateError(`Purchase order with number ${result.value} already exists`);
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
            // Update purchase order
            const updatedPurchaseOrder = await tx.purchaseOrder.update({
                where: { id: id },
                data: {
                    purchaseOrderNumber: updateData.purchaseOrderNumber,
                    outletId: updateData.outletId,
                    supplierId: updateData.supplierId,
                    purchaseOrderDate: updateData.purchaseOrderDate,
                    discountType: updateData.discountType || '',
                    discountAmount: updateData.discountAmount !== undefined ? new Decimal(updateData.discountAmount) : undefined,
                    serviceChargeAmount: updateData.serviceChargeAmount !== undefined ? new Decimal(updateData.serviceChargeAmount) : undefined,
                    taxAmount: updateData.taxAmount !== undefined ? new Decimal(updateData.taxAmount) : undefined,
                    roundingAmount: updateData.roundingAmount !== undefined ? new Decimal(updateData.roundingAmount) : undefined,
                    subtotalAmount: updateData.subtotalAmount !== undefined ? new Decimal(updateData.subtotalAmount) : undefined,
                    totalAmount: updateData.totalAmount !== undefined ? new Decimal(updateData.totalAmount) : undefined,
                    status: updateData.status,
                    remark: updateData.remark,
                    currency: updateData.currency,
                    performedBy: updateData.performedBy,
                    isTaxInclusive: updateData.isTaxInclusive !== undefined ? updateData.isTaxInclusive : true,
                    version: { increment: 1 }
                }
            });

            // Handle purchase order items if provided
            if (updateData.purchaseOrderItems && Array.isArray(updateData.purchaseOrderItems)) {
                // Simple approach: delete all existing items and recreate
                // This ensures clean data and consistent updatedAt timestamps

                // 1. Hard delete all existing purchase order items
                await tx.purchaseOrderItem.deleteMany({
                    where: {
                        purchaseOrderId: id,
                        deleted: false
                    }
                });

                // 2. Create all new items (if any provided)
                if (updateData.purchaseOrderItems.length > 0) {
                    await tx.purchaseOrderItem.createMany({
                        data: updateData.purchaseOrderItems.map(item => ({
                            purchaseOrderId: id,
                            itemId: item.itemId,
                            quantity: new Decimal(item.quantity),
                            unitPrice: new Decimal(item.unitPrice),
                            taxAmount: item.taxAmount ? new Decimal(item.taxAmount) : new Decimal(0),
                            discountType: item.discountType || '',
                            discountAmount: item.discountAmount ? new Decimal(item.discountAmount) : new Decimal(0),
                            subtotal: new Decimal(item.subtotal),
                            remark: item.remark || null,
                            updatedAt: new Date()
                        }))
                    });
                }
            }

            // Single query to fetch final result with all relationships (same as getById)
            const updatedPurchaseOrderWithRelations = await tx.purchaseOrder.findUnique({
                where: { id: id },
                include: {
                    purchaseOrderItems: {
                        where: {
                            deleted: false
                        },
                    },
                    deliveryOrders: {
                        where: {
                            deleted: false
                        }
                    },
                    invoices: {
                        where: {
                            deleted: false
                        }
                    }
                }
            });

            return updatedPurchaseOrderWithRelations;
        });

        return result;
    }
    catch (error) {
        throw error;
    }
}

let deletePurchaseOrder = async (id: number, databaseName: string): Promise<string> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        if (!id) {
            throw new RequestValidateError('Purchase order ID is required');
        }

        // Check if purchase order exists and is not already deleted
        const existingPurchaseOrder = await tenantPrisma.purchaseOrder.findUnique({
            where: {
                id: id,
                deleted: false
            },
            include: {
                deliveryOrders: {
                    where: { deleted: false }
                },
                invoices: {
                    where: { deleted: false }
                }
            }
        });

        if (!existingPurchaseOrder) {
            throw new NotFoundError("Purchase Order");
        }

        // Check if purchase order has related delivery orders or invoices
        if (existingPurchaseOrder.deliveryOrders.length > 0 || existingPurchaseOrder.invoices.length > 0) {
            throw new RequestValidateError('Cannot delete purchase order with existing delivery orders or invoices');
        }

        // Use transaction to ensure data consistency
        await tenantPrisma.$transaction(async (tx) => {
            // Soft delete all purchase order items first
            await tx.purchaseOrderItem.updateMany({
                where: {
                    purchaseOrderId: id,
                    deleted: false
                },
                data: {
                    deleted: true,
                    deletedAt: new Date(),
                    version: { increment: 1 }
                }
            });

            // Soft delete the purchase order
            await tx.purchaseOrder.update({
                where: { id: id },
                data: {
                    deleted: true,
                    deletedAt: new Date(),
                    version: { increment: 1 }
                }
            });
        });

        return `Purchase order with ID ${id} has been successfully deleted.`;
    }
    catch (error) {
        throw error;
    }
}

export = { getAll, getByDateRange, getById, createMany, cancel, update, deletePurchaseOrder };