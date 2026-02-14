# Settings Feature - Backend Documentation

## Overview

The Settings feature provides a flexible, multi-scope configuration system that allows different settings to be configured at **Tenant**, **Outlet**, or **User** levels without requiring database migrations when adding new settings.

### Key Features

- **No tenant DB migrations** when adding new settings
- **Multi-scope support** (TENANT, OUTLET, USER)
- **Delta sync** for efficient client synchronization
- **Type validation** (INT, DOUBLE, STRING, BOOLEAN, JSON)
- **Custom validation rules** (min/max, options, regex patterns)
- **Default values** with fallback support
- **Batch update support** for efficient updates

---

## Architecture

### Two-Database Design

The settings system uses a **dual-database architecture**:

1. **Global Database** - Stores setting definitions (schema)
2. **Tenant Databases** - Stores actual setting values (data)

This separation ensures:
- Setting definitions are shared across all tenants
- No tenant database migrations needed when adding new settings
- Centralized definition management

---

## Database Schema

### Global Database: `setting_definition` Table

Stores the **definition/schema** for all settings.

| Field | Type | Description |
|-------|------|-------------|
| `ID` | INT | Primary key |
| `KEY` | STRING | Unique setting identifier (e.g., "default_currency") |
| `CATEGORY` | STRING | Grouping (e.g., "Financial", "POS", "User Preference") |
| `TYPE` | STRING | Data type: "INT", "DOUBLE", "STRING", "BOOLEAN", "JSON" |
| `DEFAULT_VALUE` | STRING | Default value if not customized |
| `DESCRIPTION` | STRING | Human-readable description |
| `SCOPE` | STRING | Where it applies: "TENANT", "OUTLET", "USER" |
| `IS_REQUIRED` | BOOLEAN | Whether setting must have a value |
| `IS_READ_ONLY` | BOOLEAN | Whether setting cannot be modified by users (default: false) |
| `VALIDATION_RULES` | TEXT (JSON) | Validation rules: `{min, max, options, pattern}` |
| `VERSION` | INT | For versioning and cache invalidation |
| `CREATED_AT` | DATETIME | Creation timestamp |
| `UPDATED_AT` | DATETIME | Last update timestamp |
| `IS_DELETED` | BOOLEAN | Soft delete flag |
| `DELETED_AT` | DATETIME | Deletion timestamp |

**Prisma Model:**
```prisma
model SettingDefinition {
  id              Int       @id @default(autoincrement()) @map("ID")
  key             String    @unique @map("KEY")
  category        String    @map("CATEGORY")
  type            String    @map("TYPE")
  defaultValue    String?   @map("DEFAULT_VALUE")
  description     String?   @map("DESCRIPTION")
  scope           String    @map("SCOPE")
  isRequired      Boolean   @default(false) @map("IS_REQUIRED")
  isReadOnly      Boolean   @default(false) @map("IS_READ_ONLY")
  validationRules String?   @db.Text @map("VALIDATION_RULES")
  createdAt       DateTime  @default(now()) @map("CREATED_AT")
  updatedAt       DateTime  @updatedAt @map("UPDATED_AT")
  deleted         Boolean   @default(false) @map("IS_DELETED")
  deletedAt       DateTime? @map("DELETED_AT")
  version         Int       @default(1) @map("VERSION")

  @@index([category])
  @@index([scope])
  @@map("setting_definition")
}
```

**Example Record:**
```json
{
  "ID": 1,
  "KEY": "default_currency",
  "CATEGORY": "Financial",
  "TYPE": "STRING",
  "DEFAULT_VALUE": "IDR",
  "SCOPE": "OUTLET",
  "DESCRIPTION": "Default currency for transactions",
  "IS_REQUIRED": false,
  "IS_READ_ONLY": false,
  "VALIDATION_RULES": "{\"options\": [\"IDR\", \"USD\", \"SGD\"]}"
}
```

---

### Tenant Database: `setting` Table

Stores the **actual values** for settings, scoped to tenant/outlet/user.

