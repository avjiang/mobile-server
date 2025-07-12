import { PrismaClient, Supplier } from "@prisma/client"
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

            // Only include completed sales from completedSessionId for top selling items
            tenantPrisma.salesItem.groupBy({
                by: ['itemId', 'itemName', 'itemCode', 'itemBrand'],
                where: {
                    sales: {
                        ...completedSessionFilter,
                        status: "Completed"
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

            // Get all distinct items sold from completed sales only
            tenantPrisma.salesItem.findMany({
                where: {
                    sales: {
                        ...completedSessionFilter,
                        status: "Completed"
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
                    deliveryDate: true
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
                customer: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                }
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
                customer: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                }
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
                customer: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                }
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
                customer: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                }
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

        // Create a map of sold quantities by itemId for faster lookup
        const itemQuantitiesSold: { [key: number]: number } = {};
        salesItems.forEach(item => {
            if (!itemQuantitiesSold[item.itemId]) {
                itemQuantitiesSold[item.itemId] = 0;
            }
            itemQuantitiesSold[item.itemId] += item.quantity;
        });

        // Calculate top-selling categories
        const categorySales: Record<number, { categoryName: string, quantitySold: number, revenue: number }> = {};

        // Process each sales item and aggregate by category
        salesItems.forEach(salesItem => {
            const item = itemsWithCategories.find(i => i.id === salesItem.itemId);
            if (!item) return;

            const categoryId = item.categoryId;
            const categoryName = item.category.name;

            if (!categorySales[categoryId]) {
                categorySales[categoryId] = {
                    categoryName,
                    quantitySold: 0,
                    revenue: 0
                };
            }
            categorySales[categoryId].quantitySold += salesItem.quantity;
            categorySales[categoryId].revenue += salesItem.subtotalAmount;
        });

        // Convert to array and sort by quantity
        const topSellingCategories = Object.values(categorySales)
            .sort((a, b) => b.quantitySold - a.quantitySold)
            .slice(0, 5); // Take top 5

        // Calculate session sales count (all non-voided)
        const sessionSalesCount = await tenantPrisma.sales.count({
            where: {
                ...sessionFilter,
                status: { in: ["Completed", "Partially Paid", "Returned", "Refunded"] }
            }
        });

        // Get the list of unique item IDs sold in this session for stock balance
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
        const totalOutstandingAmount = (partiallyPaidSales._sum?.totalAmount || 0) - (partiallyPaidSales._sum?.paidAmount || 0);
        const averageOutstandingPerTransaction = partiallyPaidSales._count.id > 0
            ? totalOutstandingAmount / partiallyPaidSales._count.id
            : 0;
        const paymentCoverageRatio = (partiallyPaidSales._sum?.totalAmount || 0) > 0
            ? ((partiallyPaidSales._sum?.paidAmount || 0) / (partiallyPaidSales._sum?.totalAmount || 0)) * 100
            : 0;

        // Calculate average transaction value (only from completedSessionId)
        const totalCompletedSalesCount = completedSales._count.id || 0;
        const totalCompletedRevenue = completedSales._sum?.totalAmount || 0;
        const averageTransactionValue = totalCompletedSalesCount > 0
            ? totalCompletedRevenue / totalCompletedSalesCount
            : 0;

        // Calculate net revenue and profit (only from completed sales)
        const netRevenue = totalCompletedRevenue;
        const totalProfit = completedSales._sum?.profitAmount || 0;
        const grossRevenue = salesSummary._sum?.totalAmount || 0;
        const returnRefundImpact = (returnedSales._sum?.totalAmount || 0) + (refundedSales._sum?.totalAmount || 0);

        // Prepare response object
        return {
            // Overall metrics (only from completed sales)
            totalRevenue: netRevenue,
            grossRevenue: grossRevenue,
            returnRefundImpact: returnRefundImpact,
            totalProfit: totalProfit,
            averageTransactionValue,
            totalPaidAmount: completedSales._sum?.paidAmount || 0,
            changeGiven: completedSales._sum?.changeAmount || 0,
            voidedSalesCount: voidedSales._count?.id || 0,
            voidedSalesAmount: voidedSales._sum?.totalAmount || 0,

            // Completed sales info (only from completedSessionId)
            completedSales: {
                count: totalCompletedSalesCount,
                totalAmount: totalCompletedRevenue,
                paidAmount: completedSales._sum?.paidAmount || 0,
                profit: totalProfit,
                changeGiven: completedSales._sum?.changeAmount || 0
            },

            // Partially paid sales info
            partiallyPaidSales: {
                count: partiallyPaidSales._count?.id || 0,
                totalAmount: partiallyPaidSales._sum?.totalAmount || 0,
                paidAmount: partiallyPaidSales._sum?.paidAmount || 0,
                outstandingAmount: totalOutstandingAmount,
                profit: partiallyPaidSales._sum?.profitAmount || 0,
                averageOutstandingPerTransaction,
                paymentCoverageRatio: Math.round(paymentCoverageRatio * 100) / 100,
                details: partiallyPaidSalesDetails.map(sale => ({
                    salesId: sale.id,
                    totalAmount: sale.totalAmount,
                    paidAmount: sale.paidAmount,
                    outstandingAmount: sale.totalAmount - sale.paidAmount,
                    customerName: sale.customer
                        ? `${sale.customer.firstName} ${sale.customer.lastName}`.trim()
                        : 'Guest',
                    businessDate: sale.businessDate
                }))
            },

            // Returned sales info
            returnedSales: {
                count: returnedSales._count?.id || 0,
                totalAmount: returnedSales._sum?.totalAmount || 0,
                paidAmount: returnedSales._sum?.paidAmount || 0,
                lostProfit: returnedSales._sum?.profitAmount || 0,
                details: returnedSalesDetails.map(sale => ({
                    salesId: sale.id,
                    totalAmount: sale.totalAmount,
                    paidAmount: sale.paidAmount,
                    customerName: sale.customer
                        ? `${sale.customer.firstName} ${sale.customer.lastName}`.trim()
                        : 'Guest',
                    businessDate: sale.businessDate,
                    remark: sale.remark || ''
                }))
            },

            // Refunded sales info
            refundedSales: {
                count: refundedSales._count?.id || 0,
                totalAmount: refundedSales._sum?.totalAmount || 0,
                paidAmount: refundedSales._sum?.paidAmount || 0,
                lostProfit: refundedSales._sum?.profitAmount || 0,
                details: refundedSalesDetails.map(sale => ({
                    salesId: sale.id,
                    totalAmount: sale.totalAmount,
                    paidAmount: sale.paidAmount,
                    customerName: sale.customer
                        ? `${sale.customer.firstName} ${sale.customer.lastName}`.trim()
                        : 'Guest',
                    businessDate: sale.businessDate,
                    remark: sale.remark || ''
                }))
            },

            // Voided sales info
            voidedSales: {
                count: voidedSales._count?.id || 0,
                totalAmount: voidedSales._sum?.totalAmount || 0,
                paidAmount: voidedSales._sum?.paidAmount || 0,
                details: voidedSalesDetails.map(sale => ({
                    salesId: sale.id,
                    totalAmount: sale.totalAmount,
                    paidAmount: sale.paidAmount,
                    customerName: sale.customer
                        ? `${sale.customer.firstName} ${sale.customer.lastName}`.trim()
                        : 'Guest',
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
                openingAmount: session.openingAmount,
                totalSalesCount: sessionSalesCount,
                openByUserID: session.openByUserID,
                closeByUserID: session.closeByUserID
            },

            topSellingItems: topSellingItems.map(item => ({
                itemId: item.itemId,
                itemName: item.itemName,
                itemCode: item.itemCode,
                itemBrand: item.itemBrand,
                quantitySold: item._sum.quantity || 0,
                revenue: item._sum.subtotalAmount || 0
            })),

            topSellingCategories,

            mostProfitableItems: mostProfitableItems.map(item => ({
                itemId: item.itemId,
                itemName: item.itemName,
                itemCode: item.itemCode,
                itemBrand: item.itemBrand,
                profit: item._sum.profit || 0
            })),

            paymentBreakdown: paymentBreakdown.map(payment => ({
                method: payment.method,
                amount: payment._sum.paidAmount || 0
            })),

            // Only show stock balance for items sold in this session
            stockBalance: stockBalanceItems.map(stock => ({
                itemId: stock.item.id,
                itemName: stock.item.itemName,
                itemCode: stock.item.itemCode,
                itemBrand: stock.item.itemBrand,
                quantitySold: itemQuantitiesSold[stock.item.id] || 0,
                availableQuantity: stock.availableQuantity,
                status: stock.availableQuantity <= 0 ? 'Out of Stock' :
                    (stock.reorderThreshold && stock.availableQuantity <= stock.reorderThreshold) ? 'Low Stock' : 'In Stock'
            })),

            // Today's Purchase Orders
            todayPurchaseOrders: {
                count: todayPurchaseOrders.length,
                totalAmount: todayPurchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0),
                orders: todayPurchaseOrders.map(po => ({
                    id: po.id,
                    purchaseOrderNumber: po.purchaseOrderNumber,
                    totalAmount: po.totalAmount,
                    status: po.status,
                    supplierName: po.supplier?.companyName || 'Unknown',
                    createdAt: po.createdAt
                }))
            },

            // Today's Delivery Orders
            todayDeliveryOrders: {
                count: todayDeliveryOrders.length,
                orders: todayDeliveryOrders.map(order => ({
                    id: order.id,
                    trackingNumber: order.trackingNumber,
                    status: order.status,
                    deliveryDate: order.deliveryDate,
                    createdAt: order.createdAt
                }))
            },

            // Today's Invoices
            todayInvoices: {
                count: todayInvoices.length,
                totalAmount: todayInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0),
                invoices: todayInvoices.map(invoice => ({
                    id: invoice.id,
                    invoiceNumber: invoice.invoiceNumber,
                    totalAmount: invoice.totalAmount,
                    status: invoice.status,
                    supplierName: invoice.supplier?.companyName || 'Unknown',
                    createdAt: invoice.createdAt
                }))
            },
        };
    }
    catch (error) {
        throw error;
    }
}

export = { generateReport }