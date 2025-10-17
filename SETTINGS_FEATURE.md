# Settings Feature Documentation

## Overview

The Settings feature provides a flexible, multi-scope configuration system for the application. It allows different settings to be configured at **Tenant**, **Outlet**, or **User** levels without requiring database migrations when adding new settings.

### Key Features

- ✅ **No tenant DB migrations** when adding new settings
- ✅ **Multi-scope support** (TENANT, OUTLET, USER)
- ✅ **Delta sync** for efficient Flutter client synchronization
- ✅ **Type validation** (INT, STRING, BOOLEAN, JSON)
- ✅ **Custom validation rules** (min/max, options, regex patterns)
- ✅ **Default values** with fallback support
- ✅ **Server-side caching** for performance

---

## Architecture

### Database Design

#### Global Database (`setting_definition` table)

Stores the **definition/schema** for all settings. This is the single source of truth for what settings exist.

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
| `VALIDATION_RULES` | TEXT (JSON) | Validation rules: `{min, max, options, pattern}` |
| `VERSION` | INT | For versioning and cache invalidation |
| `CREATED_AT` | DATETIME | Creation timestamp |
| `UPDATED_AT` | DATETIME | Last update timestamp |
| `IS_DELETED` | BOOLEAN | Soft delete flag |

**Example:**
```json
{
  "ID": 1,
  "KEY": "default_currency",
  "CATEGORY": "Financial",
  "TYPE": "STRING",
  "DEFAULT_VALUE": "IDR",
  "SCOPE": "OUTLET",
  "DESCRIPTION": "Default currency for transactions",
  "VALIDATION_RULES": "{\"options\": [\"IDR\", \"USD\", \"SGD\"]}"
}
```

#### Understanding `VALIDATION_RULES`

The `VALIDATION_RULES` column stores **JSON-formatted validation constraints** as a TEXT string. It's nullable and defines what values are allowed for each setting.

**Available Rule Types:**

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
   - Used for: percentages, quantities, thresholds

3. **`pattern`** - Regex validation (for text patterns)
   ```json
   {"pattern": "^[A-Z]{2,5}$"}
   ```
   - Value must match the regular expression
   - Used for: codes, prefixes, formatted text

4. **No rules** - Set to `NULL` if no validation needed
   ```json
   null
   ```
   - Any value of the specified TYPE is accepted
   - Used for: simple boolean flags, free-text fields

**Example Rules in Database:**

| Setting | Type | Validation Rules | What It Validates |
|---------|------|-----------------|-------------------|
| `default_currency` | STRING | `{"options":["IDR","USD","SGD"]}` | Must be IDR, USD, or SGD |
| `tax_rate` | DOUBLE | `{"min":0,"max":100}` | Must be between 0-100 (decimals allowed: 10.5) |
| `receipt_copies` | INT | `{"min":1,"max":5}` | Must be between 1-5 (whole numbers only) |
| `invoice_prefix` | STRING | `{"pattern":"^[A-Z]{2,5}$"}` | 2-5 uppercase letters only |
| `tax_inclusive` | BOOLEAN | `null` | No additional validation |

**Server Validation:** The service automatically validates values against these rules before saving.

**Flutter Usage:** Parse the JSON to build smart UI (dropdowns, sliders, formatted inputs).

---

#### Tenant Database (`setting` table)

Stores the **actual values** for settings, scoped to tenant/outlet/user.

| Field | Type | Description |
|-------|------|-------------|
| `ID` | INT | Primary key |
| `SETTING_DEFINITION_ID` | INT | References `setting_definition.ID` (no FK) |
| `TENANT_ID` | INT | Tenant scope (null if not tenant-scoped) |
| `OUTLET_ID` | INT | Outlet scope (null if not outlet-scoped) |
| `USER_ID` | INT | User scope (null if not user-scoped) |
| `VALUE` | STRING | The actual setting value |
| `VERSION` | INT | For optimistic locking |
| `CREATED_AT` | DATETIME | Creation timestamp |
| `UPDATED_AT` | DATETIME | Last update timestamp |
| `IS_DELETED` | BOOLEAN | Soft delete flag |

