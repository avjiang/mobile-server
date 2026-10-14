-- Stock Movement Report "Per Jenis" drill-down: one movement type at one outlet
-- over a period (page + count/net). It was served by `(OUTLET_ID, CREATED_AT)`,
-- which reads EVERY movement of the outlet in the range and filters the type row
-- by row — the rarer the type, the worse. Measured on 300k rows: count+net for a
-- rare type 12.7 ms → 0.7 ms, page 5.3 ms → 0.2 ms. Additive/safe — no data
-- change; MySQL 8 builds a secondary index online (INPLACE, LOCK=NONE).
-- (The Stock Card needs no new index: `(ITEM_ID, CREATED_AT)` already serves it.)
-- See docs/modules/REPORT.md §11.
CREATE INDEX `stock_movement_OUTLET_ID_MOVEMENT_TYPE_CREATED_AT_idx` ON `stock_movement`(`OUTLET_ID`, `MOVEMENT_TYPE`, `CREATED_AT`);
