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
 * Get warehouse stock balance
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

        // Get stock balances with item details
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
                        price: true
                    }
                }
            },
            skip,
            take,
            orderBy: {
                updatedAt: 'desc'
            }
        });

        const total = await tenantPrisma.warehouseStockBalance.count({
            where: {
                warehouseId,
                deleted: false
            }
        });

        return {
            data: stockBalances,
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
