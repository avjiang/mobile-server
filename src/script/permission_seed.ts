import { getGlobalPrisma, disconnectAllPrismaClients } from '../db';

export const permissions = [
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
        name: "Override Stock Source",
        category: "Inventory",
        description: "Manually force a sale's stock source (outlet vs warehouse), overriding the automatic resolver"
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
        name: "Print Bill",
        category: "Sales",
        description: "Print pre-payment bill from cart"
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
    },
    // Loyalty permissions
    {
        name: "Manage Loyalty Program",
        category: "Loyalty",
        description: "Create and edit loyalty program settings and tiers"
    },
    {
        name: "View Loyalty Accounts",
        category: "Loyalty",
        description: "View customer loyalty balances and history"
    },
    {
        name: "Adjust Loyalty Points",
        category: "Loyalty",
        description: "Manually add or remove loyalty points"
    },
    {
        name: "Manage Subscription Packages",
        category: "Loyalty",
        description: "Create, edit, and delete subscription packages"
    },
    {
        name: "View Customer Subscriptions",
        category: "Loyalty",
        description: "View active customer subscriptions"
    },
    {
        name: "Manage Customer Subscriptions",
        category: "Loyalty",
        description: "Subscribe, cancel, and manage customer subscriptions"
    },
    // Online Catalogue (Pro feature) — gates the FE catalogue entry (settings +
    // storage). Pro is account-level; this restricts WHICH roles can manage the
    // storefront. Name must match FE AppPermission.manageOnlineCatalogue.
    {
        name: "Manage Online Catalogue",
        category: "Online Catalogue",
        description: "Manage the online catalogue storefront and its media storage"
    },
    // Expenses (Pro feature) — operating-cost / expense module. Read path is
    // gated with hasAnyPermission([View, Manage]) on the FE because permissions
    // are a flat set (Manage does NOT imply View). Names MUST match FE
    // AppPermission.viewExpenses / manageExpenses.
    {
        name: "View Expenses",
        category: "Expenses",
        description: "View the expense ledger and expense categories"
    },
    {
        name: "Manage Expenses",
        category: "Expenses",
        description: "Create, edit, and delete expenses and expense categories"
    },
    // Cash reconciliation at session close (opening float + counted-cash variance).
    {
        name: "Perform Cash Reconciliation",
        category: "Sales",
        description: "Count the cash drawer and record the variance when closing a session"
    },
    // Monetary visibility (UI-only masking) — see docs/future/MONETARY_VISIBILITY_PERMISSIONS.md.
    // Absence hides the figures in the FE only (the API still returns them). Names MUST
    // match FE AppPermission.viewCostProfit / viewSalesAmounts.
    {
        name: "View Cost & Profit",
        category: "Financial",
        description: "View item cost, profit, and margin figures"
    },
    {
        name: "View Sales Amounts",
        category: "Financial",
        description: "View transaction totals in sales history"
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
