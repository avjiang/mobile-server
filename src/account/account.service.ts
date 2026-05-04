import { plainToInstance } from "class-transformer";
import { PrismaClient, Tenant, TenantUser, SubscriptionPlan } from "../../prisma/global-client/generated/global";
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import bcrypt from "bcryptjs"
import { AuthRequest } from "src/middleware/auth-request";
import { AccountRequest } from "./account.request";
import { OutletDetailsResponse } from "./account.response";
const { getGlobalPrisma, getTenantPrisma, initializeTenantDatabase } = require('../db');

const prisma: PrismaClient = getGlobalPrisma()

let getAccountDetails = async (syncRequest: AccountRequest) => {
    const { outletId, tenantId } = syncRequest;

    try {
        // Fetch outlet from global DB
        const outlet = await prisma.tenantOutlet.findUnique({
            where: { id: outletId },
            include: {
                tenant: { select: { id: true } },
                subscriptions: {
                    where: { status: { in: ['active', 'trial'] } },
                    include: {
                        subscriptionPlan: { select: { planName: true, price: true } },
                        discount: true,
                    },
                },
            },
        });

        if (!outlet || outlet.tenant.id !== tenantId) {
            throw new NotFoundError('Outlet not found or unauthorized');
        }

        // Fetch tenant's active add-ons with add-on details
        const tenantAddOns = await prisma.tenantAddOn.findMany({
            where: { tenantId },
            include: { addOn: true },
        });

        const subscription = outlet.subscriptions[0];
        const totalAddOnCost = tenantAddOns.reduce((sum, ta) => sum + ta.addOn.pricePerUnit * ta.quantity, 0);
        const response: OutletDetailsResponse = {
            outletId: outlet.id,
            outletName: outlet.outletName,
            isActive: outlet.isActive,
            serverTime: new Date().toISOString(),
            subscription: null,
            addOns: tenantAddOns.map(ta => ({
                id: ta.addOn.id,
                name: ta.addOn.name,
                addOnType: ta.addOn.addOnType,
                pricePerUnit: ta.addOn.pricePerUnit,
                maxQuantity: ta.addOn.maxQuantity,
                scope: ta.addOn.scope,
                description: ta.addOn.description,
                currentQuantity: ta.quantity,
            })),
            totalMonthlyCost: totalAddOnCost,
        };

        if (subscription) {
            const standardPlanPrice = subscription.subscriptionPlan.price;
            const basePlanCost = subscription.customPrice ?? standardPlanPrice;
            const isCustomPrice = subscription.customPrice != null;

            // Calculate discounts (plan-level only; add-ons are tenant-level)
            const discounts: Array<{ name: string; type: string; value: number; amount: number }> = [];
            let discountAmount = 0;

            // Promotional discount (percentage on plan cost)
            if (
                subscription.discount &&
                subscription.discount.discountType === 'percentage' &&
                (!subscription.discount.endDate || new Date() <= subscription.discount.endDate)
            ) {
                const discountValue = subscription.discount.value / 100;
                const appliesToPlan = subscription.discount.appliesTo.includes('plan');
                const planDiscount = appliesToPlan ? basePlanCost * discountValue : 0;

                discountAmount = planDiscount;
                discounts.push({
                    name: subscription.discount.name,
                    type: subscription.discount.discountType,
                    value: subscription.discount.value,
                    amount: discountAmount,
                });
            }

            // Fixed discount
            if (
                subscription.discount &&
                subscription.discount.discountType === 'fixed' &&
                (!subscription.discount.endDate || new Date() <= subscription.discount.endDate)
            ) {
                const fixedDiscountAmount = Math.min(
                    subscription.discount.value,
                    basePlanCost
                );
                discounts.push({
                    name: subscription.discount.name,
                    type: subscription.discount.discountType,
                    value: fixedDiscountAmount,
                    amount: fixedDiscountAmount,
                });
                discountAmount += fixedDiscountAmount;
            }

            // Total cost for this outlet (plan only; add-ons at tenant level)
            const totalCostBeforeDiscount = basePlanCost;
            const totalCost = Math.max(0, totalCostBeforeDiscount - discountAmount);

            response.subscription = {
                planName: subscription.subscriptionPlan.planName,
                basePlanCost,
                isCustomPrice,
                standardPlanPrice,
                discounts,
                totalCost,
                totalCostBeforeDiscount,
                totalDiscount: discountAmount,
                status: subscription.status,
                subscriptionValidUntil: subscription.subscriptionValidUntil.toISOString(),
            };
            response.totalMonthlyCost += totalCost;
        }
        return response;
    } catch (error) {
        console.error('Error fetching outlet details:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

export = { getAccountDetails }
