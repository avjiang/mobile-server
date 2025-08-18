import { prisma } from "@globalPrisma";
import { updateAllTenantDatabases, disconnectAllPrismaClients, prismaMigrateResolve } from "../db";

async function runSchemaMigrateResolve() {
    try {
        console.log('Starting tenant database migrate resolve...');
        await prismaMigrateResolve();
        console.log('Migrate resolve completed successfully.');
    } catch (error) {
        console.error('Error during tenant database migrate resolve:', error);
        process.exit(1);
    } finally {
        // Make sure to disconnect all Prisma clients to prevent hanging
        await disconnectAllPrismaClients();
    }
}

// Run the function if this script is executed directly
if (require.main === module) {
    runSchemaMigrateResolve();
}

// Also export the function so it can be imported elsewhere if needed
export default runSchemaMigrateResolve;