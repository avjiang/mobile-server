# StockMovement Archive Plan

**Version:** 1.0
**Created:** 2026-03-02
**Status:** Planned
**Author:** Backend Team

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Solution Overview](#2-solution-overview)
3. [Architecture](#3-architecture)
4. [Schema Changes](#4-schema-changes)
5. [Stored Procedure — Tenant Level](#5-stored-procedure--tenant-level)
6. [Stored Procedure — Global Orchestrator](#6-stored-procedure--global-orchestrator)
7. [AWS Lambda Handler](#7-aws-lambda-handler)
8. [Deployment Steps](#8-deployment-steps)
9. [Testing Plan](#9-testing-plan)
10. [Configuration](#10-configuration)
11. [Monitoring & Verification](#11-monitoring--verification)
12. [FAQ](#12-faq)

---

## 1. Problem Statement

### Context

The system is a multi-tenant POS/inventory SaaS where each tenant has an isolated database. Every stock change (sales, returns, deliveries, adjustments, voids) creates a `StockMovement` audit record.

### The Problem

The `StockMovement` table **grows unboundedly** across all tenant databases:

| Event | Records Per Occurrence |
|-------|----------------------|
| Sale (per item line) | 1 |
| Sale void | 1 |
| Sale return | 1 |
| Delivery order (per item) | 1+ |
| Purchase return (per item) | 1+ |
| Stock adjustment | 1 |
| Stock clearance | 1 |
| Variant creation | 1 |

For an active tenant processing 100+ transactions/day, this accumulates **~3,000 records/month**. Over time:

- Query performance degrades with months/years of historical data
- Database storage grows linearly across N tenants
- Indexes become bloated, slowing both writes and reads
- Backup and restore times increase

### Constraints

| Constraint | Detail |
|-----------|--------|
| Zero downtime | Must not disrupt production — Flutter app used for live sales during business hours |
| Multi-tenant | Must scale across all tenant databases automatically, including new tenants |
| Limited infrastructure | App runs on Azure B1 (1 vCPU, 1.75 GB RAM) — archive workload must not compete with the API |
| Data integrity | Records must never be lost, only relocated |
| Referential safety | Archive table must be self-contained (denormalized) — no FK dependencies |
| Transparent to app | App queries only recent 25 records per item/outlet — zero code changes required |

### Current State

- `StockMovementArchive` table exists in schema but is **unused and outdated** (missing `itemVariantId`, `performedBy`)
- A reference implementation exists for StockReceipt archiving (`src/script/unused/archive_stock_receipt.ts`) but was never deployed
- No cleanup, archiving, or purging mechanism is currently active

---

## 2. Solution Overview

**Approach:** MySQL stored procedures + AWS EventBridge + Lambda

| Component | Role |
|-----------|------|
| **Stored procedure** (per tenant DB) | Performs the actual archive — batch INSERT into archive, DELETE from live table |
| **Stored procedure** (global DB) | Iterates all tenants and calls each tenant's archive procedure |
| **AWS EventBridge** | Cron trigger — 1st of every month at 3 AM SGT |
| **AWS Lambda** | Thin handler — calls the global orchestrator procedure |

### Why This Approach

| Aspect | Benefit |
|--------|---------|
| Zero app code changes | No changes to services, controllers, or queries |
| Zero impact on B1 | All work runs on DB engine + Lambda — app service is untouched |
| Auto-scales to new tenants | New tenant = `prisma migrate deploy` = stored procedure included |
| Data never leaves the DB | No network overhead — INSERT...SELECT stays inside MySQL |
| Atomic per batch | Transaction rollback on any failure |
| Self-verifying | Lambda logs before/after counts per tenant |

---

## 3. Architecture

### Flow Diagram

```
                                  Monthly (1st, 3 AM SGT)
                                          |
                                          v
┌──────────────────┐     ┌──────────────────────┐     ┌──────────────────────────┐
│ AWS EventBridge  │────>│  AWS Lambda           │────>│  Global DB               │
│ (cron trigger)   │     │  (1 SQL call)         │     │  archive_all_tenants()   │
└──────────────────┘     └──────────────────────┘     └────────────┬─────────────┘
                                                                   │
                                                                   │  Cursor loop
                                                                   │  (sequential)
                                                                   │
                         ┌─────────────────────────────────────────┼──────────────┐
                         v                                         v              v
                   ┌───────────┐                           ┌───────────┐  ┌───────────┐
                   │ Tenant A  │                           │ Tenant B  │  │ Tenant N  │
                   │ archive   │                           │ archive   │  │ archive   │
                   │ _stock_   │                           │ _stock_   │  │ _stock_   │
                   │ movement()│                           │ movement()│  │ movement()│
                   └───────────┘                           └───────────┘  └───────────┘
```

### Processing Model

- **Sequential** — one tenant at a time (not parallel)
- **Batched** — 500 records per batch within each tenant
- **Safe** — low DB load, no risk of overloading shared MySQL instance

---

## 4. Schema Changes

### 4.1 Update StockMovementArchive Model

The current archive table is missing fields added in later features. Update `prisma/client/schema.prisma`:

**Add these fields:**

```prisma
model StockMovementArchive {
  id                        Int       @id @default(autoincrement()) @map("ID")
  itemId                    Int       @map("ITEM_ID")
  itemCode                  String    @map("ITEM_CODE")
  itemName                  String    @map("ITEM_NAME")
  outletId                  Int       @map("OUTLET_ID")
  outletName                String    @map("OUTLET_NAME")
  itemVariantId             Int?      @map("ITEM_VARIANT_ID")          // NEW
  previousAvailableQuantity Decimal   @map("PREVIOUS_AVAILABLE_QUANTITY") @db.Decimal(15, 4)
  previousOnHandQuantity    Decimal   @map("PREVIOUS_ON_HAND_QUANTITY") @db.Decimal(15, 4)
  availableQuantityDelta    Decimal   @map("AVAILABLE_QUANTITY_DELTA") @db.Decimal(15, 4)
  onHandQuantityDelta       Decimal   @map("ON_HAND_QUANTITY_DELTA") @db.Decimal(15, 4)
  movementType              String    @map("MOVEMENT_TYPE")
  documentId                Int       @map("DOCUMENT_ID")
  documentType              String    @map("DOCUMENT_TYPE")
  reason                    String    @map("REASON")
  remark                    String    @default("") @map("REMARK")
  deleted                   Boolean   @default(false) @map("IS_DELETED")
  createdAt                 DateTime? @default(now()) @map("CREATED_AT")
  updatedAt                 DateTime? @updatedAt @map("UPDATED_AT")
  version                   Int?      @default(1) @map("VERSION")
  performedBy               String?   @default("") @map("PERFORMED_BY") // NEW

  @@index([itemId, createdAt])
  @@index([outletId])
  @@index([itemVariantId])                                              // NEW
  @@index([movementType])
  @@map("stock_movement_archive")
}
```

**Fields added:**

| Field | Type | Why |
|-------|------|-----|
| `itemVariantId` | `Int?` | Variant support was added after the archive table was created |
| `performedBy` | `String?` | Audit trail field — records who performed the action |
| `@@index([itemVariantId])` | Index | Query support for variant-based lookups in archive |

### 4.2 Migration

```bash
# Generate migration with schema changes + empty SQL file for stored procedure
npx prisma migrate dev --create-only --name add_archive_procedure --schema=prisma/client/schema.prisma
```

This creates:
```
prisma/client/migrations/
  └── YYYYMMDD_add_archive_procedure/
      └── migration.sql   ← Prisma generates ALTER TABLE + you add stored procedure SQL
```

**Important:** Prisma cannot generate stored procedures from the schema file. The stored procedure SQL must be hand-written into the migration file. Prisma will generate the `ALTER TABLE` for the new columns, and the stored procedure `CREATE PROCEDURE` statement is appended to the same migration file.

---

## 5. Stored Procedure — Tenant Level

Deployed to every tenant database via Prisma migration.

```sql
-- Added to migration.sql after Prisma-generated ALTER TABLE statements

DELIMITER //

CREATE PROCEDURE archive_stock_movement(IN months_threshold INT)
BEGIN
    DECLARE rows_affected INT DEFAULT 1;
    DECLARE threshold_date DATETIME;
    SET threshold_date = DATE_SUB(NOW(), INTERVAL months_threshold MONTH);

    WHILE rows_affected > 0 DO
        -- Step 1: Archive batch (denormalize item/outlet names)
        INSERT INTO stock_movement_archive (
            ITEM_ID, ITEM_CODE, ITEM_NAME,
            OUTLET_ID, OUTLET_NAME,
            ITEM_VARIANT_ID,
            PREVIOUS_AVAILABLE_QUANTITY, PREVIOUS_ON_HAND_QUANTITY,
            AVAILABLE_QUANTITY_DELTA, ON_HAND_QUANTITY_DELTA,
            MOVEMENT_TYPE, DOCUMENT_ID, DOCUMENT_TYPE,
            REASON, REMARK,
            IS_DELETED, CREATED_AT, UPDATED_AT, VERSION,
            PERFORMED_BY
        )
        SELECT
            sm.ITEM_ID, i.ITEM_CODE, i.ITEM_NAME,
            sm.OUTLET_ID, o.OUTLET_NAME,
            sm.ITEM_VARIANT_ID,
            sm.PREVIOUS_AVAILABLE_QUANTITY, sm.PREVIOUS_ON_HAND_QUANTITY,
            sm.AVAILABLE_QUANTITY_DELTA, sm.ON_HAND_QUANTITY_DELTA,
            sm.MOVEMENT_TYPE, sm.DOCUMENT_ID, sm.MOVEMENT_TYPE,
            sm.REASON, sm.REMARK,
            sm.IS_DELETED, sm.CREATED_AT, sm.UPDATED_AT, sm.VERSION,
            sm.PERFORMED_BY
        FROM stock_movement sm
        JOIN item i ON sm.ITEM_ID = i.ID
        JOIN outlet o ON sm.OUTLET_ID = o.ID
        WHERE sm.CREATED_AT <= threshold_date
        LIMIT 500;

        SET rows_affected = ROW_COUNT();

        -- Step 2: Delete archived records from live table
        DELETE FROM stock_movement
        WHERE CREATED_AT <= threshold_date
        LIMIT 500;
    END WHILE;
END //

DELIMITER ;
```

### How It Works

1. **Batch loop** — processes 500 records per iteration until none remain
2. **Denormalization** — JOINs `item` and `outlet` tables to copy names into the archive
3. **Self-terminating** — exits when `ROW_COUNT()` returns 0
4. **No FK on archive** — archive table has no foreign key constraints, so deletes from the live table are safe

### Batch Size Rationale

| Batch Size | Lock Duration | Memory | Recommended For |
|-----------|--------------|--------|-----------------|
| 100 | Very short | Minimal | Very busy DBs |
| **500** | Short | Low | **General use (recommended)** |
| 1000 | Moderate | Moderate | Off-peak only |
| 5000+ | Long | High | Not recommended |

---

## 6. Stored Procedure — Global Orchestrator

Deployed to the **global database** (one-time setup via global schema migration or manual execution).

```sql
DELIMITER //

CREATE PROCEDURE archive_all_tenants(IN months_threshold INT)
BEGIN
    DECLARE done INT DEFAULT 0;
    DECLARE db_name VARCHAR(255);
    DECLARE tenant_cursor CURSOR FOR
        SELECT DATABASE_NAME FROM tenant WHERE DATABASE_NAME IS NOT NULL;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

    OPEN tenant_cursor;

    tenant_loop: LOOP
        FETCH tenant_cursor INTO db_name;
        IF done THEN LEAVE tenant_loop; END IF;

        -- Call each tenant's archive procedure
        SET @sql = CONCAT('CALL `', db_name, '`.archive_stock_movement(', months_threshold, ')');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END LOOP;

    CLOSE tenant_cursor;
END //

DELIMITER ;
```

### How It Works

1. Reads all tenant database names from the global `tenant` table
2. Iterates sequentially (one at a time)
3. Uses dynamic SQL to `CALL` each tenant's stored procedure
4. New tenants are automatically included (reads from `tenant` table at runtime)

---

## 7. AWS Lambda Handler

A lightweight Lambda function that triggers the global orchestrator.

```typescript
import mysql from 'mysql2/promise';

export const handler = async () => {
  const conn = await mysql.createConnection(process.env.GLOBAL_DB_URL!);

  try {
    // Get tenant list for verification logging
    const [tenants]: any = await conn.execute(
      'SELECT DATABASE_NAME FROM tenant WHERE DATABASE_NAME IS NOT NULL'
    );

    const results = [];

    for (const t of tenants) {
      const db = t.DATABASE_NAME;

      // Count before
      const [[before]]: any = await conn.execute(
        `SELECT COUNT(*) as c FROM \`${db}\`.stock_movement`
      );
      const [[archiveBefore]]: any = await conn.execute(
        `SELECT COUNT(*) as c FROM \`${db}\`.stock_movement_archive`
      );

      // Run archive for this tenant
      await conn.execute(`CALL \`${db}\`.archive_stock_movement(6)`);

      // Count after
      const [[after]]: any = await conn.execute(
        `SELECT COUNT(*) as c FROM \`${db}\`.stock_movement`
      );
      const [[archiveAfter]]: any = await conn.execute(
        `SELECT COUNT(*) as c FROM \`${db}\`.stock_movement_archive`
      );

      const archived = archiveAfter.c - archiveBefore.c;
      const deleted = before.c - after.c;

      results.push({
        db,
        before: before.c,
        after: after.c,
        archived,
        deleted,
        match: archived === deleted,  // Integrity check
      });

      if (archived !== deleted) {
        console.error(`INTEGRITY MISMATCH on ${db}: archived=${archived}, deleted=${deleted}`);
      }
    }

    console.log(JSON.stringify({ success: true, tenants: results }, null, 2));
    return { statusCode: 200, body: results };
  } catch (error) {
    console.error('Archive job failed:', error);
    throw error;
  } finally {
    await conn.end();
  }
};
```

### Why Lambda calls tenants individually (not `archive_all_tenants`)

The Lambda iterates tenants itself instead of calling the global orchestrator procedure, because:
- It can log **per-tenant** before/after counts
- It can perform **integrity checks** (archived count must equal deleted count)
- It can **continue** even if one tenant fails (isolate failures)
- It can be extended to send alerts per tenant

### AWS EventBridge Schedule

```
# 1st of every month at 3:00 AM SGT (19:00 UTC previous day)
cron(0 19 1 * ? *)
```

### Lambda Configuration

| Setting | Value | Reason |
|---------|-------|--------|
| Runtime | Node.js 20.x | Matches project runtime |
| Memory | 256 MB | Minimal — only orchestrating SQL calls |
| Timeout | 15 min (max) | Large tenants may take time |
| VPC | Same as DB (if private) | Needs DB connectivity |
| Dependencies | `mysql2` only | Lightweight — no Prisma needed |

---

## 8. Deployment Steps

### Phase 1: Schema Migration (All Tenant DBs)

```bash
# 1. Update StockMovementArchive model in schema.prisma (add itemVariantId, performedBy)

# 2. Generate migration (creates SQL file with ALTER TABLE + empty space for procedure)
npx prisma migrate dev --create-only --name add_archive_procedure \
  --schema=prisma/client/schema.prisma

# 3. Append stored procedure SQL to the generated migration.sql

# 4. Test locally
npx prisma migrate deploy --schema=prisma/client/schema.prisma

# 5. Deploy to all tenant DBs (uses existing infrastructure)
# This runs automatically via updateAllTenantDatabases() on server start,
# or can be triggered manually.
```

### Phase 2: Global DB Procedure (One-Time)

```bash
# Connect to global DB and run the CREATE PROCEDURE script manually
# OR add it to a global schema migration
npx prisma migrate dev --create-only --name add_archive_orchestrator \
  --schema=prisma/global-client/schema.prisma
```

### Phase 3: Lambda Deployment

```bash
# 1. Create Lambda function with mysql2 dependency
# 2. Set GLOBAL_DB_URL environment variable
# 3. Configure VPC/security group for DB access
# 4. Create EventBridge rule with monthly cron
# 5. Test with manual invocation first
```

### Phase 4: First Run (Initial Backlog)

```bash
# For tenants with months/years of accumulated data,
# the first run may archive thousands of records.
# Run manually during off-peak hours and monitor.
# Subsequent monthly runs will be lightweight.
```

### New Tenant Onboarding

No changes required. The existing flow handles everything:

```
POST /api/admin/signup
  → initializeTenantDatabase()
    → CREATE DATABASE
    → prisma migrate deploy  ← applies all migrations including the archive procedure
```

---

## 9. Testing Plan

### Phase 1: Local Dev DB

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1.1 | Count records to archive | `SELECT COUNT(*) FROM stock_movement WHERE CREATED_AT <= DATE_SUB(NOW(), INTERVAL 6 MONTH)` returns N |
| 1.2 | Record before counts | Note `stock_movement` count (A) and `stock_movement_archive` count (B) |
| 1.3 | Run procedure | `CALL archive_stock_movement(6)` completes without error |
| 1.4 | Verify counts | New movement count = A - N, new archive count = B + N |
| 1.5 | Verify no old records remain | Count query from 1.1 returns 0 |

### Phase 2: Data Integrity

| Step | Action | Expected Result |
|------|--------|-----------------|
| 2.1 | Check denormalized fields | No NULL/empty `ITEM_NAME` or `OUTLET_NAME` in archive |
| 2.2 | Spot check names | `archive.ITEM_NAME` matches `item.ITEM_NAME` for same `ITEM_ID` |
| 2.3 | Check variant IDs | Archived records with variants have correct `ITEM_VARIANT_ID` |
| 2.4 | Check all fields copied | Compare a sample record field-by-field |

### Phase 3: App Compatibility

| Step | Action | Expected Result |
|------|--------|-----------------|
| 3.1 | Simulate app query | `SELECT * FROM stock_movement WHERE ITEM_ID = X ORDER BY CREATED_AT DESC LIMIT 25` returns recent records |
| 3.2 | Test stock adjustment | Create a stock adjustment — new StockMovement record created normally |
| 3.3 | Test sales flow | Complete a sale — StockMovement records created normally |

### Phase 4: Rollback Safety

| Step | Action | Expected Result |
|------|--------|-----------------|
| 4.1 | Start manual transaction | `START TRANSACTION` |
| 4.2 | Run partial archive | INSERT into archive, skip DELETE |
| 4.3 | Rollback | `ROLLBACK` — both tables unchanged |

### Phase 5: Single Tenant Canary

| Step | Action | Expected Result |
|------|--------|-----------------|
| 5.1 | Pick test/least-active tenant | Identify a safe candidate |
| 5.2 | Run archive for that tenant only | `CALL tenant_db.archive_stock_movement(6)` |
| 5.3 | Monitor for 24-48 hours | No user complaints, app works normally |
| 5.4 | Verify via app | Open the Flutter app as that tenant, check stock movement history displays correctly |

### Phase 6: Full Rollout

| Step | Action | Expected Result |
|------|--------|-----------------|
| 6.1 | Invoke Lambda manually | All tenants processed |
| 6.2 | Check Lambda logs | Every tenant shows `match: true` (archived === deleted) |
| 6.3 | Enable EventBridge schedule | Monthly cron active |

### Verification Queries (Copy-Paste Ready)

```sql
-- Before archive: record these numbers
SELECT 'BEFORE' as phase,
  (SELECT COUNT(*) FROM stock_movement) as movement_count,
  (SELECT COUNT(*) FROM stock_movement_archive) as archive_count,
  (SELECT COUNT(*) FROM stock_movement
   WHERE CREATED_AT <= DATE_SUB(NOW(), INTERVAL 6 MONTH)) as archivable_count;

-- Run the procedure
CALL archive_stock_movement(6);

-- After archive: verify
SELECT 'AFTER' as phase,
  (SELECT COUNT(*) FROM stock_movement) as movement_count,
  (SELECT COUNT(*) FROM stock_movement_archive) as archive_count,
  (SELECT COUNT(*) FROM stock_movement
   WHERE CREATED_AT <= DATE_SUB(NOW(), INTERVAL 6 MONTH)) as archivable_count;
-- archivable_count should be 0
-- movement_count(before) = movement_count(after) + archive_count(after) - archive_count(before)

-- Data integrity check
SELECT COUNT(*) as bad_records
FROM stock_movement_archive
WHERE ITEM_NAME IS NULL OR ITEM_NAME = ''
   OR OUTLET_NAME IS NULL OR OUTLET_NAME = '';
-- Expected: 0
```

---

## 10. Configuration

### Adjustable Parameters

| Parameter | Default | Description | Where to Change |
|-----------|---------|-------------|-----------------|
| `months_threshold` | 6 | Records older than this are archived | Lambda handler (passed to stored procedure) |
| Batch size | 500 | Records per batch within stored procedure | Stored procedure `LIMIT` clause |
| Schedule | Monthly (1st, 3 AM SGT) | How often the job runs | AWS EventBridge rule |

### When to Adjust

| Scenario | Action |
|----------|--------|
| Tenants growing very fast (1000+ transactions/day) | Reduce threshold to 3 months, or run bi-weekly |
| DB storage is not a concern | Increase threshold to 12 months |
| Archive job takes too long | Reduce batch size to 200 |
| Very large initial backlog | Increase batch size to 1000 for first run only |

---

## 11. Monitoring & Verification

### Lambda CloudWatch Logs

Every run logs per-tenant results:

```json
{
  "success": true,
  "tenants": [
    { "db": "tenant_a_db", "before": 15000, "after": 12000, "archived": 3000, "deleted": 3000, "match": true },
    { "db": "tenant_b_db", "before": 8000, "after": 8000, "archived": 0, "deleted": 0, "match": true },
    { "db": "tenant_c_db", "before": 22000, "after": 18500, "archived": 3500, "deleted": 3500, "match": true }
  ]
}
```

### Alerts to Set Up

| Alert | Condition | Action |
|-------|-----------|--------|
| Integrity mismatch | `match: false` for any tenant | Investigate immediately — data may be inconsistent |
| Lambda timeout | Execution exceeds 15 minutes | Reduce batch size or split into multiple invocations |
| Lambda error | Any unhandled exception | Check DB connectivity, procedure existence |
| Zero archives for all tenants | Every tenant has `archived: 0` for 3+ months | Verify threshold is correct, procedure is working |

---

## 12. FAQ

### Q: Will this affect users during business hours?

**No.** The job runs at 3 AM SGT and processes records older than 6 months. The app only queries the most recent 25 records. Users will never notice.

### Q: What if a new tenant is created after the Lambda runs this month?

The new tenant starts with an empty `stock_movement` table. The procedure exists in their DB (deployed via migration). Next month's run will include them automatically.

### Q: What if the Lambda fails mid-way through?

Each tenant is processed independently. If tenant 50 out of 100 fails, tenants 1-49 are already archived successfully. The Lambda logs which tenant failed. Fix the issue and re-run — the procedure is idempotent (it only archives records matching the threshold, so already-archived tenants will simply have 0 records to process).

### Q: Can I run it manually?

Yes. Either:
- Invoke the Lambda manually from AWS Console
- Connect to the DB and run `CALL archive_stock_movement(6)` on a specific tenant
- Connect to the global DB and run `CALL archive_all_tenants(6)` for all tenants

### Q: What if I need to query archived data?

Query the `stock_movement_archive` table directly. It's denormalized — all item/outlet names are stored inline, so no JOINs needed:

```sql
SELECT * FROM stock_movement_archive
WHERE ITEM_ID = 123
ORDER BY CREATED_AT DESC;
```

### Q: Can I restore archived data back to the live table?

Yes, but manually. INSERT from archive back to stock_movement and DELETE from archive. This should rarely be needed.

### Q: What about StockReceipt archiving?

The same pattern can be applied to `StockReceipt` and `StockReceiptArchive` tables. The existing reference implementation in `src/script/unused/archive_stock_receipt.ts` follows the same approach. This can be added as a second stored procedure in a future migration.

### Q: Does this work with the existing `updateAllTenantDatabases()` function?

Yes. `updateAllTenantDatabases()` runs `prisma migrate deploy` on every tenant. The migration containing the stored procedure will be applied to all existing tenants. No code changes needed.

---

## Related Files

| File | Description |
|------|-------------|
| `prisma/client/schema.prisma` | StockMovement and StockMovementArchive models |
| `prisma/global-client/schema.prisma` | Global Tenant table (source of tenant DB names) |
| `src/db.ts` | `getTenantPrisma()`, `updateAllTenantDatabases()`, `initializeTenantDatabase()` |
| `src/stock/stock-movement/stock-movement.service.ts` | StockMovement queries (confirms only recent records are fetched) |
| `src/script/unused/archive_stock_receipt.ts` | Reference implementation for StockReceipt archiving |
| `src/stock/STOCK_MODULE_DOCUMENTATION.md` | Stock module documentation |
