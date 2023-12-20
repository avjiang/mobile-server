import { PrismaClient, Item, Stock, StockCheck, Prisma } from "@prisma/client"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { CreateItemBody, StockItem } from "./item.request"

const prisma = new PrismaClient()

let getAll = async () => {
    try {
        const items = await prisma.item.findMany()
        return items
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
            }
        })
        if (!item) {
            throw new NotFoundError("Item") 
        }
        return item
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

// let createItem = async (item: Item) => {
//     try {
//         const newItem = await prisma.item.create({
//             data: item
//             // data: {
//             //     itemCode: item.itemCode,
//             //     itemName: item.itemName,
//             //     itemType: item.itemType,
//             //     itemModel: item.itemModel,
//             //     itemBrand: item.itemBrand,
//             //     itemDescription: item.itemDescription,
//             //     category: item.category,
//             //     cost: item.cost,
//             //     price: item.price,
//             //     isOpenPrice: item.isOpenPrice,
//             //     unitOfMeasure: item.unitOfMeasure,
//             //     height: item.height,
//             //     width: item.width,
//             //     length: item.length,
//             //     weight: item.weight,
//             //     alternateLookUp: item.alternateLookUp,
//             //     image: item.image
//             // }
//         })
//         return newItem
//     }
//     catch (error) {
//         throw error
//     }
// }

let update = async (item: Item) => {
    try {
        const updatedItem = await prisma.item.update({
            where: {
                id: item.id
            },
            data: item
            // data: {
            //     itemCode: item.itemCode,
            //     itemName: item.itemName,
            //     itemType: item.itemType,
            //     itemModel: item.itemModel,
            //     itemBrand: item.itemBrand,
            //     itemDescription: item.itemDescription,
            //     category: item.category,
            //     cost: item.cost,
            //     price: item.price,
            //     isOpenPrice: item.isOpenPrice,
            //     unitOfMeasure: item.unitOfMeasure,
            //     height: item.height,
            //     width: item.width,
            //     length: item.length,
            //     weight: item.weight,
            //     alternateLookUp: item.alternateLookUp,
            //     image: item.image,
            // }
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

export = { getAll, getById, createMany, update, remove }