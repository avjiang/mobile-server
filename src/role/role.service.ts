import { PrismaClient, Category } from "../../prisma/client/generated/client"
import { PrismaClient as GlobalPrismaClient } from "../../prisma/global-client/generated/global";
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { getTenantPrisma, getGlobalPrisma } from '../db';
import { CreateRoleRequestBody } from "./role.request";
import { SyncRequest } from "src/item/item.request";

const globalPrisma: GlobalPrismaClient = getGlobalPrisma();

// stock function
let getAll = async (
    databaseName: string,
    userId: number,
    tenantId: number,
    planName: string | null | undefined,
    syncRequest: SyncRequest
): Promise<{ roles: any[]; total: number; serverTimestamp: string; notificationTopics?: string[] }> => {
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
            // Simplified delta change detection - now that we update Role.updatedAt
            // for user assignment changes, we can rely on role timestamps
            where = {
                OR: [
                    // Direct role changes (including user assignment changes)
                    { createdAt: { gte: lastSync } },
                    { updatedAt: { gte: lastSync } },
                    { deletedAt: { gte: lastSync } },
                    // Role permission changes
                    {
                        permission: {
                            some: {
                                OR: [
                                    { createdAt: { gte: lastSync } },
                                    { updatedAt: { gte: lastSync } },
                                    { deletedAt: { gte: lastSync } }
                                ]
                            }
                        }
                    }
                ],
            };
        }

        // Count total matching records
        const total = await tenantPrisma.role.count({ where });

        // Fetch paginated roles with role permissions and user details
        const roles = await tenantPrisma.role.findMany({
            where,
            skip,
            take,
            include: {
                permission: {
                    where: {
                        deleted: false
                    }
                },
                users: {
                    where: {
                        deleted: false
                    },
                    select: {
                        id: true,
                        email: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                        createdAt: true,
                        updatedAt: true,
                        deleted: true,
                        deletedAt: true
                    }
                }
            }
        });

        // Check if current user's permissions were affected by role changes
        // Only include notificationTopics on first page (skip=0) to avoid duplicates in pagination
        // Only for Pro plan tenants (push notifications feature)
        let notificationTopics: string[] | undefined = undefined;

        if (skip === 0 && planName === 'Pro') {
            // On first page, check if user is affected by ANY role changes (not just current page)
            // This ensures we detect changes even if user's role is on a later page
            if (!lastSyncTimestamp) {
                // Initial sync - check if user has active device before generating topics
                const hasActiveDevice = await checkUserHasActiveDevice(tenantId, userId, databaseName);
                if (hasActiveDevice) {
                    notificationTopics = await generateNotificationTopics(tenantId, userId, databaseName);
                } else {
                    // Return empty array to force frontend to unsubscribe from all topics
                    notificationTopics = [];
                }
            } else if (total > 0) {
                // Get ALL changed role IDs (not paginated) for accurate user impact check
                const allChangedRoleIds = await tenantPrisma.role.findMany({
                    where,
                    select: { id: true }
                });

                const currentUserAffected = await checkIfUserAffectedByRoleChanges(
                    tenantPrisma,
                    userId,
                    allChangedRoleIds.map(r => r.id),
                    lastSync
                );

                if (currentUserAffected) {
                    // Check if user has active device before generating topics
                    const hasActiveDevice = await checkUserHasActiveDevice(tenantId, userId, databaseName);
                    if (hasActiveDevice) {
                        notificationTopics = await generateNotificationTopics(tenantId, userId, databaseName);
                    } else {
                        // Return empty array to force frontend to unsubscribe from all topics
                        notificationTopics = [];
                    }
                }
            }
        }

        return {
            roles,
            total,
            serverTimestamp: new Date().toISOString(),
            notificationTopics
        };
    } catch (error) {
        throw error;
    }
};

