import { PrismaClient as TenantPrismaClient } from "../prisma/client";
import { PrismaClient as GlobalPrismaClient } from "../prisma/global-client";
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';

dotenv.config();

const execAsync = promisify(exec);

let globalPrismaInstance: GlobalPrismaClient | null = null;
const tenantPrismaInstances = new Map<string, TenantPrismaClient>();

export function getGlobalPrisma(): GlobalPrismaClient {
  if (!process.env.GLOBAL_DB_URL) {
    throw new Error('GLOBAL_DB_URL environment variable is not set');
  }
  if (!globalPrismaInstance) {
    globalPrismaInstance = new GlobalPrismaClient({
      datasources: { db: { url: process.env.GLOBAL_DB_URL } },
    });
  }
  return globalPrismaInstance;
}

export function getTenantPrisma(tenantDbName: string): TenantPrismaClient {
  if (!tenantPrismaInstances.has(tenantDbName)) {
    const tenantUrl = process.env.TENANT_DATABASE_URL!.replace('{tenant_db_name}', tenantDbName);
    const tenantPrisma = new TenantPrismaClient({
      datasources: { db: { url: tenantUrl } },
    });
    // Create extension to increment version on updates
    const versionExtension = tenantPrisma.$extends({
      query: {
        $allModels: {
          async update({ args, query }) {
            // Only increment version if the model has a version field
            if (args.data && typeof args.data === 'object' && 'version' in args.data) {
              args.data.version = { increment: 1 };
            }
            return query(args);
          },
          async updateMany({ args, query }) {
            // Only increment version if the model has a version field
            if (args.data && typeof args.data === 'object' && 'version' in args.data) {
              args.data.version = { increment: 1 };
            }
            return query(args);
          },
        },
      },
    });
    versionExtension.$connect().catch((error) => {
      console.error(`Failed to connect to tenant database ${tenantDbName}:`, error);
      throw error;
    });
    tenantPrismaInstances.set(tenantDbName, versionExtension as TenantPrismaClient);
  }
  return tenantPrismaInstances.get(tenantDbName)!;
}

export async function initializeTenantDatabase(tenantDbName: string) {
  const globalPrisma = getGlobalPrisma();
  const tenantUrl = process.env.TENANT_DATABASE_URL!.replace('{tenant_db_name}', tenantDbName);

  await globalPrisma.$executeRawUnsafe(`CREATE DATABASE IF NOT EXISTS \`${tenantDbName}\``);
  await execAsync(`TENANT_DATABASE_URL="${tenantUrl}" npx prisma migrate deploy --schema=prisma/client/schema.prisma`);
  console.log(`Created new tenant database: ${tenantDbName}`)
}

export async function disconnectAllPrismaClients(): Promise<void> {
  if (globalPrismaInstance) {
    await globalPrismaInstance.$disconnect();
    globalPrismaInstance = null;
  }
  for (const [tenantDbName, client] of tenantPrismaInstances) {
    await client.$disconnect();
    tenantPrismaInstances.delete(tenantDbName);
  }
}

export async function updateAllTenantDatabases(): Promise<void> {
  const globalPrisma = getGlobalPrisma();
  const customers = await globalPrisma.tenant.findMany();

  const globalUrl = process.env.GLOBAL_DB_URL!;
  console.log(`Applying migrations to global database...`);
  try {
    const command = `TENANT_DATABASE_URL=${globalUrl} npx prisma migrate deploy --schema=prisma/global-client/schema.prisma`;
    await execAsync(command);
    console.log(`Successfully updated global database`);
  } catch (error) {
    console.error(`Failed to update global database: ${(error as Error).message}`);
  }

  for (const customer of customers) {
    if (!customer.databaseName) {
      console.warn(`Skipping tenant with ID ${customer.id}: database name is missing or null`);
      continue;
    }
    const tenantUrl = process.env.TENANT_DATABASE_URL!.replace('{tenant_db_name}', customer.databaseName);
    console.log(`Applying migrations to ${customer.databaseName}...`);
    try {
      const command = `TENANT_DATABASE_URL=${tenantUrl} npx prisma migrate deploy --schema=prisma/client/schema.prisma`;
      await execAsync(command);
      console.log(`Successfully updated ${customer.databaseName}`);
    } catch (error) {
      console.error(`Failed to update ${customer.databaseName}: ${(error as Error).message}`);
    }
  }
  console.log('All tenant databases updated.');
}