import { Prisma, PrismaClient, StockBalance, StockMovement, Invoice } from "../../prisma/client/generated/client"
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
                invoiceId: { in: invoiceIds },
                deleted: false
            },
            select: {
                id: true,
                invoiceId: true,
                deliveryDate: true,
                trackingNumber: true
            }
        });

        // Create lookup maps for O(1) access
        const purchaseOrderMap = new Map();
        purchaseOrders.forEach(po => {
            purchaseOrderMap.set(po.id, po);
        });

        // Create lookup map for delivery orders grouped by invoice ID
        const deliveryOrderMap = new Map<number, any[]>();
        deliveryOrders.forEach(do_ => {
            if (!deliveryOrderMap.has(do_.invoiceId!)) {
                deliveryOrderMap.set(do_.invoiceId!, []);
            }
            deliveryOrderMap.get(do_.invoiceId!)!.push(do_);
        });

        // Enrich invoices with purchase order and delivery order info
        const enrichedInvoices = invoices.map(inv => {
            const purchaseOrder = purchaseOrderMap.get(inv.purchaseOrderId);
            const relatedDeliveryOrders = deliveryOrderMap.get(inv.id) || [];

            return {
                ...inv,
                itemCount: inv._count.invoiceItems,
                deliveryOrderCount: relatedDeliveryOrders.length,
                purchaseOrderNumber: purchaseOrder?.purchaseOrderNumber || null,
                purchaseOrderDate: purchaseOrder?.purchaseOrderDate || null,
                deliveryOrders: relatedDeliveryOrders.map(do_ => ({
                    id: do_.id,
                    deliveryDate: do_.deliveryDate,
                    trackingNumber: do_.trackingNumber
                })),
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
                purchaseOrder: {
                    where: {
                        deleted: false
                    },
                    select: {
                        id: true,
                        purchaseOrderNumber: true,
                        purchaseOrderDate: true,
                        supplierId: true,
                        outletId: true,
                        subtotalAmount: true,
                        taxAmount: true,
                        discountAmount: true,
                        totalAmount: true,
                        currency: true,
                        status: true,
                        remark: true,
                        purchaseOrderItems: {
                            where: {
                                deleted: false
                            },
                        }
                    }
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
                }
            }
        });

        if (!invoice) {
            throw new NotFoundError("Invoice");
        }

        return {
            ...invoice
        };
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

        // Build query conditions with date range for invoices
        const where = {
            outletId: parsedOutletId,
            invoiceDate: {
                gte: parsedStartDate,
                lte: parsedEndDate
            },
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
                invoiceId: { in: invoiceIds },
                deleted: false
            },
            select: {
                id: true,
                invoiceId: true,
                deliveryDate: true,
                trackingNumber: true
            }
        });

        // Create lookup maps for O(1) access
        const purchaseOrderMap = new Map();
        purchaseOrders.forEach(po => {
            purchaseOrderMap.set(po.id, po);
        });

        // Create lookup map for delivery orders grouped by invoice ID
        const deliveryOrderMap = new Map<number, any[]>();
        deliveryOrders.forEach(do_ => {
            if (!deliveryOrderMap.has(do_.invoiceId!)) {
                deliveryOrderMap.set(do_.invoiceId!, []);
            }
            deliveryOrderMap.get(do_.invoiceId!)!.push(do_);
        });

        // Enrich invoices with purchase order and delivery order info
        const enrichedInvoices = invoices.map(inv => {
            const purchaseOrder = purchaseOrderMap.get(inv.purchaseOrderId);
            const relatedDeliveryOrders = deliveryOrderMap.get(inv.id) || [];

            return {
                ...inv,
                itemCount: inv._count.invoiceItems,
                deliveryOrderCount: relatedDeliveryOrders.length,
                purchaseOrderNumber: purchaseOrder?.purchaseOrderNumber || null,
                purchaseOrderDate: purchaseOrder?.purchaseOrderDate || null,
                deliveryOrders: relatedDeliveryOrders.map(do_ => ({
                    id: do_.id,
                    deliveryDate: do_.deliveryDate,
                    trackingNumber: do_.trackingNumber
                })),
                _count: undefined
            };
        });

        return {
            invoices: enrichedInvoices,
            total,
            serverTimestamp: new Date().toISOString(),
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
        const deliveryOrderIds = [...new Set(invoices.flatMap(inv => inv.deliveryOrderIds || []).filter((id): id is number => typeof id === 'number'))];

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
                    deleted: false,
                    invoiceId: null // Ensure delivery orders are not already linked to another invoice
                },
                select: { id: true }
            });
            const existingDeliveryOrderIds = new Set(existingDeliveryOrders.map(do_ => do_.id));
            const missingDeliveryOrderIds = deliveryOrderIds.filter((id) => !existingDeliveryOrderIds.has(id));

            if (missingDeliveryOrderIds.length > 0) {
                throw new RequestValidateError(`Delivery orders with IDs ${missingDeliveryOrderIds.join(', ')} do not exist or are already linked to another invoice`);
            }
        }

        // Use single transaction for all creations
        const result = await tenantPrisma.$transaction(async (tx) => {
            const createdInvoices = [];

            for (const invoiceData of invoices) {
                // Determine invoice status based on taxInvoiceNumber
                const invoiceStatus = (invoiceData.taxInvoiceNumber && invoiceData.taxInvoiceNumber.trim() !== '')
                    ? 'Completed'
                    : 'Incomplete';

                const newInvoice = await tx.invoice.create({
                    data: {
                        invoiceNumber: invoiceData.invoiceNumber,
                        taxInvoiceNumber: invoiceData.taxInvoiceNumber || "",
                        purchaseOrderId: invoiceData.purchaseOrderId,
                        supplierId: invoiceData.supplierId,
                        sessionId: invoiceData.sessionId || null,
                        outletId: invoiceData.outletId,
                        subtotalAmount: invoiceData.subtotalAmount,
                        taxAmount: invoiceData.taxAmount,
                        discountAmount: invoiceData.discountAmount,
                        discountType: invoiceData.discountType || '',
                        totalAmount: invoiceData.totalAmount,
                        currency: invoiceData.currency || 'IDR',
                        status: invoiceStatus,
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

                // Update purchase order status to COMPLETED if purchaseOrderId exists
                if (invoiceData.purchaseOrderId) {
                    await tx.purchaseOrder.update({
                        where: {
                            id: invoiceData.purchaseOrderId,
                            deleted: false
                        },
                        data: {
                            status: 'COMPLETED'
                        }
                    });
                }

                // Link delivery orders to this invoice
                if (invoiceData.deliveryOrderIds && invoiceData.deliveryOrderIds.length > 0) {
                    await tx.deliveryOrder.updateMany({
                        where: {
                            id: { in: invoiceData.deliveryOrderIds },
                            deleted: false
                        },
                        data: {
                            invoiceId: newInvoice.id
                        }
                    });
                }

                // Create invoice items if provided
                if (invoiceData.invoiceItems && Array.isArray(invoiceData.invoiceItems) && invoiceData.invoiceItems.length > 0) {
                    await tx.invoiceItem.createMany({
                        data: invoiceData.invoiceItems.map((item) => ({
                            invoiceId: newInvoice.id,
                            itemId: item.itemId,
                            quantity: item.quantity,
                            discountType: item.discountType || '',
                            discountAmount: item.discountAmount || 0,
                            unitPrice: item.unitPrice,
                            taxAmount: item.taxAmount || 0,
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

        // Get existing invoice
        const existingInvoice = await tenantPrisma.invoice.findUnique({
            where: { id: id, deleted: false },
            select: {
                id: true,
                version: true,
                outletId: true,
                supplierId: true,
                purchaseOrderId: true,
                invoiceNumber: true
            }
        });

        if (!existingInvoice) {
            throw new NotFoundError("Invoice");
        }

        // Check for duplicate invoice number if being updated
        if (updateData.invoiceNumber && updateData.invoiceNumber !== existingInvoice.invoiceNumber) {
            const duplicateInvoice = await tenantPrisma.invoice.findFirst({
                where: {
                    invoiceNumber: updateData.invoiceNumber,
                    deleted: false,
                    id: { not: id }
                },
                select: { id: true }
            });

            if (duplicateInvoice) {
                throw new RequestValidateError(`Invoice number ${updateData.invoiceNumber} already exists`);
            }
        }

        // Collect IDs for batch validation
        const validationIds = {
            outletIds: updateData.outletId && updateData.outletId !== existingInvoice.outletId ? [updateData.outletId] : [],
            supplierIds: updateData.supplierId && updateData.supplierId !== existingInvoice.supplierId ? [updateData.supplierId] : [],
            purchaseOrderIds: updateData.purchaseOrderId && updateData.purchaseOrderId !== existingInvoice.purchaseOrderId ? [updateData.purchaseOrderId] : [],
            deliveryOrderIds: updateData.deliveryOrderIds && Array.isArray(updateData.deliveryOrderIds) ? updateData.deliveryOrderIds.filter(Boolean) : [],
            itemIds: updateData.invoiceItems && Array.isArray(updateData.invoiceItems) ? [...new Set(updateData.invoiceItems.map(item => item.itemId).filter(Boolean))] : []
        };

        // Batch validation queries
        const [outlets, suppliers, purchaseOrders, deliveryOrders, items] = await Promise.all([
            validationIds.outletIds.length > 0 ? tenantPrisma.outlet.findMany({
                where: { id: { in: validationIds.outletIds }, deleted: false },
                select: { id: true }
            }) : [],
            validationIds.supplierIds.length > 0 ? tenantPrisma.supplier.findMany({
                where: { id: { in: validationIds.supplierIds }, deleted: false },
                select: { id: true }
            }) : [],
            validationIds.purchaseOrderIds.length > 0 ? tenantPrisma.purchaseOrder.findMany({
                where: { id: { in: validationIds.purchaseOrderIds }, deleted: false },
                select: { id: true }
            }) : [],
            validationIds.deliveryOrderIds.length > 0 ? tenantPrisma.deliveryOrder.findMany({
                where: {
                    id: { in: validationIds.deliveryOrderIds },
                    deleted: false,
                    OR: [{ invoiceId: null }, { invoiceId: id }]
                },
                select: { id: true }
            }) : [],
            validationIds.itemIds.length > 0 ? tenantPrisma.item.findMany({
                where: { id: { in: validationIds.itemIds }, deleted: false },
                select: { id: true }
            }) : []
        ]);

        // Validate existence of referenced entities
        const validationErrors = [];

        if (validationIds.outletIds.length > 0 && outlets.length !== validationIds.outletIds.length) {
            const missingIds = validationIds.outletIds.filter(id => !outlets.some(o => o.id === id));
            validationErrors.push(`Outlets with IDs ${missingIds.join(', ')} do not exist`);
        }

        if (validationIds.supplierIds.length > 0 && suppliers.length !== validationIds.supplierIds.length) {
            const missingIds = validationIds.supplierIds.filter(id => !suppliers.some(s => s.id === id));
            validationErrors.push(`Suppliers with IDs ${missingIds.join(', ')} do not exist`);
        }

        if (validationIds.purchaseOrderIds.length > 0 && purchaseOrders.length !== validationIds.purchaseOrderIds.length) {
            const missingIds = validationIds.purchaseOrderIds.filter(id => !purchaseOrders.some(po => po.id === id));
            validationErrors.push(`Purchase orders with IDs ${missingIds.join(', ')} do not exist`);
        }

        if (validationIds.deliveryOrderIds.length > 0 && deliveryOrders.length !== validationIds.deliveryOrderIds.length) {
            const missingIds = validationIds.deliveryOrderIds.filter(id => !deliveryOrders.some(do_ => do_.id === id));
            validationErrors.push(`Delivery orders with IDs ${missingIds.join(', ')} do not exist or are already linked to another invoice`);
        }

        if (validationIds.itemIds.length > 0 && items.length !== validationIds.itemIds.length) {
            const missingIds = validationIds.itemIds.filter(id => !items.some(i => i.id === id));
            validationErrors.push(`Items with IDs ${missingIds.join(', ')} do not exist`);
        }

        if (validationErrors.length > 0) {
            throw new RequestValidateError(validationErrors.join('; '));
        }

        // Determine invoice status based on taxInvoiceNumber
        const invoiceStatus = updateData.taxInvoiceNumber && updateData.taxInvoiceNumber.trim() !== '' ? 'Completed' : 'Incomplete';

        // Use transaction for all updates
        const result = await tenantPrisma.$transaction(async (tx) => {
            // Update main invoice
            const updatedInvoice = await tx.invoice.update({
                where: { id: id },
                data: {
                    invoiceNumber: updateData.invoiceNumber,
                    taxInvoiceNumber: updateData.taxInvoiceNumber,
                    purchaseOrderId: updateData.purchaseOrderId,
                    supplierId: updateData.supplierId,
                    outletId: updateData.outletId,
                    subtotalAmount: updateData.subtotalAmount,
                    taxAmount: updateData.taxAmount,
                    discountAmount: updateData.discountAmount,
                    discountType: updateData.discountType,
                    totalAmount: updateData.totalAmount,
                    currency: updateData.currency || 'IDR',
                    status: updateData.status || invoiceStatus,
                    invoiceDate: updateData.invoiceDate,
                    paymentDate: updateData.paymentDate,
                    dueDate: updateData.dueDate,
                    remark: updateData.remark,
                    performedBy: updateData.performedBy,
                    version: { increment: 1 }
                }
            });

            // Handle delivery order associations only if deliveryOrderIds is explicitly provided
            if (updateData.deliveryOrderIds !== undefined) {
                // First, get currently linked delivery orders for this invoice
                const currentDeliveryOrders = await tx.deliveryOrder.findMany({
                    where: { invoiceId: id, deleted: false },
                    select: { id: true }
                });

                // Unlink only the currently linked delivery orders
                if (currentDeliveryOrders.length > 0) {
                    await tx.deliveryOrder.updateMany({
                        where: {
                            id: { in: currentDeliveryOrders.map(do_ => do_.id) },
                            deleted: false
                        },
                        data: { invoiceId: null }
                    });
                }

                // Link new delivery orders
                if (updateData.deliveryOrderIds.length > 0) {
                    await tx.deliveryOrder.updateMany({
                        where: { id: { in: updateData.deliveryOrderIds }, deleted: false },
                        data: { invoiceId: id }
                    });
                }
            }

            // Handle invoice items
            if (updateData.invoiceItems !== undefined) {
                // Delete existing items
                await tx.invoiceItem.deleteMany({
                    where: { invoiceId: id }
                });

                // Create new items
                if (updateData.invoiceItems.length > 0) {
                    await tx.invoiceItem.createMany({
                        data: updateData.invoiceItems.map(item => ({
                            invoiceId: id,
                            itemId: item.itemId,
                            quantity: item.quantity,
                            discountType: item.discountType || '',
                            discountAmount: item.discountAmount || 0,
                            unitPrice: item.unitPrice,
                            taxAmount: item.taxAmount || 0,
                            subtotal: item.subtotal,
                            remark: item.remark || null
                        }))
                    });
                }
            }

            // Return updated invoice with relationships
            return await tx.invoice.findUnique({
                where: { id: id },
                include: {
                    invoiceItems: { where: { deleted: false } },
                    purchaseOrder: {
                        where: { deleted: false },
                        select: {
                            id: true,
                            purchaseOrderNumber: true,
                            purchaseOrderDate: true,
                            supplierId: true,
                            outletId: true,
                            subtotalAmount: true,
                            taxAmount: true,
                            discountAmount: true,
                            totalAmount: true,
                            currency: true,
                            status: true,
                            remark: true,
                            purchaseOrderItems: { where: { deleted: false } }
                        }
                    },
                    deliveryOrders: {
                        where: { deleted: false },
                        include: {
                            deliveryOrderItems: { where: { deleted: false } }
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

export = { getAll, getById, getByDateRange, createMany, update };