| Field | Type | Description |
|-------|------|-------------|
| `ID` | INT | Primary key |
| `SETTING_DEFINITION_ID` | INT | References `setting_definition.ID` (no FK) |
| `TENANT_ID` | INT | Tenant scope (nullable) |
| `OUTLET_ID` | INT | Outlet scope (nullable) |
| `USER_ID` | INT | User scope (nullable) |
| `VALUE` | STRING | The actual setting value |
| `VERSION` | INT | For optimistic locking |
| `CREATED_AT` | DATETIME | Creation timestamp |
| `UPDATED_AT` | DATETIME | Last update timestamp |
| `IS_DELETED` | BOOLEAN | Soft delete flag |
| `DELETED_AT` | DATETIME | Deletion timestamp |

**Prisma Model:**
```prisma
model Setting {
  id                  Int       @id @default(autoincrement()) @map("ID")
  settingDefinitionId Int       @map("SETTING_DEFINITION_ID")
  tenantId            Int?      @map("TENANT_ID")
  userId              Int?      @map("USER_ID")
  outletId            Int?      @map("OUTLET_ID")
  value               String    @map("VALUE")
  deleted             Boolean   @default(false) @map("IS_DELETED")
  deletedAt           DateTime? @map("DELETED_AT")
  createdAt           DateTime? @default(now()) @map("CREATED_AT")
  updatedAt           DateTime? @updatedAt @map("UPDATED_AT")
  version             Int?      @default(1) @map("VERSION")
  user                User?     @relation(fields: [userId], references: [id])
  outlet              Outlet?   @relation(fields: [outletId], references: [id])

  @@unique([settingDefinitionId, tenantId, userId, outletId])
  @@index([settingDefinitionId])
  @@map("setting")
}
```

**Example Record:**
```json
{
  "ID": 42,
  "SETTING_DEFINITION_ID": 1,
  "TENANT_ID": 100,
  "OUTLET_ID": 5,
  "USER_ID": null,
  "VALUE": "USD"
}
```

**Unique Constraint:** `[SETTING_DEFINITION_ID, TENANT_ID, OUTLET_ID, USER_ID]`

This ensures one value per setting per scope combination.

---

### Validation Rules Reference

The `VALIDATION_RULES` column stores JSON-formatted validation constraints.

#### Available Rule Types

1. **`options`** - Allowed values list (for dropdowns)
   ```json
   {"options": ["IDR", "USD", "SGD", "MYR", "THB"]}
   ```
   - Value must be one of the listed options
   - Used for: currencies, languages, themes, layouts

2. **`min` / `max`** - Numeric range (for numbers)
   ```json
   {"min": 0, "max": 100}
   ```
   - Value must be within the specified range
   - Works for INT and DOUBLE types
   - Used for: percentages, quantities, thresholds

3. **`pattern`** - Regex validation (for text patterns)
   ```json
   {"pattern": "^[A-Z]{2,5}$"}
   ```
   - Value must match the regular expression
   - Used for: codes, prefixes, formatted text

4. **No rules** - Set to `NULL` if no validation needed
   - Any value of the specified TYPE is accepted

#### Validation Examples

| Setting | Type | Validation Rules | What It Validates |
|---------|------|-----------------|-------------------|
| `default_currency` | STRING | `{"options":["IDR","USD","SGD"]}` | Must be IDR, USD, or SGD |
| `tax_rate` | DOUBLE | `{"min":0,"max":100}` | Must be between 0-100 (decimals allowed) |
| `receipt_copies` | INT | `{"min":1,"max":5}` | Must be between 1-5 (whole numbers only) |
| `invoice_prefix` | STRING | `{"pattern":"^[A-Z]{2,5}$"}` | 2-5 uppercase letters only |
| `tax_inclusive` | BOOLEAN | `null` | No additional validation |

---

### Setting Scopes

| Scope | Description | Example Use Cases | Required Parameters |
|-------|-------------|-------------------|---------------------|
| **TENANT** | Company-wide setting | Company name, invoice prefix, payment terms | `tenantId` (auto-filled from auth) |
| **OUTLET** | Store/location-specific | Currency, tax rate, POS settings | `outletId` |
| **USER** | Individual user preference | Language, theme, date format | `userId` |

**Important:** The scope is defined in the setting definition, not in the request. The API automatically applies settings to the correct scope.

---

### Read-Only Settings

The `isReadOnly` field allows you to mark certain settings as **read-only**, preventing users from modifying them through the API.

