import { PrismaClient, Category, Outlet } from "../../prisma/client/generated/client"
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

        // Map tenantOutletId to globalOutletId
        return outlets.map(outlet => {
            const { tenantOutletId, ...rest } = outlet;
            return {
                globalOutletId: tenantOutletId,
                ...rest,
            };
        });
    }
    catch (error) {
        throw error
    }
}

export = { getAll }