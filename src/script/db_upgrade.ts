import dotenv from "dotenv";

dotenv.config();

type Target = "local" | "prod";

const target: Target = (process.argv[2] as Target) || "local";

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

// Load db.ts AFTER env override so getGlobalPrisma() resolves to the chosen target.
const { updateAllTenantDatabases, disconnectAllPrismaClients } = require("../db") as typeof import("../db");

async function runSchemaUpdates() {
    try {
        console.log('Starting database schema updates...');
        await updateAllTenantDatabases();
        console.log('Schema updates completed successfully.');
    } catch (error) {
        console.error('Error updating tenant schemas:', error);
        process.exit(1);
    } finally {
        await disconnectAllPrismaClients();
    }
}

if (require.main === module) {
    runSchemaUpdates();
}

export default runSchemaUpdates;
