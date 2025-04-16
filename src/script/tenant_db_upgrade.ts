import { updateAllTenantDatabases, disconnectAllPrismaClients } from "../db";

async function runSchemaUpdates() {
    try {
        console.log('Starting tenant database schema updates...');
        await updateAllTenantDatabases();
        console.log('Schema updates completed successfully.');
    } catch (error) {
        console.error('Error updating tenant schemas:', error);
        process.exit(1);
    } finally {
        // Make sure to disconnect all Prisma clients to prevent hanging
        await disconnectAllPrismaClients();
    }
}

// Run the function if this script is executed directly
if (require.main === module) {
    runSchemaUpdates();
}

// Also export the function so it can be imported elsewhere if needed
export default runSchemaUpdates;