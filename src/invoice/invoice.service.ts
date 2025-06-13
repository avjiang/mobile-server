import { Prisma, PrismaClient, StockBalance, StockMovement, Invoice } from "@prisma/client"
import { NotFoundError, VersionMismatchDetail, VersionMismatchError } from "../api-helpers/error"
import { getTenantPrisma } from '../db';
import { } from '../db';
import { SyncRequest } from "src/item/item.request";
import { create } from "domain";
import { CreateInvoiceRequestBody, InvoiceInput } from "./invoice.request";

class RequestValidateError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RequestValidateError';
    }
}

let getAll = async (
    databaseName: string,
    syncRequest: SyncRequest
): Promise<{ invoices: any[]; total: number; serverTimestamp: string }> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { lastSyncTimestamp, outletId, skip = 0, take = 100 } = syncRequest;

    try {
        // Parse last sync timestamp with optimization for null/first sync
        let lastSync: Date;

        if (lastSyncTimestamp && lastSyncTimestamp !== 'null') {
            lastSync = new Date(lastSyncTimestamp);
        } else {
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
        const total = await tenantPrisma.invoice.count({ where });

        // Fetch paginated invoices with minimal data
        const invoices = await tenantPrisma.invoice.findMany({
            where,
            skip,
            take,
            include: {
                _count: {
                    select: {
                        invoiceItems: {
                            where: { deleted: false }
                        }
                    }
                }
            }
        });

        // Batch fetch delivery orders for all invoices (if needed for additional data)
        const invoiceIds = invoices.map(inv => inv.id);

        // Batch fetch purchase order for each invoice
        const purchaseOrders = await tenantPrisma.purchaseOrder.findMany({
            where: {
                id: { in: invoices.map(inv => inv.purchaseOrderId).filter((id): id is number => typeof id === 'number') },
                deleted: false
            },
            select: {
                id: true,
                purchaseOrderNumber: true,
                purchaseOrderDate: true
            }
        });

        // Batch fetch delivery orders for each invoice
        const deliveryOrders = await tenantPrisma.deliveryOrder.findMany({
            where: {
                id: { in: invoices.map(inv => inv.deliveryOrderId).filter((id): id is number => typeof id === 'number') },
                deleted: false
            },
            select: {
                id: true,
                deliveryDate: true,
                trackingNumber: true
            }
        });

        // Create lookup maps for O(1) access
        const purchaseOrderMap = new Map();
        purchaseOrders.forEach(po => {
            purchaseOrderMap.set(po.id, po);
        });

        const deliveryOrderMap = new Map();
        deliveryOrders.forEach(do_ => {
            deliveryOrderMap.set(do_.id, do_);
        });

        // Enrich invoices with purchase order and delivery order info
        const enrichedInvoices = invoices.map(inv => {
            const purchaseOrder = purchaseOrderMap.get(inv.purchaseOrderId);
            const deliveryOrder = deliveryOrderMap.get(inv.deliveryOrderId);

            return {
                ...inv,
                itemCount: inv._count.invoiceItems,
                purchaseOrderNumber: purchaseOrder?.purchaseOrderNumber || null,
                purchaseOrderDate: purchaseOrder?.purchaseOrderDate || null,
                deliveryDate: deliveryOrder?.deliveryDate || null,
                trackingNumber: deliveryOrder?.trackingNumber || null,
                _count: undefined // Remove the _count field from response
            };
        });

        return {
            invoices: enrichedInvoices,
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
        const invoice = await tenantPrisma.invoice.findUnique({
            where: {
                id: id,
                deleted: false
            },
            include: {
                invoiceItems: {
                    where: {
                        deleted: false
                    },
                },
                // purchaseOrder: {
                //     where: {
                //         deleted: false
                //     },
                //     select: {
                //         id: true,
                //         purchaseOrderNumber: true,
                //         purchaseOrderDate: true,
                //     }
                // },
                // deliveryOrder: {
                //     where: {
                //         deleted: false
                //     },
                //     select: {
                //         id: true,
                //         deliveryDate: true,
                //         trackingNumber: true
                //     }
                // }
            }
        });

        if (!invoice) {
            throw new NotFoundError("Invoice");
        }
        // Return invoice with itemCount added
        return {
            ...invoice
        };
    }
    catch (error) {
        throw error;
    }
}

let createMany = async (databaseName: string, requestBody: CreateInvoiceRequestBody): Promise<Invoice[]> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const { invoices } = requestBody;

        if (!invoices || !Array.isArray(invoices)) {
            throw new RequestValidateError('invoices must be a non-empty array');
        }

        // Extract unique IDs for batch validation
        const outletIds = [...new Set(invoices.map(inv => inv.outletId).filter(Boolean))];
        const supplierIds = [...new Set(invoices.map(inv => inv.supplierId).filter((id): id is number => typeof id === 'number'))];
        const purchaseOrderIds = [...new Set(invoices.map(inv => inv.purchaseOrderId).filter((id): id is number => typeof id === 'number'))];
        const deliveryOrderIds = [...new Set(invoices.map(inv => inv.deliveryOrderId).filter((id): id is number => typeof id === 'number'))];

        // Check for duplicate invoice numbers
        const invoiceNumbers = invoices.map(inv => inv.invoiceNumber).filter(Boolean);
        if (invoiceNumbers.length > 0) {
            const existingInvoices = await tenantPrisma.invoice.findMany({
                where: {
                    invoiceNumber: { in: invoiceNumbers },
                    deleted: false
                },
                select: { invoiceNumber: true }
            });

            if (existingInvoices.length > 0) {
                const duplicateNumbers = existingInvoices.map(inv => inv.invoiceNumber);
                throw new RequestValidateError(`Invoice numbers already exist: ${duplicateNumbers.join(', ')}`);
            }
        }

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
            const missingSupplierIds = supplierIds.filter((id) => !existingSupplierIds.has(id));

            if (missingSupplierIds.length > 0) {
                throw new RequestValidateError(`Suppliers with IDs ${missingSupplierIds.join(', ')} do not exist`);
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

        // Batch validate all delivery orders exist
        if (deliveryOrderIds.length > 0) {
            const existingDeliveryOrders = await tenantPrisma.deliveryOrder.findMany({
                where: {
                    id: { in: deliveryOrderIds },
                    deleted: false
                },
                select: { id: true }
            });
            const existingDeliveryOrderIds = new Set(existingDeliveryOrders.map(do_ => do_.id));
            const missingDeliveryOrderIds = deliveryOrderIds.filter((id) => !existingDeliveryOrderIds.has(id));

            if (missingDeliveryOrderIds.length > 0) {
                throw new RequestValidateError(`Delivery orders with IDs ${missingDeliveryOrderIds.join(', ')} do not exist`);
            }
        }

        // Use single transaction for all creations
        const result = await tenantPrisma.$transaction(async (tx) => {
            const createdInvoices = [];

            for (const invoiceData of invoices) {
                // Create invoice
                const newInvoice = await tx.invoice.create({
                    data: {
                        invoiceNumber: invoiceData.invoiceNumber,
                        purchaseOrderId: invoiceData.purchaseOrderId,
                        deliveryOrderId: invoiceData.deliveryOrderId,
                        supplierId: invoiceData.supplierId,
                        outletId: invoiceData.outletId,
                        subtotalAmount: invoiceData.subtotalAmount,
                        taxAmount: invoiceData.taxAmount,
                        discountAmount: invoiceData.discountAmount,
                        totalAmount: invoiceData.totalAmount,
                        currency: invoiceData.currency || 'IDR',
                        status: invoiceData.status || 'DRAFT',
                        invoiceDate: invoiceData.invoiceDate,
                        paymentDate: invoiceData.paymentDate,
                        dueDate: invoiceData.dueDate,
                        remark: invoiceData.remark,
                        performedBy: invoiceData.performedBy
                    },
                    include: {
                        invoiceItems: {
                            include: {
                                item: true
                            }
                        }
                    }
                });

                // Create invoice items if provided
                if (invoiceData.invoiceItems && Array.isArray(invoiceData.invoiceItems) && invoiceData.invoiceItems.length > 0) {
                    await tx.invoiceItem.createMany({
                        data: invoiceData.invoiceItems.map((item) => ({
                            invoiceId: newInvoice.id,
                            itemId: item.itemId,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            subtotal: item.subtotal,
                            remark: item.remark || null,
                        })),
                    });

                    // Fetch the created items to include in response
                    const invoiceItems = await tx.invoiceItem.findMany({
                        where: { invoiceId: newInvoice.id },
                    });

                    createdInvoices.push({
                        ...newInvoice,
                        invoiceItems
                    });
                } else {
                    createdInvoices.push(newInvoice);
                }
            }

            return createdInvoices;
        });

        return result;
    }
    catch (error) {
        throw error
    }
}