// Helper: Check if user is affected by role changes
const checkIfUserAffectedByRoleChanges = async (
    tenantPrisma: PrismaClient,
    userId: number,
    changedRoleIds: number[],
    lastSync?: Date
): Promise<boolean> => {
    if (changedRoleIds.length === 0 && lastSync) {
        return false;
    }

    // Check if user is assigned to any of the changed roles
    const userWithChangedRoles = await tenantPrisma.user.findFirst({
        where: {
            id: userId,
            deleted: false,
            roles: {
                some: changedRoleIds.length > 0 ? {
                    id: { in: changedRoleIds },
                    deleted: false
                } : { deleted: false }
            }
        }
    });

    return userWithChangedRoles !== null;
};

// Helper: Check if user has an active device with allocation
const checkUserHasActiveDevice = async (
    tenantId: number,
    userId: number,
    databaseName: string
): Promise<boolean> => {
    try {
        const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);

        // Get user from tenant database
        const user = await tenantPrisma.user.findUnique({
            where: { id: userId },
            select: { username: true }
        });

        if (!user) {
            return false;
        }

        // Get global tenant user
        const globalTenantUser = await globalPrisma.tenantUser.findFirst({
            where: {
                username: user.username,
                tenantId: tenantId
            },
            select: { id: true }
        });

        if (!globalTenantUser) {
            return false;
        }

        // Check if user has any active device with allocation
        const activeDevice = await globalPrisma.pushyDevice.findFirst({
            where: {
                tenantUserId: globalTenantUser.id,
                isActive: true,
                allocation: {
                    isNot: null
                }
            }
        });

        return activeDevice !== null;
    } catch (error) {
        console.error('Error checking user active device:', error);
        return false;
    }
};

// Helper: Generate notification topics for a user
const generateNotificationTopics = async (
    tenantId: number,
    userId: number,
    databaseName: string
): Promise<string[]> => {
    try {
        const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);

        // Get user with roles and permissions in a single optimized query
        const user = await tenantPrisma.user.findUnique({
            where: { id: userId },
            select: {
                username: true,
                roles: {
                    where: { deleted: false },
                    select: {
                        id: true,
                        permission: {
                            where: { deleted: false },
                            select: {
                                permissionId: true
                            }
                        }
                    }
                }
            }
        });

        if (!user) {
            return [];
        }

        // Check if user has super admin role (ID 1)
        const isSuperAdmin = user.roles.some(role => role.id === 1);

        // Fetch notification permissions
        let permissions;

        if (isSuperAdmin) {
            // Super admin gets ALL notification topics automatically
            permissions = await globalPrisma.permission.findMany({
                where: {
                    deleted: false,
                    name: { startsWith: 'Receive ' },
                    category: 'Notifications'
                },
                select: { name: true }
            });
        } else {
            // Regular user - permission-based access
            // Extract unique permission IDs
            const permissionIds = new Set<number>();
            user.roles.forEach(role => {
                role.permission.forEach(rolePermission => {
                    permissionIds.add(rolePermission.permissionId);
                });
            });

            if (permissionIds.size === 0) {
                // User has no permissions, return only basic tenant and user topics
                const globalTenantUser = await globalPrisma.tenantUser.findFirst({
                    where: {
                        username: user.username,
                        tenantId: tenantId
                    },
                    select: { id: true }
                });

                const topics = [`tenant_${tenantId}`];
                if (globalTenantUser) {
                    topics.push(`tenant_${tenantId}_user_${globalTenantUser.id}`);
                }
                return topics;
            }

            // Fetch notification permissions from global database
            permissions = await globalPrisma.permission.findMany({
                where: {
                    id: { in: Array.from(permissionIds) },
                    name: { startsWith: 'Receive ' },
                    category: 'Notifications',
                    deleted: false
                },
                select: { name: true }
            });
        }

        // Generate topics
        const topics: string[] = [];

        // Define outlet-specific permissions (these need outlet context)
        const outletSpecificPermissions = ['sales', 'inventory', 'order'];

        // Add tenant-wide topic
        topics.push(`tenant_${tenantId}`);

        // Add permission-based topics
        permissions.forEach(permission => {
            const shortPermission = permission.name
                .replace('Receive ', '')
                .replace(' Notification', '')
                .replace(' Alert', '')
                .toLowerCase();

            // Check if this permission is outlet-specific
            if (outletSpecificPermissions.includes(shortPermission)) {
                // Add outlet-specific topic (default to outlet_1)
                // TODO: In future, detect user's actual outlet from session/context
                topics.push(`tenant_${tenantId}_outlet_1_${shortPermission}`);
            } else {
                // Add tenant-wide topic for financial, staff, system alerts
                topics.push(`tenant_${tenantId}_${shortPermission}`);
            }
        });

        // Add user-specific topic (requires global tenantUserId)
        const globalTenantUser = await globalPrisma.tenantUser.findFirst({
            where: {
                username: user.username,
                tenantId: tenantId
            },
            select: { id: true }
        });

        if (globalTenantUser) {
            topics.push(`tenant_${tenantId}_user_${globalTenantUser.id}`);
        }

        return topics;
    } catch (error) {
        console.error('Error generating notification topics:', error);
        return [];
    }
};

