import { Prisma, PrismaClient, StockBalance, StockMovement, Quotation } from "../../prisma/client/generated/client"
import { NotFoundError, VersionMismatchDetail, VersionMismatchError } from "../api-helpers/error"
import { getTenantPrisma } from '../db';
import Decimal from "decimal.js";
import { } from '../db';
import { SyncRequest } from "src/item/item.request";
import { create } from "domain";
import { CreateQuotationRequestBody, QuotationInput } from "./quotation.request";

class RequestValidateError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RequestValidateError';
    }
}

let getAll = async (
    databaseName: string,
    syncRequest: SyncRequest
): Promise<{ quotations: any[]; total: number; serverTimestamp: string }> => {
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

        // Build query conditions - include quotations that have changed OR have related entities that changed
        const where = {
            outletId: parsedOutletId,
            OR: [
                // Quotation itself was modified
                {
                    OR: [
                        { createdAt: { gte: lastSync } },
                        { updatedAt: { gte: lastSync } },
                        { deletedAt: { gte: lastSync } }
                    ]
                },
                // Quotation has purchase orders that were modified
                {
                    purchaseOrders: {
                        some: {
                            OR: [
                                { createdAt: { gte: lastSync } },
                                { updatedAt: { gte: lastSync } },
                                { deletedAt: { gte: lastSync } }
                            ]
                        }
                    }
                },
                // Quotation has quotation items that were modified
                {
                    quotationItems: {
                        some: {
                            OR: [
                                { createdAt: { gte: lastSync } },
                                { updatedAt: { gte: lastSync } },
                                { deletedAt: { gte: lastSync } }
                            ]
                        }
                    }
                },
                // Quotation has delivery orders that were modified (through purchase orders)
                {
                    purchaseOrders: {
                        some: {
                            deliveryOrders: {
                                some: {
                                    OR: [
                                        { createdAt: { gte: lastSync } },
                                        { updatedAt: { gte: lastSync } },
                                        { deletedAt: { gte: lastSync } }
                                    ]
                                }
                            }
                        }
                    }
                },
                // Quotation has invoices that were modified (through purchase orders)
                {
                    purchaseOrders: {
                        some: {
                            invoices: {
                                some: {
                                    OR: [
                                        { createdAt: { gte: lastSync } },
                                        { updatedAt: { gte: lastSync } },
                                        { deletedAt: { gte: lastSync } }
                                    ]
                                }
                            }
                        }
                    }
                },
                // Quotation has invoice settlements that were modified (through purchase orders -> invoices)
                {
                    purchaseOrders: {
                        some: {
                            invoices: {
                                some: {
                                    invoiceSettlement: {
                                        OR: [
                                            { createdAt: { gte: lastSync } },
                                            { updatedAt: { gte: lastSync } },
                                            { deletedAt: { gte: lastSync } }
                                        ]
                                    }
                                }
                            }
                        }
                    }
                }
            ],
        };

        // Use Promise.all for parallel execution
        const [total, quotations] = await Promise.all([
            // Count total matching records
            tenantPrisma.quotation.count({ where }),

            // Fetch paginated quotations with minimal data
            tenantPrisma.quotation.findMany({
                where,
                skip,
                take,
                orderBy: [
                    { updatedAt: 'desc' },
                    { id: 'desc' }
                ],
                include: {
                    _count: {
                        select: {
                            quotationItems: {
                            }
                        }
                    }
                }
            })
        ]);

        // Early return if no quotations found
        if (quotations.length === 0) {
            return {
                quotations: [],
                total,
                serverTimestamp: new Date().toISOString(),
            };
        }

        // Batch fetch purchase orders and related data for all quotations
        const quotationIds = quotations.map(q => q.id);

        // Parallel execution of related data queries
        const [purchaseOrders, deliveryOrders, invoices] = await Promise.all([
            // Get purchase orders related to quotations
            tenantPrisma.purchaseOrder.findMany({
                where: {
                    quotationId: { in: quotationIds },
                    deleted: false
                },
                select: {
                    id: true,
                    quotationId: true,
                    purchaseOrderNumber: true,
                    status: true,
                    totalAmount: true
                },
                orderBy: { id: 'asc' }
            }),

            // Get delivery orders related to purchase orders
            tenantPrisma.deliveryOrder.findMany({
                where: {
                    purchaseOrder: {
                        quotationId: { in: quotationIds },
                        deleted: false
                    },
                    deleted: false
                },
                select: {
                    id: true,
                    purchaseOrderId: true,
                    trackingNumber: true,
                    status: true
                },
                orderBy: { id: 'asc' }
            }),

            // Get invoices related to purchase orders
            tenantPrisma.invoice.findMany({
                where: {
                    purchaseOrder: {
                        quotationId: { in: quotationIds },
                        deleted: false
                    },
                    deleted: false
                },
                select: {
                    id: true,
                    purchaseOrderId: true,
                    invoiceNumber: true,
                    status: true,
                    totalAmount: true,
                    invoiceSettlementId: true
                },
                orderBy: { id: 'asc' }
            })
        ]);

        // Enrich quotations with counts and related data
        const enrichedQuotations = quotations.map(q => {
            const relatedPOs = purchaseOrders.filter(po => po.quotationId === q.id);

            // Calculate counts for this quotation
            let totalDeliveryOrderCount = 0;
            let totalInvoiceCount = 0;
            let totalSettlementCount = 0;

            relatedPOs.forEach(po => {
                const relatedDOs = deliveryOrders.filter(dO => dO.purchaseOrderId === po.id);
                const relatedInvoices = invoices.filter(inv => inv.purchaseOrderId === po.id);

                totalDeliveryOrderCount += relatedDOs.length;
                totalInvoiceCount += relatedInvoices.length;

                // Count unique settlements for this PO
                const uniqueSettlements = new Set(
                    relatedInvoices
                        .map(inv => inv.invoiceSettlementId)
                        .filter(id => id !== null)
                );
                totalSettlementCount += uniqueSettlements.size;
            });

            return {
                ...q,
                itemCount: q._count.quotationItems,
                purchaseOrderCount: relatedPOs.length,
                deliveryOrderCount: totalDeliveryOrderCount,
                invoiceCount: totalInvoiceCount,
                settlementCount: totalSettlementCount,
                _count: undefined // Remove the _count field from response
            };
        });

        return {
            quotations: enrichedQuotations,
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

        // Build query conditions with date range for quotations
        const where = {
            outletId: parsedOutletId,
            quotationDate: {
                gte: parsedStartDate,
                lte: parsedEndDate
            },
            OR: [
                // Quotation itself was modified
                {
                    OR: [
                        { createdAt: { gte: lastSync } },
                        { updatedAt: { gte: lastSync } },
                        { deletedAt: { gte: lastSync } }
                    ]
                },
                // Quotation has purchase orders that were modified
                {
                    purchaseOrders: {
                        some: {
                            OR: [
                                { createdAt: { gte: lastSync } },
                                { updatedAt: { gte: lastSync } },
                                { deletedAt: { gte: lastSync } }
                            ]
                        }
                    }
                },
                // Quotation has quotation items that were modified
                {
                    quotationItems: {
                        some: {
                            OR: [
                                { createdAt: { gte: lastSync } },
                                { updatedAt: { gte: lastSync } },
                                { deletedAt: { gte: lastSync } }
                            ]
                        }
                    }
                },
                // Quotation has delivery orders that were modified (through purchase orders)
                {
                    purchaseOrders: {
                        some: {
                            deliveryOrders: {
                                some: {
                                    OR: [
                                        { createdAt: { gte: lastSync } },
                                        { updatedAt: { gte: lastSync } },
                                        { deletedAt: { gte: lastSync } }
                                    ]
                                }
                            }
                        }
                    }
                },
                // Quotation has invoices that were modified (through purchase orders)
                {
                    purchaseOrders: {
                        some: {
                            invoices: {
                                some: {
                                    OR: [
                                        { createdAt: { gte: lastSync } },
                                        { updatedAt: { gte: lastSync } },
                                        { deletedAt: { gte: lastSync } }
                                    ]
                                }
                            }
                        }
                    }
                },
                // Quotation has invoice settlements that were modified (through purchase orders -> invoices)
                {
                    purchaseOrders: {
                        some: {
                            invoices: {
                                some: {
                                    invoiceSettlement: {
                                        OR: [
                                            { createdAt: { gte: lastSync } },
                                            { updatedAt: { gte: lastSync } },
                                            { deletedAt: { gte: lastSync } }
                                        ]
                                    }
                                }
                            }
                        }
                    }
                }
            ],
        };

        // Use Promise.all for parallel execution
        const [total, quotations] = await Promise.all([
            // Count total matching records
            tenantPrisma.quotation.count({ where }),

            // Fetch paginated quotations with minimal data
            tenantPrisma.quotation.findMany({
                where,
                skip,
                take,
                orderBy: [
                    { quotationDate: 'desc' },
                    { id: 'desc' }
                ],
                include: {
                    _count: {
                        select: {
                            quotationItems: {
                            }
                        }
                    }
                }
            })
        ]);

        // Early return if no quotations found
        if (quotations.length === 0) {
            return {
                quotations: [],
                total,
                serverTimestamp: new Date().toISOString(),
            };
        }

        // Batch fetch purchase orders and related data for all quotations
        const quotationIds = quotations.map(q => q.id);

        // Parallel execution of related data queries
        const [purchaseOrders, deliveryOrders, invoices] = await Promise.all([
            // Get purchase orders related to quotations
            tenantPrisma.purchaseOrder.findMany({
                where: {
                    quotationId: { in: quotationIds },
                    deleted: false
                },
                select: {
                    id: true,
                    quotationId: true,
                    purchaseOrderNumber: true,
                    status: true,
                    totalAmount: true
                },
                orderBy: { id: 'asc' }
            }),

            // Get delivery orders related to purchase orders
            tenantPrisma.deliveryOrder.findMany({
                where: {
                    purchaseOrder: {
                        quotationId: { in: quotationIds },
                        deleted: false
                    },
                    deleted: false
                },
                select: {
                    id: true,
                    purchaseOrderId: true,
                    trackingNumber: true,
                    status: true
                },
                orderBy: { id: 'asc' }
            }),

            // Get invoices related to purchase orders
            tenantPrisma.invoice.findMany({
                where: {
                    purchaseOrder: {
                        quotationId: { in: quotationIds },
                        deleted: false
                    },
                    deleted: false
                },
                select: {
                    id: true,
                    purchaseOrderId: true,
                    invoiceNumber: true,
                    status: true,
                    totalAmount: true,
                    invoiceSettlementId: true
                },
                orderBy: { id: 'asc' }
            })
        ]);

        // Enrich quotations with counts and related data
        const enrichedQuotations = quotations.map(q => {
            const relatedPOs = purchaseOrders.filter(po => po.quotationId === q.id);

            // Calculate counts for this quotation
            let totalDeliveryOrderCount = 0;
            let totalInvoiceCount = 0;
            let totalSettlementCount = 0;

            relatedPOs.forEach(po => {
                const relatedDOs = deliveryOrders.filter(dO => dO.purchaseOrderId === po.id);
                const relatedInvoices = invoices.filter(inv => inv.purchaseOrderId === po.id);

                totalDeliveryOrderCount += relatedDOs.length;
                totalInvoiceCount += relatedInvoices.length;

                // Count unique settlements for this PO
                const uniqueSettlements = new Set(
                    relatedInvoices
                        .map(inv => inv.invoiceSettlementId)
                        .filter(id => id !== null)
                );
                totalSettlementCount += uniqueSettlements.size;
            });

            return {
                ...q,
                itemCount: q._count.quotationItems,
                purchaseOrderCount: relatedPOs.length,
                deliveryOrderCount: totalDeliveryOrderCount,
                invoiceCount: totalInvoiceCount,
                settlementCount: totalSettlementCount,
                _count: undefined // Remove the _count field from response
            };
        });

        return {
            quotations: enrichedQuotations,
            total,
            serverTimestamp: new Date().toISOString(),
        };
    } catch (error) {
        throw error;
    }
}

