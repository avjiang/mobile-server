import { PrismaClient, Category, Outlet } from "../../prisma/client/generated/client"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { getTenantPrisma } from '../db';
import { UserInfo } from "../middleware/authorize-middleware";
import { SyncRequest } from "src/item/item.request";

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

let getOutletSync = async (
    databaseName: string,
    user: UserInfo,
    syncRequest: SyncRequest,
): Promise<{ data: any[]; total: number; serverTimestamp: string }> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { lastSyncTimestamp, lastVersion, skip = 0, take = 100 } = syncRequest;

    let where: any;

    if (!lastSyncTimestamp || lastSyncTimestamp === 'null') {
        where = lastVersion ? { version: { gt: lastVersion } } : {};
    } else {
        const lastSync = new Date(lastSyncTimestamp);
        where = lastVersion
            ? { version: { gt: lastVersion } }
            : {
                OR: [
                    { createdAt: { gte: lastSync } },
                    { updatedAt: { gte: lastSync } },
                    { deletedAt: { gte: lastSync } },
                ],
            };
    }

    if (user.role !== "admin") {
        where = Object.keys(where).length === 0
            ? { id: { in: user.allowedOutletIds || [] } }
            : { AND: [where, { id: { in: user.allowedOutletIds || [] } }] };
    }

    const total = await tenantPrisma.outlet.count({ where });
    const outlets = await tenantPrisma.outlet.findMany({ where, skip, take });

    const data = outlets.map(outlet => {
        const { tenantOutletId, ...rest } = outlet;
        return { globalOutletId: tenantOutletId, ...rest };
    });

    return { data, total, serverTimestamp: new Date().toISOString() };
};

export = { getAll, getOutletSync }