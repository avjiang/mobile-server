import { Prisma, PrismaClient, StockBalance, StockMovement, Invoice } from "../../prisma/client/generated/client"
import { ErrorCode, ErrorEntity, NotFoundError, VersionMismatchDetail, VersionMismatchError, RequestValidateError } from "../api-helpers/error"
import { getTenantPrisma } from '../db';
import { } from '../db';
import { SyncRequest } from "src/item/item.request";
import { create } from "domain";
import { CreateInvoiceRequestBody, InvoiceInput } from "./invoice.request";
import { Decimal } from 'decimal.js';
import { restateSalesCostsForReceipts, ReceiptCostChange } from "../stock/sales-cost-restatement";

/**
 * How much of a PO's down-payment balance this invoice draws:
 *   min(downPaymentPercentage% x invoiceTotal, downPaymentAmount - downPaymentApplied)
 *
 * Returns 0 when the PO has no draw rate. That is a real production failure mode,
 * not a theoretical one: a PO can carry an advance with a null rate (see
 * docs/modules/PROCUREMENT.md), in which case the advance is inert and the UI must
 * warn rather than silently show nothing.
 */
type DownPaymentSource = {
    downPaymentPercentage: Prisma.Decimal | number | string | null;
    downPaymentAmount: Prisma.Decimal | number | string | null;
    downPaymentApplied: Prisma.Decimal | number | string | null;
} | null;

function calcDownPaymentDraw(po: DownPaymentSource, invoiceTotal: number | string | null | undefined): Decimal {
    if (!po || !po.downPaymentPercentage) return new Decimal(0);
    const rate = new Decimal(po.downPaymentPercentage.toString());
    if (rate.lessThanOrEqualTo(0)) return new Decimal(0);

    const balance = new Decimal((po.downPaymentAmount ?? 0).toString())
        .minus(new Decimal((po.downPaymentApplied ?? 0).toString()));
    if (balance.lessThanOrEqualTo(0)) return new Decimal(0);

    const byRate = new Decimal((invoiceTotal ?? 0).toString()).times(rate).dividedBy(100);
    if (byRate.lessThanOrEqualTo(0)) return new Decimal(0);
    return Decimal.min(byRate, balance);
}



// Variant-aware match key: receipts/items for different variants of the same item
// must never share a cost adjustment.
const receiptMatchKey = (itemId: number, itemVariantId?: number | null): string =>
    `${itemId}_${itemVariantId ?? 'null'}`;

const DO_ITEM_SELECT = {
    id: true,
    itemId: true,
    itemVariantId: true,
    receivedQuantity: true,
    unitPrice: true,
    deliveryFee: true,
    deliveryOrderId: true
} as const;

const RECEIPT_SELECT = {
    id: true,
    itemId: true,
    itemVariantId: true,
    deliveryOrderId: true,
    quantity: true,
    cost: true
} as const;

const fetchDeliveryOrderItemsMap = async (
    tx: Prisma.TransactionClient,
    deliveryOrderIds: number[]
): Promise<Map<string, any>> => {
    const deliveryOrderItems = await tx.deliveryOrderItem.findMany({
        where: { deliveryOrderId: { in: deliveryOrderIds }, deleted: false },
        select: DO_ITEM_SELECT
    });
    const map = new Map<string, any>();
    deliveryOrderItems.forEach(item => {
        map.set(`${receiptMatchKey(item.itemId, item.itemVariantId)}_${item.deliveryOrderId}`, item);
    });
    return map;
};

// Goods can be received into outlet stock (StockReceipt) or warehouse stock
// (WarehouseStockReceipt) depending on the DO destination — both must be adjusted.
const fetchReceiptsBothLocations = async (
    tx: Prisma.TransactionClient,
    deliveryOrderIds: number[]
): Promise<{ receipt: any; delegate: any; location: 'OUTLET' | 'WAREHOUSE' }[]> => {
    const where = { deliveryOrderId: { in: deliveryOrderIds }, deleted: false };
    const [outletReceipts, warehouseReceipts] = await Promise.all([
        tx.stockReceipt.findMany({ where, select: RECEIPT_SELECT }),
        tx.warehouseStockReceipt.findMany({ where, select: RECEIPT_SELECT })
    ]);
    return [
        ...outletReceipts.map(receipt => ({ receipt, delegate: tx.stockReceipt, location: 'OUTLET' as const })),
        ...warehouseReceipts.map(receipt => ({ receipt, delegate: tx.warehouseStockReceipt, location: 'WAREHOUSE' as const }))
    ];
};

const deliveryFeePerUnitOf = (deliveryOrderItem: any): Decimal => {
    const deliveryFee = new Decimal(deliveryOrderItem.deliveryFee || 0);
    const deliveryOrderQuantity = new Decimal(deliveryOrderItem.receivedQuantity);
    return deliveryOrderQuantity.gt(0) ? deliveryFee.div(deliveryOrderQuantity) : new Decimal(0);
};

const writeReceiptCost = async (delegate: any, receipt: any, newCost: Decimal): Promise<boolean> => {
    if (newCost.equals(new Decimal(receipt.cost))) return false; // no-op, avoid version bumps
    await delegate.update({
        where: { id: receipt.id },
        data: {
            cost: newCost.toNumber(),
            updatedAt: new Date(),
            version: { increment: 1 }
        }
    });
    return true;
};

