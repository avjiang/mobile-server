import { plainToInstance } from "class-transformer";
import { PrismaClient, Tenant, TenantUser, SubscriptionPlan, Prisma } from "../../prisma/global-client/generated/global";
import { PrismaClient as TenantPrismaClient } from "../../prisma/client/generated/client";
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { CreateTenantRequest } from "./admin.request";
import bcrypt from "bcryptjs"
import {
    TenantCostResponse,
    TenantCreationDto,
    TenantDto,
    TotalCostResponse,
    CostSnapshot,
    TenantPaymentResponse,
    RecordPaymentResponse,
    PaymentListResponse,
    AllPaymentsResponse,
    TenantBillingSummaryResponse,
    UpcomingPaymentsSummaryResponse,
    UpcomingPaymentsResponse,
    TenantUsersResponse
} from "./admin.response";
import { AuthRequest } from "src/middleware/auth-request";
const { getGlobalPrisma, getTenantPrisma, initializeTenantDatabase } = require('../db');

const prisma: PrismaClient = getGlobalPrisma()

/**
 * Helper function to get primary subscription for a tenant
 * Returns first active subscription and all active outlets
 */
const getPrimarySubscription = async (tenantId: number, tx: any = prisma) => {
    const tenantOutlets = await tx.tenantOutlet.findMany({
        where: {
            tenantId,
            isActive: true
        },
        include: {
            subscriptions: {
                where: {
                    status: { in: ['Active', 'active', 'trial'] }
                },
                include: {
                    subscriptionPlan: true,
                    subscriptionAddOn: true
                }
            }
        }
    });

    if (!tenantOutlets || tenantOutlets.length === 0) {
        throw new NotFoundError('No active outlets found for tenant');
    }

    // Find first subscription
    let primarySubscription = null;
    for (const outlet of tenantOutlets) {
        if (outlet.subscriptions.length > 0) {
            primarySubscription = outlet.subscriptions[0];
            break;
        }
    }

    if (!primarySubscription) {
        throw new NotFoundError('No active subscription found for tenant');
    }

    return { primarySubscription, tenantOutlets };
}

