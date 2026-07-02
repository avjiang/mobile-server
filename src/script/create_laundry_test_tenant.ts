/**
 * One-off: create a Laundry-type test tenant (default: aceh_wash_test, Pro plan).
 *
 *   node dist/script/create_laundry_test_tenant.js prod [tenantName]
 *
 * Ensures the three Laundry subscription plans exist first (insert-only —
 * never updates existing plans, so live Retail prices are untouched),
 * then runs the same createTenant flow as POST /admin/signup.
 */
import dotenv from "dotenv";

dotenv.config();

type Target = "local" | "prod";

const target: Target = (process.argv[2] as Target) || "local";
const tenantName = process.argv[3] || "aceh_wash_test";

if (target === "prod") {
    if (!process.env.PROD_GLOBAL_DB_URL || !process.env.PROD_TENANT_DATABASE_URL) {
        console.error("Missing PROD_GLOBAL_DB_URL or PROD_TENANT_DATABASE_URL in .env");
        process.exit(1);
    }
    process.env.GLOBAL_DB_URL = process.env.PROD_GLOBAL_DB_URL;
    process.env.TENANT_DATABASE_URL = process.env.PROD_TENANT_DATABASE_URL;
    console.log("Target: PROD");
} else if (target === "local") {
    console.log("Target: LOCAL");
} else {
    console.error(`Unknown target "${target}". Use "local" or "prod".`);
    process.exit(1);
}

// Load AFTER env override so Prisma clients resolve to the chosen target.
const { getGlobalPrisma, disconnectAllPrismaClients } = require("../db") as typeof import("../db");
const adminService = require("../admin/admin.service");

const laundryPlans = [
    { planName: "Trial", planType: "Laundry", price: 0, maxUsers: 2, maxDevices: 0, description: null },
    { planName: "Basic", planType: "Laundry", price: 300000, maxUsers: 2, maxDevices: 0, description: "Basic plan for laundry businesses" },
    { planName: "Pro", planType: "Laundry", price: 450000, maxUsers: 3, maxDevices: 3, description: "Pro plan for laundry businesses with push notification support" },
];

async function run() {
    const prisma = getGlobalPrisma();
    try {
        // Insert-only seed of Laundry plans (skip any that already exist).
        for (const plan of laundryPlans) {
            const existing = await prisma.subscriptionPlan.findFirst({
                where: { planName: plan.planName, planType: plan.planType },
            });
            if (existing) {
                console.log(`  = ${plan.planName} (Laundry) already exists (ID ${existing.id})`);
            } else {
                const created = await prisma.subscriptionPlan.create({ data: plan });
                console.log(`  + ${plan.planName} (Laundry) created (ID ${created.id})`);
            }
        }

        const duplicate = await prisma.tenant.findFirst({ where: { tenantName } });
        if (duplicate) {
            throw new Error(`Tenant "${tenantName}" already exists (ID ${duplicate.id}) — aborting.`);
        }

        console.log(`Creating tenant "${tenantName}" (Laundry / Pro)...`);
        const result = await adminService.createTenant({
            tenant: { tenantName, plan: "Pro", planType: "Laundry" },
        });
        console.log("Tenant created:");
        console.log(JSON.stringify(result, null, 2));
    } finally {
        await disconnectAllPrismaClients();
    }
}

if (require.main === module) {
    run().catch((error) => {
        console.error("Failed:", error);
        process.exit(1);
    });
}
