# Backend Localization Strategy

## Current Implementation (v1.0)

Currently, all push notification messages are **hardcoded in Indonesian** (Bahasa Indonesia) using the [notification-messages.ts](notification-messages.ts) file.

**Why Indonesian?**
- Primary target market is Indonesia
- Simplifies initial implementation
- No database changes required
- Zero performance overhead

---

## Future Localization Plan (v2.0+)

When you need to support multiple languages (English, Indonesian, etc.), here are the recommended approaches:

### **Approach 1: Client-Side Localization (Recommended)**

Send notification **keys** instead of translated text. Let the Flutter app translate based on user's language preference.

#### Backend Changes

```typescript
// Instead of sending translated text
{
  "title": "Penjualan Baru Selesai",
  "message": "Penjualan #123 - IDR 50000"
}

// Send translation keys with parameters
{
  "titleKey": "notification.sales.new_sale_completed.title",
  "messageKey": "notification.sales.new_sale_completed.message",
  "messageParams": {
    "saleId": 123,
    "amount": "50000"
  }
}
```

#### Flutter Changes

```dart
// pubspec.yaml
dependencies:
  flutter_localizations:
    sdk: flutter
  intl: ^0.18.0

// lib/l10n/app_en.arb (English)
{
  "notification_sales_new_sale_completed_title": "New Sale Completed",
  "notification_sales_new_sale_completed_message": "Sale #{saleId} - IDR {amount}",
  "@notification_sales_new_sale_completed_message": {
    "placeholders": {
      "saleId": { "type": "int" },
      "amount": { "type": "String" }
    }
  }
}

// lib/l10n/app_id.arb (Indonesian)
{
  "notification_sales_new_sale_completed_title": "Penjualan Baru Selesai",
  "notification_sales_new_sale_completed_message": "Penjualan #{saleId} - IDR {amount}"
}

// When notification arrives
Pushy.setNotificationListener((Map<String, dynamic> data) {
  final titleKey = data['titleKey'];
  final messageKey = data['messageKey'];
  final params = data['messageParams'];

  // Translate using user's language preference
  final title = AppLocalizations.of(context)!.translate(titleKey);
  final message = AppLocalizations.of(context)!.translate(
    messageKey,
    namedArgs: params
  );

  // Show local notification
  showLocalNotification(title, message);
});
```

#### Pros & Cons

✅ **Pros:**
- User language preference honored (some users prefer English)
- No backend changes when adding new languages
- No database migration required
- Zero backend performance impact
- Notification history can be displayed in different languages

❌ **Cons:**
- Requires Flutter app update
- Notification preview in OS (before app opens) may show raw keys
- More complex Flutter implementation

---

### **Approach 2: Database-Driven Localization**

Store user language preference in database and send translated text from backend.

#### Database Schema

```sql
-- Add language preference to TenantUser table
ALTER TABLE TENANT_USER ADD COLUMN LANGUAGE VARCHAR(5) DEFAULT 'id';
-- Options: 'id' (Indonesian), 'en' (English)
```

#### Backend Implementation

```typescript
// src/pushy/notification-messages.ts
export const NotificationMessages = {
  id: {  // Indonesian
    sales: {
      newSaleCompleted: {
        title: 'Penjualan Baru Selesai',
        message: (saleId: number, amount: string) =>
          `Penjualan #${saleId} - IDR ${amount}`
      }
    }
  },
  en: {  // English
    sales: {
      newSaleCompleted: {
        title: 'New Sale Completed',
        message: (saleId: number, amount: string) =>
          `Sale #${saleId} - IDR ${amount}`
      }
    }
  }
};

// Helper function to get user's language
async function getUserLanguage(tenantUserId: number): Promise<'id' | 'en'> {
  const user = await globalPrisma.tenantUser.findUnique({
    where: { id: tenantUserId },
    select: { language: true }
  });
  return (user?.language as 'id' | 'en') || 'id';  // Default to Indonesian
}

// Updated notification service
export async function sendNotificationToUser(
  tenantUserId: number,
  notificationKey: string,
  params: any
) {
  const language = await getUserLanguage(tenantUserId);
  const messages = NotificationMessages[language];

  // Access nested notification config
  const config = getNestedProperty(messages, notificationKey);

  await PushyService.sendToDevice(
    deviceToken,
    {
      title: config.title,
      message: config.message(...params)
    }
  );
}
```

#### Pros & Cons

✅ **Pros:**
- OS notification preview shows translated text
- No Flutter changes required
- Works even if user never opens the app

❌ **Cons:**
- Database migration required
- Additional database query per notification (can be cached)
- Backend code more complex
- Language change requires backend update

---

### **Approach 3: JWT-Based Localization (Hybrid)**

Store language preference in JWT token (no database query needed).

#### Implementation

```typescript
// 1. Add language to JWT payload during login
// src/auth/auth.service.ts
const jwtPayload = {
  userId: user.id,
  tenantId: tenantId,
  language: user.language || 'id',  // Add this
  // ... other fields
};

