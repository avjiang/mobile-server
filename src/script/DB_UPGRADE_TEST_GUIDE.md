# Database Upgrade Test Script

A utility script for testing database migrations against a specific database instance (e.g., Azure MySQL) without using the multi-tenant placeholder system.

## Purpose

The main `db_upgrade.ts` script iterates through all tenants from the global database and applies migrations to each one using the `{tenant_db_name}` placeholder in `TENANT_DATABASE_URL`.

This test script allows you to:
- Test connectivity to a specific Azure database
- Run migrations on a single, explicitly named database
- Debug migration issues in isolation

## Configuration

Edit the configuration section at the top of `src/script/db_upgrade_test.ts`:

```typescript
// Your target database name
const TEST_DB_NAME = "your_test_db_name";

// Azure connection details
const AZURE_CONFIG = {
    host: "your-azure-server.mysql.database.azure.com",
    port: 3306,
    user: "your_username",
    password: "your_password",
};
```

## Usage

### Test Connection Only (Default)

Verifies that the script can connect to your Azure database:

```bash
npm run upgrade_db_test
# or
npm run upgrade_db_test test
```

### Run Migration on Test Database

Executes `prisma migrate deploy` on the specified test database:

```bash
npm run upgrade_db_test migrate
```

### Run Migration on Global Database

Executes migration on the global database:

```bash
npm run upgrade_db_test migrate-global
```

### Full Test (Connection + Migration)

Tests the connection first, then runs migration:

```bash
npm run upgrade_db_test all
```

## Output Examples

### Successful Connection
```
========================================
  DB UPGRADE TEST SCRIPT
========================================

Mode: Connection Test Only
Testing connection to: my_test_db
URL (masked): mysql://admin:****@myserver.mysql.database.azure.com:3306/my_test_db
✅ Connection successful!
✅ Query test passed: [ { test: 1 } ]
```

### Successful Migration
```
Mode: Run Migration on Test DB
Running migration on: my_test_db
URL (masked): mysql://admin:****@myserver.mysql.database.azure.com:3306/my_test_db
Executing migration...
stdout: Prisma schema loaded from prisma/client/schema.prisma
...
✅ Successfully migrated my_test_db
```

## Security Notes

- The script masks passwords in console output
- Do not commit the file with real credentials
- Consider using environment variables for production testing

## Related Files

| File | Description |
|------|-------------|
| `src/script/db_upgrade.ts` | Production script that migrates all tenant databases |
| `src/db.ts` | Database connection utilities and tenant management |
| `prisma/client/schema.prisma` | Tenant database schema |
| `prisma/global-client/schema.prisma` | Global database schema |
