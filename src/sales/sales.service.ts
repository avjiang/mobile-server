import { Payment, Prisma, PrismaClient, Sales, SalesItem, StockBalance, StockMovement } from "@prisma/client"
import { BusinessLogicError, NotFoundError } from "../api-helpers/error"
import { SalesRequestBody, SalesCreationRequest, CreateSalesRequest, CalculateSalesObject, CalculateSalesItemObject, DiscountBy, DiscountType, CalculateSalesDto } from "./sales.request"
import { getTenantPrisma } from '../db';

let getAll = async (databaseName: string, outletID: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // Get today's date with time set to start of day (00:00:00)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get tomorrow's date for the upper bound of our query
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const salesArray = await tenantPrisma.sales.findMany({
            where: {
                outletId: outletID,
                businessDate: {
                    gte: today,
                    lt: tomorrow
                },
                deleted: false
            },
            select: {
                id: true,
                businessDate: true,
                salesType: true,
                customerId: true,
                totalAmount: true,
                paidAmount: true,
                status: true,
                remark: true,
                customer: {
                    select: {
                        firstName: true,
                        lastName: true,
                    },
                },
                payments: {
                    select: {
                        method: true
                    }
                },
                salesItems: true
            }
        })
        // Transform results to include customerName
        const transformedSales = salesArray.map(sale => ({
            id: sale.id,
            businessDate: sale.businessDate,
            salesType: sale.salesType,
            customerId: sale.customerId,
            totalAmount: sale.totalAmount,
            paidAmount: sale.paidAmount,
            status: sale.status,
            remark: sale.remark,
            totalItems: sale.salesItems.length,
            paymentMethod: sale.payments[0].method,
            customerName: sale.customer
                ? `${sale.customer.firstName} ${sale.customer.lastName}`.trim()
                : 'Guest',
        }));
        return transformedSales;
    }
    catch (error) {
        throw error
    }
}

let getById = async (databaseName: string, id: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const sales = await tenantPrisma.sales.findUnique({
            where: {
                id: id
            },
            include: {
                salesItems: true,
                payments: true,
                registerLogs: true
            }
        })
        if (!sales) {
            throw new NotFoundError("Sales")
        }

        return sales
    }
    catch (error) {
        throw error
    }
}

let create = async (databaseName: string, salesBody: SalesCreationRequest) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const createdSales = await tenantPrisma.$transaction(async (tx) => {
            //calculate profit amount
            let updatedSales = performProfitCalculation(salesBody.sales)

            //separate sales & salesitem to perform update to different tables
            const sales = await tx.sales.create({
                data: {
                    outletId: updatedSales.outletId,
                    businessDate: updatedSales.businessDate,
                    salesType: updatedSales.salesType,
                    customerId: updatedSales.customerId,
                    billStreet: updatedSales.billStreet,
                    billCity: updatedSales.billCity,
                    billState: updatedSales.billState,
                    billPostalCode: updatedSales.billPostalCode,
                    billCountry: updatedSales.billCountry,
                    shipStreet: updatedSales.shipStreet,
                    shipCity: updatedSales.shipCity,
                    shipState: updatedSales.shipState,
                    shipPostalCode: updatedSales.shipPostalCode,
                    shipCountry: updatedSales.shipCountry,
                    totalItemDiscountAmount: updatedSales.totalItemDiscountAmount,
                    discountPercentage: updatedSales.discountPercentage,
                    discountAmount: updatedSales.discountAmount,
                    profitAmount: updatedSales.profitAmount,
                    serviceChargeAmount: updatedSales.serviceChargeAmount,
                    taxAmount: updatedSales.taxAmount,
                    roundingAmount: updatedSales.roundingAmount,
                    subtotalAmount: updatedSales.subtotalAmount,
                    totalAmount: updatedSales.totalAmount,
                    paidAmount: updatedSales.paidAmount,
                    changeAmount: updatedSales.changeAmount,
                    status: updatedSales.status,
                    remark: updatedSales.remark,
                    declarationSessionId: updatedSales.declarationSessionId,
                    eodId: updatedSales.eodId,
                    salesQuotationId: updatedSales.salesQuotationId,
                    performedBy: updatedSales.performedBy,
                    deleted: updatedSales.deleted,
                }
            })

            await Promise.all(updatedSales.salesItems.map(async (salesItem) => {
                return tx.salesItem.create({
                    data: {
                        salesId: sales.id,
                        itemId: salesItem.itemId,
                        itemName: salesItem.itemName,
                        itemCode: salesItem.itemCode,
                        itemBrand: salesItem.itemBrand,
                        quantity: salesItem.quantity,
                        cost: salesItem.cost,
                        price: salesItem.price,
                        profit: salesItem.profit,
                        discountPercentage: salesItem.discountPercentage,
                        discountAmount: salesItem.discountAmount,
                        serviceChargeAmount: salesItem.serviceChargeAmount,
                        taxAmount: salesItem.taxAmount,
                        subtotalAmount: salesItem.subtotalAmount,
                        remark: salesItem.remark,
                        deleted: salesItem.deleted
                    }
                })
            }))

            return sales
        })

        return getById(databaseName, createdSales.id)
    }
    catch (error) {
        throw error
    }
}

