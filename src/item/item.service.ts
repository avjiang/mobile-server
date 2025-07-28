import { PrismaClient, Item, Prisma } from "@prisma/client"
import { Decimal } from 'decimal.js';
import { NotFoundError } from "../api-helpers/error"
import salesService from "../sales/sales.service"
import { ItemDto, ItemSoldObject, ItemSoldRankingResponseBody } from "./item.response"
import { plainToInstance } from "class-transformer"
import { getTenantPrisma } from '../db';
import { SyncRequest } from "./item.request"

let getAll = async (
    databaseName: string,
    syncRequest: SyncRequest
): Promise<{ items: any[]; total: number; serverTimestamp: string }> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { lastSyncTimestamp, lastVersion, skip = 0, take = 100 } = syncRequest;

    try {
        // Parse last sync timestamp or use a default (e.g., epoch start)
        const lastSync = (lastSyncTimestamp && lastSyncTimestamp !== 'null') ?
            new Date(lastSyncTimestamp) : new Date(0);

        // Build query conditions - add deleted filter
        const where = lastVersion
            ? { version: { gt: lastVersion }, deleted: false }
            : {
                deleted: false,
                OR: [
                    { createdAt: { gte: lastSync } },
                    { updatedAt: { gte: lastSync } },
                    { deletedAt: { gte: lastSync } },
                ],
            };
        // Count total changes
        const total = await tenantPrisma.item.count({ where });

        // Fetch paginated items
        const items = await tenantPrisma.item.findMany({
            where,
            skip,
            take,
        });
        // Map to DTO
        const response = items.map((item) => ({
            ...item,
        }));
        // Return with server timestamp
        return {
            items: response,
            total,
            serverTimestamp: new Date().toISOString(),
        };
    } catch (error) {
        throw error;
    }
};

let getByIdRaw = async (databaseName: string, id: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const item = await tenantPrisma.item.findUnique({
            where: {
                id: id
            },
            include: {
                stockBalance: true,
                stockMovements: true
            }
        })
        return item
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
                        availableQuantity: true,
                        reorderThreshold: true
                    }
                }
            }
        })
        const response = items.map(({ stockBalance, ...item }) => ({
            ...item,
            stockQuantity: stockBalance[0]?.availableQuantity || 0,
            reorderThreshold: stockBalance[0]?.reorderThreshold || 0,
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
                        availableQuantity: true,
                        reorderThreshold: true
                    }
                }
            }
        })
        const response = items.map(({ stockBalance, ...item }) => ({
            ...item,
            stockQuantity: stockBalance[0]?.availableQuantity || 0,
            reorderThreshold: stockBalance[0]?.reorderThreshold || 0,
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
        const rawItemWithStock = {
            ...item,
            stockQuantity: item.stockBalance[0]?.availableQuantity || 0
        };
        return rawItemWithStock
    }
    catch (error) {
        throw error
    }
}

let createMany = async (databaseName: string, itemBodyArray: ItemDto[]) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const createdItems = await tenantPrisma.$transaction(async (tx) => {
            // Create items with nested relations in parallel
            return Promise.all(
                itemBodyArray.map((itemBody) => {
                    const { stockQuantity, id, categoryId, supplierId, reorderThreshold, ...itemWithoutId } = itemBody;
                    return tx.item.create({
                        data: {
                            ...itemWithoutId,
                            stockBalance: {
                                create: {
                                    outletId: 1,
                                    availableQuantity: stockQuantity,
                                    onHandQuantity: stockQuantity,
                                    deleted: false,
                                    reorderThreshold: reorderThreshold || 0,
                                },
                            },
                            stockMovements: {
                                create: {
                                    previousAvailableQuantity: 0,
                                    previousOnHandQuantity: 0,
                                    availableQuantityDelta: stockQuantity,
                                    onHandQuantityDelta: stockQuantity,
                                    documentId: 0,
                                    movementType: "Create Item",
                                    reason: "",
                                    remark: "",
                                    outletId: 1,
                                    deleted: false,
                                },
                            },
                            supplier: {
                                connect: { id: supplierId },
                            },
                            category: {
                                connect: { id: categoryId },
                            },
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            version: 1,
                        },
                        include: {
                            stockBalance: true,
                        },
                    });
                })
            );
        });

        const response = createdItems.map((item, index) => ({
            ...item,
            stockBalanceId: item.stockBalance[0]?.id || null,
            stockBalance: undefined,
            stockQuantity: itemBodyArray[index].stockQuantity || 0,
        }));

        return response;
    } catch (error) {
        throw error;
    } finally {
        await tenantPrisma.$disconnect();
    }
};