let createMany = async (databaseName: string, roleData: CreateRoleRequestBody) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // Check if role with same name already exists
        const existingRole = await tenantPrisma.role.findFirst({
            where: {
                name: roleData.name,
                deleted: false
            }
        });

        if (existingRole) {
            throw new RequestValidateError("Role with this name already exists");
        }

        // Create role first
        const newRole = await tenantPrisma.role.create({
            data: {
                name: roleData.name,
                description: roleData.description || null,
            }
        });

        // Create role permissions if provided
        if (roleData.permissionIds && roleData.permissionIds.length > 0) {
            await tenantPrisma.rolePermission.createMany({
                data: roleData.permissionIds.map(permissionId => ({
                    roleId: newRole.id,
                    permissionId: permissionId
                }))
            });
        }

        // Return role with permissions
        const roleWithPermissions = await tenantPrisma.role.findMany({
            where: { id: newRole.id },
            include: {
                permission: {
                    where: {
                        deleted: false
                    }
                }
            }
        });

        return roleWithPermissions;
    }
    catch (error) {
        throw error
    }
}

let updateRole = async (databaseName: string, roleData: CreateRoleRequestBody) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        if (!roleData.id) {
            throw new RequestValidateError("Role ID is required for update");
        }
        // Validate role exists and is not deleted
        const existingRole = await tenantPrisma.role.findUnique({
            where: {
                id: roleData.id,
                deleted: false
            }
        });
        if (!existingRole) {
            throw new NotFoundError("Role not found");
        }

        // Update role basic info
        const updatedRole = await tenantPrisma.role.update({
            where: {
                id: roleData.id
            },
            data: {
                name: roleData.name,
                description: roleData.description || null,
                updatedAt: new Date()
            }
        });

        // Handle permission updates
        if (roleData.permissionIds !== undefined) {
            // Delete existing role permissions completely
            await tenantPrisma.rolePermission.deleteMany({
                where: {
                    roleId: roleData.id
                }
            });

            // Create new role permissions if provided
            if (roleData.permissionIds.length > 0) {
                await tenantPrisma.rolePermission.createMany({
                    data: roleData.permissionIds.map(permissionId => ({
                        roleId: roleData.id as number,
                        permissionId: permissionId
                    }))
                });
            }
        }

        // Return updated role with permissions
        const roleWithPermissions = await tenantPrisma.role.findUnique({
            where: { id: roleData.id },
            include: {
                permission: {
                    where: {
                        deleted: false
                    }
                }
            }
        });

        return roleWithPermissions;
    }
    catch (error) {
        throw error
    }
}

