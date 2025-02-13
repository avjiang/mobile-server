/*
  Warnings:

  - You are about to drop the column `stockId` on the `ITEM` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[STOCK_ID]` on the table `ITEM` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `STOCK_ID` to the `ITEM` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `STOCK` DROP FOREIGN KEY `STOCK_ITEM_ID_fkey`;

-- AlterTable
ALTER TABLE `ITEM` DROP COLUMN `stockId`,
    ADD COLUMN `STOCK_ID` INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `ITEM_STOCK_ID_key` ON `ITEM`(`STOCK_ID`);

-- AddForeignKey
ALTER TABLE `ITEM` ADD CONSTRAINT `ITEM_STOCK_ID_fkey` FOREIGN KEY (`STOCK_ID`) REFERENCES `STOCK`(`ID`) ON DELETE RESTRICT ON UPDATE CASCADE;
