/*
  Warnings:

  - Added the required column `REASON` to the `STOCK_CHECK` table without a default value. This is not possible if the table is not empty.
  - Added the required column `REMARK` to the `STOCK_CHECK` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `STOCK_CHECK` ADD COLUMN `REASON` VARCHAR(191) NOT NULL,
    ADD COLUMN `REMARK` VARCHAR(191) NOT NULL;
