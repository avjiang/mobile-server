import { getGlobalPrisma } from '../db';

const globalPrisma = getGlobalPrisma();

/**
 * Push Notification Permissions
 * These permissions control which notification types a user can receive.
 *
 * - 'Receive Notification': Master permission that enables push notification functionality.
 *   If disabled, client won't register with Pushy at all.
 * - Specific permissions: Control which types of notifications the user receives.
 *   Only checked if 'Receive Notification' is enabled.
 */
const notificationPermissions = [
    {
        name: 'Receive Notification',
        category: 'Notifications',
        description: 'Master permission to enable push notifications. If disabled, device will not register for notifications.'
    },
    {
        name: 'Receive Sales Notification',
        category: 'Notifications',
        description: 'Receive notifications about sales and transactions'
    },
    {
        name: 'Receive Inventory Notification',
        category: 'Notifications',
        description: 'Receive notifications about inventory and stock levels'
    },
    {
        name: 'Receive Order Notification',
        category: 'Notifications',
        description: 'Receive notifications about order status changes'
    },
    {
        name: 'Receive Financial Notification',
        category: 'Notifications',
        description: 'Receive notifications about payments and financial matters'
    },
    {
        name: 'Receive Staff Notification',
        category: 'Notifications',
        description: 'Receive notifications about staff and scheduling'
    },
    {
        name: 'Receive System Notification',
        category: 'Notifications',
        description: 'Receive system alerts and important updates'
    }
];

/**
 * Push Notification Device Add-on — RETIRED 2026-09-29.
 *
 * Push devices are unlimited on Pro (FCM has no per-device cost), so this
 * add-on is not sold and never billed (`isNonBillableAddOn`). The row is kept
 * at id 2 because old tenant_add_on rows still point at it. Keep these values
 * in step with `subscription_add_on_seed.ts`.
 */
const deviceAddOn = {
    id: 2,
    name: 'Additional Push Notification Device (retired)',
    addOnType: 'device',
    pricePerUnit: 0,
    maxQuantity: 1,
    scope: 'tenant',
    description: 'Retired 2026-09-29 — push devices are unlimited on Pro. Not sold, never billed.'
};

async function seedPermissions() {
    console.log('🔔 Seeding notification permissions...');

    const createdPermissions = [];
    for (const permission of notificationPermissions) {
        const existingPermission = await globalPrisma.permission.findFirst({
            where: { name: permission.name }
        });

        if (!existingPermission) {
            const created = await globalPrisma.permission.create({
                data: permission
            });
            createdPermissions.push(created);
        }
    }

    console.log(`✅ Permissions: ${createdPermissions.length} created, ${notificationPermissions.length - createdPermissions.length} already existed`);
    return createdPermissions;
}

async function seedDeviceAddOn() {
    console.log('📱 Seeding device add-on...');

    const existing = await globalPrisma.subscriptionAddOn.findUnique({
        where: { id: deviceAddOn.id }
    });

    if (existing) {
        await globalPrisma.subscriptionAddOn.update({
            where: { id: deviceAddOn.id },
            data: {
                name: deviceAddOn.name,
                addOnType: deviceAddOn.addOnType,
                pricePerUnit: deviceAddOn.pricePerUnit,
                maxQuantity: deviceAddOn.maxQuantity,
                scope: deviceAddOn.scope,
                description: deviceAddOn.description
            }
        });
        console.log('✅ Device add-on updated');
    } else {
        await globalPrisma.subscriptionAddOn.create({
            data: {
                id: deviceAddOn.id,
                name: deviceAddOn.name,
                addOnType: deviceAddOn.addOnType,
                pricePerUnit: deviceAddOn.pricePerUnit,
                maxQuantity: deviceAddOn.maxQuantity,
                scope: deviceAddOn.scope,
                description: deviceAddOn.description
            }
        });
        console.log('✅ Device add-on created');
    }
}

async function seed() {
    console.log('🌱 Starting Pushy push notification seed...\n');

    await seedPermissions();
    await seedDeviceAddOn();

    console.log('\n📊 Summary:');
    console.log(`   - ${notificationPermissions.length} notification permissions`);
    console.log(`   - 1 device add-on (ID: ${deviceAddOn.id})`);
    console.log('\n✨ Pushy seed completed successfully!');
}

seed()
    .catch((error) => {
        console.error('❌ Error seeding Pushy data:', error);
        process.exit(1);
    })
    .finally(() => globalPrisma.$disconnect());
