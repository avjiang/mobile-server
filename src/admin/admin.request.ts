import { PrismaClient, Tenant, TenantUser, SubscriptionPlan } from "../../prisma/global-client/generated/global";

export interface CreateTenantRequest {
    tenant: {
        tenantName: string;
        plan: string;
        // REQUIRED — the business vertical ("Retail" | "Laundry", matched against
        // subscription_plan.PLAN_TYPE). It used to default to "Retail", so a laundry
        // signup that forgot it silently became a retail tenant.
        planType: string;
        // Optional initial password. Omitted (the /admin/signup case) → a random
        // temporary password is generated and returned ONCE as
        // `temporaryPassword` for the operator to hand to the owner. Internal
        // scripts (test tenants, demo seeder) pass the username here on purpose:
        // debug auto-login and "Coba Demo" rely on password == username.
        password?: string;
    };
}


