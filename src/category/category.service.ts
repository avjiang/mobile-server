import { PrismaClient, Category } from "@prisma/client"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { getTenantPrisma } from '../db';

let getAll = async (databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const categories = await tenantPrisma.category.findMany()
        return categories
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
        const newCategories = await tenantPrisma.category.createMany({
            data: categories
        })
        return newCategories.count
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