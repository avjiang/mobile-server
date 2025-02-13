/*
  Warnings:

  - A unique constraint covering the columns `[ITEM_ID]` on the table `STOCK` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `stockId` to the `ITEM` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `ITEM` ADD COLUMN `stockId` INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `STOCK_ITEM_ID_key` ON `STOCK`(`ITEM_ID`);

-- AddForeignKey
ALTER TABLE `STOCK` ADD CONSTRAINT `STOCK_ITEM_ID_fkey` FOREIGN KEY (`ITEM_ID`) REFERENCES `ITEM`(`ID`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `STOCK_CHECK` ADD CONSTRAINT `STOCK_CHECK_ITEM_ID_fkey` FOREIGN KEY (`ITEM_ID`) REFERENCES `ITEM`(`ID`) ON DELETE RESTRICT ON UPDATE CASCADE;
