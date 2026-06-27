/**
 * Canonical permission-name constants.
 *
 * These MUST match the `name` values seeded by `src/script/permission_seed.ts`
 * exactly — the JWT `permissions[]` array (stamped at login) and the
 * `requirePermission(...)` middleware compare against these strings.
 *
 * Use these constants instead of inline string literals so a typo can't
 * silently produce a permission that no role can ever satisfy.
 *
 * A unit test (`__tests__/permission-names.test.ts`) asserts every value here
 * exists in the seed, guarding against drift.
 */
export const PERMISSION = {
    // Dashboard
    VIEW_DASHBOARD: 'View Dashboard',
    // Inventory
    VIEW_INVENTORY: 'View Inventory',
    MANAGE_INVENTORY: 'Manage Inventory',
    MANAGE_SUPPLIERS: 'Manage Suppliers',
    VIEW_STOCK_AMOUNT: 'View Stock Amount',
    OVERRIDE_STOCK_SOURCE: 'Override Stock Source',
    // Reports
    VIEW_SESSION_REPORTS: 'View Session Reports',
    VIEW_FINANCIAL_REPORTS: 'View Financial Reports',
    // Access Control
    MANAGE_USERS: 'Manage Users',
    MANAGE_ROLES: 'Manage Roles',
    MANAGE_ACCESS_CONTROL: 'Manage Access Control',
    // Client Management
    ADD_CLIENT: 'Add Client',
    EDIT_CLIENT: 'Edit Client',
    DELETE_CLIENT: 'Delete Client',
    // Outlet Management
    MANAGE_OUTLETS: 'Manage Outlets',
    // Sales
    PROCESS_SALES: 'Process Sales',
    VIEW_SALES_HISTORY: 'View Sales History',
    MODIFY_SALES_HISTORY: 'Modify Sales History',
    PRINT_BILL: 'Print Bill',
    // Function Management
    MANAGE_MASTER_DATA: 'Manage Master Data',
    MANAGE_PROCUREMENT: 'Manage Procurement',
    // Notifications / Devices
    RECEIVE_SALES_NOTIFICATION: 'Receive Sales Notification',
    RECEIVE_NOTIFICATION: 'Receive Notification',
    RECEIVE_INVENTORY_NOTIFICATION: 'Receive Inventory Notification',
    MANAGE_PUSH_DEVICES: 'Manage Push Notification Devices',
    // Loyalty
    MANAGE_LOYALTY_PROGRAM: 'Manage Loyalty Program',
    VIEW_LOYALTY_ACCOUNTS: 'View Loyalty Accounts',
    ADJUST_LOYALTY_POINTS: 'Adjust Loyalty Points',
    MANAGE_SUBSCRIPTION_PACKAGES: 'Manage Subscription Packages',
    VIEW_CUSTOMER_SUBSCRIPTIONS: 'View Customer Subscriptions',
    MANAGE_CUSTOMER_SUBSCRIPTIONS: 'Manage Customer Subscriptions',
    // Online Catalogue
    MANAGE_ONLINE_CATALOGUE: 'Manage Online Catalogue',
    // Expenses (Pro feature)
    VIEW_EXPENSES: 'View Expenses',
    MANAGE_EXPENSES: 'Manage Expenses',
    // Sales — cash reconciliation at session close
    PERFORM_CASH_RECONCILIATION: 'Perform Cash Reconciliation',
    // Financial — UI-only monetary masking (see docs/future/MONETARY_VISIBILITY_PERMISSIONS.md)
    VIEW_COST_PROFIT: 'View Cost & Profit',
    VIEW_SALES_AMOUNTS: 'View Sales Amounts',
} as const;

export type PermissionName = (typeof PERMISSION)[keyof typeof PERMISSION];