**Example:**
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

### How Scopes Work

| Scope | Description | Example Use Cases | Required Parameters |
|-------|-------------|-------------------|---------------------|
| **TENANT** | Company-wide setting | Company name, invoice prefix, payment terms | `tenantId` (auto-filled) |
| **OUTLET** | Store/location-specific | Currency, tax rate, POS settings, inventory thresholds | `outletId` |
| **USER** | Individual user preference | Language, theme, date format, notifications | `userId` |

**Important:** The scope is determined by the **setting definition**, not the request. When updating a setting, the API automatically applies it to the correct scope based on the definition.

---

## Server-Side Implementation

### File Structure

```
src/settings/
├── settings.request.ts      # TypeScript interfaces
├── settings.service.ts       # Business logic
└── settings.controller.ts    # API routes

prisma/
├── global-client/
│   ├── schema.prisma        # SettingDefinition model
│   └── seeds/
│       └── setting-definitions.ts  # Seed data
└── client/
    └── schema.prisma        # Setting model (values)
```

---

### API Endpoints

#### 1. GET `/settings` - Get All Settings (with Delta Sync)

**Purpose:** Fetch all settings with their definitions. Supports incremental sync.

**Query Parameters:**
- `lastSyncTimestamp` (optional): ISO timestamp for delta sync
- `outletId` (optional): Filter by outlet
- `userId` (optional): Filter by user
- `skip` (optional): Pagination offset (default: 0)
- `take` (optional): Pagination limit (default: 100)

**Response:**
```json
{
  "settings": [
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
      "definition": {
        "id": 1,
        "key": "default_currency",
        "category": "Financial",
        "type": "STRING",
        "defaultValue": "IDR",
        "scope": "OUTLET",
        "description": "Default currency for transactions",
        "validationRules": "{\"options\": [\"IDR\", \"USD\", \"SGD\"]}"
      }
    }
  ],
  "definitions": [
    {
      "id": 1,
      "key": "default_currency",
      "category": "Financial",
      "type": "STRING",
      "defaultValue": "IDR",
      "scope": "OUTLET",
      "description": "Default currency for transactions",
      "validationRules": "{\"options\": [\"IDR\", \"USD\", \"SGD\"]}"
    }
  ],
  "total": 1,
  "serverTimestamp": "2025-01-15T12:00:00Z"
}
```

**Initial Sync (First Time):**
```bash
GET /settings?lastSyncTimestamp=null
```
Returns all settings + all definitions.

**Delta Sync (Subsequent Syncs):**
```bash
GET /settings?lastSyncTimestamp=2025-01-15T10:00:00Z
```
Returns only settings that were created/updated/deleted since the timestamp.

---

#### 2. PUT `/settings` - Update Setting

**Purpose:** Update or create a setting value.

**Request Body:**
```json
{
  "key": "default_currency",
  "value": "USD",
  "outletId": 5,     // Required if setting scope is OUTLET
  "userId": 42       // Required if setting scope is USER
}
```

**Response:**
```json
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
  "deleted": false
}
```

**Validation:**
- Type validation (e.g., INT must be a number)
- Custom rules (e.g., options, min/max, regex)
- Scope validation (e.g., OUTLET settings require `outletId`)

**Example Errors:**
```json
{
  "error": "Value must be one of: IDR, USD, SGD for setting 'default_currency'"
}
```

```json
{
  "error": "outletId is required for setting 'default_currency'"
}
```

---

### Server-Side Service Logic

#### Caching Strategy

Setting definitions are cached in-memory for 5 minutes to reduce database queries:

```typescript
let definitionsCache: SettingDefinition[] = [];
let lastCacheUpdate: Date = new Date(0);
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
```

On every request, the service checks:
1. Is cache empty? → Load from DB
2. Is cache older than 5 minutes? → Refresh from DB
3. Otherwise → Use cached definitions

#### Validation Logic

