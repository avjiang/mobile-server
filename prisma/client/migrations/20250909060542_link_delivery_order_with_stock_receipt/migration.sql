-- AlterTable
ALTER TABLE `stock_receipt` ADD COLUMN `DELIVERY_ORDER_ID` INTEGER NULL;

-- CreateIndex
CREATE INDEX `stock_receipt_DELIVERY_ORDER_ID_idx` ON `stock_receipt`(`DELIVERY_ORDER_ID`);

-- AddForeignKey
ALTER TABLE `stock_receipt` ADD CONSTRAINT `stock_receipt_DELIVERY_ORDER_ID_fkey` FOREIGN KEY (`DELIVERY_ORDER_ID`) REFERENCES `delivery_order`(`ID`) ON DELETE SET NULL ON UPDATE CASCADE;
