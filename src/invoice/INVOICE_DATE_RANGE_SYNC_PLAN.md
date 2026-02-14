# Invoice Date Range Sync - Optimization Plan

## Problem

The `GET /invoice/dateRange` endpoint currently has no safeguard for large result sets. When a user reinstalls the app and needs to restore historical data (e.g., a full month), the query could return thousands of records in a single call. On our Azure MySQL B tier, this causes:

- Slow/timeout queries due to limited vCores and IOPS
- High memory usage on the server (enrichment of all records in-memory)
- Risk of request timeout before the response completes

Additionally, the current query always executes 7 unnecessary `EXISTS` subqueries (for delta sync via `lastSyncTimestamp`) even though `lastSyncTimestamp` is not used. This adds significant overhead on every call.

---

## Proposed Backend Changes

### 1. Cap `take` at 500 (server-side)

The server will silently cap the `take` parameter to a maximum of 500. This is a safety net — if the frontend always sends `take=100`, this has no effect.

### 2. Add deterministic ordering

Add `ORDER BY id ASC` to ensure consistent pagination results. Without this, records can be skipped or duplicated across pages.

### 3. Remove `lastSyncTimestamp` from this endpoint

The `lastSyncTimestamp` parameter is not used by the frontend and will be removed. This eliminates 7 unnecessary `EXISTS` subqueries on every call. The query simplifies to just `WHERE outletId = ? AND invoiceDate BETWEEN ? AND ?`, which is significantly faster.

### 4. Add compound database index

Add a compound index on `(outletId, invoiceDate)` to optimize the primary query pattern.

---

## API Contract

### Endpoint

`GET /invoice/dateRange`

### Request Parameters (query string)

| Param       | Type   | Required | Default | Change                        |
| ----------- | ------ | -------- | ------- | ----------------------------- |
| `outletId`  | string | Yes      | -       | No change                     |
| `startDate` | string | Yes      | -       | No change                     |
| `endDate`   | string | Yes      | -       | No change                     |
| `take`      | number | No       | 100     | Max capped at 500 server-side |
| `skip`      | number | No       | 0       | No change                     |

**Removed**: `lastSyncTimestamp` — no longer accepted by this endpoint.

### Response Body

```json
{
  "data": [ ...invoices... ],
  "total": 5000,
  "serverTimestamp": "2026-02-14T10:30:00.000Z"
}
```

| Field             | Type   | Change    | Description                           |
| ----------------- | ------ | --------- | ------------------------------------- |
| `data`            | array  | No change | Array of enriched invoice objects     |
| `total`           | number | No change | Exact total count of matching records |
| `serverTimestamp` | string | No change | Server timestamp for sync tracking    |

No changes to the response shape.

---

## Frontend Sync Loop (Recommended Pattern)

When restoring data (e.g., user reinstall, fetching a full month), the frontend should use `total` and `skip`/`take` to loop through all pages:

### Pseudo-code

```dart
Future<void> syncInvoicesByMonth(int outletId, String startDate, String endDate) async {
  int skip = 0;
  const int take = 100;
  int total = 0;

  do {
    final params = {
      'outletId': outletId.toString(),
      'startDate': startDate,
      'endDate': endDate,
      'take': take.toString(),
      'skip': skip.toString(),
    };

    final response = await api.get('/invoice/dateRange', queryParams: params);
    total = response.total;

    // Save batch to local SQLite DB
    await localDb.insertInvoices(response.data);

    skip += take;
  } while (skip < total);
}
```

### Example: Syncing 5000 invoices for June 2025

```
Call  1: GET /invoice/dateRange?outletId=1&startDate=2025-06-01&endDate=2025-06-30&skip=0&take=100
  -> { data: [100 records], total: 5000 }

Call  2: GET ...&skip=100&take=100
  -> { data: [100 records], total: 5000 }

...

Call 50: GET ...&skip=4900&take=100
  -> { data: [100 records], total: 5000 }
  -> skip (5000) >= total (5000). Done. All 5000 records synced.
```

---

## Backward Compatibility

- **No fields removed** from the response
- **`skip`/`take` still work** as before
- **`total` is retained** with the same exact count behavior
- **`lastSyncTimestamp` removed** from this endpoint — frontend does not use it, so no impact

---

## Questions for Frontend Team

1. Can you confirm that the frontend will implement the sync loop pattern (calling repeatedly using `skip`/`take` until `skip >= total`)?
2. Are there any other fields you need in the response to support the local DB restore?
