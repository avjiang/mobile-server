import { plainToInstance } from "class-transformer";
import { PrismaClient, Tenant, TenantUser, SubscriptionPlan } from ".prisma/global-client";
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
                        subscriptionAddOn: {
                            include: { addOn: { select: { name: true, pricePerUnit: true } } },
                        },
                    },
                },
            },
        });

        if (!outlet || outlet.tenant.id !== tenantId) {
            throw new NotFoundError('Outlet not found or unauthorized');
        }

        const subscription = outlet.subscriptions[0];
        const response: OutletDetailsResponse = {
            outletId: outlet.id,
            outletName: outlet.outletName,
            isActive: outlet.isActive,
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
            let discountAmount = 0;

            // Promotional discount (percentage)
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

            // Fixed discount (apply if assigned to this subscription)
            if (
                subscription.discount &&
                subscription.discount.discountType === 'fixed' &&
                (!subscription.discount.endDate || new Date() <= subscription.discount.endDate)
            ) {
                const fixedDiscountAmount = Math.min(
                    subscription.discount.value,
                    basePlanCost + addOns.reduce((sum, addOn) => sum + addOn.totalCost, 0)
                );
                discounts.push({
                    name: subscription.discount.name,
                    type: subscription.discount.discountType,
                    value: fixedDiscountAmount,
                    amount: fixedDiscountAmount,
                });
                discountAmount += fixedDiscountAmount;
            }

            // Total cost for this outlet
            const totalAddOnCost = addOns.reduce((sum, addOn) => sum + addOn.totalCost, 0);
            const totalCostBeforeDiscount = basePlanCost + totalAddOnCost;
            const totalCost = Math.max(0, totalCostBeforeDiscount - discountAmount);

            response.subscription = {
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