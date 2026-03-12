import { getGlobalPrisma, disconnectAllPrismaClients } from '../db';

const subscriptionAddOns = [
    {
        name: "Additional User",
        addOnType: "user",
        pricePerUnit: 50000,
        maxQuantity: 1,
        scope: "tenant",
        description: "Add extra user to tenant (tenant-wide pool)"
    },
    {
        name: "Additional Push Notification Device",
        addOnType: "device",
        pricePerUnit: 20000,
        maxQuantity: 1,
        scope: "tenant",
        description: "Add extra push notification device for tenant"
    },
    {
        name: "Extra Warehouse",
        addOnType: "warehouse",
        pricePerUnit: 150000,
        maxQuantity: null,
        scope: "tenant",
        description: "Add extra warehouse for inventory management"
    },
    {
        name: "Advanced Loyalty",
        addOnType: "feature",
        pricePerUnit: 150000,
        maxQuantity: 1,
        scope: "tenant",
        description: "Advanced loyalty features: tiers, multipliers, subscription packages"
    }
];

export async function seedSubscriptionAddOns(): Promise<void> {
    const globalPrisma = getGlobalPrisma();

    console.log('Seeding subscription add-ons...');

    for (const addOn of subscriptionAddOns) {
        await globalPrisma.subscriptionAddOn.upsert({
            where: { id: subscriptionAddOns.indexOf(addOn) + 1 },
            update: {
                name: addOn.name,
                addOnType: addOn.addOnType,
                pricePerUnit: addOn.pricePerUnit,
                maxQuantity: addOn.maxQuantity,
                scope: addOn.scope,
                description: addOn.description
            },
            create: addOn
        });
        console.log(`  ✓ ${addOn.name}`);
    }

    console.log(`Seeded ${subscriptionAddOns.length} subscription add-ons.`);
}

// Only run if executed directly
if (require.main === module) {
    seedSubscriptionAddOns()
        .catch((error) => {
            console.error('Error seeding subscription add-ons:', error);
            process.exit(1);
        })
        .finally(() => {
            disconnectAllPrismaClients();
        });
}