**Use Cases:**
- **System-managed settings**: Settings that should only be changed by system administrators or automated processes
- **Calculated values**: Settings derived from other data that shouldn't be manually edited
- **License restrictions**: Settings controlled by subscription plan or license type
- **Safety-critical settings**: Configuration that could break functionality if incorrectly modified

**Example:**
```json
{
  "key": "subscription_plan",
  "category": "System",
  "type": "STRING",
  "defaultValue": "Free",
  "scope": "TENANT",
  "isReadOnly": true,
  "description": "Current subscription plan (managed by billing system)"
}
```

**Behavior:**
- Read-only settings can be retrieved via `GET /settings/sync`
- Attempts to update read-only settings via `PUT /settings/batchUpdate` will be **rejected with validation error**
- Only system-level operations (direct database access or admin tools) can modify read-only settings
- Clients should disable UI controls for read-only settings

**Note:** The backend currently returns all settings including read-only ones. Enforcement of read-only constraints should be implemented in the service layer if needed.

---

## Predefined Setting Definitions

These settings are seeded via [setting_definitions_seed.ts](../script/setting_definitions_seed.ts). Settings marked as **commented** are defined in the seed file but not currently active.

### Financial Settings

| Key | Type | Default | Scope | Required | Validation Rules | Status |
|-----|------|---------|-------|----------|-----------------|--------|
| `default_currency` | STRING | `IDR` | OUTLET | Yes | Options: `IDR`, `USD`, `SGD`, `MYR`, `THB`, `EUR`, `AUD` | Commented |
| `tax_rate` | DOUBLE | `11` | OUTLET | Yes | Min: 0, Max: 100 | **Active** |
| `tax_inclusive` | BOOLEAN | `true` | OUTLET | No | - | Commented |
| `enable_discount` | BOOLEAN | `true` | OUTLET | No | - | Commented |
| `payment_terms` | INT | `30` | TENANT | No | Min: 0, Max: 365 | Commented |

### POS Settings

| Key | Type | Default | Scope | Required | Validation Rules | Status |
|-----|------|---------|-------|----------|-----------------|--------|
| `auto_print_receipt` | BOOLEAN | `true` | OUTLET | No | - | **Active** |
| `receipt_copies` | INT | `1` | OUTLET | No | Min: 1, Max: 5 | **Active** |
| `enable_barcode_scanner` | BOOLEAN | `true` | OUTLET | No | - | Commented |
| `pos_layout` | STRING | `grid` | USER | No | Options: `grid`, `list`, `compact` | Commented |

### Inventory Settings

| Key | Type | Default | Scope | Required | Validation Rules | Status |
|-----|------|---------|-------|----------|-----------------|--------|
| `low_stock_threshold` | INT | `10` | OUTLET | No | Min: 0, Max: 1000 | **Active** |
| `enable_stock_alert` | BOOLEAN | `true` | OUTLET | No | - | Commented |
| `auto_reorder` | BOOLEAN | `false` | OUTLET | No | - | Commented |

### User Preference Settings

| Key | Type | Default | Scope | Required | Validation Rules | Status |
|-----|------|---------|-------|----------|-----------------|--------|
| `language` | STRING | `en` | USER | No | Options: `en`, `id` | **Active** |
| `theme` | STRING | `light` | USER | No | Options: `light`, `dark`, `auto` | Commented |
| `notifications_enabled` | BOOLEAN | `true` | USER | No | - | Commented |
| `date_format` | STRING | `DD/MM/YYYY` | USER | No | Options: `DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD` | **Active** |

### System Settings

| Key | Type | Default | Scope | Required | Validation Rules | Status |
|-----|------|---------|-------|----------|-----------------|--------|
| `company_name` | STRING | `My Company` | TENANT | Yes | - | **Active** |
| `receipt_footer` | STRING | `Thank you for your business!` | TENANT | No | - | **Active** |
| `invoice_prefix` | STRING | `INV` | TENANT | No | Pattern: `^[A-Z]{2,5}$` | Commented |

### Summary

- **Active settings:** 8 (seeded into the global database)
- **Commented settings:** 11 (defined but not currently seeded)
- **By scope:** TENANT (3), OUTLET (9), USER (7)
- **By category:** Financial (5), POS (4), Inventory (3), User Preference (4), System (3)

