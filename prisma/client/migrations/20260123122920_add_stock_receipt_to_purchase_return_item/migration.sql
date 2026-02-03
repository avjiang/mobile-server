-- AlterTable
ALTER TABLE `purchase_return_item` ADD COLUMN `STOCK_RECEIPT_ID` INTEGER NULL;

-- CreateIndex
CREATE INDEX `purchase_return_item_STOCK_RECEIPT_ID_idx` ON `purchase_return_item`(`STOCK_RECEIPT_ID`);

-- AddForeignKey
ALTER TABLE `purchase_return_item` ADD CONSTRAINT `purchase_return_item_STOCK_RECEIPT_ID_fkey` FOREIGN KEY (`STOCK_RECEIPT_ID`) REFERENCES `stock_receipt`(`ID`) ON DELETE SET NULL ON UPDATE CASCADE;
