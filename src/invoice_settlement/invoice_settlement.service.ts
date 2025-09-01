import { Prisma, PrismaClient, StockBalance, StockMovement, Invoice } from "../../prisma/client/generated/client"
import { NotFoundError, VersionMismatchDetail, VersionMismatchError } from "../api-helpers/error"
import { getTenantPrisma } from '../db';
import { } from '../db';
import { SyncRequest } from "src/item/item.request";
import { create } from "domain";
import { CreateInvoiceSettlementRequestBody, InvoiceSettlementInput, SettlementSyncRequest } from "./invoice_settlement.request";

class RequestValidateError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RequestValidateError';
    }
}

// Helper function to filter valid InvoiceSettlement fields
const getValidSettlementFields = (data: any) => {
    const validFields = [
        'settlementNumber',
        'settlementDate',
        'settlementType',
        'paymentMethod',
        'settlementAmount',
        'currency',
        'exchangeRate',
        'reference',
        'remark',
        'status',
        'performedBy',
        'totalRebateAmount',
        'rebateReason',
        'totalInvoiceCount',
        'totalInvoiceAmount'
    ];

    const filteredData: any = {};
    for (const field of validFields) {
        if (data.hasOwnProperty(field)) {
            filteredData[field] = data[field];
        }
    }
    return filteredData;
};

let getByDateRange = async (databaseName: string, request: SyncRequest & { startDate: string, endDate: string }) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { skip = 0, take = 100, lastSyncTimestamp, startDate, endDate } = request;

    try {
        // Parse last sync timestamp or use a default (e.g., epoch start)
        const lastSync = (lastSyncTimestamp && lastSyncTimestamp !== 'null') ?
            new Date(lastSyncTimestamp) : new Date(0);

        // Parse and validate date range
        const parsedStartDate = new Date(startDate);
        parsedStartDate.setHours(0, 0, 0, 0); // Start of day

        const parsedEndDate = new Date(endDate);
        parsedEndDate.setHours(23, 59, 59, 999); // End of day

        // Ensure dates are valid
        if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
            throw new Error('Invalid date format');
        }

        // Build query conditions with date range for invoice settlements
        const where = {
            settlementDate: {
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
        const total = await tenantPrisma.invoiceSettlement.count({ where });

        // Fetch paginated settlements
        const settlements = await tenantPrisma.invoiceSettlement.findMany({
            where,
            skip,
            take,
            include: {
                _count: {
                    select: {
                        invoices: {
                            where: { deleted: false }
                        }
                    }
                }
            },
            orderBy: { settlementDate: 'desc' }
        });

        // Batch fetch invoices with purchase orders for all settlements
        const settlementIds = settlements.map(settlement => settlement.id);

        const invoices = await tenantPrisma.invoice.findMany({
            where: {
                invoiceSettlementId: { in: settlementIds },
                deleted: false
            },
            select: {
                id: true,
                invoiceSettlementId: true,
                purchaseOrder: {
                    select: {
                        id: true,
                        purchaseOrderNumber: true,
                        purchaseOrderDate: true,
                        status: true,
                        totalAmount: true,
                        subtotalAmount: true,
                        taxAmount: true,
                        discountAmount: true,
                        discountType: true,
                        serviceChargeAmount: true,
                        roundingAmount: true,
                        currency: true,
                        remark: true,
                        performedBy: true,
                        isTaxInclusive: true,
                        supplierId: true,
                        outletId: true,
                        createdAt: true,
                        updatedAt: true,
                        purchaseOrderItems: {
                            where: { deleted: false },
                            select: {
                                id: true,
                                itemId: true,
                                quantity: true,
                                unitPrice: true,
                                subtotal: true,
                                taxAmount: true,
                                discountAmount: true,
                                discountType: true,
                                remark: true,
                                createdAt: true,
                                updatedAt: true,
                            }
                        }
                    }
                },
                deliveryOrders: {
                    where: { deleted: false },
                    select: {
                        id: true
                    }
                }
            }
        });

        // Create lookup maps for purchase orders and delivery orders grouped by settlement ID
        const purchaseOrdersMap = new Map<number, Map<number, any>>();
        const deliveryOrderCountMap = new Map<number, number>();

        invoices.forEach(invoice => {
            const settlementId = invoice.invoiceSettlementId!;

            // Track unique purchase orders per settlement
            if (invoice.purchaseOrder) {
                if (!purchaseOrdersMap.has(settlementId)) {
                    purchaseOrdersMap.set(settlementId, new Map());
                }
                const poMap = purchaseOrdersMap.get(settlementId)!;
                // Use purchase order ID as key for deduplication
                poMap.set(invoice.purchaseOrder.id, invoice.purchaseOrder);
            }

            // Count delivery orders per settlement
            const currentCount = deliveryOrderCountMap.get(settlementId) || 0;
            deliveryOrderCountMap.set(settlementId, currentCount + invoice.deliveryOrders.length);
        });

        // Enrich with invoice count, purchase orders array, and delivery order count
        const enrichedSettlements = settlements.map(settlement => {
            const poMap = purchaseOrdersMap.get(settlement.id);
            const purchaseOrders = poMap ? Array.from(poMap.values()) : [];
            const deliveryOrderCount = deliveryOrderCountMap.get(settlement.id) || 0;

            return {
                ...settlement,
                invoiceCount: settlement._count.invoices,
                purchaseOrders: purchaseOrders,
                deliveryOrderCount: deliveryOrderCount,
                _count: undefined
            };
        });

        return {
            settlements: enrichedSettlements,
            total,
            serverTimestamp: new Date().toISOString(),
        };
    }
    catch (error) {
        throw error;
    }
}