let update = async (databaseName: string, item: Item & { reorderThreshold?: number }) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // Extract id, version, and relation fields from the item object
        const { id, version, categoryId, supplierId, reorderThreshold, ...updateData } = item;

        const updatedItem = await tenantPrisma.$transaction(async (tx) => {
            // Update the item
            const itemUpdate = await tx.item.update({
                where: {
                    id: id
                },
                data: {
                    ...updateData,
                    ...(categoryId && {
                        category: {
                            connect: { id: categoryId }
                        }
                    }),
                    ...(supplierId && {
                        supplier: {
                            connect: { id: supplierId }
                        }
                    }),
                    updatedAt: new Date(),
                }
            });

            // Update reorderThreshold in StockBalance if provided
            if (reorderThreshold !== undefined) {
                await tx.stockBalance.updateMany({
                    where: {
                        itemId: id,
                        deleted: false
                    },
                    data: {
                        reorderThreshold: reorderThreshold,
                        updatedAt: new Date()
                    }
                });
            }

            return itemUpdate;
        });

        return updatedItem;
    }
    catch (error) {
        throw error;
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
                    where: {
                        deleted: false,
                        outletId: 1,
                    },
                },
                category: true,
                supplier: true
            },
        });
        // Step 4: Enrich items with total availableQuantity
        const enrichedItems = await Promise.all(items.map(async (item) => {
            const supplier = await tenantPrisma.supplier.findUnique({
                where: { id: item.supplierId }
            });
            return {
                ...item,
                stockBalance: undefined,
                category: undefined,
                supplier: undefined,
                lastRestockDate: item.stockBalance[0]?.updatedAt || null,
                supplierName: supplier?.companyName || "",
                stockQuantity:
                    lowStockItems.find((ls) => ls.itemId === item.id)?._sum
                        .availableQuantity || 0,
            };
        }));
        return enrichedItems;
    }
    catch (error) {
        throw error
    }
}

let getSoldItemsBySessionId = async (databaseName: string, sessionId: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // Get all sales IDs for the specified session - only completed sales
        const salesWithSession = await tenantPrisma.sales.findMany({
            where: {
                sessionId: sessionId,
                status: "Completed", // Only include completed sales
                deleted: false
            },
            select: {
                id: true
            }
        });

        const salesIDArray = salesWithSession.map(sales => sales.id);
        if (salesIDArray.length === 0) {
            return {
                topSoldItems: [],
                leastSoldItem: null
            };
        }

        // Get the top 5 sales items for these sales and group them by itemId
        const topSoldItemsData = await tenantPrisma.salesItem.groupBy({
            by: ['itemId'],
            _count: {
                itemId: true,
            },
            _sum: {
                quantity: true,
            },
            where: {
                salesId: {
                    in: salesIDArray,
                },
                deleted: false
            },
            orderBy: {
                _sum: {
                    quantity: 'desc',
                },
            },
            take: 5,
        });

        if (topSoldItemsData.length === 0) {
            return {
                topSoldItems: [],
            };
        }

        const topSoldItems = [];
        for (const soldItem of topSoldItemsData) {
            const itemDetails = await getById(databaseName, soldItem.itemId);
            if (!itemDetails) continue;

            const quantitySold = soldItem._sum.quantity ? new Decimal(soldItem._sum.quantity) : new Decimal(0);
            const itemPrice = itemDetails.price ? new Decimal(itemDetails.price) : new Decimal(0);

            topSoldItems.push({
                item: itemDetails,
                quantitySold: quantitySold.toNumber(),
                totalRevenue: itemPrice.mul(quantitySold)
            });
        }
        return {
            topSoldItems,
        };
    }
    catch (error) {
        console.error("Error in getSoldItemsBySessionId:", error);
        throw error;
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
    getSoldItemsBySessionId,
    getLowStockItemCount,
    getLowStockItems,
    getAllByCategoryId,
}