import { PrismaClient, Supplier } from "../../prisma/client/generated/client"
import { Decimal } from 'decimal.js';
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { plainToInstance } from "class-transformer"
import { getTenantPrisma } from '../db';

let generateReport = async (databaseName: string, sessionId: number, planType?: string | null) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // First check if session exists
        const session = await tenantPrisma.session.findUnique({
            where: { id: sessionId }
        });

        if (!session) {
            throw new NotFoundError('Session');
        }

        // Laundry: exclude consumable-depletion lines from item rankings and surface
        // them under laundryOps instead (see generateOutletReport for rationale).
        const isLaundry = planType === 'Laundry';
        const itemRankingFilter = isLaundry ? { stockConsumptionQty: null } : {};

        // All queries will filter by this session ID
        const sessionFilter = { sessionId: sessionId };

        // Filter for completed sales with completedSessionId
        const completedSessionFilter = { completedSessionId: sessionId };

        // Get today's date for PO/DO/Invoice filtering
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

        // Run all queries concurrently for better performance
        const [
            voidedSales,
            returnedSales,
            refundedSales,
            partiallyPaidSales,
            completedSales,
            deliveredSales,
            topSellingItems,
            mostProfitableItems,
            mostLossItems,
            salesSummary,
            paymentBreakdown,
            salesItems,
            todayPurchaseOrders,
            todayDeliveryOrders,
            todayInvoices,
            allSales
        ] = await Promise.all([
            // Voided sales
            tenantPrisma.sales.aggregate({
                where: {
                    ...sessionFilter,
                    status: "Voided"
                },
                _count: { id: true },
                _sum: { totalAmount: true, paidAmount: true }
            }),

            // Returned sales details
            tenantPrisma.sales.aggregate({
                where: {
                    ...sessionFilter,
                    status: "Returned",
                    deleted: false
                },
                _count: { id: true },
                _sum: {
                    totalAmount: true,
                    paidAmount: true,
                    profitAmount: true
                }
            }),

            // Refunded sales details
            tenantPrisma.sales.aggregate({
                where: {
                    ...sessionFilter,
                    status: "Refunded",
                    deleted: false
                },
                _count: { id: true },
                _sum: {
                    totalAmount: true,
                    paidAmount: true,
                    profitAmount: true
                }
            }),

            // Partially paid sales details
            tenantPrisma.sales.aggregate({
                where: {
                    ...sessionFilter,
                    status: "Partially Paid",
                    deleted: false
                },
                _count: { id: true },
                _sum: {
                    totalAmount: true,
                    paidAmount: true,
                    profitAmount: true
                }
            }),

            // Completed sales from completedSessionId only
            tenantPrisma.sales.aggregate({
                where: {
                    ...completedSessionFilter,
                    status: "Completed",
                    deleted: false
                },
                _count: { id: true },
                _sum: {
                    totalAmount: true,
                    paidAmount: true,
                    profitAmount: true,
                    changeAmount: true
                }
            }),

            // Delivered sales aggregate
            tenantPrisma.sales.aggregate({
                where: {
                    ...sessionFilter,
                    status: "Delivered",
                    deleted: false
                },
                _count: { id: true },
                _sum: {
                    totalAmount: true,
                    paidAmount: true,
                    profitAmount: true,
                    changeAmount: true
                }
            }),

            // Include all non-voided sales for top selling items (not just completed)
            tenantPrisma.salesItem.groupBy({
                by: ['itemId', 'itemName', 'itemCode', 'itemBrand'],
                where: {
                    sales: {
                        ...sessionFilter,
                        status: { in: ["Completed", "Partially Paid", "Delivered", "Returned", "Refunded"] }
                    },
                    ...itemRankingFilter
                },
                _sum: {
                    quantity: true,
                    subtotalAmount: true
                },
                orderBy: {
                    _sum: {
                        quantity: 'desc'
                    }
                },
                take: 10
            }),

            // Only include completed sales from completedSessionId for most profitable items
            tenantPrisma.salesItem.groupBy({
                by: ['itemId', 'itemName', 'itemCode', 'itemBrand'],
                where: {
                    sales: {
                        ...completedSessionFilter,
                        status: "Completed"
                    },
                    profit: {
                        gt: 0
                    },
                    ...itemRankingFilter
                },
                _sum: {
                    profit: true,
                    subtotalAmount: true,
                    cost: true,
                    quantity: true
                },
                orderBy: {
                    _sum: {
                        profit: 'desc'
                    }
                },
                take: 10
            }),

            // Most loss-making items (items sold at a loss)
            tenantPrisma.salesItem.groupBy({
                by: ['itemId', 'itemName', 'itemCode', 'itemBrand'],
                where: {
                    sales: {
                        ...completedSessionFilter,
                        status: "Completed"
                    },
                    profit: {
                        lt: 0
                    },
                    ...itemRankingFilter
                },
                _sum: {
                    profit: true,
                    subtotalAmount: true,
                    cost: true,
                    quantity: true
                },
                orderBy: {
                    _sum: {
                        profit: 'asc'
                    }
                },
                take: 10
            }),

            // Include only completed sales from completedSessionId for overall summary
            tenantPrisma.sales.aggregate({
                where: {
                    ...completedSessionFilter,
                    status: "Completed",
                    deleted: false
                },
                _sum: {
                    paidAmount: true,
                    totalAmount: true,
                    profitAmount: true,
                    changeAmount: true
                },
                _count: {
                    id: true
                }
            }),

            // Include payments from all non-voided sales.
            // `deleted: false` REQUIRED — a payment's own IS_DELETED stays 0 when
            // its sale is soft-deleted, so without it deleted orders inflate cash.
            tenantPrisma.payment.groupBy({
                by: ['method'],
                where: {
                    ...sessionFilter,
                    sales: {
                        status: { in: ["Completed", "Partially Paid", "Delivered", "Returned", "Refunded"] },
                        deleted: false
                    }
                },
                _sum: {
                    paidAmount: true
                }
            }),

            // Get all distinct items sold from all non-voided sales (not just completed)
            tenantPrisma.salesItem.findMany({
                where: {
                    sales: {
                        ...sessionFilter,
                        status: { in: ["Completed", "Partially Paid", "Delivered", "Returned", "Refunded"] }
                    }
                },
                select: {
                    itemId: true,
                    quantity: true,
                    subtotalAmount: true
                }
            }),

            // Today's Purchase Orders
            tenantPrisma.purchaseOrder.findMany({
                where: {
                    outletId: session.outletId,
                    createdAt: {
                        gte: startOfDay,
                        lte: endOfDay
                    },
                    deleted: false
                },
                select: {
                    id: true,
                    purchaseOrderNumber: true,
                    totalAmount: true,
                    status: true,
                    createdAt: true,
                    supplier: {
                        select: {
                            companyName: true
                        }
                    },
                    purchaseOrderItems: {
                        select: {
                            quantity: true
                        }
                    }
                }
            }),

            // Today's Delivery Orders
            tenantPrisma.deliveryOrder.findMany({
                where: {
                    outletId: session.outletId,
                    createdAt: {
                        gte: startOfDay,
                        lte: endOfDay
                    },
                    deleted: false
                },
                select: {
                    id: true,
                    trackingNumber: true,
                    status: true,
                    createdAt: true,
                    deliveryDate: true,
                    supplierId: true,
                    deliveryOrderItems: {
                        select: {
                            receivedQuantity: true
                        }
                    }
                }
            }),

            // Today's Invoices
            tenantPrisma.invoice.findMany({
                where: {
                    outletId: session.outletId,
                    createdAt: {
                        gte: startOfDay,
                        lte: endOfDay
                    },
                    deleted: false
                },
                select: {
                    id: true,
                    invoiceNumber: true,
                    totalAmount: true,
                    status: true,
                    createdAt: true,
                    supplier: {
                        select: {
                            companyName: true
                        }
                    },
                    invoiceItems: {
                        select: {
                            quantity: true
                        }
                    }
                }
            }),

            // All sales for the session
            tenantPrisma.sales.findMany({
                where: {
                    ...sessionFilter,
                    deleted: false
                },
                select: {
                    id: true,
                    businessDate: true,
                    salesType: true,
                    customerName: true,
                    phoneNumber: true,
                    shipStreet: true,
                    subtotalAmount: true,
                    taxAmount: true,
                    discountAmount: true,
                    loyaltyTierDiscountAmount: true,
                    voucherDiscountAmount: true,
                    subscriptionDiscountAmount: true,
                    loyaltyPointsRedemptionValue: true,
                    totalAmount: true,
                    paidAmount: true,
                    profitAmount: true,
                    isTaxInclusive: true,
                    status: true,
                    remark: true,
                    completedSessionId: true,
                    salesItems: {
                        select: {
                            id: true,
                            itemName: true,
                            itemModel: true,
                            quantity: true,
                            cost: true,
                            discountAmount: true,
                            taxAmount: true,
                            subtotalAmount: true,
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            })
        ]);

        // Get detailed sales information for each status in parallel
        const [returnedSalesDetails, refundedSalesDetails, partiallyPaidSalesDetails, voidedSalesDetails, deliveredSalesDetails] = await Promise.all([
            tenantPrisma.sales.findMany({
                where: {
                    ...sessionFilter,
                    status: "Returned",
                    deleted: false
                },
                select: {
                    id: true,
                    totalAmount: true,
                    paidAmount: true,
                    customerId: true,
                    businessDate: true,
                    remark: true,
                    customerName: true,
                    phoneNumber: true
                }
            }),

            tenantPrisma.sales.findMany({
                where: {
                    ...sessionFilter,
                    status: "Refunded",
                    deleted: false
                },
                select: {
                    id: true,
                    totalAmount: true,
                    paidAmount: true,
                    customerId: true,
                    businessDate: true,
                    remark: true,
                    customerName: true,
                    phoneNumber: true
                }
            }),

            tenantPrisma.sales.findMany({
                where: {
                    ...sessionFilter,
                    status: "Partially Paid",
                    deleted: false
                },
                select: {
                    id: true,
                    totalAmount: true,
                    paidAmount: true,
                    customerId: true,
                    businessDate: true,
                    customerName: true,
                    phoneNumber: true
                }
            }),

            tenantPrisma.sales.findMany({
                where: {
                    ...sessionFilter,
                    status: "Voided",
                    deleted: false
                },
                select: {
                    id: true,
                    totalAmount: true,
                    paidAmount: true,
                    customerId: true,
                    businessDate: true,
                    remark: true,
                    customerName: true,
                    phoneNumber: true
                }
            }),

            // Delivered sales details
            tenantPrisma.sales.findMany({
                where: {
                    ...sessionFilter,
                    status: "Delivered",
                    deleted: false
                },
                select: {
                    id: true,
                    totalAmount: true,
                    paidAmount: true,
                    customerId: true,
                    businessDate: true,
                    remark: true,
                    customerName: true,
                    phoneNumber: true
                }
            })
        ]);

        // Get the unique item IDs sold in this session
        const soldItemIds = [...new Set(salesItems.map(item => item.itemId))];

        // Fetch item details with categories for these items
        const itemsWithCategories = await tenantPrisma.item.findMany({
            where: {
                id: {
                    in: soldItemIds
                }
            },
            include: {
                category: true
            }
        });

        // Create a map of sold quantities by itemId for faster lookup (using all non-voided sales)
        const itemQuantitiesSold: { [key: number]: Decimal } = {};
        salesItems.forEach(item => {
            if (!itemQuantitiesSold[item.itemId]) {
                itemQuantitiesSold[item.itemId] = new Decimal(0);
            }
            itemQuantitiesSold[item.itemId] = itemQuantitiesSold[item.itemId].plus(item.quantity);
        });

        // Calculate top-selling categories
        const categorySales: Record<number, { categoryName: string, quantitySold: Decimal, revenue: Decimal }> = {};

        // Create a map for O(1) item lookup
        const itemsMap = new Map(itemsWithCategories.map(item => [item.id, item]));

        // Process each sales item and aggregate by category
        salesItems.forEach(salesItem => {
            const item = itemsMap.get(salesItem.itemId);
            if (!item) return;

            const categoryId = item.categoryId;
            const categoryName = item.category.name;

            if (!categorySales[categoryId]) {
                categorySales[categoryId] = {
                    categoryName,
                    quantitySold: new Decimal(0),
                    revenue: new Decimal(0)
                };
            }
            categorySales[categoryId].quantitySold = categorySales[categoryId].quantitySold.plus(salesItem.quantity);
            categorySales[categoryId].revenue = categorySales[categoryId].revenue.plus(salesItem.subtotalAmount);
        });

        // Convert to array and sort by quantity
        const topSellingCategories = Object.values(categorySales)
            .sort((a, b) => b.quantitySold.minus(a.quantitySold).toNumber())
            .slice(0, 5) // Take top 5
            .map(category => ({
                categoryName: category.categoryName,
                quantitySold: category.quantitySold,
                revenue: category.revenue
            }));

        // Calculate session sales count (all non-voided) from allSales in memory
        const sessionSalesCount = allSales.filter(sale =>
            ["Completed", "Partially Paid", "Delivered", "Returned", "Refunded"].includes(sale.status)
        ).length;

        // Now get stock information ONLY for items that were sold in this session (reuse soldItemIds)
        const stockBalanceItems = await tenantPrisma.stockBalance.findMany({
            where: {
                deleted: false,
                outletId: session.outletId,
                itemId: {
                    in: soldItemIds
                }
            },
            select: {
                availableQuantity: true,
                onHandQuantity: true,
                reorderThreshold: true,
                itemId: true,
                item: {
                    select: {
                        id: true,
                        itemName: true,
                        itemCode: true,
                        itemBrand: true,
                    }
                },
                outlet: {
                    select: {
                        id: true,
                        outletName: true
                    }
                }
            }
        });

        // Calculate metrics for partially paid sales
        const totalOutstandingAmount = (partiallyPaidSales._sum?.totalAmount || new Decimal(0)).minus(partiallyPaidSales._sum?.paidAmount || new Decimal(0));
        const averageOutstandingPerTransaction = partiallyPaidSales._count.id > 0
            ? totalOutstandingAmount.dividedBy(partiallyPaidSales._count.id)
            : new Decimal(0);
        const paymentCoverageRatio = (partiallyPaidSales._sum?.totalAmount || new Decimal(0)).gt(0)
            ? ((partiallyPaidSales._sum?.paidAmount || new Decimal(0)).dividedBy(partiallyPaidSales._sum?.totalAmount || new Decimal(1))).times(100)
            : new Decimal(0);

        // Calculate average transaction value (only from completedSessionId)
        const totalCompletedSalesCount = completedSales._count.id || 0;
        const totalCompletedRevenue = completedSales._sum?.totalAmount || new Decimal(0);
        const averageTransactionValue = totalCompletedSalesCount > 0
            ? totalCompletedRevenue.dividedBy(totalCompletedSalesCount)
            : new Decimal(0);

        // Calculate net revenue and profit (only from completed sales)
        const netRevenue = totalCompletedRevenue;
        const grossRevenue = salesSummary._sum?.totalAmount || new Decimal(0);
        const returnRefundImpact = (returnedSales._sum?.totalAmount || new Decimal(0)).plus(refundedSales._sum?.totalAmount || new Decimal(0));

        // Split profit into gains and losses for completed sales (filter from allSales in memory)
        const completedSalesWithProfit = allSales.filter(sale =>
            sale.completedSessionId === sessionId && sale.status === "Completed"
        );

        let totalGains = new Decimal(0);
        let totalLosses = new Decimal(0);
        completedSalesWithProfit.forEach(sale => {
            if (sale.profitAmount.gt(0)) {
                totalGains = totalGains.plus(sale.profitAmount);
            } else if (sale.profitAmount.lt(0)) {
                totalLosses = totalLosses.plus(sale.profitAmount); // This will be negative
            }
        });

        // Calculate total profit from gains and losses
        const totalProfit = totalGains.plus(totalLosses);

        // Split profit for partially paid sales (filter from allSales in memory)
        const partiallyPaidSalesWithProfit = allSales.filter(sale =>
            sale.status === "Partially Paid"
        );

        let partiallyPaidGains = new Decimal(0);
        let partiallyPaidLosses = new Decimal(0);
        partiallyPaidSalesWithProfit.forEach(sale => {
            if (sale.profitAmount.gt(0)) {
                partiallyPaidGains = partiallyPaidGains.plus(sale.profitAmount);
            } else if (sale.profitAmount.lt(0)) {
                partiallyPaidLosses = partiallyPaidLosses.plus(sale.profitAmount);
            }
        });

        // Calculate total profit for partially paid from gains and losses
        const partiallyPaidTotalProfit = partiallyPaidGains.plus(partiallyPaidLosses);

        // Split profit for delivered sales (filter from allSales in memory)
        const deliveredSalesWithProfit = allSales.filter(sale =>
            sale.status === "Delivered"
        );

        let deliveredGains = new Decimal(0);
        let deliveredLosses = new Decimal(0);
        deliveredSalesWithProfit.forEach(sale => {
            if (sale.profitAmount.gt(0)) {
                deliveredGains = deliveredGains.plus(sale.profitAmount);
            } else if (sale.profitAmount.lt(0)) {
                deliveredLosses = deliveredLosses.plus(sale.profitAmount);
            }
        });

        // Calculate total profit for delivered from gains and losses
        const deliveredTotalProfit = deliveredGains.plus(deliveredLosses);

        // Calculate profit impact for returned/refunded sales (considering sign)
        const returnedProfit = returnedSales._sum?.profitAmount || new Decimal(0);
        const refundedProfit = refundedSales._sum?.profitAmount || new Decimal(0);

        // For returned/refunded: if original was profitable, we lost profit; if loss, we recovered loss
        const returnedProfitLoss = returnedProfit.gt(0) ? returnedProfit : new Decimal(0);
        const returnedLossRecovery = returnedProfit.lt(0) ? returnedProfit.abs() : new Decimal(0);
        const refundedProfitLoss = refundedProfit.gt(0) ? refundedProfit : new Decimal(0);
        const refundedLossRecovery = refundedProfit.lt(0) ? refundedProfit.abs() : new Decimal(0);

        // ── Laundry operations (only for laundry accounts) — KG processed + supplies consumed ──
        let laundryOps: {
            totalKgProcessed: number;
            totalLoads: number;
            averageKgPerLoad: number;
            suppliesConsumed: { itemId: number; itemName: string; unitOfMeasure: string | null; totalConsumed: number }[];
        } | null = null;
        if (isLaundry) {
            const nonVoidStatuses = ["Completed", "Partially Paid", "Delivered", "Returned", "Refunded"];
            const [kgAgg, consumableLines] = await Promise.all([
                tenantPrisma.salesItem.aggregate({
                    where: {
                        sales: { ...sessionFilter, status: { in: nonVoidStatuses } },
                        loadWeightKg: { not: null }
                    },
                    _sum: { loadWeightKg: true },
                    _count: { id: true }
                }),
                tenantPrisma.salesItem.findMany({
                    where: {
                        sales: { ...sessionFilter, status: { in: nonVoidStatuses } },
                        stockConsumptionQty: { not: null }
                    },
                    select: { itemId: true, itemName: true, unitOfMeasure: true, quantity: true, stockConsumptionQty: true }
                })
            ]);

            const totalKg = (kgAgg._sum.loadWeightKg || new Decimal(0)).toNumber();
            const totalLoads = kgAgg._count.id || 0;

            const suppliesMap: Record<number, { itemId: number; itemName: string; unitOfMeasure: string | null; totalConsumed: Decimal }> = {};
            for (const line of consumableLines) {
                const consumed = new Decimal(line.quantity).times(new Decimal(line.stockConsumptionQty!));
                if (!suppliesMap[line.itemId]) {
                    suppliesMap[line.itemId] = { itemId: line.itemId, itemName: line.itemName, unitOfMeasure: line.unitOfMeasure, totalConsumed: new Decimal(0) };
                }
                suppliesMap[line.itemId].totalConsumed = suppliesMap[line.itemId].totalConsumed.plus(consumed);
            }
            const suppliesConsumed = Object.values(suppliesMap)
                .map(s => ({ itemId: s.itemId, itemName: s.itemName, unitOfMeasure: s.unitOfMeasure, totalConsumed: s.totalConsumed.toNumber() }))
                .sort((a, b) => b.totalConsumed - a.totalConsumed);

            laundryOps = {
                totalKgProcessed: totalKg,
                totalLoads,
                averageKgPerLoad: totalLoads > 0 ? totalKg / totalLoads : 0,
                suppliesConsumed
            };
        }

        // Per-terminal breakdown — which terminal rang the session's completed sales.
        // Groups completed sales (completedSessionId) by siteId so a multi-terminal
        // outlet can see each terminal's count + totals. Null siteId = unattributed
        // (rows from before this feature, or a device that hasn't registered).
        const terminalGroups = await tenantPrisma.sales.groupBy({
            by: ['siteId'],
            where: {
                ...completedSessionFilter,
                status: "Completed",
                deleted: false
            },
            _count: { id: true },
            _sum: { totalAmount: true, paidAmount: true, profitAmount: true }
        });
        const terminalBreakdown = terminalGroups
            .map(g => ({
                siteId: g.siteId ?? null,
                salesCount: g._count?.id || 0,
                totalAmount: (g._sum?.totalAmount || new Decimal(0)).toNumber(),
                paidAmount: (g._sum?.paidAmount || new Decimal(0)).toNumber(),
                profitAmount: (g._sum?.profitAmount || new Decimal(0)).toNumber(),
            }))
            .sort((a, b) => (a.siteId ?? 0) - (b.siteId ?? 0));

        // Prepare response object
        return {
            // Laundry operations block (null for non-laundry accounts)
            laundryOps,

            // Per-terminal attribution (empty when single-terminal / unattributed)
            terminalBreakdown,

            // Overall metrics (only from completed sales)
            totalRevenue: netRevenue.toNumber(),
            grossRevenue: grossRevenue.toNumber(),
            returnRefundImpact: returnRefundImpact.toNumber(),
            totalProfit: totalProfit.toNumber(),
            totalCogs: netRevenue.minus(totalProfit).toNumber(), // Revenue − Profit = Cost of Goods Sold
            grossMargin: netRevenue.gt(0) ? totalProfit.dividedBy(netRevenue).times(100).toNumber() : 0,
            totalProfitGains: totalGains.toNumber(), // Sum of all positive profits
            totalProfitLosses: totalLosses.toNumber(), // Sum of all negative profits (will be negative)
            averageTransactionValue: averageTransactionValue.toNumber(),
            totalPaidAmount: (completedSales._sum?.paidAmount || new Decimal(0)).toNumber(),
            changeGiven: (completedSales._sum?.changeAmount || new Decimal(0)).toNumber(),
            voidedSalesCount: voidedSales._count?.id || 0,
            voidedSalesAmount: (voidedSales._sum?.totalAmount || new Decimal(0)).toNumber(),

            // Completed sales info (only from completedSessionId)
            completedSales: {
                count: totalCompletedSalesCount,
                totalAmount: totalCompletedRevenue.toNumber(),
                paidAmount: (completedSales._sum?.paidAmount || new Decimal(0)).toNumber(),
                profit: totalProfit.toNumber(),
                profitGains: totalGains.toNumber(),
                profitLosses: totalLosses.toNumber(),
                changeGiven: (completedSales._sum?.changeAmount || new Decimal(0)).toNumber()
            },

            // Partially paid sales info
            partiallyPaidSales: {
                count: partiallyPaidSales._count?.id || 0,
                totalAmount: (partiallyPaidSales._sum?.totalAmount || new Decimal(0)).toNumber(),
                paidAmount: (partiallyPaidSales._sum?.paidAmount || new Decimal(0)).toNumber(),
                outstandingAmount: totalOutstandingAmount.toNumber(),
                profit: partiallyPaidTotalProfit.toNumber(),
                profitGains: partiallyPaidGains.toNumber(),
                profitLosses: partiallyPaidLosses.toNumber(),
                averageOutstandingPerTransaction: averageOutstandingPerTransaction.toNumber(),
                paymentCoverageRatio: Math.round(paymentCoverageRatio.toNumber() * 100) / 100,
                details: partiallyPaidSalesDetails.map(sale => ({
                    salesId: sale.id,
                    totalAmount: sale.totalAmount.toNumber(),
                    paidAmount: sale.paidAmount.toNumber(),
                    outstandingAmount: sale.totalAmount.minus(sale.paidAmount).toNumber(),
                    customerName: sale.customerName || 'Guest',
                    phoneNumber: sale.phoneNumber || '',
                    businessDate: sale.businessDate
                }))
            },

            // Returned sales info
            returnedSales: {
                count: returnedSales._count?.id || 0,
                totalAmount: (returnedSales._sum?.totalAmount || new Decimal(0)).toNumber(),
                paidAmount: (returnedSales._sum?.paidAmount || new Decimal(0)).toNumber(),
                profitImpact: returnedProfit.toNumber(), // Original profit amount (can be positive or negative)
                lostProfit: returnedProfitLoss.toNumber(), // Profit lost from profitable sales
                recoveredLoss: returnedLossRecovery.toNumber(), // Loss recovered from loss-making sales
                details: returnedSalesDetails.map(sale => ({
                    salesId: sale.id,
                    totalAmount: sale.totalAmount.toNumber(),
                    paidAmount: sale.paidAmount.toNumber(),
                    customerName: sale.customerName || 'Guest',
                    phoneNumber: sale.phoneNumber || '',
                    businessDate: sale.businessDate,
                    remark: sale.remark || ''
                }))
            },

            // Refunded sales info
            refundedSales: {
                count: refundedSales._count?.id || 0,
                totalAmount: (refundedSales._sum?.totalAmount || new Decimal(0)).toNumber(),
                paidAmount: (refundedSales._sum?.paidAmount || new Decimal(0)).toNumber(),
                profitImpact: refundedProfit.toNumber(), // Original profit amount (can be positive or negative)
                lostProfit: refundedProfitLoss.toNumber(), // Profit lost from profitable sales
                recoveredLoss: refundedLossRecovery.toNumber(), // Loss recovered from loss-making sales
                details: refundedSalesDetails.map(sale => ({
                    salesId: sale.id,
                    totalAmount: sale.totalAmount.toNumber(),
                    paidAmount: sale.paidAmount.toNumber(),
                    customerName: sale.customerName || 'Guest',
                    phoneNumber: sale.phoneNumber || '',
                    businessDate: sale.businessDate,
                    remark: sale.remark || ''
                }))
            },

            // Voided sales info
            voidedSales: {
                count: voidedSales._count?.id || 0,
                totalAmount: (voidedSales._sum?.totalAmount || new Decimal(0)).toNumber(),
                paidAmount: (voidedSales._sum?.paidAmount || new Decimal(0)).toNumber(),
                details: voidedSalesDetails.map(sale => ({
                    salesId: sale.id,
                    totalAmount: sale.totalAmount.toNumber(),
                    paidAmount: sale.paidAmount.toNumber(),
                    customerName: sale.customerName || 'Guest',
                    phoneNumber: sale.phoneNumber || '',
                    businessDate: sale.businessDate,
                    remark: sale.remark || ''
                }))
            },

            // Delivered sales info
            deliveredSales: {
                count: deliveredSales._count?.id || 0,
                totalAmount: (deliveredSales._sum?.totalAmount || new Decimal(0)).toNumber(),
                paidAmount: (deliveredSales._sum?.paidAmount || new Decimal(0)).toNumber(),
                profit: deliveredTotalProfit.toNumber(),
                profitGains: deliveredGains.toNumber(),
                profitLosses: deliveredLosses.toNumber(),
                changeGiven: (deliveredSales._sum?.changeAmount || new Decimal(0)).toNumber(),
                details: deliveredSalesDetails.map(sale => ({
                    salesId: sale.id,
                    totalAmount: sale.totalAmount.toNumber(),
                    paidAmount: sale.paidAmount.toNumber(),
                    customerName: sale.customerName || 'Guest',
                    phoneNumber: sale.phoneNumber || '',
                    businessDate: sale.businessDate,
                    remark: sale.remark || ''
                }))
            },

            sessionInfo: {
                id: session.id,
                outletId: session.outletId,
                businessDate: session.businessDate,
                openingDateTime: session.openingDateTime,
                closingDateTime: session.closingDateTime,
                openingAmount: session.openingAmount.toNumber(),
                totalSalesCount: sessionSalesCount,
                openByUserID: session.openByUserID,
                closeByUserID: session.closeByUserID
            },

            topSellingItems: topSellingItems.map(item => ({
                itemId: item.itemId,
                itemName: item.itemName,
                itemCode: item.itemCode,
                itemBrand: item.itemBrand,
                quantitySold: (item._sum.quantity || new Decimal(0)).toNumber(),
                revenue: (item._sum.subtotalAmount || new Decimal(0)).toNumber()
            })),

            topSellingCategories: topSellingCategories.map(category => ({
                categoryName: category.categoryName,
                quantitySold: category.quantitySold.toNumber(),
                revenue: category.revenue.toNumber()
            })),

            mostProfitableItems: mostProfitableItems.map(item => {
                const revenue = (item._sum.subtotalAmount || new Decimal(0)).toNumber();
                const cost = (item._sum.cost || new Decimal(0)).toNumber();
                const profit = (item._sum.profit || new Decimal(0)).toNumber();
                return {
                    itemId: item.itemId,
                    itemName: item.itemName,
                    itemCode: item.itemCode,
                    itemBrand: item.itemBrand,
                    profit,
                    revenue,
                    cost,
                    quantity: (item._sum.quantity || new Decimal(0)).toNumber(),
                    margin: revenue > 0 ? (profit / revenue) * 100 : 0
                };
            }),

            mostLossItems: mostLossItems.map(item => {
                const revenue = (item._sum.subtotalAmount || new Decimal(0)).toNumber();
                const cost = (item._sum.cost || new Decimal(0)).toNumber();
                const profit = (item._sum.profit || new Decimal(0)).toNumber(); // Will be negative
                return {
                    itemId: item.itemId,
                    itemName: item.itemName,
                    itemCode: item.itemCode,
                    itemBrand: item.itemBrand,
                    loss: profit,
                    revenue,
                    cost,
                    quantity: (item._sum.quantity || new Decimal(0)).toNumber(),
                    margin: revenue > 0 ? (profit / revenue) * 100 : 0
                };
            }),

            paymentBreakdown: paymentBreakdown.map(payment => ({
                method: payment.method,
                amount: (payment._sum.paidAmount || new Decimal(0)).toNumber()
            })),

            // Only show stock balance for items sold in this session
            stockBalance: stockBalanceItems.map(stock => ({
                itemId: stock.item.id,
                itemName: stock.item.itemName,
                itemCode: stock.item.itemCode,
                itemBrand: stock.item.itemBrand,
                quantitySold: (itemQuantitiesSold[stock.item.id] || new Decimal(0)).toNumber(),
                availableQuantity: stock.availableQuantity.toNumber(),
                status: stock.availableQuantity.lte(0) ? 'Out of Stock' :
                    (stock.reorderThreshold && stock.availableQuantity.lte(stock.reorderThreshold)) ? 'Low Stock' : 'In Stock'
            })),

            // Today's Purchase Orders
            todayPurchaseOrders: {
                count: todayPurchaseOrders.length,
                totalAmount: todayPurchaseOrders.reduce((sum, po) => sum.plus(po.totalAmount || new Decimal(0)), new Decimal(0)).toNumber(),
                totalItems: todayPurchaseOrders.reduce((sum, po) =>
                    sum + po.purchaseOrderItems.reduce((itemSum, item) => itemSum + item.quantity.toNumber(), 0), 0),
                orders: todayPurchaseOrders.map(po => ({
                    id: po.id,
                    purchaseOrderNumber: po.purchaseOrderNumber,
                    totalAmount: (po.totalAmount || new Decimal(0)).toNumber(),
                    status: po.status,
                    supplierName: po.supplier?.companyName || 'Unknown',
                    createdAt: po.createdAt,
                    itemCount: po.purchaseOrderItems.reduce((sum, item) => sum + item.quantity.toNumber(), 0)
                }))
            },

            // Today's Delivery Orders
            todayDeliveryOrders: {
                count: todayDeliveryOrders.length,
                totalItems: todayDeliveryOrders.reduce((sum, order) =>
                    sum + order.deliveryOrderItems.reduce((itemSum, item) => itemSum + item.receivedQuantity, 0), 0),
                orders: todayDeliveryOrders.map(order => ({
                    id: order.id,
                    trackingNumber: order.trackingNumber,
                    status: order.status,
                    deliveryDate: order.deliveryDate,
                    createdAt: order.createdAt,
                    supplierId: order.supplierId,
                    itemCount: order.deliveryOrderItems.reduce((sum, item) => sum + item.receivedQuantity, 0)
                }))
            },

            // Today's Invoices
            todayInvoices: {
                count: todayInvoices.length,
                totalAmount: todayInvoices.reduce((sum, invoice) => sum.plus(invoice.totalAmount || new Decimal(0)), new Decimal(0)).toNumber(),
                totalItems: todayInvoices.reduce((sum, invoice) =>
                    sum + invoice.invoiceItems.reduce((itemSum, item) => itemSum + item.quantity.toNumber(), 0), 0),
                invoices: todayInvoices.map(invoice => ({
                    id: invoice.id,
                    invoiceNumber: invoice.invoiceNumber,
                    totalAmount: (invoice.totalAmount || new Decimal(0)).toNumber(),
                    status: invoice.status,
                    supplierName: invoice.supplier?.companyName || 'Unknown',
                    createdAt: invoice.createdAt,
                    itemCount: invoice.invoiceItems.reduce((sum, item) => sum + item.quantity.toNumber(), 0)
                }))
            },

            // Sales array
            sales: allSales.map(sale => ({
                id: sale.id,
                businessDate: sale.businessDate,
                salesType: sale.salesType,
                customerName: sale.customerName || 'Guest',
                phoneNumber: sale.phoneNumber || '',
                // Street address of the sale (delivery/customer street). Prod data
                // shows tenants fill SHIP_STREET only (bill_* unused) — verified
                // against audio_technic_db 2026-06-09: 5,496/6,136 rows.
                shipStreet: sale.shipStreet || '',
                subtotalAmount: sale.subtotalAmount.toNumber(),
                taxAmount: sale.taxAmount.toNumber(),
                // Every discount applied BELOW the subtotal (sale-level + tier/
                // voucher [mutually exclusive] + subscription + points redemption).
                // Reconciles the report: subtotal − totalDiscountAmount (+ charges,
                // + tax if exclusive) = totalAmount. Item-level discounts are NOT
                // included — subtotal is already net of them.
                totalDiscountAmount: (sale.discountAmount || new Decimal(0))
                    .plus(sale.loyaltyTierDiscountAmount || 0)
                    .plus(sale.voucherDiscountAmount || 0)
                    .plus(sale.subscriptionDiscountAmount || 0)
                    .plus(sale.loyaltyPointsRedemptionValue || 0)
                    .toNumber(),
                totalAmount: sale.totalAmount.toNumber(),
                paidAmount: sale.paidAmount.toNumber(),
                profitAmount: sale.profitAmount.toNumber(),
                isTaxInclusive: true,
                status: sale.status,
                remark: sale.remark || '',
                salesItems: sale.salesItems.map(item => ({
                    id: item.id,
                    itemName: item.itemName,
                    itemModel: item.itemModel,
                    cost: item.cost.toNumber(),
                    quantity: item.quantity.toNumber(),
                    discountAmount: item.discountAmount.toNumber(),
                    taxAmount: item.taxAmount.toNumber(),
                    subtotalAmount: item.subtotalAmount.toNumber()
                }))
            }))
        };
    }
    catch (error) {
        throw error;
    }
}

// ─── Outlet-report cache (fingerprint-validated) ────────────────────────────
//
// Generating an outlet report costs ~26 tenant-DB queries. Users can re-request
// the same monthly report freely (no FE debounce), so closed periods are cached
// in-memory and validated with a cheap data fingerprint instead of a TTL:
// correctness is guaranteed by data state, not by hoping nothing changed.
//
// A closed period is NOT immutable — a backdated sale can be inserted into it,
// and a past sale can be voided/returned/refunded/edited/soft-deleted later.
// Every such write path either inserts rows (COUNT moves) or updates the sales
// row in the same transaction (Prisma @updatedAt bumps UPDATED_AT) — verified
// across sales.service.ts (void/return/refund/update/remove all tx.sales.update).
// So COUNT(*) + MAX(UPDATED_AT) over (outletId, businessDate range) on sales +
// payment is a complete change detector. Both fingerprint queries are index
// range seeks (sales: composite (outletId, businessDate, status); payment:
// businessDate index) — ~1-2ms each.
//
// Only periods that ended before today (UTC) are cached; Today / This week /
// This month change constantly and would never hit. The "today's PO/DO/Invoice"
// and stockBalance sections are LIVE snapshots (not period-scoped), so the hit
// path re-fetches them via the shared helpers below and splices — a hit costs
// 6 small queries instead of ~26.
//
// In-memory Map is sufficient: prod runs a single App Service instance; a
// restart just means one regeneration. Known cosmetic limit: item renames /
// recategorisation after caching keep the old name in cached rankings until any
// sale in the period changes (stock + today sections are always live).

interface OutletReportCacheEntry {
    fingerprint: string;
    payload: Record<string, unknown>;
    // itemId -> quantity sold in the period; needed to rebuild the live
    // stockBalance section on a cache hit.
    soldQty: Record<number, number>;
    lastAccessed: number;
}

const outletReportCache = new Map<string, OutletReportCacheEntry>();
const OUTLET_REPORT_CACHE_MAX_ENTRIES = 100;
const outletReportCacheStats = { hits: 0, misses: 0 };

const getOutletReportCacheStats = () => ({
    ...outletReportCacheStats,
    entries: outletReportCache.size,
});

// endDate strictly before today's UTC midnight = the period can no longer gain
// same-day sales through normal (non-backdated) flow. Backdated inserts are
// still caught by the fingerprint.
const isClosedPeriod = (endDate: Date): boolean => {
    const now = new Date();
    const startOfTodayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return endDate.getTime() < startOfTodayUtc.getTime();
};

// Deliberately NO `deleted: false` filter: a soft delete is an UPDATE, and the
// report's results change with it, so its UPDATED_AT bump must invalidate.
const computeOutletReportFingerprint = async (
    tenantPrisma: PrismaClient, outletId: number, startDate: Date, endDate: Date,
): Promise<string> => {
    const range = { outletId: outletId, businessDate: { gte: startDate, lte: endDate } };
    const [s, p] = await Promise.all([
        tenantPrisma.sales.aggregate({ where: range, _count: { id: true }, _max: { updatedAt: true } }),
        tenantPrisma.payment.aggregate({ where: range, _count: { id: true }, _max: { updatedAt: true } }),
    ]);
    return [
        s._count.id, s._max.updatedAt?.toISOString() ?? '',
        p._count.id, p._max.updatedAt?.toISOString() ?? '',
    ].join('|');
};

const setOutletReportCacheEntry = (key: string, entry: OutletReportCacheEntry) => {
    if (!outletReportCache.has(key) && outletReportCache.size >= OUTLET_REPORT_CACHE_MAX_ENTRIES) {
        // Evict the least-recently-accessed entry (bounded memory, no timer).
        let lruKey: string | null = null;
        let lruAccessed = Infinity;
        for (const [k, e] of outletReportCache) {
            if (e.lastAccessed < lruAccessed) { lruAccessed = e.lastAccessed; lruKey = k; }
        }
        if (lruKey) outletReportCache.delete(lruKey);
    }
    outletReportCache.set(key, entry);
};

// Live "entered today" snapshot (PO/DO/invoices created today for the outlet).
// Request-day scoped, independent of the report period — shared by the build
// path and the cache-hit splice so both always serve a fresh snapshot.
const fetchTodayOps = async (tenantPrisma: PrismaClient, outletId: number) => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    const todayWindow = { gte: startOfDay, lte: endOfDay };

    const [todayPurchaseOrders, todayDeliveryOrders, todayInvoices] = await Promise.all([
        tenantPrisma.purchaseOrder.findMany({
            where: { outletId: outletId, createdAt: todayWindow, deleted: false },
            select: {
                id: true,
                purchaseOrderNumber: true,
                totalAmount: true,
                status: true,
                createdAt: true,
                supplier: { select: { companyName: true } },
                purchaseOrderItems: { select: { quantity: true } }
            }
        }),
        tenantPrisma.deliveryOrder.findMany({
            where: { outletId: outletId, createdAt: todayWindow, deleted: false },
            select: {
                id: true,
                trackingNumber: true,
                status: true,
                createdAt: true,
                deliveryDate: true,
                supplierId: true,
                deliveryOrderItems: { select: { receivedQuantity: true } }
            }
        }),
        tenantPrisma.invoice.findMany({
            where: { outletId: outletId, createdAt: todayWindow, deleted: false },
            select: {
                id: true,
                invoiceNumber: true,
                totalAmount: true,
                status: true,
                createdAt: true,
                supplier: { select: { companyName: true } },
                invoiceItems: { select: { quantity: true } }
            }
        })
    ]);

    return {
        todayPurchaseOrders: {
            count: todayPurchaseOrders.length,
            totalAmount: todayPurchaseOrders.reduce((sum, po) => sum.plus(po.totalAmount || new Decimal(0)), new Decimal(0)).toNumber(),
            totalItems: todayPurchaseOrders.reduce((sum, po) =>
                sum + po.purchaseOrderItems.reduce((itemSum, item) => itemSum + item.quantity.toNumber(), 0), 0),
            orders: todayPurchaseOrders.map(po => ({
                id: po.id,
                purchaseOrderNumber: po.purchaseOrderNumber,
                totalAmount: (po.totalAmount || new Decimal(0)).toNumber(),
                status: po.status,
                supplierName: po.supplier?.companyName || 'Unknown',
                createdAt: po.createdAt,
                itemCount: po.purchaseOrderItems.reduce((sum, item) => sum + item.quantity.toNumber(), 0)
            }))
        },
        todayDeliveryOrders: {
            count: todayDeliveryOrders.length,
            totalItems: todayDeliveryOrders.reduce((sum, order) =>
                sum + order.deliveryOrderItems.reduce((itemSum, item) => itemSum + item.receivedQuantity, 0), 0),
            orders: todayDeliveryOrders.map(order => ({
                id: order.id,
                trackingNumber: order.trackingNumber,
                status: order.status,
                deliveryDate: order.deliveryDate,
                createdAt: order.createdAt,
                supplierId: order.supplierId,
                itemCount: order.deliveryOrderItems.reduce((sum, item) => sum + item.receivedQuantity, 0)
            }))
        },
        todayInvoices: {
            count: todayInvoices.length,
            totalAmount: todayInvoices.reduce((sum, invoice) => sum.plus(invoice.totalAmount || new Decimal(0)), new Decimal(0)).toNumber(),
            totalItems: todayInvoices.reduce((sum, invoice) =>
                sum + invoice.invoiceItems.reduce((itemSum, item) => itemSum + item.quantity.toNumber(), 0), 0),
            invoices: todayInvoices.map(invoice => ({
                id: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                totalAmount: (invoice.totalAmount || new Decimal(0)).toNumber(),
                status: invoice.status,
                supplierName: invoice.supplier?.companyName || 'Unknown',
                createdAt: invoice.createdAt,
                itemCount: invoice.invoiceItems.reduce((sum, item) => sum + item.quantity.toNumber(), 0)
            }))
        }
    };
};

