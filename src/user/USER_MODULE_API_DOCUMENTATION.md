# User Module API Documentation

This document provides documentation for internal User Module endpoints.

## Base URL
`/user`

## Endpoints

### Sync Users (Get All)

**Endpoint:** `GET /sync`

**Description:** Retrieves a list of users, supporting synchronization via timestamp or version.

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `lastSyncTimestamp` | string | No | ISO 8601 timestamp for time-based sync |
| `lastVersion` | number | No | Version number for version-based sync |
| `skip` | number | No | Pagination offset |
| `take` | number | No | Pagination limit (default: 100) |

**Response (Success - 200):**

```json
{
  "data": [
    {
      "id": 1,
      "username": "user1",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "mobile": "1234567890",
      "roleCount": 1,
      "roles": [
          { "id": 1, "name": "Admin" }
      ],
      "deleted": false,
      "createdAt": "2023-01-01T00:00:00.000Z",
      "updatedAt": "2023-01-01T00:00:00.000Z",
      "version": 1
    }
  ],
  "total": 1,
  "serverTimestamp": "2023-01-01T00:00:00.000Z"
}
```

### Get User By ID

**Endpoint:** `GET /:id`

**Description:** Retrieves a single user by their ID.

**Authentication:** Required

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | User ID |

**Response (Success - 200):**

```json
{
  "id": 1,
  "username": "user1",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "mobile": "1234567890",
  "roles": [
    {
      "id": 1,
      "name": "Admin",
      "description": "Administrator",
      "createdAt": "2023-01-01T00:00:00.000Z",
      "updatedAt": "2023-01-01T00:00:00.000Z"
    }
  ],
  "deleted": false,
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z",
  "version": 1
}
```

### Update User

**Endpoint:** `PUT /update/:id`

**Description:** Updates an existing user's details.

**Authentication:** Required

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | User ID |

**Request Body:**

```json
{
  "username": "new_username",
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "mobile": "0987654321",
  "roles": [
    { "id": 2 }
  ]
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `username` | string | No | New username |
| `firstName` | string | No | First name |
| `lastName` | string | No | Last name |
| `email` | string | No | Email address |
| `mobile` | string | No | Mobile number |
| `roles` | array | No | Array of role objects `{ id: number }` to assign |

**Response (Success - 200):**

```json
{
  "id": 1,
  "username": "new_username",
  // ... updated user object
}
```

### Reset Password (Change Password)

**Endpoint:** `POST /:id/reset-password`

**Description:** Allows a logged-in user to change their password.

**Authentication:** Required

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | Tenant User ID (User ID in the tenant database) |

**Request Body:**

```json
{
  "username": "john_doe",
  "currentPassword": "OldPassword1!",
  "newPassword": "NewSecurePassword2@"
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `username` | string | Yes | Username of the user |
| `currentPassword` | string | Yes | Current password for validation |
| `newPassword` | string | Yes | New password to set |

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

**Error Responses:**
- `400 Bad Request`: "Invalid username or password"
- `400 Bad Request`: "New password cannot be the same as the current password"
- `404 Not Found`: "User not found"
