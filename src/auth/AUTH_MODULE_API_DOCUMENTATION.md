# Authentication Module API Documentation

This document provides comprehensive documentation for the Authentication Module, including user login, token management, and session handling.

---

## Table of Contents

1. [Overview](#1-overview)
2. [API Endpoints](#2-api-endpoints)
3. [Request/Response Interfaces](#3-requestresponse-interfaces)
4. [Authentication Flow](#4-authentication-flow)
5. [JWT Token Structure](#5-jwt-token-structure)
6. [Refresh Token Mechanism](#6-refresh-token-mechanism)
7. [Database Architecture](#7-database-architecture)
8. [Middleware Integration](#8-middleware-integration)
9. [Notification Topics](#9-notification-topics)
10. [Error Handling](#10-error-handling)
11. [Security Considerations](#11-security-considerations)

---

## 1. Overview

### Module Purpose

The Authentication Module handles all aspects of user authentication and session management for a multi-tenant POS system. It manages:

- User login and credential verification
- JWT token generation and validation
- Refresh token lifecycle
- Session revocation (logout)
- Role-based access control

### File Structure

```
src/auth/
├── auth.service.ts      # Core authentication logic
├── auth.controller.ts   # Express route handlers
├── auth.request.ts      # Request body interfaces
├── auth.response.ts     # Response body interfaces
├── auth.v2.service.ts   # Deprecated (commented out)
└── auth.v2.controller.ts # Deprecated (commented out)
```

### Base URL

All endpoints are prefixed with:

```
/auth
```

---

## 2. API Endpoints

### 2.1 User Login

**Endpoint:** `POST /auth/login`

**Description:** Authenticates a user and returns JWT and refresh tokens.

**Authentication:** Not required

**Request Body:**

```json
{
  "username": "john_doe",
  "password": "SecurePassword123!"
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `username` | string | Yes | User's username (globally unique) |
| `password` | string | Yes | User's password |

**Response (Success - 200):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenExpiryDate": "2025-01-22T10:00:00.000Z",
  "refreshToken": "a1b2c3d4e5f6g7h8i9j0...",
  "globalTenantId": 1,
  "globalTenantUserId": 5,
  "userId": 3,
  "notificationTopics": ["tenant_1", "tenant_1_outlet_1_sales"],
  "planName": "Pro",
  "databaseName": "my_coffee_shop_db",
  "globalOutletId": 1
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `token` | string | JWT token for API authorization |
| `tokenExpiryDate` | string | ISO 8601 timestamp when token expires |
| `refreshToken` | string | Token for obtaining new JWT |
| `globalTenantId` | number | Tenant ID in global database |
| `globalTenantUserId` | number | User ID in global TenantUser table |
| `userId` | number | User ID in tenant-specific database |
| `notificationTopics` | string[] | Firebase Cloud Messaging topics (Pro plan only) |
| `planName` | string | Subscription plan name (`Trial`, `Basic`, `Pro`) |
| `databaseName` | string | Tenant database name for API context |
| `globalOutletId` | number | Outlet ID in global database |

**Error Response (400 - Invalid Credentials):**

```json
{
  "error": "Username or password is incorrect"
}
```

**Error Response (400 - User Not in Tenant DB):**

```json
{
  "error": "User not found in tenant database"
}
```

---

### 2.2 Validate Token

**Endpoint:** `POST /auth/validate-token`

**Description:** Verifies if a JWT token is valid and not expired.

**Authentication:** Not required

**Request Body:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (Success - 200):**

```json
{
  "verified": true,
  "tenantUserId": 5,
  "userId": 3,
  "username": "john_doe"
}
```

**Error Response (401 - Invalid Token):**

```json
{
  "error": "Invalid token"
}
```

---

### 2.3 Refresh Token

**Endpoint:** `POST /auth/refresh-token`

**Description:** Exchanges a valid refresh token for a new JWT and refresh token pair.

**Authentication:** Not required

**Request Body:**

```json
{
  "refreshToken": "a1b2c3d4e5f6g7h8i9j0..."
}
```

**Response (Success - 200):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenExpiryDate": "2025-01-23T10:00:00.000Z",
  "refreshToken": "new_refresh_token_here...",
  "globalTenantId": 1,
  "globalTenantUserId": 5,
  "userId": 3,
  "notificationTopics": ["tenant_1", "tenant_1_outlet_1_sales"],
  "planName": "Pro",
  "databaseName": "my_coffee_shop_db",
  "globalOutletId": 1
}
```

**Error Response (400 - Invalid Refresh Token):**

```json
{
  "error": "Invalid refresh token"
}
```

**Notes:**

- The old refresh token is automatically revoked
- A new refresh token is generated with a fresh expiration
- Token rotation ensures security

---

### 2.4 Revoke Token (Logout)

**Endpoint:** `POST /auth/revoke-token`

**Description:** Invalidates a refresh token, effectively logging out the user session.

**Authentication:** Required (JWT in `token` header)

**Request Body:**

```json
{
  "refreshToken": "a1b2c3d4e5f6g7h8i9j0..."
}
```

**Response (Success - 200):**

```json
{
  "id": 123,
  "tenantUserId": 5,
  "token": "a1b2c3d4e5f6g7h8i9j0...",
  "expired": "2025-01-22T10:00:00.000Z",
  "created": "2025-01-21T10:00:00.000Z",
  "createdByIP": "192.168.1.100",
  "revoked": "2025-01-21T12:00:00.000Z",
  "deleted": true
}
```

**Notes:**

- Requires valid JWT token in header
- Marks refresh token as revoked and deleted
- Used for explicit logout functionality

---

### 2.5 Get Refresh Tokens

**Endpoint:** `GET /auth/:id/refresh-tokens`

**Description:** Retrieves all refresh tokens for a specific user (for session management).

**Authentication:** Required (JWT in `token` header)

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | User ID (tenantUserId) |

**Response (Success - 200):**

```json
[
  {
    "id": 123,
    "tenantUserId": 5,
    "token": "a1b2c3d4e5f6g7h8i9j0...",
    "expired": "2025-01-22T10:00:00.000Z",
    "created": "2025-01-21T10:00:00.000Z",
    "createdByIP": "192.168.1.100",
    "revoked": null,
    "deleted": false
  },
  {
    "id": 124,
    "tenantUserId": 5,
    "token": "k1l2m3n4o5p6q7r8s9t0...",
    "expired": "2025-01-23T14:00:00.000Z",
    "created": "2025-01-22T14:00:00.000Z",
    "createdByIP": "192.168.1.105",
    "revoked": null,
    "deleted": false
  }
]
```

---

## 3. Request/Response Interfaces

### Request Interfaces

```typescript
// Login request
interface AuthenticateRequestBody {
  username: string;
  password: string;
}

// Token validation request
interface TokenRequestBody {
  token: string;
}

// Refresh token request
interface RefreshTokenRequestBody {
  refreshToken: string;
}

// Password change request (used in account module)
interface ChangePasswordRequestBody {
  userId: number;
  currentPassword: string;
  newPassword: string;
}
```

### Response Interfaces

```typescript
// Login/Refresh response
interface TokenResponseBody {
  token: string;
  tokenExpiryDate: string;
  refreshToken: string;
  globalTenantId: number;
  globalTenantUserId: number;
  userId: number;
  notificationTopics?: string[];
  planName?: string | null;
  databaseName?: string | null;
  globalOutletId?: number | null;
}

// Token validation response
interface ValidateTokenResponseBody {
  verified: boolean;
  tenantUserId: number;
  userId: number;
  username: string;
}
```

---

## 4. Authentication Flow

### Login Flow Diagram

```
CLIENT                           SERVER
   |                                |
   |  POST /auth/login              |
   |  { username, password }        |
   |------------------------------->|
   |                                |
   |                    Query Global DB: TenantUser
   |                    Verify password (bcrypt)
   |                    Query Tenant DB: User
   |                    Generate JWT token
   |                    Generate refresh token
   |                    Store refresh token in DB
   |                                |
   |  TokenResponseBody             |
   |<-------------------------------|
   |                                |
   |  Subsequent requests           |
   |  Header: token = JWT           |
   |------------------------------->|
   |                                |
   |                    Verify JWT
   |                    Extract UserInfo
   |                    Process request
   |                                |
```

### Step-by-Step Login Process

1. **Receive Credentials:** Server receives username and password
2. **Lookup User:** Query global database `TenantUser` table by username
3. **Verify Password:** Compare password using bcrypt
4. **Get Tenant User:** Query tenant-specific database for user details
5. **Fetch Subscription Info:** Get plan name and outlet ID
6. **Generate Notification Topics:** For Pro plan users, generate FCM topics
7. **Create JWT:** Sign UserInfo payload with secret, 1-day expiry
8. **Create Refresh Token:** Generate random 80-char hex string
9. **Store Refresh Token:** Save to global database with IP address
10. **Return Response:** Send tokens and metadata to client

---

## 5. JWT Token Structure

### UserInfo Payload

```typescript
interface UserInfo {
  tenantUserId: number;     // ID in global TenantUser table
  userId: number;           // ID in tenant User table
  username: string;         // Username
  databaseName: string;     // Tenant database name
  tenantId: number;         // Tenant ID
  role: string;             // "admin" or "user"
  notificationTopics?: string[];  // FCM topics (Pro plan only)
  planName?: string | null; // Subscription plan name
}
```

### Token Properties

| Property | Value |
|----------|-------|
| **Algorithm** | HS256 (HMAC SHA-256) |
| **Expiration** | 1 day |
| **Secret** | Stored in `config.json` as `jwt_token_secret` |

### Decoded Token Example

```json
{
  "user": {
    "tenantUserId": 5,
    "userId": 3,
    "username": "john_doe",
    "databaseName": "my_coffee_shop_db",
    "tenantId": 1,
    "role": "user",
    "notificationTopics": ["tenant_1", "tenant_1_outlet_1_sales"],
    "planName": "Pro"
  },
  "iat": 1705830000,
  "exp": 1705916400
}
```

---

## 6. Refresh Token Mechanism

### Token Lifecycle

| Stage | revoked | deleted | Valid |
|-------|---------|---------|-------|
| **Created** | NULL | false | YES |
| **After Refresh** | NOW | true | NO |
| **Expired** | NULL | false | NO |

### Refresh Token Properties

| Property | Value |
|----------|-------|
| **Format** | 80-character hex string (40 random bytes) |
| **Expiration** | 1 day from creation |
| **Storage** | Global database `RefreshToken` table |
| **IP Tracking** | Creator's IP address stored |

### Token Rotation

When a refresh token is used:

1. Old token is validated (exists, not revoked, not expired)
2. Old token is marked as `revoked` and `deleted`
3. New refresh token is generated
4. New JWT is generated with fresh expiry
5. Both new tokens are returned

---

## 7. Database Architecture

### Global Database Tables

| Table | Purpose |
|-------|---------|
| `TenantUser` | User credentials and tenant association |
| `RefreshToken` | Active and revoked refresh tokens |
| `Tenant` | Tenant organization details |
| `TenantOutlet` | Outlet information |
| `TenantSubscription` | Subscription plans per outlet |
| `Permission` | System-wide permission definitions |

### Tenant Database Tables

| Table | Purpose |
|-------|---------|
| `User` | Tenant-specific user data |
| `Role` | Role definitions |
| `RolePermission` | Role-to-permission mappings |

### Database Selection Flow

```
Login Request
    ↓
Query Global DB → TenantUser (get databaseName)
    ↓
Construct Tenant DB URL → Replace {tenant_db_name} placeholder
    ↓
Query Tenant DB → User table
    ↓
Store databaseName in JWT → Used for all subsequent requests
```

---

## 8. Middleware Integration

### Authorization Middleware

**Location:** `src/middleware/authorize-middleware.ts`

**Flow:**

1. Extract `token` header from request
2. Verify JWT using secret
3. Check role-based access (admin required for `/admin` routes)
4. Store UserInfo in `req.user`
5. Call `next()` to proceed

### AuthRequest Interface

```typescript
interface AuthRequest extends Request {
  user?: UserInfo;  // Populated by authorize-middleware
}
```

### Route Protection

```
/auth/*          → No authentication required
/admin/*         → Requires valid token + admin role
/account/*       → Requires valid token
/user/*          → Requires valid token
/item/*          → Requires valid token
... (all other routes require authentication)
```

---

## 9. Notification Topics

### Topic Generation (Pro Plan Only)

Notification topics are generated based on user roles and permissions:

**Topic Format Examples:**

| Topic | Description |
|-------|-------------|
| `tenant_{id}` | All tenant notifications |
| `tenant_{id}_sales` | Sales alerts (tenant-wide) |
| `tenant_{id}_outlet_1_inventory` | Outlet-specific inventory |
| `tenant_{id}_user_{userId}` | Direct messages to user |

### Permission-Based Assignment

```
Super Admin (roleId 1)
    → Gets ALL notification topics

Regular User
    → Gets topics matching assigned permissions
    → Permission "Receive Sales Notification" → topic "sales"
```

### Outlet-Specific vs Tenant-Wide

| Permission Type | Topic Format |
|-----------------|--------------|
| sales, inventory, order | `tenant_{id}_outlet_1_{type}` |
| financial, staff, system | `tenant_{id}_{type}` |

---

## 10. Error Handling

### Error Classes

| Class | Status | Description |
|-------|--------|-------------|
| `AuthenticationError` | 401 | Token invalid or missing |
| `RequestValidateError` | 400 | Invalid credentials or request |
| `NotFoundError` | 404 | Resource not found |

### Common Error Responses

**Invalid Credentials (400):**
```json
{
  "error": "Username or password is incorrect"
}
```

**Invalid Token (401):**
```json
{
  "error": "Invalid token"
}
```

**Token Not Found (401):**
```json
{
  "error": "Token not found"
}
```

**Invalid Refresh Token (400):**
```json
{
  "error": "Invalid refresh token"
}
```

**Admin Access Required (403):**
```json
{
  "error": "Admin access required"
}
```

---

## 11. Security Considerations

### Current Implementation

| Feature | Implementation |
|---------|----------------|
| **Password Hashing** | bcryptjs with `compareSync` |
| **JWT Signing** | HS256 algorithm |
| **Token Expiration** | 1 day for both JWT and refresh tokens |
| **IP Tracking** | Refresh token creation IP stored |
| **Soft Deletes** | Revoked tokens marked deleted, not removed |
| **Role-based Access** | Admin role required for `/admin` routes |
| **Database Isolation** | Tenant data in separate databases |

### API Usage Guidelines

**Required Headers for Protected Endpoints:**

```
token: <JWT_TOKEN>
```

**Token Storage Recommendations:**

- Store JWT in memory (not localStorage for web)
- Store refresh token in httpOnly cookie (web) or secure storage (mobile)
- Never expose tokens in URLs or logs

### Best Practices

1. **Always use HTTPS** in production
2. **Implement token refresh** before JWT expiration
3. **Revoke refresh tokens** on logout
4. **Monitor failed login attempts** for security

---

## Common Use Cases

### Use Case 1: User Login

```bash
# Login
POST /auth/login
Content-Type: application/json

{
  "username": "cashier_01",
  "password": "SecurePass123"
}

# Response: Save token and refreshToken
# Use token for subsequent API calls
```

### Use Case 2: Token Refresh

```bash
# When JWT is about to expire, refresh it
POST /auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "a1b2c3d4e5f6g7h8i9j0..."
}

# Response: New token and refreshToken
# Update stored tokens
```

### Use Case 3: Logout

```bash
# Revoke the refresh token
POST /auth/revoke-token
Content-Type: application/json
token: <current_jwt_token>

{
  "refreshToken": "a1b2c3d4e5f6g7h8i9j0..."
}

# Clear stored tokens on client
```

---

## Notes

- All timestamps are in **ISO 8601 format** (UTC)
- JWT tokens should be included in the `token` header (not Authorization Bearer)
- Refresh tokens are single-use (token rotation on each refresh)
- The `avjiang` username is a special admin account that bypasses tenant database lookups
