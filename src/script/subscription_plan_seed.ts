import { getGlobalPrisma, disconnectAllPrismaClients } from '../db';

// `maxDevices` is no longer enforced (2026-09-29): push devices are unlimited
// on Pro, see pushy/device.service `checkDeviceLimit`. The column stays.
const subscriptionPlans = [
    // Retail plans
    {
        planName: "Trial",
        planType: "Retail",
        price: 0,
        maxTransactions: null,
        maxProducts: null,
        maxUsers: 2,
        maxDevices: 0,
        description: null
    },
    {
        planName: "Lite",
        planType: "Retail",
        price: 100000,
        maxTransactions: null,
        maxProducts: 100,
        maxUsers: 1,
        maxDevices: 0,
        description: "Lite plan: a simple till for small shops (100 items, 1 user, no credit sales)"
    },
    {
        planName: "Basic",
        planType: "Retail",
        price: 250000,
        maxTransactions: null,
        maxProducts: null,
        maxUsers: 2,
        maxDevices: 0,
        description: "Basic plan for small retail businesses"
    },
    {
        planName: "Pro",
        planType: "Retail",
        price: 375000,
        maxTransactions: null,
        maxProducts: null,
        maxUsers: 3,
        maxDevices: 3,
        description: "Pro plan with push notification support"
    },
    // Laundry plans
    {
        planName: "Trial",
        planType: "Laundry",
        price: 0,
        maxTransactions: null,
        maxProducts: null,
        maxUsers: 2,
        maxDevices: 0,
        description: null
    },
    {
        planName: "Basic",
        planType: "Laundry",
        price: 100000,
        maxTransactions: null,
        maxProducts: null,
        maxUsers: 1,
        maxDevices: 0,
        description: "Basic plan for laundry businesses"
    },
    {
        planName: "Pro",
        planType: "Laundry",
        price: 199000,
        maxTransactions: null,
        maxProducts: null,
        maxUsers: 3,
        maxDevices: 3,
        description: "Pro plan for laundry businesses with push notification support"
    },
];

export async function seedSubscriptionPlans(): Promise<void> {
    const globalPrisma = getGlobalPrisma();

    console.log('Seeding subscription plans...');

    for (const plan of subscriptionPlans) {
        await globalPrisma.subscriptionPlan.upsert({
            where: { planName_planType: { planName: plan.planName, planType: plan.planType } },
            update: {
                price: plan.price,
                maxTransactions: plan.maxTransactions,
                maxProducts: plan.maxProducts,
                maxUsers: plan.maxUsers,
                maxDevices: plan.maxDevices,
                description: plan.description
            },
            create: plan
        });
        console.log(`  ✓ ${plan.planName} (${plan.planType})`);
    }

    console.log(`Seeded ${subscriptionPlans.length} subscription plans.`);
}

// Only run if executed directly
if (require.main === module) {
    seedSubscriptionPlans()
        .catch((error) => {
            console.error('Error seeding subscription plans:', error);
            process.exit(1);
        })
        .finally(() => {
            disconnectAllPrismaClients();
        });
}
