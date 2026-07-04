-- Stock Movement Report (Stock Card + Movement Summary / by-type) filters by
-- outlet + date range. The existing single-column `(OUTLET_ID)` index forces a
-- row-filter on CREATED_AT for every period query; this composite index serves
-- outlet + bounded-period scans directly. Additive/safe — no data change.
-- See docs/modules/STOCK_AND_COST.md (Stock Movement Report) / REPORT.md.
CREATE INDEX `stock_movement_OUTLET_ID_CREATED_AT_idx` ON `stock_movement`(`OUTLET_ID`, `CREATED_AT`);