---

## API Endpoints

### 1. GET `/settings/sync` - Sync All Settings

Fetch all settings with delta sync support for efficient synchronization.

**Authentication:** Required (Bearer token)

**Query Parameters:**
- `lastSyncTimestamp` (optional, string): ISO timestamp for delta sync. Use `null` or omit for initial sync
- `outletId` (optional, number): Filter by outlet
- `userId` (optional, number): Filter by user
- `skip` (optional, number): Pagination offset (default: 0)
- `take` (optional, number): Pagination limit (default: 100)

**Response:**
```json
{
  "data": [
    {
      "id": 42,
      "settingDefinitionId": 1,
      "tenantId": 100,
      "outletId": 5,
      "userId": null,
      "value": "USD",
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-15T10:00:00Z",
      "version": 1,
      "deleted": false,
      "deletedAt": null
    }
  ],
  "total": 1,
  "serverTimestamp": "2025-01-15T12:00:00Z"
}
```

**Initial Sync Example:**
```bash
GET /settings/sync?lastSyncTimestamp=null
```
Returns all settings changed since epoch (all settings).

**Delta Sync Example:**
```bash
GET /settings/sync?lastSyncTimestamp=2025-01-15T10:00:00Z
```
Returns only settings created/updated/deleted since the timestamp.

**Filter Examples:**
```bash
# Get all outlet settings for outlet 5
GET /settings/sync?outletId=5

# Get all user settings for user 42
GET /settings/sync?userId=42

# Get recent changes for outlet 5
GET /settings/sync?outletId=5&lastSyncTimestamp=2025-01-15T10:00:00Z
```

---

### 2. GET `/settings/definition/sync` - Sync Setting Definitions

Fetch all setting definitions with delta sync support.

**Authentication:** Required (Bearer token)

**Query Parameters:**
- `lastSyncTimestamp` (optional, string): ISO timestamp for delta sync
- `skip` (optional, number): Pagination offset (default: 0)
- `take` (optional, number): Pagination limit (default: 100)

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "key": "default_currency",
      "category": "Financial",
      "type": "STRING",
      "defaultValue": "IDR",
      "scope": "OUTLET",
      "description": "Default currency for transactions",
      "validationRules": "{\"options\": [\"IDR\", \"USD\", \"SGD\"]}",
      "isRequired": false,
      "isReadOnly": false,
      "version": 1,
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-15T10:00:00Z",
      "deleted": false,
      "deletedAt": null
    }
  ],
  "total": 1,
  "serverTimestamp": "2025-01-15T12:00:00Z"
}
```

---

### 3. PUT `/settings/batchUpdate` - Batch Update Settings

Update or create multiple settings in a single request.

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "settings": [
    {
      "id": 42,
      "value": "USD"
    },
    {
      "settingDefinitionId": 2,
      "value": "10.5",
      "outletId": 5
    }
  ]
}
```

**Request Schema:**
- `settings` (array, required): Array of setting updates
  - `id` (number, optional): Setting ID for updates. If provided, updates existing setting. If null/omitted, the backend will **upsert by scope** — matching on `[settingDefinitionId, tenantId, userId, outletId]` to find an existing record before creating a new one.
  - `settingDefinitionId` (number, required when `id` is null): Definition ID when creating/upserting a setting
  - `value` (string, required): The new value
  - `outletId` (number, optional): Required if setting scope is OUTLET and creating new
  - `userId` (number, optional): Required if setting scope is USER and creating new
  - `tenantId` (number, optional): Tenant ID (usually auto-filled from auth)

> **Note:** Clients should persist and send back the `id` returned from previous responses for optimal performance. The upsert-by-scope is a defensive fallback to prevent duplicate records when `id` is not available.

**Response:**
```json
{
  "data": [
    {
      "id": 42,
      "settingDefinitionId": 1,
      "tenantId": 100,
      "outletId": 5,
      "userId": null,
      "value": "USD",
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-15T12:00:00Z",
      "version": 2,
      "deleted": false,
      "deletedAt": null
    }
  ],
  "serverTimestamp": "2025-01-15T12:00:00Z"
}
```

