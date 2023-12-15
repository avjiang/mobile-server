import { Prisma, PrismaClient, Sales, SalesItem } from "@prisma/client"
import { BusinessLogicError, NotFoundError } from "../api-helpers/error"
import { CalculateSalesResponseBody, SalesResponseBody } from "./sales.response"
import { SalesRequestBody, CalculateSalesRequestBody, SalesCreationRequestBody } from "./sales.request"
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

// let create = async (salesRequestBody: SalesRequestBody) => {
//     try {
//         var createdSalesId = 0
//         await prisma.$transaction(async (tx) => {
            
//             //calculate profit amount
//             let salesRequest = performProfitCalculation(salesRequestBody)

//             //calculate change amount
//             let salesAmount = parseFloat(salesRequest.sales.totalAmount.toString())
//             let paymentAmount = parseFloat(salesRequest.sales.paidAmount.toString())
//             var changeAmount: number = performPaymentCalculation(salesAmount, paymentAmount)
//             salesRequest.sales.changeAmount = new Prisma.Decimal(changeAmount)

//             //separate sales & salesitem to perform update to different tables
//             let { items, ...sales } = salesRequest.sales
//             const createdSales = await tx.sales.create({
//                 data: omitSales(sales)
//             })

//             //assigned sales ID to each sales item
//             items.forEach(function (item) {
//                 item.salesId = createdSales.id
//             })

//             await tx.salesItem.createMany({
//                 data: omitSalesItems(items)
//             })

//             createdSalesId = createdSales.id
//         })

//         return getById(createdSalesId)
//     }
//     catch (error) {
//         throw error
//     }
// }

let create = async (salesBody: SalesCreationRequestBody) => {
    try {
        var createdSalesId = 0
        await prisma.$transaction(async (tx) => {
            
            //calculate profit amount
            let salesRequest = performProfitCalculation2(salesBody)

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

let performProfitCalculation = (salesRequest: SalesRequestBody) => {
    try {
        let items = salesRequest.sales.items
        var totalProfitAmount = 0.00

        items.forEach(function (item) {
            let itemPrice = parseFloat(item.price.toString())
            let itemCost = parseFloat(item.cost.toString())
            let itemQuantity = parseFloat(item.quantity.toString())
            var profit = itemPrice - itemCost
            var subTotalProfit = itemQuantity * profit
            item.profit = new Decimal(profit)
            totalProfitAmount = totalProfitAmount + subTotalProfit
        })

        salesRequest.sales.profitAmount = new Decimal(totalProfitAmount)
        return salesRequest
    }
    catch (error) {
        throw error
    }
}

let performProfitCalculation2 = (salesRequest: SalesCreationRequestBody) => {
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

export = { getAll, getById, calculateSales, create, update, remove }