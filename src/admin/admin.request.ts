import { PrismaClient, Tenant, TenantUser, SubscriptionPlan } from "../../node_modules/.prisma/global-client";

export interface CreateTenantRequest {
    tenant: {
        tenantName: string;
        plan: string;
    };
}