import { getGlobalPrisma, disconnectAllPrismaClients } from '../db';

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
        planName: "Basic",
        planType: "Retail",
        price: 300000,
        maxTransactions: null,
        maxProducts: null,
        maxUsers: 2,
        maxDevices: 0,
        description: "Basic plan for small retail businesses"
    },
    {
        planName: "Pro",
        planType: "Retail",
        price: 450000,
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
        price: 300000,
        maxTransactions: null,
        maxProducts: null,
        maxUsers: 2,
        maxDevices: 0,
        description: "Basic plan for laundry businesses"
    },
    {
        planName: "Pro",
        planType: "Laundry",
        price: 450000,
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
