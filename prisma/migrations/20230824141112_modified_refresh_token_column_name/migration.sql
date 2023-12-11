/*
  Warnings:

  - You are about to drop the column `cardRate` on the `CARD_INFO` table. All the data in the column will be lost.
  - You are about to drop the column `created` on the `DELIVERY_ORDER` table. All the data in the column will be lost.
  - You are about to drop the column `created` on the `PURCHASE_ORDER` table. All the data in the column will be lost.
  - You are about to drop the column `EXPIRED` on the `REFRESH_TOKEN` table. All the data in the column will be lost.
  - You are about to drop the column `IS_REVOKED` on the `REFRESH_TOKEN` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `CARD_INFO` DROP COLUMN `cardRate`,
    ADD COLUMN `CARD_RATE` DECIMAL(65, 30) NULL;

-- AlterTable
ALTER TABLE `DELIVERY_ORDER` DROP COLUMN `created`,
    ADD COLUMN `CREATED_DATETIME` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `PURCHASE_ORDER` DROP COLUMN `created`,
    ADD COLUMN `CREATED_DATETIME` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `REFRESH_TOKEN` DROP COLUMN `EXPIRED`,
    DROP COLUMN `IS_REVOKED`,
    ADD COLUMN `EXPIRED_DATETIME` DATETIME(3) NULL,
    ADD COLUMN `REVOKED_DATETIME` DATETIME(3) NULL;