**Validation:**
- Type validation (e.g., INT must be a number, DOUBLE allows decimals)
- Custom rules (e.g., options, min/max, regex)
- Scope validation (e.g., OUTLET settings require `outletId` for new settings)

**Error Examples:**
```json
{
  "error": "Value must be one of: IDR, USD, SGD for setting 'default_currency'"
}
```

```json
{
  "error": "Value must be at least 0 for setting 'tax_rate'"
}
```

```json
{
  "error": "settingDefinitionId is required when creating new settings"
}
```

---

## Service Layer

### File Structure

```
src/settings/
├── settings.request.ts      # TypeScript interfaces
├── settings.service.ts       # Business logic
└── settings.controller.ts    # API routes
```

### Service Functions

#### `getAllSettings(databaseName, tenantId, request)`

Fetches settings with delta sync support.

**Parameters:**
- `databaseName` (string): Tenant database name
- `tenantId` (number): Tenant ID
- `request` (SyncSettingsRequest): Request parameters

**Returns:**
```typescript
Promise<{
  settings: Setting[];
  total: number;
  serverTimestamp: string;
}>
```

**Logic:**
1. Parse `lastSyncTimestamp` (defaults to epoch if not provided)
2. Build query with OR conditions:
   - `createdAt >= lastSync`
   - `updatedAt >= lastSync`
   - `deletedAt >= lastSync` (includes soft-deleted items)
3. Apply optional filters (outletId, userId)
4. Count total matching records
5. Fetch paginated results ordered by updatedAt DESC

---

#### `getAllSettingDefinitions(lastSyncTimestamp, skip, take)`

Fetches setting definitions with delta sync support.

**Parameters:**
- `lastSyncTimestamp` (string, optional): ISO timestamp
- `skip` (number): Pagination offset
- `take` (number): Pagination limit

**Returns:**
```typescript
Promise<{
  definitions: SettingDefinition[];
  total: number;
  serverTimestamp: string;
}>
```

**Logic:**
1. Parse `lastSyncTimestamp` (defaults to epoch if not provided)
2. Build query with OR conditions (same as settings)
3. Count total matching records
4. Fetch paginated results ordered by updatedAt DESC

---

#### `batchUpdateSettings(databaseName, tenantId, updates)`

Batch update or create settings with validation.

**Parameters:**
- `databaseName` (string): Tenant database name
- `tenantId` (number): Tenant ID
- `updates` (UpdateSettingRequest[]): Array of setting updates

**Returns:**
```typescript
Promise<{
  updated: Setting[];
  serverTimestamp: string;
}>
```

**Logic:**
1. **Separate updates:**
   - Existing settings (have `id`)
   - New settings (no `id` or `id` is null)

2. **Validate new settings:**
   - Must have `settingDefinitionId`

3. **Bulk fetch definitions:**
   - Extract definition IDs from existing settings
   - Extract definition IDs from new settings
   - Fetch all definitions in one query
   - Create definition map for fast lookup

4. **Bulk fetch existing settings:**
   - Fetch all settings by IDs in one query
   - Verify all settings exist
   - Create settings map for fast lookup

5. **Validate all updates:**
   - Get definition for each setting
   - Call `validateSettingValue(definition, value)`
   - Throw error if validation fails

6. **Execute in transaction:**
   - Update existing settings by ID (increment version)
   - For settings without ID: **upsert by scope** — check if a setting with the same `[settingDefinitionId, tenantId, userId, outletId]` already exists (and is not deleted):
     - If found → update the existing record (increment version)
     - If not found → create a new record (version = 1)
   - Return all updated/created settings

7. **Return results with serverTimestamp**

---

#### `validateSettingValue(definition, value)`

Validates a setting value against its definition.

**Parameters:**
- `definition` (SettingDefinition): The setting definition
- `value` (string): The value to validate

**Throws:** `RequestValidateError` if validation fails

**Validation Steps:**

1. **Type Validation:**
   - **INT**: Must match regex `^-?\d+$` (whole numbers only)
   - **DOUBLE**: Must match regex `^-?\d+(\.\d+)?$` (decimals allowed)
   - **BOOLEAN**: Must be `true`, `false`, `1`, or `0`
   - **JSON**: Must be valid JSON (parsed with `JSON.parse()`)
   - **STRING**: No validation

