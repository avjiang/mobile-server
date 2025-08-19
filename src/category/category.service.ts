import { SyncRequest } from "src/item/item.request";
import { PrismaClient, Category } from "@tenant-prisma"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { getTenantPrisma } from '../db';
import { get } from "http";

let getAll = async (databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const categories = await tenantPrisma.category.findMany({
            include: {
                _count: {
                    select: { items: true }
                }
            }
        })
        return categories.map(category => ({
            ...category,
            itemCount: category._count.items,
            _count: undefined
        }))
    }
    catch (error) {
        throw error
    }
}

let getAllCategories = async (
    databaseName: string,
    syncRequest: SyncRequest
): Promise<{ categories: any[]; total: number; serverTimestamp: string }> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { lastSyncTimestamp, lastVersion, skip = 0, take = 100 } = syncRequest;

    try {
        // Parse last sync timestamp or use a default (e.g., epoch start)
        const lastSync = (lastSyncTimestamp && lastSyncTimestamp !== 'null') ?
            new Date(lastSyncTimestamp) : new Date(0);

        // Build query conditions
        let where: any;

        if (lastVersion) {
            where = { version: { gt: lastVersion } };
        } else {
            // Delta change detection for categories only
            where = {
                OR: [
                    // Direct category changes
                    { createdAt: { gte: lastSync } },
                    { updatedAt: { gte: lastSync } },
                    { deletedAt: { gte: lastSync } }
                ],
                deleted: false
            };
        }

        // Count total matching records
        const total = await tenantPrisma.category.count({ where });

        // Fetch paginated categories with item count
        const categories = await tenantPrisma.category.findMany({
            where,
            skip,
            take,
            include: {
                _count: {
                    select: { items: true }
                }
            }
        });

        // Transform response to include itemCount at root level
        const transformedCategories = categories.map(category => ({
            ...category,
            itemCount: category._count.items,
            _count: undefined
        }));

        return {
            categories: transformedCategories,
            total,
            serverTimestamp: new Date().toISOString(),
        };
    } catch (error) {
        throw error;
    }
};

let getById = async (databaseName: string, id: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const category = await tenantPrisma.category.findUnique({
            where: {
                id: id
            }
        })
        if (!category) {
            throw new NotFoundError("Category")
        }
        return category
    }
    catch (error) {
        throw error
    }
}

let createMany = async (databaseName: string, categories: Category[]) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // Check for existing category names
        const categoryNames = categories.map(cat => cat.name);
        const existingCategories = await tenantPrisma.category.findMany({
            where: {
                name: { in: categoryNames },
                deleted: false
            },
            select: { name: true }
        });

        if (existingCategories.length > 0) {
            const existingNames = existingCategories.map(cat => cat.name);
            throw new RequestValidateError(`Category names already exist: ${existingNames.join(', ')}`);
        }

        await tenantPrisma.category.createMany({
            data: categories,
        });
        const createdCategories = await tenantPrisma.category.findMany({
            where: {
                // Assuming categories have a unique field like 'name' or you can use other criteria
                name: { in: categories.map(cat => cat.name) },
            },
        });
        return createdCategories;
    }
    catch (error) {
        throw error
    }
}

let update = async (databaseName: string, category: Category) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // Check if category name already exists (excluding current category)
        const existingCategory = await tenantPrisma.category.findFirst({
            where: {
                name: category.name,
                id: { not: category.id },
                deleted: false
            }
        });

        if (existingCategory) {
            throw new RequestValidateError(`Category name '${category.name}' already exists`);
        }

        const updatedCategory = await tenantPrisma.category.update({
            where: {
                id: category.id
            },
            data: category
        })
        return updatedCategory
    }
    catch (error) {
        throw error
    }
}

let remove = async (databaseName: string, id: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const updatedCategory = await tenantPrisma.category.update({
            where: {
                id: id
            },
            data: {
                deleted: true
            }
        })
        return updatedCategory
    }
    catch (error) {
        throw error
    }
}

export = { getAll, getAllCategories, getById, createMany, update, remove }