import { PrismaClient, Supplier } from "@prisma/client"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"

const prisma = new PrismaClient()

let getAll = async () => {
    try {
        const suppliers = await prisma.supplier.findMany()
        return suppliers
    }
    catch (error) {
        throw error
    }
}

let getById = async (id: number) => {
    try {
        const supplier = await prisma.supplier.findUnique({
            where: {
                id: id
            }
        })
        if (!supplier) {
            throw new NotFoundError("Supplier") 
        }
        return supplier
    }
    catch (error) {
        throw error
    }
}

let createMany = async (suppliers: Supplier[]) => {
    try {
        const newSuppliers = await prisma.supplier.createMany({
            data: suppliers
        })

        return newSuppliers.count
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

let update = async (supplier: Supplier) => {
    try {
        const updatedSupplier = await prisma.supplier.update({
            where: {
                id: supplier.id
            },
            data: supplier
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
        return updatedSupplier
    }
    catch (error) {
        throw error
    }
}

let remove = async (id: number) => {
    try {
        const updatedSupplier = await prisma.supplier.update({
            where: {
                id: id
            },
            data: {
                deleted: true
            }
        })
        return updatedSupplier
    }
    catch (error) {
        throw error
    }
}

export = { getAll, getById, createMany, update, remove }