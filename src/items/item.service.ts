import { PrismaClient, Item } from "@prisma/client"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"

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

let createMany = async (items: Item[]) => {
    try {
        const newItems = await prisma.item.createMany({
            data: items
        })

        return newItems.count
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
        const updatedItem = await prisma.item.update({
            where: {
                id: id
            },
            data: {
                deleted: true
            }
        })
        return updatedItem
    }
    catch (error) {
        throw error
    }
}

export = { getAll, getById, createMany, update, remove }