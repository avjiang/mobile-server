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
                // Delivery order has invoice or its related entities modified
                {
                    invoice: {
                        OR: [
                            // Invoice itself was modified
                            { createdAt: { gte: lastSync } },
                            { updatedAt: { gte: lastSync } },
                            { deletedAt: { gte: lastSync } },
                            // Invoice settlement was modified
                            {
                                invoiceSettlement: {
                                    OR: [
                                        { createdAt: { gte: lastSync } },
                                        { updatedAt: { gte: lastSync } },
                                        { deletedAt: { gte: lastSync } }
                                    ]
                                }
                            },
                            // Purchase returns were modified
                            {
                                purchaseReturns: {
                                    some: {
                                        OR: [
                                            { createdAt: { gte: lastSync } },
                                            { updatedAt: { gte: lastSync } },
                                            { deletedAt: { gte: lastSync } }
                                        ]
                                    }
                                }
                            }
                        ]
                    }
                },
                // Delivery order has purchase order that was modified
                {
                    purchaseOrder: {
                        OR: [
                            { createdAt: { gte: lastSync } },
                            { updatedAt: { gte: lastSync } },
                            { deletedAt: { gte: lastSync } }
                        ]
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
                        where: {
                            deleted: false,
                            status: { not: 'CANCELLED' }
                        }
                    }
                }
            })
        ]);

        // Batch fetch purchase returns for all invoices (minimal fields for summary)
        const invoiceIds = deliveryOrders
            .map(do_ => do_.invoiceId)
            .filter((id): id is number => typeof id === 'number');

        const purchaseReturns = invoiceIds.length > 0
            ? await tenantPrisma.purchaseReturn.findMany({
                where: { invoiceId: { in: invoiceIds }, deleted: false, status: 'COMPLETED' },
                select: { id: true, invoiceId: true, totalReturnAmount: true }
            })
            : [];

        // Create lookup map for purchase returns grouped by invoice ID
        const purchaseReturnMap = new Map<number, { count: number; totalAmount: Decimal }>();
        purchaseReturns.forEach(pr => {
            const existing = purchaseReturnMap.get(pr.invoiceId!) || { count: 0, totalAmount: new Decimal(0) };
            purchaseReturnMap.set(pr.invoiceId!, {
                count: existing.count + 1,
                totalAmount: existing.totalAmount.plus(new Decimal(pr.totalReturnAmount || 0))
            });
        });

        // Transform response with purchase return summary
        const enrichedDeliveryOrders = deliveryOrders.map(do_ => {
            const returnData = do_.invoiceId ? purchaseReturnMap.get(do_.invoiceId) : null;
            return {
                ...do_,
                itemCount: do_._count.deliveryOrderItems,
                purchaseOrderNumber: do_.purchaseOrder?.purchaseOrderNumber || null,
                purchaseOrderDate: do_.purchaseOrder?.purchaseOrderDate || null,
                invoiceNumber: do_.invoice?.invoiceNumber || null,
                invoiceDate: do_.invoice?.invoiceDate || null,
                invoiceSettlementId: do_.invoice?.invoiceSettlement?.id || null,
                invoiceSettlementNumber: do_.invoice?.invoiceSettlement?.settlementNumber || null,
                invoiceSettlementDate: do_.invoice?.invoiceSettlement?.settlementDate || null,
                // Purchase return summary
                returnCount: returnData?.count || 0,
                totalReturnAmount: returnData?.totalAmount.toFixed(4) || '0.0000',
                hasReturns: (returnData?.count || 0) > 0,
                _count: undefined,
                purchaseOrder: undefined,
                invoice: undefined
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
                    where: { deleted: false },
                    select: {
                        id: true,
                        itemId: true,
                        itemVariantId: true,
                        variantSku: true,
                        variantName: true,
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
                        quotationId: true,
                        discountType: true,
                        discountAmount: true,
                        serviceChargeAmount: true,
                        taxAmount: true,
                        isTaxInclusive: true,
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
                    where: {
                        deleted: false,
                        status: { not: 'CANCELLED' }
                    },
                    select: {
                        id: true,
                        invoiceNumber: true,
                        invoiceDate: true,
                        taxInvoiceNumber: true,
                        purchaseOrderId: true,
                        supplierId: true,
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

        // Get invoiceSettlement and purchase returns in parallel if invoice exists
        let invoiceSettlement = null;
        let purchaseReturns: any[] = [];
        let totalReturnAmount = new Decimal(0);

        if (deliveryOrder.invoice?.id) {
            // Fetch settlement info and purchase returns in parallel
            const [invoiceWithSettlement, invoicePurchaseReturns] = await Promise.all([
                tenantPrisma.invoice.findUnique({
                    where: { id: deliveryOrder.invoice.id },
                    select: {
                        invoiceSettlement: {
                            where: { deleted: false },
                            select: {
                                id: true, settlementNumber: true, settlementDate: true,
                                settlementType: true, paymentMethod: true, settlementAmount: true,
                                currency: true, exchangeRate: true, reference: true, remark: true,
                                status: true, performedBy: true, totalRebateAmount: true,
                                rebateReason: true, totalInvoiceCount: true, totalInvoiceAmount: true,
                                createdAt: true, updatedAt: true
                            }
                        }
                    }
                }),
                tenantPrisma.purchaseReturn.findMany({
                    where: { invoiceId: deliveryOrder.invoice.id, deleted: false, status: 'COMPLETED' },
                    select: {
                        id: true, returnNumber: true, returnDate: true, status: true,
                        totalReturnAmount: true, remark: true,
                        purchaseReturnItems: {
                            where: { deleted: false },
                            select: { id: true, itemId: true, itemVariantId: true, quantity: true, unitPrice: true, returnReason: true }
                        }
                    }
                })
            ]);

            purchaseReturns = invoicePurchaseReturns;
            totalReturnAmount = purchaseReturns.reduce(
                (sum, pr) => sum.plus(new Decimal(pr.totalReturnAmount || 0)),
                new Decimal(0)
            );

            // If invoice settlement exists, get all linked invoices with minimal info
            if (invoiceWithSettlement?.invoiceSettlement) {
                const invoices = await tenantPrisma.invoice.findMany({
                    where: { invoiceSettlementId: invoiceWithSettlement.invoiceSettlement.id, deleted: false },
                    select: { id: true, invoiceNumber: true, subtotalAmount: true, totalAmount: true, status: true, taxInvoiceNumber: true }
                });

                invoiceSettlement = { ...invoiceWithSettlement.invoiceSettlement, invoices };
            }
        }

        // Transform the response with purchase return summary
        const transformedResult = {
            ...deliveryOrder,
            invoiceSettlement,
            // Purchase return summary
            purchaseReturns,
            returnCount: purchaseReturns.length,
            totalReturnAmount: totalReturnAmount.toFixed(4),
            hasReturns: purchaseReturns.length > 0
        };

        return transformedResult;
    }
    catch (error) {
        throw error;
    }
}

let getByDateRange = async (databaseName: string, request: { outletId?: string, skip?: number, take?: number, startDate: string, endDate: string }) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { outletId, skip = 0, take = 100, startDate, endDate } = request;

    try {
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
        };

        // Count total matching records
        const total = await tenantPrisma.deliveryOrder.count({ where });

        // Fetch paginated delivery orders with minimal data
        const deliveryOrders = await tenantPrisma.deliveryOrder.findMany({
            where,
            skip,
            take,
            orderBy: { id: 'asc' },
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
                    where: {
                        deleted: false,
                        status: { not: 'CANCELLED' }
                    }
                }
            }
        });

        // Batch fetch purchase returns for all invoices (minimal fields for summary)
        const invoiceIds = deliveryOrders
            .map(do_ => do_.invoiceId)
            .filter((id): id is number => typeof id === 'number');

        const purchaseReturns = invoiceIds.length > 0
            ? await tenantPrisma.purchaseReturn.findMany({
                where: { invoiceId: { in: invoiceIds }, deleted: false, status: 'COMPLETED' },
                select: { id: true, invoiceId: true, totalReturnAmount: true }
            })
            : [];

        // Create lookup map for purchase returns grouped by invoice ID
        const purchaseReturnMap = new Map<number, { count: number; totalAmount: Decimal }>();
        purchaseReturns.forEach(pr => {
            const existing = purchaseReturnMap.get(pr.invoiceId!) || { count: 0, totalAmount: new Decimal(0) };
            purchaseReturnMap.set(pr.invoiceId!, {
                count: existing.count + 1,
                totalAmount: existing.totalAmount.plus(new Decimal(pr.totalReturnAmount || 0))
            });
        });

        // Enrich delivery orders with purchase return summary
        const enrichedDeliveryOrders = deliveryOrders.map(do_ => {
            const returnData = do_.invoiceId ? purchaseReturnMap.get(do_.invoiceId) : null;
            return {
                ...do_,
                itemCount: do_._count.deliveryOrderItems,
                purchaseOrderNumber: do_.purchaseOrder?.purchaseOrderNumber || null,
                purchaseOrderDate: do_.purchaseOrder?.purchaseOrderDate || null,
                invoiceNumber: do_.invoice?.invoiceNumber || null,
                invoiceDate: do_.invoice?.invoiceDate || null,
                invoiceSettlementId: do_.invoice?.invoiceSettlement?.id || null,
                invoiceSettlementNumber: do_.invoice?.invoiceSettlement?.settlementNumber || null,
                invoiceSettlementDate: do_.invoice?.invoiceSettlement?.settlementDate || null,
                // Purchase return summary
                returnCount: returnData?.count || 0,
                totalReturnAmount: returnData?.totalAmount.toFixed(4) || '0.0000',
                hasReturns: (returnData?.count || 0) > 0,
                _count: undefined,
                purchaseOrder: undefined,
                invoice: undefined
            };
        });

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
                        status: deliveryOrderData.status || 'Pending',
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
                            itemVariantId: item.itemVariantId || null,
                            variantSku: item.variantSku || null,
                            variantName: item.variantName || null,
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
    const movementOperations = [];
    const receiptOperations = [];

    // Get all current stock balances in one query (supports variants)
    const currentStockBalances = await tx.stockBalance.findMany({
        where: {
            OR: items.map(item => ({
                itemId: item.itemId,
                itemVariantId: item.itemVariantId || null,
                outletId: deliveryOrder.outletId,
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

    for (const item of items) {
        if (item.receivedQuantity > 0) {
            // Use composite key for variant support
            const balanceKey = `${item.itemId}-${item.itemVariantId || 'null'}`;
            const currentBalance = stockBalanceMap.get(balanceKey);

            // Convert to Decimal objects for proper arithmetic
            const previousAvailableQuantity = new Decimal(currentBalance?.availableQuantity || 0);
            const previousOnHandQuantity = new Decimal(currentBalance?.onHandQuantity || 0);
            const quantityDelta = new Decimal(item.receivedQuantity);

            // Use Decimal.add() for proper arithmetic
            const newAvailableQuantity = previousAvailableQuantity.add(quantityDelta);
            const newOnHandQuantity = previousOnHandQuantity.add(quantityDelta);

            // Calculate per-unit cost: unitPrice + (deliveryFee / quantity)
            const deliveryFee = new Decimal(item.deliveryFee || 0);
            const unitPrice = new Decimal(item.unitPrice || 0);
            const perUnitCost = unitPrice.plus(deliveryFee.div(quantityDelta));

            // Use update if balance exists (by id), otherwise create new
            // This avoids Prisma compound unique key issues with nullable fields
            if (currentBalance?.id) {
                await tx.stockBalance.update({
                    where: { id: currentBalance.id },
                    data: {
                        availableQuantity: newAvailableQuantity,
                        onHandQuantity: newOnHandQuantity,
                        lastRestockDate: new Date(),
                        updatedAt: new Date()
                    }
                });
            } else {
                await tx.stockBalance.create({
                    data: {
                        itemId: item.itemId,
                        outletId: deliveryOrder.outletId,
                        itemVariantId: item.itemVariantId || null,
                        availableQuantity: quantityDelta,
                        onHandQuantity: quantityDelta,
                        reorderThreshold: null,
                        lastRestockDate: new Date()
                    }
                });
            }

            // Prepare movement operation - convert Decimal to number for storage
            movementOperations.push({
                itemId: item.itemId,
                outletId: deliveryOrder.outletId,
                itemVariantId: item.itemVariantId || null,
                previousAvailableQuantity: previousAvailableQuantity,
                previousOnHandQuantity: previousOnHandQuantity,
                availableQuantityDelta: quantityDelta,
                onHandQuantityDelta: quantityDelta,
                movementType: 'Delivery Receipt',
                documentId: deliveryOrder.id,
                reason: `Stock received from delivery order #${deliveryOrder.id}`,
                remark: item.remark || '',
                performedBy: performedBy || 'SYSTEM'
            });

            // Prepare receipt operation with per-unit cost
            receiptOperations.push({
                itemId: item.itemId,
                outletId: deliveryOrder.outletId,
                itemVariantId: item.itemVariantId || null,
                deliveryOrderId: deliveryOrder.id,
                quantity: quantityDelta,
                cost: perUnitCost,
                receiptDate: new Date()
            });
        }
    }

    // Execute movements and receipts in batch
    await Promise.all([
        movementOperations.length > 0 ? tx.stockMovement.createMany({ data: movementOperations }) : Promise.resolve(),
        receiptOperations.length > 0 ? tx.stockReceipt.createMany({ data: receiptOperations }) : Promise.resolve()
    ]);
};

// Helper function to reverse stock operations when delivery order is cancelled
const reverseStockOperationsForCancellation = async (tx: Prisma.TransactionClient, items: any[], deliveryOrder: any, performedBy: string) => {
    const movementOperations = [];

    // Get all current stock balances in one query (supports variants)
    const currentStockBalances = await tx.stockBalance.findMany({
        where: {
            OR: items.map(item => ({
                itemId: item.itemId,
                itemVariantId: item.itemVariantId || null,
                outletId: deliveryOrder.outletId,
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

    for (const item of items) {
        if (item.receivedQuantity > 0) {
            // Use composite key for variant support
            const balanceKey = `${item.itemId}-${item.itemVariantId || 'null'}`;
            const currentBalance = stockBalanceMap.get(balanceKey);

            if (currentBalance) {
                // Convert to Decimal objects for proper arithmetic
                const previousAvailableQuantity = new Decimal(currentBalance.availableQuantity);
                const previousOnHandQuantity = new Decimal(currentBalance.onHandQuantity);
                const quantityDelta = new Decimal(item.receivedQuantity);

                // Subtract the previously received quantities
                const newAvailableQuantity = previousAvailableQuantity.sub(quantityDelta);
                const newOnHandQuantity = previousOnHandQuantity.sub(quantityDelta);

                // Ensure quantities don't go negative
                const finalAvailableQuantity = newAvailableQuantity.lt(0) ? new Decimal(0) : newAvailableQuantity;
                const finalOnHandQuantity = newOnHandQuantity.lt(0) ? new Decimal(0) : newOnHandQuantity;

                // Update stock balance by id (avoids Prisma compound unique key issues with nullable fields)
                await tx.stockBalance.update({
                    where: { id: currentBalance.id },
                    data: {
                        availableQuantity: finalAvailableQuantity,
                        onHandQuantity: finalOnHandQuantity,
                        updatedAt: new Date()
                    }
                });

                // Create negative movement to reverse the original receipt
                movementOperations.push({
                    itemId: item.itemId,
                    outletId: deliveryOrder.outletId,
                    itemVariantId: item.itemVariantId || null,
                    previousAvailableQuantity: previousAvailableQuantity,
                    previousOnHandQuantity: previousOnHandQuantity,
                    availableQuantityDelta: quantityDelta.neg(), // Negative delta for reversal
                    onHandQuantityDelta: quantityDelta.neg(), // Negative delta for reversal
                    movementType: 'Delivery Cancellation',
                    documentId: deliveryOrder.id,
                    reason: `Stock adjustment for cancelled delivery order #${deliveryOrder.id}`,
                    remark: item.remark || 'Delivery order cancelled',
                    performedBy: performedBy || 'SYSTEM'
                });
            }
        }
    }

    // Execute movements in batch
    if (movementOperations.length > 0) {
        await tx.stockMovement.createMany({ data: movementOperations });
    }

    // Soft delete existing stock receipts for this delivery order
    await tx.stockReceipt.updateMany({
        where: {
            deliveryOrderId: deliveryOrder.id,
            deleted: false
        },
        data: {
            deleted: true,
            deletedAt: new Date()
        }
    });
};

let update = async (deliveryOrder: DeliveryOrderInput, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const { id, ...updateData } = deliveryOrder;

        if (!id) {
            throw new RequestValidateError('Delivery order ID is required');
        }

        // Enhanced query to get existing delivery order with more data upfront
        const existingDeliveryOrder = await tenantPrisma.deliveryOrder.findUnique({
            where: { id: id, deleted: false },
            select: {
                id: true,
                outletId: true,
                customerId: true,
                purchaseOrderId: true,
                status: true,
                version: true,
                deliveryOrderItems: {
                    where: { deleted: false },
                    select: {
                        id: true,
                        itemId: true,
                        receivedQuantity: true,
                        unitPrice: true,
                        deliveryFee: true,
                        remark: true
                    }
                }
            }
        });

        if (!existingDeliveryOrder) {
            throw new NotFoundError("Delivery Order");
        }

        // Early return if no changes needed
        const hasChanges = Object.keys(updateData).some(key => {
            if (key === 'deliveryOrderItems') return true; // Always check items
            return updateData[key as keyof typeof updateData] !== undefined;
        });

        if (!hasChanges) {
            // Return existing data without unnecessary queries
            return await tenantPrisma.deliveryOrder.findUnique({
                where: { id: id },
                include: {
                    purchaseOrder: {
                        select: {
                            id: true,
                            purchaseOrderNumber: true,
                            outletId: true,
                            supplierId: true,
                            deleted: true,
                            deletedAt: true,
                            createdAt: true,
                            updatedAt: true,
                            version: true,
                            isTaxInclusive: true,
                            purchaseOrderItems: {
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
        }

        // Optimized validation with early filtering and batching
        const validationPromises = [];
        const validationData = {
            outlet: updateData.outletId && updateData.outletId !== existingDeliveryOrder.outletId ? updateData.outletId : null,
            customer: updateData.customerId && updateData.customerId !== existingDeliveryOrder.customerId ? updateData.customerId : null,
            purchaseOrder: updateData.purchaseOrderId && updateData.purchaseOrderId !== existingDeliveryOrder.purchaseOrderId ? updateData.purchaseOrderId : null,
            items: updateData.deliveryOrderItems && Array.isArray(updateData.deliveryOrderItems) ?
                [...new Set(updateData.deliveryOrderItems.map(item => item.itemId).filter(Boolean))] : null
        };

        // Batch all foreign key validations in a single query each
        if (validationData.outlet) {
            validationPromises.push(
                tenantPrisma.outlet.count({ where: { id: validationData.outlet, deleted: false } })
                    .then(count => ({ type: 'outlet', exists: count > 0, id: validationData.outlet }))
            );
        }

        if (validationData.customer) {
            validationPromises.push(
                tenantPrisma.customer.count({ where: { id: validationData.customer, deleted: false } })
                    .then(count => ({ type: 'customer', exists: count > 0, id: validationData.customer }))
            );
        }

        if (validationData.purchaseOrder) {
            validationPromises.push(
                tenantPrisma.purchaseOrder.count({ where: { id: validationData.purchaseOrder, deleted: false } })
                    .then(count => ({ type: 'purchaseOrder', exists: count > 0, id: validationData.purchaseOrder }))
            );
        }

        if (validationData.items && validationData.items.length > 0) {
            validationPromises.push(
                tenantPrisma.item.findMany({
                    where: { id: { in: validationData.items }, deleted: false },
                    select: { id: true }
                }).then(items => ({
                    type: 'items',
                    existing: items.map(item => item.id),
                    requested: validationData.items
                }))
            );
        }

        // Execute validations in parallel
        if (validationPromises.length > 0) {
            const validationResults = await Promise.all(validationPromises);

            for (const result of validationResults) {
                if (result.type === 'items' && 'existing' in result && 'requested' in result) {
                    const existingItemIds = new Set<number>(result.existing);
                    const missingItemIds = result.requested ? result.requested.filter((id: number) => !existingItemIds.has(id)) : [];
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
            const isBeingCancelled = updateData.status === 'CANCELLED';
            const wasAlreadyCancelled = existingDeliveryOrder.status === 'CANCELLED';

            // Only reverse stock if changing TO cancelled (not if already cancelled)
            const shouldReverseStock = isBeingCancelled && !wasAlreadyCancelled;

            // Prepare update data - only include defined fields
            const updateFields: any = {
                version: { increment: 1 }
            };

            // Only update fields that are actually provided
            if (updateData.outletId !== undefined) updateFields.outletId = updateData.outletId;
            if (updateData.customerId !== undefined) updateFields.customerId = updateData.customerId;
            if (updateData.purchaseOrderId !== undefined) updateFields.purchaseOrderId = updateData.purchaseOrderId;
            if (updateData.deliveryDate !== undefined) updateFields.deliveryDate = updateData.deliveryDate;
            if (updateData.deliveryStreet !== undefined) updateFields.deliveryStreet = updateData.deliveryStreet;
            if (updateData.deliveryCity !== undefined) updateFields.deliveryCity = updateData.deliveryCity;
            if (updateData.deliveryState !== undefined) updateFields.deliveryState = updateData.deliveryState;
            if (updateData.deliveryPostalCode !== undefined) updateFields.deliveryPostalCode = updateData.deliveryPostalCode;
            if (updateData.deliveryCountry !== undefined) updateFields.deliveryCountry = updateData.deliveryCountry;
            if (updateData.trackingNumber !== undefined) updateFields.trackingNumber = updateData.trackingNumber;
            if (updateData.status !== undefined) updateFields.status = updateData.status;
            if (updateData.remark !== undefined) updateFields.remark = updateData.remark;
            if (updateData.performedBy !== undefined) updateFields.performedBy = updateData.performedBy;

            // Update delivery order
            const updatedDeliveryOrder = await tx.deliveryOrder.update({
                where: { id: id },
                data: updateFields
            });

            // Handle stock reversal if delivery order is being cancelled
            if (shouldReverseStock && existingDeliveryOrder.deliveryOrderItems.length > 0) {
                await reverseStockOperationsForCancellation(
                    tx,
                    existingDeliveryOrder.deliveryOrderItems,
                    updatedDeliveryOrder,
                    updateData.performedBy || "SYSTEM"
                );
            }

            // Handle delivery order items more efficiently
            if (updateData.deliveryOrderItems && Array.isArray(updateData.deliveryOrderItems)) {
                // Compare existing vs new items to minimize operations
                const existingItemIds = new Set(existingDeliveryOrder.deliveryOrderItems.map(item => item.itemId));
                const newItemIds = new Set(updateData.deliveryOrderItems.map(item => item.itemId));

                const hasItemChanges = existingItemIds.size !== newItemIds.size ||
                    [...existingItemIds].some(id => !newItemIds.has(id)) ||
                    [...newItemIds].some(id => !existingItemIds.has(id));

                if (hasItemChanges) {
                    // Use deleteMany for better performance
                    await tx.deliveryOrderItem.deleteMany({
                        where: { deliveryOrderId: id, deleted: false }
                    });

                    if (updateData.deliveryOrderItems.length > 0) {
                        await tx.deliveryOrderItem.createMany({
                            data: updateData.deliveryOrderItems.map(item => ({
                                deliveryOrderId: id,
                                itemId: item.itemId,
                                itemVariantId: item.itemVariantId || null,
                                variantSku: item.variantSku || null,
                                variantName: item.variantName || null,
                                orderedQuantity: item.orderedQuantity,
                                receivedQuantity: item.receivedQuantity,
                                unitPrice: item.unitPrice,
                                deliveryFee: item.deliveryFee || 0,
                                remark: item.remark || null,
                                updatedAt: new Date()
                            }))
                        });

                        // Update stock balances for new items (only if not cancelled)
                        if (!isBeingCancelled) {
                            await updateStockBalancesAndMovements(tx, updateData.deliveryOrderItems, updatedDeliveryOrder, updateData.performedBy || "SYSTEM");
                        }
                    }
                }
            }

            // Update purchase order status only if purchase order changed or status changed
            const purchaseOrderToUpdate = updatedDeliveryOrder.purchaseOrderId || existingDeliveryOrder.purchaseOrderId;
            if (purchaseOrderToUpdate && (updateData.status !== undefined || updateData.deliveryOrderItems !== undefined)) {
                await checkAndUpdatePurchaseOrderStatusWithCancellation(tx, purchaseOrderToUpdate);
            }

            // Optimized final result query - only fetch what's needed
            return await tx.deliveryOrder.findUnique({
                where: { id: id },
                include: {
                    purchaseOrder: {
                        select: {
                            id: true,
                            purchaseOrderNumber: true,
                            outletId: true,
                            supplierId: true,
                            deleted: true,
                            deletedAt: true,
                            createdAt: true,
                            updatedAt: true,
                            version: true,
                            isTaxInclusive: true,
                            purchaseOrderItems: {
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

// Enhanced version that excludes cancelled delivery orders from calculation
const checkAndUpdatePurchaseOrderStatusWithCancellation = async (tx: Prisma.TransactionClient, purchaseOrderId: number) => {
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
                deliveryOrder: {
                    purchaseOrderId: purchaseOrderId,
                    deleted: false,
                    status: { not: 'CANCELLED' } // Exclude cancelled delivery orders
                },
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

        // Compare with Decimal zero instead of primitive 0
        if (receivedQty.gt(new Decimal(0))) {
            hasAnyDelivery = true;
        }

        // Compare Decimal objects directly
        if (receivedQty.lt(orderedQty)) {
            allItemsFullyDelivered = false;
        }
    }

    // Determine and update status based on non-cancelled deliveries only
    let newStatus: string;
    if (allItemsFullyDelivered && hasAnyDelivery) {
        newStatus = 'DELIVERED';
    } else if (hasAnyDelivery) {
        newStatus = 'PARTIALLY DELIVERED';
    } else {
        // No valid deliveries (all cancelled or none), reset to original status
        newStatus = 'CONFIRMED'; // or 'APPROVED' depending on business logic
    }

    await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: { status: newStatus, version: { increment: 1 } }
    });
};

// Update the existing function to use the new logic
const checkAndUpdatePurchaseOrderStatus = async (tx: Prisma.TransactionClient, purchaseOrderId: number) => {
    await checkAndUpdatePurchaseOrderStatusWithCancellation(tx, purchaseOrderId);
};

let deleteDeliveryOrder = async (id: number, databaseName: string): Promise<string> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // Check if delivery order exists and is not already deleted
        const existingDeliveryOrder = await tenantPrisma.deliveryOrder.findUnique({
            where: { id: id, deleted: false }
        });

        if (!existingDeliveryOrder) {
            throw new NotFoundError("Delivery Order");
        }

        // Use transaction to ensure both delivery order and its items are soft deleted
        await tenantPrisma.$transaction(async (tx) => {
            // Soft delete delivery order items first
            await tx.deliveryOrderItem.updateMany({
                where: {
                    deliveryOrderId: id,
                    deleted: false
                },
                data: {
                    deleted: true,
                    deletedAt: new Date()
                }
            });

            // Soft delete the delivery order
            await tx.deliveryOrder.update({
                where: { id: id },
                data: {
                    deleted: true,
                    deletedAt: new Date(),
                    version: { increment: 1 }
                }
            });
        });

        return `Delivery order with ID ${id} has been successfully deleted.`;
    }
    catch (error) {
        throw error;
    }
}

let getUnInvoicedDeliveryOrders = async (
    databaseName: string,
    outletId: number
): Promise<{ deliveryOrders: any[]; }> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);

    try {
        const where = {
            outletId: outletId,
            invoiceId: null, // Only delivery orders without invoices
            deleted: false
        };

        // Execute count and fetch in parallel for better performance
        const [total, deliveryOrders] = await Promise.all([
            tenantPrisma.deliveryOrder.count({ where }),
            tenantPrisma.deliveryOrder.findMany({
                where,
                select: {
                    id: true,
                    outletId: true,
                    customerId: true,
                    purchaseOrderId: true,
                    invoiceId: true,
                    supplierId: true,
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
                    deliveryOrderItems: {
                        where: { deleted: false },
                        select: {
                            id: true,
                            itemId: true,
                            itemVariantId: true,
                            variantSku: true,
                            variantName: true,
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
                        select: {
                            id: true,
                            purchaseOrderNumber: true,
                            outletId: true,
                            supplierId: true,
                            purchaseOrderDate: true,
                            sessionId: true,
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
                            performedBy: true,
                            deleted: true,
                            deletedAt: true,
                            createdAt: true,
                            updatedAt: true,
                            version: true,
                            isTaxInclusive: true,
                            purchaseOrderItems: {
                                where: { deleted: false },
                                select: {
                                    id: true,
                                    itemId: true,
                                    quantity: true,
                                    taxAmount: true,
                                    discountType: true,
                                    discountAmount: true,
                                    unitPrice: true,
                                    subtotal: true,
                                    remark: true,
                                    createdAt: true,
                                    updatedAt: true
                                }
                            }
                        },
                        where: { deleted: false }
                    }
                }
            })
        ]);

        // Transform response
        const enrichedDeliveryOrders = deliveryOrders.map(do_ => ({
            ...do_,
            itemCount: do_._count.deliveryOrderItems,
            purchaseOrderNumber: do_.purchaseOrder?.purchaseOrderNumber || null,
            purchaseOrderDate: do_.purchaseOrder?.purchaseOrderDate || null,
            _count: undefined,
        }));

        return {
            deliveryOrders: enrichedDeliveryOrders,
        };
    } catch (error) {
        throw error;
    }
};

export = { getAll, getById, getByDateRange, createMany, update, deleteDeliveryOrder, getUnInvoicedDeliveryOrders };