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

        // Run all queries concurrently for better performance
        const [
            voidedSales,
            topSellingItems,
            mostProfitableItems,
            salesSummary,
            paymentBreakdown,
            salesItems
        ] = await Promise.all([
            // Previous queries remain unchanged...
            tenantPrisma.sales.aggregate({
                where: {
                    ...sessionFilter,
                    status: "Voided"
                },
                _count: { id: true },
                _sum: { totalAmount: true }
            }),

            tenantPrisma.salesItem.groupBy({
                by: ['itemId', 'itemName', 'itemCode'],
                where: {
                    sales: {
                        ...sessionFilter,
                        status: { not: "Voided" }
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

            tenantPrisma.salesItem.groupBy({
                by: ['itemId', 'itemName', 'itemCode'],
                where: {
                    sales: {
                        ...sessionFilter,
                        status: { not: "Voided" }
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

            tenantPrisma.sales.aggregate({
                where: {
                    ...sessionFilter,
                    deleted: false,
                    status: { not: "Voided" }
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

            tenantPrisma.payment.groupBy({
                by: ['method'],
                where: {
                    ...sessionFilter,
                    sales: {
                        status: { not: "Voided" }
                    }
                },
                _sum: {
                    paidAmount: true
                }
            }),

            // Get all distinct items sold in this session
            tenantPrisma.salesItem.findMany({
                where: {
                    sales: {
                        ...sessionFilter,
                        status: { not: "Voided" }
                    }
                },
                select: {
                    itemId: true,
                    quantity: true,
                    subtotalAmount: true
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

        // Calculate session sales count
        const sessionSalesCount = await tenantPrisma.sales.count({
            where: {
                ...sessionFilter,
                status: { not: "Voided" }
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
                        itemCode: true
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

        // Calculate average transaction value
        const averageTransactionValue = salesSummary._count.id > 0
            ? (salesSummary._sum.totalAmount ?? 0) / salesSummary._count.id
            : 0;

        // Prepare response object
        return {
            totalRevenue: salesSummary._sum?.totalAmount || 0,
            totalProfit: salesSummary._sum?.profitAmount || 0,
            averageTransactionValue,
            totalPaidAmount: salesSummary._sum?.paidAmount || 0,
            changeGiven: salesSummary._sum?.changeAmount || 0,
            voidedSalesCount: voidedSales._count?.id || 0,
            voidedSalesAmount: voidedSales._sum?.totalAmount || 0,

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
                quantitySold: item._sum.quantity || 0,
                revenue: item._sum.subtotalAmount || 0
            })),

            topSellingCategories,

            mostProfitableItems: mostProfitableItems.map(item => ({
                itemId: item.itemId,
                itemName: item.itemName,
                itemCode: item.itemCode,
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
                quantitySold: itemQuantitiesSold[stock.item.id] || 0,
                availableQuantity: stock.availableQuantity,
                status: stock.availableQuantity <= 0 ? 'Out of Stock' :
                    (stock.reorderThreshold && stock.availableQuantity <= stock.reorderThreshold) ? 'Low Stock' : 'In Stock'
            }))
        };
    }
    catch (error) {
        throw error;
    }
}

export = { generateReport }