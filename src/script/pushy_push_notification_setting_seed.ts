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
 * Push Notification Device Add-on
 *
 * Each outlet subscription includes 3 devices by default.
 * Additional devices can be purchased at IDR 19,000/month per device.
 *
 * IMPORTANT: The system uses add-on ID (2) to identify device add-ons.
 * Do not change this ID as it's referenced in code.
 */
const deviceAddOn = {
    id: 2,
    name: 'Additional Push Notification Device',
    addOnType: 'device',
    pricePerUnit: 19000.00,
    maxQuantity: null, // No limit
    scope: 'tenant',
    description: 'Additional push notification device slot (IDR 19,000/month per device). Each outlet includes 3 devices by default.'
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
