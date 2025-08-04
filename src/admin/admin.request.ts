import { PrismaClient, Tenant, TenantUser, SubscriptionPlan } from "../../prisma/global-client";

export interface CreateTenantRequest {
    tenant: {
        tenantName: string;
        plan: string;
    };
}