import { PrismaClient as TenantPrismaClient } from '@prisma/client';
import { PrismaClient as GlobalPrismaClient } from "../node_modules/.prisma/global-client";
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';

dotenv.config();

const execAsync = promisify(exec);

let globalPrismaInstance: GlobalPrismaClient | null = null;
const tenantPrismaInstances = new Map<string, TenantPrismaClient>();

export function getGlobalPrisma(): GlobalPrismaClient {
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
    tenantPrismaInstances.set(tenantDbName, tenantPrisma);
  }
  return tenantPrismaInstances.get(tenantDbName)!;
}

export async function initializeTenantDatabase(tenantDbName: string) {
  const globalPrisma = getGlobalPrisma();
  const tenantUrl = process.env.TENANT_DATABASE_URL!.replace('{tenant_db_name}', tenantDbName);

  await globalPrisma.$executeRawUnsafe(`CREATE DATABASE IF NOT EXISTS \`${tenantDbName}\``);
  await execAsync(`TENANT_DATABASE_URL="${tenantUrl}" npx prisma db push --schema prisma/schema.prisma`);
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
//   const globalPrisma = getGlobalPrisma();
//   const customers = await globalPrisma.customer.findMany();

//   for (const customer of customers) {
//     const tenantUrl = process.env.TENANT_DB_URL_TEMPLATE!.replace('{tenant_db_name}', customer.databaseName);
//     console.log(`Applying migrations to ${customer.databaseName}...`);
//     try {
//       const command = `TENANT_DB_URL=${tenantUrl} npx prisma migrate deploy --schema prisma/tenant_schema.prisma`;
//       await execAsync(command);
//       console.log(`Successfully updated ${customer.databaseName}`);
//     } catch (error) {
//       console.error(`Failed to update ${customer.databaseName}: ${(error as Error).message}`);
//     }
//   }
//   console.log('All tenant databases updated.');
}