1. **Type Validation:**
   - `INT`: Must match regex `^-?\d+$` (whole numbers only)
   - `DOUBLE`: Must match regex `^-?\d+(\.\d+)?$` (decimal numbers allowed)
   - `BOOLEAN`: Must be `true`, `false`, `1`, or `0`
   - `JSON`: Must be valid JSON
   - `STRING`: No validation

2. **Custom Rules (from `validationRules` JSON):**
   - `options`: Value must be in the allowed list
   - `min`/`max`: For INT and DOUBLE types, value must be within range
   - `pattern`: Value must match regex pattern

3. **Scope Validation:**
   - If scope is `OUTLET`, `outletId` must be provided
   - If scope is `USER`, `userId` must be provided
   - If scope is `TENANT`, no additional parameter needed (uses `tenantId` from auth)

---

### Adding New Settings

To add a new setting:

1. **Add to seed file** (`prisma/global-client/seeds/setting-definitions.ts`):
```typescript
{
    key: 'enable_refunds',
    category: 'POS',
    type: 'BOOLEAN',
    defaultValue: 'true',
    description: 'Allow refunds on transactions',
    scope: 'OUTLET',
    isRequired: false
}
```

2. **Run seed script:**
```bash
npx ts-node prisma/global-client/seeds/setting-definitions.ts
```

3. **No tenant DB migration needed!** The setting is now available for all tenants.

---

## Flutter Client Implementation

### Realm Database Setup

The Flutter app uses Realm for local storage. Define Realm schemas for settings:

#### Realm Models

```dart
import 'package:realm/realm.dart';

part 'setting_models.g.dart';

// Setting Definition (from global DB)
@RealmModel()
class _SettingDefinition {
  @PrimaryKey()
  late int id;
  late String key;
  late String category;
  late String type; // "INT", "STRING", "BOOLEAN", "JSON"
  late String? defaultValue;
  late String? description;
  late String scope; // "TENANT", "OUTLET", "USER"
  late bool isRequired;
  late String? validationRules; // JSON string
  late int version;
  late DateTime createdAt;
  late DateTime updatedAt;
  late bool deleted;
}

// Setting Value (from tenant DB)
@RealmModel()
class _Setting {
  @PrimaryKey()
  late int id;
  late int settingDefinitionId;
  late int? tenantId;
  late int? outletId;
  late int? userId;
  late String value;
  late int version;
  late DateTime? createdAt;
  late DateTime? updatedAt;
  late bool deleted;
}

// Metadata for sync
@RealmModel()
class _SyncMetadata {
  @PrimaryKey()
  late String key; // e.g., "settings_last_sync"
  late String value; // ISO timestamp
}
```

Generate Realm models:
```bash
flutter pub run realm generate
```

---

### Settings Service

