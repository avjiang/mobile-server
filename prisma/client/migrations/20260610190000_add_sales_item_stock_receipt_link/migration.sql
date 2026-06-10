-- FIFO cost provenance on sales lines: which stock receipt the line's cost snapshot
-- came from. Piece-based FIFO lines only; consumption (weighted-avg) and fallback-cost
-- lines stay NULL. Enables exact sales cost+profit restatement when invoice re-pricing
-- changes a receipt's cost.
ALTER TABLE `sales_item`
    ADD COLUMN `STOCK_RECEIPT_ID` INT NULL,
    ADD COLUMN `WAREHOUSE_STOCK_RECEIPT_ID` INT NULL;

CREATE INDEX `sales_item_STOCK_RECEIPT_ID_idx` ON `sales_item`(`STOCK_RECEIPT_ID`);
CREATE INDEX `sales_item_WAREHOUSE_STOCK_RECEIPT_ID_idx` ON `sales_item`(`WAREHOUSE_STOCK_RECEIPT_ID`);
