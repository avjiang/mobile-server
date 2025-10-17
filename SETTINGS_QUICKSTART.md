# Settings Feature - Quick Start Guide

## 🚀 Setup (5 Minutes)

### 1. Run Migrations

```bash
# Terminal 1: Global DB
npx prisma migrate dev --schema=prisma/global-client/schema.prisma --name add_setting_definition

# Terminal 2: Tenant DBs
npx prisma migrate dev --schema=prisma/client/schema.prisma --name update_setting_model

# Apply to all tenant databases
npm run update-dbs
```

### 2. Seed Settings

```bash
npx ts-node prisma/global-client/seeds/setting-definitions.ts
```

### 3. Generate Prisma Clients

```bash
npx prisma generate --schema=prisma/global-client/schema.prisma
npx prisma generate --schema=prisma/client/schema.prisma
```

### 4. Restart Server

```bash
npm run dev
```

---

## 📡 API Quick Reference

### Get All Settings (Delta Sync)

```bash
# Initial sync
GET /settings?lastSyncTimestamp=null

# Delta sync
GET /settings?lastSyncTimestamp=2025-01-15T10:00:00Z
```

### Update Setting

```bash
PUT /settings
Content-Type: application/json

{
  "key": "default_currency",
  "value": "USD",
  "outletId": 5  # Required for OUTLET scope
}
```

---

## 📱 Flutter Quick Start

### 1. Add Dependencies

```yaml
dependencies:
  realm: ^latest_version
  http: ^latest_version
```

### 2. Define Realm Models

Create `lib/models/setting_models.dart`:

```dart
import 'package:realm/realm.dart';
part 'setting_models.g.dart';

@RealmModel()
class _SettingDefinition {
  @PrimaryKey()
  late int id;
  late String key;
  late String category;
  late String type;
  late String? defaultValue;
  late String? description;
  late String scope;
  late bool isRequired;
  late String? validationRules;
  late int version;
  late DateTime createdAt;
  late DateTime updatedAt;
  late bool deleted;
}

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

@RealmModel()
class _SyncMetadata {
  @PrimaryKey()
  late String key;
  late String value;
}
```

Generate:
```bash
flutter pub run realm generate
```

### 3. Create Settings Service

See full implementation in `SETTINGS_FEATURE.md`

### 4. Use in App

```dart
// Get setting value
final currency = settingsService.getCurrency(outletId: currentOutlet);

// Update setting
await settingsService.updateSetting(
  'default_currency',
  'USD',
  outletId: currentOutlet
);

// Sync
await settingsService.deltaSync();
```

---

## 🎯 Common Use Cases

### Change Currency for Outlet

```dart
await settingsService.updateSetting(
  'default_currency',
  'USD',
  outletId: 5
);
```

### Change User Language

```dart
await settingsService.updateSetting(
  'language',
  'id',
  userId: currentUserId
);
```

### Get Tax Rate

```dart
final taxRate = settingsService.getTaxRate(outletId: currentOutlet);
// Returns: 11.0 (default) or custom value like 10.5
```

### Set Tax Rate (with decimal)

```dart
await settingsService.updateSetting(
  'tax_rate',
  '10.5',  // Supports decimals!
  outletId: currentOutlet
);
```

---

## ➕ Adding New Settings (No Migration!)

1. Edit `prisma/global-client/seeds/setting-definitions.ts`:

```typescript
{
    key: 'my_new_setting',
    category: 'POS',
    type: 'BOOLEAN',
    defaultValue: 'true',
    description: 'My awesome new feature',
    scope: 'OUTLET',
    isRequired: false
}
```

2. Run seed:

```bash
npx ts-node prisma/global-client/seeds/setting-definitions.ts
```

3. Done! No database migrations needed. Flutter will get it on next sync.

---

## 🔍 Available Settings (Default)

| Key | Type | Scope | Default | Description |
|-----|------|-------|---------|-------------|
| `default_currency` | STRING | OUTLET | IDR | Transaction currency |
| `tax_rate` | **DOUBLE** | OUTLET | 11 | Tax percentage (supports decimals like 10.5) |
| `tax_inclusive` | BOOLEAN | OUTLET | true | Prices include tax |
| `auto_print_receipt` | BOOLEAN | OUTLET | true | Auto-print after sale |
| `receipt_copies` | INT | OUTLET | 1 | Number of copies |
| `low_stock_threshold` | INT | OUTLET | 10 | Low stock alert |
| `language` | STRING | USER | en | User language |
| `theme` | STRING | USER | light | UI theme |
| `company_name` | STRING | TENANT | My Company | Company name |
| `payment_terms` | INT | TENANT | 30 | Payment terms (days) |

See `prisma/global-client/seeds/setting-definitions.ts` for full list.

---

## 📚 Full Documentation

See [SETTINGS_FEATURE.md](./SETTINGS_FEATURE.md) for:
- Complete architecture explanation
- Flutter implementation details
- UI/UX best practices
- Troubleshooting guide

---

## 🐛 Troubleshooting

**Settings not appearing in Flutter?**
→ Run `await settingsService.deltaSync()`

**Validation error when updating?**
→ Check `validationRules` in definition (e.g., allowed options)

**Need to reset a setting?**
→ Delete from tenant DB, it will fall back to `defaultValue`

---

## 📞 Support

For detailed documentation, see `SETTINGS_FEATURE.md`
For code reference, check `src/settings/` directory