let createTenant = async (body: CreateTenantRequest) => {
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

            const newTenantOutlet = await tx.tenantOutlet.create({
                data: {
                    outletName: "Main Outlet",
                    tenantId: newTenant.id,
                }
            });
            // Create new tenant user record
            const newTenantUser = await tx.tenantUser.create({
                data: {
                    tenantId: newTenant.id,
                    username: username,
                    role: "Owner",
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
                    outletId: newTenantOutlet.id,
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

            // Find or create the "Super Admin" role
            let superAdminRole = await tenantPrisma.role.findFirst({
                where: { name: "Super Admin" }
            });
            if (!superAdminRole) {
                superAdminRole = await tenantPrisma.role.create({
                    data: { name: "Super Admin" }
                });
            }

            const newUser = await tenantPrisma.user.create({
                data: {
                    username: username,
                    password: bcrypt.hashSync(username, 10),
                    roles: {
                        connect: [{ id: superAdminRole.id }]
                    }
                }
            })
            const newOutlet = await tenantPrisma.outlet.create({
                data: {
                    outletName: "Main Outlet",
                    tenantOutletId: result.subscription.outletId,
                }
            })

            // Create warehouse for Pro plan users
            let createdWarehouse = null;
            if (tenant.plan === 'Pro') {
                // Create warehouse in global DB
                const globalWarehouse = await prisma.tenantWarehouse.create({
                    data: {
                        tenantId: result.tenant.id,
                        warehouseName: "Main Warehouse",
                        warehouseCode: "MAIN_WAREHOUSE",
                        isActive: true,
                    }
                });

                // Create warehouse in tenant DB
                const tenantWarehouse = await tenantPrisma.warehouse.create({
                    data: {
                        tenantWarehouseId: globalWarehouse.id,
                        warehouseName: "Main Warehouse",
                        warehouseCode: "MAIN_WAREHOUSE",
                    }
                });

                createdWarehouse = {
                    id: tenantWarehouse.id,
                    warehouseName: tenantWarehouse.warehouseName,
                    warehouseCode: tenantWarehouse.warehouseCode,
                    tenantWarehouseId: tenantWarehouse.tenantWarehouseId,
                };
            }

            await tenantPrisma.$disconnect();

            // Return the API response
            const { password, ...tenantUserWithoutPassword } = result.tenantUser;
            const tenantDto = plainToInstance(TenantDto, result.tenant, { excludeExtraneousValues: true });
            const tenantCreationDto = new TenantCreationDto(
                tenantDto,
                tenantUserWithoutPassword,
                result.subscription,
                createdWarehouse || undefined
            );
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
                        // Delete all tenant warehouses
                        await tx.tenantWarehouse.deleteMany({
                            where: {
                                tenantId: createdTenantId!
                            }
                        });
                        // Delete all tenant outlets
                        await tx.tenantOutlet.deleteMany({
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

// Calculate cost for a tenant
const getTenantCost = async (req: AuthRequest, tenantId: number) => {
    try {
        // Fetch tenant from global DB
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            include: {
                tenantOutlets: {
                    where: { isActive: true },
                    include: {
                        subscriptions: {
                            where: { status: { in: ['active', 'trial'] } },
                            include: {
                                subscriptionPlan: true,
                                discount: true,
                                subscriptionAddOn: {
                                    include: { addOn: true },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!tenant) {
            throw new NotFoundError('Tenant not found');
        }
        // Calculate outlet count
        const outletCount = tenant.tenantOutlets.length;
        const response: TenantCostResponse = {
            tenantId: tenant.id,
            tenantName: tenant.tenantName,
            outletCount,
            outlets: [],
            totalMonthlyCost: 0,
            totalCostBeforeDiscount: 0,
            totalDiscount: 0,
        };
        // Track fixed discount application
        let remainingFixedDiscount = 0;
        let fixedDiscountName = '';
        let fixedDiscountType = '';

        // Check for tenant-wide fixed discount
        const subscriptionsWithFixedDiscount = tenant.tenantOutlets
            .flatMap(outlet => outlet.subscriptions)
            .filter(sub => sub.discount?.discountType === 'fixed' && (!sub.discount.endDate || new Date() <= sub.discount.endDate));

        if (subscriptionsWithFixedDiscount.length > 0) {
            const discount = subscriptionsWithFixedDiscount[0].discount!;
            remainingFixedDiscount = discount.value;
            fixedDiscountName = discount.name;
            fixedDiscountType = discount.discountType;
        }
        // Process each active outlet
        for (const outlet of tenant.tenantOutlets) {
            const subscription = outlet.subscriptions[0];
            const outletData: TenantCostResponse['outlets'][0] = {
                outletId: outlet.id,
                outletName: outlet.outletName,
                subscription: null,
            };
            if (subscription) {
                const basePlanCost = subscription.subscriptionPlan.price;
                const addOns = subscription.subscriptionAddOn.map(({ addOn, quantity }) => ({
                    name: addOn.name,
                    quantity,
                    pricePerUnit: addOn.pricePerUnit,
                    totalCost: addOn.pricePerUnit * quantity,
                }));
                // Calculate discounts
                const discounts: Array<{ name: string; type: string; value: number; amount: number }> = [];

                // Promotional discount (percentage)
                let discountAmount = 0;
                if (
                    subscription.discount &&
                    subscription.discount.discountType === 'percentage' &&
                    (!subscription.discount.endDate || new Date() <= subscription.discount.endDate)
                ) {
                    const discountValue = subscription.discount.value / 100;
                    const appliesToPlan = subscription.discount.appliesTo.includes('plan');
                    const appliesToAddOns = subscription.discount.appliesTo.includes('add-on');

                    const planDiscount = appliesToPlan ? basePlanCost * discountValue : 0;
                    const addOnDiscount = appliesToAddOns
                        ? addOns.reduce((sum, addOn) => sum + addOn.totalCost * discountValue, 0)
                        : 0;
                    discountAmount = planDiscount + addOnDiscount;
                    discounts.push({
                        name: subscription.discount.name,
                        type: subscription.discount.discountType,
                        value: subscription.discount.value,
                        amount: discountAmount,
                    });
                }
                // Fixed discount (apply to first outlet)
                if (remainingFixedDiscount > 0) {
                    const fixedAmount = Math.min(remainingFixedDiscount, basePlanCost + addOns.reduce((sum, addOn) => sum + addOn.totalCost, 0));
                    discounts.push({
                        name: fixedDiscountName,
                        type: fixedDiscountType,
                        value: fixedAmount,
                        amount: fixedAmount,
                    });
                    discountAmount += fixedAmount;
                    remainingFixedDiscount -= fixedAmount;
                }
                // Total cost for this outlet
                const totalAddOnCost = addOns.reduce((sum, addOn) => sum + addOn.totalCost, 0);
                const totalCostBeforeDiscount = basePlanCost + totalAddOnCost;
                const totalCost = Math.max(0, totalCostBeforeDiscount - discountAmount);

                outletData.subscription = {
                    planName: subscription.subscriptionPlan.planName,
                    basePlanCost,
                    addOns,
                    discounts,
                    totalCost,
                    totalCostBeforeDiscount,
                    totalDiscount: discountAmount,
                    status: subscription.status,
                    subscriptionValidUntil: subscription.subscriptionValidUntil.toISOString(),
                };
                response.totalMonthlyCost += totalCost;
                response.totalCostBeforeDiscount += totalCostBeforeDiscount;
                response.totalDiscount += discountAmount;
            }
            response.outlets.push(outletData);
        }
        return response;
    } catch (error) {
        console.error('Error calculating tenant cost:', error);
        throw error;
    }
};

const getAllTenantCost = async () => {
    try {
        // Raw SQL query to aggregate costs
        const results = await prisma.$queryRaw<
            Array<{
                tenantId: number;
                tenantName: string;
                totalMonthlyCost: number;
                totalCostBeforeDiscount: number;
                totalDiscount: number;
            }>
        >`
      SELECT 
        t.ID AS tenantId,
        t.TENANT_NAME AS tenantName,
        COALESCE(SUM(
          -- Base plan cost + add-on cost - discounts
          sp.PRICE
          + COALESCE((
            SELECT SUM(tsa.QUANTITY * sa.PRICE_PER_UNIT)
            FROM TENANT_SUBSCRIPTION_ADD_ON tsa
            LEFT JOIN SUBSCRIPTION_ADD_ON sa ON tsa.ADD_ON_ID = sa.ID
            WHERE tsa.TENANT_SUBSCRIPTION_ID = ts.ID
          ), 0)
          - COALESCE((
            CASE
              WHEN d.DISCOUNT_TYPE = 'percentage'
              AND (d.END_DATE IS NULL OR d.END_DATE >= CURRENT_TIMESTAMP)
              THEN (
                (sp.PRICE * (CASE WHEN d.APPLIES_TO LIKE '%plan%' THEN d.VALUE ELSE 0 END)
                + COALESCE((
                  SELECT SUM(tsa.QUANTITY * sa.PRICE_PER_UNIT)
                  FROM TENANT_SUBSCRIPTION_ADD_ON tsa
                  LEFT JOIN SUBSCRIPTION_ADD_ON sa ON tsa.ADD_ON_ID = sa.ID
                  WHERE tsa.TENANT_SUBSCRIPTION_ID = ts.ID
                ), 0) * (CASE WHEN d.APPLIES_TO LIKE '%add-on%' THEN d.VALUE ELSE 0 END)
                ) / 100
              )
              ELSE 0
            END
          ), 0)
          - COALESCE((
            CASE
              WHEN d.DISCOUNT_TYPE = 'fixed'
              AND (d.END_DATE IS NULL OR d.END_DATE >= CURRENT_TIMESTAMP)
              AND ts.ID = (
                SELECT MIN(ts2.ID)
                FROM TENANT_SUBSCRIPTION ts2
                JOIN TENANT_OUTLET o2 ON ts2.OUTLET_ID = o2.ID
                WHERE o2.TENANT_ID = t.ID
                AND o2.IS_ACTIVE = true
                AND ts2.STATUS IN ('active', 'trial')
                AND ts2.DISCOUNT_ID = d.ID
              )
              THEN LEAST(d.VALUE, sp.PRICE + COALESCE((
                SELECT SUM(tsa.QUANTITY * sa.PRICE_PER_UNIT)
                FROM TENANT_SUBSCRIPTION_ADD_ON tsa
                LEFT JOIN SUBSCRIPTION_ADD_ON sa ON tsa.ADD_ON_ID = sa.ID
                WHERE tsa.TENANT_SUBSCRIPTION_ID = ts.ID
              ), 0))
              ELSE 0
            END
          ), 0)
        ), 0) AS totalMonthlyCost,
        COALESCE(SUM(
          -- Base plan cost + add-on cost (before discounts)
          sp.PRICE
          + COALESCE((
            SELECT SUM(tsa.QUANTITY * sa.PRICE_PER_UNIT)
            FROM TENANT_SUBSCRIPTION_ADD_ON tsa
            LEFT JOIN SUBSCRIPTION_ADD_ON sa ON tsa.ADD_ON_ID = sa.ID
            WHERE tsa.TENANT_SUBSCRIPTION_ID = ts.ID
          ), 0)
        ), 0) AS totalCostBeforeDiscount,
        COALESCE(SUM(
          -- Total discounts (percentage + fixed)
          COALESCE((
            CASE
              WHEN d.DISCOUNT_TYPE = 'percentage'
              AND (d.END_DATE IS NULL OR d.END_DATE >= CURRENT_TIMESTAMP)
              THEN (
                (sp.PRICE * (CASE WHEN d.APPLIES_TO LIKE '%plan%' THEN d.VALUE ELSE 0 END)
                + COALESCE((
                  SELECT SUM(tsa.QUANTITY * sa.PRICE_PER_UNIT)
                  FROM TENANT_SUBSCRIPTION_ADD_ON tsa
                  LEFT JOIN SUBSCRIPTION_ADD_ON sa ON tsa.ADD_ON_ID = sa.ID
                  WHERE tsa.TENANT_SUBSCRIPTION_ID = ts.ID
                ), 0) * (CASE WHEN d.APPLIES_TO LIKE '%add-on%' THEN d.VALUE ELSE 0 END)
                ) / 100
              )
              ELSE 0
            END
          ), 0)
          + COALESCE((
            CASE
              WHEN d.DISCOUNT_TYPE = 'fixed'
              AND (d.END_DATE IS NULL OR d.END_DATE >= CURRENT_TIMESTAMP)
              AND ts.ID = (
                SELECT MIN(ts2.ID)
                FROM TENANT_SUBSCRIPTION ts2
                JOIN TENANT_OUTLET o2 ON ts2.OUTLET_ID = o2.ID
                WHERE o2.TENANT_ID = t.ID
                AND o2.IS_ACTIVE = true
                AND ts2.STATUS IN ('active', 'trial')
                AND ts2.DISCOUNT_ID = d.ID
              )
              THEN LEAST(d.VALUE, sp.PRICE + COALESCE((
                SELECT SUM(tsa.QUANTITY * sa.PRICE_PER_UNIT)
                FROM TENANT_SUBSCRIPTION_ADD_ON tsa
                LEFT JOIN SUBSCRIPTION_ADD_ON sa ON tsa.ADD_ON_ID = sa.ID
                WHERE tsa.TENANT_SUBSCRIPTION_ID = ts.ID
              ), 0))
              ELSE 0
            END
          ), 0)
        ), 0) AS totalDiscount
      FROM TENANT t
      LEFT JOIN TENANT_OUTLET o ON t.ID = o.TENANT_ID AND o.IS_ACTIVE = true
      LEFT JOIN TENANT_SUBSCRIPTION ts ON o.ID = ts.OUTLET_ID AND ts.STATUS IN ('active', 'trial')
      LEFT JOIN SUBSCRIPTION_PLAN sp ON ts.SUBSCRIPTION_PLAN_ID = sp.ID
      LEFT JOIN DISCOUNT d ON ts.DISCOUNT_ID = d.ID
      GROUP BY t.ID, t.TENANT_NAME
      HAVING totalMonthlyCost > 0
    `;
        // Calculate total cost 
        const totalRevenue = results.reduce((sum, tenant) => sum + tenant.totalMonthlyCost, 0);
        const totalDiscount = results.reduce((sum, tenant) => sum + tenant.totalDiscount, 0);
        const totalRevenueBeforeDiscount = results.reduce((sum, tenant) => sum + tenant.totalCostBeforeDiscount, 0);

        // Format response
        const response: TotalCostResponse = {
            totalRevenue,
            totalRevenueBeforeDiscount,
            totalDiscount,
            tenants: results.map(tenant => ({
                tenantId: tenant.tenantId,
                tenantName: tenant.tenantName,
                totalMonthlyCost: tenant.totalMonthlyCost,
                totalCostBeforeDiscount: tenant.totalCostBeforeDiscount,
                totalDiscount: tenant.totalDiscount,
            })),
        };
        return response;
    } catch (error) {
        console.error('Error calculating total cost:', error);
        throw error;
    }
}

// New: Create a tenant user in global DB and corresponding user in tenant DB (no roles assigned)
const createTenantUser = async (tenantId: number, body: { username: string; password: string }) => {
    if (!body || !body.username || !body.password) {
        throw new RequestValidateError('Invalid request. Both username and password are required.');
    }

    // Find tenant and ensure tenant DB is available
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, databaseName: true },
    });
    if (!tenant) {
        throw new NotFoundError('Tenant not found');
    }
    if (!tenant.databaseName) {
        throw new NotFoundError('Tenant database not initialized');
    }

    // Enforce unique username (global scope due to unique constraint)
    const existingGlobal = await prisma.tenantUser.findUnique({
        where: { username: body.username },
    });
    if (existingGlobal) {
        throw new RequestValidateError('Username already exists');
    }

    const hashed = bcrypt.hashSync(body.password, 10);

    // Create in global DB first
    const createdTenantUser = await prisma.tenantUser.create({
        data: {
            tenantId: tenantId,
            username: body.username,
            password: hashed,
            role: "User"
        },
        select: { id: true, username: true },
    });

    let createdTenantDbUserId: number | null = null;

    try {
        // Then create in tenant DB
        const tenantPrisma = getTenantPrisma(tenant.databaseName);

        const existingTenantUser = await tenantPrisma.user.findUnique({
            where: { username: body.username },
        });
        if (existingTenantUser) {
            // Rollback global user if tenant DB already has the username
            await prisma.tenantUser.delete({ where: { id: createdTenantUser.id } });
            await tenantPrisma.$disconnect();
            throw new RequestValidateError('Username already exists in tenant database');
        }

        const createdUser = await tenantPrisma.user.create({
            data: {
                username: body.username,
                password: hashed,
                // no roles assigned
            },
            select: { id: true },
        });
        createdTenantDbUserId = createdUser.id;

        // --- Begin: Subscription add-on logic for user overage ---
        // HYBRID MODEL: User limits are calculated as sum of all outlet subscriptions
        // This matches the device limit logic - each outlet contributes to the total pool
        const { primarySubscription, tenantOutlets } = await getPrimarySubscription(tenantId);

        // Calculate total user limit across all outlet subscriptions
        let totalMaxUsers = 0;
        for (const outlet of tenantOutlets) {
            for (const subscription of outlet.subscriptions) {
                const maxUsers = subscription.subscriptionPlan?.maxUsers;
                if (maxUsers !== null && maxUsers !== undefined) {
                    totalMaxUsers += maxUsers;
                }
            }
        }

        if (totalMaxUsers > 0) {
            // Count current active (non-deleted) users in global DB
            const currentUserCount = await prisma.tenantUser.count({
                where: { tenantId, isDeleted: false },
            });

            // Required add-on quantity equals overage beyond total allowed
            const overage = Math.max(0, currentUserCount - totalMaxUsers);

            if (overage > 0) {
                const addOnId = 1; // Add-on for extra user
                // Attach add-on to the primary subscription
                const existingAddOn = await prisma.tenantSubscriptionAddOn.findUnique({
                    where: {
                        tenantSubscriptionId_addOnId: {
                            tenantSubscriptionId: primarySubscription.id,
                            addOnId,
                        }
                    }
                });

                if (!existingAddOn) {
                    await prisma.tenantSubscriptionAddOn.create({
                        data: {
                            tenantSubscriptionId: primarySubscription.id,
                            addOnId,
                            quantity: overage,
                        }
                    });
                } else if (existingAddOn.quantity < overage) {
                    await prisma.tenantSubscriptionAddOn.update({
                        where: {
                            tenantSubscriptionId_addOnId: {
                                tenantSubscriptionId: primarySubscription.id,
                                addOnId,
                            }
                        },
                        data: { quantity: overage }
                    });
                }
            }
        }
        // --- End: Subscription add-on logic for user overage ---

        await tenantPrisma.$disconnect();

        return {
            tenantId,
            tenantUserId: createdTenantUser.id,
            userId: createdTenantDbUserId,
            username: createdTenantUser.username,
        };
    } catch (err) {
        // Best-effort rollback in tenant DB and global DB if later steps failed
        try {
            if (createdTenantDbUserId !== null && tenant.databaseName) {
                const tenantPrisma = getTenantPrisma(tenant.databaseName);
                try {
                    await tenantPrisma.user.delete({ where: { id: createdTenantDbUserId } });
                } finally {
                    await tenantPrisma.$disconnect();
                }
            }
        } catch (_) { /* swallow */ }

        try {
            await prisma.tenantUser.delete({ where: { id: createdTenantUser.id } });
        } catch (_) { /* swallow */ }

        throw err;
    }
}

// Delete tenant user and automatically adjust user add-on
const deleteTenantUser = async (tenantId: number, userId: number) => {
    // Find tenant and ensure tenant DB is available
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, databaseName: true },
    });
    if (!tenant) {
        throw new NotFoundError('Tenant not found');
    }
    if (!tenant.databaseName) {
        throw new NotFoundError('Tenant database not initialized');
    }

    // Find the user to delete in global DB
    const userToDelete = await prisma.tenantUser.findUnique({
        where: { id: userId },
    });
    if (!userToDelete) {
        throw new NotFoundError('User not found');
    }
    if (userToDelete.tenantId !== tenantId) {
        throw new RequestValidateError('User does not belong to this tenant');
    }
    if (userToDelete.isDeleted) {
        throw new RequestValidateError('User is already deleted');
    }

    // Prevent deleting the owner
    if (userToDelete.role === 'Owner') {
        throw new RequestValidateError('Cannot delete the tenant owner');
    }

    let tenantDbUserId: number | null = null;

    try {
        const tenantPrisma = getTenantPrisma(tenant.databaseName);

        // Find user in tenant DB
        const tenantUser = await tenantPrisma.user.findUnique({
            where: { username: userToDelete.username },
        });

        if (tenantUser) {
            tenantDbUserId = tenantUser.id;
        }

        // Step 1: Soft delete in global DB
        await prisma.tenantUser.update({
            where: { id: userId },
            data: { isDeleted: true }
        });

        // Step 2: Soft delete in tenant DB (if exists)
        if (tenantDbUserId) {
            await tenantPrisma.user.update({
                where: { id: tenantDbUserId },
                data: {
                    deleted: true,
                    deletedAt: new Date()
                }
            });
        }

        // Step 3: Recalculate user add-on (similar to createTenantUser logic)
        const { primarySubscription, tenantOutlets } = await getPrimarySubscription(tenantId);

        // Calculate total user limit across all outlet subscriptions
        let totalMaxUsers = 0;
        for (const outlet of tenantOutlets) {
            for (const subscription of outlet.subscriptions) {
                const maxUsers = subscription.subscriptionPlan?.maxUsers;
                if (maxUsers !== null && maxUsers !== undefined) {
                    totalMaxUsers += maxUsers;
                }
            }
        }

        if (totalMaxUsers > 0) {
            // Count current active (non-deleted) users in global DB
            const currentUserCount = await prisma.tenantUser.count({
                where: { tenantId, isDeleted: false },
            });

            // Calculate new overage
            const overage = Math.max(0, currentUserCount - totalMaxUsers);

            const addOnId = 1; // Add-on for extra user

            // Get existing add-on
            const existingAddOn = await prisma.tenantSubscriptionAddOn.findUnique({
                where: {
                    tenantSubscriptionId_addOnId: {
                        tenantSubscriptionId: primarySubscription.id,
                        addOnId,
                    }
                }
            });

            if (overage === 0) {
                // No overage, remove add-on if it exists
                if (existingAddOn) {
                    await prisma.tenantSubscriptionAddOn.delete({
                        where: {
                            tenantSubscriptionId_addOnId: {
                                tenantSubscriptionId: primarySubscription.id,
                                addOnId,
                            }
                        }
                    });
                }
            } else {
                // Still have overage, update quantity
                if (existingAddOn && existingAddOn.quantity > overage) {
                    await prisma.tenantSubscriptionAddOn.update({
                        where: {
                            tenantSubscriptionId_addOnId: {
                                tenantSubscriptionId: primarySubscription.id,
                                addOnId,
                            }
                        },
                        data: { quantity: overage }
                    });
                }
            }
        }

        await tenantPrisma.$disconnect();

        return {
            success: true,
            message: 'User deleted successfully',
            tenantId,
            deletedUserId: userId,
            username: userToDelete.username,
        };
    } catch (err) {
        // Best-effort rollback
        try {
            // Reactivate in global DB if soft delete succeeded
            await prisma.tenantUser.update({
                where: { id: userId },
                data: { isDeleted: false }
            }).catch(() => { /* swallow */ });

            // Reactivate in tenant DB if soft delete succeeded
            if (tenantDbUserId && tenant.databaseName) {
                const tenantPrisma = getTenantPrisma(tenant.databaseName);
                try {
                    await tenantPrisma.user.update({
                        where: { id: tenantDbUserId },
                        data: {
                            deleted: false,
                            deletedAt: null
                        }
                    });
                } finally {
                    await tenantPrisma.$disconnect();
                }
            }
        } catch (_) { /* swallow */ }

        throw err;
    }
}

// Add device quota for a tenant (called by provider/owner)
const addDeviceQuotaForTenant = async (tenantId: number, quantity: number) => {
    if (!quantity || quantity <= 0) {
        throw new RequestValidateError('Quantity must be a positive number');
    }

    const { primarySubscription } = await getPrimarySubscription(tenantId);
    const addOnId = 2; // Push Notification Device add-on

    // Check existing add-on
    const existingAddOn = await prisma.tenantSubscriptionAddOn.findUnique({
        where: {
            tenantSubscriptionId_addOnId: {
                tenantSubscriptionId: primarySubscription.id,
                addOnId
            }
        }
    });

    if (existingAddOn) {
        // Update quantity (add to existing)
        const updatedAddOn = await prisma.tenantSubscriptionAddOn.update({
            where: {
                tenantSubscriptionId_addOnId: {
                    tenantSubscriptionId: primarySubscription.id,
                    addOnId
                }
            },
            data: {
                quantity: existingAddOn.quantity + quantity
            }
        });

        return {
            success: true,
            message: `Added ${quantity} device quota. Total add-on devices: ${updatedAddOn.quantity}`,
            tenantId,
            addOnQuantity: updatedAddOn.quantity,
            monthlyCost: updatedAddOn.quantity * 19000,
            subscriptionId: primarySubscription.id
        };
    } else {
        // Create new add-on
        const newAddOn = await prisma.tenantSubscriptionAddOn.create({
            data: {
                tenantSubscriptionId: primarySubscription.id,
                addOnId,
                quantity
            }
        });

        return {
            success: true,
            message: `Added ${quantity} device quota`,
            tenantId,
            addOnQuantity: newAddOn.quantity,
            monthlyCost: newAddOn.quantity * 19000,
            subscriptionId: primarySubscription.id
        };
    }
};

// Reduce device quota for a tenant (called by provider/owner)
// This will automatically deactivate excess devices (oldest first)
const reduceDeviceQuotaForTenant = async (tenantId: number, quantityToReduce: number) => {
    if (!quantityToReduce || quantityToReduce <= 0) {
        throw new RequestValidateError('Quantity must be a positive number');
    }

    const deviceLimitService = require('../pushy/device.service');

    // Step 1: Get primary subscription with add-ons
    const { primarySubscription } = await getPrimarySubscription(tenantId);

    // Step 2: Find the device add-on to reduce
    const addOnId = 2; // Push Notification Device add-on
    const deviceAddOn = primarySubscription.subscriptionAddOn.find(
        (addon: any) => addon.addOnId === addOnId
    );

    if (!deviceAddOn) {
        throw new NotFoundError('No device add-on found to reduce');
    }

    if (deviceAddOn.quantity < quantityToReduce) {
        throw new RequestValidateError(
            `Cannot reduce by ${quantityToReduce}. Current add-on quantity is ${deviceAddOn.quantity}`
        );
    }

    // Step 3: Reduce the add-on quantity
    const newQuantity = deviceAddOn.quantity - quantityToReduce;

    if (newQuantity === 0) {
        // Remove add-on completely
        await prisma.tenantSubscriptionAddOn.delete({
            where: {
                tenantSubscriptionId_addOnId: {
                    tenantSubscriptionId: primarySubscription.id,
                    addOnId
                }
            }
        });
    } else {
        // Update quantity
        await prisma.tenantSubscriptionAddOn.update({
            where: {
                tenantSubscriptionId_addOnId: {
                    tenantSubscriptionId: primarySubscription.id,
                    addOnId
                }
            },
            data: {
                quantity: newQuantity
            }
        });
    }

    // Step 4: Check if devices exceed new limit
    const limitCheck = await deviceLimitService.checkDeviceLimit(tenantId);
    const currentDeviceCount = limitCheck.currentCount;
    const newMaxAllowed = limitCheck.maxAllowed;

    const deactivatedDevices = [];

    if (currentDeviceCount > newMaxAllowed) {
        const excessCount = currentDeviceCount - newMaxAllowed;

        // Step 5: Get devices to deactivate (oldest first - FIFO based on lastActiveAt)
        const devicesToDeactivate = await prisma.pushyDevice.findMany({
            where: {
                tenantUser: { tenantId },
                isActive: true
            },
            orderBy: {
                lastActiveAt: 'asc' // Oldest devices first
            },
            take: excessCount,
            include: {
                tenantUser: {
                    select: {
                        username: true
                    }
                }
            }
        });

        // Step 6: Deactivate excess devices
        for (const device of devicesToDeactivate) {
            await prisma.pushyDevice.update({
                where: { id: device.id },
                data: { isActive: false }
            });

            // Deallocate device
            await deviceLimitService.deallocateDevice(device.id);

            deactivatedDevices.push({
                deviceToken: device.deviceToken,
                platform: device.platform,
                deviceName: device.deviceName,
                username: device.tenantUser?.username || 'Unknown',
                lastActiveAt: device.lastActiveAt
            });
        }
    }

    return {
        success: true,
        message: deactivatedDevices.length > 0
            ? `Reduced ${quantityToReduce} device quota. Automatically deactivated ${deactivatedDevices.length} excess device(s).`
            : `Reduced ${quantityToReduce} device quota.`,
        tenantId,
        addOnQuantity: newQuantity,
        monthlyCost: newQuantity * 19000,
        subscriptionId: primarySubscription.id,
        quota: {
            previous: newMaxAllowed + quantityToReduce,
            current: newMaxAllowed
        },
        devices: {
            active: currentDeviceCount - deactivatedDevices.length,
            deactivated: deactivatedDevices.length,
            deactivatedList: deactivatedDevices
        }
    };
};

// Get all active devices for a tenant
const getTenantDevices = async (tenantId: number) => {
    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId }
    });

    if (!tenant) {
        throw new NotFoundError(`Tenant with ID ${tenantId} not found`);
    }

    // Get all devices for this tenant (both active and inactive)
    const allDevices = await prisma.pushyDevice.findMany({
        where: {
            tenantUser: {
                tenantId
            }
        },
        include: {
            tenantUser: {
                select: {
                    id: true,
                    username: true,
                    role: true
                }
            },
            allocation: {
                select: {
                    allocationType: true,
                    activatedAt: true
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    // Get device limit info
    const deviceLimitService = require('../pushy/device.service');
    const limitCheck = await deviceLimitService.checkDeviceLimit(tenantId);

    // Count active and inactive devices
    const activeDevices = allDevices.filter(d => d.isActive);
    const inactiveDevices = allDevices.filter(d => !d.isActive);

    return {
        tenantId,
        tenantName: tenant.tenantName,
        deviceUsage: {
            active: activeDevices.length,
            inactive: inactiveDevices.length,
            total: allDevices.length,
            maximum: limitCheck.maxAllowed
        },
        devices: activeDevices.map(device => ({
            id: device.id,
            deviceToken: device.deviceToken,
            platform: device.platform,
            deviceName: device.deviceName,
            appVersion: device.appVersion,
            isActive: device.isActive,
            lastActiveAt: device.lastActiveAt,
            createdAt: device.createdAt,
            user: {
                id: device.tenantUser.id,
                username: device.tenantUser.username,
                role: device.tenantUser.role
            },
            allocation: device.allocation ? {
                type: device.allocation.allocationType,
                activatedAt: device.allocation.activatedAt
            } : null
        }))
    };
};

/**
 * Create warehouse for tenant (POS Owner only)
 * Automatically handles billing via subscription add-on (ID 3)
 */
let createWarehouseForTenant = async (
    tenantId: number,
    data: {
        warehouseName: string;
        street?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
        contactPhone?: string;
        contactEmail?: string;
    }
) => {
    try {
        // Get tenant database name
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { databaseName: true }
        });

        if (!tenant || !tenant.databaseName) {
            throw new NotFoundError('Tenant not found');
        }

        const databaseName = tenant.databaseName;
        const tenantPrisma: TenantPrismaClient = getTenantPrisma(databaseName);

        return await prisma.$transaction(async (globalTx) => {
            return await tenantPrisma.$transaction(async (tenantTx: any) => {

                // Step 1: Generate warehouse code and check for existing soft-deleted warehouse
                const warehouseCode = data.warehouseName.toUpperCase().replace(/\s+/g, '_');
                const existingWarehouse = await globalTx.tenantWarehouse.findFirst({
                    where: {
                        tenantId,
                        warehouseCode,
                        deleted: true
                    }
                });

                let globalWarehouse;
                let warehouse;
                let wasReactivated = false;

                if (existingWarehouse) {
                    // REACTIVATE: Existing soft-deleted warehouse found
                    globalWarehouse = await globalTx.tenantWarehouse.update({
                        where: { id: existingWarehouse.id },
                        data: {
                            warehouseName: data.warehouseName, // Update name in case it changed
                            address: `${data.street || ''}, ${data.city || ''}, ${data.state || ''} ${data.postalCode || ''}`.trim() || null,
                            isActive: true,
                            deleted: false,
                            deletedAt: null
                        }
                    });

                    // Reactivate and update in tenant DB
                    await tenantTx.warehouse.updateMany({
                        where: {
                            tenantWarehouseId: existingWarehouse.id,
                            deleted: true
                        },
                        data: {
                            warehouseName: data.warehouseName,
                            street: data.street || '',
                            city: data.city || '',
                            state: data.state || '',
                            postalCode: data.postalCode || '',
                            country: data.country || '',
                            contactPhone: data.contactPhone,
                            contactEmail: data.contactEmail,
                            deleted: false,
                            deletedAt: null
                        }
                    });

                    // Get the reactivated warehouse
                    warehouse = await tenantTx.warehouse.findFirst({
                        where: { tenantWarehouseId: existingWarehouse.id }
                    });

                    wasReactivated = true;
                } else {
                    // CREATE: No existing warehouse - create new one
                    globalWarehouse = await globalTx.tenantWarehouse.create({
                        data: {
                            tenantId,
                            warehouseName: data.warehouseName,
                            warehouseCode,
                            address: `${data.street || ''}, ${data.city || ''}, ${data.state || ''} ${data.postalCode || ''}`.trim() || null,
                            isActive: true,
                        }
                    });

                    // Create operational warehouse in tenant DB
                    warehouse = await tenantTx.warehouse.create({
                        data: {
                            tenantWarehouseId: globalWarehouse.id,
                            warehouseName: data.warehouseName,
                            warehouseCode: globalWarehouse.warehouseCode,
                            street: data.street || '',
                            city: data.city || '',
                            state: data.state || '',
                            postalCode: data.postalCode || '',
                            country: data.country || '',
                            contactPhone: data.contactPhone,
                            contactEmail: data.contactEmail,
                        }
                    });
                }

                // Step 3: Handle warehouse add-on billing (matches user/device pattern)
                // Get primary subscription using helper (pass transaction context)
                const { primarySubscription } = await getPrimarySubscription(tenantId, globalTx);

                // Count total active warehouses (including this new one)
                const totalWarehouses = await globalTx.tenantWarehouse.count({
                    where: {
                        tenantId,
                        isActive: true,
                        deleted: false
                    }
                });

                // Calculate billable warehouses (first one is free)
                const billableWarehouses = Math.max(0, totalWarehouses - 1);

                let isFreeWarehouse = false;
                let monthlyCost = 0;

                if (billableWarehouses > 0) {
                    // Update or create warehouse add-on (Add-on ID 3)
                    const warehouseAddOnId = 3; // "Extra Warehouse" add-on

                    const existingAddOn = await globalTx.tenantSubscriptionAddOn.findUnique({
                        where: {
                            tenantSubscriptionId_addOnId: {
                                tenantSubscriptionId: primarySubscription.id,
                                addOnId: warehouseAddOnId,
                            }
                        }
                    });

                    if (!existingAddOn) {
                        await globalTx.tenantSubscriptionAddOn.create({
                            data: {
                                tenantSubscriptionId: primarySubscription.id,
                                addOnId: warehouseAddOnId,
                                quantity: billableWarehouses,
                            }
                        });
                    } else {
                        await globalTx.tenantSubscriptionAddOn.update({
                            where: {
                                tenantSubscriptionId_addOnId: {
                                    tenantSubscriptionId: primarySubscription.id,
                                    addOnId: warehouseAddOnId,
                                }
                            },
                            data: { quantity: billableWarehouses }
                        });
                    }

                    monthlyCost = billableWarehouses * 149_000; // 149k IDR per warehouse
                } else {
                    isFreeWarehouse = true;
                }

                return {
                    globalWarehouse,
                    warehouse,
                    wasReactivated,
                    isFreeWarehouse,
                    billableWarehouses,
                    totalWarehouses,
                    monthlyCost,
                    addOnAttachedTo: primarySubscription.id
                };
            });
        });
    } catch (error) {
        throw error;
    }
};

/**
 * Delete warehouse for tenant (POS Owner only)
 * Automatically updates billing via subscription add-on (ID 3)
 */
let deleteWarehouseForTenant = async (
    tenantId: number,
    warehouseId: number
) => {
    try {
        // Get tenant database name
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { databaseName: true }
        });

        if (!tenant || !tenant.databaseName) {
            throw new NotFoundError('Tenant not found');
        }

        const databaseName = tenant.databaseName;
        const tenantPrisma: TenantPrismaClient = getTenantPrisma(databaseName);

        return await prisma.$transaction(async (globalTx) => {
            return await tenantPrisma.$transaction(async (tenantTx: any) => {

                // Step 1: Get warehouse from tenant DB
                const warehouse = await tenantTx.warehouse.findUnique({
                    where: { id: warehouseId }
                });

                if (!warehouse) {
                    throw new Error('Warehouse not found');
                }

                // Step 2: Check if warehouse has active stock
                const hasStock = await tenantTx.warehouseStockBalance.findFirst({
                    where: {
                        warehouseId: warehouse.id,
                        availableQuantity: { gt: 0 }
                    }
                });

                if (hasStock) {
                    throw new Error(
                        'Cannot delete warehouse with active stock. ' +
                        'Please transfer or clear stock first.'
                    );
                }

                // Step 3: Soft delete warehouse in tenant DB
                await tenantTx.warehouse.update({
                    where: { id: warehouseId },
                    data: {
                        deleted: true,
                        deletedAt: new Date()
                    }
                });

                // Step 4: Soft delete in global DB
                await globalTx.tenantWarehouse.update({
                    where: { id: warehouse.tenantWarehouseId },
                    data: {
                        isActive: false,
                        deleted: true,
                        deletedAt: new Date()
                    }
                });

                // Step 5: Update warehouse add-on quantity
                // Get primary subscription using helper (pass transaction context)
                const { primarySubscription } = await getPrimarySubscription(tenantId, globalTx);

                // Recalculate total active warehouses (excluding the one we just deleted)
                const totalWarehouses = await globalTx.tenantWarehouse.count({
                    where: {
                        tenantId,
                        isActive: true,
                        deleted: false
                    }
                });

                // Calculate billable warehouses (first one is free)
                const billableWarehouses = Math.max(0, totalWarehouses - 1);

                // Update or delete warehouse add-on (Add-on ID 3)
                const warehouseAddOnId = 3; // "Extra Warehouse" add-on

                const existingAddOn = await globalTx.tenantSubscriptionAddOn.findUnique({
                    where: {
                        tenantSubscriptionId_addOnId: {
                            tenantSubscriptionId: primarySubscription.id,
                            addOnId: warehouseAddOnId,
                        }
                    }
                });

                if (billableWarehouses === 0) {
                    // No billable warehouses left, remove add-on
                    if (existingAddOn) {
                        await globalTx.tenantSubscriptionAddOn.delete({
                            where: {
                                tenantSubscriptionId_addOnId: {
                                    tenantSubscriptionId: primarySubscription.id,
                                    addOnId: warehouseAddOnId,
                                }
                            }
                        });
                    }
                } else {
                    // Still have billable warehouses, update quantity
                    if (existingAddOn) {
                        await globalTx.tenantSubscriptionAddOn.update({
                            where: {
                                tenantSubscriptionId_addOnId: {
                                    tenantSubscriptionId: primarySubscription.id,
                                    addOnId: warehouseAddOnId,
                                }
                            },
                            data: { quantity: billableWarehouses }
                        });
                    } else {
                        // Shouldn't happen, but create if missing
                        await globalTx.tenantSubscriptionAddOn.create({
                            data: {
                                tenantSubscriptionId: primarySubscription.id,
                                addOnId: warehouseAddOnId,
                                quantity: billableWarehouses,
                            }
                        });
                    }
                }

                const monthlyCost = billableWarehouses * 149_000; // 149k IDR per warehouse

                return {
                    deletedWarehouse: warehouse,
                    remainingWarehouses: totalWarehouses,
                    billableWarehouses,
                    monthlyCost,
                    message: totalWarehouses === 0
                        ? 'All warehouses deleted. No warehouse charges.'
                        : `${totalWarehouses} warehouse(s) remaining. Billable: ${billableWarehouses}`
                };
            });
        });
    } catch (error) {
        throw error;
    }
};

/**
 * Get all warehouses for tenant (POS Owner only)
 */
let getTenantWarehouses = async (tenantId: number) => {
    try {
        const warehouses = await prisma.tenantWarehouse.findMany({
            where: {
                tenantId,
                deleted: false
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return {
            data: warehouses,
            total: warehouses.length
        };
    } catch (error) {
        throw error;
    }
};

/**
 * Helper function to handle downgrade to Basic plan
 * Deactivates warehouses and removes add-ons
 */
const handleDowngradeToBasic = async (
    tenantId: number,
    primarySubscription: any,
    globalTx: any,
    tenantPrisma: any
) => {
    const warehouseAddOnId = 3; // "Extra Warehouse" add-on
    const deviceAddOnId = 2; // "Push Notification Device" add-on

    // Step 1: Count warehouses before deactivation
    const warehouseCount = await globalTx.tenantWarehouse.count({
        where: {
            tenantId,
            isActive: true,
            deleted: false
        }
    });

    // Step 2: Deactivate all warehouses in GLOBAL DB
    await globalTx.tenantWarehouse.updateMany({
        where: {
            tenantId,
            isActive: true,
            deleted: false
        },
        data: {
            isActive: false,
            deleted: true,
            deletedAt: new Date()
        }
    });

    // Step 3: Deactivate all warehouses in TENANT DB
    await tenantPrisma.warehouse.updateMany({
        where: {
            deleted: false
        },
        data: {
            deleted: true,
            deletedAt: new Date()
        }
    });

    // Step 4: Remove warehouse add-on (ID 3)
    const warehouseAddOnDeleted = await globalTx.tenantSubscriptionAddOn.deleteMany({
        where: {
            tenantSubscriptionId: primarySubscription.id,
            addOnId: warehouseAddOnId
        }
    });

    // Step 5: Remove ALL device add-ons (ID 2) - Basic plan has 0 device support
    const deviceAddOnDeleted = await globalTx.tenantSubscriptionAddOn.deleteMany({
        where: {
            tenantSubscriptionId: primarySubscription.id,
            addOnId: deviceAddOnId
        }
    });

    return {
        warehousesDeactivated: warehouseCount,
        warehouseAddOnRemoved: warehouseAddOnDeleted.count > 0,
        deviceAddOnRemoved: deviceAddOnDeleted.count > 0,
        deviceAddOnCount: deviceAddOnDeleted.count
    };
};

/**
 * Change tenant plan (upgrade or downgrade)
 * Automatically invalidates tokens and clears plan cache
 * Handles downgrade logic: deactivates warehouses and removes add-ons
 */
const changeTenantPlan = async (tenantId: number, newPlanName: string) => {
    let tenantPrisma: TenantPrismaClient | null = null;

    try {
        // Step 1: Validate new plan exists and get tenant info in parallel
        const [newPlan, tenant] = await Promise.all([
            prisma.subscriptionPlan.findFirst({
                where: { planName: newPlanName }
            }),
            prisma.tenant.findUnique({
                where: { id: tenantId },
                select: { databaseName: true }
            })
        ]);

        if (!newPlan) {
            throw new NotFoundError(`Plan "${newPlanName}" not found`);
        }

        if (!tenant || !tenant.databaseName) {
            throw new NotFoundError('Tenant database not found');
        }

        // Step 2: Get primary subscription and current plan
        const { primarySubscription: currentSubscription, tenantOutlets } = await getPrimarySubscription(tenantId);
        const currentPlanName = currentSubscription.subscriptionPlan.planName;

        if (currentPlanName === newPlanName) {
            throw new RequestValidateError(`Tenant is already on "${newPlanName}" plan`);
        }

        // Step 3: Initialize tenant database connection
        tenantPrisma = getTenantPrisma(tenant.databaseName);

        // Step 4: Determine plan change direction
        const isDowngradingToBasic = (
            currentPlanName === 'Pro' && newPlanName === 'Basic'
        );
        const isUpgradingToPro = (
            currentPlanName === 'Basic' && newPlanName === 'Pro'
        );

        let downgradeResult = null;
        let upgradeResult = null;

        // Step 5: Handle downgrade logic in transaction
        if (isDowngradingToBasic) {
            downgradeResult = await prisma.$transaction(async (globalTx) => {
                return await handleDowngradeToBasic(
                    tenantId,
                    currentSubscription,
                    globalTx,
                    tenantPrisma!
                );
            });
        }

        // Step 5b: Handle upgrade to Pro - create or reactivate default warehouse
        if (isUpgradingToPro) {
            upgradeResult = await prisma.$transaction(async (globalTx) => {
                return await tenantPrisma!.$transaction(async (tenantTx: any) => {
                    // Check if soft-deleted Main Warehouse exists
                    const existingWarehouse = await globalTx.tenantWarehouse.findFirst({
                        where: {
                            tenantId,
                            warehouseCode: 'MAIN_WAREHOUSE',
                            deleted: true
                        }
                    });

                    if (existingWarehouse) {
                        // REACTIVATE: Existing warehouse found - reactivate it
                        const reactivatedGlobalWarehouse = await globalTx.tenantWarehouse.update({
                            where: { id: existingWarehouse.id },
                            data: {
                                isActive: true,
                                deleted: false,
                                deletedAt: null
                            }
                        });

                        // Reactivate in tenant DB
                        await tenantTx.warehouse.updateMany({
                            where: {
                                tenantWarehouseId: existingWarehouse.id,
                                deleted: true
                            },
                            data: {
                                deleted: false,
                                deletedAt: null
                            }
                        });

                        // Get the reactivated tenant warehouse details
                        const tenantWarehouse = await tenantTx.warehouse.findFirst({
                            where: { tenantWarehouseId: existingWarehouse.id }
                        });

                        return {
                            warehouseReactivated: true,
                            warehouseCreated: false,
                            warehouseId: tenantWarehouse?.id,
                            warehouseName: reactivatedGlobalWarehouse.warehouseName,
                            globalWarehouseId: reactivatedGlobalWarehouse.id
                        };
                    } else {
                        // CREATE: No existing warehouse - create new one
                        const globalWarehouse = await globalTx.tenantWarehouse.create({
                            data: {
                                tenantId,
                                warehouseName: "Main Warehouse",
                                warehouseCode: "MAIN_WAREHOUSE",
                                isActive: true,
                            }
                        });

                        // Create warehouse in tenant DB
                        const tenantWarehouse = await tenantTx.warehouse.create({
                            data: {
                                tenantWarehouseId: globalWarehouse.id,
                                warehouseName: "Main Warehouse",
                                warehouseCode: "MAIN_WAREHOUSE",
                            }
                        });

                        return {
                            warehouseReactivated: false,
                            warehouseCreated: true,
                            warehouseId: tenantWarehouse.id,
                            warehouseName: tenantWarehouse.warehouseName,
                            globalWarehouseId: globalWarehouse.id
                        };
                    }
                });
            });
        }

        // Step 6: Update all outlet subscriptions to new plan
        const updatedSubscriptions = [];
        for (const outlet of tenantOutlets) {
            for (const subscription of outlet.subscriptions) {
                const updated = await prisma.tenantSubscription.update({
                    where: { id: subscription.id },
                    data: {
                        subscriptionPlanId: newPlan.id
                    },
                    include: {
                        subscriptionPlan: true
                    }
                });
                updatedSubscriptions.push(updated);
            }
        }

        // Step 7: Invalidate tokens and clear cache
        const TokenInvalidationService = require('../pushy/token-invalidation.service').default;
        await TokenInvalidationService.onPlanChange(tenantId, currentPlanName, newPlanName);

        // Construct response message
        let message = '';
        if (isDowngradingToBasic) {
            message = `Successfully downgraded from "${currentPlanName}" to "${newPlanName}". All warehouses and push notification devices have been deactivated.`;
        } else if (isUpgradingToPro) {
            // Check if warehouse was reactivated or created
            if (upgradeResult?.warehouseReactivated) {
                message = `Successfully upgraded from "${currentPlanName}" to "${newPlanName}". Main warehouse has been reactivated.`;
            } else {
                message = `Successfully upgraded from "${currentPlanName}" to "${newPlanName}". Main warehouse has been created.`;
            }
        } else {
            message = `Successfully changed from "${currentPlanName}" to "${newPlanName}"`;
        }

        return {
            success: true,
            message,
            tenantId,
            previousPlan: currentPlanName,
            newPlan: newPlanName,
            updatedSubscriptions: updatedSubscriptions.length,
            tokensInvalidated: true,
            cacheCleared: true,
            downgradeDetails: downgradeResult, // null for upgrades
            upgradeDetails: upgradeResult // null for downgrades
        };
    } catch (error) {
        console.error('Error changing tenant plan:', error);
        throw error;
    } finally {
        // Ensure tenant DB connection is closed
        if (tenantPrisma) {
            await tenantPrisma.$disconnect();
        }
    }
};

// ============================================
// Payment Management - Helper Functions
// ============================================

const GRACE_PERIOD_DAYS = 7;

/**
 * Calculate subscription status with grace period
 */
const getSubscriptionStatus = (subscriptionValidUntil: Date): 'Active' | 'Grace' | 'Expired' => {
    const now = new Date();
    const validUntil = new Date(subscriptionValidUntil);
    const graceEnd = new Date(validUntil);
    graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS);

    if (now <= validUntil) return 'Active';
    if (now <= graceEnd) return 'Grace';
    return 'Expired';
};

/**
 * Build cost snapshot from subscription data for payment record
 */
const buildCostSnapshot = (subscription: any): CostSnapshot => {
    const basePlanCost = subscription.subscriptionPlan?.price || 0;
    const addOns = (subscription.subscriptionAddOn || []).map((sa: any) => ({
        addOnId: sa.addOn?.id || sa.addOnId,
        name: sa.addOn?.name || 'Unknown',
        quantity: sa.quantity,
        pricePerUnit: sa.addOn?.pricePerUnit || 0,
        totalCost: (sa.addOn?.pricePerUnit || 0) * sa.quantity
    }));

    const discounts: CostSnapshot['discounts'] = [];
    if (subscription.discount && (!subscription.discount.endDate || new Date() <= subscription.discount.endDate)) {
        const discountValue = subscription.discount.value;
        let amountOff = 0;

        if (subscription.discount.discountType === 'percentage') {
            const addOnTotal = addOns.reduce((sum: number, a: any) => sum + a.totalCost, 0);
            amountOff = (basePlanCost + addOnTotal) * (discountValue / 100);
        } else if (subscription.discount.discountType === 'fixed') {
            amountOff = discountValue;
        }

        discounts.push({
            discountId: subscription.discount.id,
            name: subscription.discount.name,
            type: subscription.discount.discountType,
            value: discountValue,
            amountOff
        });
    }

    const totalBeforeDiscount = basePlanCost + addOns.reduce((sum: number, a: any) => sum + a.totalCost, 0);
    const totalDiscount = discounts.reduce((sum: number, d) => sum + d.amountOff, 0);
    const totalAfterDiscount = Math.max(0, totalBeforeDiscount - totalDiscount);

    return {
        planName: subscription.subscriptionPlan?.planName || 'Unknown',
        planId: subscription.subscriptionPlan?.id || 0,
        basePlanCost,
        addOns,
        discounts,
        totalBeforeDiscount,
        totalDiscount,
        totalAfterDiscount
    };
};

/**
 * Generate invoice number: INV-YYYYMM-XXXX
 */
const generateInvoiceNumber = async (tx: any): Promise<string> => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `INV-${year}${month}-`;

    // Get last invoice of this month
    const lastInvoice = await tx.tenantPayment.findFirst({
        where: { invoiceNumber: { startsWith: prefix } },
        orderBy: { invoiceNumber: 'desc' }
    });

    let sequence = 1;
    if (lastInvoice) {
        const lastSeq = parseInt(lastInvoice.invoiceNumber.slice(-4));
        sequence = lastSeq + 1;
    }

    return `${prefix}${sequence.toString().padStart(4, '0')}`;
};

// ============================================
// Payment Management - Service Methods
// ============================================

/**
 * Record payment and extend subscription
 */
const recordPayment = async (
    tenantId: number,
    outletId: number,
    paymentData: {
        amount: number;
        paymentMethod: string;
        referenceNumber?: string;
        paymentDate: Date;
        extensionMonths?: number;
        notes?: string;
        recordedBy?: number;
    }
): Promise<RecordPaymentResponse> => {
    const extensionMonths = paymentData.extensionMonths || 1;

    return await prisma.$transaction(async (tx) => {
        // Step 1: Get outlet's subscription
        const subscription = await tx.tenantSubscription.findFirst({
            where: {
                tenantId,
                outletId,
                status: { in: ['Active', 'active', 'trial', 'Grace', 'Expired'] }
            },
            include: {
                subscriptionPlan: true,
                subscriptionAddOn: {
                    include: { addOn: true }
                },
                discount: true,
                outlet: true
            }
        });

        if (!subscription) {
            throw new NotFoundError('No subscription found for this outlet');
        }

        // Step 2: Generate invoice number
        const invoiceNumber = await generateInvoiceNumber(tx);

        // Step 3: Calculate new dates
        const now = new Date();
        const currentValidUntil = new Date(subscription.subscriptionValidUntil);
        const currentStatus = getSubscriptionStatus(currentValidUntil);

        let periodFrom: Date;
        if (currentStatus === 'Expired') {
            // Past grace period - start from today
            periodFrom = now;
        } else {
            // Active or Grace - extend from current valid date
            periodFrom = currentValidUntil;
        }

        const periodTo = new Date(periodFrom);
        periodTo.setMonth(periodTo.getMonth() + extensionMonths);

        // Step 4: Build cost snapshot
        const costSnapshot = buildCostSnapshot(subscription);

        // Step 5: Create payment record
        const payment = await tx.tenantPayment.create({
            data: {
                invoiceNumber,
                tenantId,
                outletId,
                subscriptionId: subscription.id,
                amount: paymentData.amount,
                currency: 'IDR',
                paymentMethod: paymentData.paymentMethod,
                referenceNumber: paymentData.referenceNumber || null,
                notes: paymentData.notes || null,
                paymentDate: paymentData.paymentDate,
                periodFrom,
                periodTo,
                previousValidUntil: currentValidUntil,
                extensionMonths,
                costSnapshot: costSnapshot as any,
                recordedBy: paymentData.recordedBy || null
            }
        });

        // Step 6: Update subscription
        await tx.tenantSubscription.update({
            where: { id: subscription.id },
            data: {
                subscriptionValidUntil: periodTo,
                nextPaymentDate: periodTo,
                status: 'Active'
            }
        });

        // Build response
        const paymentResponse: TenantPaymentResponse = {
            id: payment.id,
            invoiceNumber: payment.invoiceNumber,
            tenantId: payment.tenantId,
            outletId: payment.outletId,
            outletName: subscription.outlet.outletName,
            amount: payment.amount,
            currency: payment.currency,
            paymentMethod: payment.paymentMethod,
            referenceNumber: payment.referenceNumber,
            paymentDate: payment.paymentDate.toISOString(),
            periodFrom: payment.periodFrom.toISOString(),
            periodTo: payment.periodTo.toISOString(),
            extensionMonths: payment.extensionMonths,
            costSnapshot: payment.costSnapshot as unknown as CostSnapshot,
            recordedAt: payment.recordedAt.toISOString()
        };

        return {
            success: true,
            message: `Payment recorded. Subscription extended to ${periodTo.toISOString().split('T')[0]}`,
            payment: paymentResponse,
            subscription: {
                previousValidUntil: currentValidUntil.toISOString(),
                newValidUntil: periodTo.toISOString(),
                status: 'Active'
            }
        };
    });
};

/**
 * Get payment history for a tenant
 */
const getPaymentsByTenant = async (
    tenantId: number,
    options?: {
        outletId?: number;
        fromDate?: Date;
        toDate?: Date;
        limit?: number;
        offset?: number;
    }
): Promise<PaymentListResponse> => {
    const limit = Math.min(options?.limit || 50, 100);
    const offset = options?.offset || 0;

    const where: any = { tenantId };
    if (options?.outletId) {
        where.outletId = options.outletId;
    }
    if (options?.fromDate || options?.toDate) {
        where.paymentDate = {};
        if (options.fromDate) where.paymentDate.gte = options.fromDate;
        if (options.toDate) where.paymentDate.lte = options.toDate;
    }

    const [payments, total] = await Promise.all([
        prisma.tenantPayment.findMany({
            where,
            include: {
                outlet: { select: { outletName: true } }
            },
            orderBy: { paymentDate: 'desc' },
            take: limit,
            skip: offset
        }),
        prisma.tenantPayment.count({ where })
    ]);

    return {
        payments: payments.map(p => ({
            id: p.id,
            invoiceNumber: p.invoiceNumber,
            tenantId: p.tenantId,
            outletId: p.outletId,
            outletName: p.outlet.outletName,
            amount: p.amount,
            currency: p.currency,
            paymentMethod: p.paymentMethod,
            referenceNumber: p.referenceNumber,
            paymentDate: p.paymentDate.toISOString(),
            periodFrom: p.periodFrom.toISOString(),
            periodTo: p.periodTo.toISOString(),
            extensionMonths: p.extensionMonths,
            costSnapshot: p.costSnapshot as unknown as CostSnapshot,
            recordedAt: p.recordedAt.toISOString()
        })),
        total,
        limit,
        offset
    };
};

/**
 * Get all payments (admin dashboard)
 */
const getAllPayments = async (
    options: {
        fromDate: Date;
        toDate: Date;
        tenantId?: number;
        limit?: number;
        offset?: number;
    }
): Promise<AllPaymentsResponse> => {
    const limit = Math.min(options.limit || 50, 100);
    const offset = options.offset || 0;

    const where: any = {
        paymentDate: {
            gte: options.fromDate,
            lte: options.toDate
        }
    };
    if (options.tenantId) {
        where.tenantId = options.tenantId;
    }

    const [payments, total] = await Promise.all([
        prisma.tenantPayment.findMany({
            where,
            include: {
                tenant: { select: { tenantName: true } },
                outlet: { select: { outletName: true } }
            },
            orderBy: { paymentDate: 'desc' },
            take: limit,
            skip: offset
        }),
        prisma.tenantPayment.count({ where })
    ]);

    return {
        payments: payments.map(p => ({
            id: p.id,
            invoiceNumber: p.invoiceNumber,
            tenantId: p.tenantId,
            tenantName: p.tenant.tenantName,
            outletId: p.outletId,
            outletName: p.outlet.outletName,
            amount: p.amount,
            currency: p.currency,
            paymentMethod: p.paymentMethod,
            referenceNumber: p.referenceNumber,
            paymentDate: p.paymentDate.toISOString(),
            periodFrom: p.periodFrom.toISOString(),
            periodTo: p.periodTo.toISOString(),
            extensionMonths: p.extensionMonths,
            costSnapshot: p.costSnapshot as unknown as CostSnapshot,
            recordedAt: p.recordedAt.toISOString()
        })),
        total,
        limit,
        offset
    };
};

/**
 * Get tenant billing summary (consolidated view across all outlets)
 */
const getTenantBillingSummary = async (tenantId: number): Promise<TenantBillingSummaryResponse> => {
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
            tenantOutlets: {
                where: { isActive: true },
                include: {
                    subscriptions: {
                        where: { status: { in: ['Active', 'active', 'trial', 'Grace', 'Expired'] } },
                        include: {
                            subscriptionPlan: true,
                            subscriptionAddOn: { include: { addOn: true } },
                            discount: true
                        }
                    }
                }
            }
        }
    });

    if (!tenant) {
        throw new NotFoundError('Tenant not found');
    }

    const now = new Date();
    let totalMonthlyCost = 0;

    const outlets = tenant.tenantOutlets.map(outlet => {
        const subscription = outlet.subscriptions[0];
        if (!subscription) {
            return {
                outletId: outlet.id,
                outletName: outlet.outletName,
                subscriptionStatus: 'None',
                subscriptionValidUntil: '',
                graceEndDate: '',
                daysUntilExpiry: 0,
                planName: 'None',
                basePlanCost: 0,
                addOns: [],
                discounts: [],
                outletTotalCost: 0
            };
        }

        const validUntil = new Date(subscription.subscriptionValidUntil);
        const graceEnd = new Date(validUntil);
        graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS);

        const status = getSubscriptionStatus(validUntil);
        const daysUntilExpiry = Math.ceil((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        const basePlanCost = subscription.subscriptionPlan.price;
        const addOns = subscription.subscriptionAddOn.map(sa => ({
            name: sa.addOn.name,
            quantity: sa.quantity,
            totalCost: sa.addOn.pricePerUnit * sa.quantity
        }));

        const discounts: Array<{ name: string; amount: number }> = [];
        let totalDiscount = 0;
        if (subscription.discount && (!subscription.discount.endDate || now <= subscription.discount.endDate)) {
            const addOnTotal = addOns.reduce((sum, a) => sum + a.totalCost, 0);
            let amount = 0;
            if (subscription.discount.discountType === 'percentage') {
                amount = (basePlanCost + addOnTotal) * (subscription.discount.value / 100);
            } else {
                amount = subscription.discount.value;
            }
            discounts.push({ name: subscription.discount.name, amount });
            totalDiscount = amount;
        }

        const addOnTotal = addOns.reduce((sum, a) => sum + a.totalCost, 0);
        const outletTotalCost = Math.max(0, basePlanCost + addOnTotal - totalDiscount);
        totalMonthlyCost += outletTotalCost;

        return {
            outletId: outlet.id,
            outletName: outlet.outletName,
            subscriptionStatus: status,
            subscriptionValidUntil: validUntil.toISOString(),
            graceEndDate: graceEnd.toISOString(),
            daysUntilExpiry,
            planName: subscription.subscriptionPlan.planName,
            basePlanCost,
            addOns,
            discounts,
            outletTotalCost
        };
    });

    return {
        tenantId: tenant.id,
        tenantName: tenant.tenantName,
        totalMonthlyCost,
        outlets
    };
};

/**
 * Get upcoming payments summary (counts by status)
 */
const getUpcomingPaymentsSummary = async (daysAhead: number = 30): Promise<UpcomingPaymentsSummaryResponse> => {
    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const graceStart = new Date(now);
    graceStart.setDate(graceStart.getDate() - GRACE_PERIOD_DAYS);

    // Raw SQL for performance - use subquery to avoid only_full_group_by issues
    const results = await prisma.$queryRaw<Array<{
        status: string;
        tenantCount: bigint;
        outletCount: bigint;
    }>>`
        SELECT
            sub.status,
            COUNT(DISTINCT sub.tenantId) as tenantCount,
            COUNT(DISTINCT sub.outletId) as outletCount
        FROM (
            SELECT
                t.ID as tenantId,
                o.ID as outletId,
                CASE
                    WHEN ts.SUBSCRIPTION_VALID_UNTIL >= NOW() THEN 'active'
                    WHEN ts.SUBSCRIPTION_VALID_UNTIL >= DATE_SUB(NOW(), INTERVAL ${GRACE_PERIOD_DAYS} DAY) THEN 'grace'
                    ELSE 'expired'
                END as status
            FROM tenant t
            JOIN tenant_outlet o ON t.ID = o.TENANT_ID AND o.IS_ACTIVE = true
            JOIN tenant_subscription ts ON o.ID = ts.OUTLET_ID AND ts.STATUS IN ('Active', 'active', 'trial')
            WHERE ts.SUBSCRIPTION_VALID_UNTIL <= ${futureDate}
        ) sub
        GROUP BY sub.status
    `;

    let activeExpiring = 0;
    let graceExpiring = 0;
    let expiredCount = 0;
    let totalTenants = 0;
    let totalOutlets = 0;

    const tenantIds = new Set<number>();

    for (const row of results) {
        const outletNum = Number(row.outletCount);
        totalOutlets += outletNum;

        if (row.status === 'active') {
            activeExpiring = outletNum;
        } else if (row.status === 'grace') {
            graceExpiring = outletNum;
        } else {
            expiredCount = outletNum;
        }
    }

    // Get distinct tenant count
    const tenantResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT t.ID) as count
        FROM tenant t
        JOIN tenant_outlet o ON t.ID = o.TENANT_ID AND o.IS_ACTIVE = true
        JOIN tenant_subscription ts ON o.ID = ts.OUTLET_ID AND ts.STATUS IN ('Active', 'active', 'trial')
        WHERE ts.SUBSCRIPTION_VALID_UNTIL <= ${futureDate}
    `;
    totalTenants = Number(tenantResult[0]?.count || 0);

    return {
        days: daysAhead,
        summary: {
            activeExpiring,
            graceExpiring,
            expiredCount,
            totalTenants,
            totalOutlets
        }
    };
};

/**
 * Get upcoming payments (paginated list by tenant)
 */
const getUpcomingPayments = async (options: {
    days?: number;
    status?: 'active' | 'grace' | 'expired' | 'all';
    limit?: number;
    offset?: number;
}): Promise<UpcomingPaymentsResponse> => {
    const days = options.days || 30;
    const status = options.status || 'all';
    const limit = Math.min(options.limit || 50, 100);
    const offset = options.offset || 0;

    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + days);

    let statusFilter = '';
    if (status === 'active') {
        statusFilter = 'AND ts.SUBSCRIPTION_VALID_UNTIL >= NOW()';
    } else if (status === 'grace') {
        statusFilter = `AND ts.SUBSCRIPTION_VALID_UNTIL < NOW() AND ts.SUBSCRIPTION_VALID_UNTIL >= DATE_SUB(NOW(), INTERVAL ${GRACE_PERIOD_DAYS} DAY)`;
    } else if (status === 'expired') {
        statusFilter = `AND ts.SUBSCRIPTION_VALID_UNTIL < DATE_SUB(NOW(), INTERVAL ${GRACE_PERIOD_DAYS} DAY)`;
    }

    // Get tenant summaries with pagination
    const results = await prisma.$queryRaw<Array<{
        tenantId: number;
        tenantName: string;
        outletCount: bigint;
        totalMonthlyCost: number;
        mostUrgentExpiry: Date;
        mostUrgentStatus: string;
    }>>`
        SELECT
            t.ID as tenantId,
            t.TENANT_NAME as tenantName,
            COUNT(DISTINCT o.ID) as outletCount,
            COALESCE(SUM(
                sp.PRICE + COALESCE((
                    SELECT SUM(tsa.QUANTITY * sa.PRICE_PER_UNIT)
                    FROM tenant_subscription_add_on tsa
                    JOIN subscription_add_on sa ON tsa.ADD_ON_ID = sa.ID
                    WHERE tsa.TENANT_SUBSCRIPTION_ID = ts.ID
                ), 0)
            ), 0) as totalMonthlyCost,
            MIN(ts.SUBSCRIPTION_VALID_UNTIL) as mostUrgentExpiry,
            CASE
                WHEN MIN(ts.SUBSCRIPTION_VALID_UNTIL) >= NOW() THEN 'Active'
                WHEN MIN(ts.SUBSCRIPTION_VALID_UNTIL) >= DATE_SUB(NOW(), INTERVAL ${GRACE_PERIOD_DAYS} DAY) THEN 'Grace'
                ELSE 'Expired'
            END as mostUrgentStatus
        FROM tenant t
        JOIN tenant_outlet o ON t.ID = o.TENANT_ID AND o.IS_ACTIVE = true
        JOIN tenant_subscription ts ON o.ID = ts.OUTLET_ID AND ts.STATUS IN ('Active', 'active', 'trial')
        JOIN subscription_plan sp ON ts.SUBSCRIPTION_PLAN_ID = sp.ID
        WHERE ts.SUBSCRIPTION_VALID_UNTIL <= ${futureDate}
        ${Prisma.raw(statusFilter)}
        GROUP BY t.ID, t.TENANT_NAME
        ORDER BY mostUrgentExpiry ASC
        LIMIT ${limit} OFFSET ${offset}
    `;

    // Get total count
    const countResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT t.ID) as count
        FROM tenant t
        JOIN tenant_outlet o ON t.ID = o.TENANT_ID AND o.IS_ACTIVE = true
        JOIN tenant_subscription ts ON o.ID = ts.OUTLET_ID AND ts.STATUS IN ('Active', 'active', 'trial')
        WHERE ts.SUBSCRIPTION_VALID_UNTIL <= ${futureDate}
        ${Prisma.raw(statusFilter)}
    `;

    return {
        upcomingPayments: results.map(r => ({
            tenantId: r.tenantId,
            tenantName: r.tenantName,
            outletCount: Number(r.outletCount),
            totalMonthlyCost: r.totalMonthlyCost,
            mostUrgentExpiry: r.mostUrgentExpiry.toISOString(),
            mostUrgentStatus: r.mostUrgentStatus
        })),
        totalCount: Number(countResult[0]?.count || 0),
        limit,
        offset
    };
};

/**
 * Get all users for a tenant
 */
const getTenantUsers = async (tenantId: number, includeDeleted: boolean = false): Promise<TenantUsersResponse> => {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
        throw new Error('Tenant not found');
    }

    const where: any = { tenantId };
    if (!includeDeleted) {
        where.isDeleted = false;
    }

    const users = await prisma.tenantUser.findMany({
        where,
        select: { id: true, username: true, role: true, isDeleted: true },
        orderBy: { id: 'asc' }
    });

    return {
        tenantId,
        tenantName: tenant.tenantName,
        users,
        total: users.length,
        activeCount: users.filter(u => !u.isDeleted).length
    };
};

export = {
    createTenant,
    createTenantUser,
    deleteTenantUser,
    getTenantCost,
    getAllTenantCost,
    addDeviceQuotaForTenant,
    reduceDeviceQuotaForTenant,
    getTenantDevices,
    createWarehouseForTenant,
    deleteWarehouseForTenant,
    getTenantWarehouses,
    changeTenantPlan,
    // Payment Management
    recordPayment,
    getPaymentsByTenant,
    getAllPayments,
    getTenantBillingSummary,
    getUpcomingPaymentsSummary,
    getUpcomingPayments,
    // User Management
    getTenantUsers
}