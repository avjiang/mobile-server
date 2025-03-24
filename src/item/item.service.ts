import { PrismaClient, Item, Prisma } from "@prisma/client"
import { NotFoundError } from "../api-helpers/error"
import salesService from "../sales/sales.service"
import { ItemDto, ItemSoldObject, ItemSoldRankingResponseBody } from "./item.response"
import { plainToInstance } from "class-transformer"
import { getTenantPrisma } from '../db';

let getByIdRaw = async (databaseName: string, id: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const item = await tenantPrisma.item.findUnique({
            where: {
                id: id
            },
            include: {
                stock: true,
                stockCheck: true
            }
        })
        return item
    }
    catch (error) {
        throw error
    }
}

let getAllRaw = async (databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const items = await tenantPrisma.item.findMany({
            include: {
                stock: true,
                stockCheck: true
            }
        })
        return items
    }
    catch (error) {
        throw error
    }
}

let getAll = async (databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const items = await tenantPrisma.item.findMany({
            include: {
                stock: {
                    select: {
                        availableQuantity: true
                    }
                }
            }
        })
        const itemWithStock = plainToInstance(ItemDto, items, { excludeExtraneousValues: true })
        return itemWithStock
    }
    catch (error) {
        throw error
    }
}

let getAllBySupplierId = async (databaseName: string, supplierId: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const items = await tenantPrisma.item.findMany({
            where: {
                supplierId: supplierId
            },
            include: {
                stock: {
                    select: {
                        availableQuantity: true
                    }
                }
            }
        })
        const itemWithStock = plainToInstance(ItemDto, items, { excludeExtraneousValues: true })
        return itemWithStock
    }
    catch (error) {
        throw error
    }
}

let getById = async (databaseName: string, id: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const item = await tenantPrisma.item.findUnique({
            where: {
                id: id
            },
            include: {
                stock: {
                    select: {
                        availableQuantity: true
                    }
                }
            }
        })
        if (!item) {
            throw new NotFoundError("Item")
        }
        const itemWithStock = plainToInstance(ItemDto, item, { excludeExtraneousValues: true })
        return itemWithStock
    }
    catch (error) {
        throw error
    }
}

let createMany = async (databaseName: string, itemBodyArray: ItemDto[]) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const createdItems = await tenantPrisma.$transaction(
            itemBodyArray.map((itemBody) => {
                const { stockQuantity, ...item } = itemBody
                return tenantPrisma.item.create({
                    data: {
                        itemCode: item.itemCode,
                        itemName: item.itemName,
                        itemType: item.itemType,
                        itemModel: item.itemModel,
                        itemBrand: item.itemBrand,
                        itemDescription: item.itemDescription,
                        category: item.category,
                        cost: item.cost,
                        price: item.price,
                        isOpenPrice: item.isOpenPrice,
                        unitOfMeasure: item.unitOfMeasure,
                        height: item.height,
                        width: item.width,
                        length: item.length,
                        weight: item.weight,
                        alternateLookUp: item.alternateLookUp,
                        image: item.image,
                        supplierId: item.supplierId,
                        deleted: item.deleted,
                        stock: {
                            create: {
                                availableQuantity: stockQuantity,
                                onHandQuantity: stockQuantity,
                                deleted: false
                            },
                        },
                        stockCheck: {
                            create: [
                                {
                                    availableQuantity: stockQuantity,
                                    onHandQuantity: stockQuantity,
                                    documentId: 0,
                                    documentType: "Create Item",
                                    reason: "",
                                    remark: "",
                                    outletId: 0,
                                    deleted: false
                                }
                            ]
                        }
                    }
                })
            })
        );

        return createdItems.length;
    }
    catch (error) {
        throw error
    }
}

let update = async (databaseName: string, item: Item) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const updatedItem = await tenantPrisma.item.update({
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

let remove = async (databaseName: string, id: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const item = await getByIdRaw(databaseName, id)
        if (!item) {
            throw new NotFoundError("Item")
        }

        await tenantPrisma.$transaction(async (tx) => {
            await tx.stockCheck.updateMany({ where: { itemId: id }, data: { deleted: true } }),
                await tx.stock.update({
                    where: {
                        id: (await tx.item.findUnique({
                            where: { id: id },
                            select: { stockId: true },
                        }))?.stockId,
                    },
                    data: {
                        deleted: true,
                    },
                }),
                await tx.item.update({ where: { id: id }, data: { deleted: true } })
        })
    }
    catch (error) {
        throw error
    }
}

let getLowStockItemCount = async (databaseName: string, lowStockQuantity: number, isIncludedZeroStock: boolean) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const itemStockItems = await tenantPrisma.item.findMany({
            where: {
                stock: {
                    availableQuantity: {
                        gte: isIncludedZeroStock ? 0 : 1,
                        lte: lowStockQuantity,
                    },
                },
            },
            include: {
                stock: {
                    select: {
                        availableQuantity: true,
                    },
                },
            },
        });

        return itemStockItems.length;
    }
    catch (error) {
        throw error
    }
}

let getLowStockItems = async (databaseName: string, lowStockQuantity: number, isIncludedZeroStock: boolean) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const itemStockItems = await tenantPrisma.item.findMany({
            where: {
                stock: {
                    availableQuantity: {
                        gte: isIncludedZeroStock ? 0 : 1,
                        lte: lowStockQuantity,
                    },
                },
            },
            include: {
                stock: {
                    select: {
                        availableQuantity: true,
                    },
                },
            },
        });

        const itemWithStock = plainToInstance(ItemDto, itemStockItems, { excludeExtraneousValues: true })
        return itemWithStock
    }
    catch (error) {
        throw error
    }
}

let getSoldItemRanking = async (databaseName: string, startDate: string, endDate: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const salesIDArray = (await salesService.getTotalSales(databaseName, startDate, endDate)).map(sales => sales.id)

        const top5SoldSalesItems = await tenantPrisma.salesItem.groupBy({
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

        const leastSoldSalesItems = await tenantPrisma.salesItem.groupBy({
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
                const stockItem = await getById(databaseName, item.itemId)
                const soldItem: ItemSoldObject = {
                    item: stockItem,
                    quantitySold: item._count.itemId
                }

                return soldItem
            })
        )

        let leastSoldItem: ItemSoldObject | null = null
        if (leastSoldSalesItems.length > 0) {
            const leastSoldSalesItem = leastSoldSalesItems[0]
            const stockItem = await getById(databaseName, leastSoldSalesItem.itemId)
            leastSoldItem = {
                item: stockItem,
                quantitySold: leastSoldSalesItem._count.itemId
            }
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
    getAllRaw,
    getByIdRaw,
    getAll,
    getAllBySupplierId,
    getById,
    createMany,
    update,
    remove,
    getSoldItemRanking,
    getLowStockItemCount,
    getLowStockItems
}