import { PrismaClient, Category, Outlet } from "../../prisma/client/generated/client"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { getTenantPrisma } from '../db';
import { UserInfo } from "../middleware/authorize-middleware";

let getAll = async (databaseName: string, user: UserInfo) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const whereClause: any = { deleted: false };
        if (user.role !== "admin") {
            whereClause.id = { in: user.allowedOutletIds || [] };
        }

        const outlets = await tenantPrisma.outlet.findMany({
            where: whereClause,
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