2. **Custom Rules Validation:**
   - Parse `validationRules` JSON
   - **options**: Value must be in the allowed list
   - **min/max**: For INT and DOUBLE, value must be within range
   - **pattern**: Value must match regex pattern

**Examples:**

```typescript
// Valid INT
validateSettingValue({ type: 'INT', ... }, '42')        // ✓
validateSettingValue({ type: 'INT', ... }, '42.5')      // ✗ Error: must be integer

// Valid DOUBLE
validateSettingValue({ type: 'DOUBLE', ... }, '42')     // ✓
validateSettingValue({ type: 'DOUBLE', ... }, '42.5')   // ✓

// Valid BOOLEAN
validateSettingValue({ type: 'BOOLEAN', ... }, 'true')  // ✓
validateSettingValue({ type: 'BOOLEAN', ... }, '1')     // ✓
validateSettingValue({ type: 'BOOLEAN', ... }, 'yes')   // ✗ Error: must be boolean

// Options validation
validateSettingValue({
  type: 'STRING',
  validationRules: '{"options":["IDR","USD"]}'
}, 'USD')  // ✓

validateSettingValue({
  type: 'STRING',
  validationRules: '{"options":["IDR","USD"]}'
}, 'EUR')  // ✗ Error: must be one of IDR, USD

// Min/Max validation
validateSettingValue({
  type: 'INT',
  validationRules: '{"min":0,"max":100}'
}, '50')   // ✓

validateSettingValue({
  type: 'INT',
  validationRules: '{"min":0,"max":100}'
}, '150')  // ✗ Error: must be at most 100
```

---

## Adding New Settings

One of the key benefits of this system: **No tenant database migrations needed!**

### Step-by-Step Process

1. **Add to seed file** (if you have one) or directly insert into global database:

```sql
INSERT INTO setting_definition (
  `KEY`,
  CATEGORY,
  `TYPE`,
  DEFAULT_VALUE,
  DESCRIPTION,
  `SCOPE`,
  IS_REQUIRED,
  IS_READ_ONLY,
  VALIDATION_RULES
) VALUES (
  'enable_loyalty_program',
  'POS',
  'BOOLEAN',
  'false',
  'Enable customer loyalty points',
  'OUTLET',
  0,
  0,
  NULL
);
```

Or if using a seed script:
```typescript
{
  key: 'enable_loyalty_program',
  category: 'POS',
  type: 'BOOLEAN',
  defaultValue: 'false',
  description: 'Enable customer loyalty points',
  scope: 'OUTLET',
  isRequired: false,
  isReadOnly: false,
  validationRules: null
}
```

2. **Run seed script** (if using):
```bash
npx ts-node prisma/global-client/seeds/setting-definitions.ts
```

3. **Done!** All tenants can now use this setting without any database migration.

4. **Clients will receive it** on next sync:
```bash
GET /settings/definition/sync?lastSyncTimestamp=<last_sync>
```

---

## Example Use Cases

### Use Case 1: Change Outlet Currency

**Request:**
```bash
PUT /settings/batchUpdate
Content-Type: application/json
Authorization: Bearer <token>

{
  "settings": [
    {
      "settingDefinitionId": 1,  # Assuming ID 1 is default_currency
      "value": "USD",
      "outletId": 5
    }
  ]
}
```

**What Happens:**
1. Service validates that value "USD" is in the allowed options
2. Creates or updates setting for outlet 5
3. Returns updated setting with serverTimestamp
4. Clients sync and receive the change

---

### Use Case 2: Set Tax Rate with Decimal

**Request:**
```bash
PUT /settings/batchUpdate
Content-Type: application/json
Authorization: Bearer <token>

{
  "settings": [
    {
      "settingDefinitionId": 2,  # Assuming ID 2 is tax_rate
      "value": "10.5",
      "outletId": 5
    }
  ]
}
```

**What Happens:**
1. Service validates that "10.5" is a valid DOUBLE
2. Service validates that 10.5 is between min/max (if specified)
3. Creates or updates tax_rate setting for outlet 5
4. Returns updated setting

**Important:** The `tax_rate` type must be `DOUBLE`, not `INT`, to support decimals like 10.5.

---

### Use Case 3: Batch Update Multiple Settings

