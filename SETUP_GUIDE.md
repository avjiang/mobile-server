# Developer Setup Guide

This guide will help you set up the development environment for the BayarYuk server.

## Prerequisites

- **Node.js** v18 or higher
- **MySQL** 8.0 or higher (running locally)
- **npm** (comes with Node.js)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env

# 3. Edit .env with your MySQL credentials
# Update the username, password, and database names as needed

# 4. Run setup (creates database, runs migrations, seeds data)
npm run setup

# 5. Start development server
npm run dev
```

## Environment Variables

| Variable               | Description                                                                   | Example                                                 |
| ---------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------- |
| `TENANT_DATABASE_URL`  | Connection string for tenant databases. Use `{tenant_db_name}` as placeholder | `mysql://root:password@127.0.0.1:3306/{tenant_db_name}` |
| `GLOBAL_DB_URL`        | Connection string for the global database                                     | `mysql://root:password@127.0.0.1:3306/global`           |
| `NODE_ENV`             | Environment mode                                                              | `development`                                           |
| `PORT`                 | Server port                                                                   | `8080`                                                  |
| `PUSHY_SECRET_API_KEY` | Pushy push notification API key                                               | Your API key                                            |

## What `npm run setup` Does

The setup script performs the following steps:

1. **Creates Global Database** - Creates the global database if it doesn't exist
2. **Generates Prisma Clients** - Generates TypeScript clients for both schemas
3. **Runs Migrations** - Applies all pending migrations to the global database
4. **Seeds Setting Definitions** - Populates default system settings
5. **Seeds Permissions** - Populates permission definitions
6. **Seeds Subscription Plans** - Populates subscription plan options
7. **Seeds Subscription Add-Ons** - Populates subscription add-on options

## Available Scripts

| Script                               | Description                                        |
| ------------------------------------ | -------------------------------------------------- |
| `npm run setup`                      | Full setup for new developers                      |
| `npm run dev`                        | Start development server with PM2                  |
| `npm run build`                      | Compile TypeScript to JavaScript                   |
| `npm run upgrade_db`                 | Run migrations on all databases (global + tenants) |
| `npm run generate_prisma`            | Regenerate Prisma clients                          |
| `npm run seed_settings_definitions`  | Seed setting definitions only                      |
| `npm run seed_permissions`           | Seed permissions only                              |
| `npm run seed_subscription_plans`    | Seed subscription plans only                       |
| `npm run seed_subscription_add_ons`  | Seed subscription add-ons only                     |

## Seeded Data Reference

### Setting Definitions (8 settings)

| Key                   | Category        | Type    | Default                      | Scope  | Description                                |
| --------------------- | --------------- | ------- | ---------------------------- | ------ | ------------------------------------------ |
| `tax_rate`            | Financial       | DOUBLE  | 11                           | OUTLET | Default tax rate percentage (PPN)          |
| `auto_print_receipt`  | POS             | BOOLEAN | true                         | OUTLET | Automatically print receipt after sale     |
| `receipt_copies`      | POS             | INT     | 1                            | OUTLET | Number of receipt copies to print          |
| `low_stock_threshold` | Inventory       | INT     | 10                           | OUTLET | Alert when stock falls below this quantity |
| `language`            | User Preference | STRING  | en                           | USER   | Preferred language (en, id)                |
| `date_format`         | User Preference | STRING  | DD/MM/YYYY                   | USER   | Preferred date format                      |
| `company_name`        | System          | STRING  | My Company                   | TENANT | Company name for invoices and receipts     |
| `receipt_footer`      | System          | STRING  | Thank you for your business! | TENANT | Footer text on receipts                    |

### Permissions (21 permissions)

| Name                             | Category            | Description                                    |
| -------------------------------- | ------------------- | ---------------------------------------------- |
| View Dashboard                   | Dashboard           | View dashboard and analytics                   |
| View Inventory                   | Inventory           | View inventory items and stock levels          |
| View Session Reports             | Reports             | View session reports and analytics             |
| View Financial Reports           | Reports             | View financial reports and statements          |
| Manage Users                     | Access Control      | Create, edit, and delete users                 |
| Manage Roles                     | Access Control      | Create, edit, and delete roles                 |
| Manage Inventory                 | Inventory           | Add, edit, and delete inventory items          |
| Manage Suppliers                 | Inventory           | Add, edit, and delete suppliers                |
| View Stock Amount                | Inventory           | View complete stock amount                     |
| Manage Customers                 | Customer Management | Add, edit, and delete customers                |
| Manage Outlets                   | Outlet Management   | Create and manage outlet information           |
| Process Sales                    | Sales               | Create and process sales transactions          |
| View Sales History               | Sales               | View sales history and details                 |
| Modify Sales History             | Sales               | Modify existing sales histories                |
| Manage Master Data               | Function Management | Create and process master data                 |
| Manage Procurement               | Function Management | Create and process procurement data            |
| Manage Access Control            | Function Management | Create and process access control data         |
| Receive Sales Notification       | Notifications       | Receive sales related notification             |
| Receive Notification             | Notifications       | Master permission to enable push notifications |
| Manage Push Notification Devices | Devices             | Manage active push notification devices        |
| Receive Inventory Notification   | Notifications       | Receive inventory related notification         |

