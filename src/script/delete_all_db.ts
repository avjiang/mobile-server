import { PrismaClient as GlobalPrismaClient } from "@prisma/global-prisma";
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getGlobalPrisma } from '../db';

const execAsync = promisify(exec);

async function deleteAllDatabases(): Promise<void> {
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

    // Create a system Prisma client connected to the mysql system database
    const systemDbUrl = globalDbUrl.replace(`/${globalDbName}`, '/mysql');
    const systemPrisma = new GlobalPrismaClient({
        datasources: {
            db: {
                url: systemDbUrl
            }
        }
    });

    let globalPrisma: any = null;

    try {
        console.log(`Checking if global database ${globalDbName} exists...`);

        // Check if the global database exists
        const globalDbExists = await systemPrisma.$queryRawUnsafe(`
            SELECT SCHEMA_NAME 
            FROM INFORMATION_SCHEMA.SCHEMATA 
            WHERE SCHEMA_NAME = '${globalDbName}'
        `) as any[];

        let customers: any[] = [];

        if (globalDbExists.length > 0) {
            console.log(`Global database ${globalDbName} exists, retrieving tenant information...`);

            try {
                // Try to connect to global database and get tenant info
                globalPrisma = getGlobalPrisma();

                // Test the connection first
                await globalPrisma.$queryRaw`SELECT 1`;

                customers = await globalPrisma.tenant.findMany();
                console.log(`Found ${customers.length} tenant databases to delete`);

            } catch (connectionError) {
                console.warn(`Could not connect to global database: ${(connectionError as Error).message}`);
                console.log('Proceeding with global database deletion only...');
            } finally {
                if (globalPrisma) {
                    try {
                        await globalPrisma.$disconnect();
                    } catch (disconnectError) {
                        console.warn('Error disconnecting global Prisma client:', disconnectError);
                    }
                }
            }
        } else {
            console.log(`Global database ${globalDbName} does not exist, no databases to delete`);
        }

        // Delete all tenant databases using system connection
        for (const customer of customers) {
            if (!customer.databaseName) {
                console.warn(`Skipping tenant with ID ${customer.id}: database name is missing or null`);
                continue;
            }
            console.log(`Deleting database ${customer.databaseName}...`);
            try {
                await systemPrisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS \`${customer.databaseName}\``);
                console.log(`Successfully deleted database ${customer.databaseName}`);
            } catch (error) {
                console.error(`Failed to delete database ${customer.databaseName}: ${(error as Error).message}`);
            }
        }

        // Delete the global database if it exists
        if (globalDbExists.length > 0) {
            console.log(`Deleting global database ${globalDbName}...`);
            await systemPrisma.$executeRawUnsafe(`DROP DATABASE \`${globalDbName}\``);
            console.log(`Successfully deleted global database ${globalDbName}`);
        }

        console.log('Database deletion process completed.');

    } catch (error) {
        console.error(`Error during database deletion: ${(error as Error).message}`);
        throw error;
    } finally {
        // Ensure system connection is closed
        try {
            await systemPrisma.$disconnect();
        } catch (disconnectError) {
            console.warn('Error disconnecting system Prisma client:', disconnectError);
        }
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