import { plainToInstance } from "class-transformer";
import { PrismaClient, Tenant, TenantUser, SubscriptionPlan } from "../../prisma/global-client/generated/global";
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import bcrypt from "bcryptjs"
import { AuthRequest } from "src/middleware/auth-request";
import { AccountRequest } from "./account.request";
import { OutletDetailsResponse } from "./account.response";
import { isLaundryBundledAddOn } from "../constants/add-on-ids";
const { getGlobalPrisma, getTenantPrisma, initializeTenantDatabase } = require('../db');

const prisma: PrismaClient = getGlobalPrisma()

let getAccountDetails = async (syncRequest: AccountRequest) => {
    const { outletId, tenantId, databaseName } = syncRequest;

    try {
        // Resolve the request `outletId` to a **global** `tenant_outlet.id`, which
        // is what the subscription data in the global DB is keyed by.
        //
        // Backward-compat (BE-3): the CURRENT app sends a **tenant-local**
        // `outlet.id`, which we resolve to global via the outlet's
        // `tenantOutletId` FK. The **released** app sends the **global**
        // `tenant_outlet.id` directly. So: try to resolve it as a tenant-local
        // outlet first; if there's no such local outlet, treat the id as already
        // global. Either way the `outlet.tenant.id !== tenantId` ownership check
        // below is authoritative, so a stray/foreign id can't leak another
        // tenant's billing. (Do NOT $disconnect the tenant client here — it is a
        // shared cached client; disconnecting it breaks concurrent requests.)
        let globalOutletId: number | undefined = outletId;
        if (outletId !== undefined && databaseName) {
            const tenantPrisma = getTenantPrisma(databaseName);
            const localOutlet = await tenantPrisma.outlet.findUnique({
                where: { id: outletId },
                select: { tenantOutletId: true },
            });
            if (localOutlet) {
                globalOutletId = localOutlet.tenantOutletId;
            }
            // else: no tenant-local outlet with this id → assume it's already a
            // global tenant_outlet.id (released-app id-space).
        }

        // Fetch outlet from global DB
        const outlet = await prisma.tenantOutlet.findUnique({
            where: { id: globalOutletId },
            include: {
                tenant: { select: { id: true } },
                subscriptions: {
                    where: { status: { in: ['active', 'trial'] } },
                    include: {
                        subscriptionPlan: { select: { planName: true, planType: true, price: true } },
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

        // Advanced Loyalty is bundled into Laundry Pro, so it is never billed as
        // an add-on for Laundry tenants — drop it from the breakdown entirely.
        const planType = subscription?.subscriptionPlan?.planType ?? null;
        const billableAddOns = tenantAddOns.filter(
            ta => !isLaundryBundledAddOn(ta.addOn.id, planType),
        );

        const totalAddOnCost = billableAddOns.reduce((sum, ta) => sum + ta.addOn.pricePerUnit * ta.quantity, 0);
        const response: OutletDetailsResponse = {
            outletId: outlet.id,
            outletName: outlet.outletName,
            isActive: outlet.isActive,
            serverTime: new Date().toISOString(),
            subscription: null,
            addOns: billableAddOns.map(ta => ({
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
    }
    // NOTE: do NOT $disconnect() here. `prisma` is the process-wide GLOBAL
    // singleton shared by EVERY module (auth, admin, billing, …). Disconnecting
    // it per-request tears down the shared connection pool and makes any auth
    // query that is in-flight at that moment throw — which getTenantSubscriptionInfo
    // used to swallow into a null plan, intermittently downgrading Pro tenants to
    // "Trial" with missing menus. The pool is owned for the process lifetime and
    // closed centrally via disconnectAllPrismaClients() on shutdown (src/index.ts).
}

export = { getAccountDetails }