let getRoleByUserId = async (databaseName: string, userId: number, syncRequest: any) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const { skip, take, lastSyncTimestamp } = syncRequest;

        // Validate user exists and is not deleted
        const existingUser = await tenantPrisma.user.findUnique({
            where: {
                id: userId,
                deleted: false
            }
        });
        if (!existingUser) {
            throw new NotFoundError("User not found");
        }

        let hasChanges = false;
        let roles: any[] = [];

        if (lastSyncTimestamp) {
            const syncDate = new Date(lastSyncTimestamp);

            // Check if there are any role-related changes for this user
            const changeCheckQueries = [
                // User's role assignments changed
                tenantPrisma.user.findFirst({
                    where: {
                        id: userId,
                        updatedAt: { gt: syncDate }
                    }
                }),
                // Any assigned role was updated
                tenantPrisma.role.findFirst({
                    where: {
                        users: {
                            some: {
                                id: userId,
                                deleted: false
                            }
                        },
                        OR: [
                            { updatedAt: { gt: syncDate } },
                            { deletedAt: { gt: syncDate } }
                        ]
                    }
                }),
                // Any role permissions changed for assigned roles
                tenantPrisma.rolePermission.findFirst({
                    where: {
                        role: {
                            users: {
                                some: {
                                    id: userId,
                                    deleted: false
                                }
                            }
                        },
                        OR: [
                            { createdAt: { gt: syncDate } },
                            { updatedAt: { gt: syncDate } },
                            { deletedAt: { gt: syncDate } }
                        ]
                    }
                })
            ];

            const changeResults = await Promise.all(changeCheckQueries);
            hasChanges = changeResults.some(result => result !== null);

            if (hasChanges) {
                // Return ALL current roles assigned to user (complete dataset)
                roles = await tenantPrisma.role.findMany({
                    where: {
                        deleted: false,
                        users: {
                            some: {
                                id: userId,
                                deleted: false
                            }
                        }
                    },
                    include: {
                        permission: {
                            where: {
                                deleted: false
                            }
                        }
                    },
                    orderBy: {
                        updatedAt: 'desc'
                    },
                    skip: skip,
                    take: take
                });
            }
            // If no changes, roles remains empty array
        } else {
            // Initial sync - return all roles
            roles = await tenantPrisma.role.findMany({
                where: {
                    deleted: false,
                    users: {
                        some: {
                            id: userId,
                            deleted: false
                        }
                    }
                },
                include: {
                    permission: {
                        where: {
                            deleted: false
                        }
                    }
                },
                orderBy: {
                    updatedAt: 'desc'
                },
                skip: skip,
                take: take
            });
        }

        // Get total count based on whether we're returning data or not
        const total = hasChanges || !lastSyncTimestamp ?
            await tenantPrisma.role.count({
                where: {
                    deleted: false,
                    users: {
                        some: {
                            id: userId,
                            deleted: false
                        }
                    }
                }
            }) : 0;

        const serverTimestamp = new Date().toISOString();

        return {
            data: roles,
            total,
            serverTimestamp,
            hasChanges: hasChanges || !lastSyncTimestamp
        };
    } catch (error) {
        throw error;
    }
};

let assignRoleToUser = async (databaseName: string, userId: number, roleIds: number[]) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // Validate user exists and is not deleted
        const existingUser = await tenantPrisma.user.findUnique({
            where: {
                id: userId,
                deleted: false
            }
        });
        if (!existingUser) {
            throw new NotFoundError("User not found");
        }

        // Validate all roles exist and are not deleted
        const existingRoles = await tenantPrisma.role.findMany({
            where: {
                id: {
                    in: roleIds
                },
                deleted: false
            }
        });
        if (existingRoles.length !== roleIds.length) {
            throw new NotFoundError("One or more roles not found");
        }

        // Check if user already has any of these roles
        const userWithRoles = await tenantPrisma.user.findUnique({
            where: {
                id: userId
            },
            include: {
                roles: {
                    where: {
                        id: {
                            in: roleIds
                        },
                        deleted: false
                    }
                }
            }
        });

        if (userWithRoles && userWithRoles.roles.length > 0) {
            const existingRoleNames = userWithRoles.roles.map(role => role.name).join(', ');
            throw new RequestValidateError(`User already has these roles assigned: ${existingRoleNames}`);
        }

        // Assign roles to user
        const updatedUser = await tenantPrisma.$transaction(async (prisma) => {
            // Update user with role assignments
            const user = await prisma.user.update({
                where: { id: userId },
                data: {
                    updatedAt: new Date(),
                    roles: {
                        connect: roleIds.map(roleId => ({ id: roleId }))
                    }
                },
                include: {
                    roles: {
                        where: { deleted: false },
                        include: {
                            permission: {
                                where: { deleted: false }
                            }
                        }
                    }
                }
            });

            // Update the roles' timestamps to trigger delta sync
            await prisma.role.updateMany({
                where: {
                    id: { in: roleIds }
                },
                data: {
                    updatedAt: new Date()
                }
            });

            return user;
        });

        // Remove password field before returning
        const { password, ...userWithoutPassword } = updatedUser as any;
        return userWithoutPassword;
    }
    catch (error) {
        throw error;
    }
}