```dart
import 'package:realm/realm.dart';
import 'dart:convert';

class SettingsService {
  final Realm realm;
  final ApiService api;

  SettingsService({required this.realm, required this.api});

  // ============================================
  // SYNC
  // ============================================

  /// Initial sync - fetch all settings and definitions
  Future<void> initialSync() async {
    final response = await api.get('/settings?lastSyncTimestamp=null');
    final data = jsonDecode(response.body);

    realm.write(() {
      // Save definitions
      for (var def in data['definitions']) {
        realm.add(SettingDefinition(
          def['id'],
          key: def['key'],
          category: def['category'],
          type: def['type'],
          defaultValue: def['defaultValue'],
          description: def['description'],
          scope: def['scope'],
          isRequired: def['isRequired'],
          validationRules: def['validationRules'],
          version: def['version'],
          createdAt: DateTime.parse(def['createdAt']),
          updatedAt: DateTime.parse(def['updatedAt']),
          deleted: def['deleted'],
        ), update: true);
      }

      // Save settings
      for (var setting in data['settings']) {
        realm.add(Setting(
          setting['id'],
          settingDefinitionId: setting['settingDefinitionId'],
          tenantId: setting['tenantId'],
          outletId: setting['outletId'],
          userId: setting['userId'],
          value: setting['value'],
          version: setting['version'],
          createdAt: setting['createdAt'] != null
              ? DateTime.parse(setting['createdAt'])
              : null,
          updatedAt: setting['updatedAt'] != null
              ? DateTime.parse(setting['updatedAt'])
              : null,
          deleted: setting['deleted'],
        ), update: true);
      }

      // Update last sync timestamp
      _updateLastSync(data['serverTimestamp']);
    });
  }

  /// Delta sync - fetch only changed settings
  Future<void> deltaSync() async {
    final lastSync = _getLastSync();
    if (lastSync == null) {
      return await initialSync();
    }

    final response = await api.get('/settings?lastSyncTimestamp=$lastSync');
    final data = jsonDecode(response.body);

    realm.write(() {
      // Merge changed settings
      for (var setting in data['settings']) {
        realm.add(Setting(
          setting['id'],
          settingDefinitionId: setting['settingDefinitionId'],
          tenantId: setting['tenantId'],
          outletId: setting['outletId'],
          userId: setting['userId'],
          value: setting['value'],
          version: setting['version'],
          createdAt: setting['createdAt'] != null
              ? DateTime.parse(setting['createdAt'])
              : null,
          updatedAt: setting['updatedAt'] != null
              ? DateTime.parse(setting['updatedAt'])
              : null,
          deleted: setting['deleted'],
        ), update: true);
      }

      // Update definitions if they changed
      if (data['definitions'].isNotEmpty) {
        for (var def in data['definitions']) {
          realm.add(SettingDefinition(
            def['id'],
            key: def['key'],
            category: def['category'],
            type: def['type'],
            defaultValue: def['defaultValue'],
            description: def['description'],
            scope: def['scope'],
            isRequired: def['isRequired'],
            validationRules: def['validationRules'],
            version: def['version'],
            createdAt: DateTime.parse(def['createdAt']),
            updatedAt: DateTime.parse(def['updatedAt']),
            deleted: def['deleted'],
          ), update: true);
        }
      }

      _updateLastSync(data['serverTimestamp']);
    });
  }

  // ============================================
  // GET SETTINGS BY SCOPE
  // ============================================

  /// Get user settings (USER scope)
  List<SettingWithValue> getUserSettings(int userId) {
    final userDefs = realm.all<SettingDefinition>()
        .query('scope == "USER" AND deleted == false');

    return userDefs.map((def) {
      final setting = realm.query<Setting>(
        'settingDefinitionId == ${def.id} AND userId == $userId AND deleted == false'
      ).firstOrNull;

      return SettingWithValue(
        definition: def,
        value: setting?.value ?? def.defaultValue ?? '',
        hasCustomValue: setting != null,
      );
    }).toList();
  }

  /// Get outlet settings (OUTLET scope)
  List<SettingWithValue> getOutletSettings(int outletId) {
    final outletDefs = realm.all<SettingDefinition>()
        .query('scope == "OUTLET" AND deleted == false');

    return outletDefs.map((def) {
      final setting = realm.query<Setting>(
        'settingDefinitionId == ${def.id} AND outletId == $outletId AND deleted == false'
      ).firstOrNull;

      return SettingWithValue(
        definition: def,
        value: setting?.value ?? def.defaultValue ?? '',
        hasCustomValue: setting != null,
      );
    }).toList();
  }

  /// Get tenant settings (TENANT scope)
  List<SettingWithValue> getTenantSettings() {
    final tenantDefs = realm.all<SettingDefinition>()
        .query('scope == "TENANT" AND deleted == false');

    return tenantDefs.map((def) {
      final setting = realm.query<Setting>(
        'settingDefinitionId == ${def.id} AND deleted == false'
      ).firstOrNull;

      return SettingWithValue(
        definition: def,
        value: setting?.value ?? def.defaultValue ?? '',
        hasCustomValue: setting != null,
      );
    }).toList();
  }

  // ============================================
  // GET SPECIFIC SETTING VALUE
  // ============================================

  /// Get a specific setting value by key
  String getSetting(String key, {int? outletId, int? userId}) {
    final definition = realm.query<SettingDefinition>('key == "$key"').firstOrNull;
    if (definition == null) return '';

    final queryParts = <String>[
      'settingDefinitionId == ${definition.id}',
      'deleted == false'
    ];

    if (definition.scope == 'OUTLET' && outletId != null) {
      queryParts.add('outletId == $outletId');
    } else if (definition.scope == 'USER' && userId != null) {
      queryParts.add('userId == $userId');
    }

    final setting = realm.query<Setting>(queryParts.join(' AND ')).firstOrNull;
    return setting?.value ?? definition.defaultValue ?? '';
  }

  /// Typed getters for common settings
  String getCurrency({int? outletId}) => getSetting('default_currency', outletId: outletId);
  int getTaxRate({int? outletId}) => int.tryParse(getSetting('tax_rate', outletId: outletId)) ?? 11;
  bool isTaxInclusive({int? outletId}) => getSetting('tax_inclusive', outletId: outletId) == 'true';
  String getLanguage({int? userId}) => getSetting('language', userId: userId);
  String getTheme({int? userId}) => getSetting('theme', userId: userId);

  // ============================================
  // UPDATE SETTING
  // ============================================

  Future<void> updateSetting(
    String key,
    String value,
    {int? outletId, int? userId}
  ) async {
    // Update on server
    await api.put('/settings', body: jsonEncode({
      'key': key,
      'value': value,
      'outletId': outletId,
      'userId': userId,
    }));

    // Update local cache
    final definition = realm.query<SettingDefinition>('key == "$key"').firstOrNull;
    if (definition == null) return;

    realm.write(() {
      final setting = realm.query<Setting>(
        'settingDefinitionId == ${definition.id}'
      ).firstOrNull;

      if (setting != null) {
        setting.value = value;
        setting.updatedAt = DateTime.now();
        setting.version++;
      } else {
        realm.add(Setting(
          0, // Server will assign ID
          settingDefinitionId: definition.id,
          tenantId: null,
          outletId: outletId,
          userId: userId,
          value: value,
          version: 1,
          createdAt: DateTime.now(),
          updatedAt: DateTime.now(),
          deleted: false,
        ));
      }
    });

    // Sync to get server-assigned ID
    await deltaSync();
  }

  // ============================================
  // HELPERS
  // ============================================

  String? _getLastSync() {
    final meta = realm.query<SyncMetadata>('key == "settings_last_sync"').firstOrNull;
    return meta?.value;
  }

  void _updateLastSync(String timestamp) {
    realm.add(SyncMetadata('settings_last_sync', value: timestamp), update: true);
  }
}

// Helper class for UI
class SettingWithValue {
  final SettingDefinition definition;
  final String value;
  final bool hasCustomValue;

  SettingWithValue({
    required this.definition,
    required this.value,
    required this.hasCustomValue,
  });

  // Parse validation rules
  Map<String, dynamic>? get validationRules {
    if (definition.validationRules == null) return null;
    try {
      return jsonDecode(definition.validationRules!);
    } catch (e) {
      return null;
    }
  }

  // Get allowed options (if any)
  List<String>? get options {
    final rules = validationRules;
    if (rules == null) return null;
    return rules['options']?.cast<String>();
  }
}
```

