# Device Fingerprinting for Pushy Push Notifications

> **🆕 For Frontend Team**: Jump to [API Reference Summary](#summary-of-api-changes-for-frontend-team) for quick integration guide

## Table of Contents

- [Overview](#overview)
- [The Problem](#the-problem)
- [The Solution](#the-solution)
- [Backend Implementation](#backend-implementation)
- [Frontend Implementation (Flutter)](#frontend-implementation-flutter)
- [API Reference](#api-reference) ⭐ **Frontend Team Start Here**
- [Deployment Guide](#deployment-guide)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Quick Reference: New API Fields

| Endpoint                        | New Field                  | Type    | Location     | Required | Purpose                                 |
| ------------------------------- | -------------------------- | ------- | ------------ | -------- | --------------------------------------- |
| `GET /pushy/devices/checkQuota` | `deviceFingerprint`        | string  | Query Param  | Optional | Detect if device already registered     |
| `GET /pushy/devices/checkQuota` | `isReinstall`              | boolean | Response     | -        | Indicates reinstall scenario            |
| `GET /pushy/devices/checkQuota` | `existingDevice`           | object  | Response     | -        | Existing device info (when reinstall)   |
| `POST /pushy/devices/register`  | `deviceFingerprint`        | string  | Request Body | **Yes**  | Persistent device identifier            |
| `POST /pushy/devices/register`  | `isReinstall`              | boolean | Response     | -        | `true` if token updated, `false` if new |
| `POST /pushy/devices/register`  | `device.deviceFingerprint` | string  | Response     | -        | Echo back fingerprint                   |

---

## Overview

This document explains the **Device Fingerprinting** solution implemented to solve the app reinstallation problem with Pushy push notifications.

**What it solves**: Prevents duplicate device records when users reinstall the app, keeping device quota accurate.

**How it works**: Uses a persistent hardware-based device identifier (fingerprint) that survives app reinstallation.

---

## The Problem

### Before Device Fingerprinting

When a user reinstalls the Flutter app:

1. **User installs app** → calls `Pushy.register()` → gets `deviceToken` (e.g., `token-abc123`) → registers with backend
2. **User reinstalls app** (without unregistering)
3. **App calls `Pushy.register()` again** → **Pushy returns a NEW deviceToken** (e.g., `token-xyz789`)
4. **Backend sees this as a "new device"** and creates a duplicate record
5. **Old device record becomes "zombie"** - still in DB but never used again
6. **This wastes device quota slots** and causes billing issues

### The Root Cause

- **Pushy device tokens are NOT persistent** across app reinstallations
- Backend has no way to know that `token-abc123` and `token-xyz789` are the same physical device
- This leads to:
  - Multiple device records for the same physical device
  - Inaccurate device quota counting
  - Users hitting device limits unnecessarily
  - Zombie device records cluttering the database

---

## The Solution

### Concept

Use a **persistent device identifier (fingerprint)** that survives app reinstallation, separate from the Pushy token.

- **Device Fingerprint**: Hardware-based ID that persists across app reinstalls
- **Pushy Token**: Changes on every `Pushy.register()` call (reinstall)
- **Strategy**: Use fingerprint to identify the device, update Pushy token on reinstall

### Flow Comparison

```
┌─────────────────────────────────────────────────────────────────┐
│ First Install                                                   │
├─────────────────────────────────────────────────────────────────┤
│ 1. Get device fingerprint: "android-abc123" (persists)         │
│ 2. Check eligibility: GET /devices/checkQuota?deviceFingerprint │
│    Response: canRegister=true, isReinstall=false               │
│ 3. Call Pushy.register() → deviceToken: "pushy-token-111"      │
│ 4. Register: POST /devices/register                            │
│    { deviceToken: "pushy-token-111",                           │
│      deviceFingerprint: "android-abc123" }                     │
│ 5. Backend creates new device record                            │
│    Device count: 1/5                                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Reinstall (Same Device)                                         │
├─────────────────────────────────────────────────────────────────┤
│ 1. Get device fingerprint: "android-abc123" (SAME!)            │
│ 2. Check eligibility: GET /devices/checkQuota?deviceFingerprint │
│    Response: canRegister=true, isReinstall=true ✅             │
│ 3. Call Pushy.register() → deviceToken: "pushy-token-222" (NEW)│
│ 4. Register: POST /devices/register                            │
│    { deviceToken: "pushy-token-222",                           │
│      deviceFingerprint: "android-abc123" }                     │
│ 5. Backend UPDATES existing device record (token rotation)     │
│    Device count: 1/5 (STAYS THE SAME!) ✅                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Backend Implementation

### 1. Database Schema Changes

**File**: `prisma/global-client/schema.prisma`

```prisma
model PushyDevice {
  id                Int                    @id @default(autoincrement()) @map("ID")
  tenantUserId      Int                    @map("TENANT_USER_ID")
  deviceToken       String                 @unique @map("DEVICE_TOKEN") // Can change on reinstall
  deviceFingerprint String?                @map("DEVICE_FINGERPRINT") // NEW: Persists across reinstall
  platform          String                 @map("PLATFORM")
  deviceName        String?                @map("DEVICE_NAME")
  appVersion        String?                @map("APP_VERSION")
  isActive          Boolean                @default(true) @map("IS_ACTIVE")
  lastActiveAt      DateTime?              @map("LAST_ACTIVE_AT")
  createdAt         DateTime               @default(now()) @map("CREATED_AT")
  updatedAt         DateTime               @updatedAt @map("UPDATED_AT")
  tenantUser        TenantUser             @relation(fields: [tenantUserId], references: [id])
  subscriptions     PushySubscription[]
  allocation        PushyDeviceAllocation?

  @@unique([tenantUserId, deviceFingerprint], name: "unique_user_device_fingerprint")
  @@index([tenantUserId])
  @@index([deviceToken])
  @@index([deviceFingerprint])
  @@map("pushy_device")
}
```

**Key Changes**:

- ✅ Added `deviceFingerprint` field (nullable for backward compatibility)
- ✅ Added unique constraint: one fingerprint per user
- ✅ Added index on `deviceFingerprint` for fast lookups

### 2. Backend API Changes

#### File Modified: `src/pushy/device.controller.ts`

Two endpoints were updated:

1. **`checkDeviceEligibility()`** - Now accepts `deviceFingerprint` query parameter
2. **`registerDevice()`** - Now requires `deviceFingerprint` in request body

#### Registration Logic Flow

```typescript
// STEP 1: Check if device with same FINGERPRINT exists for this user
const existingDeviceByFingerprint = await prisma.pushyDevice.findFirst({
  where: {
    tenantUserId: userInfo.tenantUserId,
    deviceFingerprint: deviceFingerprint,
  },
});

if (existingDeviceByFingerprint) {
  // REINSTALL: Update the Pushy token (token rotation)
  await prisma.pushyDevice.update({
    where: { id: existingDeviceByFingerprint.id },
    data: {
      deviceToken: deviceToken, // Update to new token
      platform: platform,
      isActive: true,
      lastActiveAt: new Date(),
    },
  });

  return {
    message: "Device token updated successfully",
    isReinstall: true,
    // Device count stays the same!
  };
}

// STEP 2: Check if device with same TOKEN exists (edge case)
const existingDeviceByToken = await prisma.pushyDevice.findUnique({
  where: { deviceToken: deviceToken },
});

if (existingDeviceByToken) {
  // Token collision or upgrading from old version
  // Update the fingerprint
  // ...
}

// STEP 3: NEW DEVICE - Check quota
const limitCheck = await checkDeviceLimit(userInfo.tenantId);

if (!limitCheck.canAddDevice) {
  return error("Device limit reached");
}

// STEP 4: Create new device
await prisma.pushyDevice.create({
  data: {
    tenantUserId: userInfo.tenantUserId,
    deviceToken: deviceToken,
    deviceFingerprint: deviceFingerprint,
    // ...
  },
});
```

---

## Frontend Implementation (Flutter)

### 1. Install Required Package

Add `device_info_plus` to your `pubspec.yaml`:

```yaml
dependencies:
  device_info_plus: ^9.0.0 # or latest version
  pushy_flutter: ^2.0.0 # your existing Pushy package
```

Run:

```bash
flutter pub get
```

### 2. Create Device Fingerprint Helper

Create a new file: `lib/services/device_fingerprint_service.dart`

```dart
import 'package:device_info_plus/device_info_plus.dart';
import 'dart:io';

class DeviceFingerprintService {
  /// Get a persistent device fingerprint that survives app reinstallation
  ///
  /// Android: Uses Android ID (persists across reinstalls since Android 8.0)
  /// iOS: Uses identifierForVendor (persists until all vendor apps are deleted)
  ///
  /// Returns: String in format "platform-identifier" (e.g., "android-abc123xyz")
  static Future<String> getDeviceFingerprint() async {
    try {
      final deviceInfo = DeviceInfoPlugin();

      if (Platform.isAndroid) {
        final androidInfo = await deviceInfo.androidInfo;
        // Android ID persists across reinstalls (since Android 8.0)
        // Note: Changes on factory reset (this is expected behavior)
        return 'android-${androidInfo.id}';
      } else if (Platform.isIOS) {
        final iosInfo = await deviceInfo.iosInfo;
        // identifierForVendor persists until all apps from this vendor are deleted
        // May be null if it's the only app from the vendor
        final identifier = iosInfo.identifierForVendor ??
                          '${iosInfo.systemName}-${iosInfo.model}-fallback';
        return 'ios-$identifier';
      } else if (Platform.isWindows || Platform.isLinux || Platform.isMacOS) {
        // For desktop platforms (future support)
        return 'desktop-${Platform.operatingSystem}';
      } else {
        // Web or other platforms
        return 'web-unknown';
      }
    } catch (e) {
      print('Error getting device fingerprint: $e');
      // Fallback: Use a combination of platform info
      return 'fallback-${Platform.operatingSystem}-${DateTime.now().millisecondsSinceEpoch}';
    }
  }

  /// Get device name for display purposes
  static Future<String> getDeviceName() async {
    try {
      final deviceInfo = DeviceInfoPlugin();

      if (Platform.isAndroid) {
        final androidInfo = await deviceInfo.androidInfo;
        return '${androidInfo.manufacturer} ${androidInfo.model}';
      } else if (Platform.isIOS) {
        final iosInfo = await deviceInfo.iosInfo;
        return '${iosInfo.name} (${iosInfo.model})';
      }

      return 'Unknown Device';
    } catch (e) {
      return 'Unknown Device';
    }
  }
}
```

---

## API Reference

### 🆕 Summary of API Changes for Frontend Team

**What Changed:**

1. **New required field**: `deviceFingerprint` must be sent in device registration requests
2. **New query parameter**: `deviceFingerprint` can be sent when checking eligibility
3. **New response fields**: `isReinstall` and `existingDevice` added to responses

**Key Fields to Implement:**

| Field               | Type    | Where              | Required     | Description                                      |
| ------------------- | ------- | ------------------ | ------------ | ------------------------------------------------ |
| `deviceFingerprint` | string  | Request Body/Query | Yes/Optional | Persistent device ID (e.g., "android-abc123xyz") |
| `isReinstall`       | boolean | Response           | -            | `true` = reinstall, `false` = new device         |
| `existingDevice`    | object  | Response           | -            | Device info (only when `isReinstall: true`)      |

**Frontend Action Items:**

1. ✅ Add `device_info_plus` package to get device fingerprint
2. ✅ Include `deviceFingerprint` in check eligibility request
3. ✅ Include `deviceFingerprint` in register device request
4. ✅ Handle `isReinstall` flag in response (for logging/analytics)

---

### 1. Check Device Eligibility

**Endpoint**: `GET /pushy/devices/checkQuota`

**🆕 API Changes**: Now accepts `deviceFingerprint` query parameter to detect reinstalls

**Query Parameters**:

- `deviceFingerprint` (string, optional) **🆕 NEW**: Persistent device identifier that survives app reinstallation

**Headers**:

```
Authorization: Bearer <jwt_token>
```

**🆕 New Response Fields**:

- `isReinstall` (boolean) **🆕 NEW**: `true` if this is a reinstall of an existing device, `false` for new device
- `existingDevice` (object, optional) **🆕 NEW**: Information about the existing device (only present when `isReinstall: true`)

**Response (New Device)**:

```json
{
  "success": true,
  "canRegister": true,
  "reason": "Device registration allowed",
  "isReinstall": false, // 🆕 NEW FIELD
  "deviceUsage": {
    "current": 3,
    "maximum": 5
  },
  "requiresPayment": false,
  "additionalCost": 0
}
```

**Response (Reinstall)**:

```json
{
  "success": true,
  "canRegister": true,
  "reason": "Existing device will be reactivated",
  "isReinstall": true, // 🆕 NEW FIELD - Indicates reinstall
  "existingDevice": {
    // 🆕 NEW FIELD - Only present when isReinstall=true
    "id": 123,
    "deviceName": "Samsung Galaxy S21",
    "platform": "android",
    "lastActiveAt": "2024-01-10T08:30:00Z"
  },
  "deviceUsage": {
    "current": 3,
    "maximum": 5
  },
  "requiresPayment": false,
  "additionalCost": 0
}
```

**Response (Limit Reached)**:

```json
{
  "success": true,
  "canRegister": false,
  "reason": "Device limit reached. Purchase additional device slot for IDR 19.000/month",
  "isReinstall": false, // 🆕 NEW FIELD
  "deviceUsage": {
    "current": 5,
    "maximum": 5
  },
  "requiresPayment": true,
  "additionalCost": 19000
}
```

### 2. Register Device

**Endpoint**: `POST /pushy/devices/register`

**🆕 API Changes**: Now requires `deviceFingerprint` in request body and returns `isReinstall` flag

**Headers**:

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body**:

```json
{
  "deviceToken": "pushy-token-xyz123",
  "deviceFingerprint": "android-abc123", // 🆕 NEW FIELD - Required
  "platform": "android",
  "deviceName": "Samsung Galaxy S21",
  "appVersion": "1.0.5"
}
```

**Field Descriptions**:

- `deviceToken` (string, required): Pushy device token from `Pushy.register()`
- `deviceFingerprint` (string, required) **🆕 NEW**: Persistent device identifier that survives app reinstallation
- `platform` (string, required): One of "android", "ios", "web"
- `deviceName` (string, optional): Human-readable device name
- `appVersion` (string, optional): App version number

**🆕 New Response Fields**:

- `isReinstall` (boolean) **🆕 NEW**: `true` if device token was updated (reinstall), `false` if new device created
- `device.deviceFingerprint` (string) **🆕 NEW**: Echo back the device fingerprint

**Response (New Device)**:

```json
{
  "success": true,
  "message": "Device registered successfully",
  "isReinstall": false, // 🆕 NEW FIELD - false for new device
  "device": {
    "id": 124,
    "deviceToken": "pushy-token-xyz123",
    "deviceFingerprint": "android-abc123", // 🆕 NEW FIELD
    "platform": "android",
    "isActive": true
  },
  "subscribedTopics": ["tenant_1", "tenant_1_sales", "tenant_1_user_456"],
  "deviceUsage": {
    "current": 4, // Increased from 3 to 4 (new device added)
    "maximum": 5
  }
}
```

**Response (Reinstall)**:

```json
{
  "success": true,
  "message": "Device token updated successfully", // Different message for reinstall
  "isReinstall": true, // 🆕 NEW FIELD - true for reinstall
  "device": {
    "id": 123, // Same device ID as before
    "deviceToken": "pushy-token-xyz123", // Updated token
    "deviceFingerprint": "android-abc123", // 🆕 NEW FIELD - Same fingerprint
    "platform": "android",
    "isActive": true
  },
  "subscribedTopics": ["tenant_1", "tenant_1_sales", "tenant_1_user_456"],
  "deviceUsage": {
    "current": 3, // Count stays the same! (not 4)
    "maximum": 5
  }
}
```

**Error Response (Limit Reached)**:

```json
{
  "success": false,
  "error": {
    "errorType": "BusinessLogicError",
    "errorMessage": "Device limit reached. Purchase additional device slot for IDR 19.000/month"
  }
}
```

**Error Response (Missing Fingerprint)**:

```json
{
  "success": false,
  "error": {
    "errorType": "RequestValidateError",
    "errorMessage": "Device fingerprint is required"
  }
}
```

---

## Testing

### Backend Testing

#### Test 1: Check Eligibility (New Device)

```bash
curl -X GET \
  'http://localhost:3000/pushy/devices/checkQuota?deviceFingerprint=test-android-123' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Test 2: Register New Device

```bash
curl -X POST \
  'http://localhost:3000/pushy/devices/register' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "deviceToken": "pushy-token-test-123",
    "deviceFingerprint": "test-android-123",
    "platform": "android",
    "deviceName": "Test Device",
    "appVersion": "1.0.0"
  }'
```

#### Test 3: Check Eligibility (Existing Device)

```bash
curl -X GET \
  'http://localhost:3000/pushy/devices/checkQuota?deviceFingerprint=test-android-123' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

**Expected**: `isReinstall: true`

#### Test 4: Register Existing Device (Token Rotation)

```bash
curl -X POST \
  'http://localhost:3000/pushy/devices/register' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "deviceToken": "pushy-token-NEW-456",
    "deviceFingerprint": "test-android-123",
    "platform": "android",
    "deviceName": "Test Device",
    "appVersion": "1.0.1"
  }'
```

**Expected**: `isReinstall: true`, device count stays the same

### Frontend Testing Scenarios

#### Scenario 1: First Install (New Device)

1. Install app on fresh device
2. Login
3. Check logs: "Registering new device"
4. Verify: Device count increases

#### Scenario 2: Reinstall (Same Device)

1. Uninstall app (without logging out)
2. Reinstall app
3. Login
4. Check logs: "Reactivating existing device"
5. Verify: Device count stays the same

#### Scenario 3: Different User, Same Device

1. Logout User A
2. Login User B (same device)
3. Check: Creates new device for User B
4. Verify: User A and User B have separate device records

#### Scenario 4: Upgrading from Old Version

1. User has old app version (no fingerprint)
2. Update to new version
3. Login
4. Check: Fingerprint added to existing device
5. Verify: Device count stays the same

---

## Troubleshooting

#### Issue: Unique Constraint Violation

**Symptom**: Error when registering device with existing fingerprint

**Solution**: This is expected behavior. The code should handle this by updating the token instead of creating new record. Check your implementation.

### Frontend Issues

#### Issue: identifierForVendor returns null on iOS

**Symptom**: iOS device fingerprint is null or empty

**Cause**: iOS can return null if it's the only app from the vendor

**Solution**: Use a fallback combination of identifiers:

```dart
String iosFingerprint = iosInfo.identifierForVendor ??
  'ios-${iosInfo.systemName}-${iosInfo.model}-${iosInfo.identifierForVendor?.hashCode ?? "unknown"}';
```

#### Issue: Android ID changes on factory reset

**Symptom**: Device treated as new after factory reset

**Cause**: Android ID is reset on factory reset

**Solution**: This is expected behavior. Factory reset = new device from quota perspective.

#### Issue: Device limit reached on reinstall

**Symptom**: User gets "device limit reached" error after reinstalling

**Cause**: Old zombie devices without fingerprints still count toward quota

**Solution**: Clean up zombie devices:

```sql
-- Find zombie devices (inactive, no fingerprint, old)
SELECT * FROM pushy_device
WHERE IS_ACTIVE = false
  AND DEVICE_FINGERPRINT IS NULL
  AND LAST_ACTIVE_AT < DATE_SUB(NOW(), INTERVAL 30 DAY);

-- Cleanup (be careful!)
DELETE FROM pushy_device_allocation
WHERE DEVICE_ID IN (
  SELECT ID FROM pushy_device
  WHERE IS_ACTIVE = false
    AND DEVICE_FINGERPRINT IS NULL
    AND LAST_ACTIVE_AT < DATE_SUB(NOW(), INTERVAL 30 DAY)
);
```

---

## Benefits Summary

✅ **Solves the reinstall problem**

- No duplicate device records on app reinstall
- Pushy token rotation handled seamlessly
- Device quota count stays accurate

✅ **Maintains cost optimization**

- Frontend checks eligibility BEFORE calling `Pushy.register()`
- Reinstalls don't trigger unnecessary Pushy billing
- No new device created on reinstall

✅ **Backward compatible**

- Nullable `deviceFingerprint` field
- Existing devices continue to work
- Gradual migration on next login

✅ **Handles edge cases**

- Token collision (rare)
- Upgrading from old version without fingerprint
- Multiple users on same device (different tenants)

---

## Future Enhancements

1. **Admin Endpoint**: Add endpoint to manually merge duplicate devices
2. **Cleanup Job**: Automated cleanup of zombie devices (inactive > 90 days)
3. **Analytics**: Track reinstall rates and token rotation frequency
4. **Web Support**: Implement browser fingerprinting for web platform

---

**Last Updated**: 2025-01-15
**Version**: 1.0.0
**Related Docs**: [PUSHY_IMPLEMENTATION.md](./PUSHY_IMPLEMENTATION.md)
