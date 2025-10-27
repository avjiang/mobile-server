# Warehouse Implementation - Terminal Commands

This document contains all the terminal commands you need to run to complete the warehouse implementation.

## Prerequisites

Before running these commands, ensure:
- ✅ All code changes have been committed
- ✅ You have access to both global and tenant databases
- ✅ Prisma is installed (`npm install prisma --save-dev` if needed)
- ✅ Backup your databases (recommended)

---

## Step 1: Generate Prisma Clients

### 1.1 Generate Global Database Client

```bash
cd prisma/global-client
npx prisma generate
```

**Expected Output:**
```
✔ Generated Prisma Client (version X.X.X) to ./generated/global in XXXms
```

### 1.2 Generate Tenant Database Client

```bash
cd ../client
npx prisma generate
```

**Expected Output:**
```
✔ Generated Prisma Client (version X.X.X) to ./generated/client in XXXms
```

### 1.3 Return to Project Root

```bash
cd ../..
```

---

## Step 2: Create Database Migrations

### 2.1 Create Global DB Migration

```bash
cd prisma/global-client
npx prisma migrate dev --name add_tenant_warehouse_table
```

**What this does:**
- Creates migration file in `prisma/global-client/migrations/`
- Adds `tenant_warehouse` table to global database
- Updates Prisma client

**Expected Output:**
```
Prisma schema loaded from schema.prisma
Datasource "db": MySQL database "global_db" at "..."

Applying migration `20250127XXXXXX_add_tenant_warehouse_table`

The following migration(s) have been created and applied from new schema changes:

migrations/
  └─ 20250127XXXXXX_add_tenant_warehouse_table/
    └─ migration.sql

Your database is now in sync with your schema.

✔ Generated Prisma Client to ./generated/global in XXXms
```

### 2.2 Create Tenant DB Migration

```bash
cd ../client
npx prisma migrate dev --name add_warehouse_tables
```

**What this does:**
- Creates migration file in `prisma/client/migrations/`
- Adds `warehouse`, `warehouse_stock_balance`, `warehouse_stock_receipt`, `warehouse_stock_movement` tables
- Adds stock source fields to `sales` table
- Updates Prisma client

**Expected Output:**
```
Prisma schema loaded from schema.prisma
Datasource "db": MySQL database "tenant_db_XXX" at "..."

Applying migration `20250127XXXXXX_add_warehouse_tables`

The following migration(s) have been created and applied from new schema changes:

migrations/
  └─ 20250127XXXXXX_add_warehouse_tables/
    └─ migration.sql

Your database is now in sync with your schema.

✔ Generated Prisma Client to ./generated/client in XXXms
```

### 2.3 Return to Project Root

```bash
cd ../..
```

---

## Step 3: Apply Migrations to All Tenant Databases

⚠️ **IMPORTANT:** The tenant migration must be applied to **ALL** existing tenant databases.

### Option A: Manual Migration (For Each Tenant)

If you have specific tenant database names, run for each:

```bash
# Example for tenant database: tenant_db_001
cd prisma/client
DATABASE_URL="mysql://user:password@host:port/tenant_db_001" npx prisma migrate deploy
cd ../..

# Repeat for tenant_db_002, tenant_db_003, etc.
```

### Option B: Automated Script (Recommended)

Create a migration script: `scripts/migrate-all-tenants.sh`

```bash
#!/bin/bash

# Get all tenant database names from global database
TENANT_DBS=$(mysql -h HOST -u USER -pPASSWORD global_db -N -e "
SELECT DISTINCT database_name FROM tenant WHERE database_name IS NOT NULL;
")

echo "Found tenant databases:"
echo "$TENANT_DBS"

# Apply migration to each tenant database
for db in $TENANT_DBS; do
    echo "Migrating $db..."
    cd prisma/client
    DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/$db" npx prisma migrate deploy
    cd ../..
    echo "✓ $db migrated"
done

echo "All tenant databases migrated successfully!"
```

Make it executable and run:

```bash
chmod +x scripts/migrate-all-tenants.sh
./scripts/migrate-all-tenants.sh
```

---

## Step 4: Install Dependencies (If Any New Packages)

```bash
npm install
```

---

## Step 5: Build TypeScript

```bash
npm run build
```

**Expected Output:**
```
> flutter-server@X.X.X build
> tsc

✨  Done in X.XXs
```

---

## Step 6: Restart Server

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
# If using PM2
pm2 restart flutter-server

# Or directly
npm start
```

---

## Step 7: Verify Implementation

### 7.1 Check Server Logs

```bash
# If using PM2
pm2 logs flutter-server

