import { PrismaClient } from "../../prisma/client/generated/client";
import { NotFoundError, RequestValidateError } from "../api-helpers/error";
import { getTenantPrisma } from '../db';
import { SyncWarehouseRequest } from "./warehouse.request";

/**
 * Get all warehouses with delta sync support
 * Customer-facing - read-only access to their warehouses
 */
let getAll = async (
    databaseName: string,
    syncRequest: SyncWarehouseRequest
): Promise<{ warehouses: any[]; total: number; serverTimestamp: string }> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { lastSyncTimestamp, skip = 0, take = 100 } = syncRequest;

    try {
        // Parse last sync timestamp or use a default (e.g., epoch start)
        const lastSync = (lastSyncTimestamp && lastSyncTimestamp !== 'null') ?
            new Date(lastSyncTimestamp) : new Date(0);

        // Build query conditions with delta sync
        const where: any = {
            OR: [
                { createdAt: { gte: lastSync } },
                { updatedAt: { gte: lastSync } },
                { deletedAt: { gte: lastSync } },
            ],
        };

        // Count total matching records
        const total = await tenantPrisma.warehouse.count({ where });

        // Fetch paginated warehouses
        const warehouses = await tenantPrisma.warehouse.findMany({
            where,
            skip,
            take,
            orderBy: [
                { updatedAt: 'desc' },
                { createdAt: 'desc' }
            ]
        });

        return {
            warehouses,
            total,
            serverTimestamp: new Date().toISOString(),
        };
    } catch (error) {
        throw error;
    }
};

/**
 * Get single warehouse by ID
 */
let getById = async (databaseName: string, warehouseId: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);

    try {
        const warehouse = await tenantPrisma.warehouse.findUnique({
            where: {
                id: warehouseId,
                deleted: false
            }
        });

        if (!warehouse) {
            throw new NotFoundError("Warehouse not found");
        }

        return warehouse;
    } catch (error) {
        throw error;
    }
};

/**
 * Get warehouse stock balance (with variant support)
 */
let getWarehouseStock = async (
    databaseName: string,
    warehouseId: number,
    skip: number = 0,
    take: number = 100
) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);

    try {
        // Validate warehouse exists
        const warehouse = await tenantPrisma.warehouse.findUnique({
            where: { id: warehouseId, deleted: false }
        });

        if (!warehouse) {
            throw new NotFoundError("Warehouse not found");
        }

        // Get stock balances with item and variant details
        const stockBalances = await tenantPrisma.warehouseStockBalance.findMany({
            where: {
                warehouseId,
                deleted: false
            },
            include: {
                item: {
                    select: {
                        id: true,
                        itemName: true,
                        itemCode: true,
                        itemType: true,
                        unitOfMeasure: true,
                        cost: true,
                        price: true,
                        hasVariants: true,
                    }
                },
                itemVariant: {
                    select: {
                        id: true,
                        variantSku: true,
                        variantName: true,
                    }
                }
            },
            skip,
            take,
            orderBy: {
                updatedAt: 'desc'
            }
        });

        // Group variant stocks under parent items by itemId
        const stockMap = new Map<number, any>();

        for (const stock of stockBalances) {
            if (stock.itemVariantId === null) {
                // This is a base item stock (no variant)
                if (!stockMap.has(stock.itemId)) {
                    const { itemVariant, ...stockData } = stock;
                    stockMap.set(stock.itemId, {
                        ...stockData,
                        variants: stock.item?.hasVariants ? [] : null,
                    });
                } else {
                    // Base stock already exists from variant, update it
                    const existing = stockMap.get(stock.itemId);
                    const { itemVariant, ...stockData } = stock;
                    stockMap.set(stock.itemId, {
                        ...stockData,
                        variants: existing.variants,
                    });
                }
            } else {
                // This is a variant stock
                if (!stockMap.has(stock.itemId)) {
                    // Create placeholder for parent
                    stockMap.set(stock.itemId, {
                        id: null,
                        itemId: stock.itemId,
                        warehouseId: stock.warehouseId,
                        availableQuantity: 0,
                        onHandQuantity: 0,
                        itemVariantId: null,
                        deleted: false,
                        version: 0,
                        item: stock.item,
                        variants: [],
                    });
                }

                const parent = stockMap.get(stock.itemId);
                if (!parent.variants) parent.variants = [];

                // Add variant to parent's variants array
                const { itemVariant, item, ...stockData } = stock;
                parent.variants.push({
                    ...stockData,
                    variantSku: itemVariant?.variantSku,
                    variantName: itemVariant?.variantName,
                });
            }
        }

        // Count total unique items (not stock balance records)
        const total = stockMap.size;

        return {
            data: Array.from(stockMap.values()),
            total,
            serverTimestamp: new Date().toISOString()
        };
    } catch (error) {
        throw error;
    }
};

export = {
    getAll,
    getById,
    getWarehouseStock
};
