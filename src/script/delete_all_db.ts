import { PrismaClient as TenantPrismaClient } from '@prisma/client';
import { PrismaClient as GlobalPrismaClient } from ".prisma/global-client";
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getGlobalPrisma } from '../db';

const execAsync = promisify(exec);

async function deleteAllDatabases(): Promise<void> {
    const globalPrisma = getGlobalPrisma();

    try {
        const customers = await globalPrisma.tenant.findMany();

        // Delete all tenant databases
        for (const customer of customers) {
            if (!customer.databaseName) {
                console.warn(`Skipping tenant with ID ${customer.id}: database name is missing or null`);
                continue;
            }
            console.log(`Deleting database ${customer.databaseName}...`);
            try {
                // Use Prisma's raw query instead of shell command
                await globalPrisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS \`${customer.databaseName}\``);
                console.log(`Successfully deleted database ${customer.databaseName}`);
            } catch (error) {
                console.error(`Failed to delete database ${customer.databaseName}: ${(error as Error).message}`);
            }
        }

        // Close the global Prisma connection before deleting the global database
        await globalPrisma.$disconnect();

        // Delete the global database
        const globalDbUrl = process.env.GLOBAL_DB_URL;
        if (!globalDbUrl) {
            throw new Error('GLOBAL_DB_URL environment variable is not set');
        }

        // Extract database name from the connection URL
        const dbNameMatch = globalDbUrl.match(/\/([^/?]+)(?:\?|$)/);
        if (!dbNameMatch) {
            throw new Error('Could not extract database name from GLOBAL_DB_URL');
        }
        const globalDbName = dbNameMatch[1];

        console.log(`Deleting global database ${globalDbName}...`);

        await globalPrisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS \`${globalDbName}\``);
        console.log(`Successfully deleted global database ${globalDbName}`);
        console.log('All databases deleted successfully.');
        globalPrisma.$disconnect();
    } catch (error) {
        console.error(`Error during database deletion: ${(error as Error).message}`);
        throw error;
    }
}

async function main(): Promise<void> {
    try {
        // Seed 200 items
        await deleteAllDatabases();
    } catch (error) {
        console.error("Error during seeding:", error);
        process.exit(1);
    }
}

// Execute the seeding
main()
    .catch((error) => {
        console.error("Database purging failed:", error);
        process.exit(1);
    });