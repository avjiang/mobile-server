import { PrismaClient } from "../../prisma/client/generated/client"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { getTenantPrisma, getGlobalPrisma } from '../db';
import { SyncRequest } from "src/item/item.request";
import { UpdateUserRequestBody, ChangePasswordRequest } from "./user.request";
import NotificationService from '../pushy/notification.service';
import bcrypt from "bcryptjs";

let getAll = async (
    databaseName: string,
    syncRequest: SyncRequest
): Promise<{ users: any[]; total: number; serverTimestamp: string }> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { lastSyncTimestamp, lastVersion, skip = 0, take = 100 } = syncRequest;

    try {
        // Parse last sync timestamp or use a default (e.g., epoch start)
        const lastSync = (lastSyncTimestamp && lastSyncTimestamp !== 'null') ?
            new Date(lastSyncTimestamp) : new Date(0);

        // Build query conditions - optimized for index usage
        const where = lastVersion
            ? { version: { gt: lastVersion }, deleted: false }
            : {
                deleted: false,
                OR: [
                    { createdAt: { gte: lastSync } },
                    { updatedAt: { gte: lastSync } },
                    { deletedAt: { gte: lastSync } },
                ]
            };

        // Use parallel queries for better performance
        const [total, users] = await Promise.all([
            tenantPrisma.user.count({ where }),
            tenantPrisma.user.findMany({
                where,
                skip,
                take,
                select: {
                    id: true,
                    username: true,
                    lastName: true,
                    firstName: true,
                    mobile: true,
                    email: true,
                    deleted: true,
                    deletedAt: true,
                    createdAt: true,
                    updatedAt: true,
                    version: true,
                    // More efficient role counting using direct count query
                    roles: {
                        where: { deleted: false },
                        select: { id: true } // Only select id for counting
                    }
                }
            })
        ]);

        // Transform users to include roleCount more efficiently
        const usersWithRoleCount = users.map(user => ({
            ...user,
            roleCount: user.roles.length,
            roles: undefined // Remove roles array from response
        }));

        return {
            users: usersWithRoleCount,
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
        // Consider caching this query result for frequently accessed users
        const user = await tenantPrisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                username: true,
                lastName: true,
                firstName: true,
                mobile: true,
                email: true,
                deleted: true,
                deletedAt: true,
                createdAt: true,
                updatedAt: true,
                version: true,
                roles: {
                    where: { deleted: false },
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        createdAt: true,
                        updatedAt: true
                    }
                }
            }
        });

        if (!user || user.deleted) {
            throw new NotFoundError("User");
        }

        return user;
    }
    catch (error) {
        throw error;
    }
}

let update = async (databaseName: string, userId: number, updateData: UpdateUserRequestBody) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // Optimize existence and uniqueness checks with parallel queries
        const [existingUser, existingUsername, existingEmail] = await Promise.all([
            tenantPrisma.user.findUnique({
                where: { id: userId },
                select: { id: true, deleted: true }
            }),
            updateData.username ? tenantPrisma.user.findFirst({
                where: {
                    username: updateData.username,
                    id: { not: userId },
                    deleted: false
                },
                select: { id: true }
            }) : Promise.resolve(null),
            updateData.email ? tenantPrisma.user.findFirst({
                where: {
                    email: updateData.email,
                    id: { not: userId },
                    deleted: false
                },
                select: { id: true }
            }) : Promise.resolve(null)
        ]);

        if (!existingUser || existingUser.deleted) {
            throw new NotFoundError("User");
        }

        if (existingUsername) {
            throw new RequestValidateError(`Username '${updateData.username}' already exists`);
        }

        if (existingEmail) {
            throw new RequestValidateError(`Email '${updateData.email}' already exists`);
        }

        // Prepare user data (exclude roles from direct update)
        const { roles, ...userData } = updateData;

        // Minimize transaction scope for better performance
        const updatedUser = await tenantPrisma.$transaction(async (prisma) => {
            const updatePayload: any = {
                ...userData,
                updatedAt: new Date(),
                version: { increment: 1 }
            };

            // Handle role assignments if provided
            if (roles && roles.length > 0) {
                const roleIds = roles.map(role => role.id);

                // Optimize role existence check
                const roleCount = await prisma.role.count({
                    where: {
                        id: { in: roleIds },
                        deleted: false
                    }
                });

                if (roleCount !== roleIds.length) {
                    throw new RequestValidateError("One or more roles do not exist");
                }

                // Get current role assignments to determine changes
                const currentUser = await prisma.user.findUnique({
                    where: { id: userId },
                    include: {
                        roles: {
                            where: { deleted: false },
                            select: { id: true }
                        }
                    }
                });

                const currentRoleIds = currentUser?.roles.map(role => role.id) || [];
                const removedRoleIds = currentRoleIds.filter(id => !roleIds.includes(id));
                const addedRoleIds = roleIds.filter(id => !currentRoleIds.includes(id));

                updatePayload.roles = {
                    set: roleIds.map(id => ({ id }))
                };

                // Update timestamps for affected roles
                const affectedRoleIds = [...removedRoleIds, ...addedRoleIds];
                if (affectedRoleIds.length > 0) {
                    await prisma.role.updateMany({
                        where: {
                            id: { in: affectedRoleIds }
                        },
                        data: {
                            updatedAt: new Date()
                        }
                    });
                }
            }

            // Update user
            await prisma.user.update({
                where: { id: userId },
                data: updatePayload
            });

            // Return updated user with optimized select
            return await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    username: true,
                    lastName: true,
                    firstName: true,
                    mobile: true,
                    email: true,
                    deleted: true,
                    deletedAt: true,
                    createdAt: true,
                    updatedAt: true,
                    version: true,
                    roles: {
                        where: { deleted: false },
                        select: {
                            id: true,
                            name: true,
                            description: true,
                            createdAt: true,
                            updatedAt: true
                        }
                    }
                }
            });
        });

        return updatedUser;
    }
    catch (error) {
        throw error;
    }
}

let changePassword = async (databaseName: string, tenantId: number, userId: number, request: ChangePasswordRequest) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const globalPrisma = getGlobalPrisma();

    try {
        // 1. Find Global User to validate credentials (primary source of truth for auth)
        const globalUser = await globalPrisma.tenantUser.findFirst({
            where: {
                tenantId: tenantId,
                username: request.username
            }
        });

        if (!globalUser) {
            throw new NotFoundError("User not found");
        }

        // 2. Find User in Tenant DB (to ensure consistency)
        const tenantUser = await tenantPrisma.user.findUnique({
            where: { id: userId }
        });

        if (!tenantUser || tenantUser.deleted) {
            throw new NotFoundError("User");
        }

        // 3. Validate Request
        if (tenantUser.username !== request.username) {
            throw new RequestValidateError('Invalid username');
        }

        // Validate New Password
        if (request.currentPassword === request.newPassword) {
            throw new RequestValidateError('New password cannot be the same as the current password');
        }

        // Validate Current Password against GLOBAL user (same as admin implementation)
        if (!globalUser.password || !bcrypt.compareSync(request.currentPassword, globalUser.password)) {
            throw new RequestValidateError('Invalid password');
        }

        const hashedPassword = bcrypt.hashSync(request.newPassword, 10);

        // 4. Update Global DB First
        await globalPrisma.tenantUser.update({
            where: { id: globalUser.id },
            data: { password: hashedPassword }
        });

        // 5. Update Tenant DB
        await tenantPrisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword, updatedAt: new Date(), version: { increment: 1 } }
        });

        return { success: true, message: 'Password updated successfully' };
    } catch (error) {
        throw error;
    }
}

export = { getAll, getById, update, changePassword }