---

### UI Implementation

#### User Settings Screen

```dart
class UserSettingsScreen extends StatelessWidget {
  final SettingsService settingsService;
  final int currentUserId;

  const UserSettingsScreen({
    required this.settingsService,
    required this.currentUserId,
  });

  @override
  Widget build(BuildContext context) {
    final userSettings = settingsService.getUserSettings(currentUserId);

    return Scaffold(
      appBar: AppBar(title: Text('My Preferences')),
      body: ListView.builder(
        itemCount: userSettings.length,
        itemBuilder: (context, index) {
          final setting = userSettings[index];
          return DynamicSettingWidget(
            setting: setting,
            onChanged: (value) async {
              await settingsService.updateSetting(
                setting.definition.key,
                value,
                userId: currentUserId,
              );
            },
          );
        },
      ),
    );
  }
}
```

#### Outlet Settings Screen

```dart
class OutletSettingsScreen extends StatelessWidget {
  final SettingsService settingsService;
  final int outletId;

  const OutletSettingsScreen({
    required this.settingsService,
    required this.outletId,
  });

  @override
  Widget build(BuildContext context) {
    final outletSettings = settingsService.getOutletSettings(outletId);

    // Group by category
    final grouped = <String, List<SettingWithValue>>{};
    for (var setting in outletSettings) {
      grouped.putIfAbsent(setting.definition.category, () => []).add(setting);
    }

    return Scaffold(
      appBar: AppBar(title: Text('Outlet Settings')),
      body: ListView(
        children: grouped.entries.map((entry) {
          return ExpansionTile(
            title: Text(entry.key), // Category name
            children: entry.value.map((setting) {
              return DynamicSettingWidget(
                setting: setting,
                onChanged: (value) async {
                  await settingsService.updateSetting(
                    setting.definition.key,
                    value,
                    outletId: outletId,
                  );
                },
              );
            }).toList(),
          );
        }).toList(),
      ),
    );
  }
}
```

