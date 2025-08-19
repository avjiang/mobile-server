import { PrismaClient, Supplier } from "../../prisma/client/generated/client"
import { Decimal } from 'decimal.js';
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { plainToInstance } from "class-transformer"
import { getTenantPrisma } from '../db';

let generateReport = async (databaseName: string, sessionId: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // First check if session exists
        const session = await tenantPrisma.session.findUnique({
            where: { id: sessionId }
        });

        if (!session) {
            throw new NotFoundError('Session');
        }

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
            topSellingItems,
            mostProfitableItems,
            salesSummary,
            paymentBreakdown,
            salesItems,
            todayPurchaseOrders,
            todayDeliveryOrders,
            todayInvoices
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

            // Include all non-voided sales for top selling items (not just completed)
            tenantPrisma.salesItem.groupBy({
                by: ['itemId', 'itemName', 'itemCode', 'itemBrand'],
                where: {
                    sales: {
                        ...sessionFilter,
                        status: { in: ["Completed", "Partially Paid", "Returned", "Refunded"] }
                    }
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
                    }
                },
                _sum: {
                    profit: true
                },
                orderBy: {
                    _sum: {
                        profit: 'desc'
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

            // Include payments from all non-voided sales
            tenantPrisma.payment.groupBy({
                by: ['method'],
                where: {
                    ...sessionFilter,
                    sales: {
                        status: { in: ["Completed", "Partially Paid", "Returned", "Refunded"] }
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
                        status: { in: ["Completed", "Partially Paid", "Returned", "Refunded"] }
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
            })
        ]);

        // Get detailed returned sales information
        const returnedSalesDetails = await tenantPrisma.sales.findMany({
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
        });

        // Get detailed refunded sales information
        const refundedSalesDetails = await tenantPrisma.sales.findMany({
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
        });

        // Get detailed partially paid sales information
        const partiallyPaidSalesDetails = await tenantPrisma.sales.findMany({
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
        });

        // Get detailed voided sales information
        const voidedSalesDetails = await tenantPrisma.sales.findMany({
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
        });

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

        // Process each sales item and aggregate by category
        salesItems.forEach(salesItem => {
            const item = itemsWithCategories.find(i => i.id === salesItem.itemId);
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

        // Calculate session sales count (all non-voided)
        const sessionSalesCount = await tenantPrisma.sales.count({
            where: {
                ...sessionFilter,
                status: { in: ["Completed", "Partially Paid", "Returned", "Refunded"] }
            }
        });

        // Get the list of unique item IDs sold in this session for stock balance (from all non-voided sales)
        const uniqueSoldItemIds = [...new Set(salesItems.map(item => item.itemId))];

        // Now get stock information ONLY for items that were sold in this session
        const stockBalanceItems = await tenantPrisma.stockBalance.findMany({
            where: {
                deleted: false,
                outletId: session.outletId,
                itemId: {
                    in: uniqueSoldItemIds
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
        const totalProfit = completedSales._sum?.profitAmount || new Decimal(0);
        const grossRevenue = salesSummary._sum?.totalAmount || new Decimal(0);
        const returnRefundImpact = (returnedSales._sum?.totalAmount || new Decimal(0)).plus(refundedSales._sum?.totalAmount || new Decimal(0));

        // Prepare response object
        return {
            // Overall metrics (only from completed sales)
            totalRevenue: netRevenue.toNumber(),
            grossRevenue: grossRevenue.toNumber(),
            returnRefundImpact: returnRefundImpact.toNumber(),
            totalProfit: totalProfit.toNumber(),
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
                changeGiven: (completedSales._sum?.changeAmount || new Decimal(0)).toNumber()
            },

            // Partially paid sales info
            partiallyPaidSales: {
                count: partiallyPaidSales._count?.id || 0,
                totalAmount: (partiallyPaidSales._sum?.totalAmount || new Decimal(0)).toNumber(),
                paidAmount: (partiallyPaidSales._sum?.paidAmount || new Decimal(0)).toNumber(),
                outstandingAmount: totalOutstandingAmount.toNumber(),
                profit: (partiallyPaidSales._sum?.profitAmount || new Decimal(0)).toNumber(),
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
                lostProfit: (returnedSales._sum?.profitAmount || new Decimal(0)).toNumber(),
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
                lostProfit: (refundedSales._sum?.profitAmount || new Decimal(0)).toNumber(),
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

            mostProfitableItems: mostProfitableItems.map(item => ({
                itemId: item.itemId,
                itemName: item.itemName,
                itemCode: item.itemCode,
                itemBrand: item.itemBrand,
                profit: (item._sum.profit || new Decimal(0)).toNumber()
            })),

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
        };
    }
    catch (error) {
        throw error;
    }
}

let generateOutletReport = async (databaseName: string, outletId: number, startDate?: Date, endDate?: Date) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // First check if outlet exists
        const outlet = await tenantPrisma.outlet.findUnique({
            where: { id: outletId }
        });

        if (!outlet) {
            throw new NotFoundError('Outlet');
        }

        // Date filtering - default to all time if not provided
        const dateFilter = startDate && endDate ? {
            createdAt: {
                gte: startDate,
                lte: endDate
            }
        } : {};

        // All queries will filter by this outlet ID
        const outletFilter = { outletId: outletId, ...dateFilter };

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
            topSellingItems,
            mostProfitableItems,
            salesSummary,
            paymentBreakdown,
            salesItems,
            todayPurchaseOrders,
            todayDeliveryOrders,
            todayInvoices
        ] = await Promise.all([
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

            // Include all non-voided sales for top selling items
            tenantPrisma.salesItem.groupBy({
                by: ['itemId', 'itemName', 'itemCode', 'itemBrand'],
                where: {
                    sales: {
                        ...outletFilter,
                        status: { in: ["Completed", "Partially Paid", "Returned", "Refunded"] }
                    }
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
                    }
                },
                _sum: {
                    profit: true
                },
                orderBy: {
                    _sum: {
                        profit: 'desc'
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

            // Payment breakdown from all non-voided sales
            tenantPrisma.payment.groupBy({
                by: ['method'],
                where: {
                    ...outletFilter,
                    sales: {
                        status: { in: ["Completed", "Partially Paid", "Returned", "Refunded"] }
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
                        status: { in: ["Completed", "Partially Paid", "Returned", "Refunded"] }
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
                    outletId: outletId,
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
                    outletId: outletId,
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
                    outletId: outletId,
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
            })
        ]);

        // Get detailed sales information for each status
        const [returnedSalesDetails, refundedSalesDetails, partiallyPaidSalesDetails, voidedSalesDetails] = await Promise.all([
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

        // Calculate top-selling categories
        const categorySales: Record<number, { categoryName: string, quantitySold: Decimal, revenue: Decimal }> = {};

        salesItems.forEach(salesItem => {
            const item = itemsWithCategories.find(i => i.id === salesItem.itemId);
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

        // Calculate outlet sales count (all non-voided)
        const outletSalesCount = await tenantPrisma.sales.count({
            where: {
                ...outletFilter,
                status: { in: ["Completed", "Partially Paid", "Returned", "Refunded"] }
            }
        });

        // Get stock information for items sold in this outlet
        const uniqueSoldItemIds = [...new Set(salesItems.map(item => item.itemId))];

        const stockBalanceItems = await tenantPrisma.stockBalance.findMany({
            where: {
                deleted: false,
                outletId: outletId,
                itemId: {
                    in: uniqueSoldItemIds
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
        const totalProfit = completedSales._sum?.profitAmount || new Decimal(0);
        const grossRevenue = salesSummary._sum?.totalAmount || new Decimal(0);
        const returnRefundImpact = (returnedSales._sum?.totalAmount || new Decimal(0)).plus(refundedSales._sum?.totalAmount || new Decimal(0));

        // Prepare response object
        return {
            // Overall metrics
            totalRevenue: netRevenue.toNumber(),
            grossRevenue: grossRevenue.toNumber(),
            returnRefundImpact: returnRefundImpact.toNumber(),
            totalProfit: totalProfit.toNumber(),
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
                changeGiven: (completedSales._sum?.changeAmount || new Decimal(0)).toNumber()
            },

            partiallyPaidSales: {
                count: partiallyPaidSales._count?.id || 0,
                totalAmount: (partiallyPaidSales._sum?.totalAmount || new Decimal(0)).toNumber(),
                paidAmount: (partiallyPaidSales._sum?.paidAmount || new Decimal(0)).toNumber(),
                outstandingAmount: totalOutstandingAmount.toNumber(),
                profit: (partiallyPaidSales._sum?.profitAmount || new Decimal(0)).toNumber(),
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
                lostProfit: (returnedSales._sum?.profitAmount || new Decimal(0)).toNumber(),
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
                lostProfit: (refundedSales._sum?.profitAmount || new Decimal(0)).toNumber(),
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

            mostProfitableItems: mostProfitableItems.map(item => ({
                itemId: item.itemId,
                itemName: item.itemName,
                itemCode: item.itemCode,
                itemBrand: item.itemBrand,
                profit: (item._sum.profit || new Decimal(0)).toNumber()
            })),

            paymentBreakdown: paymentBreakdown.map(payment => ({
                method: payment.method,
                amount: (payment._sum.paidAmount || new Decimal(0)).toNumber()
            })),

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

            // Today's operations
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
            },
        };
    }
    catch (error) {
        throw error;
    }
}

export = { generateReport, generateOutletReport }