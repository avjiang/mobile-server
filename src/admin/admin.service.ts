import { plainToInstance } from "class-transformer";
import { PrismaClient, Tenant, TenantUser, SubscriptionPlan } from "../../prisma/global-client/generated/global";
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { CreateTenantRequest } from "./admin.request";
import bcrypt from "bcryptjs"
import { TenantCostResponse, TenantCreationDto, TenantDto, TotalCostResponse } from "./admin.response";
import { AuthRequest } from "src/middleware/auth-request";
const { getGlobalPrisma, getTenantPrisma, initializeTenantDatabase } = require('../db');

const prisma: PrismaClient = getGlobalPrisma()

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
    } finally {
        await prisma.$disconnect();
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
    } finally {
        await prisma.$disconnect();
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
        // Get all active outlets for this tenant with their subscriptions
        const tenantOutlets = await prisma.tenantOutlet.findMany({
            where: {
                tenantId,
                isActive: true
            },
            include: {
                subscriptions: {
                    where: {
                        status: {
                            in: ['Active', 'active', 'trial']
                        }
                    },
                    include: {
                        subscriptionPlan: true
                    }
                }
            }
        });

        // Calculate total user limit across all outlet subscriptions
        let totalMaxUsers = 0;
        let primarySubscription = null;

        for (const outlet of tenantOutlets) {
            for (const subscription of outlet.subscriptions) {
                const maxUsers = subscription.subscriptionPlan?.maxUsers;
                if (maxUsers !== null && maxUsers !== undefined) {
                    totalMaxUsers += maxUsers;
                    // Keep track of first subscription for add-on attachment
                    if (!primarySubscription) {
                        primarySubscription = subscription;
                    }
                }
            }
        }

        if (primarySubscription && totalMaxUsers > 0) {
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

// Add device quota for a tenant (called by provider/owner)
const addDeviceQuotaForTenant = async (tenantId: number, quantity: number) => {
    if (!quantity || quantity <= 0) {
        throw new RequestValidateError('Quantity must be a positive number');
    }

    // Get all active outlets for this tenant with their subscriptions
    const tenantOutlets = await prisma.tenantOutlet.findMany({
        where: {
            tenantId,
            isActive: true
        },
        include: {
            subscriptions: {
                where: {
                    status: {
                        in: ['Active', 'active', 'trial']
                    }
                },
                include: {
                    subscriptionPlan: true
                }
            }
        }
    });

    if (!tenantOutlets || tenantOutlets.length === 0) {
        throw new NotFoundError('No active outlets found for tenant');
    }

    // Get primary subscription (first active subscription)
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
            monthlyCost: updatedAddOn.quantity * 10000,
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
            monthlyCost: newAddOn.quantity * 10000,
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

    // Step 1: Get all active outlets for this tenant with their subscriptions
    const tenantOutlets = await prisma.tenantOutlet.findMany({
        where: {
            tenantId,
            isActive: true
        },
        include: {
            subscriptions: {
                where: {
                    status: {
                        in: ['Active', 'active', 'trial']
                    }
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

    // Step 2: Find the add-on to reduce
    let primarySubscription = null;
    let deviceAddOn = null;
    const addOnId = 2; // Push Notification Device add-on

    for (const outlet of tenantOutlets) {
        if (outlet.subscriptions.length > 0) {
            primarySubscription = outlet.subscriptions[0];
            deviceAddOn = primarySubscription.subscriptionAddOn.find(
                addon => addon.addOnId === addOnId
            );
            if (deviceAddOn) break;
        }
    }

    if (!primarySubscription) {
        throw new NotFoundError('No active subscription found for tenant');
    }

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
        monthlyCost: newQuantity * 10000,
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
        const tenantPrisma = getTenantPrisma(databaseName);

        return await prisma.$transaction(async (globalTx) => {
            return await tenantPrisma.$transaction(async (tenantTx) => {

                // Step 1: Create TenantWarehouse in global DB
                const warehouseCode = data.warehouseName.toUpperCase().replace(/\s+/g, '_');
                const globalWarehouse = await globalTx.tenantWarehouse.create({
                    data: {
                        tenantId,
                        warehouseName: data.warehouseName,
                        warehouseCode,
                        address: `${data.street || ''}, ${data.city || ''}, ${data.state || ''} ${data.postalCode || ''}`.trim() || null,
                        isActive: true,
                    }
                });

                // Step 2: Create operational warehouse in tenant DB
                const warehouse = await tenantTx.warehouse.create({
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

                // Step 3: Handle warehouse add-on billing (matches user/device pattern)
                // Get all active outlets for this tenant with their subscriptions
                const tenantOutlets = await globalTx.tenantOutlet.findMany({
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
                                subscriptionPlan: true
                            }
                        }
                    }
                });

                // Get primary subscription (attach warehouse add-on here)
                let primarySubscription = null;
                for (const outlet of tenantOutlets) {
                    if (outlet.subscriptions.length > 0) {
                        primarySubscription = outlet.subscriptions[0];
                        break;
                    }
                }

                if (!primarySubscription) {
                    throw new Error('No active subscription found for tenant');
                }

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

                    monthlyCost = billableWarehouses * 100_000; // 100k IDR per warehouse
                } else {
                    isFreeWarehouse = true;
                }

                return {
                    globalWarehouse,
                    warehouse,
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
        const tenantPrisma = getTenantPrisma(databaseName);

        return await prisma.$transaction(async (globalTx) => {
            return await tenantPrisma.$transaction(async (tenantTx) => {

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
                // Get all active outlets for this tenant with their subscriptions
                const tenantOutlets = await globalTx.tenantOutlet.findMany({
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
                                subscriptionPlan: true
                            }
                        }
                    }
                });

                // Get primary subscription
                let primarySubscription = null;
                for (const outlet of tenantOutlets) {
                    if (outlet.subscriptions.length > 0) {
                        primarySubscription = outlet.subscriptions[0];
                        break;
                    }
                }

                if (!primarySubscription) {
                    throw new Error('No active subscription found for tenant');
                }

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

                const monthlyCost = billableWarehouses * 100_000; // 100k IDR per warehouse

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

export = {
    createTenant,
    createTenantUser,
    getTenantCost,
    getAllTenantCost,
    addDeviceQuotaForTenant,
    reduceDeviceQuotaForTenant,
    getTenantDevices,
    createWarehouseForTenant,
    deleteWarehouseForTenant,
    getTenantWarehouses
}