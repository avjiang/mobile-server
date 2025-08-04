import { PrismaClient, Category, Outlet } from "../../prisma/client"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { getTenantPrisma } from '../db';

let getAll = async (databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const outlets = await tenantPrisma.outlet.findMany({
            where: {
                deleted: false
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        return outlets;
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

export = { getAll, getById }