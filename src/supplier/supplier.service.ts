import { PrismaClient, Supplier } from "@prisma/client"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { plainToInstance } from "class-transformer"
import { SupplierDto } from "./supplier.response"
import { getTenantPrisma } from '../db';

let getAll = async (databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const suppliers = await tenantPrisma.supplier.findMany()
        const suppliersDto = await Promise.all(suppliers.map(async supplier => {
            let itemCount = await tenantPrisma.item.count({
                where: { supplierId: supplier.id }
            })
            itemCount = itemCount === undefined ? 0 : itemCount
            return plainToInstance(SupplierDto, { ...supplier, itemCount }, { excludeExtraneousValues: true })
        }))
        return suppliersDto
    }
    catch (error) {
        throw error
    }
}

let getById = async (id: number, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const supplier = await tenantPrisma.supplier.findUnique({
            where: {
                id: id
            }
        })
        if (!supplier) {
            throw new NotFoundError("Supplier")
        }

        let itemCount = await tenantPrisma.item.count({
            where: {
                supplierId: id
            }
        })
        itemCount = itemCount === undefined ? 0 : itemCount

        let supplierDto = plainToInstance(SupplierDto, { ...supplier, itemCount }, { excludeExtraneousValues: true })
        return supplierDto
    }
    catch (error) {
        throw error
    }
}

let createMany = async (suppliers: Supplier[], databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const newSuppliers = await tenantPrisma.supplier.createMany({
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

let update = async (supplier: Supplier, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const updatedSupplier = await tenantPrisma.supplier.update({
            where: {
                id: supplier.id
            },
            data: supplier
        })
        return updatedSupplier
    }
    catch (error) {
        throw error
    }
}

let remove = async (id: number, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const updatedSupplier = await tenantPrisma.supplier.update({
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