// Live current-stock section for the items sold in the period. Stock levels and
// In/Low/Out status reflect NOW, not the period — shared by build + cache-hit
// paths. soldQty: itemId -> total quantity sold in the period.
const fetchStockBalanceSection = async (
    tenantPrisma: PrismaClient, outletId: number, soldQty: Record<number, number>,
) => {
    const soldItemIds = Object.keys(soldQty).map(Number);
    const stockBalanceItems = await tenantPrisma.stockBalance.findMany({
        where: {
            deleted: false,
            outletId: outletId,
            itemId: { in: soldItemIds }
        },
        select: {
            availableQuantity: true,
            onHandQuantity: true,
            reorderThreshold: true,
            itemId: true,
            item: {
                select: {
                    id: true,
                    itemName: true,
                    itemCode: true,
                    itemBrand: true,
                }
            },
            outlet: {
                select: {
                    id: true,
                    outletName: true
                }
            }
        }
    });
    return stockBalanceItems.map(stock => ({
        itemId: stock.item.id,
        itemName: stock.item.itemName,
        itemCode: stock.item.itemCode,
        itemBrand: stock.item.itemBrand,
        quantitySold: soldQty[stock.item.id] || 0,
        availableQuantity: stock.availableQuantity.toNumber(),
        status: stock.availableQuantity.lte(0) ? 'Out of Stock' :
            (stock.reorderThreshold && stock.availableQuantity.lte(stock.reorderThreshold)) ? 'Low Stock' : 'In Stock'
    }));
};

