import { PrismaClient, Tenant, TenantUser, SubscriptionPlan } from "../../node_modules/.prisma/global-client";

export interface CreateTenantRequestBody {
    tenant: Tenant
}