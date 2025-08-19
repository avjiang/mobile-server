import { PrismaClient, Tenant, TenantUser, SubscriptionPlan } from "../../prisma/global-client/generated/global";

export interface CreateTenantRequest {
    tenant: {
        tenantName: string;
        plan: string;
    };
}