/**
 * Re-prices stock receipts from the final invoice item prices (the invoice is the
 * financial source of truth, superseding the delivery-order estimate). Runs for every
 * invoice with linked delivery orders — a supplier discount may arrive either as a
 * discountAmount or as a directly lowered unit price, and both must flow into cost.
 * New cost = effective invoice unit price + tax per unit (if exclusive) + delivery fee per unit.
 */
const updateStockReceiptCosts = async (
    tx: Prisma.TransactionClient,
    invoiceId: number,
    deliveryOrderIds: number[],
    invoiceItems: any[],
    isTaxInclusive: boolean
): Promise<void> => {
    try {
        const deliveryOrderItemsMap = await fetchDeliveryOrderItemsMap(tx, deliveryOrderIds);
        const receipts = await fetchReceiptsBothLocations(tx, deliveryOrderIds);

        const invoiceItemsMap = new Map<string, any>();
        invoiceItems.forEach(item => {
            invoiceItemsMap.set(receiptMatchKey(item.itemId, item.itemVariantId), item);
        });

        const costChanges: ReceiptCostChange[] = [];

        for (const { receipt, delegate, location } of receipts) {
            const key = receiptMatchKey(receipt.itemId, receipt.itemVariantId);
            const invoiceItem = invoiceItemsMap.get(key);
            const deliveryOrderItem = deliveryOrderItemsMap.get(`${key}_${receipt.deliveryOrderId}`);

            if (!invoiceItem || !deliveryOrderItem) continue; // item not on this invoice → keep DO cost

            const quantity = new Decimal(invoiceItem.quantity);
            if (!quantity.gt(0)) continue;

            const unitPrice = new Decimal(invoiceItem.unitPrice);
            const discountAmount = new Decimal(invoiceItem.discountAmount || 0);
            const effectiveUnitPrice = unitPrice.sub(discountAmount.div(quantity));

            let taxPerUnit = new Decimal(0);
            if (!isTaxInclusive && invoiceItem.taxAmount) {
                taxPerUnit = new Decimal(invoiceItem.taxAmount).div(quantity);
            }

            const newCost = effectiveUnitPrice.add(taxPerUnit).add(deliveryFeePerUnitOf(deliveryOrderItem));
            if (await writeReceiptCost(delegate, receipt, newCost)) {
                costChanges.push({ location, receiptId: receipt.id, newCost });
            }
        }

        // Restate cost+profit on sales lines that already consumed the re-priced
        // receipts (gap sales between DO receipt and this invoice), so reports
        // aggregate correct profit immediately.
        await restateSalesCostsForReceipts(tx, costChanges);
    } catch (error) {
        console.error('Error updating stock receipt costs:', error);
        throw error;
    }
};

/**
 * Reverts stock receipt costs to their delivery-order values (DO unit price +
 * delivery fee per unit) when an invoice is cancelled or deleted, so the receipts
 * fall back to the pre-invoice estimate.
 */