// 2. Extract language from userInfo in notification services
// src/pushy/notification.service.ts
export async function sendSalesNotification(
  userInfo: UserInfo,  // From JWT
  saleId: number,
  amount: string
) {
  const language = userInfo.language || 'id';
  const messages = NotificationMessages[language];

  await PushyService.sendToTopic(
    topic,
    {
      title: messages.sales.newSaleCompleted.title,
      message: messages.sales.newSaleCompleted.message(saleId, amount)
    }
  );
}
```

#### Pros & Cons

✅ **Pros:**
- No database query needed (language from JWT)
- Fast (zero database overhead)
- Language change takes effect on next login

❌ **Cons:**
- Language change requires re-login
- Database migration still needed
- Topic-based notifications tricky (multiple languages on same topic)

---

## Recommended Approach

For your use case, I recommend **Approach 1 (Client-Side Localization)** because:

1. **User Control**: Users can change language without backend changes
2. **Scalability**: Easy to add new languages (just update Flutter app)
3. **No Database Changes**: Avoid migration complexity
4. **Performance**: Zero backend overhead
5. **Flexibility**: Notification history can be displayed in different languages

### Implementation Roadmap

#### Phase 1: Preparation (Current)
- ✅ Extract notification messages to [notification-messages.ts](notification-messages.ts)
- ✅ Use Indonesian as default language
- ✅ Structure code for easy migration

#### Phase 2: Client-Side Implementation (When needed)
1. Add `flutter_localizations` to Flutter project
2. Create `app_en.arb` and `app_id.arb` files
3. Update backend to send translation keys instead of text:
   ```typescript
   // Before
   { title: "Penjualan Baru", message: "Penjualan #123" }

   // After
   {
     titleKey: "notification.sales.new_sale.title",
     messageKey: "notification.sales.new_sale.message",
     messageParams: { saleId: 123 }
   }
   ```
4. Update Flutter notification handler to translate keys
5. Add language picker in Flutter settings

#### Phase 3: Testing
- Test notifications in both languages
- Verify parameter interpolation works
- Check notification history display

---

## Alternative: Topic-Based Language Segmentation

If you need OS-level translated notifications (before app opens), use language-specific topics:

```typescript
// Instead of:
tenant_1_outlet_1_sales

// Use:
tenant_1_outlet_1_sales_id  // Indonesian users
tenant_1_outlet_1_sales_en  // English users

// Subscribe based on user's language preference
const language = userInfo.language || 'id';
const topic = `tenant_${tenantId}_outlet_${outletId}_sales_${language}`;
```

**Trade-off**: More topics = more Pushy API calls = higher cost

---

## Code Example: Migration to Client-Side Localization

### Step 1: Update Backend to Send Keys

```typescript
// src/pushy/notification-messages.ts
export const NotificationKeys = {
  sales: {
    newSaleCompleted: {
      titleKey: 'notification.sales.new_sale_completed.title',
      messageKey: 'notification.sales.new_sale_completed.message'
    }
  }
};

// src/sales/sales.service.ts
sendSalesNotification(
  tenantId,
  salesBody.outletId,
  {
    titleKey: NotificationKeys.sales.newSaleCompleted.titleKey,
    messageKey: NotificationKeys.sales.newSaleCompleted.messageKey,
    messageParams: {
      saleId: result.id,
      amount: new Decimal(result.totalAmount).toFixed(0)
    }
  },
  {
    type: 'sale_completed',
    salesId: result.id,
    // ...
  }
);
```

### Step 2: Update Flutter to Translate

```dart
// lib/services/notification_handler.dart
void handleNotification(Map<String, dynamic> payload) {
  final titleKey = payload['titleKey'];
  final messageKey = payload['messageKey'];
  final params = payload['messageParams'] ?? {};

  // Get user's language preference from SharedPreferences
  final language = Prefs.getLanguage(); // 'id' or 'en'

  // Translate
  final title = I18n.translate(titleKey, language);
  final message = I18n.translate(messageKey, language, params);

  // Show notification
  NotificationService.show(title, message, payload['data']);
}
```

---

## Summary

**Current (v1.0):** Indonesian hardcoded ✅
**Future (v2.0):** Client-side translation with keys 🎯
**Alternative:** Database-driven (if OS preview critical) 🤔

Choose based on your priorities:
- **Performance first?** → Client-side (Approach 1)
- **OS preview critical?** → Database-driven (Approach 2)
- **Quick wins?** → Stay with Indonesian (current approach)

---

## Testing Localization

```bash
# Test Indonesian notifications (current)
curl -X POST http://localhost:3000/api/sales \
  -H "Authorization: Bearer <token>" \
  -d '{ "items": [...] }'

# Expected notification:
# Title: "Penjualan Baru Selesai"
# Message: "Penjualan #123 - IDR 50000"

# After implementing client-side localization:
# Backend sends:
{
  "titleKey": "notification.sales.new_sale_completed.title",
  "messageKey": "notification.sales.new_sale_completed.message",
  "messageParams": { "saleId": 123, "amount": "50000" }
}

# Flutter translates to:
# (if language = 'id')  "Penjualan Baru Selesai"
# (if language = 'en')  "New Sale Completed"
```

---

## Resources

- [Flutter Internationalization](https://docs.flutter.dev/development/accessibility-and-localization/internationalization)
- [ARB File Format](https://github.com/google/app-resource-bundle/wiki/ApplicationResourceBundleSpecification)
- [Pushy Multi-Language Guide](https://pushy.me/docs/guides/multi-language)
- [i18n Best Practices](https://www.i18next.com/principles/fallback)
