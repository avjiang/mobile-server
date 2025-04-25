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
                stockBalance: true,
                stockMovement: true
            }
        })
        return item
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
                stockBalance: {
                    select: {
                        availableQuantity: true
                    }
                }
            }
        })
        const response = items.map(({ stockBalance, ...item }) => ({
            ...item,
            stockQuantity: stockBalance[0]?.availableQuantity || 0,
        }));
        return response;
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
                stockBalance: {
                    select: {
                        availableQuantity: true
                    }
                }
            }
        })
        const response = items.map(({ stockBalance, ...item }) => ({
            ...item,
            stockQuantity: stockBalance[0]?.availableQuantity || 0,
        }));
        return response;
    }
    catch (error) {
        throw error
    }
}

let getAllByCategoryId = async (databaseName: string, categoryId: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const items = await tenantPrisma.item.findMany({
            where: {
                categoryId: categoryId
            },
            include: {
                stockBalance: {
                    select: {
                        availableQuantity: true
                    }
                }
            }
        })
        const response = items.map(({ stockBalance, ...item }) => ({
            ...item,
            stockQuantity: stockBalance[0]?.availableQuantity || 0,
        }));
        return response;
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
                stockBalance: {
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
                        stockBalance: {
                            create: {
                                outletId: 1,
                                availableQuantity: stockQuantity,
                                onHandQuantity: stockQuantity,
                                lastUpdated: new Date(),
                                deleted: false,
                            },
                        },
                        stockMovement: {
                            create: [
                                {
                                    availableQuantityDelta: stockQuantity,
                                    onHandQuantityDelta: stockQuantity,
                                    documentId: 0,
                                    movementType: "Create Item",
                                    reason: "",
                                    remark: "",
                                    outletId: 1,
                                    deleted: false
                                }
                            ]
                        },
                        category: {
                            connect: { id: item.categoryId },
                        }
                    }
                })
            })
        );
        const response = createdItems.map((item, index) => ({
            ...item,
            stockQuantity: itemBodyArray[index].stockQuantity || 0, // Use stockQuantity from input
        }));
        return response;
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
        // const item = await getByIdRaw(databaseName, id)
        // if (!item) {
        //     throw new NotFoundError("Item")
        // }
        // await tenantPrisma.$transaction(async (tx) => {
        //     await tx.stockMovement.updateMany({ where: { itemId: id }, data: { deleted: true } }),
        //         await tx.stockBalance.update({
        //             where: {
        //                 id: (await tx.item.findUnique({
        //                     where: { id: id },
        //                     select: { stockId: true },
        //                 }))?.stockId,
        //             },
        //             data: {
        //                 deleted: true,
        //             },
        //         }),
        //         await tx.item.update({ where: { id: id }, data: { deleted: true } })
        // })
        const updatedItem = await tenantPrisma.$transaction([
            // Soft-delete the Item
            tenantPrisma.item.update({
                where: { id: id },
                data: {
                    deleted: true,
                    deletedAt: new Date(),
                },
            }),
            // Soft-delete all related StockBalance records
            tenantPrisma.stockBalance.updateMany({
                where: { id },
                data: {
                    deleted: true,
                    deletedAt: new Date(),
                },
            }),
        ]);

        return updatedItem[0];
    }
    catch (error) {
        throw error
    }
}

let getLowStockItemCount = async (databaseName: string, lowStockQuantity: number, isIncludedZeroStock: boolean) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // const itemStockItems = await tenantPrisma.item.findMany({
        //     where: {
        //         stockBalance: {
        //             availableQuantity: {
        //                 gte: isIncludedZeroStock ? 0 : 1,
        //                 lte: lowStockQuantity,
        //             },
        //         },
        //     },
        //     include: {
        //         stockBalance: {
        //             select: {
        //                 availableQuantity: true,
        //             },
        //         },
        //     },
        // });
        // return itemStockItems.length;

        const lowStockItems = await tenantPrisma.stockBalance.groupBy({
            by: ['itemId'],
            where: {
                deleted: false,
                outletId: 1, // Ensure the StockBalance is for the main outlet
                item: { deleted: false }, // Ensure the Item is not soft-deleted
            },
            _sum: {
                availableQuantity: true,
            },
            having: {
                availableQuantity: {
                    _sum: {
                        lt: lowStockQuantity, // Total availableQuantity < threshold
                    },
                },
            },
        });
        return lowStockItems.length;
    }
    catch (error) {
        throw error
    }
}

let getLowStockItems = async (databaseName: string, lowStockQuantity: number, isIncludedZeroStock: boolean) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // const itemStockItems = await tenantPrisma.item.findMany({
        //     where: {
        //         stock: {
        //             availableQuantity: {
        //                 gte: isIncludedZeroStock ? 0 : 1,
        //                 lte: lowStockQuantity,
        //             },
        //         },
        //     },
        //     include: {
        //         stock: {
        //             select: {
        //                 availableQuantity: true,
        //             },
        //         },
        //     },
        // });
        // const itemWithStock = plainToInstance(ItemDto, itemStockItems, { excludeExtraneousValues: true })
        // return itemWithStock

        const lowStockItems = await tenantPrisma.stockBalance.groupBy({
            by: ['itemId'],
            where: {
                deleted: false,
                outletId: 1, // Ensure the StockBalance is for the main outlet
                item: { deleted: false },
            },
            _sum: {
                availableQuantity: true,
            },
            having: {
                availableQuantity: {
                    _sum: {
                        lt: lowStockQuantity,
                    },
                },
            },
        });
        const itemIds = lowStockItems.map((item) => item.itemId);
        const items = await tenantPrisma.item.findMany({
            where: {
                id: { in: itemIds },
                deleted: false,
            },
            include: {
                stockBalance: {
                    where: { deleted: false },

                },
                category: true, // Include category if needed
            },
        });

        // Step 4: Enrich items with total availableQuantity
        const enrichedItems = items.map((item) => ({
            ...item,
            totalAvailableQuantity:
                lowStockItems.find((ls) => ls.itemId === item.id)?._sum
                    .availableQuantity || 0,
        }));

        return enrichedItems;

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
    getByIdRaw,
    getAll,
    getAllBySupplierId,
    getById,
    createMany,
    update,
    remove,
    getSoldItemRanking,
    getLowStockItemCount,
    getLowStockItems,
    getAllByCategoryId
}