let completeNewSales = async (databaseName: string, salesBody: CreateSalesRequest, payments: Payment[]) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const result = await tenantPrisma.$transaction(async (tx) => {
            // Calculate total payment amount and validate it
            let totalSalesAmount = salesBody.totalAmount;
            let totalPaymentAmount = payments.reduce((sum, payment) => sum + payment.tenderedAmount, 0);
            if (totalPaymentAmount < totalSalesAmount) {
                throw new BusinessLogicError("Total payment amount is less than the sales grand total amount");
            }
            // Calculate profit amount for sales items
            let updatedSales = performProfitCalculation(salesBody);

            // Calculate change amount
            const changeAmount = performPaymentCalculation(totalSalesAmount, totalPaymentAmount);

            if (salesBody.customerId) {
                const customer = await tenantPrisma.customer.findUnique({
                    where: { id: salesBody.customerId },
                });
                if (!customer || customer.deleted) {
                    throw new Error(`Invalid customerId: ${salesBody.customerId}`);
                }
            }

            // Create sales record
            const createdSales = await tx.sales.create({
                data: {
                    outletId: updatedSales.outletId,
                    businessDate: updatedSales.businessDate,
                    salesType: updatedSales.salesType.replace(/\b\w/g, char => char.toUpperCase()),
                    customerId: updatedSales.customerId || null,
                    billStreet: updatedSales.billStreet,
                    billCity: updatedSales.billCity,
                    billState: updatedSales.billState,
                    billPostalCode: updatedSales.billPostalCode,
                    billCountry: updatedSales.billCountry,
                    shipStreet: updatedSales.shipStreet,
                    shipCity: updatedSales.shipCity,
                    shipState: updatedSales.shipState,
                    shipPostalCode: updatedSales.shipPostalCode,
                    shipCountry: updatedSales.shipCountry,
                    totalItemDiscountAmount: updatedSales.totalItemDiscountAmount,
                    discountPercentage: updatedSales.discountPercentage,
                    discountAmount: updatedSales.discountAmount,
                    serviceChargeAmount: updatedSales.serviceChargeAmount,
                    taxAmount: updatedSales.taxAmount,
                    roundingAmount: updatedSales.roundingAmount,
                    subtotalAmount: updatedSales.subtotalAmount,
                    totalAmount: updatedSales.totalAmount,
                    paidAmount: totalPaymentAmount,
                    changeAmount: changeAmount,
                    status: "Completed",
                    remark: updatedSales.remark,
                    declarationSessionId: updatedSales.declarationSessionId,
                    eodId: updatedSales.eodId,
                    salesQuotationId: updatedSales.salesQuotationId,
                    performedBy: updatedSales.performedBy,
                    deleted: false,
                    profitAmount: salesBody.salesItems.reduce((sum, item) =>
                        sum + ((item.price - item.cost) * item.quantity - (item.discountAmount || 0)), 0),
                }
            });

            // Create sales items
            const salesItems = await Promise.all(salesBody.salesItems.map(async (item) => {
                return tx.salesItem.create({
                    data: {
                        salesId: createdSales.id,
                        itemId: item.itemId,
                        itemName: item.itemName,
                        itemCode: item.itemCode,
                        itemBrand: item.itemBrand,
                        quantity: item.quantity,
                        cost: item.cost,
                        price: item.price,
                        profit: (item.price - item.cost) * item.quantity - (item.discountAmount || 0),
                        discountPercentage: item.discountPercentage,
                        discountAmount: item.discountAmount,
                        serviceChargeAmount: item.serviceChargeAmount,
                        taxAmount: item.taxAmount,
                        subtotalAmount: item.subtotalAmount,
                        remark: item.remark || "",
                        deleted: false
                    }
                });
            }));
            // Update payments with the new salesId
            const updatedPayments = payments.map(payment => ({
                ...payment,
                salesId: createdSales.id
            }));
            // Create payments
            await tx.payment.createMany({
                data: updatedPayments
            });
            // 4. Update Stock Balance and Create Stock Movement
            const stockUpdates = await Promise.all(
                salesBody.salesItems.map(async (item) => {
                    // Update Stock Balance
                    const stockBalance = await tx.stockBalance.findFirst({
                        where: {
                            itemId: item.itemId,
                            outletId: salesBody.outletId,
                            deleted: false,
                        },
                    });
                    if (!stockBalance) {
                        throw new Error(`Stock balance not found for item ${item.itemId} in outlet ${salesBody.outletId}`);
                    }
                    const updatedStockBalance = await tx.stockBalance.update({
                        where: {
                            id: stockBalance.id,
                        },
                        data: {
                            availableQuantity: {
                                decrement: item.quantity,
                            },
                            onHandQuantity: {
                                decrement: item.quantity,
                            },
                        },
                    });
                    // Create Stock Movement
                    const stockMovement = await tx.stockMovement.create({
                        data: {
                            itemId: item.itemId,
                            outletId: salesBody.outletId,
                            previousAvailableQuantity: stockBalance.availableQuantity,
                            previousOnHandQuantity: stockBalance.onHandQuantity,
                            availableQuantityDelta: -item.quantity,
                            onHandQuantityDelta: -item.quantity,
                            movementType: 'SALE',
                            documentId: createdSales.id,
                            reason: 'Sales transaction',
                            remark: `Sales #${createdSales.id}`,
                        },
                    });
                    return { stockBalance: updatedStockBalance, stockMovement };
                })
            );
            return createdSales;
        });
        // Return the complete sales record with all related data
        return getById(databaseName, result.id);
    }
    catch (error) {
        throw error;
    }
}

