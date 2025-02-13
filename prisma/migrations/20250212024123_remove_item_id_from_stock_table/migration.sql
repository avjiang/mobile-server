/*
  Warnings:

  - You are about to drop the column `ITEM_ID` on the `STOCK` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `STOCK_ITEM_ID_key` ON `STOCK`;

-- AlterTable
ALTER TABLE `STOCK` DROP COLUMN `ITEM_ID`;
