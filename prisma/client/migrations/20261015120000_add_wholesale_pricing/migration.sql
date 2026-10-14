-- Wholesale pricing (grosir / ecer), Phase 0. Plan: FE docs/future/MULTI_TIER_PRICING.md §2.2.
--
-- One migration for all three mechanisms, even though their UIs ship in phases:
--   item_unit        sell units ("Dus isi 40") drawn from the item's one stock pool
--   item_price_tier  quantity breaks AND customer-level prices (one row shape)
--   price_level      named customer levels ("Grosir", "Reseller")
--   customer.PRICE_LEVEL_ID
--   sales_item audit columns (PRICE_SOURCE, LIST_PRICE, PRICE_LEVEL_ID,
--     ITEM_UNIT_ID, UNIT_NAME, UNIT_FACTOR): snapshots set by the FE resolver,
--     stored as sent, deliberately NOT foreign keys.
--
-- Additive only: new tables, and nullable columns with no default on existing
-- tables (MySQL 8 adds those with ALGORITHM=INSTANT, no table copy). Existing rows
-- read NULL, which means "ecer / base unit / sold before this feature"; code that
-- doesn't know the columns is unaffected.
--
-- Dated after 20261015100000_add_anomaly_alerts (another branch) so the two never
-- reorder. Generated with `prisma migrate diff` from the schema change, so it
-- matches schema.prisma exactly (same index/constraint names and collation as the
-- neighbouring hand-written migrations).

-- AlterTable
ALTER TABLE `customer` ADD COLUMN `PRICE_LEVEL_ID` INTEGER NULL;

-- AlterTable
ALTER TABLE `sales_item` ADD COLUMN `ITEM_UNIT_ID` INTEGER NULL,
    ADD COLUMN `LIST_PRICE` DECIMAL(15, 4) NULL,
    ADD COLUMN `PRICE_LEVEL_ID` INTEGER NULL,
    ADD COLUMN `PRICE_SOURCE` VARCHAR(8) NULL,
    ADD COLUMN `UNIT_FACTOR` DECIMAL(15, 4) NULL,
    ADD COLUMN `UNIT_NAME` VARCHAR(32) NULL;

-- CreateTable
CREATE TABLE `item_unit` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `ITEM_ID` INTEGER NOT NULL,
    `ITEM_VARIANT_ID` INTEGER NULL,
    `NAME` VARCHAR(32) NOT NULL,
    `FACTOR` DECIMAL(15, 4) NOT NULL,
    `PRICE` DECIMAL(15, 4) NOT NULL,
    `BARCODE` VARCHAR(191) NULL,
    `SORT_ORDER` INTEGER NOT NULL DEFAULT 0,
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,
    `DELETED_AT` DATETIME(3) NULL,
    `CREATED_AT` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `UPDATED_AT` DATETIME(3) NULL,
    `VERSION` INTEGER NULL DEFAULT 1,

    INDEX `item_unit_ITEM_ID_idx`(`ITEM_ID`),
    INDEX `item_unit_BARCODE_idx`(`BARCODE`),
    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item_price_tier` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `ITEM_ID` INTEGER NOT NULL,
    `ITEM_VARIANT_ID` INTEGER NULL,
    `ITEM_UNIT_ID` INTEGER NULL,
    `PRICE_LEVEL_ID` INTEGER NULL,
    `MIN_QUANTITY` DECIMAL(15, 4) NOT NULL DEFAULT 1,
    `PRICE` DECIMAL(15, 4) NOT NULL,
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,
    `DELETED_AT` DATETIME(3) NULL,
    `CREATED_AT` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `UPDATED_AT` DATETIME(3) NULL,
    `VERSION` INTEGER NULL DEFAULT 1,

    INDEX `item_price_tier_ITEM_ID_idx`(`ITEM_ID`),
    INDEX `item_price_tier_ITEM_UNIT_ID_idx`(`ITEM_UNIT_ID`),
    INDEX `item_price_tier_PRICE_LEVEL_ID_idx`(`PRICE_LEVEL_ID`),
    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `price_level` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `NAME` VARCHAR(32) NOT NULL,
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,
    `DELETED_AT` DATETIME(3) NULL,
    `CREATED_AT` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `UPDATED_AT` DATETIME(3) NULL,
    `VERSION` INTEGER NULL DEFAULT 1,

    INDEX `price_level_UPDATED_AT_idx`(`UPDATED_AT`),
    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `customer_PRICE_LEVEL_ID_idx` ON `customer`(`PRICE_LEVEL_ID`);

-- AddForeignKey
ALTER TABLE `customer` ADD CONSTRAINT `customer_PRICE_LEVEL_ID_fkey` FOREIGN KEY (`PRICE_LEVEL_ID`) REFERENCES `price_level`(`ID`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_unit` ADD CONSTRAINT `item_unit_ITEM_ID_fkey` FOREIGN KEY (`ITEM_ID`) REFERENCES `item`(`ID`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_price_tier` ADD CONSTRAINT `item_price_tier_ITEM_ID_fkey` FOREIGN KEY (`ITEM_ID`) REFERENCES `item`(`ID`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_price_tier` ADD CONSTRAINT `item_price_tier_ITEM_UNIT_ID_fkey` FOREIGN KEY (`ITEM_UNIT_ID`) REFERENCES `item_unit`(`ID`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_price_tier` ADD CONSTRAINT `item_price_tier_PRICE_LEVEL_ID_fkey` FOREIGN KEY (`PRICE_LEVEL_ID`) REFERENCES `price_level`(`ID`) ON DELETE RESTRICT ON UPDATE CASCADE;