let completeSales = async (databaseName: string, salesId: number, payments: Payment[]) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        await tenantPrisma.$transaction(async (tx) => {

            //get sales grand total
            var sales = await tx.sales.findUnique({
                where: {
                    id: salesId
                }
            })

            if (!sales) {
                throw new NotFoundError("Sales")
            }

            if (sales.status == 'completed') {
                throw new BusinessLogicError("Sales already completed")
            }

            //throw error if payment amount is less than sales total amount
            let totalSalesAmount = sales.totalAmount
            let totalPaymentAmount = payments.reduce((sum, currentPayment) => sum + currentPayment.tenderedAmount, 0)
            if (totalPaymentAmount < totalSalesAmount) {
                throw new BusinessLogicError("Total payment amount is less than the sales grand total amount")
            }

            //update sales properties
            var changeAmount = performPaymentCalculation(totalSalesAmount, totalPaymentAmount)
            sales.paidAmount = totalPaymentAmount
            sales.changeAmount = changeAmount
            sales.status = "completed"

            await tx.sales.update({
                where: {
                    id: sales.id
                },
                data: sales
            })

            //insert payments
            await tx.payment.createMany({
                data: payments
            })

            //update stock related data
            let salesItems = await tx.salesItem.findMany({
                where: {
                    salesId: salesId
                }
            })

            // Lazy-load to avoid circular dependency
            const { getByIdRaw } = require("../item/item.service")

            let stocks: StockBalance[] = []
            let stockChecks: StockMovement[] = []

            for (const salesItem of salesItems) {
                var item = await getByIdRaw(salesItem.itemId)
                if (item != null) {
                    var stockIndex = stocks.findIndex(stock => stock.id === item!.stockId)
                    if (stockIndex < 0) {
                        stockIndex = stocks.push(item.stock) - 1
                    }

                    let minusQuantity = salesItem.quantity * -1
                    let updatedAvailableQuantity = stocks[stockIndex].availableQuantity + minusQuantity
                    let updatedOnHandQuantity = stocks[stockIndex].onHandQuantity + minusQuantity
                    stocks[stockIndex].availableQuantity = updatedAvailableQuantity
                    stocks[stockIndex].onHandQuantity = updatedOnHandQuantity

                    let stockCheck: StockMovement = {
                        id: 0,
                        itemId: salesItem.itemId,
                        outletId: sales.outletId,
                        previousAvailableQuantity: item.stock.availableQuantity,
                        previousOnHandQuantity: item.stock.onHandQuantity,
                        availableQuantityDelta: minusQuantity,
                        onHandQuantityDelta: minusQuantity,
                        documentId: salesId,
                        movementType: 'Sales',
                        reason: '',
                        remark: '',
                        deleted: false,
                        version: 1,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    }
                    stockChecks.push(stockCheck)
                }
            }

            await tx.stockMovement.createMany({
                data: stockChecks
            })

            for (const stock of stocks) {
                await tx.stockBalance.update({
                    where: {
                        id: stock.id
                    },
                    data: stock
                })
            }
        })

        return getById(databaseName, salesId)
    }
    catch (error) {
        throw error
    }
}

