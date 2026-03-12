/**
 * Data Migration: TenantSubscriptionAddOn → TenantAddOn
 *
 * Migrates existing per-outlet-subscription add-on records to the new
 * tenant-scoped TenantAddOn table.
 *
 * - Groups by tenantId + addOnId and SUMs quantities
 * - Does NOT delete old TenantSubscriptionAddOn records (table kept for future)
 *
 * Run: npx ts-node src/script/migrate_addon_to_tenant.ts
 */
import { getGlobalPrisma, disconnectAllPrismaClients } from '../db';

async function migrateAddOnsToTenant(): Promise<void> {
    const prisma = getGlobalPrisma();

    console.log('Starting add-on migration: TenantSubscriptionAddOn → TenantAddOn...');

    // 1. Query all TenantSubscriptionAddOn records with their TenantSubscription (to get tenantId)
    const oldRecords = await prisma.tenantSubscriptionAddOn.findMany({
        include: {
            tenantSubscription: {
                select: { tenantId: true }
            },
            addOn: {
                select: { id: true, name: true }
            }
        }
    });

    console.log(`Found ${oldRecords.length} TenantSubscriptionAddOn records to migrate.`);

    if (oldRecords.length === 0) {
        console.log('No records to migrate. Done.');
        return;
    }

    // 2. Group by tenantId + addOnId and SUM quantities
    const grouped = new Map<string, { tenantId: number; addOnId: number; quantity: number; addOnName: string }>();

    for (const record of oldRecords) {
        const key = `${record.tenantSubscription.tenantId}-${record.addOnId}`;
        const existing = grouped.get(key);
        if (existing) {
            existing.quantity += record.quantity;
        } else {
            grouped.set(key, {
                tenantId: record.tenantSubscription.tenantId,
                addOnId: record.addOnId,
                quantity: record.quantity,
                addOnName: record.addOn.name
            });
        }
    }

    console.log(`Grouped into ${grouped.size} unique tenant+addOn combinations.`);

    // 3. Upsert into TenantAddOn
    let migrated = 0;
    for (const [_key, data] of grouped) {
        await prisma.tenantAddOn.upsert({
            where: {
                tenantId_addOnId: {
                    tenantId: data.tenantId,
                    addOnId: data.addOnId
                }
            },
            update: {
                quantity: data.quantity
            },
            create: {
                tenantId: data.tenantId,
                addOnId: data.addOnId,
                quantity: data.quantity
            }
        });
        console.log(`  ✓ Tenant ${data.tenantId}: ${data.addOnName} x${data.quantity}`);
        migrated++;
    }

    console.log(`\nMigration complete. ${migrated} TenantAddOn records created/updated.`);
    console.log('Note: Old TenantSubscriptionAddOn records have NOT been deleted.');
}

// Only run if executed directly
if (require.main === module) {
    migrateAddOnsToTenant()
        .catch((error) => {
            console.error('Error during migration:', error);
            process.exit(1);
        })
        .finally(() => {
            disconnectAllPrismaClients();
        });
}

export { migrateAddOnsToTenant };
