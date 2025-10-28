import { Expose, Transform } from "class-transformer";
import { PrismaClient, Tenant, TenantUser, SubscriptionPlan, TenantSubscription } from "../../prisma/global-client/generated/global";

type TenantUserWithoutPassword = Omit<TenantUser, 'password'>;

// Response type with renamed keys
type TenantUserResponse = Omit<TenantUser, 'password' | 'tenantId'> & {
    globalTenantId: number;
};

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
    @Expose()
    @Transform(({ obj }) => ({ planName: obj.subscriptionPlan.planName }))
    subscription: { planName: string };

    tenant: TenantDto;
    tenantUser: TenantUserResponse;

    warehouse?: {
        id: number;
        warehouseName: string;
        warehouseCode: string;
        globalWarehouseId: number;
    };

    constructor(
        tenant: TenantDto,
        tenantUser: TenantUserWithoutPassword,
        subscription: TenantSubscription & { subscriptionPlan: SubscriptionPlan },
        warehouse?: {
            id: number;
            warehouseName: string;
            warehouseCode: string;
            tenantWarehouseId: number;
        }
    ) {
        this.subscription = { planName: subscription.subscriptionPlan.planName };
        this.tenant = tenant;

        // Transform tenantId to globalTenantId
        const { tenantId, ...userWithoutTenantId } = tenantUser;
        this.tenantUser = {
            ...userWithoutTenantId,
            globalTenantId: tenantId,
        };

        // Transform tenantWarehouseId to globalWarehouseId
        if (warehouse) {
            this.warehouse = {
                id: warehouse.id,
                warehouseName: warehouse.warehouseName,
                warehouseCode: warehouse.warehouseCode,
                globalWarehouseId: warehouse.tenantWarehouseId,
            };
        }
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