let getSettlements = async (databaseName: string, request: SettlementSyncRequest) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { skip = 0, take = 100, lastSyncTimestamp, startDate, endDate } = request;

    try {
        // Parse last sync timestamp
        const lastSync = (lastSyncTimestamp && lastSyncTimestamp !== 'null') ?
            new Date(lastSyncTimestamp) : new Date(0);

        // Build base where conditions
        let where: any = {
            deleted: false,
            OR: [
                { createdAt: { gte: lastSync } },
                { updatedAt: { gte: lastSync } },
                { deletedAt: { gte: lastSync } },
            ],
        };

        // Add date range filter if provided
        if (startDate && endDate) {
            const parsedStartDate = new Date(startDate);
            parsedStartDate.setHours(0, 0, 0, 0);

            const parsedEndDate = new Date(endDate);
            parsedEndDate.setHours(23, 59, 59, 999);

            where.settlementDate = {
                gte: parsedStartDate,
                lte: parsedEndDate
            };
        }

        // Count total matching records
        const total = await tenantPrisma.invoiceSettlement.count({ where });

        // Fetch paginated settlements
        const settlements = await tenantPrisma.invoiceSettlement.findMany({
            where,
            skip,
            take,
            include: {
                _count: {
                    select: {
                        invoices: {
                            where: { deleted: false }
                        }
                    }
                }
            },
            orderBy: { settlementDate: 'desc' }
        });

        // Batch fetch invoices with purchase orders for all settlements
        const settlementIds = settlements.map(settlement => settlement.id);

        const invoices = await tenantPrisma.invoice.findMany({
            where: {
                invoiceSettlementId: { in: settlementIds },
                deleted: false
            },
            select: {
                id: true,
                invoiceSettlementId: true,
                purchaseOrder: {
                    select: {
                        id: true,
                        purchaseOrderNumber: true,
                        purchaseOrderDate: true,
                        status: true,
                        totalAmount: true,
                        subtotalAmount: true,
                        taxAmount: true,
                        discountAmount: true,
                        discountType: true,
                        serviceChargeAmount: true,
                        roundingAmount: true,
                        currency: true,
                        remark: true,
                        performedBy: true,
                        isTaxInclusive: true,
                        supplierId: true,
                        outletId: true,
                        createdAt: true,
                        updatedAt: true,
                        purchaseOrderItems: {
                            where: { deleted: false },
                            select: {
                                id: true,
                                itemId: true,
                                quantity: true,
                                unitPrice: true,
                                subtotal: true,
                                taxAmount: true,
                                discountAmount: true,
                                discountType: true,
                                remark: true,
                                createdAt: true,
                                updatedAt: true,
                            }
                        }
                    }
                },
                deliveryOrders: {
                    where: { deleted: false },
                    select: {
                        id: true
                    }
                }
            }
        });

        // Create lookup maps for purchase orders and delivery orders grouped by settlement ID
        const purchaseOrdersMap = new Map<number, Map<number, any>>();
        const deliveryOrderCountMap = new Map<number, number>();

        invoices.forEach(invoice => {
            const settlementId = invoice.invoiceSettlementId!;

            // Track unique purchase orders per settlement
            if (invoice.purchaseOrder) {
                if (!purchaseOrdersMap.has(settlementId)) {
                    purchaseOrdersMap.set(settlementId, new Map());
                }
                const poMap = purchaseOrdersMap.get(settlementId)!;
                // Use purchase order ID as key for deduplication
                poMap.set(invoice.purchaseOrder.id, invoice.purchaseOrder);
            }

            // Count delivery orders per settlement
            const currentCount = deliveryOrderCountMap.get(settlementId) || 0;
            deliveryOrderCountMap.set(settlementId, currentCount + invoice.deliveryOrders.length);
        });

        // Enrich with invoice count, purchase orders array, and delivery order count
        const enrichedSettlements = settlements.map(settlement => {
            const poMap = purchaseOrdersMap.get(settlement.id);
            const purchaseOrders = poMap ? Array.from(poMap.values()) : [];
            const deliveryOrderCount = deliveryOrderCountMap.get(settlement.id) || 0;

            return {
                ...settlement,
                invoiceCount: settlement._count.invoices,
                purchaseOrders: purchaseOrders,
                deliveryOrderCount: deliveryOrderCount,
                _count: undefined
            };
        });

        return {
            settlements: enrichedSettlements,
            total,
            serverTimestamp: new Date().toISOString(),
        };
    }
    catch (error) {
        throw error;
    }
}

