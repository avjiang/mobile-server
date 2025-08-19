import { PrismaClient, Tenant, TenantUser, SubscriptionPlan } from "@prisma/global-prisma";

export interface CreateTenantRequest {
    tenant: {
        tenantName: string;
        plan: string;
    };
}