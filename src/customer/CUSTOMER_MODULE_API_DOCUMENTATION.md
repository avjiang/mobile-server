# Customer Module API Documentation

This document provides comprehensive documentation for the Customer Module, including customer management and data synchronization algorithms used by the offline-first mobile app.

---

## Table of Contents

1. [Overview](#1-overview)
2. [API Endpoints](#2-api-endpoints)
3. [Request/Response Interfaces](#3-requestresponse-interfaces)
4. [Duplicate Prevention](#4-duplicate-prevention)
5. [Database Architecture](#5-database-architecture)
6. [Error Handling](#6-error-handling)

---

## 1. Overview

### Module Purpose

The Customer Module handles all aspects of customer records management for the POS system. It manages:

- Customer CRUD operations (Create, Read, Update, Delete)
- Delta synchronization for offline-first mobile clients
- Customer duplication prevention

### File Structure

```
src/customer/
├── customer.service.ts      # Core business logic & database queries
├── customer.controller.ts   # Express route handlers
├── customer.request.ts      # Request body interfaces
└── customer.response.ts     # Response DTO interfaces
```

### Base URL

All endpoints are prefixed with:

```
/customer
```

---

## 2. API Endpoints

### 2.1 Get All Customers

**Endpoint:** `GET /customer/`

**Description:** Retrieves all customers. Note: This is an older endpoint; mobile apps should prefer the `/sync` endpoint for performance.

**Authentication:** Required (JWT)

**Response (Success - 200):**

```json
[
  {
    "id": 1,
    "firstName": "John",
    "lastName": "Doe",
    "mobile": "+60123456789",
    "email": "john@example.com",
    // ...other fields
  }
]
```

---

### 2.2 Sync Customers (Delta Sync)

**Endpoint:** `GET /customer/sync`

**Description:** Retrieves customers based on delta changes using a timestamp or version number. Primarily used by the offline-first mobile application to sync local databases.

**Authentication:** Required (JWT)

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `lastSyncTimestamp` | string | Optional | ISO Timestamp of the client's last sync |
| `lastVersion` | number | Optional | Alternative to timestamp for sync |
| `skip` | number | Optional | Pagination offset (default: 0) |
| `take` | number | Optional | Pagination limit (default: 100) |

**Response (Success - 200):**

```json
{
  "data": [
    {
      "id": 1,
      "firstName": "John",
      "lastName": "Doe",
      // ...other fields
    }
  ],
  "total": 1,
  "serverTimestamp": "2025-05-06T12:00:00Z"
}
```

---

### 2.3 Get Customer by ID

**Endpoint:** `GET /customer/:id`

**Description:** Retrieves a specific customer by their ID.

**Authentication:** Required (JWT)

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | Customer ID |

**Response (Success - 200):** Returns the Customer JSON object.

---

### 2.4 Create Customers (Batch)

**Endpoint:** `POST /customer/create`

**Description:** Creates one or multiple customers in a single batch.

**Authentication:** Required (JWT)

**Request Body:**

```json
{
  "customers": [
    {
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane@example.com",
      "mobile": "+60198765432"
    }
  ]
}
```

**Response (Success - 200):** Returns the array of created Customer objects.

**Error Response (400 - Duplicate):**
```json
{
  "error": "Email 'jane@example.com' already exists"
}
```

---

### 2.5 Update Customer

**Endpoint:** `PUT /customer/update`

**Description:** Updates an existing customer's data.

**Authentication:** Required (JWT)

**Request Body:**
Expects a complete Customer object, with the `id` field being required.

```json
{
  "id": 1,
  "firstName": "Jane Updated",
  "lastName": "Smith",
  // ...other fields updated
}
```

**Response (Success - 200):** Returns the updated Customer JSON object.

---

### 2.6 Delete Customer

**Endpoint:** `DELETE /customer/:id`

**Description:** Performs a soft delete on a customer record. Note that this only sets `deleted: true` in the databse and updates the `deletedAt` timestamp; it does not hard-delete the record to allow delta syncs to pick up the deletion.

**Authentication:** Required (JWT)

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | Customer ID |

**Response (Success - 200):**
```json
"Successfully deleted"
```

---

## 3. Request/Response Interfaces

### Request Interfaces

```typescript
// Creation Request Interface (src/customer/customer.request.ts)
interface CreateCustomersRequestBody {
    customers: Customer[]; // Prisma Customer model
}

// Sync Request Query Interface
interface SyncRequest {
    outletId?: string;
    lastSyncTimestamp?: string;
    lastVersion?: number;
    skip?: number;
    take?: number;
}
```

### Response DTO Interface

This module uses `class-transformer` properties to format the customer output gracefully, removing any internal ID strings unnecessary for the frontend.

```typescript
// Response DTO (src/customer/customer.response.ts)
class CustomerDto {
    id: number;
    salutation: string;
    lastName: string;
    firstName: string;
    mobile: string;
    email: string;
    gender: string;
    billStreet: string;
    billCity: string;
    billState: string;
    billPostalCode: string;
    billCountry: string;
    billRemark: string;
    shipStreet: string;
    shipCity: string;
    shipState: string;
    shipPostalCode: string;
    shipCountry: string;
    shipRemark: string;
    deleted: boolean;
}
```

---

## 4. Duplicate Prevention

When calling `POST /customer/create`, the module performs a validation check against the database to prevent duplicate customer records. 

### Conflict Triggers
The module scans the incoming batch and extracts all non-empty `email` and `mobile` fields. A duplicate conflict is thrown if:
1. **Any incoming `email`** exactly matches a non-deleted customer's `email` in the database.
2. **Any incoming `mobile`** exactly matches a non-deleted customer's `mobile` in the database.

Names (`firstName`, `lastName`) are intentionally **not** checked for duplication, as multiple distinct customers can share the identical names.

---

## 5. Database Architecture

Tenant data is stored in the respective isolated tenant database configured on connection.

**Database Table:** `customer`
**Key Fields Indexing:** Non-deleted status, version, createdAt, updatedAt, deletedAt

### Sync Logic Integration

1. The `/sync` endpoint evaluates the delta constraints `OR: [{ createdAt: >= lastSync }, { updatedAt: >= lastSync }, { deletedAt: >= lastSync }]` alongside `deleted: false`.
2. When deleting (`DELETE /customer/:id`), the backend sets `deleted: true` and Prisma updates the `@updatedAt` stamp.
3. The mobile app picks up the modified record in its next `lastSyncTimestamp` query and deletes the record from its local repository.

---

## 6. Error Handling

### Common Error Responses

**Validation Errors (400):**
```json
// Email conflict during creation
{ "error": "Email 'user@example.com' already exists" }

// Mobile conflict during creation
{ "error": "Mobile '+123456789' already exists" }

// Missing identifier during update
{ "error": "Update failed: [id] not found" }
```

**Not Found (404):**
```json
// Calling getById with non-existent ID
{ "error": "Customer not found" }
```