### Subscription Plans (3 plans)

| Plan Name | Plan Type | Price   | Max Users | Max Devices | Description                               |
| --------- | --------- | ------- | --------- | ----------- | ----------------------------------------- |
| Trial     | Retail    | 0       | 2         | 0           | Trial plan                                |
| Basic     | Retail    | 275,000 | 2         | 0           | Basic plan for small retail businesses    |
| Pro       | Retail    | 400,000 | 3         | 3           | Pro plan with push notification support   |

### Subscription Add-Ons (3 add-ons)

| Name                               | Type      | Price/Unit | Max Qty | Scope  | Description                               |
| ---------------------------------- | --------- | ---------- | ------- | ------ | ----------------------------------------- |
| Additional User                    | user      | 49,000     | 1       | outlet | Add extra user to an outlet subscription  |
| Additional Push Notification Device| user      | 20,000     | 1       | tenant | Add extra push notification device        |
| Extra Warehouse                    | warehouse | 149,000    | -       | tenant | Add extra warehouse for inventory         |

## Troubleshooting

### MySQL Connection Failed

```
Error: Failed to connect to MySQL
```

**Solution:** Ensure MySQL is running and credentials in `.env` are correct.

```bash
# Check if MySQL is running
mysql -u root -p -e "SELECT 1"
```

### Prisma Client Not Generated

```
Error: Cannot find module '../prisma/client/generated/client'
```

**Solution:** Run Prisma generate:

```bash
npm run generate_prisma
```

### Migration Failed

```
Error: Failed to apply migrations
```

**Solution:** Ensure the database exists and you have proper permissions. If the database doesn't exist, run `npm run setup` instead of `npm run upgrade_db`.

## Updating Seeds

### Adding New Setting Definitions

Edit `src/script/setting_definitions_seed.ts` and add new entries to the `settingDefinitions` array:

```typescript
{
    key: 'your_new_setting',
    category: 'Category Name',
    type: 'STRING', // STRING, INT, DOUBLE, BOOLEAN
    defaultValue: 'default',
    description: 'Description of the setting',
    scope: 'OUTLET', // OUTLET, TENANT, USER
    isRequired: false
}
```

Then run:

```bash
npm run seed_settings_definitions
```

### Adding New Permissions

Edit `src/script/permission_seed.ts` and add new entries to the `permissions` array:

```typescript
{
    name: "New Permission Name",
    category: "Category Name",
    description: "What this permission allows"
}
```

Then run:

```bash
npm run seed_permissions
```

### Adding New Subscription Plans

Edit `src/script/subscription_plan_seed.ts` and add new entries to the `subscriptionPlans` array:

```typescript
{
    planName: "Enterprise",
    planType: "Retail",
    price: 500000,
    maxTransactions: null,
    maxProducts: null,
    maxUsers: 10,
    maxDevices: 10,
    description: "Enterprise plan for large businesses"
}
```

Then run:

```bash
npm run seed_subscription_plans
```

### Adding New Subscription Add-Ons

Edit `src/script/subscription_add_on_seed.ts` and add new entries to the `subscriptionAddOns` array:

```typescript
{
    name: "Extra Feature",
    addOnType: "feature",
    pricePerUnit: 50000,
    maxQuantity: null,
    scope: "tenant",
    description: "Description of the add-on"
}
```

Then run:

```bash
npm run seed_subscription_add_ons
```

## Database Architecture

This project uses a multi-tenant architecture with two Prisma schemas:

- **Global Schema** (`prisma/global-client/schema.prisma`)

  - Single database for all tenants
  - Contains: Tenant, TenantUser, Permission, SettingDefinition, SubscriptionPlan, etc.

- **Tenant Schema** (`prisma/client/schema.prisma`)
  - Separate database per tenant (using `{tenant_db_name}` placeholder)
  - Contains: User, Item, Category, Sales, Invoice, etc.
