-- Align warehouse_stock_receipt with the current stock_receipt mechanism.
-- The live FIFO consumes by mutating QUANTITY directly (no AVAILABLE_QUANTITY column),
-- and StockReceipt carries a VERSION column. Warehouse stock is empty, so this is safe.

-- AlterTable: drop the vestigial AVAILABLE_QUANTITY column
ALTER TABLE `warehouse_stock_receipt` DROP COLUMN `AVAILABLE_QUANTITY`;

-- AlterTable: add VERSION to match stock_receipt
ALTER TABLE `warehouse_stock_receipt` ADD COLUMN `VERSION` INTEGER NULL DEFAULT 1;
