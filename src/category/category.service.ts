import { PrismaClient, Category } from "@prisma/client"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { getTenantPrisma } from '../db';

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

export = { getAll, getById, createMany, update, remove }