let generateOutletReport = async (databaseName: string, outletId: number, startDate?: Date, endDate?: Date, planType?: string | null) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // ── Cache check (closed periods only) ──
        // Fingerprint is computed BEFORE building so a write racing the build can
        // only make the stored fingerprint stale-early (next request rebuilds),
        // never stale-late (serving old data as current).
        const cacheKey = startDate && endDate
            ? `${databaseName}|${outletId}|${startDate.toISOString()}|${endDate.toISOString()}|${planType ?? ''}`
            : null;
        let fingerprint: string | null = null;
        if (cacheKey && startDate && endDate && isClosedPeriod(endDate)) {
            fingerprint = await computeOutletReportFingerprint(tenantPrisma, outletId, startDate, endDate);
            const cached = outletReportCache.get(cacheKey);
            if (cached && cached.fingerprint === fingerprint) {
                cached.lastAccessed = Date.now();
                outletReportCacheStats.hits++;
                // Serve cached period data, but splice in the live snapshots.
                const [todayOps, stockBalance] = await Promise.all([
                    fetchTodayOps(tenantPrisma, outletId),
                    fetchStockBalanceSection(tenantPrisma, outletId, cached.soldQty),
                ]);
                return { ...cached.payload, ...todayOps, stockBalance };
            }
            outletReportCacheStats.misses++;
        }
        // Laundry accounts split each wash into a service line (revenue) + consumable
        // depletion lines (detergent COGS). For item rankings those consumable lines
        // would surface as "sold"/"loss" items, so we exclude them (stockConsumptionQty
        // set) and surface them instead under the dedicated laundryOps block below.
        // Retail/F&B keep the original behaviour (filter is a no-op).
        const isLaundry = planType === 'Laundry';
        const itemRankingFilter = isLaundry ? { stockConsumptionQty: null } : {};
        // First check if outlet exists
        const outlet = await tenantPrisma.outlet.findUnique({
            where: { id: outletId }
        });

        if (!outlet) {
            throw new NotFoundError('Outlet');
        }

        // Date filtering - default to all time if not provided.
        //
        // Filter on businessDate (NOT createdAt): it is the POS business day the
        // sale/payment belongs to (handles backdated sales correctly) and it is
        // what the rest of the app reports on (session reports, dashboard revenue
        // trend). It also lets these queries ride the composite index
        // @@index([outletId, businessDate, status]) on Sales — outletId equality +
        // businessDate range seek — instead of scanning every row for the outlet.
        // Both Sales and Payment carry businessDate (each with its own index), so
        // the same filter is valid wherever outletFilter is spread below.
        const dateFilter = startDate && endDate ? {
            businessDate: {
                gte: startDate,
                lte: endDate
            }
        } : {};

        // All queries will filter by this outlet ID
        const outletFilter = { outletId: outletId, ...dateFilter };

        // Run all queries concurrently for better performance. The live
        // "today's PO/DO/Invoice" snapshot runs alongside via its shared helper.
        const [[
            voidedSales,
            returnedSales,
            refundedSales,
            partiallyPaidSales,
            completedSales,
            deliveredSales,
            topSellingItems,
            mostProfitableItems,
            mostLossItems,
            salesSummary,
            paymentBreakdown,
            salesItems,
            allSales
        ], todayOps] = await Promise.all([Promise.all([
            // Voided sales
            tenantPrisma.sales.aggregate({
                where: {
                    ...outletFilter,
                    status: "Voided"
                },
                _count: { id: true },
                _sum: { totalAmount: true, paidAmount: true }
            }),

            // Returned sales details
            tenantPrisma.sales.aggregate({
                where: {
                    ...outletFilter,
                    status: "Returned",
                    deleted: false
                },
                _count: { id: true },
                _sum: {
                    totalAmount: true,
                    paidAmount: true,
                    profitAmount: true
                }
            }),

            // Refunded sales details
            tenantPrisma.sales.aggregate({
                where: {
                    ...outletFilter,
                    status: "Refunded",
                    deleted: false
                },
                _count: { id: true },
                _sum: {
                    totalAmount: true,
                    paidAmount: true,
                    profitAmount: true
                }
            }),

            // Partially paid sales details
            tenantPrisma.sales.aggregate({
                where: {
                    ...outletFilter,
                    status: "Partially Paid",
                    deleted: false
                },
                _count: { id: true },
                _sum: {
                    totalAmount: true,
                    paidAmount: true,
                    profitAmount: true
                }
            }),

            // Completed sales
            tenantPrisma.sales.aggregate({
                where: {
                    ...outletFilter,
                    status: "Completed",
                    deleted: false
                },
                _count: { id: true },
                _sum: {
                    totalAmount: true,
                    paidAmount: true,
                    profitAmount: true,
                    changeAmount: true
                }
            }),

            // Delivered sales aggregate
            tenantPrisma.sales.aggregate({
                where: {
                    ...outletFilter,
                    status: "Delivered",
                    deleted: false
                },
                _count: { id: true },
                _sum: {
                    totalAmount: true,
                    paidAmount: true,
                    profitAmount: true,
                    changeAmount: true
                }
            }),

            // Include all non-voided sales for top selling items
            tenantPrisma.salesItem.groupBy({
                by: ['itemId', 'itemName', 'itemCode', 'itemBrand'],
                where: {
                    sales: {
                        ...outletFilter,
                        status: { in: ["Completed", "Partially Paid", "Delivered", "Returned", "Refunded"] }
                    },
                    ...itemRankingFilter
                },
                _sum: {
                    quantity: true,
                    subtotalAmount: true
                },
                orderBy: {
                    _sum: {
                        quantity: 'desc'
                    }
                },
                take: 10
            }),

            // Most profitable items from completed sales
            tenantPrisma.salesItem.groupBy({
                by: ['itemId', 'itemName', 'itemCode', 'itemBrand'],
                where: {
                    sales: {
                        ...outletFilter,
                        status: "Completed"
                    },
                    profit: {
                        gt: 0
                    },
                    ...itemRankingFilter
                },
                _sum: {
                    profit: true,
                    subtotalAmount: true,
                    cost: true,
                    quantity: true
                },
                orderBy: {
                    _sum: {
                        profit: 'desc'
                    }
                },
                take: 10
            }),

            // Most loss-making items (items sold at a loss)
            tenantPrisma.salesItem.groupBy({
                by: ['itemId', 'itemName', 'itemCode', 'itemBrand'],
                where: {
                    sales: {
                        ...outletFilter,
                        status: "Completed"
                    },
                    profit: {
                        lt: 0
                    },
                    ...itemRankingFilter
                },
                _sum: {
                    profit: true,
                    subtotalAmount: true,
                    cost: true,
                    quantity: true
                },
                orderBy: {
                    _sum: {
                        profit: 'asc'
                    }
                },
                take: 10
            }),

            // Sales summary for completed sales
            tenantPrisma.sales.aggregate({
                where: {
                    ...outletFilter,
                    status: "Completed",
                    deleted: false
                },
                _sum: {
                    paidAmount: true,
                    totalAmount: true,
                    profitAmount: true,
                    changeAmount: true
                },
                _count: {
                    id: true
                }
            }),

            // Payment breakdown from all non-voided sales.
            // `deleted: false` REQUIRED — a payment's own IS_DELETED stays 0 when
            // its sale is soft-deleted, so without it deleted orders inflate cash.
            tenantPrisma.payment.groupBy({
                by: ['method'],
                where: {
                    ...outletFilter,
                    sales: {
                        status: { in: ["Completed", "Partially Paid", "Delivered", "Returned", "Refunded"] },
                        deleted: false
                    }
                },
                _sum: {
                    paidAmount: true
                }
            }),

            // Get all distinct items sold from all non-voided sales
            tenantPrisma.salesItem.findMany({
                where: {
                    sales: {
                        ...outletFilter,
                        status: { in: ["Completed", "Partially Paid", "Delivered", "Returned", "Refunded"] }
                    }
                },
                select: {
                    itemId: true,
                    quantity: true,
                    subtotalAmount: true
                }
            }),

            // All sales for the outlet
            tenantPrisma.sales.findMany({
                where: {
                    ...outletFilter,
                    deleted: false,
                },
                select: {
                    id: true,
                    businessDate: true,
                    salesType: true,
                    customerName: true,
                    phoneNumber: true,
                    shipStreet: true,
                    subtotalAmount: true,
                    taxAmount: true,
                    discountAmount: true,
                    loyaltyTierDiscountAmount: true,
                    voucherDiscountAmount: true,
                    subscriptionDiscountAmount: true,
                    loyaltyPointsRedemptionValue: true,
                    totalAmount: true,
                    paidAmount: true,
                    profitAmount: true,
                    isTaxInclusive: true,
                    status: true,
                    remark: true,
                    salesItems: {
                        select: {
                            id: true,
                            itemName: true,
                            itemModel: true,
                            quantity: true,
                            cost: true,
                            discountAmount: true,
                            taxAmount: true,
                            subtotalAmount: true,
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            })
        ]), fetchTodayOps(tenantPrisma, outletId)]);

        // Get detailed sales information for each status
        const [returnedSalesDetails, refundedSalesDetails, partiallyPaidSalesDetails, voidedSalesDetails, deliveredSalesDetails] = await Promise.all([
            tenantPrisma.sales.findMany({
                where: {
                    ...outletFilter,
                    status: "Returned",
                    deleted: false
                },
                select: {
                    id: true,
                    totalAmount: true,
                    paidAmount: true,
                    customerId: true,
                    businessDate: true,
                    remark: true,
                    customerName: true,
                    phoneNumber: true
                }
            }),

            tenantPrisma.sales.findMany({
                where: {
                    ...outletFilter,
                    status: "Refunded",
                    deleted: false
                },
                select: {
                    id: true,
                    totalAmount: true,
                    paidAmount: true,
                    customerId: true,
                    businessDate: true,
                    remark: true,
                    customerName: true,
                    phoneNumber: true
                }
            }),

            tenantPrisma.sales.findMany({
                where: {
                    ...outletFilter,
                    status: "Partially Paid",
                    deleted: false
                },
                select: {
                    id: true,
                    totalAmount: true,
                    paidAmount: true,
                    customerId: true,
                    businessDate: true,
                    customerName: true,
                    phoneNumber: true
                }
            }),

            tenantPrisma.sales.findMany({
                where: {
                    ...outletFilter,
                    status: "Voided",
                    deleted: false
                },
                select: {
                    id: true,
                    totalAmount: true,
                    paidAmount: true,
                    customerId: true,
                    businessDate: true,
                    remark: true,
                    customerName: true,
                    phoneNumber: true
                }
            }),

            // Delivered sales details
            tenantPrisma.sales.findMany({
                where: {
                    ...outletFilter,
                    status: "Delivered",
                    deleted: false
                },
                select: {
                    id: true,
                    totalAmount: true,
                    paidAmount: true,
                    customerId: true,
                    businessDate: true,
                    remark: true,
                    customerName: true,
                    phoneNumber: true
                }
            })
        ]);

        // Get the unique item IDs sold in this outlet
        const soldItemIds = [...new Set(salesItems.map(item => item.itemId))];

        // Fetch item details with categories for these items
        const itemsWithCategories = await tenantPrisma.item.findMany({
            where: {
                id: {
                    in: soldItemIds
                }
            },
            include: {
                category: true
            }
        });

        // Create a map of sold quantities by itemId for faster lookup
        const itemQuantitiesSold: { [key: number]: Decimal } = {};
        salesItems.forEach(item => {
            if (!itemQuantitiesSold[item.itemId]) {
                itemQuantitiesSold[item.itemId] = new Decimal(0);
            }
            itemQuantitiesSold[item.itemId] = itemQuantitiesSold[item.itemId].plus(item.quantity);
        });
        // Plain-number copy: feeds the live stockBalance helper and is stored in
        // the cache entry so a hit can rebuild the stock section without rerunning
        // the period's salesItem scan. Includes 0-qty items so soldItemIds is
        // preserved exactly (keys = distinct items sold).
        const soldQty: Record<number, number> = {};
        soldItemIds.forEach(id => { soldQty[id] = (itemQuantitiesSold[id] || new Decimal(0)).toNumber(); });

        // Calculate top-selling categories
        const categorySales: Record<number, { categoryName: string, quantitySold: Decimal, revenue: Decimal }> = {};

        // Create a map for O(1) item lookup
        const itemsMap = new Map(itemsWithCategories.map(item => [item.id, item]));

        salesItems.forEach(salesItem => {
            const item = itemsMap.get(salesItem.itemId);
            if (!item) return;

            const categoryId = item.categoryId;
            const categoryName = item.category.name;

            if (!categorySales[categoryId]) {
                categorySales[categoryId] = {
                    categoryName,
                    quantitySold: new Decimal(0),
                    revenue: new Decimal(0)
                };
            }
            categorySales[categoryId].quantitySold = categorySales[categoryId].quantitySold.plus(salesItem.quantity);
            categorySales[categoryId].revenue = categorySales[categoryId].revenue.plus(salesItem.subtotalAmount);
        });

        const topSellingCategories = Object.values(categorySales)
            .sort((a, b) => b.quantitySold.minus(a.quantitySold).toNumber())
            .slice(0, 5)
            .map(category => ({
                categoryName: category.categoryName,
                quantitySold: category.quantitySold,
                revenue: category.revenue
            }));

        // Calculate outlet sales count (all non-voided) from allSales in memory
        const outletSalesCount = allSales.filter(sale =>
            ["Completed", "Partially Paid", "Delivered", "Returned", "Refunded"].includes(sale.status)
        ).length;

        // Get current stock for items sold in the period (live snapshot; shared
        // with the cache-hit path)
        const stockBalance = await fetchStockBalanceSection(tenantPrisma, outletId, soldQty);

        // Calculate metrics
        const totalOutstandingAmount = (partiallyPaidSales._sum?.totalAmount || new Decimal(0)).minus(partiallyPaidSales._sum?.paidAmount || new Decimal(0));
        const averageOutstandingPerTransaction = partiallyPaidSales._count.id > 0
            ? totalOutstandingAmount.dividedBy(partiallyPaidSales._count.id)
            : new Decimal(0);
        const paymentCoverageRatio = (partiallyPaidSales._sum?.totalAmount || new Decimal(0)).gt(0)
            ? ((partiallyPaidSales._sum?.paidAmount || new Decimal(0)).dividedBy(partiallyPaidSales._sum?.totalAmount || new Decimal(1))).times(100)
            : new Decimal(0);

        const totalCompletedSalesCount = completedSales._count.id || 0;
        const totalCompletedRevenue = completedSales._sum?.totalAmount || new Decimal(0);
        const averageTransactionValue = totalCompletedSalesCount > 0
            ? totalCompletedRevenue.dividedBy(totalCompletedSalesCount)
            : new Decimal(0);

        const netRevenue = totalCompletedRevenue;
        const grossRevenue = salesSummary._sum?.totalAmount || new Decimal(0);
        const returnRefundImpact = (returnedSales._sum?.totalAmount || new Decimal(0)).plus(refundedSales._sum?.totalAmount || new Decimal(0));

        // Split profit into gains and losses for completed sales (filter from allSales in memory)
        const completedSalesWithProfit = allSales.filter(sale => sale.status === "Completed");

        let totalGains = new Decimal(0);
        let totalLosses = new Decimal(0);
        completedSalesWithProfit.forEach(sale => {
            if (sale.profitAmount.gt(0)) {
                totalGains = totalGains.plus(sale.profitAmount);
            } else if (sale.profitAmount.lt(0)) {
                totalLosses = totalLosses.plus(sale.profitAmount); // This will be negative
            }
        });

        // Calculate total profit from gains and losses
        const totalProfit = totalGains.plus(totalLosses);

        // Split profit for partially paid sales (filter from allSales in memory)
        const partiallyPaidSalesWithProfit = allSales.filter(sale => sale.status === "Partially Paid");

        let partiallyPaidGains = new Decimal(0);
        let partiallyPaidLosses = new Decimal(0);
        partiallyPaidSalesWithProfit.forEach(sale => {
            if (sale.profitAmount.gt(0)) {
                partiallyPaidGains = partiallyPaidGains.plus(sale.profitAmount);
            } else if (sale.profitAmount.lt(0)) {
                partiallyPaidLosses = partiallyPaidLosses.plus(sale.profitAmount);
            }
        });

        // Calculate total profit for partially paid from gains and losses
        const partiallyPaidTotalProfit = partiallyPaidGains.plus(partiallyPaidLosses);

        // Split profit for delivered sales (filter from allSales in memory)
        const deliveredSalesWithProfit = allSales.filter(sale => sale.status === "Delivered");

        let deliveredGains = new Decimal(0);
        let deliveredLosses = new Decimal(0);
        deliveredSalesWithProfit.forEach(sale => {
            if (sale.profitAmount.gt(0)) {
                deliveredGains = deliveredGains.plus(sale.profitAmount);
            } else if (sale.profitAmount.lt(0)) {
                deliveredLosses = deliveredLosses.plus(sale.profitAmount);
            }
        });

        // Calculate total profit for delivered from gains and losses
        const deliveredTotalProfit = deliveredGains.plus(deliveredLosses);

        // Calculate profit impact for returned/refunded sales (considering sign)
        const returnedProfit = returnedSales._sum?.profitAmount || new Decimal(0);
        const refundedProfit = refundedSales._sum?.profitAmount || new Decimal(0);

        // For returned/refunded: if original was profitable, we lost profit; if loss, we recovered loss
        const returnedProfitLoss = returnedProfit.gt(0) ? returnedProfit : new Decimal(0);
        const returnedLossRecovery = returnedProfit.lt(0) ? returnedProfit.abs() : new Decimal(0);
        const refundedProfitLoss = refundedProfit.gt(0) ? refundedProfit : new Decimal(0);
        const refundedLossRecovery = refundedProfit.lt(0) ? refundedProfit.abs() : new Decimal(0);

        // ── Laundry operations (only computed for laundry accounts) ──
        // totalKgProcessed = Σ actual processed weight across wash-service lines;
        // suppliesConsumed = Σ(quantity × stockConsumptionQty) per supply item, in
        // base units (ml/g) — the FE converts to L/kg using unitOfMeasure.
        let laundryOps: {
            totalKgProcessed: number;
            totalLoads: number;
            totalJasa: number;
            averageKgPerLoad: number;
            suppliesConsumed: { itemId: number; itemName: string; unitOfMeasure: string | null; totalConsumed: number; cost: number }[];
        } | null = null;
        // Laundry profit breakdown: service revenue − supply cost = net profit.
        let laundryProfit: {
            serviceRevenue: number;
            supplyCost: number;
            netProfit: number;
            margin: number;
            services: { itemId: number; itemName: string; itemCode: string; itemBrand: string; quantity: number; loads: number; totalKg: number; revenue: number; cost: number; profit: number }[];
        } | null = null;
        if (isLaundry) {
            const nonVoidStatuses = ["Completed", "Partially Paid", "Delivered", "Returned", "Refunded"];
            // Split laundry service items into wash vs jasa — a "load" (muatan) is
            // a machine wash, jasa (e.g. ironing) is counted separately. Wash items
            // carry a defaultLoadWeightKg (even 0); pure jasa items leave it null.
            const serviceItems = await tenantPrisma.item.findMany({
                where: { itemType: 'service', deleted: false },
                select: { id: true, defaultLoadWeightKg: true }
            });
            const washItemIds = serviceItems.filter(i => i.defaultLoadWeightKg !== null).map(i => i.id);
            const jasaItemIds = serviceItems.filter(i => i.defaultLoadWeightKg === null).map(i => i.id);
            const [kgAgg, jasaAgg, consumableLines, serviceGroups] = await Promise.all([
                tenantPrisma.salesItem.aggregate({
                    where: {
                        sales: { ...outletFilter, status: { in: nonVoidStatuses }, deleted: false },
                        loadWeightKg: { not: null },
                        itemId: { in: washItemIds }
                    },
                    _sum: { loadWeightKg: true },
                    _count: { id: true }
                }),
                tenantPrisma.salesItem.aggregate({
                    where: {
                        sales: { ...outletFilter, status: { in: nonVoidStatuses }, deleted: false },
                        itemId: { in: jasaItemIds }
                    },
                    _count: { id: true }
                }),
                tenantPrisma.salesItem.findMany({
                    where: {
                        sales: { ...outletFilter, status: { in: nonVoidStatuses }, deleted: false },
                        stockConsumptionQty: { not: null }
                    },
                    select: { itemId: true, itemName: true, unitOfMeasure: true, quantity: true, stockConsumptionQty: true, cost: true }
                }),
                tenantPrisma.salesItem.groupBy({
                    by: ['itemId', 'itemName', 'itemCode', 'itemBrand'],
                    where: {
                        sales: { ...outletFilter, status: "Completed", deleted: false },
                        loadWeightKg: { not: null }
                    },
                    _sum: { subtotalAmount: true, profit: true, quantity: true, loadWeightKg: true },
                    orderBy: { _sum: { subtotalAmount: 'desc' } }
                })
            ]);

            const totalKg = (kgAgg._sum.loadWeightKg || new Decimal(0)).toNumber();
            const totalLoads = kgAgg._count.id || 0;
            const totalJasa = jasaAgg._count.id || 0;

            const suppliesMap: Record<number, { itemId: number; itemName: string; unitOfMeasure: string | null; totalConsumed: Decimal; cost: Decimal }> = {};
            let supplyCost = new Decimal(0);
            for (const line of consumableLines) {
                const consumed = new Decimal(line.quantity).times(new Decimal(line.stockConsumptionQty!));
                const lineCost = line.cost || new Decimal(0);
                supplyCost = supplyCost.plus(lineCost);
                if (!suppliesMap[line.itemId]) {
                    suppliesMap[line.itemId] = { itemId: line.itemId, itemName: line.itemName, unitOfMeasure: line.unitOfMeasure, totalConsumed: new Decimal(0), cost: new Decimal(0) };
                }
                suppliesMap[line.itemId].totalConsumed = suppliesMap[line.itemId].totalConsumed.plus(consumed);
                suppliesMap[line.itemId].cost = suppliesMap[line.itemId].cost.plus(lineCost);
            }
            const suppliesConsumed = Object.values(suppliesMap)
                .map(s => ({ itemId: s.itemId, itemName: s.itemName, unitOfMeasure: s.unitOfMeasure, totalConsumed: s.totalConsumed.toNumber(), cost: s.cost.toNumber() }))
                .sort((a, b) => b.totalConsumed - a.totalConsumed);

            laundryOps = {
                totalKgProcessed: totalKg,
                totalLoads,
                totalJasa,
                averageKgPerLoad: totalLoads > 0 ? totalKg / totalLoads : 0,
                suppliesConsumed
            };

            // Attribute supply cost back to each service via its recipe (see
            // generateLaundryReport for rationale) so per-service margins reflect
            // the consumables each service actually used.
            const supplyActualCost: Record<number, Decimal> = {};
            for (const sup of Object.values(suppliesMap)) supplyActualCost[sup.itemId] = sup.cost;

            const serviceBase = serviceGroups.map(s => ({
                itemId: s.itemId,
                itemName: s.itemName,
                itemCode: s.itemCode,
                itemBrand: s.itemBrand,
                quantity: (s._sum.quantity || new Decimal(0)),
                totalKg: (s._sum.loadWeightKg || new Decimal(0)),
                revenue: (s._sum.subtotalAmount || new Decimal(0)),
            }));
            const attributedCost = await attributeServiceSupplyCost(
                tenantPrisma,
                serviceBase.map(s => ({ itemId: s.itemId, totalKg: s.totalKg, quantity: s.quantity })),
                supplyActualCost
            );
            let serviceRevenue = new Decimal(0);
            const services = serviceBase.map(s => {
                serviceRevenue = serviceRevenue.plus(s.revenue);
                const cost = attributedCost[s.itemId] || new Decimal(0);
                return {
                    itemId: s.itemId,
                    itemName: s.itemName,
                    itemCode: s.itemCode,
                    itemBrand: s.itemBrand,
                    quantity: s.quantity.toNumber(),
                    loads: s.quantity.toNumber(),
                    totalKg: s.totalKg.toNumber(),
                    revenue: s.revenue.toNumber(),
                    cost: cost.toNumber(),
                    profit: s.revenue.minus(cost).toNumber(),
                };
            });
            const netProfit = serviceRevenue.minus(supplyCost);
            laundryProfit = {
                serviceRevenue: serviceRevenue.toNumber(),
                supplyCost: supplyCost.toNumber(),
                netProfit: netProfit.toNumber(),
                margin: serviceRevenue.gt(0) ? netProfit.dividedBy(serviceRevenue).times(100).toNumber() : 0,
                services
            };
        }

        // Per-terminal breakdown — which terminal rang the outlet's completed sales
        // over the report range. Groups by siteId across ALL sessions/terminals in
        // the outlet (this is the outlet-wide, cross-session report). Null siteId =
        // unattributed. See generateReport for the per-session variant.
        const terminalGroups = await tenantPrisma.sales.groupBy({
            by: ['siteId'],
            where: { ...outletFilter, status: "Completed", deleted: false },
            _count: { id: true },
            _sum: { totalAmount: true, paidAmount: true, profitAmount: true }
        });
        const terminalBreakdown = terminalGroups
            .map(g => ({
                siteId: g.siteId ?? null,
                salesCount: g._count?.id || 0,
                totalAmount: (g._sum?.totalAmount || new Decimal(0)).toNumber(),
                paidAmount: (g._sum?.paidAmount || new Decimal(0)).toNumber(),
                profitAmount: (g._sum?.profitAmount || new Decimal(0)).toNumber(),
            }))
            .sort((a, b) => (a.siteId ?? 0) - (b.siteId ?? 0));

        // Prepare response object
        const payload = {
            // Laundry operations block (null for non-laundry accounts)
            laundryOps,

            // Laundry profit breakdown (null for non-laundry accounts)
            laundryProfit,

            // Per-terminal attribution across the outlet's sessions (empty when single-terminal)
            terminalBreakdown,

            // Overall metrics
            totalRevenue: netRevenue.toNumber(),
            grossRevenue: grossRevenue.toNumber(),
            returnRefundImpact: returnRefundImpact.toNumber(),
            totalProfit: totalProfit.toNumber(),
            totalCogs: netRevenue.minus(totalProfit).toNumber(), // Revenue − Profit = Cost of Goods Sold
            grossMargin: netRevenue.gt(0) ? totalProfit.dividedBy(netRevenue).times(100).toNumber() : 0,
            totalProfitGains: totalGains.toNumber(), // Sum of all positive profits
            totalProfitLosses: totalLosses.toNumber(), // Sum of all negative profits (will be negative)
            averageTransactionValue: averageTransactionValue.toNumber(),
            totalPaidAmount: (completedSales._sum?.paidAmount || new Decimal(0)).toNumber(),
            changeGiven: (completedSales._sum?.changeAmount || new Decimal(0)).toNumber(),
            voidedSalesCount: voidedSales._count?.id || 0,
            voidedSalesAmount: (voidedSales._sum?.totalAmount || new Decimal(0)).toNumber(),

            // Sales breakdown by status
            completedSales: {
                count: totalCompletedSalesCount,
                totalAmount: totalCompletedRevenue.toNumber(),
                paidAmount: (completedSales._sum?.paidAmount || new Decimal(0)).toNumber(),
                profit: totalProfit.toNumber(),
                profitGains: totalGains.toNumber(),
                profitLosses: totalLosses.toNumber(),
                changeGiven: (completedSales._sum?.changeAmount || new Decimal(0)).toNumber()
            },

            partiallyPaidSales: {
                count: partiallyPaidSales._count?.id || 0,
                totalAmount: (partiallyPaidSales._sum?.totalAmount || new Decimal(0)).toNumber(),
                paidAmount: (partiallyPaidSales._sum?.paidAmount || new Decimal(0)).toNumber(),
                outstandingAmount: totalOutstandingAmount.toNumber(),
                profit: partiallyPaidTotalProfit.toNumber(),
                profitGains: partiallyPaidGains.toNumber(),
                profitLosses: partiallyPaidLosses.toNumber(),
                averageOutstandingPerTransaction: averageOutstandingPerTransaction.toNumber(),
                paymentCoverageRatio: Math.round(paymentCoverageRatio.toNumber() * 100) / 100,
                details: partiallyPaidSalesDetails.map(sale => ({
                    salesId: sale.id,
                    totalAmount: sale.totalAmount.toNumber(),
                    paidAmount: sale.paidAmount.toNumber(),
                    outstandingAmount: sale.totalAmount.minus(sale.paidAmount).toNumber(),
                    customerName: sale.customerName || 'Guest',
                    phoneNumber: sale.phoneNumber || '',
                    businessDate: sale.businessDate
                }))
            },

            returnedSales: {
                count: returnedSales._count?.id || 0,
                totalAmount: (returnedSales._sum?.totalAmount || new Decimal(0)).toNumber(),
                paidAmount: (returnedSales._sum?.paidAmount || new Decimal(0)).toNumber(),
                profitImpact: returnedProfit.toNumber(), // Original profit amount (can be positive or negative)
                lostProfit: returnedProfitLoss.toNumber(), // Profit lost from profitable sales
                recoveredLoss: returnedLossRecovery.toNumber(), // Loss recovered from loss-making sales
                details: returnedSalesDetails.map(sale => ({
                    salesId: sale.id,
                    totalAmount: sale.totalAmount.toNumber(),
                    paidAmount: sale.paidAmount.toNumber(),
                    customerName: sale.customerName || 'Guest',
                    phoneNumber: sale.phoneNumber || '',
                    businessDate: sale.businessDate,
                    remark: sale.remark || ''
                }))
            },

            refundedSales: {
                count: refundedSales._count?.id || 0,
                totalAmount: (refundedSales._sum?.totalAmount || new Decimal(0)).toNumber(),
                paidAmount: (refundedSales._sum?.paidAmount || new Decimal(0)).toNumber(),
                profitImpact: refundedProfit.toNumber(), // Original profit amount (can be positive or negative)
                lostProfit: refundedProfitLoss.toNumber(), // Profit lost from profitable sales
                recoveredLoss: refundedLossRecovery.toNumber(), // Loss recovered from loss-making sales
                details: refundedSalesDetails.map(sale => ({
                    salesId: sale.id,
                    totalAmount: sale.totalAmount.toNumber(),
                    paidAmount: sale.paidAmount.toNumber(),
                    customerName: sale.customerName || 'Guest',
                    phoneNumber: sale.phoneNumber || '',
                    businessDate: sale.businessDate,
                    remark: sale.remark || ''
                }))
            },

            voidedSales: {
                count: voidedSales._count?.id || 0,
                totalAmount: (voidedSales._sum?.totalAmount || new Decimal(0)).toNumber(),
                paidAmount: (voidedSales._sum?.paidAmount || new Decimal(0)).toNumber(),
                details: voidedSalesDetails.map(sale => ({
                    salesId: sale.id,
                    totalAmount: sale.totalAmount.toNumber(),
                    paidAmount: sale.paidAmount.toNumber(),
                    customerName: sale.customerName || 'Guest',
                    phoneNumber: sale.phoneNumber || '',
                    businessDate: sale.businessDate,
                    remark: sale.remark || ''
                }))
            },

            // Delivered sales info
            deliveredSales: {
                count: deliveredSales._count?.id || 0,
                totalAmount: (deliveredSales._sum?.totalAmount || new Decimal(0)).toNumber(),
                paidAmount: (deliveredSales._sum?.paidAmount || new Decimal(0)).toNumber(),
                profit: deliveredTotalProfit.toNumber(),
                profitGains: deliveredGains.toNumber(),
                profitLosses: deliveredLosses.toNumber(),
                changeGiven: (deliveredSales._sum?.changeAmount || new Decimal(0)).toNumber(),
                details: deliveredSalesDetails.map(sale => ({
                    salesId: sale.id,
                    totalAmount: sale.totalAmount.toNumber(),
                    paidAmount: sale.paidAmount.toNumber(),
                    customerName: sale.customerName || 'Guest',
                    phoneNumber: sale.phoneNumber || '',
                    businessDate: sale.businessDate,
                    remark: sale.remark || ''
                }))
            },

            topSellingItems: topSellingItems.map(item => ({
                itemId: item.itemId,
                itemName: item.itemName,
                itemCode: item.itemCode,
                itemBrand: item.itemBrand,
                quantitySold: (item._sum.quantity || new Decimal(0)).toNumber(),
                revenue: (item._sum.subtotalAmount || new Decimal(0)).toNumber()
            })),

            topSellingCategories: topSellingCategories.map(category => ({
                categoryName: category.categoryName,
                quantitySold: category.quantitySold.toNumber(),
                revenue: category.revenue.toNumber()
            })),

            mostProfitableItems: mostProfitableItems.map(item => {
                const revenue = (item._sum.subtotalAmount || new Decimal(0)).toNumber();
                const cost = (item._sum.cost || new Decimal(0)).toNumber();
                const profit = (item._sum.profit || new Decimal(0)).toNumber();
                return {
                    itemId: item.itemId,
                    itemName: item.itemName,
                    itemCode: item.itemCode,
                    itemBrand: item.itemBrand,
                    profit,
                    revenue,
                    cost,
                    quantity: (item._sum.quantity || new Decimal(0)).toNumber(),
                    margin: revenue > 0 ? (profit / revenue) * 100 : 0
                };
            }),

            mostLossItems: mostLossItems.map(item => {
                const revenue = (item._sum.subtotalAmount || new Decimal(0)).toNumber();
                const cost = (item._sum.cost || new Decimal(0)).toNumber();
                const profit = (item._sum.profit || new Decimal(0)).toNumber(); // Will be negative
                return {
                    itemId: item.itemId,
                    itemName: item.itemName,
                    itemCode: item.itemCode,
                    itemBrand: item.itemBrand,
                    loss: profit,
                    revenue,
                    cost,
                    quantity: (item._sum.quantity || new Decimal(0)).toNumber(),
                    margin: revenue > 0 ? (profit / revenue) * 100 : 0
                };
            }),

            paymentBreakdown: paymentBreakdown.map(payment => ({
                method: payment.method,
                amount: (payment._sum.paidAmount || new Decimal(0)).toNumber()
            })),

            stockBalance,

            // Today's operations (live request-day snapshot — see fetchTodayOps)
            ...todayOps,

            // Sales array
            sales: allSales.map(sale => ({
                id: sale.id,
                businessDate: sale.businessDate,
                salesType: sale.salesType,
                customerName: sale.customerName || 'Guest',
                phoneNumber: sale.phoneNumber || '',
                // Street address of the sale (delivery/customer street). Prod data
                // shows tenants fill SHIP_STREET only (bill_* unused) — verified
                // against audio_technic_db 2026-06-09: 5,496/6,136 rows.
                shipStreet: sale.shipStreet || '',
                subtotalAmount: sale.subtotalAmount.toNumber(),
                taxAmount: sale.taxAmount.toNumber(),
                // Every discount applied BELOW the subtotal (sale-level + tier/
                // voucher [mutually exclusive] + subscription + points redemption).
                // Reconciles the report: subtotal − totalDiscountAmount (+ charges,
                // + tax if exclusive) = totalAmount. Item-level discounts are NOT
                // included — subtotal is already net of them.
                totalDiscountAmount: (sale.discountAmount || new Decimal(0))
                    .plus(sale.loyaltyTierDiscountAmount || 0)
                    .plus(sale.voucherDiscountAmount || 0)
                    .plus(sale.subscriptionDiscountAmount || 0)
                    .plus(sale.loyaltyPointsRedemptionValue || 0)
                    .toNumber(),
                totalAmount: sale.totalAmount.toNumber(),
                paidAmount: sale.paidAmount.toNumber(),
                profitAmount: sale.profitAmount.toNumber(),
                status: sale.status,
                remark: sale.remark || '',
                isTaxInclusive: true,
                salesItems: sale.salesItems.map(item => ({
                    id: item.id,
                    itemName: item.itemName,
                    itemModel: item.itemModel,
                    cost: item.cost.toNumber(),
                    quantity: item.quantity.toNumber(),
                    discountAmount: item.discountAmount.toNumber(),
                    taxAmount: item.taxAmount.toNumber(),
                    subtotalAmount: item.subtotalAmount.toNumber()
                }))
            }))
        };

        // Store closed-period reports for fingerprint-validated reuse. The
        // fingerprint was computed before the build, so a write racing the build
        // at worst invalidates early (rebuild next request) — never serves stale.
        if (cacheKey && fingerprint) {
            setOutletReportCacheEntry(cacheKey, {
                fingerprint,
                payload,
                soldQty,
                lastAccessed: Date.now(),
            });
        }

        return payload;
    }
    catch (error) {
        throw error;
    }
}

/**
 * Lean session report for Laundry accounts.
 *
 * Laundry shifts don't deal in product/category rankings, stock depletion,
 * procurement (PO/DO/invoices), or the full sales-status spread (returned /
 * refunded / voided / partially-paid / delivered breakdowns). Surfacing those
 * is noise for a wash-and-fold operator. This endpoint runs ONLY the queries
 * that back the sections a laundry shift actually cares about:
 *
 *   - Session info (the shift envelope)
 *   - Headline metrics: revenue, profit, average order value
 *   - Laundry operations: total KG processed, loads, per-supply consumption
 *   - Payment section: total paid, change given, payment-method breakdown
 *   - Per-order transactions list (the actual wash orders)
 *
 * Every other field in the shared SessionReport shape is intentionally omitted;
 * the frontend `SessionReportDO.fromMap` defaults them to empty/zero so the lean
 * payload stays backwards-compatible without a bespoke model. The frontend hides
 * the corresponding sections for laundry tenants (see session_report_sheet.dart
 * and pdf_generator.dart).
 */
/**
 * Attribute pooled supply (consumable) cost back to the services that consumed
 * it, using each service's recipe (ItemConsumable). Without this every laundry
 * service shows ~100% margin, because consumable COGS sits on separate sales
 * lines, not on the service line. Each supply's actual cost is split across the
 * services whose recipe references it, proportional to recipe-expected usage
 * (ratePerKg × kg for 'perKg' basis, × loads/quantity for 'perLoad').
 *
 * Caveat: uses the CURRENT recipe — if a recipe changed after the sale the split
 * shifts. The section-level supplyCost stays exact (it sums snapshotted line
 * costs); only the per-service split is recomputed. A supply with no matching
 * recipe (e.g. recipe later removed) stays unattributed — its cost remains in
 * the section total but is not pushed onto any service.
 *
 * @returns serviceItemId → attributed supply cost (Decimal)
 */
async function attributeServiceSupplyCost(
    tenantPrisma: PrismaClient,
    services: { itemId: number; totalKg: Decimal; quantity: Decimal }[],
    supplyActualCost: Record<number, Decimal>
): Promise<Record<number, Decimal>> {
    const result: Record<number, Decimal> = {};
    for (const s of services) result[s.itemId] = new Decimal(0);
    const serviceIds = services.map(s => s.itemId);
    if (serviceIds.length === 0) return result;

    const recipes = await tenantPrisma.itemConsumable.findMany({
        where: { serviceItemId: { in: serviceIds }, deleted: false },
        select: { serviceItemId: true, consumableItemId: true, ratePerKg: true, consumptionBasis: true }
    });
    const svcById: Record<number, { totalKg: Decimal; quantity: Decimal }> = {};
    for (const s of services) svcById[s.itemId] = { totalKg: s.totalKg, quantity: s.quantity };

    // Per supply: the (service, recipe-expected-usage weight) it was used by.
    const perSupply: Record<number, { serviceId: number; weight: Decimal }[]> = {};
    for (const r of recipes) {
        const svc = svcById[r.serviceItemId];
        if (!svc) continue;
        const basisQty = r.consumptionBasis === 'perLoad' ? svc.quantity : svc.totalKg;
        const weight = new Decimal(r.ratePerKg).times(basisQty);
        if (weight.lte(0)) continue;
        if (!perSupply[r.consumableItemId]) perSupply[r.consumableItemId] = [];
        perSupply[r.consumableItemId].push({ serviceId: r.serviceItemId, weight });
    }

    for (const supplyIdStr of Object.keys(perSupply)) {
        const supplyId = Number(supplyIdStr);
        const actual = supplyActualCost[supplyId];
        if (!actual || actual.lte(0)) continue;
        const entries = perSupply[supplyId];
        const totalWeight = entries.reduce((a, e) => a.plus(e.weight), new Decimal(0));
        if (totalWeight.lte(0)) continue;
        for (const e of entries) {
            result[e.serviceId] = result[e.serviceId].plus(actual.times(e.weight).dividedBy(totalWeight));
        }
    }
    return result;
}

let generateLaundryReport = async (databaseName: string, sessionId: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const session = await tenantPrisma.session.findUnique({
            where: { id: sessionId }
        });

        if (!session) {
            throw new NotFoundError('Session');
        }

        const sessionFilter = { sessionId: sessionId };
        const completedSessionFilter = { completedSessionId: sessionId };
        const nonVoidStatuses = ["Completed", "Partially Paid", "Delivered", "Returned", "Refunded"];

        // Split laundry service items into wash vs jasa. A "load" (muatan) is a
        // machine wash; jasa (e.g. ironing) is counted separately. Wash items
        // carry a defaultLoadWeightKg (even 0); pure jasa items leave it null.
        const serviceItems = await tenantPrisma.item.findMany({
            where: { itemType: 'service', deleted: false },
            select: { id: true, defaultLoadWeightKg: true }
        });
        const washItemIds = serviceItems.filter(i => i.defaultLoadWeightKg !== null).map(i => i.id);
        const jasaItemIds = serviceItems.filter(i => i.defaultLoadWeightKg === null).map(i => i.id);

        const [completedSales, paymentBreakdown, allSales, kgAgg, jasaAgg, consumableLines, serviceGroups] = await Promise.all([
            // Completed sales from completedSessionId only — backs revenue / avg / paid / change
            tenantPrisma.sales.aggregate({
                where: { ...completedSessionFilter, status: "Completed", deleted: false },
                _count: { id: true },
                _sum: { totalAmount: true, paidAmount: true, profitAmount: true, changeAmount: true }
            }),

            // Payment-method breakdown across all non-voided sales.
            // `deleted: false` on the parent sale is REQUIRED — a payment row's
            // own IS_DELETED stays 0 when its sale is soft-deleted, so without
            // this filter deleted orders' payments inflate the cash total.
            tenantPrisma.payment.groupBy({
                by: ['method'],
                where: {
                    ...sessionFilter,
                    sales: { status: { in: nonVoidStatuses }, deleted: false }
                },
                _sum: { paidAmount: true }
            }),

            // All non-voided session sales — drives the per-order list, profit split, and shift count
            tenantPrisma.sales.findMany({
                where: { ...sessionFilter, deleted: false },
                select: {
                    id: true,
                    businessDate: true,
                    salesType: true,
                    customerName: true,
                    phoneNumber: true,
                    shipStreet: true,
                    subtotalAmount: true,
                    taxAmount: true,
                    discountAmount: true,
                    loyaltyTierDiscountAmount: true,
                    voucherDiscountAmount: true,
                    subscriptionDiscountAmount: true,
                    loyaltyPointsRedemptionValue: true,
                    totalAmount: true,
                    paidAmount: true,
                    profitAmount: true,
                    isTaxInclusive: true,
                    status: true,
                    remark: true,
                    completedSessionId: true,
                    salesItems: {
                        select: {
                            id: true,
                            itemName: true,
                            itemModel: true,
                            quantity: true,
                            cost: true,
                            discountAmount: true,
                            taxAmount: true,
                            subtotalAmount: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),

            // Laundry operations: total weight processed across wash loads.
            // Scoped to wash items only (washItemIds) so ironing/jasa lines —
            // which also carry loadWeightKg for per-kg pricing — are excluded
            // from the wash KG + load count.
            tenantPrisma.salesItem.aggregate({
                where: {
                    sales: { ...sessionFilter, status: { in: nonVoidStatuses }, deleted: false },
                    loadWeightKg: { not: null },
                    itemId: { in: washItemIds }
                },
                _sum: { loadWeightKg: true },
                _count: { id: true }
            }),

            // Laundry operations: jasa (non-wash service, e.g. ironing) line count —
            // the "Total Jasa" companion to the wash load count.
            tenantPrisma.salesItem.aggregate({
                where: {
                    sales: { ...sessionFilter, status: { in: nonVoidStatuses }, deleted: false },
                    itemId: { in: jasaItemIds }
                },
                _count: { id: true }
            }),

            // Laundry operations: per-supply consumption (detergent, softener, …).
            // `cost` is the per-line COGS already snapshotted at sale time — on a
            // consumable line subtotal is 0 and cost > 0, so Σ cost = total supply cost.
            tenantPrisma.salesItem.findMany({
                where: {
                    sales: { ...sessionFilter, status: { in: nonVoidStatuses }, deleted: false },
                    stockConsumptionQty: { not: null }
                },
                select: { itemId: true, itemName: true, unitOfMeasure: true, quantity: true, stockConsumptionQty: true, cost: true }
            }),

            // Laundry profit: per-service revenue/profit. Service (wash/jasa) lines
            // carry loadWeightKg (non-null); their subtotal is the revenue and their
            // cost is 0 (the COGS lives on the consumable lines above).
            tenantPrisma.salesItem.groupBy({
                by: ['itemId', 'itemName', 'itemCode', 'itemBrand'],
                where: {
                    sales: { ...completedSessionFilter, status: "Completed", deleted: false },
                    loadWeightKg: { not: null }
                },
                _sum: { subtotalAmount: true, profit: true, quantity: true, loadWeightKg: true },
                orderBy: { _sum: { subtotalAmount: 'desc' } }
            })
        ]);

        // ── Headline metrics (completed sales only, mirroring generateReport) ──
        const totalCompletedSalesCount = completedSales._count.id || 0;
        const totalCompletedRevenue = completedSales._sum?.totalAmount || new Decimal(0);
        const averageTransactionValue = totalCompletedSalesCount > 0
            ? totalCompletedRevenue.dividedBy(totalCompletedSalesCount)
            : new Decimal(0);

        // Split completed-sale profit into gains/losses (in memory, same as generateReport)
        let totalGains = new Decimal(0);
        let totalLosses = new Decimal(0);
        allSales
            .filter(sale => sale.completedSessionId === sessionId && sale.status === "Completed")
            .forEach(sale => {
                if (sale.profitAmount.gt(0)) totalGains = totalGains.plus(sale.profitAmount);
                else if (sale.profitAmount.lt(0)) totalLosses = totalLosses.plus(sale.profitAmount);
            });
        const totalProfit = totalGains.plus(totalLosses);

        const sessionSalesCount = allSales.filter(sale => nonVoidStatuses.includes(sale.status)).length;

        // ── Laundry operations block ──
        const totalKg = (kgAgg._sum.loadWeightKg || new Decimal(0)).toNumber();
        const totalLoads = kgAgg._count.id || 0;
        const totalJasa = jasaAgg._count.id || 0;
        const suppliesMap: Record<number, { itemId: number; itemName: string; unitOfMeasure: string | null; totalConsumed: Decimal; cost: Decimal }> = {};
        let supplyCost = new Decimal(0);
        for (const line of consumableLines) {
            const consumed = new Decimal(line.quantity).times(new Decimal(line.stockConsumptionQty!));
            const lineCost = line.cost || new Decimal(0);
            supplyCost = supplyCost.plus(lineCost);
            if (!suppliesMap[line.itemId]) {
                suppliesMap[line.itemId] = { itemId: line.itemId, itemName: line.itemName, unitOfMeasure: line.unitOfMeasure, totalConsumed: new Decimal(0), cost: new Decimal(0) };
            }
            suppliesMap[line.itemId].totalConsumed = suppliesMap[line.itemId].totalConsumed.plus(consumed);
            suppliesMap[line.itemId].cost = suppliesMap[line.itemId].cost.plus(lineCost);
        }
        const suppliesConsumed = Object.values(suppliesMap)
            .map(s => ({ itemId: s.itemId, itemName: s.itemName, unitOfMeasure: s.unitOfMeasure, totalConsumed: s.totalConsumed.toNumber(), cost: s.cost.toNumber() }))
            .sort((a, b) => b.totalConsumed - a.totalConsumed);

        // ── Laundry profit breakdown: where the profit comes from ──
        // Service revenue (wash/jasa lines) − supply cost (consumables) = net profit.
        // Supply cost is attributed back to each service via its recipe so a
        // per-service margin reflects the consumables that service actually used
        // (e.g. a wash with detergent is < 100%, an ironing service is 100%).
        const supplyActualCost: Record<number, Decimal> = {};
        for (const sup of Object.values(suppliesMap)) supplyActualCost[sup.itemId] = sup.cost;

        const serviceBase = serviceGroups.map(s => ({
            itemId: s.itemId,
            itemName: s.itemName,
            itemCode: s.itemCode,
            itemBrand: s.itemBrand,
            quantity: (s._sum.quantity || new Decimal(0)),
            totalKg: (s._sum.loadWeightKg || new Decimal(0)),
            revenue: (s._sum.subtotalAmount || new Decimal(0)),
        }));
        const attributedCost = await attributeServiceSupplyCost(
            tenantPrisma,
            serviceBase.map(s => ({ itemId: s.itemId, totalKg: s.totalKg, quantity: s.quantity })),
            supplyActualCost
        );
        let serviceRevenue = new Decimal(0);
        const services = serviceBase.map(s => {
            serviceRevenue = serviceRevenue.plus(s.revenue);
            const cost = attributedCost[s.itemId] || new Decimal(0);
            return {
                itemId: s.itemId,
                itemName: s.itemName,
                itemCode: s.itemCode,
                itemBrand: s.itemBrand,
                quantity: s.quantity.toNumber(),
                loads: s.quantity.toNumber(),
                totalKg: s.totalKg.toNumber(),
                revenue: s.revenue.toNumber(),
                cost: cost.toNumber(),
                profit: s.revenue.minus(cost).toNumber(),
            };
        });
        const netProfit = serviceRevenue.minus(supplyCost);
        const laundryProfit = {
            serviceRevenue: serviceRevenue.toNumber(),
            supplyCost: supplyCost.toNumber(),
            netProfit: netProfit.toNumber(),
            margin: serviceRevenue.gt(0) ? netProfit.dividedBy(serviceRevenue).times(100).toNumber() : 0,
            services
        };

        // Per-terminal breakdown — same shape as generateReport (see there for rationale).
        const terminalGroups = await tenantPrisma.sales.groupBy({
            by: ['siteId'],
            where: { ...completedSessionFilter, status: "Completed", deleted: false },
            _count: { id: true },
            _sum: { totalAmount: true, paidAmount: true, profitAmount: true }
        });
        const terminalBreakdown = terminalGroups
            .map(g => ({
                siteId: g.siteId ?? null,
                salesCount: g._count?.id || 0,
                totalAmount: (g._sum?.totalAmount || new Decimal(0)).toNumber(),
                paidAmount: (g._sum?.paidAmount || new Decimal(0)).toNumber(),
                profitAmount: (g._sum?.profitAmount || new Decimal(0)).toNumber(),
            }))
            .sort((a, b) => (a.siteId ?? 0) - (b.siteId ?? 0));

        return {
            laundryOps: {
                totalKgProcessed: totalKg,
                totalLoads,
                totalJasa,
                averageKgPerLoad: totalLoads > 0 ? totalKg / totalLoads : 0,
                suppliesConsumed
            },

            // Where the profit comes from: service revenue − supply cost = net profit
            laundryProfit,

            // Per-terminal attribution (empty when single-terminal / unattributed)
            terminalBreakdown,

            // Headline metrics
            totalRevenue: totalCompletedRevenue.toNumber(),
            grossRevenue: totalCompletedRevenue.toNumber(),
            returnRefundImpact: 0,
            totalProfit: totalProfit.toNumber(),
            totalProfitGains: totalGains.toNumber(),
            totalProfitLosses: totalLosses.toNumber(),
            averageTransactionValue: averageTransactionValue.toNumber(),
            totalPaidAmount: (completedSales._sum?.paidAmount || new Decimal(0)).toNumber(),
            changeGiven: (completedSales._sum?.changeAmount || new Decimal(0)).toNumber(),
            voidedSalesCount: 0,
            voidedSalesAmount: 0,

            completedSales: {
                count: totalCompletedSalesCount,
                totalAmount: totalCompletedRevenue.toNumber(),
                paidAmount: (completedSales._sum?.paidAmount || new Decimal(0)).toNumber(),
                profit: totalProfit.toNumber(),
                profitGains: totalGains.toNumber(),
                profitLosses: totalLosses.toNumber(),
                changeGiven: (completedSales._sum?.changeAmount || new Decimal(0)).toNumber()
            },

            sessionInfo: {
                id: session.id,
                outletId: session.outletId,
                businessDate: session.businessDate,
                openingDateTime: session.openingDateTime,
                closingDateTime: session.closingDateTime,
                openingAmount: session.openingAmount.toNumber(),
                totalSalesCount: sessionSalesCount,
                openByUserID: session.openByUserID,
                closeByUserID: session.closeByUserID
            },

            paymentBreakdown: paymentBreakdown.map(payment => ({
                method: payment.method,
                amount: (payment._sum.paidAmount || new Decimal(0)).toNumber()
            })),

            // Per-order transactions list (the actual wash orders)
            sales: allSales.map(sale => ({
                id: sale.id,
                businessDate: sale.businessDate,
                salesType: sale.salesType,
                customerName: sale.customerName || 'Guest',
                phoneNumber: sale.phoneNumber || '',
                // Same per-sale address/amount fields as the full reports — the
                // shared PDF per-order card prints them (address is genuinely
                // useful on laundry orders).
                shipStreet: sale.shipStreet || '',
                subtotalAmount: sale.subtotalAmount.toNumber(),
                taxAmount: sale.taxAmount.toNumber(),
                // Every discount applied BELOW the subtotal (sale-level + tier/
                // voucher [mutually exclusive] + subscription + points redemption).
                // Reconciles the report: subtotal − totalDiscountAmount (+ charges,
                // + tax if exclusive) = totalAmount. Item-level discounts are NOT
                // included — subtotal is already net of them.
                totalDiscountAmount: (sale.discountAmount || new Decimal(0))
                    .plus(sale.loyaltyTierDiscountAmount || 0)
                    .plus(sale.voucherDiscountAmount || 0)
                    .plus(sale.subscriptionDiscountAmount || 0)
                    .plus(sale.loyaltyPointsRedemptionValue || 0)
                    .toNumber(),
                totalAmount: sale.totalAmount.toNumber(),
                paidAmount: sale.paidAmount.toNumber(),
                profitAmount: sale.profitAmount.toNumber(),
                isTaxInclusive: true,
                status: sale.status,
                remark: sale.remark || '',
                salesItems: sale.salesItems.map(item => ({
                    id: item.id,
                    itemName: item.itemName,
                    itemModel: item.itemModel,
                    cost: item.cost.toNumber(),
                    quantity: item.quantity.toNumber(),
                    discountAmount: item.discountAmount.toNumber(),
                    taxAmount: item.taxAmount.toNumber(),
                    subtotalAmount: item.subtotalAmount.toNumber()
                }))
            }))
        };
    }
    catch (error) {
        throw error;
    }
}

export = { generateReport, generateOutletReport, generateLaundryReport, getOutletReportCacheStats }