let getSettlementById = async (id: number, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const settlement = await tenantPrisma.invoiceSettlement.findUnique({
            where: {
                id: id,
                deleted: false
            },
            include: {
                invoices: {
                    where: { deleted: false },
                    include: {
                        invoiceItems: {
                            where: { deleted: false },
                            include: {
                                item: {
                                    select: {
                                        id: true,
                                        itemName: true,
                                        itemCode: true
                                    }
                                }
                            }
                        },
                        purchaseOrder: {
                            select: {
                                id: true,
                                purchaseOrderNumber: true,
                                purchaseOrderDate: true,
                                status: true,
                                totalAmount: true,
                                subtotalAmount: true,
                                taxAmount: true,
                                discountAmount: true,
                                discountType: true,
                                serviceChargeAmount: true,
                                roundingAmount: true,
                                currency: true,
                                remark: true,
                                performedBy: true,
                                isTaxInclusive: true,
                                supplierId: true,
                                outletId: true,
                                createdAt: true,
                                updatedAt: true,
                                purchaseOrderItems: {
                                    where: { deleted: false },
                                    select: {
                                        id: true,
                                        itemId: true,
                                        quantity: true,
                                        unitPrice: true,
                                        subtotal: true,
                                        taxAmount: true,
                                        discountAmount: true,
                                        discountType: true,
                                        remark: true,
                                        createdAt: true,
                                        updatedAt: true,
                                    }
                                }
                            }
                        },
                        deliveryOrders: {
                            where: { deleted: false },
                            select: {
                                id: true,
                                trackingNumber: true,
                                deliveryDate: true,
                                status: true,
                                supplierId: true,
                                deliveryOrderItems: {
                                    where: { deleted: false },
                                    select: {
                                        id: true,
                                        itemId: true,
                                        orderedQuantity: true,
                                        receivedQuantity: true,
                                        unitPrice: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!settlement) {
            throw new NotFoundError("Invoice Settlement");
        }

        // Extract and deduplicate purchase orders using Map with ID as key
        const purchaseOrderMap = new Map();
        settlement.invoices.forEach(invoice => {
            if (invoice.purchaseOrder) {
                purchaseOrderMap.set(invoice.purchaseOrder.id, invoice.purchaseOrder);
            }
        });
        const purchaseOrders = Array.from(purchaseOrderMap.values());

        // Extract and deduplicate delivery orders using Map with ID as key
        const deliveryOrderMap = new Map();
        settlement.invoices.forEach(invoice => {
            invoice.deliveryOrders.forEach(deliveryOrder => {
                deliveryOrderMap.set(deliveryOrder.id, deliveryOrder);
            });
        });
        const deliveryOrders = Array.from(deliveryOrderMap.values());

        // Remove purchaseOrder and deliveryOrders from invoices to avoid duplication
        const invoicesWithoutRelations = settlement.invoices.map(invoice => {
            const { purchaseOrder, deliveryOrders, ...invoiceWithoutRelations } = invoice;
            return invoiceWithoutRelations;
        });

        // Return settlement with counts and restructured data
        return {
            ...settlement,
            invoices: invoicesWithoutRelations,
            purchaseOrders,
            deliveryOrders,
            purchaseOrderCount: purchaseOrders.length,
            deliveryOrderCount: deliveryOrders.length
        };
    }
    catch (error) {
        throw error;
    }
}


let createSettlement = async (databaseName: string, requestBody: CreateInvoiceSettlementRequestBody) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const { settlements } = requestBody;

        if (!settlements || !Array.isArray(settlements)) {
            throw new RequestValidateError('settlements must be a non-empty array');
        }

        // Validate each settlement's tax invoice numbers
        for (const settlement of settlements) {
            const { invoiceIds, invoiceTaxNumbers } = settlement;

            // Check if invoiceTaxNumbers array exists and matches invoiceIds length
            if (!invoiceTaxNumbers || !Array.isArray(invoiceTaxNumbers)) {
                throw new RequestValidateError('invoiceTaxNumbers must be provided as an array');
            }

            if (invoiceTaxNumbers.length !== invoiceIds.length) {
                throw new RequestValidateError('invoiceTaxNumbers array must have the same length as invoiceIds array');
            }

            // Validate that all tax numbers are valid numbers when provided
            for (let i = 0; i < invoiceTaxNumbers.length; i++) {
                const taxNumber = invoiceTaxNumbers[i];
                if (taxNumber !== null && taxNumber !== undefined && taxNumber !== 0 &&
                    (typeof taxNumber !== 'number' || isNaN(taxNumber) || taxNumber < 0)) {
                    throw new RequestValidateError(`Tax invoice number at index ${i} must be a valid non-negative number, null, or 0`);
                }
            }
        }

        // Extract unique invoice IDs for batch validation
        const allInvoiceIds = [...new Set(settlements.flatMap(s => s.invoiceIds))];

        // Validate invoices exist and are not already settled
        const existingInvoices = await tenantPrisma.invoice.findMany({
            where: {
                id: { in: allInvoiceIds },
                deleted: false,
                status: { in: ['Completed'] } // Only allow settling of issued/overdue invoices
            },
            select: {
                id: true,
                invoiceNumber: true,
                totalAmount: true,
                supplierId: true,
                invoiceSettlementId: true,
                remark: true
            }
        });

        const existingInvoiceIds = new Set(existingInvoices.map(inv => inv.id));
        const missingInvoiceIds = allInvoiceIds.filter(id => !existingInvoiceIds.has(id));

        if (missingInvoiceIds.length > 0) {
            throw new RequestValidateError(`Invoices with IDs ${missingInvoiceIds.join(', ')} do not exist or are not eligible for settlement`);
        }

        // Check for already settled invoices
        const alreadySettledInvoices = existingInvoices.filter(inv => inv.invoiceSettlementId !== null);
        if (alreadySettledInvoices.length > 0) {
            const settledNumbers = alreadySettledInvoices.map(inv => inv.invoiceNumber);
            throw new RequestValidateError(`Invoices ${settledNumbers.join(', ')} are already settled`);
        }

        // Check for duplicate settlement numbers
        const settlementNumbers = settlements.map(s => s.settlementNumber).filter(Boolean);
        if (settlementNumbers.length > 0) {
            const existingSettlements = await tenantPrisma.invoiceSettlement.findMany({
                where: {
                    settlementNumber: { in: settlementNumbers },
                    deleted: false
                },
                select: { settlementNumber: true }
            });

            if (existingSettlements.length > 0) {
                const duplicateNumbers = existingSettlements.map(s => s.settlementNumber);
                throw new RequestValidateError(`Settlement numbers already exist: ${duplicateNumbers.join(', ')}`);
            }
        }

        // Use transaction for all settlements
        const result = await tenantPrisma.$transaction(async (tx) => {
            const createdSettlements = [];

            for (const settlementData of settlements) {
                // Sort invoiceIds and invoiceTaxNumbers together to maintain relationship
                const invoiceData = settlementData.invoiceIds.map((id, index) => ({
                    invoiceId: id,
                    taxNumber: settlementData.invoiceTaxNumbers[index]
                })).sort((a, b) => a.invoiceId - b.invoiceId);

                const sortedInvoiceIds = invoiceData.map(item => item.invoiceId);
                const sortedTaxNumbers = invoiceData.map(item => item.taxNumber);

                // Check for incomplete tax numbers (null, undefined, non-positive numbers, or 0)
                const hasIncompleteTaxNumbers = sortedTaxNumbers.some(taxNumber =>
                    taxNumber === null ||
                    taxNumber === undefined ||
                    taxNumber === 0 ||
                    typeof taxNumber !== 'number' ||
                    isNaN(taxNumber) ||
                    taxNumber < 0
                );

                // Get invoice details for this settlement
                const settlementInvoices = existingInvoices.filter(inv =>
                    sortedInvoiceIds.includes(inv.id)
                );

                // Calculate totals
                const totalInvoiceAmount = settlementInvoices.reduce((sum, inv) =>
                    sum + Number(inv.totalAmount), 0
                );
                const totalInvoiceCount = settlementInvoices.length;

                // Determine settlement status based on tax number completeness
                const settlementStatus = hasIncompleteTaxNumbers ? 'INCOMPLETE' : (settlementData.status || 'COMPLETED');

                // Create settlement
                const newSettlement = await tx.invoiceSettlement.create({
                    data: {
                        settlementNumber: settlementData.settlementNumber,
                        settlementDate: settlementData.settlementDate,
                        settlementType: settlementData.settlementType,
                        paymentMethod: settlementData.paymentMethod || null,
                        settlementAmount: settlementData.settlementAmount,
                        currency: settlementData.currency,
                        exchangeRate: settlementData.exchangeRate || 1,
                        reference: settlementData.reference || null,
                        remark: settlementData.remark || null,
                        status: settlementStatus,
                        performedBy: settlementData.performedBy || null,
                        totalRebateAmount: settlementData.totalRebateAmount || 0,
                        rebateReason: settlementData.rebateReason || null,
                        totalInvoiceCount: totalInvoiceCount,
                        totalInvoiceAmount: totalInvoiceAmount
                    }
                });

                // Handle rebate distribution if totalRebateAmount > 0
                if (settlementData.totalRebateAmount && settlementData.totalRebateAmount > 0) {
                    // Calculate flat rebate per invoice
                    const rebatePerInvoice = Number(settlementData.totalRebateAmount) / settlementInvoices.length;
                    let remainingRebate = Number(settlementData.totalRebateAmount);

                    // Apply flat rebate to each invoice
                    for (let i = 0; i < settlementInvoices.length; i++) {
                        const invoice = settlementInvoices[i];
                        let invoiceRebate: number;

                        if (i === settlementInvoices.length - 1) {
                            // Last invoice gets remaining rebate to handle rounding
                            invoiceRebate = remainingRebate;
                        } else {
                            // Flat rebate amount for each invoice
                            invoiceRebate = Math.round(rebatePerInvoice * 100) / 100;
                            remainingRebate -= invoiceRebate;
                        }

                        // Calculate new total amount after rebate discount
                        const originalTotalAmount = Number(invoice.totalAmount);
                        const newTotalAmount = originalTotalAmount - invoiceRebate;

                        // Get invoice items to distribute rebate proportionally
                        const invoiceItems = await tx.invoiceItem.findMany({
                            where: {
                                invoiceId: invoice.id,
                                deleted: false
                            },
                            select: {
                                id: true,
                                subtotal: true
                            }
                        });

                        // Calculate total subtotal of all items for this invoice
                        const totalItemsSubtotal = invoiceItems.reduce((sum, item) =>
                            sum + Number(item.subtotal), 0
                        );

                        // Distribute invoice rebate to individual items
                        let remainingItemRebate = invoiceRebate;
                        for (let j = 0; j < invoiceItems.length; j++) {
                            const item = invoiceItems[j];
                            let itemDiscount: number;

                            if (j === invoiceItems.length - 1) {
                                // Last item gets remaining rebate to handle rounding
                                itemDiscount = remainingItemRebate;
                            } else {
                                // Calculate proportional discount based on item subtotal
                                const itemProportion = Number(item.subtotal) / totalItemsSubtotal;
                                itemDiscount = Math.round(rebatePerInvoice * itemProportion * 100) / 100;
                                remainingItemRebate -= itemDiscount;
                            }

                            // Calculate new subtotal after discount
                            const newItemSubtotal = Number(item.subtotal) - itemDiscount;

                            // Update invoice item with discount
                            await tx.invoiceItem.update({
                                where: { id: item.id },
                                data: {
                                    discountType: 'FIXED',
                                    discountAmount: itemDiscount,
                                    subtotal: newItemSubtotal
                                }
                            });
                        }

                        // Update invoice with rebate discount and recalculated total
                        await tx.invoice.update({
                            where: { id: invoice.id },
                            data: {
                                invoiceSettlementId: newSettlement.id,
                                status: 'PAID',
                                paymentDate: settlementData.settlementDate,
                                discountType: 'FIXED',
                                discountAmount: invoiceRebate,
                                totalAmount: newTotalAmount,
                                remark: `${invoice.remark || ''}${invoice.remark ? '\n' : ''}Rebate applied: ${invoiceRebate}`
                            }
                        });
                    }
                } else {
                    // Update invoices without rebate, using sorted invoice IDs
                    await tx.invoice.updateMany({
                        where: {
                            id: { in: sortedInvoiceIds },
                            deleted: false
                        },
                        data: {
                            invoiceSettlementId: newSettlement.id,
                            status: 'PAID',
                            paymentDate: settlementData.settlementDate
                        }
                    });
                }

                // Update individual invoices with their corresponding tax numbers
                for (let i = 0; i < sortedInvoiceIds.length; i++) {
                    const invoiceId = sortedInvoiceIds[i];
                    const taxNumber = sortedTaxNumbers[i];

                    // Only update tax number if it's a valid positive number (not 0), convert to string for database
                    const updateData: any = {};
                    if (taxNumber !== null && taxNumber !== undefined && taxNumber !== 0 &&
                        typeof taxNumber === 'number' && !isNaN(taxNumber) && taxNumber > 0) {
                        updateData.taxInvoiceNumber = taxNumber.toString();
                    } else {
                        updateData.taxInvoiceNumber = ''; // Store empty string instead of null
                    }

                    if (Object.keys(updateData).length > 0) {
                        await tx.invoice.update({
                            where: { id: invoiceId },
                            data: updateData
                        });
                    }
                }

                // Fetch the complete settlement with related invoices
                const completeSettlement = await tx.invoiceSettlement.findUnique({
                    where: { id: newSettlement.id },
                    include: {
                        invoices: {
                            where: { deleted: false },
                            select: {
                                id: true,
                                invoiceNumber: true,
                                totalAmount: true,
                                discountAmount: true,
                                discountType: true,
                                supplierId: true,
                                supplier: {
                                    select: {
                                        id: true,
                                        companyName: true
                                    }
                                }
                            }
                        }
                    }
                });
                createdSettlements.push(completeSettlement);
            }
            return createdSettlements;
        });

        return result;
    }
    catch (error) {
        throw error;
    }
}

let updateSettlement = async (settlement: InvoiceSettlementInput, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const { id, invoiceIds, invoiceTaxNumbers, ...updateData } = settlement;
        if (!id) {
            throw new RequestValidateError('Settlement ID is required');
        }

        // Get existing settlement
        const existingSettlement = await tenantPrisma.invoiceSettlement.findUnique({
            where: { id: id, deleted: false },
            select: {
                id: true,
                version: true,
                settlementNumber: true,
                status: true
            }
        });

        if (!existingSettlement) {
            throw new NotFoundError("Invoice Settlement");
        }

        // Check if settlement can be updated (only allow updates for certain statuses)
        if (existingSettlement.status === 'COMPLETED' && updateData.status !== 'CANCELLED') {
            throw new RequestValidateError('Cannot modify completed settlement');
        }

        // Check for duplicate settlement number if being updated
        if (updateData.settlementNumber && updateData.settlementNumber !== existingSettlement.settlementNumber) {
            const duplicateSettlement = await tenantPrisma.invoiceSettlement.findFirst({
                where: {
                    settlementNumber: updateData.settlementNumber,
                    deleted: false,
                    id: { not: id }
                },
                select: { id: true }
            });

            if (duplicateSettlement) {
                throw new RequestValidateError(`Settlement number ${updateData.settlementNumber} already exists`);
            }
        }

        // Remove any fields that don't belong to the settlement table and filter valid fields only
        const cleanUpdateData = getValidSettlementFields(updateData);

        // Use transaction for update
        const result = await tenantPrisma.$transaction(async (tx) => {

            // Handle invoice tax number updates only
            if (invoiceIds !== undefined && invoiceTaxNumbers) {
                // Validate arrays have same length
                if (invoiceTaxNumbers.length !== invoiceIds.length) {
                    throw new RequestValidateError('invoiceTaxNumbers array must have the same length as invoiceIds array');
                }

                // Validate that invoices belong to this settlement
                const settlementInvoices = await tx.invoice.findMany({
                    where: {
                        id: { in: invoiceIds },
                        invoiceSettlementId: id,
                        deleted: false
                    },
                    select: { id: true }
                });

                if (settlementInvoices.length !== invoiceIds.length) {
                    throw new RequestValidateError('Some invoices do not belong to this settlement');
                }

                // Check for incomplete tax numbers to determine settlement status
                const hasIncompleteTaxNumbers = invoiceTaxNumbers.some(taxNumber =>
                    taxNumber === null ||
                    taxNumber === undefined ||
                    taxNumber === 0 ||
                    typeof taxNumber !== 'number' ||
                    isNaN(taxNumber) ||
                    taxNumber < 0
                );

                // Update settlement status based on tax number completeness
                if (hasIncompleteTaxNumbers) {
                    cleanUpdateData.status = 'INCOMPLETE';
                }

                // Update individual invoices with their corresponding tax numbers and status
                for (let i = 0; i < invoiceIds.length; i++) {
                    const invoiceId = invoiceIds[i];
                    const taxNumber = invoiceTaxNumbers[i];

                    const invoiceUpdateData: any = {};

                    // Handle tax invoice number - use empty string instead of null for non-nullable field
                    if (taxNumber !== null && taxNumber !== undefined && taxNumber !== 0 &&
                        typeof taxNumber === 'number' && !isNaN(taxNumber) && taxNumber > 0) {
                        invoiceUpdateData.taxInvoiceNumber = taxNumber.toString();
                        invoiceUpdateData.status = 'PAID'; // Valid tax number means complete
                    } else {
                        invoiceUpdateData.taxInvoiceNumber = ''; // Store empty string instead of null
                        invoiceUpdateData.status = 'INCOMPLETE'; // Invalid/missing tax number means incomplete
                    }

                    await tx.invoice.update({
                        where: { id: invoiceId },
                        data: invoiceUpdateData
                    });
                }
            }
            // Update settlement
            const updatedSettlement = await tx.invoiceSettlement.update({
                where: { id: id },
                data: {
                    ...cleanUpdateData,
                    version: { increment: 1 }
                },
                include: {
                    invoices: {
                        where: { deleted: false },
                    }
                }
            });
            return updatedSettlement;
        });

        return result;
    }
    catch (error) {
        throw error;
    }
}

export = { getByDateRange, createSettlement, getSettlements, getSettlementById, updateSettlement };