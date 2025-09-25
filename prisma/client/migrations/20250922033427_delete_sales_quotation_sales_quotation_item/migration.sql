/*
  Warnings:

  - You are about to drop the `sales_quotation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sales_quotation_item` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `sales_quotation_item` DROP FOREIGN KEY `sales_quotation_item_SALES_QUOTATION_ID_fkey`;

-- DropTable
DROP TABLE `sales_quotation`;

-- DropTable
DROP TABLE `sales_quotation_item`;
