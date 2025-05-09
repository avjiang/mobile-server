import { PrismaClient, Tenant, TenantUser, SubscriptionPlan } from "../../node_modules/.prisma/global-client";
import { plainToInstance } from "class-transformer"
import { TenantDto, TenantCreationDto } from "./tenant.response"
import bcrypt from "bcryptjs"
import { CreateTenantRequest } from "./tenant.request";
const { getGlobalPrisma, getTenantPrisma, initializeTenantDatabase } = require('../db');

const prisma: PrismaClient = getGlobalPrisma()

let getAll = async () => {
    try {
        const tenants = await prisma.tenant.findMany({
            include: {
                subscription: {
                    select: {
                        id: true,
                        tenantId: true,
                        subscriptionValidUntil: true,
                        subscriptionAddOn: {
                            select: {
                                addOn: true
                            }
                        },
                        subscriptionPlan: {
                            select: {
                                planName: true
                            }
                        },
                    }
                }
            }
        })
        return tenants
    }
    catch (error) {
        throw error
    }
}

let create = async (body: CreateTenantRequest) => {
    let createdTenantId: number | null = null;
    let tenantDatabaseName: string | null = null;

    try {
        const tenant = body.tenant;

        // Find the subscription plan by name
        const subscriptionPlan = await prisma.subscriptionPlan.findFirst({
            where: {
                planName: tenant.plan
            }
        });
        if (!subscriptionPlan) {
            throw new Error(`Subscription plan "${tenant.plan}" not found.`);
        }
        // Generate a unique database name 
        const databaseName = `${tenant.tenantName.toLowerCase().replace(/\s/g, '_')}_db`;
        const username = String(tenant.tenantName).toLowerCase().replace(/\s/g, '_');

        const result = await prisma.$transaction(async (tx) => {
            // Create new tenant
            const newTenant = await tx.tenant.create({
                data: {
                    tenantName: tenant.tenantName,
                    databaseName: databaseName,
                }
            });
            createdTenantId = newTenant.id;

            // Create new tenant user record
            const newTenantUser = await tx.tenantUser.create({
                data: {
                    tenantId: newTenant.id,
                    username: username,
                    password: bcrypt.hashSync(username, 10),
                },
            })
            // Calculate subscription dates (e.g., valid for 30 days)
            const now = new Date();
            const nextPaymentDate = new Date(now);
            nextPaymentDate.setDate(now.getDate() + 30);

            const subscriptionValidUntil = new Date(nextPaymentDate);

            // Create subscription for the tenant
            const subscription = await tx.tenantSubscription.create({
                data: {
                    tenantId: newTenant.id,
                    subscriptionPlanId: subscriptionPlan!.id,
                    nextPaymentDate,
                    subscriptionValidUntil,
                },
                include: {
                    subscriptionPlan: true
                }
            });
            return {
                tenant: newTenant,
                subscription: subscription,
                tenantUser: newTenantUser,
            };
        });

        try {
            await initializeTenantDatabase(databaseName);

            // Create user in tenant DB
            const tenantPrisma = getTenantPrisma(databaseName);
            const newUser = await tenantPrisma.user.create({
                data: {
                    username: username,
                    password: bcrypt.hashSync(username, 10),
                    role: "Super Admin",
                }
            })
            const newOutlet = await tenantPrisma.outlet.create({
                data: {
                    outletName: "Main Outlet",
                }
            })
            await tenantPrisma.$disconnect();

            // Return the API response
            const { password, ...tenantUserWithoutPassword } = result.tenantUser;
            const tenantDto = plainToInstance(TenantDto, result.tenant, { excludeExtraneousValues: true });
            const tenantCreationDto = new TenantCreationDto(tenantDto, tenantUserWithoutPassword, result.subscription);
            return tenantCreationDto;
        }
        catch (tenantDbError) {
            console.error('Error setting up tenant database:', tenantDbError);

            // If tenant database setup fails, rollback the tenant creation in the main database
            if (createdTenantId !== null) {
                try {
                    console.log(`Rolling back tenant creation for ID: ${createdTenantId}`);
                    await prisma.$transaction(async (tx) => {
                        // Delete all tenant subscription add-ons
                        await tx.tenantSubscriptionAddOn.deleteMany({
                            where: {
                                tenantSubscription: {
                                    tenantId: createdTenantId!
                                }
                            }
                        });
                        // Delete all tenant subscriptions
                        await tx.tenantSubscription.deleteMany({
                            where: {
                                tenantId: createdTenantId!
                            }
                        });
                        // Delete all tenant users
                        await tx.tenantUser.deleteMany({
                            where: {
                                tenantId: createdTenantId!
                            }
                        });
                        // Finally, delete the tenant itself
                        await tx.tenant.delete({
                            where: {
                                id: createdTenantId!
                            }
                        });
                    });
                    throw new Error("Failed to set up tenant database. Tenant creation has been rolled back.");
                } catch (rollbackError) {
                    console.error('Error during rollback:', rollbackError);
                    throw new Error("Failed to set up tenant database AND failed to roll back. Manual intervention required.");
                }
            } else {
                console.error("Failed to set up tenant database");
                throw new Error("Failed to set up tenant database")
            }
        }
    }
    catch (error) {
        console.error('Error creating tenant:', error);
        throw error
    }
}

export = {
    getAll,
    create
}