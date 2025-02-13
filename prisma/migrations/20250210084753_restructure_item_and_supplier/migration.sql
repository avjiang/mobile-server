/*
  Warnings:

  - You are about to drop the column `ITEM_CODE` on the `STOCK` table. All the data in the column will be lost.
  - You are about to drop the column `ITEM_CODE` on the `STOCK_CHECK` table. All the data in the column will be lost.
  - Added the required column `SUPPLIER_ID` to the `ITEM` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ITEM_ID` to the `STOCK` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ITEM_ID` to the `STOCK_CHECK` table without a default value. This is not possible if the table is not empty.
  - Added the required column `HAS_TAX` to the `SUPPLIER` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `STOCK` DROP FOREIGN KEY `STOCK_ITEM_CODE_fkey`;

-- DropForeignKey
ALTER TABLE `STOCK_CHECK` DROP FOREIGN KEY `STOCK_CHECK_ITEM_CODE_fkey`;

-- DropIndex
DROP INDEX `ITEM_ITEM_CODE_key` ON `ITEM`;

-- AlterTable
ALTER TABLE `ITEM` ADD COLUMN `SUPPLIER_ID` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `STOCK` DROP COLUMN `ITEM_CODE`,
    ADD COLUMN `ITEM_ID` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `STOCK_CHECK` DROP COLUMN `ITEM_CODE`,
    ADD COLUMN `ITEM_ID` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `SUPPLIER` ADD COLUMN `HAS_TAX` BOOLEAN NOT NULL;
