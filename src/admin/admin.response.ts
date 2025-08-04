import { Expose, Transform } from "class-transformer";
import { PrismaClient, Tenant, TenantUser, SubscriptionPlan, TenantSubscription } from "../../prisma/global-client";

type TenantUserWithoutPassword = Omit<TenantUser, 'password'>;

export class TenantDto {
    @Expose()
    id = 0;

    @Expose()
    tenantName = String();

    @Expose()
    databaseName = String();

    @Expose()
    createdAt: Date = new Date();
}

export class GetAllTenantDto { }

export class TenantCreationDto {
    tenant: TenantDto;
    tenantUser: TenantUserWithoutPassword;

    @Expose()
    @Transform(({ obj }) => ({ planName: obj.subscriptionPlan.planName }))
    subscription: { planName: string };

    constructor(tenant: TenantDto, tenantUser: TenantUserWithoutPassword, subscription: TenantSubscription & { subscriptionPlan: SubscriptionPlan }) {
        this.tenant = tenant;
        this.tenantUser = tenantUser;
        this.subscription = { planName: subscription.subscriptionPlan.planName };
    }
}

export interface TenantCostResponse {
    tenantId: number;
    tenantName: string;
    outletCount: number;
    outlets: Array<{
        outletId: number;
        outletName: string;
        subscription: {
            planName: string;
            basePlanCost: number;
            addOns: Array<{
                name: string;
                quantity: number;
                pricePerUnit: number;
                totalCost: number;
            }>;
            discounts: Array<{
                name: string;
                type: string;
                value: number;
                amount: number;
            }>;
            totalCost: number;
            totalCostBeforeDiscount: number;
            totalDiscount: number;
            status: string;
            subscriptionValidUntil: string;
        } | null;
    }>;
    totalMonthlyCost: number;
    totalCostBeforeDiscount: number;
    totalDiscount: number;
}

export interface TotalCostResponse {
    totalRevenue: number;
    totalRevenueBeforeDiscount: number;
    totalDiscount: number;
    tenants: Array<{
        tenantId: number;
        tenantName: string;
        totalMonthlyCost: number;
        totalCostBeforeDiscount: number;
        totalDiscount: number;
    }>;
}