let calculateSales = async (databaseName: string, salesRequestBody: CalculateSalesDto) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        let sales = await performSalesCalculation(salesRequestBody.sales)
        let salesResponse: CalculateSalesDto = {
            sales: sales
        }
        return salesResponse

    }
    catch (error) {
        throw error
    }
}

let performProfitCalculation = (sales: CreateSalesRequest) => {
    try {
        let items = sales.salesItems
        var totalProfitAmount = 0.00

        items.forEach(function (item) {
            let itemPrice = item.price
            let itemCost = item.cost
            let itemQuantity = item.quantity
            var profit = itemPrice - itemCost
            var subTotalProfit = itemQuantity * profit
            item.profit = profit
            totalProfitAmount = totalProfitAmount + subTotalProfit
        })

        sales.profitAmount = totalProfitAmount
        return sales
    }
    catch (error) {
        throw error
    }
}

let performPaymentCalculation = (salesTotalAmount: number, paidAmount: number) => {
    try {
        var changeAmount = paidAmount - salesTotalAmount
        if (changeAmount < 0) {
            throw new BusinessLogicError("Payment amount is less than sales amount")
        }
        return changeAmount
    }
    catch (error) {
        throw error
    }
}

let performSalesCalculation = async (sales: CalculateSalesObject) => {
    try {
        let items = sales.salesItems
        var subtotal = 0.00
        var totalItemDiscountAmount = 0.00

        items.forEach(function (item) {
            item.subtotalAmount = item.price * item.quantity
            item = calculateItemDiscount(item)
            item.subtotalAmount = item.subtotalAmount - item.discountAmount
            totalItemDiscountAmount = totalItemDiscountAmount + item.discountAmount
            subtotal = subtotal + item.subtotalAmount
        })

        sales.totalItemDiscountAmount = totalItemDiscountAmount
        sales.subtotalAmount = subtotal
        sales = calculateSalesDiscount(sales)
        sales.taxAmount = 0
        sales.serviceChargeAmount = 0
        sales.roundingAmount = 0
        sales.totalAmount = sales.subtotalAmount + sales.taxAmount + sales.serviceChargeAmount + sales.roundingAmount - sales.discountAmount

        return sales
    }
    catch (error) {
        throw error
    }
}

