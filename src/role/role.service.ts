import { PrismaClient, Category } from "@prisma/client"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { getTenantPrisma } from '../db';
import { CreateRoleRequestBody } from "./role.request";
import { SyncRequest } from "src/item/item.request";

// stock function 
let getAll = async (
    databaseName: string,
    syncRequest: SyncRequest
): Promise<{ roles: any[]; total: number; serverTimestamp: string }> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { lastSyncTimestamp, lastVersion, skip = 0, take = 100 } = syncRequest;

    try {
        // Parse last sync timestamp or use a default (e.g., epoch start)
        const lastSync = (lastSyncTimestamp && lastSyncTimestamp !== 'null') ?
            new Date(lastSyncTimestamp) : new Date(0);

        // Build query conditions
        const where = lastVersion
            ? { version: { gt: lastVersion } }
            : {
                OR: [
                    { createdAt: { gte: lastSync } },
                    { updatedAt: { gte: lastSync } },
                    { deletedAt: { gte: lastSync } },
                ],
                deleted: false
            };

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

        return {
            roles,
            total,
            serverTimestamp: new Date().toISOString(),
        };
    } catch (error) {
        throw error;
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
        const roleWithPermissions = await tenantPrisma.role.findUnique({
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
            // Delete existing role permissions
            await tenantPrisma.rolePermission.updateMany({
                where: {
                    roleId: roleData.id
                },
                data: {
                    deleted: true,
                    deletedAt: new Date()
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
        const updatedUser = await tenantPrisma.user.update({
            where: {
                id: userId
            },
            data: {
                updatedAt: new Date(),
                roles: {
                    connect: roleIds.map(roleId => ({ id: roleId }))
                }
            },
            include: {
                roles: {
                    where: {
                        deleted: false
                    },
                    include: {
                        permission: {
                            where: {
                                deleted: false
                            }
                        }
                    }
                }
            }
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
        const updatedUser = await tenantPrisma.user.update({
            where: {
                id: userId
            },
            data: {
                updatedAt: new Date(),
                roles: {
                    disconnect: roleIds.map(roleId => ({ id: roleId }))
                }
            },
            include: {
                roles: {
                    where: {
                        deleted: false
                    },
                    include: {
                        permission: {
                            where: {
                                deleted: false
                            }
                        }
                    }
                }
            }
        });

        // Remove password field before returning
        const { password, ...userWithoutPassword } = updatedUser as any;
        return userWithoutPassword;
    }
    catch (error) {
        throw error;
    }
}

export = { getAll, createMany, updateRole, getRoleByUserId, assignRoleToUser, removeRoleFromUser }