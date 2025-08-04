// import { Prisma, PrismaClient, Stock, StockCheck } from "../../prisma/client"
// import { NotFoundError, RequestValidateError } from "../api-helpers/error"
// import { StockAdjustment, StockAdjustmentRequestBody } from "./stockbalance.request"
// import stockcheckService from "./stockcheck.service"
// import { getTenantPrisma } from '../db';

// // stock function 
// let getAllStock = async (databaseName: string) => {
//     try {
//         const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
//         const stocks = await tenantPrisma.stock.findMany()
//         return stocks
//     }
//     catch (error) {
//         throw error
//     }
// }

// let getStockByItemId = async (databaseName: string, itemId: number) => {
//     try {
//         const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
//         const stock = await tenantPrisma.stock.findUnique({
//             where: {
//                 id: (await tenantPrisma.item.findUnique({
//                     where: { id: itemId },
//                     select: { stockId: true },
//                 }))?.stockId,
//             }
//         })
//         if (!stock) {
//             throw new NotFoundError("Stock")
//         }
//         return stock
//     }
//     catch (error) {
//         throw error
//     }
// }

// let stockAdjustment = async (databaseName: string, stockAdjustments: StockAdjustment[]) => {
//     try {
//         const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
//         var adjustedCount = 0

//         await tenantPrisma.$transaction(async (tx) => {
//             let stocks: Stock[] = []
//             let stockChecks: StockCheck[] = []

//             for (const stockAdjustment of stockAdjustments) {
//                 let stock = await getStockByItemId(databaseName, stockAdjustment.itemId)
//                 if (!stock) {
//                     throw new NotFoundError(`Stock for ${stockAdjustment.itemId}`)
//                 }

//                 let updatedAvailableQuantity = stock.availableQuantity + stockAdjustment.adjustQuantity
//                 let updatedOnHandQuantity = stock.onHandQuantity + stockAdjustment.adjustQuantity
//                 stock.availableQuantity = updatedAvailableQuantity
//                 stock.onHandQuantity = updatedOnHandQuantity

//                 let stockCheck: StockCheck = {
//                     id: 0,
//                     created: new Date,
//                     itemId: stockAdjustment.itemId,
//                     availableQuantity: stockAdjustment.adjustQuantity,
//                     onHandQuantity: stockAdjustment.adjustQuantity,
//                     documentId: 0,
//                     documentType: "Stock Adjustment",
//                     reason: stockAdjustment.reason,
//                     remark: stockAdjustment.remark,
//                     outletId: stockAdjustment.outletId,
//                     deleted: false
//                 }

//                 stocks.push(stock)
//                 stockChecks.push(stockCheck)
//             }

//             await tx.stockCheck.createMany({
//                 data: stockChecks
//             })

//             for (const stock of stocks) {
//                 await tx.stock.update({
//                     where: {
//                         id: stock.id
//                     },
//                     data: stock
//                 })
//                 adjustedCount = adjustedCount + 1
//             }
//         })
//         return adjustedCount
//     }
//     catch (error) {
//         throw error
//     }
// }

// let updateManyStocks = async (databaseName: string, stocks: Stock[]) => {
//     try {
//         const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
//         var updatedCount = 0
//         await tenantPrisma.$transaction(async (tx) => {

//             for (const stock of stocks) {
//                 await tx.stock.update({
//                     where: {
//                         id: stock.id
//                     },
//                     data: stock
//                 })
//                 updatedCount = updatedCount + 1
//             }
//         })
//         return updatedCount
//     }
//     catch (error) {
//         throw error
//     }
// }

// let removeStock = async (databaseName: string, id: number) => {
//     try {
//         const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
//         const stock = await tenantPrisma.stock.findUnique({
//             where: {
//                 id: id
//             }
//         })
//         if (!stock) {
//             throw new NotFoundError("Stock")
//         }
//         const updatedStock = await tenantPrisma.stock.update({
//             where: {
//                 id: id
//             },
//             data: {
//                 deleted: true
//             }
//         })
//         return updatedStock
//     }
//     catch (error) {
//         throw error
//     }
// }

// export = { getAllStock, getStockByItemId, stockAdjustment, updateManyStocks, removeStock }