#### Dynamic Setting Widget

Auto-renders based on type and validation rules:

```dart
class DynamicSettingWidget extends StatelessWidget {
  final SettingWithValue setting;
  final Function(String) onChanged;

  const DynamicSettingWidget({
    required this.setting,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final def = setting.definition;

    // Boolean type → Switch
    if (def.type == 'BOOLEAN') {
      return SwitchListTile(
        title: Text(def.description ?? def.key),
        value: setting.value == 'true',
        onChanged: (val) => onChanged(val.toString()),
      );
    }

    // String with options → Dropdown
    if (def.type == 'STRING' && setting.options != null) {
      return ListTile(
        title: Text(def.description ?? def.key),
        subtitle: DropdownButton<String>(
          value: setting.value,
          items: setting.options!.map((option) {
            return DropdownMenuItem(value: option, child: Text(option));
          }).toList(),
          onChanged: (val) {
            if (val != null) onChanged(val);
          },
        ),
      );
    }

    // Integer → Number input
    if (def.type == 'INT') {
      final rules = setting.validationRules;
      return ListTile(
        title: Text(def.description ?? def.key),
        subtitle: TextField(
          keyboardType: TextInputType.number,
          controller: TextEditingController(text: setting.value),
          decoration: InputDecoration(
            hintText: rules?['min'] != null && rules?['max'] != null
                ? '${rules!['min']} - ${rules!['max']}'
                : null,
          ),
          onSubmitted: onChanged,
        ),
      );
    }

    // Default: Text input
    return ListTile(
      title: Text(def.description ?? def.key),
      subtitle: TextField(
        controller: TextEditingController(text: setting.value),
        onSubmitted: onChanged,
      ),
    );
  }
}
```

---

### Sync Strategy

#### On App Start
```dart
void main() async {
  final settingsService = SettingsService(realm: realm, api: api);

  // Initial sync if first launch
  final lastSync = settingsService._getLastSync();
  if (lastSync == null) {
    await settingsService.initialSync();
  }

  runApp(MyApp());
}
```

#### Background Sync
```dart
// Every 5 minutes while app is active
Timer.periodic(Duration(minutes: 5), (timer) async {
  await settingsService.deltaSync();
});
```

#### Manual Refresh
```dart
// Pull-to-refresh in settings screen
RefreshIndicator(
  onRefresh: () => settingsService.deltaSync(),
  child: SettingsListView(),
)
```

---

## Migration Guide

### Step 1: Run Prisma Migrations

```bash
# Generate migration for global DB
cd /path/to/flutter-server
npx prisma migrate dev --schema=prisma/global-client/schema.prisma --name add_setting_definition

# Generate migration for tenant DB
npx prisma migrate dev --schema=prisma/client/schema.prisma --name update_setting_model

# Apply to all tenant databases
npm run update-dbs
```

### Step 2: Seed Setting Definitions

```bash
npx ts-node prisma/global-client/seeds/setting-definitions.ts
```

Expected output:
```
🌱 Seeding setting definitions...
✅ Successfully seeded 19 setting definitions

📊 Summary:
By Scope: { TENANT: 3, OUTLET: 11, USER: 5 }
By Category: { Financial: 5, POS: 4, Inventory: 3, 'User Preference': 4, System: 3 }
```

