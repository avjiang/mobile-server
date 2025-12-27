import mysql from 'mysql';
import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);

function parseDbUrl(url: string): { host: string; port: number; user: string; password: string; database: string } {
    // Parse: mysql://user:password@host:port/database
    const regex = /mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
    const match = url.match(regex);
    if (!match) {
        throw new Error(`Invalid database URL format: ${url}`);
    }
    return {
        user: match[1],
        password: match[2],
        host: match[3],
        port: parseInt(match[4], 10),
        database: match[5]
    };
}

async function createDatabaseIfNotExists(config: { host: string; port: number; user: string; password: string; database: string }): Promise<void> {
    return new Promise((resolve, reject) => {
        const connection = mysql.createConnection({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password
        });

        connection.connect((err) => {
            if (err) {
                reject(new Error(`Failed to connect to MySQL: ${err.message}`));
                return;
            }

            connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\``, (err) => {
                connection.end();
                if (err) {
                    reject(new Error(`Failed to create database: ${err.message}`));
                    return;
                }
                resolve();
            });
        });
    });
}

async function runCommand(command: string, description: string): Promise<void> {
    console.log(`\n${description}...`);
    try {
        const { stdout, stderr } = await execAsync(command);
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
        console.log(`Done.`);
    } catch (error) {
        throw new Error(`Failed: ${(error as Error).message}`);
    }
}

async function setup(): Promise<void> {
    console.log('========================================');
    console.log('   Developer Setup Script');
    console.log('========================================\n');

    // Validate environment variables
    const globalDbUrl = process.env.GLOBAL_DB_URL;
    if (!globalDbUrl) {
        throw new Error('GLOBAL_DB_URL environment variable is not set. Please configure your .env file.');
    }

    // Step 1: Create global database if not exists
    console.log('Step 1: Creating global database if not exists...');
    const dbConfig = parseDbUrl(globalDbUrl.replace(/"/g, '').trim());
    await createDatabaseIfNotExists(dbConfig);
    console.log(`Database "${dbConfig.database}" is ready.`);

    // Step 2: Generate Prisma clients
    await runCommand(
        'npx prisma generate --schema=prisma/client/schema.prisma',
        'Step 2a: Generating Prisma client (tenant schema)'
    );

    await runCommand(
        'npx prisma generate --schema=prisma/global-client/schema.prisma',
        'Step 2b: Generating Prisma client (global schema)'
    );

    // Step 3: Run migrations for global database
    await runCommand(
        `TENANT_DATABASE_URL="${globalDbUrl}" npx prisma migrate deploy --schema=prisma/global-client/schema.prisma`,
        'Step 3: Running migrations for global database'
    );

    // Step 4: Seed setting definitions
    console.log('\nStep 4: Seeding setting definitions...');
    const { seedSettingDefinitions } = await import('./setting_definitions_seed');
    await seedSettingDefinitions();

    // Step 5: Seed permissions
    console.log('\nStep 5: Seeding permissions...');
    const { seedPermissions } = await import('./permission_seed');
    await seedPermissions();

    // Step 6: Seed subscription plans
    console.log('\nStep 6: Seeding subscription plans...');
    const { seedSubscriptionPlans } = await import('./subscription_plan_seed');
    await seedSubscriptionPlans();

    // Step 7: Seed subscription add-ons
    console.log('\nStep 7: Seeding subscription add-ons...');
    const { seedSubscriptionAddOns } = await import('./subscription_add_on_seed');
    await seedSubscriptionAddOns();

    // Cleanup
    const { disconnectAllPrismaClients } = await import('../db');
    await disconnectAllPrismaClients();

    console.log('\n========================================');
    console.log('   Setup completed successfully!');
    console.log('========================================');
    console.log('\nYou can now run: npm run dev');
}

setup()
    .catch((error) => {
        console.error('\nSetup failed:', error.message);
        process.exit(1);
    });