let calculateSalesDiscount = (sales: CalculateSalesObject) => {
    switch (sales.discountBy) {
        case DiscountBy.Amount:
            let discountPercentage = (sales.discountAmount * 100) / sales.subtotalAmount
            if (discountPercentage > 100) {
                sales.discountPercentage = 100
                sales.discountAmount = sales.subtotalAmount
            }
            else {
                sales.discountPercentage = discountPercentage
            }
            break
        case DiscountBy.Percentage:
            sales.discountAmount = sales.subtotalAmount * (sales.discountPercentage / 100)
            break
        default:
            sales.discountAmount = 0
            sales.discountPercentage = 0
            break
    }
    return sales
}

let calculateItemDiscount = (item: CalculateSalesItemObject) => {
    switch (item.discountType) {
        case DiscountType.Manual:
            let subtotalBeforeDiscount = item.subtotalAmount
            switch (item.discountBy) {
                case DiscountBy.Amount:
                    let discountPercentage = (item.discountAmount * 100) / subtotalBeforeDiscount
                    if (discountPercentage > 100) {
                        item.discountPercentage = 100
                        item.discountAmount = subtotalBeforeDiscount
                    }
                    else {
                        item.discountPercentage = discountPercentage
                    }
                    break
                case DiscountBy.Percentage:
                    item.discountAmount = subtotalBeforeDiscount * (item.discountPercentage / 100)
                    break
                default:
                    item.discountAmount = 0
                    item.discountPercentage = 0
                    break
            }
            break
    }
    return item
}

let update = async (databaseName: string, salesRequest: SalesRequestBody) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        await tenantPrisma.$transaction(async (tx) => {
            //separate sales & salesitem to perform update to different tables
            let { items, ...sales } = salesRequest.sales
            items.forEach(async function (salesItem) {
                await tx.salesItem.update({
                    where: {
                        id: salesItem.id
                    },
                    data: salesItem
                })
            })
            await tx.sales.update({
                where: {
                    id: sales.id
                },
                data: sales
            })
        })
    }
    catch (error) {
        throw error
    }
}

let remove = async (databaseName: string, id: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        await tenantPrisma.$transaction(async (tx) => {
            await tx.sales.update({
                where: {
                    id: id
                },
                data: {
                    deleted: true
                }
            })
            await tx.salesItem.updateMany({
                where: {
                    salesId: id
                },
                data: {
                    deleted: true
                }
            })
        })
    }
    catch (error) {
        throw error
    }
}

let getTotalSales = async (databaseName: string, startDate: string, endDate: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const salesArray = await tenantPrisma.sales.findMany({
            where: {
                AND: [
                    {
                        createdAt: {
                            gte: new Date(startDate)
                        },
                    },
                    {
                        createdAt: {
                            lte: new Date(endDate)
                        }
                    },
                    {
                        status: "completed",
                        deleted: false
                    }
                ]
            }
        })

        return salesArray
    }
    catch (error) {
        throw error
    }
}

let getTotalSalesData = async (databaseName: string, startDate: string, endDate: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const salesArray = await getTotalSales(databaseName, startDate, endDate)
        const { totalProfit, totalRevenue } = salesArray.reduce((accumulator, currentSales) => {
            accumulator.totalProfit += currentSales.profitAmount;
            accumulator.totalRevenue += currentSales.totalAmount;
            return accumulator
        }, { totalProfit: 0, totalRevenue: 0 })

        return {
            salesCount: salesArray.length,
            totalProfit: totalProfit,
            totalRevenue: totalRevenue
        }
    }
    catch (error) {
        throw error
    }
}

let omitSales = (sales: Sales): Sales => {
    let { id, createdAt, deleted, ...omittedSales } = sales
    return omittedSales as Sales
}

let omitSalesItems = (salesItems: SalesItem[]): SalesItem[] => {
    let omittedSalesItemArray = salesItems.map(salesItem => {
        let { id, createdAt, deleted, ...omittedSalesItem } = salesItem
        return omittedSalesItem
    })
    return omittedSalesItemArray as SalesItem[]
}

export = {
    getAll,
    getById,
    calculateSales,
    create,
    completeSales,
    completeNewSales,
    update,
    remove,
    getTotalSales,
    getTotalSalesData
}