let removeRoleFromUser = async (databaseName: string, userId: number, roleIds: number[]) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // Validate user exists and is not deleted
        const existingUser = await tenantPrisma.user.findUnique({
            where: {
                id: userId,
                deleted: false
            }
        });
        if (!existingUser) {
            throw new NotFoundError("User not found");
        }

        // Validate all roles exist and are not deleted
        const existingRoles = await tenantPrisma.role.findMany({
            where: {
                id: {
                    in: roleIds
                },
                deleted: false
            }
        });
        if (existingRoles.length !== roleIds.length) {
            throw new NotFoundError("One or more roles not found");
        }

        // Check if user actually has these roles assigned
        const userWithRoles = await tenantPrisma.user.findUnique({
            where: {
                id: userId
            },
            include: {
                roles: {
                    where: {
                        id: {
                            in: roleIds
                        },
                        deleted: false
                    }
                }
            }
        });

        if (!userWithRoles || userWithRoles.roles.length === 0) {
            throw new RequestValidateError("User does not have any of the specified roles assigned");
        }

        // Check if all specified roles are actually assigned to the user
        const assignedRoleIds = userWithRoles.roles.map(role => role.id);
        const unassignedRoles = roleIds.filter(roleId => !assignedRoleIds.includes(roleId));

        if (unassignedRoles.length > 0) {
            const unassignedRoleNames = existingRoles
                .filter(role => unassignedRoles.includes(role.id))
                .map(role => role.name)
                .join(', ');
            throw new RequestValidateError(`User does not have these roles assigned: ${unassignedRoleNames}`);
        }

        // Remove roles from user
        const updatedUser = await tenantPrisma.$transaction(async (prisma) => {
            // Update user by removing role assignments
            const user = await prisma.user.update({
                where: { id: userId },
                data: {
                    updatedAt: new Date(),
                    roles: {
                        disconnect: roleIds.map(roleId => ({ id: roleId }))
                    }
                },
                include: {
                    roles: {
                        where: { deleted: false },
                        include: {
                            permission: {
                                where: { deleted: false }
                            }
                        }
                    }
                }
            });

            // Update the roles' timestamps to trigger delta sync
            await prisma.role.updateMany({
                where: {
                    id: { in: roleIds }
                },
                data: {
                    updatedAt: new Date()
                }
            });

            return user;
        });

        // Remove password field before returning
        const { password, ...userWithoutPassword } = updatedUser as any;
        return userWithoutPassword;
    }
    catch (error) {
        throw error;
    }
}

let getUsersByRoleId = async (databaseName: string, roleId: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // Validate role exists and is not deleted
        const existingRole = await tenantPrisma.role.findUnique({
            where: {
                id: roleId,
                deleted: false
            }
        });
        if (!existingRole) {
            throw new NotFoundError("Role not found");
        }
        // Always return all users assigned to this role
        const users = await tenantPrisma.user.findMany({
            where: {
                deleted: false,
                roles: {
                    some: {
                        id: roleId,
                        deleted: false
                    }
                }
            },
            select: {
                id: true,
                username: true,
                email: true,
                firstName: true,
                lastName: true,
                mobile: true,
                createdAt: true,
                updatedAt: true,
                deleted: true,
                deletedAt: true,
            },
            orderBy: {
                updatedAt: 'desc'
            },
        });
        return {
            data: users,
        };
    } catch (error) {
        throw error;
    }
};

export = { getAll, createMany, updateRole, getRoleByUserId, assignRoleToUser, removeRoleFromUser, getUsersByRoleId }