**Request:**
```bash
PUT /settings/batchUpdate
Content-Type: application/json
Authorization: Bearer <token>

{
  "settings": [
    {
      "id": 42,
      "value": "USD"
    },
    {
      "id": 43,
      "value": "10.5"
    },
    {
      "settingDefinitionId": 3,
      "value": "true",
      "userId": 10
    }
  ]
}
```

**What Happens:**
1. Updates setting ID 42 (existing) with value "USD"
2. Updates setting ID 43 (existing) with value "10.5"
3. Creates new setting for definition ID 3, user 10, value "true"
4. All operations happen in a single transaction
5. Returns all updated/created settings

---

## Testing the API

### Initial Sync

```bash
curl -X GET \
  'http://localhost:8080/settings/sync?lastSyncTimestamp=null' \
  -H 'Authorization: Bearer <token>'
```

### Delta Sync

```bash
curl -X GET \
  'http://localhost:8080/settings/sync?lastSyncTimestamp=2025-01-15T10:00:00Z' \
  -H 'Authorization: Bearer <token>'
```

### Sync Setting Definitions

```bash
curl -X GET \
  'http://localhost:8080/settings/definition/sync?lastSyncTimestamp=null' \
  -H 'Authorization: Bearer <token>'
```

### Batch Update

```bash
curl -X PUT \
  'http://localhost:8080/settings/batchUpdate' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "settings": [
      {
        "settingDefinitionId": 1,
        "value": "USD",
        "outletId": 5
      }
    ]
  }'
```

---

## Best Practices

### Server-Side

1. **Always validate settings** before saving (service layer does this automatically)
2. **Use type-safe enums** in TypeScript when possible
3. **Version definitions** to track changes over time
4. **Soft delete** instead of hard delete
5. **Use transactions** for batch operations to ensure atomicity
6. **Bulk fetch** definitions and settings to minimize database queries

### Adding New Settings

1. **Choose the right type:**
   - `INT` for whole numbers (e.g., quantity, count)
   - `DOUBLE` for decimals (e.g., tax rate, price multiplier)
   - `STRING` for text (e.g., currency code, language)
   - `BOOLEAN` for flags (e.g., enabled/disabled)
   - `JSON` for complex data structures

2. **Choose the right scope:**
   - `TENANT` for company-wide settings
   - `OUTLET` for store-specific settings
   - `USER` for user preferences

3. **Define validation rules:**
   - Use `options` for predefined choices
   - Use `min`/`max` for numeric ranges
   - Use `pattern` for formatted text
   - Use `null` if no validation needed

4. **Provide good defaults:**
   - Always set a sensible `defaultValue`
   - Consider regional/locale differences

---

## Delta Sync Implementation Details

### How It Works

1. **Client stores last sync timestamp** locally
2. **On sync request**, client sends `lastSyncTimestamp`
3. **Server queries** settings/definitions where:
   - `createdAt >= lastSyncTimestamp` OR
   - `updatedAt >= lastSyncTimestamp` OR
   - `deletedAt >= lastSyncTimestamp`
4. **Server returns** changed records + new `serverTimestamp`
5. **Client updates** local data and stores new `serverTimestamp`

### Why Include Deleted Records?

Settings with `deletedAt >= lastSyncTimestamp` are included so clients can:
- Remove deleted settings from local storage
- Update UI to reflect deletions
- Maintain sync consistency

### Handling Clock Skew

The server always returns `serverTimestamp` in the response. Clients should:
- Use the **server's timestamp**, not the client's clock
- Store the exact `serverTimestamp` value returned
- Send this value in the next sync request

This prevents issues with clock differences between client and server.

---

## Troubleshooting

### Issue: New field not appearing in API response

**Symptoms:**
- Added new field to `setting_definition` schema (e.g., `isReadOnly`)
- Ran migration and Prisma generate successfully
- Field exists in database
- Field still doesn't appear in API response

**Cause:**
The Node.js server has the old Prisma client loaded in memory from before the schema change.

**Solution:**
1. **Restart the server** - This is the most common fix!
   ```bash
   # Stop your current server (Ctrl+C or kill the process)
   # Then restart
   npm run dev
   ```

