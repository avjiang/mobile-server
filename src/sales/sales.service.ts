import { Payment, Prisma, PrismaClient, Sales, SalesItem, Stock, StockCheck } from "@prisma/client"
import { BusinessLogicError, NotFoundError } from "../api-helpers/error"
import { CalculateSalesResponseBody, SalesResponseBody } from "./sales.response"
import { SalesRequestBody, CalculateSalesRequestBody, SalesCreationRequestBody, CompleteSalesRquestBody } from "./sales.request"
import {  DiscountBy, DiscountType, CalculateSalesObject, CalculateSalesItemObject } from "./sales.model"
import { Decimal } from "@prisma/client/runtime/library"
import salesMapper from "./sales.mapper"

const prisma = new PrismaClient()

let getAll = async () => {
    try {
        const salesArray = await prisma.sales.findMany()
        let salesResponseArray= Promise.all(salesArray.map(async sales => {
            let salesItemArray: SalesItem[] = await prisma.salesItem.findMany({
                where: {
                    salesId: sales.id
                }
            })
            let salesResponse: SalesResponseBody = {
                sales: {
                    ...sales,
                    items: salesItemArray
                }
            }
            return salesResponse
        }))

        return salesResponseArray
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
            }
        })
        if (!sales) {
            throw new NotFoundError("Sales")
        }

        const salesItemArray = await prisma.salesItem.findMany({
            where: {
                salesId: sales.id
            }
        })

        let salesResponse: SalesResponseBody = {
            sales: {
                ...sales,
                items: salesItemArray
            }
        }

        return salesResponse
    }
    catch (error) {
        throw error
    }
}

let create = async (salesBody: SalesCreationRequestBody) => {
    try {
        var createdSalesId = 0
        await prisma.$transaction(async (tx) => {
            
            //calculate profit amount
            let salesRequest = performProfitCalculation(salesBody)

            //calculate change amount
            let salesAmount = salesRequest.sales.totalAmount
            let paymentAmount = salesRequest.sales.paidAmount
            var changeAmount = performPaymentCalculation(salesAmount, paymentAmount)
            salesRequest.sales.changeAmount = changeAmount

            //separate sales & salesitem to perform update to different tables
            let sales: Sales = salesMapper.mapSalesDOToSalesPO(salesRequest.sales)
            let items: SalesItem[] = salesMapper.mapSalesItemsDOToSalesItemsPO(salesRequest.sales.items)
            const createdSales = await tx.sales.create({
                data: omitSales(sales)
            })

            //assigned sales ID to each sales item
            items.forEach(function (item) {
                item.salesId = createdSales.id
            })

            await tx.salesItem.createMany({
                data: omitSalesItems(items)
            })

            createdSalesId = createdSales.id
        })

        return getById(createdSalesId)
    }
    catch (error) {
        throw error
    }
}

