import { PrismaClient as TenantPrismaClient } from '@prisma/client';
import { PrismaClient as GlobalPrismaClient } from "../node_modules/.prisma/global-client";
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';

dotenv.config();

const execAsync = promisify(exec);

let globalPrismaInstance: GlobalPrismaClient | null = null;

export function getGlobalPrisma(): GlobalPrismaClient {
  if (!globalPrismaInstance) {
    globalPrismaInstance = new GlobalPrismaClient({
      datasources: { db: { url: process.env.GLOBAL_DB_URL } },
    });
  }
  return globalPrismaInstance;
}

export function getTenantPrisma(tenantDbName: string): TenantPrismaClient {
  const tenantUrl = process.env.TENANT_DB_URL_TEMPLATE!.replace('{tenant_db_name}', tenantDbName);
  return new TenantPrismaClient({
    datasources: { db: { url: tenantUrl } },
  });
}

export async function initializeTenantDatabase(tenantDbName: string): Promise<TenantPrismaClient> {
  const globalPrisma = getGlobalPrisma();
  const tenantUrl = process.env.TENANT_DB_URL_TEMPLATE!.replace('{tenant_db_name}', tenantDbName);

  await globalPrisma.$executeRawUnsafe(`CREATE DATABASE IF NOT EXISTS \`${tenantDbName}\``);
  await execAsync(`npx prisma migrate deploy --schema prisma/tenant_schema.prisma --url ${tenantUrl}`);

  const tenantPrisma = getTenantPrisma(tenantDbName);
  // await tenantPrisma.role.createMany({
  //   data: [{ name: 'cashier' }, { name: 'manager' }],
  //   skipDuplicates: true,
  // });
  // await tenantPrisma.permission.createMany({
  //   data: [{ name: 'create_sale' }, { name: 'update_inventory' }],
  //   skipDuplicates: true,
  // });
  // const cashierRole = await tenantPrisma.role.findUnique({ where: { name: 'cashier' } });
  // const managerRole = await tenantPrisma.role.findUnique({ where: { name: 'manager' } });
  // const createSalePerm = await tenantPrisma.permission.findUnique({ where: { name: 'create_sale' } });
  // const updateInvPerm = await tenantPrisma.permission.findUnique({ where: { name: 'update_inventory' } });
  // await tenantPrisma.rolePermission.createMany({
  //   data: [
  //     { roleId: cashierRole!.id, permissionId: createSalePerm!.id },
  //     { roleId: managerRole!.id, permissionId: createSalePerm!.id },
  //     { roleId: managerRole!.id, permissionId: updateInvPerm!.id },
  //   ],
  //   skipDuplicates: true,
  // });

  return tenantPrisma;
}

export async function updateAllTenantDatabases(): Promise<void> {
  const globalPrisma = getGlobalPrisma();
  const customers = await globalPrisma.tenant.findMany();

  for (const customer of customers) {
    const tenantUrl = process.env.TENANT_DB_URL_TEMPLATE!.replace('{tenant_db_name}', customer.databaseName);
    console.log(`Applying migrations to ${customer.databaseName}...`);
    try {
      await execAsync(`npx prisma migrate deploy --schema prisma/tenant_schema.prisma --url ${tenantUrl}`);
      console.log(`Successfully updated ${customer.databaseName}`);
    } catch (error) {
      console.error(`Failed to update ${customer.databaseName}: ${(error as Error).message}`);
    }
  }
  console.log('All tenant databases updated.');
}