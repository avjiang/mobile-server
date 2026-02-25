import { getGlobalPrisma, disconnectAllPrismaClients } from '../db';

const subscriptionPlans = [
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
        price: 275000,
        maxTransactions: null,
        maxProducts: null,
        maxUsers: 2,
        maxDevices: 0,
        description: "Basic plan for small retail businesses"
    },
    {
        planName: "Pro",
        planType: "Retail",
        price: 400000,
        maxTransactions: null,
        maxProducts: null,
        maxUsers: 3,
        maxDevices: 3,
        description: "Pro plan with push notification support"
    }
];

export async function seedSubscriptionPlans(): Promise<void> {
    const globalPrisma = getGlobalPrisma();

    console.log('Seeding subscription plans...');

    for (const plan of subscriptionPlans) {
        await globalPrisma.subscriptionPlan.upsert({
            where: { planName: plan.planName },
            update: {
                planType: plan.planType,
                price: plan.price,
                maxTransactions: plan.maxTransactions,
                maxProducts: plan.maxProducts,
                maxUsers: plan.maxUsers,
                maxDevices: plan.maxDevices,
                description: plan.description
            },
            create: plan
        });
        console.log(`  ✓ ${plan.planName}`);
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