let completeNewSales = async (salesBody: SalesCreationRequestBody, payments: Payment[]) => {
    try {
        var createdSalesId = 0
        await prisma.$transaction(async (tx) => {
            
            //calculate profit amount
            let salesRequest = performProfitCalculation(salesBody)

            //separate sales & salesitem to perform update to different tables
            let sales: Sales = salesMapper.mapSalesDOToSalesPO(salesRequest.sales)
            let items: SalesItem[] = salesMapper.mapSalesItemsDOToSalesItemsPO(salesRequest.sales.items)
            const createdSales = await tx.sales.create({
                data: omitSales(sales)
            })

            //assigned sales ID to each sales item
            items.forEach(function (item) {
                item.salesId = createdSales.id
            })

            await tx.salesItem.createMany({
                data: omitSalesItems(items)
            })

            createdSalesId = createdSales.id

            //throw error if payment amount is less than sales total amount
            let totalSalesAmount = parseFloat(createdSales.totalAmount.toString())
            let totalPaymentAmount = payments.reduce((sum, currentPayment) => sum + parseFloat(currentPayment.tenderedAmount.toString()), 0)
            if (totalPaymentAmount < totalSalesAmount) {
                throw new BusinessLogicError("Total payment amount is less than the sales grand total amount")
            }

            //update sales properties
            var changeAmount = performPaymentCalculation(totalSalesAmount, totalPaymentAmount)
            createdSales.paidAmount = new Prisma.Decimal(totalPaymentAmount)
            createdSales.changeAmount = new Prisma.Decimal(changeAmount)
            createdSales.status = "completed"

            await tx.sales.update({
                where: {
                    id: createdSales.id
                },
                data: createdSales
            })

            //insert payments
            await tx.payment.createMany({
                data: payments
            })

            //update stock related data
            let salesItems = await tx.salesItem.findMany({
                where: {
                    salesId: createdSales.id
                }
            })

            let stocks: Stock[] = []
            let stockChecks: StockCheck[] = []

            for (const salesItem of salesItems) {
                let stock = await tx.stock.findFirst({
                    where: {
                        itemCode: salesItem.itemCode,
                        outletId: createdSales.outletId
                    }
                })
                if (!stock) {
                    throw new NotFoundError(`Stock for ${salesItem.itemCode}`)
                }

                let minusQuantity = parseFloat(salesItem.quantity.toString()) * -1
                let updatedAvailableQuantity = parseFloat(stock.availableQuantity.toString()) + minusQuantity
                let updatedOnHandQuantity = parseFloat(stock.onHandQuantity.toString()) + minusQuantity
                stock.availableQuantity = new Prisma.Decimal(updatedAvailableQuantity)
                stock.onHandQuantity = new Prisma.Decimal(updatedOnHandQuantity)

                let stockCheck: StockCheck = {
                    id: 0,
                    created: new Date,
                    itemCode: salesItem.itemCode,
                    availableQuantity: new Prisma.Decimal(minusQuantity),
                    onHandQuantity: new Prisma.Decimal(minusQuantity),
                    documentId: createdSales.id,
                    documentType: 'Sales',
                    reason: '',
                    remark: '',
                    outletId: createdSales.outletId,
                    deleted: false
                }

                stocks.push(stock)
                stockChecks.push(stockCheck)
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

        return getById(createdSalesId)
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

            //throw error if payment amount is less than sales total amount
            let totalSalesAmount = parseFloat(sales.totalAmount.toString())
            let totalPaymentAmount = payments.reduce((sum, currentPayment) => sum + parseFloat(currentPayment.tenderedAmount.toString()), 0)
            if (totalPaymentAmount < totalSalesAmount) {
                throw new BusinessLogicError("Total payment amount is less than the sales grand total amount")
            }

            //update sales properties
            var changeAmount = performPaymentCalculation(totalSalesAmount, totalPaymentAmount)
            sales.paidAmount = new Prisma.Decimal(totalPaymentAmount)
            sales.changeAmount = new Prisma.Decimal(changeAmount)
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

            let stocks: Stock[] = []
            let stockChecks: StockCheck[] = []

            for (const salesItem of salesItems) {
                let stock = await tx.stock.findFirst({
                    where: {
                        itemCode: salesItem.itemCode,
                        outletId: sales.outletId
                    }
                })
                if (!stock) {
                    throw new NotFoundError(`Stock for ${salesItem.itemCode}`)
                }

                let minusQuantity = parseFloat(salesItem.quantity.toString()) * -1
                let updatedAvailableQuantity = parseFloat(stock.availableQuantity.toString()) + minusQuantity
                let updatedOnHandQuantity = parseFloat(stock.onHandQuantity.toString()) + minusQuantity
                stock.availableQuantity = new Prisma.Decimal(updatedAvailableQuantity)
                stock.onHandQuantity = new Prisma.Decimal(updatedOnHandQuantity)

                let stockCheck: StockCheck = {
                    id: 0,
                    created: new Date,
                    itemCode: salesItem.itemCode,
                    availableQuantity: new Prisma.Decimal(minusQuantity),
                    onHandQuantity: new Prisma.Decimal(minusQuantity),
                    documentId: salesId,
                    documentType: 'Sales',
                    reason: '',
                    remark: '',
                    outletId: sales.outletId,
                    deleted: false
                }

                stocks.push(stock)
                stockChecks.push(stockCheck)
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

let calculateSales = async (salesRequestBody: CalculateSalesRequestBody) => {
    try {
        let sales = await performSalesCalculation(salesRequestBody.sales)
        let salesResponse: CalculateSalesResponseBody = {
            sales: sales
        }
        return salesResponse
        
    }
    catch (error) {
        throw error
    }
}

let performProfitCalculation = (salesRequest: SalesCreationRequestBody) => {
    try {
        let items = salesRequest.sales.items
        var totalProfitAmount = 0.00

        items.forEach(function (item) {
            let itemPrice = parseFloat(item.price.toString())
            let itemCost = parseFloat(item.cost.toString())
            let itemQuantity = parseFloat(item.quantity.toString())
            var profit = itemPrice - itemCost
            var subTotalProfit = itemQuantity * profit
            item.profit = profit
            totalProfitAmount = totalProfitAmount + subTotalProfit
        })

        salesRequest.sales.profitAmount = totalProfitAmount
        return salesRequest
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

let omitSales = (sales: Sales) : Sales => {
    let { id, created, deleted, ...omittedSales } = sales
    return omittedSales as Sales
}

let omitSalesItems = (salesItems: SalesItem[]) : SalesItem[] => {
    let omittedSalesItemArray = salesItems.map(salesItem => {
        let { id, created, deleted, ...omittedSalesItem } = salesItem
        return omittedSalesItem
    })
    return omittedSalesItemArray as SalesItem[]
}

export = { getAll, getById, calculateSales, create, completeSales, completeNewSales, update, remove }