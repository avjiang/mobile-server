# Developer Setup Guide

This guide covers the backend on its own. **Setting up a whole machine (backend + Flutter app + prod
access)? Follow `flutter-front-end/docs/NEW_MACHINE_SETUP.md`** — it is the maintained checklist and
links back here for the seed and schema details.

## Prerequisites

- **Node.js 22** — the server crashes on Node 24+ (`SlowBuffer` removed); install with
  `nvm install 22 && nvm alias default 22`
- **MySQL 8.4** server running locally (`127.0.0.1:3306`); for prod work also the `mysql-client@8.4`
  client, because a 9.x `mysqldump` cannot back up the 8.0 prod server
- **npm** (comes with Node.js)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env

# 3. Edit .env with your MySQL credentials
# Update the username, password, and database names as needed (keep PORT=8081 — the app expects it)

# 4. Run setup (creates database, runs migrations, seeds data)
npm run setup

# 5. Create a tenant to log in with (login = password = the tenant name)
npx ts-node src/script/create_test_tenant.ts local web_bytes Pro Retail

# 6. Start development server, then check it
npm run dev
curl -s http://localhost:8081/health
```

## Environment Variables

| Variable               | Description                                                                   | Example                                                 |
| ---------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------- |
| `TENANT_DATABASE_URL`  | Connection string for tenant databases. Use `{tenant_db_name}` as placeholder | `mysql://root:password@127.0.0.1:3306/{tenant_db_name}` |
| `GLOBAL_DB_URL`        | Connection string for the global database                                     | `mysql://root:password@127.0.0.1:3306/global`           |
| `NODE_ENV`             | Environment mode                                                              | `development`                                           |
| `PORT`                 | Server port — use 8081, the app's debug base URL (code falls back to 8080)     | `8081`                                                  |
| `FIREBASE_SERVICE_ACCOUNT` | FCM service-account JSON for push; unset = push sends skipped             | see `.env.example`                                      |

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

The seed files are the source of truth — this page no longer copies their contents, because the copies
went stale (old plan prices, 8 of 35 settings):

| Data | Source | Notes |
| --- | --- | --- |
| Setting definitions | `src/script/setting_definitions_seed.ts` | idempotent upsert; a `global` DB missing some rows silently hides Settings fields |
| Permissions | `src/script/permission_seed.ts` | |
| Subscription plans | `src/script/subscription_plan_seed.ts` | prices come from `flutter-front-end/tool/product_catalog/catalog.json`; `sync.py --check` flags a seed that disagrees |
| Subscription add-ons | `src/script/subscription_add_on_seed.ts` | same catalog rule |

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

## Multi-Outlet Awareness

The system is strictly multi-tenant and multi-outlet. When developing new features, follow these rules:

1.  **Scoped Queries**: Always scope your queries by `outletId`. Transactional data must belong to an outlet.
2.  **No Hardcoded Defaults**: Never use hardcoded fallbacks like `?? 1` for `outletId`. The system relies on the `AuthRequest` middleware to provide the verified `outletId` for the current context.
3.  **Auth Scoping**: The `outlet-authorization-middleware.ts` enforces that users can only access `outletId`s they are assigned to.
4.  **Document Numbering**: Document numbers (Invoices, Sales, etc.) must follow the `{PREFIX}-OUT{outletId}-{DATE}-{SEQ}` format to prevent collisions across outlets during offline-sync workflows.
