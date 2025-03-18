import { Expose, Transform } from "class-transformer";
import { PrismaClient, Tenant, TenantUser, SubscriptionPlan, TenantSubscription } from "../../node_modules/.prisma/global-client";

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

export class GetAllTenantDto {

}

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