2. **Verify the steps were completed:**
   ```bash
   # 1. Check migration was applied
   npx prisma migrate status --schema=prisma/global-client/schema.prisma

   # 2. Regenerate Prisma client
   npx prisma generate --schema=prisma/global-client/schema.prisma

   # 3. Restart server
   npm run dev
   ```

3. **Verify the field appears:**
   ```bash
   curl -H "Authorization: Bearer <token>" \
     'http://localhost:8080/settings/definition/sync?lastSyncTimestamp=null&take=1'
   ```

---

### Issue: Settings not syncing

**Possible Causes:**
1. Client not sending `lastSyncTimestamp`
2. Client using wrong timestamp format
3. Server clock skew

**Solution:**
1. Verify `lastSyncTimestamp` is in ISO 8601 format: `2025-01-15T10:00:00Z`
2. Check server logs for errors
3. Try initial sync with `lastSyncTimestamp=null`

---

### Issue: Validation error when updating setting

**Possible Causes:**
1. Value doesn't match validation rules
2. Value doesn't match type
3. Missing required scope parameters

**Solution:**
1. Check `validationRules` in the definition:
   ```sql
   SELECT * FROM setting_definition WHERE KEY = 'your_setting_key';
   ```
2. Ensure value matches the expected type (e.g., INT must be whole number)
3. For OUTLET settings, include `outletId` when creating new
4. For USER settings, include `userId` when creating new

---

### Issue: Setting definition not found

**Possible Causes:**
1. Definition not seeded in global database
2. Wrong setting key
3. Definition soft-deleted

**Solution:**
1. Verify definition exists:
   ```sql
   SELECT * FROM setting_definition WHERE KEY = 'your_setting_key' AND IS_DELETED = 0;
   ```
2. Run seed script if missing
3. Check for typos in setting key

---

### Issue: Type mismatch (INT vs DOUBLE)

**Problem:** Setting is defined as `INT` but client wants to store decimal value like `10.5`.

**Solution:**
1. Update the definition type to `DOUBLE`:
   ```sql
   UPDATE setting_definition
   SET `TYPE` = 'DOUBLE'
   WHERE `KEY` = 'your_setting_key';
   ```
2. No tenant database migration needed!
3. Clients will receive updated definition on next sync

---

## Migration Guide

### Initial Setup

1. **Run Prisma migrations:**

```bash
# Global database (setting definitions)
npx prisma migrate dev --schema=prisma/global-client/schema.prisma --name add_setting_definition

# Tenant database template (setting values)
npx prisma migrate dev --schema=prisma/client/schema.prisma --name update_setting_model

# Apply to all existing tenant databases
npm run update-dbs
```

2. **Seed setting definitions:**

```bash
npx ts-node prisma/global-client/seeds/setting-definitions.ts
```

3. **Generate Prisma clients:**

```bash
npx prisma generate --schema=prisma/global-client/schema.prisma
npx prisma generate --schema=prisma/client/schema.prisma
```

4. **Restart server:**

```bash
npm run dev
```

5. **Verify setup:**

```bash
# Check global database
SELECT COUNT(*) FROM setting_definition;

# Test API
curl -H "Authorization: Bearer <token>" \
  http://localhost:8080/settings/definition/sync?lastSyncTimestamp=null
```

---

## Summary

### What You Get

- **Flexible multi-scope settings** (TENANT/OUTLET/USER)
- **No tenant DB migrations** when adding new settings
- **Efficient delta sync** for clients
- **Type validation and custom rules**
- **Default values with fallback support**
- **Batch update support** for performance
- **Optimistic locking** with version field

### Key Implementation Points

1. **Two databases**: Global for definitions, Tenant for values
2. **Delta sync**: Track changes by timestamp
3. **Validation**: Server-side type and rule validation
4. **Batch operations**: Update multiple settings efficiently
5. **Soft deletes**: Maintain sync consistency
6. **Scoped settings**: TENANT, OUTLET, or USER level

### For Questions or Issues

Please refer to:
- Service implementation: [settings.service.ts](src/settings/settings.service.ts)
- Controller implementation: [settings.controller.ts](src/settings/settings.controller.ts)
- Request interfaces: [settings.request.ts](src/settings/settings.request.ts)
- Database schemas: `prisma/global-client/schema.prisma` and `prisma/client/schema.prisma`
