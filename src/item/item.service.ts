import { PrismaClient, Item, Stock, StockCheck, Prisma } from "@prisma/client"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import salesService from "../sales/sales.service"
import { ItemSoldObject, StockItem } from "./item.model"
import { ItemSoldRankingResponseBody } from "./item.response"

const prisma = new PrismaClient()

let getAll = async () => {
    try {
        var items = await prisma.item.findMany({
            include: {
                stocks: {
                    select: {
                        availableQuantity: true
                    }
                }
            }
        })

        const result: StockItem[] = items.map(item => {
            const totalStockQuantity = item.stocks.reduce((sum, stock) => sum + parseFloat(stock.availableQuantity.toString()), 0)
            const { stocks, ...itemWithoutStocks } = item;
            return {
                ...itemWithoutStocks,
                stockQuantity: totalStockQuantity
            }
        })
        return result
    }
    catch (error) {
        throw error
    }
}

let getById = async (id: number) => {
    try {
        const item = await prisma.item.findUnique({
            where: {
                id: id
            },
            include: {
                stocks: {
                    select: {
                        availableQuantity: true
                    }
                }
            }
        })
        if (!item) {
            throw new NotFoundError("Item") 
        }

        const totalStockQuantity = item.stocks.reduce((sum, stock) => sum + parseFloat(stock.availableQuantity.toString()), 0)
        const { stocks, ...itemWithoutStocks } = item;
        return {
            ...itemWithoutStocks,
            stockQuantity: totalStockQuantity
        }
    }
    catch (error) {
        throw error
    }
}

let createMany = async (itemBodyArray: StockItem[]) => {
    try {
        var addedItemCount = 0
        await prisma.$transaction(async (tx) => {
            let items: Item[] = []
            let stocks: Stock[] = []
            let stockChecks: StockCheck[] = []

            for (const itemBody of itemBodyArray) {
                const { stockQuantity, ...item } = itemBody
                items.push(item as Item)

                let stock: Stock = {
                    id: 0,
                    itemCode: item.itemCode,
                    availableQuantity: new Prisma.Decimal(stockQuantity),
                    onHandQuantity: new Prisma.Decimal(stockQuantity),
                    outletId: 0,
                    deleted: false
                }
                stocks.push(stock)

                let stockCheck: StockCheck = {
                    id: 0,
                    created: new Date,
                    itemCode: item.itemCode,
                    availableQuantity: new Prisma.Decimal(stockQuantity),
                    onHandQuantity: new Prisma.Decimal(stockQuantity),
                    documentId: 0,
                    documentType: "Create Item",
                    reason: "",
                    remark: "",
                    outletId: 0,
                    deleted: false
                }
                stockChecks.push(stockCheck)
            }

            const createdItems = await tx.item.createMany({
                data: items
            })

            const createdStocks = await tx.stock.createMany({
                data: stocks
            })

            const createdStockChecks = await tx.stockCheck.createMany({
                data: stockChecks
            })

            addedItemCount = createdItems.count
        })

        return addedItemCount
    }
    catch (error) {
        throw error
    }
}

let update = async (item: Item) => {
    try {
        const updatedItem = await prisma.item.update({
            where: {
                id: item.id
            },
            data: item
        })
        return updatedItem
    }
    catch (error) {
        throw error
    }
}

let remove = async (id: number) => {
    try {
        await prisma.$transaction(async (tx) => {
            const updatedItem = await tx.item.update({
                where: {
                    id: id
                },
                data: {
                    deleted: true
                }
            })

            const itemStocks = await tx.stock.findMany({
                where: {
                    itemCode: updatedItem.itemCode
                }
            })

            for (const stock of itemStocks) {
                await tx.stock.update({
                    where: {
                        id: stock.id
                    },
                    data: {
                        deleted: true
                    }
                })
            }
        })        
    }
    catch (error) {
        throw error
    }
}

let getLowStockItemCount = async (lowStockQuantity: number, isIncludedZeroStock: boolean) => {
    try {
        const lowStocks = await prisma.stock.findMany({
            where: {
                availableQuantity: {
                    lte: lowStockQuantity,
                    gte: isIncludedZeroStock ? 0 : 1
                }
            }
        })

        const lowStockItemCodes = lowStocks.map(stock => stock.itemCode)
        const uniqueStockItemCodes = [...new Set(lowStockItemCodes)]
        const lowStockItemsCount = await prisma.item.count({
            where: {
                itemCode: {
                    in: uniqueStockItemCodes
                }
            }
        })

        return lowStockItemsCount
    }
    catch (error) {
        throw error
    }
}

let getLowStockItems = async (lowStockQuantity: number, isIncludedZeroStock: boolean) => {
    try {
        const lowStocks = await prisma.stock.findMany({
            where: {
                availableQuantity: {
                    lte: lowStockQuantity,
                    gte: isIncludedZeroStock ? 0 : 1
                }
            }
        })

        var stockItemList: StockItem[] = []
        for(const stock of lowStocks) {
            const item = await prisma.item.findFirst({
                where: {
                    itemCode: stock.itemCode
                }
            })
            if (item) {
                var stockQuantity = parseFloat(stock.availableQuantity.toString())

                let stockItem: StockItem = {
                    ...item,
                    stockQuantity: stockQuantity
                }
                stockItemList.push(stockItem)
            }
        }

        return stockItemList
    }
    catch (error) {
        throw error
    }
}

let getSoldItemRanking = async (startDate: string, endDate: string) => {
    try {
        const salesIDArray = (await salesService.getTotalSales(startDate, endDate)).map(sales => sales.id)

        const top5SoldSalesItems = await prisma.salesItem.groupBy({
            by: ['itemId'],
            _count: {
              itemId: true,
            },
            where: {
              salesId: {
                in: salesIDArray,
              },
            },
            orderBy: {
              _count: {
                itemId: 'desc',
              },
            },
            take: 5,
          })

        const leastSoldSalesItems = await prisma.salesItem.groupBy({
            by: ['itemId'],
            _count: {
              itemId: true,
            },
            where: {
              salesId: {
                in: salesIDArray,
              },
            },
            orderBy: {
              _count: {
                itemId: 'asc',
              },
            },
            take: 1,
          })

        const topSoldItems = await Promise.all(
            top5SoldSalesItems.map(async (item) => {
                const stockItem = await getById(item.itemId)
                const soldItem: ItemSoldObject = {
                    item: stockItem,
                    quantitySold: item._count.itemId
                }

                return soldItem
            })
        )

        if (top5SoldSalesItems.length <= 0 || leastSoldSalesItems.length <= 0) {
            throw new NotFoundError('Item')
        }

        const leastSoldSalesItem = leastSoldSalesItems[0]
        const stockItem = await getById(leastSoldSalesItem.itemId)
        const leastSoldItem: ItemSoldObject = {
            item: stockItem,
            quantitySold: leastSoldSalesItem._count.itemId
        }   

        const itemSoldRankingItems: ItemSoldRankingResponseBody = {
            topSoldItems: topSoldItems,
            leastSoldItem: leastSoldItem
        }
        return itemSoldRankingItems
    }
    catch (error) {
        throw error
    }
}

export = { 
    getAll,
    getById, 
    createMany, 
    update, 
    remove, 
    getSoldItemRanking, 
    getLowStockItemCount, 
    getLowStockItems
}