import { PrismaClient as TenantPrismaClient } from "../prisma/client/generated/client";
import { PrismaClient as GlobalPrismaClient } from "../prisma/global-client/generated/global";
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';

dotenv.config();

const execAsync = promisify(exec);

let globalPrismaInstance: GlobalPrismaClient | null = null;

interface TenantClientEntry {
  client: TenantPrismaClient;
  lastAccessed: number;
}

const tenantPrismaInstances = new Map<string, TenantClientEntry>();

// Idle eviction: prevents tenantPrismaInstances from growing unbounded as the
// tenant count grows. Each tenant client holds ~3 MySQL connections (Prisma pool
// default for 1 vCPU) and a few MB of RAM; without eviction, App Service RAM
// and MySQL max_connections both press well before infra needs upgrading.
// Cold-start cost on re-create is ~200-500ms — acceptable for a tenant that has
// been silent for 15 minutes.
const TENANT_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const TENANT_EVICTION_INTERVAL_MS = 5 * 60 * 1000;
let evictionInterval: NodeJS.Timeout | null = null;

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
  const existing = tenantPrismaInstances.get(tenantDbName);
  if (existing) {
    existing.lastAccessed = Date.now();
    return existing.client;
  }

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
  const client = versionExtension as TenantPrismaClient;
  tenantPrismaInstances.set(tenantDbName, { client, lastAccessed: Date.now() });
  return client;
}

export async function evictIdleTenantClients(
  idleMs: number = TENANT_IDLE_TIMEOUT_MS,
): Promise<number> {
  const now = Date.now();
  const evictedNames: string[] = [];
  for (const [name, entry] of tenantPrismaInstances) {
    if (now - entry.lastAccessed > idleMs) {
      try {
        await entry.client.$disconnect();
      } catch (err) {
        console.error(`Error disconnecting idle tenant ${name}:`, err);
      }
      tenantPrismaInstances.delete(name);
      evictedNames.push(name);
    }
  }
  if (evictedNames.length > 0) {
    console.log(`Evicted ${evictedNames.length} idle tenant client(s): ${evictedNames.join(', ')}`);
  }
  return evictedNames.length;
}

/**
 * Disconnect and forget a single tenant's cached Prisma client.
 *
 * For the daily tenant-walking crons: they touch every (or many) tenant DB
 * in one sweep, which would otherwise leave one cached client — and its ~3
 * pooled MySQL connections — per tenant simultaneously, pushing total
 * connections toward `max_connections` (171 on the B1ms) as the tenant count
 * grows. Releasing after each tenant bounds a cron to ~one tenant's worth of
 * connections at a time. Safe: `getTenantPrisma` transparently re-creates the
 * client on the next request (~200-500ms cold start). Deletes from the map
 * too — disconnecting without deleting would leave a dead client cached.
 */
export async function disconnectTenantClient(tenantDbName: string): Promise<void> {
  const entry = tenantPrismaInstances.get(tenantDbName);
  if (!entry) return;
  try {
    await entry.client.$disconnect();
  } catch (err) {
    console.error(`Error disconnecting tenant ${tenantDbName}:`, err);
  } finally {
    tenantPrismaInstances.delete(tenantDbName);
  }
}

export function startTenantClientEviction(): void {
  if (evictionInterval) return;
  evictionInterval = setInterval(() => {
    evictIdleTenantClients().catch((err) => console.error('Tenant eviction sweep failed:', err));
  }, TENANT_EVICTION_INTERVAL_MS);
  // unref so this timer never holds the process open on its own
  evictionInterval.unref();
  console.log(
    `Tenant client eviction started (idle threshold ${TENANT_IDLE_TIMEOUT_MS / 60000}min, sweep every ${TENANT_EVICTION_INTERVAL_MS / 60000}min)`,
  );
}

export function stopTenantClientEviction(): void {
  if (evictionInterval) {
    clearInterval(evictionInterval);
    evictionInterval = null;
  }
}

export function getTenantClientStats(): { activeTenants: number; tenants: string[] } {
  return {
    activeTenants: tenantPrismaInstances.size,
    tenants: Array.from(tenantPrismaInstances.keys()),
  };
}

export async function initializeTenantDatabase(tenantDbName: string) {
  const globalPrisma = getGlobalPrisma();
  const tenantUrl = process.env.TENANT_DATABASE_URL!.replace('{tenant_db_name}', tenantDbName);

  await globalPrisma.$executeRawUnsafe(`CREATE DATABASE IF NOT EXISTS \`${tenantDbName}\``);
  // Pass the URL via the child's env rather than a `VAR="x" cmd` shell prefix:
  // that prefix is POSIX-only syntax and `exec` spawns cmd.exe on Windows, where
  // it fails with "'TENANT_DATABASE_URL' is not recognized". The env-object form
  // works on every platform.
  await execAsync(`npx prisma migrate deploy --schema=prisma/client/schema.prisma`, { env: { ...process.env, TENANT_DATABASE_URL: tenantUrl } });
  console.log(`Created new tenant database: ${tenantDbName}`)
}

export async function disconnectAllPrismaClients(): Promise<void> {
  stopTenantClientEviction();
  if (globalPrismaInstance) {
    await globalPrismaInstance.$disconnect();
    globalPrismaInstance = null;
  }
  for (const [tenantDbName, entry] of tenantPrismaInstances) {
    await entry.client.$disconnect();
    tenantPrismaInstances.delete(tenantDbName);
  }
}

export async function updateAllTenantDatabases(): Promise<void> {
  const globalPrisma = getGlobalPrisma();
  const customers = await globalPrisma.tenant.findMany();

  const globalUrl = process.env.GLOBAL_DB_URL!;
  console.log(`Applying migrations to global database...`);
  try {
    // Env-object form, not a POSIX `VAR=x cmd` prefix — see initializeTenantDatabase.
    const command = `npx prisma migrate deploy --schema=prisma/global-client/schema.prisma`;
    await execAsync(command, { env: { ...process.env, TENANT_DATABASE_URL: globalUrl } });
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
      // Env-object form, not a POSIX `VAR=x cmd` prefix — see initializeTenantDatabase.
      const command = `npx prisma migrate deploy --schema=prisma/client/schema.prisma`;
      await execAsync(command, { env: { ...process.env, TENANT_DATABASE_URL: tenantUrl } });
      console.log(`Successfully updated ${customer.databaseName}`);
    } catch (error) {
      console.error(`Failed to update ${customer.databaseName}: ${(error as Error).message}`);
    }
  }
  console.log('All tenant databases updated.');
}