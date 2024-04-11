/*
  Warnings:

  - Added the required column `ITEM_CODE` to the `SALES_ITEM` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `SALES_ITEM` ADD COLUMN `ITEM_CODE` VARCHAR(191) NOT NULL;
