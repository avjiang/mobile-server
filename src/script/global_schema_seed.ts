import { PrismaClient } from ".prisma/global-client";
import bcrypt from "bcryptjs"
import { getTenantPrisma, initializeTenantDatabase } from '../db';

const prisma = new PrismaClient();

async function seedPermissions(tenantPrisma: any) {
    const permissions = [
        {
            name: "View Dashboard",
            description: "View dashboard and analytics",
            category: "Dashboard"
        },
        {
            name: "View Inventory",
            description: "View inventory items and stock levels",
            category: "Inventory"
        },
        {
            name: "View Session Reports",
            description: "View session reports and analytics",
            category: "Reports"
        },
        {
            name: "View Financial Reports",
            description: "View financial reports and statements",
            category: "Reports"
        },
        {
            name: "Manage Users",
            description: "Create, edit, and delete users",
            category: "User Management"
        },
        {
            name: "Manage Roles",
            description: "Create, edit, and delete roles",
            category: "User Management"
        },
        {
            name: "Manage Inventory",
            description: "Add, edit, and delete inventory items",
            category: "Inventory"
        },
        {
            name: "Manage Customers",
            description: "Add, edit, and delete customers",
            category: "Customer Management"
        },
        {
            name: "Manage Suppliers",
            description: "Add, edit, and delete suppliers",
            category: "Inventory"
        },
        {
            name: "Manage Outlets",
            description: "Create and manage outlet information",
            category: "Outlet Management"
        },
        // {
        //     name: "Manage System Settings",
        //     description: "Configure system settings and preferences",
        //     category: "System"
        // },
        {
            name: "Process Sales",
            description: "Create and process sales transactions",
            category: "Sales"
        },
    ];

    const createdPermissions = [];
    for (const permission of permissions) {
        const existingPermission = await tenantPrisma.permission.findFirst({
            where: { name: permission.name }
        });

        if (!existingPermission) {
            const created = await tenantPrisma.permission.create({
                data: permission
            });
            createdPermissions.push(created);
        }
    }

    return createdPermissions;
}

async function main(): Promise<void> {
    // Seed Subscription Plans
    const plans = await Promise.all([
        prisma.subscriptionPlan.create({
            data: {
                planName: 'Basic',
                price: 259000,
                maxUsers: 2,
                description: 'Basic subscription plan for small businesses',
            },
        }),
    ]);

    // Seed Subscription Add-Ons
    const addOns = await Promise.all([
        prisma.subscriptionAddOn.create({
            data: {
                name: 'Additional User',
                addOnType: 'user',
                pricePerUnit: 49000,
                maxQuantity: 1,
                description: 'Add additional users to your plan',
            },
        }),
        prisma.subscriptionAddOn.create({
            data: {
                name: 'Premium Inventory Management',
                addOnType: 'feature',
                pricePerUnit: 79000,
                maxQuantity: 1,
                description: '',
            },
        }),
        prisma.subscriptionAddOn.create({
            data: {
                name: 'Advanced Reporting',
                addOnType: 'feature',
                pricePerUnit: 49000,
                maxQuantity: 1,
                description: '',
            },
        }),
    ]);

    const adminTenant = await prisma.tenant.create({
        data: {
            tenantName: 'Alvin Jiang',
            databaseName: 'alvin_jiang_db',
        },
    })

    const admin = await prisma.tenantUser.create({
        data: {
            username: "avjiang",
            password: bcrypt.hashSync("avjiang", 10),
            role: "Super Admin",
            tenantId: adminTenant.id,
        }
    })

    // Seed permissions for the global tenant
    const permissions = await seedPermissions(prisma);

    // Seed Tenants
    const tenants = await Promise.all([
        prisma.tenant.create({
            data: {
                tenantName: 'Web Bytes',
                databaseName: 'web_bytes_db',
            },
        }),
        await initializeTenantDatabase('web_bytes_db'),
    ]);
    const tenantPrisma1 = getTenantPrisma('web_bytes_db');
    await tenantPrisma1.role.create({
        data: {
            name: "Super Admin",
            description: "Has full access to all system features and settings",
        }
    });


    // Find or create the "Super Admin" role
    let superAdminRole = await tenantPrisma1.role.findFirst({
        where: { name: "Super Admin" }
    });
    if (!superAdminRole) {
        superAdminRole = await tenantPrisma1.role.create({
            data: { name: "Super Admin" }
        });
    }

    const newUser1 = await tenantPrisma1.user.create({
        data: {
            username: "web_bytes",
            password: bcrypt.hashSync("web_bytes", 10),
            roles: {
                connect: [{ id: superAdminRole.id }]
            }
        }
    })

    // Seed Global Tenant Outlet
    const globalOutlet = await prisma.tenantOutlet.create({
        data: {
            tenantId: tenants[0].id,
            outletName: "Main Outlet",
        }
    })

    // Seed Tenant Outlet
    const outlet = await tenantPrisma1.outlet.create({
        data: {
            tenantOutletId: globalOutlet.id,
            outletName: "Main Outlet",
            street: "123 Main Street",
            outletTel: "123-456-7890",
        }
    })

    // Seed Tenant Customer
    const customer = await tenantPrisma1.customer.create({
        data: {
            firstName: "John",
            lastName: "Doe",
            email: "john.doe@example.com",
            mobile: "987-654-3210",
            billStreet: "456 Elm Street",
            billCity: "Metropolis",
            billState: "NY",
            billPostalCode: "10001",
            deleted: false,
        }
    });

    // Seed Tenant Supplier
    const supplier = await tenantPrisma1.supplier.create({
        data: {
            companyName: "Web Bytes Supplier",
            hasTax: false
        }
    })

    // Seed Tenant Item Categories
    const category1 = await tenantPrisma1.category.create({
        data: {
            name: "Electronics",
            description: "All electronic items",
        }
    })
    await tenantPrisma1.$disconnect();

    // Seed Tenant Users
    const users = await Promise.all([
        prisma.tenantUser.create({
            data: {
                username: 'web_bytes',
                password: bcrypt.hashSync("web_bytes", 10),
                tenantId: tenants[0].id,
            },
        }),
    ]);

    // Seed Tenant Subscriptions
    const now = new Date();
    const oneMonthLater = new Date(now);
    oneMonthLater.setMonth(now.getMonth() + 1);

    const subscriptions = await Promise.all([
        prisma.tenantSubscription.create({
            data: {
                tenantId: tenants[0].id,
                outletId: globalOutlet.id,
                subscriptionPlanId: plans[0].id,
                nextPaymentDate: oneMonthLater,
                subscriptionValidUntil: oneMonthLater,
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