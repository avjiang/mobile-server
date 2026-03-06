# App Version Control Documentation

This document outlines the architecture, API endpoints, and client-side implementation guide for the App Version Control feature.

## Overview
The App Version Control feature allows the backend to enforce or suggest app updates to users. This ensures critical bug fixes and features are adopted by the user base.

## Database Schema
The feature uses the `AppVersion` model in the **Global Database**.

```prisma
model AppVersion {
  id            Int      @id @default(autoincrement()) @map("ID")
  platform      String   @unique @map("PLATFORM") // 'android' or 'ios'
  minVersion    String   @map("MIN_VERSION")      // Minimum demanded version
  latestVersion String   @map("LATEST_VERSION")   // Latest available version
  storeUrl      String?  @map("STORE_URL")        // URL to App Store / Play Store
  createdAt     DateTime @default(now()) @map("CREATED_AT")
  updatedAt     DateTime @updatedAt @map("UPDATED_AT")

  @@map("app_version")
}
```

## API Endpoints

### 1. Check App Version (Public)
Used by the mobile app to check for updates.

**Endpoint:** `GET /version/check`
**Query Parameters:**
- `platform`: `android` or `ios` (Required)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "platform": "android",
    "minVersion": "1.0.0",
    "latestVersion": "1.2.0",
    "storeUrl": "https://play.google.com/store/apps/details?id=com.example.app",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 2. Get All Versions (Admin)
Used by the admin panel to view current version configurations.

**Endpoint:** `GET /admin/versions`
**Auth:** Required (Admin Token)

**Response:**
```json
{
  "success": true,
  "data": [
    { "platform": "android", ... },
    { "platform": "ios", ... }
  ]
}
```

### 3. Update Version (Admin)
Used by the admin panel to update version configurations.

**Endpoint:** `PUT /admin/versions`
**Auth:** Required (Admin Token)
**Body:**
```json
{
  "platform": "android",
  "minVersion": "1.0.0",
  "latestVersion": "1.2.0",
  "storeUrl": "https://..."
}
```

## Client-Side Implementation Guide

The mobile app is responsible for comparing its local version with the server response to determine the update type.

### Logic Flow

1.  **Fetch Config**: Call `GET /version/check?platform={platform}`.
2.  **Compare Versions**:
    *   **Force Update**: If `localVersion < response.minVersion`
        *   Action: Show non-dismissible dialog. Redirect to `storeUrl`.
    *   **Optional Update**: If `response.minVersion <= localVersion < response.latestVersion`
        *   Action: Show dismissible dialog (e.g., "Update Now" / "Later"). Redirect to `storeUrl` on confirm.
    *   **No Update**: If `localVersion >= response.latestVersion`
        *   Action: Do nothing.

### Example Scenarios

| Server Config | User Version | Action | Reason |
| :--- | :--- | :--- | :--- |
| `min: 2.0.0`, `latest: 3.0.0` | `1.5.0` | **Force Update** | User is below minimum supported version. |
| `min: 2.0.0`, `latest: 3.0.0` | `2.5.0` | **Optional Update** | User is supported but not on latest. |
| `min: 2.0.0`, `latest: 3.0.0` | `3.0.0` | **No Action** | User is on latest version. |

### Version Comparison Note
Use a Semantic Versioning library (e.g., `pub_semver` in Flutter) to compare version strings correctly.
**Do not** use simple string comparison (e.g., "1.10.0" < "1.2.0" is false alphabetically but true semantically).
