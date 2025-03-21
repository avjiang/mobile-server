import { Payment, Prisma, PrismaClient, Sales, SalesItem, Stock, StockCheck } from "@prisma/client"
import { BusinessLogicError, NotFoundError } from "../api-helpers/error"
import { SalesRequestBody, SalesCreationRequest, CreateSalesRequest, CalculateSalesObject, CalculateSalesItemObject, DiscountBy, DiscountType, CalculateSalesDto } from "./sales.request"

const prisma = new PrismaClient()

let getAll = async () => {
    try {
        const salesArray = await prisma.sales.findMany({
            include: {
                salesItems: true,
                payments: true,
                registerLogs: true
            }
        })
        return salesArray
    }
    catch (error) {
        throw error
    }
}

let getById = async (id: number) => {
    try {
        const sales = await prisma.sales.findUnique({
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

let create = async (salesBody: SalesCreationRequest) => {
    try {
        const createdSales = await prisma.$transaction(async (tx) => {

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

            await Promise.all(updatedSales.items.map(async (salesItem) => {
                return tx.salesItem.create({
                    data: {
                        salesId: sales.id,
                        itemId: salesItem.itemId,
                        itemName: salesItem.itemName,
                        itemCode: salesItem.itemCode,
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

        return getById(createdSales.id)
    }
    catch (error) {
        throw error
    }
}

let completeNewSales = async (salesBody: CreateSalesRequest, payments: Payment[]) => {
    try {

        const createdSales = await prisma.$transaction(async (tx) => {

            //calculate profit amount
            let updatedSales = performProfitCalculation(salesBody)

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

            await Promise.all(updatedSales.items.map(async (salesItem) => {
                return tx.salesItem.create({
                    data: {
                        salesId: sales.id,
                        itemId: salesItem.itemId,
                        itemName: salesItem.itemName,
                        itemCode: salesItem.itemCode,
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

            //update payment sales ID and insert payments
            for (var payment of payments) {
                payment.salesId = sales.id
            }
            await tx.payment.createMany({
                data: payments
            })

            //update stock related data
            let salesItems = await tx.salesItem.findMany({
                where: {
                    salesId: sales.id
                }
            })

            // Lazy-load to avoid circular dependency
            const { getByIdRaw } = require("../item/item.service")

            let stocks: Stock[] = []
            let stockChecks: StockCheck[] = []
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

                    let stockCheck: StockCheck = {
                        id: 0,
                        created: new Date,
                        itemId: salesItem.itemId,
                        availableQuantity: minusQuantity,
                        onHandQuantity: minusQuantity,
                        documentId: sales.id,
                        documentType: 'Sales',
                        reason: '',
                        remark: '',
                        outletId: sales.outletId,
                        deleted: false
                    }
                    stockChecks.push(stockCheck)
                }
            }

            await tx.stockCheck.createMany({
                data: stockChecks
            })

            for (const stock of stocks) {
                await tx.stock.update({
                    where: {
                        id: stock.id
                    },
                    data: stock
                })
            }

            return sales
        })

        return getById(createdSales.id)
    }
    catch (error) {
        throw error
    }
}

let completeSales = async (salesId: number, payments: Payment[]) => {
    try {
        await prisma.$transaction(async (tx) => {

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

            let stocks: Stock[] = []
            let stockChecks: StockCheck[] = []

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

                    let stockCheck: StockCheck = {
                        id: 0,
                        created: new Date,
                        itemId: salesItem.itemId,
                        availableQuantity: minusQuantity,
                        onHandQuantity: minusQuantity,
                        documentId: salesId,
                        documentType: 'Sales',
                        reason: '',
                        remark: '',
                        outletId: sales.outletId,
                        deleted: false
                    }
                    stockChecks.push(stockCheck)
                }
            }

            await tx.stockCheck.createMany({
                data: stockChecks
            })

            for (const stock of stocks) {
                await tx.stock.update({
                    where: {
                        id: stock.id
                    },
                    data: stock
                })
            }
        })

        return getById(salesId)
    }
    catch (error) {
        throw error
    }
}

let calculateSales = async (salesRequestBody: CalculateSalesDto) => {
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
        let items = sales.items
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
        let items = sales.items
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

let update = async (salesRequest: SalesRequestBody) => {
    try {
        await prisma.$transaction(async (tx) => {
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

let remove = async (id: number) => {
    try {
        await prisma.$transaction(async (tx) => {
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

let getTotalSales = async (startDate: string, endDate: string) => {
    try {
        const salesArray = await prisma.sales.findMany({
            where: {
                AND: [
                    {
                        created: {
                            gte: new Date(startDate)
                        },
                    },
                    {
                        created: {
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

let getTotalSalesData = async (startDate: string, endDate: string) => {
    try {
        const salesArray = await getTotalSales(startDate, endDate)
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
    let { id, created, deleted, ...omittedSales } = sales
    return omittedSales as Sales
}

let omitSalesItems = (salesItems: SalesItem[]): SalesItem[] => {
    let omittedSalesItemArray = salesItems.map(salesItem => {
        let { id, created, deleted, ...omittedSalesItem } = salesItem
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