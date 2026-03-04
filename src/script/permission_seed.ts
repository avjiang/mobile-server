import { getGlobalPrisma, disconnectAllPrismaClients } from '../db';

const permissions = [
    {
        name: "View Dashboard",
        category: "Dashboard",
        description: "View dashboard and analytics"
    },
    {
        name: "View Inventory",
        category: "Inventory",
        description: "View inventory items and stock levels"
    },
    {
        name: "View Session Reports",
        category: "Reports",
        description: "View session reports and analytics"
    },
    {
        name: "View Financial Reports",
        category: "Reports",
        description: "View financial reports and statements"
    },
    {
        name: "Manage Users",
        category: "Access Control",
        description: "Create, edit, and delete users"
    },
    {
        name: "Manage Roles",
        category: "Access Control",
        description: "Create, edit, and delete roles"
    },
    {
        name: "Manage Inventory",
        category: "Inventory",
        description: "Add, edit, and delete inventory items"
    },
    {
        name: "Manage Suppliers",
        category: "Inventory",
        description: "Add, edit, and delete suppliers"
    },
    {
        name: "View Stock Amount",
        category: "Inventory",
        description: "View complete stock amount"
    },
    {
        name: "Add Client",
        category: "Client Management",
        description: "Add new clients"
    },
    {
        name: "Edit Client",
        category: "Client Management",
        description: "Edit existing clients"
    },
    {
        name: "Delete Client",
        category: "Client Management",
        description: "Delete clients"
    },
    {
        name: "Manage Outlets",
        category: "Outlet Management",
        description: "Create and manage outlet information"
    },
    {
        name: "Process Sales",
        category: "Sales",
        description: "Create and process sales transactions"
    },
    {
        name: "View Sales History",
        category: "Sales",
        description: "View sales history and details"
    },
    {
        name: "Modify Sales History",
        category: "Sales",
        description: "Modify existing sales histories"
    },
    {
        name: "Manage Master Data",
        category: "Function Management",
        description: "Create and process master data"
    },
    {
        name: "Manage Procurement",
        category: "Function Management",
        description: "Create and process procurement data"
    },
    {
        name: "Manage Access Control",
        category: "Function Management",
        description: "Create and process access control data"
    },
    {
        name: "Receive Sales Notification",
        category: "Notifications",
        description: "Receive sales related notification"
    },
    {
        name: "Receive Notification",
        category: "Notifications",
        description: "Master permission to enable push notifications"
    },
    {
        name: "Manage Push Notification Devices",
        category: "Devices",
        description: "Manage active push notification devices"
    },
    {
        name: "Receive Inventory Notification",
        category: "Notifications",
        description: "Receive inventory related notification"
    }
];

export async function seedPermissions(): Promise<void> {
    const globalPrisma = getGlobalPrisma();

    console.log('Seeding permissions...');

    for (const permission of permissions) {
        await globalPrisma.permission.upsert({
            where: { name: permission.name },
            update: {
                category: permission.category,
                description: permission.description
            },
            create: permission
        });
    }

    console.log(`Successfully seeded ${permissions.length} permissions`);

    // Display summary
    const byCategory = permissions.reduce((acc, perm) => {
        acc[perm.category] = (acc[perm.category] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    console.log('\nSummary by Category:', byCategory);
}

// Run if executed directly
if (require.main === module) {
    seedPermissions()
        .catch((error) => {
            console.error('Error seeding permissions:', error);
            process.exit(1);
        })
        .finally(() => disconnectAllPrismaClients());
}
