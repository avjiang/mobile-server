import { plainToInstance } from "class-transformer";
import { PrismaClient, Tenant, TenantUser, SubscriptionPlan } from "prisma/global-client";
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

export = { createTenant, getTenantCost, getAllTenantCost }