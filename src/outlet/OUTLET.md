# Outlet Module — Backend Reference

## Overview

This module provides backend services related to outlets. It handles retrieval of all active outlets for a specific tenant database.

---

## Schema Reference

The primary model used by this module is `Outlet`:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `Int` | Primary key |
| `name` | `String` | Outlet name |
| `tenantOutletId` | `Int` | Global outlet identifier for cross-referencing |
| `deleted` | `Boolean` | Soft delete flag |
| `createdAt` | `DateTime` | Creation timestamp |

*(Note: The `Outlet` model is heavily referenced by other domain models such as `Sales`, `Payment`, `RegisterLog`, `Session`, `Invoice`, `DeliveryOrder`, `Quotation`, and `PurchaseOrder` via foreign keys to enforce referential integrity.)*

---

## Endpoints

### `GET /outlet/`

Retrieves all active (non-deleted) outlets for the authenticated user's tenant.

**Response mapping:**
The response maps the `tenantOutletId` to `globalOutletId` for client consumption.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Main Store",
    "globalOutletId": 105,
    "deleted": false,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  ...
]
```

## Related Logic

- **Service Validations**: `Outlet` existence is actively validated in critical transactional flows:
  - `sales.service.ts` (`completeNewSales`): Validates `outletId` before committing new sales.
  - `session.service.ts` (`createSession`): Validates `outletId` before opening a new POS session.
