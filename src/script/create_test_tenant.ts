/**
 * Generic test-tenant creator. Runs the same flow as POST /admin/signup.
 *
 *   node dist/script/create_test_tenant.js <local|prod> <tenantName> <plan> <planType>
 *
 * Examples:
 *   node dist/script/create_test_tenant.js local basic_retail  Basic Retail
 *   node dist/script/create_test_tenant.js local basic_laundry Basic Laundry
 *
 * Login = username = tenantName lowercased with spaces→"_"; password = username.
 * Assumes the target plan (planName + planType) already exists in the global DB
 * (it does for Basic/Pro Retail & Laundry on local). Unlike
 * create_laundry_test_tenant.ts this does NOT seed plans.
 */
import dotenv from "dotenv";

dotenv.config();

type Target = "local" | "prod";

const target: Target = (process.argv[2] as Target) || "local";
const tenantName = process.argv[3];
const plan = process.argv[4] || "Basic";
const planType = process.argv[5] || "Retail";

if (!tenantName) {
    console.error('Missing tenantName. Usage: create_test_tenant.js <local|prod> <tenantName> <plan> <planType>');
    process.exit(1);
}

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

async function run() {
    const prisma = getGlobalPrisma();
    try {
        const existingPlan = await prisma.subscriptionPlan.findFirst({
            where: { planName: plan, planType },
        });
        if (!existingPlan) {
            throw new Error(`Plan "${plan}" (${planType}) not found in global DB — seed it first.`);
        }

        const duplicate = await prisma.tenant.findFirst({ where: { tenantName } });
        if (duplicate) {
            throw new Error(`Tenant "${tenantName}" already exists (ID ${duplicate.id}) — aborting.`);
        }

        console.log(`Creating tenant "${tenantName}" (${planType} / ${plan})...`);
        const result = await adminService.createTenant({
            tenant: { tenantName, plan, planType },
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