let getById = async (id: number, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const quotation = await tenantPrisma.quotation.findUnique({
            where: {
                id: id,
                deleted: false
            },
            include: {
                quotationItems: {
                    where: {
                        deleted: false
                    },
                    orderBy: { id: 'asc' }
                },
                purchaseOrders: {
                    where: {
                        deleted: false
                    },
                    orderBy: { id: 'asc' },
                    include: {
                        purchaseOrderItems: {
                            where: {
                                deleted: false
                            },
                            orderBy: { id: 'asc' }
                        },
                        deliveryOrders: {
                            where: {
                                deleted: false
                            },
                            orderBy: { id: 'asc' },
                            include: {
                                deliveryOrderItems: {
                                    where: {
                                        deleted: false
                                    },
                                    orderBy: { id: 'asc' }
                                }
                            }
                        },
                        invoices: {
                            where: {
                                deleted: false
                            },
                            orderBy: { id: 'asc' },
                            include: {
                                invoiceItems: {
                                    where: {
                                        deleted: false
                                    },
                                    orderBy: { id: 'asc' }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!quotation) {
            throw new NotFoundError("Quotation");
        }

        // Calculate counts and restructure purchase orders with extracted settlements
        const totalPurchaseOrderCount = quotation.purchaseOrders.length;
        let totalDeliveryOrderCount = 0;
        let totalInvoiceCount = 0;
        let totalSettlementCount = 0;

        // Process each purchase order to extract and deduplicate invoice settlements
        const enrichedPurchaseOrders = await Promise.all(
            quotation.purchaseOrders.map(async (po) => {
                totalDeliveryOrderCount += po.deliveryOrders?.length || 0;
                totalInvoiceCount += po.invoices?.length || 0;

                // Extract unique invoice settlement IDs from this PO's invoices
                const invoiceSettlementIds = new Set<number>();
                po.invoices.forEach(inv => {
                    if (inv.invoiceSettlementId) {
                        invoiceSettlementIds.add(inv.invoiceSettlementId);
                    }
                });

                // Fetch invoice settlements for this PO with related invoices
                const invoiceSettlements = invoiceSettlementIds.size > 0
                    ? await tenantPrisma.invoiceSettlement.findMany({
                        where: {
                            id: { in: Array.from(invoiceSettlementIds) },
                            deleted: false
                        },
                        orderBy: { id: 'asc' },
                        include: {
                            invoices: {
                                where: {
                                    deleted: false
                                },
                                orderBy: { id: 'asc' },
                            }
                        }
                    })
                    : [];

                totalSettlementCount += invoiceSettlements.length;

                // Return PO with settlements at the same level as invoices and delivery orders
                return {
                    ...po,
                    invoiceSettlements
                };
            })
        );

        // Return quotation with counts and restructured purchase orders
        return {
            ...quotation,
            purchaseOrders: enrichedPurchaseOrders,
            itemCount: quotation.quotationItems.length,
            purchaseOrderCount: totalPurchaseOrderCount,
            deliveryOrderCount: totalDeliveryOrderCount,
            invoiceCount: totalInvoiceCount,
            settlementCount: totalSettlementCount
        };
    }
    catch (error) {
        throw error;
    }
}

let createMany = async (databaseName: string, requestBody: CreateQuotationRequestBody): Promise<Quotation[]> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const { quotations } = requestBody;
        if (!quotations || !Array.isArray(quotations)) {
            throw new RequestValidateError('quotations must be a non-empty array');
        }

        // Extract unique IDs for batch validation
        const outletIds = [...new Set(quotations.map(q => q.outletId).filter(Boolean))];
        const supplierIds = [...new Set(quotations.map(q => q.supplierId).filter(Boolean))];
        const quotationNumbers = quotations.map(q => q.quotationNumber);

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

        // Batch check for duplicate quotation numbers
        const existingQuotations = await tenantPrisma.quotation.findMany({
            where: {
                quotationNumber: { in: quotationNumbers },
                deleted: false
            },
            select: { quotationNumber: true }
        });

        if (existingQuotations.length > 0) {
            const duplicateNumbers = existingQuotations.map(q => q.quotationNumber);
            throw new RequestValidateError(`Quotations with numbers ${duplicateNumbers.join(', ')} already exist`);
        }

        // Validate required fields
        for (const quotationData of quotations) {
            if (!quotationData.quotationNumber) {
                throw new RequestValidateError('quotationNumber is required');
            }
        }

        // Use single transaction for all creations
        const result = await tenantPrisma.$transaction(async (tx) => {
            const createdQuotations = [];

            for (const quotationData of quotations) {
                // Create quotation
                const newQuotation = await tx.quotation.create({
                    data: {
                        quotationNumber: quotationData.quotationNumber,
                        outletId: quotationData.outletId,
                        supplierId: quotationData.supplierId,
                        sessionId: quotationData.sessionId || null,
                        quotationDate: quotationData.quotationDate,
                        validUntilDate: quotationData.validUntilDate,
                        discountType: quotationData.discountType || '',
                        discountAmount: quotationData.discountAmount ? new Decimal(quotationData.discountAmount) : new Decimal(0),
                        serviceChargeAmount: quotationData.serviceChargeAmount ? new Decimal(quotationData.serviceChargeAmount) : new Decimal(0),
                        taxAmount: quotationData.taxAmount ? new Decimal(quotationData.taxAmount) : new Decimal(0),
                        roundingAmount: quotationData.roundingAmount ? new Decimal(quotationData.roundingAmount) : new Decimal(0),
                        subtotalAmount: quotationData.subtotalAmount ? new Decimal(quotationData.subtotalAmount) : new Decimal(0),
                        totalAmount: quotationData.totalAmount ? new Decimal(quotationData.totalAmount) : new Decimal(0),
                        status: quotationData.status || 'DRAFT',
                        remark: quotationData.remark,
                        currency: quotationData.currency || 'IDR',
                        performedBy: quotationData.performedBy,
                        isTaxInclusive: quotationData.isTaxInclusive !== undefined ? quotationData.isTaxInclusive : true,
                        convertedToPOAt: quotationData.convertedToPOAt,
                        convertedPOId: quotationData.convertedPOId,
                    },
                    include: {
                        quotationItems: {
                            include: {
                                item: true
                            }
                        }
                    }
                });

                // Create quotation items if provided
                if (quotationData.quotationItems && Array.isArray(quotationData.quotationItems) && quotationData.quotationItems.length > 0) {
                    await tx.quotationItem.createMany({
                        data: quotationData.quotationItems.map((item) => ({
                            quotationId: newQuotation.id,
                            itemId: item.itemId,
                            quantity: new Decimal(item.quantity),
                            unitPrice: new Decimal(item.unitPrice),
                            discountType: item.discountType || '',
                            discountAmount: item.discountAmount ? new Decimal(item.discountAmount) : new Decimal(0),
                            subtotal: new Decimal(item.subtotal),
                            taxAmount: item.taxAmount ? new Decimal(item.taxAmount) : new Decimal(0),
                            remark: item.remark || null,
                            leadTime: item.leadTime || null,
                            isAccepted: item.isAccepted || null,
                        })),
                    });

                    // Fetch the created items to include in response
                    const quotationItems = await tx.quotationItem.findMany({
                        where: { quotationId: newQuotation.id },
                    });

                    createdQuotations.push({
                        ...newQuotation,
                        quotationItems
                    });
                } else {
                    createdQuotations.push(newQuotation);
                }
            }

            return createdQuotations;
        });

        return result;
    }
    catch (error) {
        throw error
    }
}

let cancel = async (quotation: QuotationInput, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const { id, ...updateData } = quotation;

        if (!id) {
            throw new RequestValidateError('Quotation ID is required');
        }

        // Single query to get existing quotation with related data
        const existingQuotation = await tenantPrisma.quotation.findUnique({
            where: {
                id: id,
                deleted: false
            },
        });

        if (!existingQuotation) {
            throw new NotFoundError("Quotation");
        }

        // Use transaction to ensure data consistency
        const result = await tenantPrisma.$transaction(async (tx) => {
            // Update quotation status to Cancelled
            const updatedQuotation = await tx.quotation.update({
                where: { id: id },
                data: {
                    status: 'CANCELLED',
                    version: { increment: 1 }
                }
            });

            // Single query to fetch final result with all relationships (same as getById)
            const updatedQuotationWithRelations = await tx.quotation.findUnique({
                where: { id: id },
                include: {
                    quotationItems: {
                        where: {
                            deleted: false
                        },
                    },
                    purchaseOrders: {
                        where: {
                            deleted: false
                        }
                    }
                }
            });

            return updatedQuotationWithRelations;
        });

        return result;
    }
    catch (error) {
        throw error;
    }
}

let update = async (quotation: QuotationInput, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const { id, ...updateData } = quotation;

        if (!id) {
            throw new RequestValidateError('Quotation ID is required');
        }

        // Single query to get existing quotation with related data
        const existingQuotation = await tenantPrisma.quotation.findUnique({
            where: {
                id: id,
                deleted: false
            },
            include: {
                quotationItems: {
                    where: { deleted: false }
                },
                purchaseOrders: {
                    where: { deleted: false }
                }
            }
        });

        if (!existingQuotation) {
            throw new NotFoundError("Quotation");
        }

        // Batch validation queries for better performance
        const validationPromises = [];

        // Validate outlet if being updated
        if (updateData.outletId && updateData.outletId !== existingQuotation.outletId) {
            validationPromises.push(
                tenantPrisma.outlet.findFirst({
                    where: { id: updateData.outletId, deleted: false },
                    select: { id: true }
                }).then(outlet => ({ type: 'outlet', exists: !!outlet, id: updateData.outletId }))
            );
        }

        // Validate supplier if being updated
        if (updateData.supplierId && updateData.supplierId !== existingQuotation.supplierId) {
            validationPromises.push(
                tenantPrisma.supplier.findFirst({
                    where: { id: updateData.supplierId, deleted: false },
                    select: { id: true }
                }).then(supplier => ({ type: 'supplier', exists: !!supplier, id: updateData.supplierId }))
            );
        }

        // Validate quotation number if being changed
        if (updateData.quotationNumber &&
            updateData.quotationNumber !== existingQuotation.quotationNumber) {
            validationPromises.push(
                tenantPrisma.quotation.findFirst({
                    where: {
                        quotationNumber: updateData.quotationNumber,
                        deleted: false,
                        id: { not: id }
                    },
                    select: { id: true }
                }).then(duplicate => ({
                    type: 'quotationNumber',
                    exists: !!duplicate,
                    value: updateData.quotationNumber
                }))
            );
        }

        // Validate items if being updated
        if (updateData.quotationItems && Array.isArray(updateData.quotationItems)) {
            const itemIds = [...new Set(updateData.quotationItems.map(item => item.itemId).filter(Boolean))];
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
                case 'quotationNumber':
                    if ('exists' in result && 'value' in result && result.exists) {
                        throw new RequestValidateError(`Quotation with number ${result.value} already exists`);
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
            // Update quotation
            const updatedQuotation = await tx.quotation.update({
                where: { id: id },
                data: {
                    quotationNumber: updateData.quotationNumber,
                    outletId: updateData.outletId,
                    quotationDate: updateData.quotationDate,
                    validUntilDate: updateData.validUntilDate,
                    discountType: updateData.discountType || '',
                    discountAmount: updateData.discountAmount ? new Decimal(updateData.discountAmount) : new Decimal(0),
                    serviceChargeAmount: updateData.serviceChargeAmount ? new Decimal(updateData.serviceChargeAmount) : new Decimal(0),
                    taxAmount: updateData.taxAmount ? new Decimal(updateData.taxAmount) : new Decimal(0),
                    roundingAmount: updateData.roundingAmount ? new Decimal(updateData.roundingAmount) : new Decimal(0),
                    subtotalAmount: updateData.subtotalAmount ? new Decimal(updateData.subtotalAmount) : new Decimal(0),
                    totalAmount: updateData.totalAmount ? new Decimal(updateData.totalAmount) : new Decimal(0),
                    status: updateData.status,
                    remark: updateData.remark,
                    performedBy: updateData.performedBy,
                    isTaxInclusive: updateData.isTaxInclusive !== undefined ? updateData.isTaxInclusive : true,
                    convertedToPOAt: updateData.convertedToPOAt,
                    convertedPOId: updateData.convertedPOId,
                    version: { increment: 1 },
                    supplierId: updateData.supplierId,
                    currency: 'IDR',
                }
            });

            // If quotation is being cancelled, cancel all related purchase orders
            if (updateData.status?.toUpperCase() === 'CANCELLED' && existingQuotation.purchaseOrders.length > 0) {
                await tx.purchaseOrder.updateMany({
                    where: {
                        quotationId: id,
                        deleted: false
                    },
                    data: {
                        status: 'CANCELLED',
                        version: { increment: 1 }
                    }
                });
            }

            // Handle quotation items if provided
            if (updateData.quotationItems && Array.isArray(updateData.quotationItems)) {
                // Create maps for efficient lookup
                const existingItemsMap = new Map(
                    existingQuotation.quotationItems.map(item => [item.id, item])
                );

                const incomingItemsMap = new Map(
                    updateData.quotationItems
                        .filter(item => item.id) // Only items with existing IDs
                        .map(item => [item.id!, item])
                );

                // 1. Update existing items that are in the incoming data
                for (const incomingItem of updateData.quotationItems) {
                    if (incomingItem.id && existingItemsMap.has(incomingItem.id)) {
                        await tx.quotationItem.update({
                            where: { id: incomingItem.id },
                            data: {
                                itemId: incomingItem.itemId,
                                quantity: new Decimal(incomingItem.quantity),
                                unitPrice: new Decimal(incomingItem.unitPrice),
                                taxAmount: incomingItem.taxAmount ? new Decimal(incomingItem.taxAmount) : new Decimal(0),
                                discountType: incomingItem.discountType || '',
                                discountAmount: incomingItem.discountAmount ? new Decimal(incomingItem.discountAmount) : new Decimal(0),
                                subtotal: new Decimal(incomingItem.subtotal),
                                remark: incomingItem.remark || null,
                                leadTime: incomingItem.leadTime || null,
                                isAccepted: incomingItem.isAccepted || null,
                                updatedAt: new Date(),
                                version: { increment: 1 }
                            }
                        });
                    }
                }

                // 2. Create new items (items without ID or with ID that doesn't exist)
                const newItems = updateData.quotationItems.filter(item =>
                    !item.id || !existingItemsMap.has(item.id!)
                );

                if (newItems.length > 0) {
                    await tx.quotationItem.createMany({
                        data: newItems.map(item => ({
                            quotationId: id,
                            itemId: item.itemId,
                            quantity: new Decimal(item.quantity),
                            unitPrice: new Decimal(item.unitPrice),
                            taxAmount: item.taxAmount ? new Decimal(item.taxAmount) : new Decimal(0),
                            discountType: item.discountType || '',
                            discountAmount: item.discountAmount ? new Decimal(item.discountAmount) : new Decimal(0),
                            subtotal: new Decimal(item.subtotal),
                            remark: item.remark || null,
                            leadTime: item.leadTime || null,
                            isAccepted: item.isAccepted || null,
                            updatedAt: new Date()
                        }))
                    });
                }

                // 3. Soft delete items that are no longer in the incoming data
                const itemsToDelete = existingQuotation.quotationItems.filter(existingItem =>
                    !incomingItemsMap.has(existingItem.id)
                );

                if (itemsToDelete.length > 0) {
                    await tx.quotationItem.updateMany({
                        where: {
                            id: { in: itemsToDelete.map(item => item.id) },
                            quotationId: id
                        },
                        data: {
                            deleted: true,
                            deletedAt: new Date(),
                            version: { increment: 1 }
                        }
                    });
                }
            }

            // Single query to fetch final result with all relationships (same as getById)
            const updatedQuotationWithRelations = await tx.quotation.findUnique({
                where: { id: id },
                include: {
                    quotationItems: {
                        where: {
                            deleted: false
                        },
                    },
                    purchaseOrders: {
                        where: {
                            deleted: false
                        }
                    }
                }
            });

            return updatedQuotationWithRelations;
        });

        return result;
    }
    catch (error) {
        throw error;
    }
}

let deleteQuotation = async (id: number, databaseName: string): Promise<string> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        if (!id) {
            throw new RequestValidateError('Quotation ID is required');
        }

        // Check if quotation exists and is not already deleted
        const existingQuotation = await tenantPrisma.quotation.findUnique({
            where: {
                id: id,
                deleted: false
            },
            include: {
                purchaseOrders: {
                    where: { deleted: false }
                }
            }
        });

        if (!existingQuotation) {
            throw new NotFoundError("Quotation");
        }

        // Check if quotation has related purchase orders
        if (existingQuotation.purchaseOrders.length > 0) {
            throw new RequestValidateError('Cannot delete quotation with existing purchase orders');
        }

        // Use transaction to ensure data consistency
        await tenantPrisma.$transaction(async (tx) => {
            // Soft delete all quotation items first
            await tx.quotationItem.updateMany({
                where: {
                    quotationId: id,
                    deleted: false
                },
                data: {
                    deleted: true,
                    deletedAt: new Date(),
                    version: { increment: 1 }
                }
            });

            // Soft delete the quotation
            await tx.quotation.update({
                where: { id: id },
                data: {
                    deleted: true,
                    deletedAt: new Date(),
                    version: { increment: 1 }
                }
            });
        });

        return `Quotation with ID ${id} has been successfully deleted.`;
    }
    catch (error) {
        throw error;
    }
}

export = { getAll, getByDateRange, getById, createMany, cancel, update, deleteQuotation };