const revertStockReceiptCosts = async (
    tx: Prisma.TransactionClient,
    invoiceId: number,
    deliveryOrderIds: number[]
): Promise<void> => {
    try {
        const deliveryOrderItemsMap = await fetchDeliveryOrderItemsMap(tx, deliveryOrderIds);
        const receipts = await fetchReceiptsBothLocations(tx, deliveryOrderIds);

        const costChanges: ReceiptCostChange[] = [];

        for (const { receipt, delegate, location } of receipts) {
            const key = receiptMatchKey(receipt.itemId, receipt.itemVariantId);
            const deliveryOrderItem = deliveryOrderItemsMap.get(`${key}_${receipt.deliveryOrderId}`);
            if (!deliveryOrderItem) continue;

            const originalCost = new Decimal(deliveryOrderItem.unitPrice).add(deliveryFeePerUnitOf(deliveryOrderItem));
            if (await writeReceiptCost(delegate, receipt, originalCost)) {
                costChanges.push({ location, receiptId: receipt.id, newCost: originalCost });
            }
        }

        // Restate sales lines back to the delivery-order cost as well
        await restateSalesCostsForReceipts(tx, costChanges);
    } catch (error) {
        console.error('Error reverting stock receipt costs:', error);
        throw error;
    }
};

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

        // Build query conditions - include related entity modifications for proper delta sync
        const where = {
            outletId: parsedOutletId,
            OR: [
                // Invoice itself was modified
                { createdAt: { gte: lastSync } },
                { updatedAt: { gte: lastSync } },
                { deletedAt: { gte: lastSync } },
                // Invoice items were modified
                {
                    invoiceItems: {
                        some: {
                            OR: [
                                { createdAt: { gte: lastSync } },
                                { updatedAt: { gte: lastSync } },
                                { deletedAt: { gte: lastSync } }
                            ]
                        }
                    }
                },
                // Purchase order was modified
                {
                    purchaseOrder: {
                        OR: [
                            { createdAt: { gte: lastSync } },
                            { updatedAt: { gte: lastSync } },
                            { deletedAt: { gte: lastSync } }
                        ]
                    }
                },
                // Quotation (through purchase order) was modified
                {
                    purchaseOrder: {
                        quotation: {
                            OR: [
                                { createdAt: { gte: lastSync } },
                                { updatedAt: { gte: lastSync } },
                                { deletedAt: { gte: lastSync } }
                            ]
                        }
                    }
                },
                // Delivery orders were modified
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

        // Batch fetch all related data in parallel for better performance
        const invoiceIds = invoices.map(inv => inv.id);
        const purchaseOrderIds = invoices.map(inv => inv.purchaseOrderId).filter((id): id is number => typeof id === 'number');
        const settlementIds = invoices.map(inv => inv.invoiceSettlementId).filter((id): id is number => typeof id === 'number');

        const [purchaseOrders, deliveryOrders, invoiceSettlements, purchaseReturns] = await Promise.all([
            // Batch fetch purchase orders
            tenantPrisma.purchaseOrder.findMany({
                where: { id: { in: purchaseOrderIds }, deleted: false },
                select: { id: true, purchaseOrderNumber: true, purchaseOrderDate: true }
            }),
            // Batch fetch delivery orders
            tenantPrisma.deliveryOrder.findMany({
                where: { invoiceId: { in: invoiceIds }, deleted: false },
                select: { id: true, invoiceId: true, deliveryDate: true, trackingNumber: true }
            }),
            // Batch fetch invoice settlements
            tenantPrisma.invoiceSettlement.findMany({
                where: { id: { in: settlementIds }, deleted: false },
                select: {
                    id: true, settlementNumber: true, settlementDate: true,
                    settlementType: true, paymentMethod: true, settlementAmount: true,
                    currency: true, status: true
                }
            }),
            // Batch fetch purchase returns (minimal fields for summary)
            tenantPrisma.purchaseReturn.findMany({
                where: { invoiceId: { in: invoiceIds }, deleted: false, status: 'COMPLETED' },
                select: { id: true, invoiceId: true, totalReturnAmount: true }
            })
        ]);

        // Create lookup maps for O(1) access
        const purchaseOrderMap = new Map();
        purchaseOrders.forEach(po => purchaseOrderMap.set(po.id, po));

        const deliveryOrderMap = new Map<number, any[]>();
        deliveryOrders.forEach(do_ => {
            if (!deliveryOrderMap.has(do_.invoiceId!)) {
                deliveryOrderMap.set(do_.invoiceId!, []);
            }
            deliveryOrderMap.get(do_.invoiceId!)!.push(do_);
        });

        const invoiceSettlementMap = new Map();
        invoiceSettlements.forEach(settlement => invoiceSettlementMap.set(settlement.id, settlement));

        // Create lookup map for purchase returns grouped by invoice ID
        const purchaseReturnMap = new Map<number, { count: number; totalAmount: Decimal }>();
        purchaseReturns.forEach(pr => {
            const existing = purchaseReturnMap.get(pr.invoiceId!) || { count: 0, totalAmount: new Decimal(0) };
            purchaseReturnMap.set(pr.invoiceId!, {
                count: existing.count + 1,
                totalAmount: existing.totalAmount.plus(new Decimal(pr.totalReturnAmount || 0))
            });
        });

        // Enrich invoices with all related data
        const enrichedInvoices = invoices.map(inv => {
            const purchaseOrder = purchaseOrderMap.get(inv.purchaseOrderId);
            const relatedDeliveryOrders = deliveryOrderMap.get(inv.id) || [];
            const invoiceSettlement = invoiceSettlementMap.get(inv.invoiceSettlementId);
            const returnData = purchaseReturnMap.get(inv.id) || { count: 0, totalAmount: new Decimal(0) };

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
                invoiceSettlement: invoiceSettlement ? {
                    id: invoiceSettlement.id,
                    settlementNumber: invoiceSettlement.settlementNumber,
                    settlementDate: invoiceSettlement.settlementDate,
                    settlementType: invoiceSettlement.settlementType,
                    paymentMethod: invoiceSettlement.paymentMethod,
                    settlementAmount: invoiceSettlement.settlementAmount,
                    currency: invoiceSettlement.currency,
                    status: invoiceSettlement.status
                } : null,
                // Purchase return summary (minimal for list view)
                returnCount: returnData.count,
                totalReturnAmount: returnData.totalAmount.toFixed(4),
                hasReturns: returnData.count > 0,
                _count: undefined
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
                    // Item name/code travel with the line so clients never have to
                    // resolve them from a local cache. The purchase-return sheet
                    // used to do exactly that and rendered "Item #19" whenever the
                    // device hadn't synced the item yet.
                    include: {
                        item: {
                            select: { itemName: true, itemCode: true }
                        }
                    }
                },
                purchaseOrder: {
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
                        quotationId: true,
                        deleted: true,
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
                },
                invoiceSettlement: {
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
                        deleted: true
                    }
                },
                purchaseReturns: {
                    where: { deleted: false },
                    select: {
                        id: true,
                        returnNumber: true,
                        returnDate: true,
                        status: true,
                        totalReturnAmount: true,
                        remark: true,
                        performedBy: true,
                        purchaseReturnItems: {
                            where: { deleted: false },
                            select: {
                                id: true,
                                itemId: true,
                                itemVariantId: true,
                                quantity: true,
                                unitPrice: true,
                                returnReason: true,
                                remark: true
                            }
                        }
                    }
                }
            }
        });

        if (!invoice) {
            throw new NotFoundError("Invoice");
        }

        // If invoice has settlement, get all linked invoices with minimal info
        let enhancedInvoiceSettlement = null;
        if (invoice.invoiceSettlement) {
            const invoices = await tenantPrisma.invoice.findMany({
                where: {
                    invoiceSettlementId: invoice.invoiceSettlement.id,
                    deleted: false
                },
                select: {
                    id: true,
                    invoiceNumber: true,
                    subtotalAmount: true,
                    totalAmount: true,
                    status: true,
                    taxInvoiceNumber: true
                }
            });

            enhancedInvoiceSettlement = {
                ...invoice.invoiceSettlement,
                invoices
            };
        }

        // Calculate total return amount from COMPLETED purchase returns only
        const totalReturnAmount = (invoice as any).purchaseReturns
            ?.filter((pr: any) => pr.status === 'COMPLETED')
            .reduce(
                (sum: Decimal, pr: any) => sum.plus(new Decimal(pr.totalReturnAmount || 0)),
                new Decimal(0)
            ) || new Decimal(0);

        // Calculate net amount (invoice total − returns − PO down payment applied).
        // The DP credit reduces what the tenant still owes; it never touches totalAmount.
        const netAmount = new Decimal(invoice.totalAmount || 0)
            .minus(totalReturnAmount)
            .minus(new Decimal((invoice as any).downPaymentApplied || 0));

        // Build a map of returned quantities per item (only from COMPLETED returns)
        // Key: itemId-itemVariantId, Value: total returned quantity
        const returnedQuantityMap = new Map<string, Decimal>();
        const completedReturns = ((invoice as any).purchaseReturns || []).filter(
            (pr: any) => pr.status === 'COMPLETED'
        );

        for (const pr of completedReturns) {
            for (const item of (pr.purchaseReturnItems || [])) {
                const key = `${item.itemId}-${item.itemVariantId || 'null'}`;
                const currentTotal = returnedQuantityMap.get(key) || new Decimal(0);
                returnedQuantityMap.set(key, currentTotal.plus(new Decimal(item.quantity || 0)));
            }
        }

        // Enrich invoice items with return tracking fields
        const enrichedInvoiceItems = invoice.invoiceItems.map((item: any) => {
            const key = `${item.itemId}-${item.itemVariantId || 'null'}`;
            const returnedQuantity = returnedQuantityMap.get(key) || new Decimal(0);
            const originalQuantity = new Decimal(item.quantity || 0);
            const remainingQuantity = originalQuantity.minus(returnedQuantity);

            // Flatten the joined item onto the line (itemName/itemCode) and drop
            // the nested relation so the DTO shape stays flat like every other.
            const { item: joinedItem, ...line } = item;

            return {
                ...line,
                itemName: joinedItem?.itemName ?? null,
                itemCode: joinedItem?.itemCode ?? null,
                returnedQuantity: returnedQuantity.toFixed(4),
                remainingQuantity: remainingQuantity.toFixed(4)
            };
        });

        // Check if any item is fully returned
        const hasFullyReturnedItems = enrichedInvoiceItems.some(
            (item: any) => new Decimal(item.remainingQuantity).lte(0)
        );

        return {
            ...invoice,
            invoiceItems: enrichedInvoiceItems,
            invoiceSettlement: enhancedInvoiceSettlement,
            totalReturnAmount: totalReturnAmount.toFixed(4),
            netAmount: netAmount.toFixed(4),
            returnCount: (invoice as any).purchaseReturns?.length || 0,
            hasFullyReturnedItems
        };
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

        // Build query conditions with date range for invoices
        const where = {
            outletId: parsedOutletId,
            invoiceDate: {
                gte: parsedStartDate,
                lte: parsedEndDate
            },
        };

        // Count total matching records
        const total = await tenantPrisma.invoice.count({ where });

        // Fetch paginated invoices with minimal data
        const invoices = await tenantPrisma.invoice.findMany({
            where,
            skip,
            take,
            orderBy: { id: 'asc' },
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

        // Batch fetch all related data in parallel for better performance
        const invoiceIds = invoices.map(inv => inv.id);
        const purchaseOrderIds = invoices.map(inv => inv.purchaseOrderId).filter((id): id is number => typeof id === 'number');
        const settlementIds = invoices.map(inv => inv.invoiceSettlementId).filter((id): id is number => typeof id === 'number');

        const [purchaseOrders, deliveryOrders, invoiceSettlements, purchaseReturns] = await Promise.all([
            // Batch fetch purchase orders
            tenantPrisma.purchaseOrder.findMany({
                where: { id: { in: purchaseOrderIds }, deleted: false },
                select: { id: true, purchaseOrderNumber: true, purchaseOrderDate: true }
            }),
            // Batch fetch delivery orders
            tenantPrisma.deliveryOrder.findMany({
                where: { invoiceId: { in: invoiceIds }, deleted: false },
                select: { id: true, invoiceId: true, deliveryDate: true, trackingNumber: true }
            }),
            // Batch fetch invoice settlements
            tenantPrisma.invoiceSettlement.findMany({
                where: { id: { in: settlementIds }, deleted: false },
                select: {
                    id: true, settlementNumber: true, settlementDate: true,
                    settlementType: true, paymentMethod: true, settlementAmount: true,
                    currency: true, status: true
                }
            }),
            // Batch fetch purchase returns (minimal fields for summary)
            tenantPrisma.purchaseReturn.findMany({
                where: { invoiceId: { in: invoiceIds }, deleted: false, status: 'COMPLETED' },
                select: { id: true, invoiceId: true, totalReturnAmount: true }
            })
        ]);

        // Create lookup maps for O(1) access
        const purchaseOrderMap = new Map();
        purchaseOrders.forEach(po => purchaseOrderMap.set(po.id, po));

        const deliveryOrderMap = new Map<number, any[]>();
        deliveryOrders.forEach(do_ => {
            if (!deliveryOrderMap.has(do_.invoiceId!)) {
                deliveryOrderMap.set(do_.invoiceId!, []);
            }
            deliveryOrderMap.get(do_.invoiceId!)!.push(do_);
        });

        const invoiceSettlementMap = new Map();
        invoiceSettlements.forEach(settlement => invoiceSettlementMap.set(settlement.id, settlement));

        // Create lookup map for purchase returns grouped by invoice ID
        const purchaseReturnMap = new Map<number, { count: number; totalAmount: Decimal }>();
        purchaseReturns.forEach(pr => {
            const existing = purchaseReturnMap.get(pr.invoiceId!) || { count: 0, totalAmount: new Decimal(0) };
            purchaseReturnMap.set(pr.invoiceId!, {
                count: existing.count + 1,
                totalAmount: existing.totalAmount.plus(new Decimal(pr.totalReturnAmount || 0))
            });
        });

        // Enrich invoices with all related data
        const enrichedInvoices = invoices.map(inv => {
            const purchaseOrder = purchaseOrderMap.get(inv.purchaseOrderId);
            const relatedDeliveryOrders = deliveryOrderMap.get(inv.id) || [];
            const invoiceSettlement = invoiceSettlementMap.get(inv.invoiceSettlementId);
            const returnData = purchaseReturnMap.get(inv.id) || { count: 0, totalAmount: new Decimal(0) };

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
                invoiceSettlement: invoiceSettlement ? {
                    id: invoiceSettlement.id,
                    settlementNumber: invoiceSettlement.settlementNumber,
                    settlementDate: invoiceSettlement.settlementDate,
                    settlementType: invoiceSettlement.settlementType,
                    paymentMethod: invoiceSettlement.paymentMethod,
                    settlementAmount: invoiceSettlement.settlementAmount,
                    currency: invoiceSettlement.currency,
                    status: invoiceSettlement.status
                } : null,
                // Purchase return summary (minimal for list view)
                returnCount: returnData.count,
                totalReturnAmount: returnData.totalAmount.toFixed(4),
                hasReturns: returnData.count > 0,
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

let getCompleted = async (
    databaseName: string,
    outletId: number
): Promise<{ invoices: any[]; total: number }> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);

    try {
        // Build query conditions for completed invoices only
        const where = {
            outletId: outletId,
            status: 'Completed',
            deleted: false
        };

        // Count total matching records
        const total = await tenantPrisma.invoice.count({ where });

        // Fetch all completed invoices
        const invoices = await tenantPrisma.invoice.findMany({
            where,
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

        // Batch fetch invoice settlements for each invoice
        const invoiceSettlements = await tenantPrisma.invoiceSettlement.findMany({
            where: {
                id: { in: invoices.map(inv => inv.invoiceSettlementId).filter((id): id is number => typeof id === 'number') },
                deleted: false
            },
            select: {
                id: true,
                settlementNumber: true,
                settlementDate: true,
                settlementType: true,
                paymentMethod: true,
                settlementAmount: true,
                currency: true,
                status: true
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

        // Create lookup map for invoice settlements
        const invoiceSettlementMap = new Map();
        invoiceSettlements.forEach(settlement => {
            invoiceSettlementMap.set(settlement.id, settlement);
        });

        // Enrich invoices with purchase order and delivery order info
        const enrichedInvoices = invoices.map(inv => {
            const purchaseOrder = purchaseOrderMap.get(inv.purchaseOrderId);
            const relatedDeliveryOrders = deliveryOrderMap.get(inv.id) || [];
            const invoiceSettlement = invoiceSettlementMap.get(inv.invoiceSettlementId);

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
                invoiceSettlement: invoiceSettlement ? {
                    id: invoiceSettlement.id,
                    settlementNumber: invoiceSettlement.settlementNumber,
                    settlementDate: invoiceSettlement.settlementDate,
                    settlementType: invoiceSettlement.settlementType,
                    paymentMethod: invoiceSettlement.paymentMethod,
                    settlementAmount: invoiceSettlement.settlementAmount,
                    currency: invoiceSettlement.currency,
                    status: invoiceSettlement.status
                } : null,
                _count: undefined // Remove the _count field from response
            };
        });

        return {
            invoices: enrichedInvoices,
            total
        };
    } catch (error) {
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
                throw new RequestValidateError(
                    `Invoice numbers already exist: ${duplicateNumbers.join(', ')}`,
                    ErrorCode.DocumentNumberDuplicate,
                    { entity: ErrorEntity.Invoice, numbers: duplicateNumbers.join(', ') }
                );
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
                throw new RequestValidateError(
                    `Outlets with IDs ${missingOutletIds.join(', ')} do not exist`,
                    ErrorCode.ReferenceNotFound,
                    { entity: ErrorEntity.Outlet, ids: missingOutletIds.join(', ') }
                );
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
                throw new RequestValidateError(
                    `Suppliers with IDs ${missingSupplierIds.join(', ')} do not exist`,
                    ErrorCode.ReferenceNotFound,
                    { entity: ErrorEntity.Supplier, ids: missingSupplierIds.join(', ') }
                );
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
                throw new RequestValidateError(
                    `Purchase orders with IDs ${missingPurchaseOrderIds.join(', ')} do not exist`,
                    ErrorCode.ReferenceNotFound,
                    { entity: ErrorEntity.PurchaseOrder, ids: missingPurchaseOrderIds.join(', ') }
                );
            }
        }

        // Batch validate all delivery orders exist and are available for linking
        if (deliveryOrderIds.length > 0) {
            const existingDeliveryOrders = await tenantPrisma.deliveryOrder.findMany({
                where: {
                    id: { in: deliveryOrderIds },
                    deleted: false,
                    OR: [
                        { invoiceId: null }, // Unlinked delivery orders
                        {
                            invoice: {
                                status: 'CANCELLED', // Or linked to cancelled invoices
                                deleted: false
                            }
                        }
                    ]
                },
                select: { id: true }
            });
            const existingDeliveryOrderIds = new Set(existingDeliveryOrders.map(do_ => do_.id));
            const missingDeliveryOrderIds = deliveryOrderIds.filter((id) => !existingDeliveryOrderIds.has(id));

            if (missingDeliveryOrderIds.length > 0) {
                throw new RequestValidateError(
                    `Delivery orders with IDs ${missingDeliveryOrderIds.join(', ')} do not exist or are already linked to an active invoice`,
                    ErrorCode.DeliveryOrdersNotEligible,
                    { ids: missingDeliveryOrderIds.join(', ') }
                );
            }
        }

        // Use single transaction for all creations
        const result = await tenantPrisma.$transaction(async (tx) => {
            const createdInvoices = [];

            for (const invoiceData of invoices) {
                // Determine invoice status based on taxInvoiceNumber
                // const invoiceStatus = (invoiceData.taxInvoiceNumber && invoiceData.taxInvoiceNumber.trim() !== '')
                //     ? 'Completed'
                //     : 'Incomplete';

                // --- PO down payment draw (read via tx so sequential invoices in this
                // request see the balance already reduced by earlier iterations) ---
                // applied = min(PO.downPaymentPercentage% × invoiceTotal, remaining DP balance).
                // DP is a payment credit: it is stamped on the invoice + decrements the PO
                // balance, but NEVER mutates totalAmount/discount/cost.
                let downPaymentApplied = new Decimal(0);
                if (invoiceData.purchaseOrderId) {
                    const po = await tx.purchaseOrder.findUnique({
                        where: { id: invoiceData.purchaseOrderId, deleted: false },
                        select: { downPaymentPercentage: true, downPaymentAmount: true, downPaymentApplied: true }
                    });
                    downPaymentApplied = calcDownPaymentDraw(po, invoiceData.totalAmount);
                }

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
                        downPaymentApplied: downPaymentApplied.toFixed(4),
                        currency: invoiceData.currency || 'IDR',
                        status: "Completed",
                        invoiceDate: invoiceData.invoiceDate,
                        paymentDate: invoiceData.paymentDate,
                        dueDate: invoiceData.dueDate,
                        remark: invoiceData.remark,
                        performedBy: invoiceData.performedBy,
                        siteId: invoiceData.siteId ?? null, // Terminal attribution
                        isTaxInclusive: invoiceData.isTaxInclusive !== undefined ? invoiceData.isTaxInclusive : true,
                    },
                    include: {
                        invoiceItems: {
                            include: {
                                item: true
                            }
                        }
                    }
                });

                // Update purchase order status to COMPLETED if purchaseOrderId exists,
                // and draw down the DP balance (version bump so delta sync notices).
                if (invoiceData.purchaseOrderId) {
                    await tx.purchaseOrder.update({
                        where: {
                            id: invoiceData.purchaseOrderId,
                            deleted: false
                        },
                        data: {
                            status: 'COMPLETED',
                            ...(downPaymentApplied.greaterThan(0)
                                ? { downPaymentApplied: { increment: downPaymentApplied.toFixed(4) }, version: { increment: 1 } }
                                : {})
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
                            itemVariantId: item.itemVariantId || null,
                            variantSku: item.variantSku || null,
                            variantName: item.variantName || null,
                            quantity: item.quantity,
                            discountType: item.discountType || '',
                            discountAmount: item.discountAmount || 0,
                            unitPrice: item.unitPrice,
                            taxAmount: item.taxAmount || 0,
                            subtotal: item.subtotal,
                            remark: item.remark || null,
                        })),
                    });

                    // Re-price stock receipts from invoice item prices whenever delivery
                    // orders are linked — covers discounts AND directly-lowered unit prices.
                    if (invoiceData.deliveryOrderIds && invoiceData.deliveryOrderIds.length > 0) {
                        await updateStockReceiptCosts(
                            tx,
                            newInvoice.id,
                            invoiceData.deliveryOrderIds,
                            invoiceData.invoiceItems,
                            invoiceData.isTaxInclusive ?? true
                        );
                    }

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
                invoiceNumber: true,
                invoiceSettlementId: true
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
                throw new RequestValidateError(
                `Invoice number ${updateData.invoiceNumber} already exists`,
                ErrorCode.DocumentNumberDuplicate,
                { entity: ErrorEntity.Invoice, numbers: String(updateData.invoiceNumber) }
            );
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

        // Use transaction for all updates
        const result = await tenantPrisma.$transaction(async (tx) => {
            // Get existing invoice data for comparison (needed for cost reversion)
            const existingInvoiceData = await tx.invoice.findUnique({
                where: { id: id },
                include: {
                    invoiceItems: { where: { deleted: false } },
                    deliveryOrders: {
                        where: { deleted: false },
                        select: { id: true }
                    }
                }
            });

            // Update main invoice
            // Don't allow status change if invoice is linked to a settlement
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
                    status: existingInvoice.invoiceSettlementId ? undefined : updateData.status,
                    invoiceDate: updateData.invoiceDate,
                    paymentDate: updateData.paymentDate,
                    dueDate: updateData.dueDate,
                    remark: updateData.remark,
                    performedBy: updateData.performedBy,
                    siteId: updateData.siteId ?? null, // Terminal attribution (latest editor)
                    isTaxInclusive: updateData.isTaxInclusive !== undefined ? updateData.isTaxInclusive : true,
                    version: { increment: 1 }
                }
            });

            // Handle stock receipt cost reversion if status is being changed to cancelled
            if (updateData.status === 'CANCELLED' && existingInvoiceData) {
                const existingDeliveryOrderIds = existingInvoiceData.deliveryOrders.map(do_ => do_.id);

                // Revert stock receipt costs back to delivery-order values
                if (existingDeliveryOrderIds.length > 0) {
                    await revertStockReceiptCosts(tx, id, existingDeliveryOrderIds);
                }

                // Unlink delivery orders so they can be reselected on a new invoice
                if (existingDeliveryOrderIds.length > 0) {
                    await tx.deliveryOrder.updateMany({
                        where: { invoiceId: id, deleted: false },
                        data: { invoiceId: null, version: { increment: 1 } }
                    });
                }

                // Restore the PO down-payment this invoice consumed. Guard against
                // double-restore: skip if already CANCELLED or settlement-linked (status
                // change is a no-op there), and zero the invoice field after restoring.
                const dpApplied = new Decimal((existingInvoiceData as any).downPaymentApplied || 0);
                if (existingInvoiceData.purchaseOrderId &&
                    !existingInvoice.invoiceSettlementId &&
                    (existingInvoiceData as any).status !== 'CANCELLED' &&
                    dpApplied.greaterThan(0)) {
                    await tx.purchaseOrder.update({
                        where: { id: existingInvoiceData.purchaseOrderId },
                        data: { downPaymentApplied: { decrement: dpApplied.toFixed(4) }, version: { increment: 1 } }
                    });
                    await tx.invoice.update({
                        where: { id: id },
                        data: { downPaymentApplied: 0 }
                    });
                }
            }

            // Handle invoice items
            if (updateData.invoiceItems !== undefined) {
                // Get existing invoice items
                const existingItems = await tx.invoiceItem.findMany({
                    where: {
                        invoiceId: id,
                        deleted: false
                    }
                });

                // Special handling for cancelled invoices - soft delete all existing items
                if (updateData.status === 'CANCELLED') {
                    // Soft delete all existing items for cancelled invoices
                    if (existingItems.length > 0) {
                        await tx.invoiceItem.updateMany({
                            where: {
                                id: { in: existingItems.map(item => item.id) }
                            },
                            data: {
                                deleted: true,
                                deletedAt: new Date(),
                                version: { increment: 1 }
                            }
                        });
                    }
                } else {
                    // Normal invoice item update logic for non-cancelled invoices
                    // Create maps for comparison
                    const existingItemsMap = new Map();
                    existingItems.forEach(item => {
                        existingItemsMap.set(item.itemId, item);
                    });

                    const newItemsMap = new Map();
                    updateData.invoiceItems.forEach(item => {
                        newItemsMap.set(item.itemId, item);
                    });

                    // Items to soft delete (exist in DB but not in update request)
                    const itemsToDelete = existingItems.filter(item => !newItemsMap.has(item.itemId));

                    // Items to update (exist in both)
                    const itemsToUpdate = updateData.invoiceItems.filter(item => existingItemsMap.has(item.itemId));

                    // Items to create (new items not in DB)
                    const itemsToCreate = updateData.invoiceItems.filter(item => !existingItemsMap.has(item.itemId));

                    // Soft delete items that are no longer needed
                    if (itemsToDelete.length > 0) {
                        await tx.invoiceItem.updateMany({
                            where: {
                                id: { in: itemsToDelete.map(item => item.id) }
                            },
                            data: {
                                deleted: true,
                                deletedAt: new Date(),
                                version: { increment: 1 }
                            }
                        });
                    }

                    // Update existing items
                    for (const item of itemsToUpdate) {
                        const existingItem = existingItemsMap.get(item.itemId);
                        await tx.invoiceItem.update({
                            where: { id: existingItem.id },
                            data: {
                                itemVariantId: item.itemVariantId || null,
                                variantSku: item.variantSku || null,
                                variantName: item.variantName || null,
                                quantity: item.quantity,
                                discountType: item.discountType || '',
                                discountAmount: item.discountAmount || 0,
                                unitPrice: item.unitPrice,
                                taxAmount: item.taxAmount || 0,
                                subtotal: item.subtotal,
                                remark: item.remark || null,
                                version: { increment: 1 }
                            }
                        });
                    }

                    // Create new items
                    if (itemsToCreate.length > 0) {
                        await tx.invoiceItem.createMany({
                            data: itemsToCreate.map(item => ({
                                invoiceId: id,
                                itemId: item.itemId,
                                itemVariantId: item.itemVariantId || null,
                                variantSku: item.variantSku || null,
                                variantName: item.variantName || null,
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

                    // Re-price stock receipts from the updated invoice item prices —
                    // also restores cost when a discount is removed on edit.
                    if (updateData.status !== 'CANCELLED' &&
                        updateData.deliveryOrderIds &&
                        updateData.deliveryOrderIds.length > 0) {
                        await updateStockReceiptCosts(
                            tx,
                            id,
                            updateData.deliveryOrderIds,
                            updateData.invoiceItems,
                            updateData.isTaxInclusive ?? existingInvoiceData?.isTaxInclusive ?? true
                        );
                    }
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

let deleteInvoice = async (id: number, databaseName: string): Promise<string> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        if (!id) {
            throw new RequestValidateError('Invoice ID is required');
        }

        // Check if invoice exists and is not already deleted
        const existingInvoice = await tenantPrisma.invoice.findUnique({
            where: {
                id: id,
                deleted: false
            },
            include: {
                invoiceSettlement: {
                    where: { deleted: false }
                }
            }
        });

        if (!existingInvoice) {
            throw new NotFoundError("Invoice");
        }

        // Check if invoice has related invoice settlement
        if (existingInvoice.invoiceSettlement) {
            throw new RequestValidateError(
                'Cannot delete invoice with existing settlement',
                ErrorCode.DeleteBlockedHasDependents,
                { entity: ErrorEntity.Invoice, dependents: 'a settlement' }
            );
        }

        // Use transaction to ensure data consistency
        await tenantPrisma.$transaction(async (tx) => {
            // Restore any PO down-payment this invoice consumed (additive — guard so a
            // re-delete can't double-credit: zero the invoice field below in the same write).
            const dpApplied = new Decimal((existingInvoice as any).downPaymentApplied || 0);
            if (existingInvoice.purchaseOrderId && dpApplied.greaterThan(0)) {
                await tx.purchaseOrder.update({
                    where: { id: existingInvoice.purchaseOrderId },
                    data: { downPaymentApplied: { decrement: dpApplied.toFixed(4) }, version: { increment: 1 } }
                });
            }

            // Soft delete all invoice items first
            await tx.invoiceItem.updateMany({
                where: {
                    invoiceId: id,
                    deleted: false
                },
                data: {
                    deleted: true,
                    deletedAt: new Date(),
                    version: { increment: 1 }
                }
            });

            // Revert stock receipt costs back to delivery-order values before unlinking
            const linkedDeliveryOrders = await tx.deliveryOrder.findMany({
                where: { invoiceId: id, deleted: false },
                select: { id: true }
            });
            if (linkedDeliveryOrders.length > 0) {
                await revertStockReceiptCosts(tx, id, linkedDeliveryOrders.map(do_ => do_.id));
            }

            // Unlink delivery orders from this invoice
            await tx.deliveryOrder.updateMany({
                where: {
                    invoiceId: id,
                    deleted: false
                },
                data: {
                    invoiceId: null
                }
            });

            // Soft delete the invoice (zero downPaymentApplied so a future un-delete/re-delete
            // cannot double-credit the PO balance)
            await tx.invoice.update({
                where: { id: id },
                data: {
                    deleted: true,
                    deletedAt: new Date(),
                    downPaymentApplied: 0,
                    version: { increment: 1 }
                }
            });
        });

        return `Invoice with ID ${id} has been successfully deleted.`;
    }
    catch (error) {
        throw error;
    }
}

export = {
    getAll, getById, getByDateRange, getCompleted, createMany, update, deleteInvoice,
    __testables: { calcDownPaymentDraw },
};