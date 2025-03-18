// prisma/seed.ts
import { PrismaClient } from ".prisma/global-client";
import bcrypt from "bcryptjs"
import { getTenantPrisma, initializeTenantDatabase } from './db';

const prisma = new PrismaClient();

async function main(): Promise<void> {
    // Seed Subscription Plans
    const plans = await Promise.all([
        prisma.subscriptionPlan.create({
            data: {
                planName: 'Basic',
                price: 29.99,
                description: 'Basic subscription plan for small teams',
            },
        }),
        prisma.subscriptionPlan.create({
            data: {
                planName: 'Pro',
                price: 99.99,
                description: 'Professional plan with advanced features',
            },
        }),
        prisma.subscriptionPlan.create({
            data: {
                planName: 'Enterprise',
                price: 299.99,
                description: 'Enterprise-grade plan with full features',
            },
        }),
    ]);

    // Seed Subscription Add-Ons
    const addOns = await Promise.all([
        prisma.subscriptionAddOn.create({
            data: {
                name: 'Additional User',
                addOnType: 'user',
                pricePerUnit: 5.99,
                maxQuantity: 50,
                description: 'Add additional users to your plan',
            },
        }),
        prisma.subscriptionAddOn.create({
            data: {
                name: 'Extra Transactions',
                addOnType: 'transaction',
                pricePerUnit: 0.10,
                maxQuantity: 10000,
                description: 'Additional transaction pack',
            },
        }),
        prisma.subscriptionAddOn.create({
            data: {
                name: 'Premium Support',
                addOnType: 'feature',
                pricePerUnit: 49.99,
                description: '24/7 premium support feature',
            },
        }),
    ]);

    // Seed Tenants
    const tenants = await Promise.all([
        prisma.tenant.create({
            data: {
                tenantName: 'Web Bytes',
                databaseName: 'web_bytes_db',
            },
        }),
        prisma.tenant.create({
            data: {
                tenantName: 'Tech Startup',
                databaseName: 'tech_startup_db',
            },
        }),
        await initializeTenantDatabase('web_bytes_db'),
        await initializeTenantDatabase('tech_startup_db')
    ]);
    const tenantPrisma1 = getTenantPrisma('web_bytes_db');
    const newUser1 = await tenantPrisma1.user.create({
        data: {
            username: "web_bytes",
            password: bcrypt.hashSync("web_bytes", 10),
            role: "Super Admin",
        }
    })
    await tenantPrisma1.$disconnect();

    const tenantPrisma2 = getTenantPrisma('tech_startup_db');
    const newUser2 = await tenantPrisma2.user.create({
        data: {
            username: "tech_startup",
            password: bcrypt.hashSync("tech_startup", 10),
            role: "Cashier",
        }
    })
    await tenantPrisma2.$disconnect();

    // Seed Tenant Users
    const users = await Promise.all([
        prisma.tenantUser.create({
            data: {
                username: 'web_bytes',
                password: bcrypt.hashSync("web_bytes", 10),
                tenantId: tenants[0].id,
            },
        }),
        prisma.tenantUser.create({
            data: {
                username: 'tech_startup',
                password: bcrypt.hashSync("tech_startup", 10),
                tenantId: tenants[1].id,
            },
        }),
    ]);

    // Seed Tenant Subscriptions
    const subscriptions = await Promise.all([
        prisma.tenantSubscription.create({
            data: {
                tenantId: tenants[0].id,
                subscriptionPlanId: plans[0].id,
                nextPaymentDate: new Date('2025-04-18'),
                subscriptionValidUntil: new Date('2025-04-18'),
            },
        }),
        prisma.tenantSubscription.create({
            data: {
                tenantId: tenants[1].id,
                subscriptionPlanId: plans[1].id,
                nextPaymentDate: new Date('2025-04-18'),
                subscriptionValidUntil: new Date('2025-04-18'),
            },
        }),
    ]);

    // Seed Tenant Subscription Add-Ons
    await Promise.all([
        prisma.tenantSubscriptionAddOn.create({
            data: {
                tenantSubscriptionId: subscriptions[0].id,
                addOnId: addOns[0].id,
                quantity: 5,
            },
        }),
        prisma.tenantSubscriptionAddOn.create({
            data: {
                tenantSubscriptionId: subscriptions[1].id,
                addOnId: addOns[1].id,
                quantity: 1000,
            },
        }),
        prisma.tenantSubscriptionAddOn.create({
            data: {
                tenantSubscriptionId: subscriptions[1].id,
                addOnId: addOns[2].id,
                quantity: 1,
            },
        }),
    ]);

    console.log('Database seeded successfully!');
}

main()
    .catch((e: Error) => {
        console.error('Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });