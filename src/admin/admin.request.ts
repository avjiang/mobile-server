import { PrismaClient, Tenant, TenantUser, SubscriptionPlan } from "../../prisma/global-client/generated/global";

export interface CreateTenantRequest {
    tenant: {
        tenantName: string;
        plan: string;
        planType?: string; // "Retail" | "F&B" | "Laundry" — defaults to "Retail"
    };
}