### Step 3: Generate Prisma Clients

```bash
npx prisma generate --schema=prisma/global-client/schema.prisma
npx prisma generate --schema=prisma/client/schema.prisma
```

### Step 4: Restart Server

```bash
npm run dev
```

### Step 5: Test API

```bash
# Test sync endpoint
curl -H "Authorization: Bearer <token>" \
  http://localhost:8080/settings?lastSyncTimestamp=null

# Test update
curl -X PUT -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"key":"default_currency","value":"USD","outletId":1}' \
  http://localhost:8080/settings
```

---

## Common Use Cases

### Use Case 1: Change Outlet Currency

**Server:**
```bash
PUT /settings
{
  "key": "default_currency",
  "value": "USD",
  "outletId": 5
}
```

**Flutter:**
```dart
await settingsService.updateSetting(
  'default_currency',
  'USD',
  outletId: 5
);

// Use it
final currency = settingsService.getCurrency(outletId: 5); // "USD"
```

---

### Use Case 2: Change User Language

**Flutter:**
```dart
await settingsService.updateSetting(
  'language',
  'id',  // Indonesian
  userId: currentUserId
);

// Use it
final lang = settingsService.getLanguage(userId: currentUserId); // "id"
```

---

### Use Case 3: Add New Setting (No Migration!)

1. Add to seed file:
```typescript
{
    key: 'enable_loyalty_program',
    category: 'POS',
    type: 'BOOLEAN',
    defaultValue: 'false',
    description: 'Enable customer loyalty points',
    scope: 'OUTLET',
    isRequired: false
}
```

2. Run seed:
```bash
npx ts-node prisma/global-client/seeds/setting-definitions.ts
```

3. **Done!** All tenants can now use this setting without any database migration.

4. Flutter will get it on next sync:
```dart
await settingsService.deltaSync();
final enabled = settingsService.getSetting('enable_loyalty_program', outletId: currentOutlet);
```

---

## Best Practices

### Server-Side

1. **Always validate settings** before saving (service layer does this automatically)
2. **Use type-safe enums** in TypeScript when possible
3. **Cache definitions** (already implemented with 5-min TTL)
4. **Version definitions** to track changes over time
5. **Soft delete** instead of hard delete

### Flutter Client

1. **Sync on app start** (initial or delta based on last sync)
2. **Cache locally** using Realm for offline support
3. **Background sync** every 5-10 minutes
4. **Optimistic updates** - update local cache immediately, sync to server in background
5. **Group settings by category** in UI for better UX
6. **Use typed getters** (`getCurrency()`) instead of raw `getSetting()`
7. **Handle network errors** gracefully - fall back to cached values

---

## Troubleshooting

### Issue: Settings not syncing to Flutter

**Solution:**
1. Check network connectivity
2. Verify `lastSyncTimestamp` format (ISO 8601)
3. Check server logs for errors
4. Run `deltaSync()` manually and check response

### Issue: Validation error when updating setting

**Solution:**
1. Check the `validationRules` in the definition
2. Ensure value matches the expected type
3. For OUTLET/USER scoped settings, ensure `outletId`/`userId` is provided

### Issue: Setting definition not found

**Solution:**
1. Verify setting was seeded: `SELECT * FROM setting_definition WHERE KEY = 'your_key'`
2. Run seed script if missing
3. Check server cache hasn't expired (wait 5 minutes or restart server)

---

## Summary

### What You Get

✅ Flexible multi-scope settings (TENANT/OUTLET/USER)
✅ No tenant DB migrations when adding new settings
✅ Efficient delta sync for Flutter client
✅ Type validation and custom rules
✅ Default values with fallback support
✅ Offline support with Realm caching
✅ Context-based UI (settings appear where they make sense)

### Next Steps

1. Run migrations and seed definitions
2. Implement Flutter Realm models
3. Create `SettingsService` in Flutter
4. Build UI screens (User Settings, Outlet Settings)
5. Add new settings as needed (just update seed file!)

---

**For questions or issues, please refer to the codebase or contact the development team.**