let update = async (invoice: InvoiceInput, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const { id, ...updateData } = invoice;

        if (!id) {
            throw new RequestValidateError('Invoice ID is required');
        }

        // Single query to get existing invoice with related data
        const existingInvoice = await tenantPrisma.invoice.findUnique({
            where: {
                id: id,
                deleted: false
            },
            include: {
                invoiceItems: {
                    where: { deleted: false }
                }
            }
        });

        if (!existingInvoice) {
            throw new NotFoundError("Invoice");
        }

        // Batch validation queries for better performance
        const validationPromises = [];

        // Validate outlet if being updated
        if (updateData.outletId && updateData.outletId !== existingInvoice.outletId) {
            validationPromises.push(
                tenantPrisma.outlet.findFirst({
                    where: { id: updateData.outletId, deleted: false },
                    select: { id: true }
                }).then(outlet => ({ type: 'outlet', exists: !!outlet, id: updateData.outletId }))
            );
        }

        // Validate supplier if being updated
        if (updateData.supplierId && updateData.supplierId !== existingInvoice.supplierId) {
            validationPromises.push(
                tenantPrisma.supplier.findFirst({
                    where: { id: updateData.supplierId, deleted: false },
                    select: { id: true }
                }).then(supplier => ({ type: 'supplier', exists: !!supplier, id: updateData.supplierId }))
            );
        }

        // Validate purchase order if being updated
        if (updateData.purchaseOrderId && updateData.purchaseOrderId !== existingInvoice.purchaseOrderId) {
            validationPromises.push(
                tenantPrisma.purchaseOrder.findFirst({
                    where: { id: updateData.purchaseOrderId, deleted: false },
                    select: { id: true }
                }).then(purchaseOrder => ({ type: 'purchaseOrder', exists: !!purchaseOrder, id: updateData.purchaseOrderId }))
            );
        }

        // Validate delivery order if being updated
        if (updateData.deliveryOrderId && updateData.deliveryOrderId !== existingInvoice.deliveryOrderId) {
            validationPromises.push(
                tenantPrisma.deliveryOrder.findFirst({
                    where: { id: updateData.deliveryOrderId, deleted: false },
                    select: { id: true }
                }).then(deliveryOrder => ({ type: 'deliveryOrder', exists: !!deliveryOrder, id: updateData.deliveryOrderId }))
            );
        }

        // Validate items if being updated
        if (updateData.invoiceItems && Array.isArray(updateData.invoiceItems)) {
            const itemIds = [...new Set(updateData.invoiceItems.map(item => item.itemId).filter(Boolean))];
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
                case 'purchaseOrder':
                    if ('exists' in result && 'id' in result && !result.exists) {
                        throw new RequestValidateError(`Purchase order with ID ${result.id} does not exist`);
                    }
                    break;
                case 'deliveryOrder':
                    if ('exists' in result && 'id' in result && !result.exists) {
                        throw new RequestValidateError(`Delivery order with ID ${result.id} does not exist`);
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
            // Update invoice
            const updatedInvoice = await tx.invoice.update({
                where: { id: id },
                data: {
                    invoiceNumber: updateData.invoiceNumber,
                    purchaseOrderId: existingInvoice.purchaseOrderId !== updateData.purchaseOrderId ? updateData.purchaseOrderId : undefined,
                    deliveryOrderId: existingInvoice.deliveryOrderId !== updateData.deliveryOrderId ? updateData.deliveryOrderId : undefined,
                    supplierId: existingInvoice.supplierId !== updateData.supplierId ? updateData.supplierId : undefined,
                    outletId: updateData.outletId,
                    subtotalAmount: updateData.subtotalAmount,
                    taxAmount: updateData.taxAmount,
                    discountAmount: updateData.discountAmount,
                    totalAmount: updateData.totalAmount,
                    currency: updateData.currency,
                    status: updateData.status,
                    invoiceDate: updateData.invoiceDate,
                    paymentDate: updateData.paymentDate,
                    dueDate: updateData.dueDate,
                    remark: updateData.remark,
                    performedBy: updateData.performedBy,
                    version: { increment: 1 }
                }
            });

            // Handle invoice items if provided
            if (updateData.invoiceItems && Array.isArray(updateData.invoiceItems)) {
                // Simple approach: delete all existing items and recreate
                // This ensures clean data and consistent updatedAt timestamps

                // 1. Hard delete all existing invoice items
                await tx.invoiceItem.deleteMany({
                    where: {
                        invoiceId: id,
                        deleted: false
                    }
                });

                // 2. Create all new items (if any provided)
                if (updateData.invoiceItems.length > 0) {
                    await tx.invoiceItem.createMany({
                        data: updateData.invoiceItems.map(item => ({
                            invoiceId: id,
                            itemId: item.itemId,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            subtotal: item.subtotal,
                            remark: item.remark || null,
                            updatedAt: new Date()
                        }))
                    });
                }
            }

            // Single query to fetch final result with all relationships
            return await tx.invoice.findUnique({
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
                    deliveryOrder: {
                        select: {
                            id: true,
                            deliveryDate: true,
                            trackingNumber: true,
                            deleted: true
                        }
                    },
                    supplier: {
                        select: {
                            id: true,
                            companyName: true,
                            deleted: true
                        }
                    },
                    invoiceItems: {
                        where: { deleted: false },
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