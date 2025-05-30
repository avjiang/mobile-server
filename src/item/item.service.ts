import { PrismaClient, Item, Prisma } from "@prisma/client"
import { NotFoundError } from "../api-helpers/error"
import salesService from "../sales/sales.service"
import { ItemDto, ItemSoldObject, ItemSoldRankingResponseBody } from "./item.response"
import { plainToInstance } from "class-transformer"
import { getTenantPrisma } from '../db';
import { SyncRequest } from "./item.request"

let getAll = async (
    databaseName: string,
    syncRequest: SyncRequest
): Promise<{ items: ItemDto[]; total: number; serverTimestamp: string }> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { lastSyncTimestamp, lastVersion, skip = 0, take = 100 } = syncRequest;

    try {
        // Parse last sync timestamp or use a default (e.g., epoch start)
        const lastSync = (lastSyncTimestamp && lastSyncTimestamp !== 'null') ?
            new Date(lastSyncTimestamp) : new Date(0);

        // Build query conditions
        const where = lastVersion
            ? { version: { gt: lastVersion } }
            : {
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
            include: {
                stockBalance: {
                    select: { availableQuantity: true, id: true, reorderThreshold: true },
                },
            },
            skip,
            take,
        });
        // Map to DTO
        const response = items.map((item) => ({
            ...item,
            stockBalanceId: item.stockBalance[0]?.id || null,
            stockBalance: undefined,
            stockQuantity: item.stockBalance[0]?.availableQuantity || 0,
            reorderThreshold: item.stockBalance[0]?.reorderThreshold || 0,
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
                stockMovement: true
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
        const itemWithStock = plainToInstance(ItemDto, rawItemWithStock, { excludeExtraneousValues: true })
        return itemWithStock
    }
    catch (error) {
        throw error
    }
}

let createMany = async (databaseName: string, itemBodyArray: ItemDto[]) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const createdItems = await tenantPrisma.$transaction(async (tx) => {
            // Batch fetch categories once
            const categoryIds = [...new Set(itemBodyArray.map(item => item.categoryId))];
            const categories = await tx.category.findMany({
                where: { id: { in: categoryIds } },
                select: { id: true, name: true }
            });
            const categoryMap = new Map(categories.map(cat => [cat.id, cat]));

            // Pre-count existing items by category-brand combination to avoid sequential counts
            const brandCategoryCombos = [...new Set(
                itemBodyArray.map(item => `${item.categoryId}-${item.itemBrand}`)
            )];

            const itemCounts = await Promise.all(
                brandCategoryCombos.map(async (combo) => {
                    const [categoryId, itemBrand] = combo.split('-');
                    const count = await tx.item.count({
                        where: {
                            categoryId: parseInt(categoryId),
                            itemBrand,
                            deleted: false,
                        },
                    });
                    return { combo, count };
                })
            );
            const countMap = new Map(itemCounts.map(item => [item.combo, item.count]));

            // Generate SKUs efficiently
            const itemsWithSKUs = itemBodyArray.map((itemBody) => {
                const category = categoryMap.get(itemBody.categoryId);
                if (!category) {
                    throw new Error(`Category with ID ${itemBody.categoryId} not found`);
                }
                const categoryCode = generateCode(category.name);
                const brandCode = generateCode(itemBody.itemBrand);
                const comboKey = `${itemBody.categoryId}-${itemBody.itemBrand}`;
                const currentCount = countMap.get(comboKey) || 0;

                // Increment count for this combination to avoid duplicates within the batch
                countMap.set(comboKey, currentCount + 1);

                const sequentialNumber = currentCount.toString().padStart(4, '0');
                const sku = `${categoryCode}-${brandCode}-${sequentialNumber}`;

                return { ...itemBody, sku };
            });

            // Create items with nested relations in parallel
            return Promise.all(
                itemsWithSKUs.map((itemBody) => {
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
                            stockMovement: {
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
            return plainToInstance(ItemSoldRankingResponseBody, {
                topSoldItems: [],
                leastSoldItem: null
            }, { excludeExtraneousValues: true });
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
            return plainToInstance(ItemSoldRankingResponseBody, {
                topSoldItems: [],
                leastSoldItem: null
            }, { excludeExtraneousValues: true });
        }

        const topSoldItems = [];
        for (const soldItem of topSoldItemsData) {
            const itemDetails = await getById(databaseName, soldItem.itemId);
            if (!itemDetails) continue;
            topSoldItems.push({
                item: itemDetails,
                quantitySold: soldItem._sum.quantity || 0,
                totalRevenue: (soldItem._sum.quantity || 0) * (itemDetails.price || 0)
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

function generateCode(str: string, length: number = 4): string {
    return str
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, length)
        .toUpperCase()
        .padEnd(length, 'X');
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