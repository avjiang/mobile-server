import { Expose, Transform } from "class-transformer";
import { PrismaClient, Tenant, TenantUser, SubscriptionPlan } from "../../node_modules/.prisma/global-client";

export class TenantDto {
    @Expose()
    id = 0;

    @Expose()
    tenantName = String();

    @Expose()
    databaseName = String();

    @Expose()
    @Transform(({ obj }) => obj.plan?.planName || '')
    planName: string = '';

    @Expose()
    createdAt: Date = new Date();
}

export class TenantCreationDto {
    tenant: TenantDto;
    tenantUser: TenantUser;

    constructor(tenant: TenantDto, tenantUser: TenantUser) {
        this.tenant = tenant;
        this.tenantUser = tenantUser;
    }
}