# Look for:
Server running on port 8080
```

### 7.2 Test Warehouse Endpoints (Using curl or Postman)

#### Create Test Warehouse (Admin Endpoint)

```bash
curl -X POST http://localhost:8080/admin/tenants/1/warehouses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "warehouseName": "Test Warehouse",
    "street": "123 Main St",
    "city": "Jakarta",
    "contactPhone": "+62812345678"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "First warehouse created successfully (FREE)",
  "warehouse": {
    "id": 1,
    "warehouseName": "Test Warehouse",
    "warehouseCode": "TEST_WAREHOUSE",
    ...
  },
  "billing": {
    "totalWarehouses": 1,
    "billableWarehouses": 0,
    "monthlyCost": 0,
    "isFreeWarehouse": true
  }
}
```

#### Get Customer Warehouses

```bash
curl -X GET "http://localhost:8080/warehouses/sync" \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN"
```

**Expected Response:**
```json
{
  "data": [
    {
      "id": 1,
      "warehouseName": "Test Warehouse",
      "warehouseCode": "TEST_WAREHOUSE",
      ...
    }
  ],
  "total": 1,
  "serverTimestamp": "2025-01-27T10:00:00.000Z"
}
```

---

## Step 8: Insert Warehouse Add-On into Global Database

⚠️ **REQUIRED:** Add the warehouse add-on to `subscription_add_on` table if it doesn't exist.

```sql
-- Connect to global database
mysql -h HOST -u USER -pPASSWORD global_db

-- Insert warehouse add-on (ID 3)
INSERT INTO subscription_add_on (ID, NAME, ADD_ON_TYPE, PRICE_PER_UNIT, SCOPE, DESCRIPTION)
VALUES (3, 'Extra Warehouse', 'warehouse', 100000, 'tenant', 'Additional warehouse beyond first free warehouse - 100k IDR/month')
ON DUPLICATE KEY UPDATE
NAME = 'Extra Warehouse',
ADD_ON_TYPE = 'warehouse',
PRICE_PER_UNIT = 100000;

-- Verify
SELECT * FROM subscription_add_on WHERE ID = 3;
```

**Expected Output:**
```
+----+-----------------+---------------+----------------+--------+--------------------------------------------------+
| ID | NAME            | ADD_ON_TYPE   | PRICE_PER_UNIT | SCOPE  | DESCRIPTION                                      |
+----+-----------------+---------------+----------------+--------+--------------------------------------------------+
|  3 | Extra Warehouse | warehouse     |         100000 | tenant | Additional warehouse beyond first free warehouse |
+----+-----------------+---------------+----------------+--------+--------------------------------------------------+
```

---

## Troubleshooting

### Issue 1: "Prisma Client not found"

**Solution:**
```bash
npm install @prisma/client
cd prisma/global-client && npx prisma generate
cd ../client && npx prisma generate
cd ../..
```

### Issue 2: Migration fails with "Table already exists"

**Solution:**
```bash
# Reset and re-run migration (⚠️ DEVELOPMENT ONLY)
cd prisma/client
npx prisma migrate reset
npx prisma migrate dev

# For production, manually drop conflicting tables or use --force-reset
```

### Issue 3: TypeScript compilation errors

**Solution:**
```bash
# Clean build
rm -rf dist/
npm run build
```

### Issue 4: "Cannot find module './warehouse/warehouse.controller'"

**Solution:**
```bash
# Ensure warehouse directory exists
ls -la src/warehouse/

# Should show:
# - warehouse.controller.ts
# - warehouse.service.ts
# - warehouse.request.ts

# Rebuild
npm run build
```

---

## Rollback Instructions (If Needed)

### Rollback Global Database

```bash
cd prisma/global-client
npx prisma migrate resolve --rolled-back MIGRATION_NAME
```

### Rollback Tenant Database

```bash
cd prisma/client
npx prisma migrate resolve --rolled-back MIGRATION_NAME
```

### Restore from Backup

```bash
mysql -h HOST -u USER -pPASSWORD global_db < backup_global.sql
mysql -h HOST -u USER -pPASSWORD tenant_db_001 < backup_tenant_001.sql
```

---

## Verification Checklist

After completing all steps, verify:

- [ ] Global DB has `tenant_warehouse` table
- [ ] All tenant DBs have `warehouse`, `warehouse_stock_balance`, `warehouse_stock_receipt`, `warehouse_stock_movement` tables
- [ ] `sales` table has `STOCK_SOURCE_TYPE`, `STOCK_SOURCE_OUTLET_ID`, `STOCK_SOURCE_WAREHOUSE_ID` columns
- [ ] `subscription_add_on` table has warehouse add-on (ID 3)
- [ ] Server starts without errors
- [ ] Can create warehouse via admin endpoint
- [ ] Customer can view warehouses via `/warehouses/sync`
- [ ] Warehouse billing calculates correctly (1 free + 100k per additional)

---

## Next Steps

After successful implementation:

1. ✅ Test warehouse creation for multiple tenants
2. ✅ Test warehouse deletion with stock validation
3. ✅ Test billing calculation with 2+ warehouses
4. ✅ Monitor logs for any errors
5. ✅ Update API documentation
6. ✅ Train customer support on new warehouse feature

---

## Support

If you encounter issues:
1. Check server logs: `pm2 logs` or `npm run dev`
2. Verify database connections
3. Ensure all migrations applied successfully
4. Review Prisma client generation output
5. Check network/firewall settings for database access
