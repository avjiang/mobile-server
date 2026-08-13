-- Two additive indexes on `sales`. No data change, no column change.
-- See docs/future/SYNC_COLD_START_AND_SCALABILITY.md (Phases 2 and 3).

-- 1) Delta sync. Every device runs
--      WHERE OUTLET_ID = ? AND IS_DELETED = 0 AND (CREATED_AT >= ? OR UPDATED_AT >= ?)
--      ORDER BY UPDATED_AT DESC
--    every ~2 minutes. `sales` carries no index on UPDATED_AT — it is the ONLY
--    transaction table without one (invoice / quotation / purchase_order /
--    delivery_order all have (CREATED_AT, UPDATED_AT, DELETED_AT)) — so the sort
--    is a filesort over the whole matched set. Measured on prod audio_technic_db
--    (7,673 sales): ORDER BY UPDATED_AT = 22.9ms scanning 3,139 rows, vs a range
--    scan once this index exists. Serves the filter AND the sort from one index.
CREATE INDEX `sales_OUTLET_ID_UPDATED_AT_idx` ON `sales`(`OUTLET_ID`, `UPDATED_AT`);

-- 2) Laundry pending-pickup queue. The first-sync payload must include EVERY
--    uncollected order regardless of age (the app's pickup queue reads local-only,
--    so an uncollected order missing from the device is a garment the shop can no
--    longer find). That predicate —
--      WHERE OUTLET_ID = ? AND COLLECTED_AT IS NULL AND ORDER_REF IS NOT NULL
--    — has no supporting index today and degrades to a full scan (EXPLAIN:
--    type: ALL, key: NULL). Built ahead of demand: there is no live laundry tenant
--    right now, and this must be in place before the next one onboards.
CREATE INDEX `sales_OUTLET_ID_COLLECTED_AT_idx` ON `sales`(`OUTLET_ID`, `COLLECTED_AT`);

-- Refresh index statistics. NOT optional: benchmarked on a 22,016-row copy, the
-- optimiser kept ignoring the new pickup index (falling back to `(OUTLET_ID)` and
-- examining 10,796 rows) until stats were recomputed — then it switched to the new
-- index and 346 rows. Creating an index does not refresh InnoDB's persistent stats
-- on its own, so without this the migration can look like it did nothing.
ANALYZE TABLE `sales`;
