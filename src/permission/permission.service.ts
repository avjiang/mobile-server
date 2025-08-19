import { PrismaClient } from "@prisma/global-prisma";
import { getGlobalPrisma, getTenantPrisma } from '../db';
import { SyncRequest } from "../item/item.request";

const prisma: PrismaClient = getGlobalPrisma()

let getAll = async (syncRequest: SyncRequest) => {
    try {
        const { skip, take, lastSyncTimestamp } = syncRequest;
        const lastSync = (lastSyncTimestamp && lastSyncTimestamp !== 'null') ?
            new Date(lastSyncTimestamp) : new Date(0);

        // Build where clause
        const whereClause: any = {
            deleted: false,
        };

        // Add timestamp filter for delta sync - check updatedAt, deletedAt, and createdAt
        if (lastSyncTimestamp) {
            whereClause.OR = [
                { updatedAt: { gt: lastSync } },
                { deletedAt: { gt: lastSync } },
                { createdAt: { gt: lastSync } }
            ];
        }

        // Get total count for pagination
        const total = await prisma.permission.count({
            where: whereClause
        });

        // Get permissions with pagination
        const permissions = await prisma.permission.findMany({
            where: whereClause,
            orderBy: {
                updatedAt: 'desc'
            },
            skip: skip,
            take: take
        });

        const serverTimestamp = new Date().toISOString();

        return {
            data: permissions,
            total,
            serverTimestamp
        };
    }
    catch (error) {
        throw error
    }
}

export = { getAll }