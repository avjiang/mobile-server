import { PrismaClient as TenantPrismaClient } from "../../prisma/client/generated/client";
import { PrismaClient as GlobalPrismaClient } from "../../prisma/global-client/generated/global";
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';

dotenv.config();

const execAsync = promisify(exec);

// =====================================================
// CONFIGURE YOUR TEST DATABASE HERE
// =====================================================
const TEST_DB_NAME = "test_db_db"; // <-- Replace with your specific Azure DB name

// For Azure, replace these with your Azure connection details
const AZURE_CONFIG = {
    host: "bayaryuk-server.mysql.database.azure.com",
    port: 3306,
    user: "azvvyqzsum",
    password: "XKZv48RW4jWRvf-",
};

// Build the connection URL for the specific test database
function buildTestDbUrl(): string {
    return `mysql://${AZURE_CONFIG.user}:${AZURE_CONFIG.password}@${AZURE_CONFIG.host}:${AZURE_CONFIG.port}/${TEST_DB_NAME}?sslaccept=strict`;
}

// Build the connection URL for global database on Azure
function buildGlobalDbUrl(): string {
    return `mysql://${AZURE_CONFIG.user}:${AZURE_CONFIG.password}@${AZURE_CONFIG.host}:${AZURE_CONFIG.port}/global?sslaccept=strict`;
}
// =====================================================

async function testConnection() {
    const testUrl = buildTestDbUrl();
    console.log(`Testing connection to: ${TEST_DB_NAME}`);
    console.log(`URL (masked): mysql://${AZURE_CONFIG.user}:****@${AZURE_CONFIG.host}:${AZURE_CONFIG.port}/${TEST_DB_NAME}`);

    const prisma = new TenantPrismaClient({
        datasources: { db: { url: testUrl } },
    });

    try {
        await prisma.$connect();
        console.log('✅ Connection successful!');

        // Test a simple query
        const result = await prisma.$queryRaw`SELECT 1 as test`;
        console.log('✅ Query test passed:', result);

    } catch (error) {
        console.error('❌ Connection failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

async function runMigrationOnTestDb() {
    const testUrl = buildTestDbUrl();
    console.log(`\nRunning migration on: ${TEST_DB_NAME}`);
    console.log(`URL (masked): mysql://${AZURE_CONFIG.user}:****@${AZURE_CONFIG.host}:${AZURE_CONFIG.port}/${TEST_DB_NAME}`);

    try {
        const command = `TENANT_DATABASE_URL="${testUrl}" npx prisma migrate deploy --schema=prisma/client/schema.prisma`;
        console.log('Executing migration...');
        const { stdout, stderr } = await execAsync(command);

        if (stdout) console.log('stdout:', stdout);
        if (stderr) console.log('stderr:', stderr);

        console.log(`✅ Successfully migrated ${TEST_DB_NAME}`);
    } catch (error) {
        console.error(`❌ Failed to migrate ${TEST_DB_NAME}:`, (error as Error).message);
    }
}

async function runGlobalMigration() {
    const globalUrl = buildGlobalDbUrl();
    console.log(`\nRunning migration on global database`);

    try {
        const command = `TENANT_DATABASE_URL="${globalUrl}" npx prisma migrate deploy --schema=prisma/global-client/schema.prisma`;
        console.log('Executing global migration...');
        const { stdout, stderr } = await execAsync(command);

        if (stdout) console.log('stdout:', stdout);
        if (stderr) console.log('stderr:', stderr);

        console.log(`✅ Successfully migrated global database`);
    } catch (error) {
        console.error(`❌ Failed to migrate global database:`, (error as Error).message);
    }
}

// Main execution
async function main() {
    console.log('========================================');
    console.log('  DB UPGRADE TEST SCRIPT');
    console.log('========================================\n');

    const args = process.argv.slice(2);
    const command = args[0] || 'test';

    switch (command) {
        case 'test':
            console.log('Mode: Connection Test Only');
            await testConnection();
            break;
        case 'migrate':
            console.log('Mode: Run Migration on Test DB');
            await runMigrationOnTestDb();
            break;
        case 'migrate-global':
            console.log('Mode: Run Migration on Global DB');
            await runGlobalMigration();
            break;
        case 'all':
            console.log('Mode: Full Test (Connection + Migration)');
            await testConnection();
            await runMigrationOnTestDb();
            break;
        default:
            console.log('Usage: npx ts-node src/script/db_upgrade_test.ts [command]');
            console.log('Commands:');
            console.log('  test           - Test connection only (default)');
            console.log('  migrate        - Run migration on test database');
            console.log('  migrate-global - Run migration on global database');
            console.log('  all            - Test connection and run migration');
    }
}

main().catch(console.error);
