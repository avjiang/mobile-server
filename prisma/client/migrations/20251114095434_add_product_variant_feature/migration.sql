/*
  Warnings:

  - A unique constraint covering the columns `[ITEM_ID,OUTLET_ID,ITEM_VARIANT_ID,REORDER_THRESHOLD,IS_DELETED,AVAILABLE_QUANTITY]` on the table `stock_balance` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[ITEM_ID,WAREHOUSE_ID,ITEM_VARIANT_ID,REORDER_THRESHOLD,IS_DELETED,AVAILABLE_QUANTITY]` on the table `warehouse_stock_balance` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `stock_balance` DROP FOREIGN KEY `stock_balance_ITEM_ID_fkey`;

-- DropForeignKey
ALTER TABLE `warehouse_stock_balance` DROP FOREIGN KEY `warehouse_stock_balance_ITEM_ID_fkey`;

-- DropIndex
DROP INDEX `stock_balance_ITEM_ID_OUTLET_ID_REORDER_THRESHOLD_IS_DELETED_key` ON `stock_balance`;

-- DropIndex
DROP INDEX `warehouse_stock_balance_ITEM_ID_WAREHOUSE_ID_REORDER_THRESHO_key` ON `warehouse_stock_balance`;

-- AlterTable
ALTER TABLE `delivery_order_item` ADD COLUMN `ITEM_VARIANT_ID` INTEGER NULL;

-- AlterTable
ALTER TABLE `invoice_item` ADD COLUMN `ITEM_VARIANT_ID` INTEGER NULL;

-- AlterTable
ALTER TABLE `item` ADD COLUMN `HAS_VARIANTS` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `purchase_order_item` ADD COLUMN `ITEM_VARIANT_ID` INTEGER NULL;

-- AlterTable
ALTER TABLE `quotation_item` ADD COLUMN `ITEM_VARIANT_ID` INTEGER NULL;

-- AlterTable
ALTER TABLE `sales_item` ADD COLUMN `ITEM_VARIANT_ID` INTEGER NULL,
    ADD COLUMN `VARIANT_NAME` VARCHAR(191) NULL,
    ADD COLUMN `VARIANT_SKU` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `stock_balance` ADD COLUMN `ITEM_VARIANT_ID` INTEGER NULL;

-- AlterTable
ALTER TABLE `stock_movement` ADD COLUMN `ITEM_VARIANT_ID` INTEGER NULL;

-- AlterTable
ALTER TABLE `stock_receipt` ADD COLUMN `ITEM_VARIANT_ID` INTEGER NULL;

-- AlterTable
ALTER TABLE `stock_snapshot` ADD COLUMN `ITEM_VARIANT_ID` INTEGER NULL;

-- AlterTable
ALTER TABLE `warehouse_stock_balance` ADD COLUMN `ITEM_VARIANT_ID` INTEGER NULL;

-- AlterTable
ALTER TABLE `warehouse_stock_movement` ADD COLUMN `ITEM_VARIANT_ID` INTEGER NULL;

-- AlterTable
ALTER TABLE `warehouse_stock_receipt` ADD COLUMN `ITEM_VARIANT_ID` INTEGER NULL;

-- CreateTable
CREATE TABLE `variant_attribute_value` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `DEFINITION_KEY` VARCHAR(191) NOT NULL,
    `VALUE` VARCHAR(191) NOT NULL,
    `DISPLAY_VALUE` VARCHAR(191) NOT NULL,
    `SORT_ORDER` INTEGER NOT NULL DEFAULT 0,
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,
    `DELETED_AT` DATETIME(3) NULL,
    `CREATED_AT` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `UPDATED_AT` DATETIME(3) NOT NULL,
    `VERSION` INTEGER NOT NULL DEFAULT 1,

    INDEX `variant_attribute_value_DEFINITION_KEY_idx`(`DEFINITION_KEY`),
    INDEX `variant_attribute_value_IS_DELETED_idx`(`IS_DELETED`),
    UNIQUE INDEX `variant_attribute_value_DEFINITION_KEY_VALUE_key`(`DEFINITION_KEY`, `VALUE`),
    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item_variant` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `ITEM_ID` INTEGER NOT NULL,
    `VARIANT_SKU` VARCHAR(191) NOT NULL,
    `VARIANT_NAME` VARCHAR(191) NOT NULL,
    `COST` DECIMAL(15, 4) NULL,
    `PRICE` DECIMAL(15, 4) NULL,
    `WEIGHT` DOUBLE NULL,
    `HEIGHT` DOUBLE NULL,
    `WIDTH` DOUBLE NULL,
    `LENGTH` DOUBLE NULL,
    `IMAGE` VARCHAR(191) NULL,
    `BARCODE` VARCHAR(191) NULL,
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,
    `DELETED_AT` DATETIME(3) NULL,
    `CREATED_AT` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `UPDATED_AT` DATETIME(3) NOT NULL,
    `VERSION` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `item_variant_VARIANT_SKU_key`(`VARIANT_SKU`),
    INDEX `item_variant_ITEM_ID_idx`(`ITEM_ID`),
    INDEX `item_variant_VARIANT_SKU_idx`(`VARIANT_SKU`),
    INDEX `item_variant_IS_DELETED_idx`(`IS_DELETED`),
    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item_variant_attribute` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `ITEM_VARIANT_ID` INTEGER NOT NULL,
    `VARIANT_ATTRIBUTE_VALUE_ID` INTEGER NOT NULL,
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,
    `DELETED_AT` DATETIME(3) NULL,
    `CREATED_AT` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `UPDATED_AT` DATETIME(3) NOT NULL,
    `VERSION` INTEGER NOT NULL DEFAULT 1,

    INDEX `item_variant_attribute_ITEM_VARIANT_ID_idx`(`ITEM_VARIANT_ID`),
    INDEX `item_variant_attribute_VARIANT_ATTRIBUTE_VALUE_ID_idx`(`VARIANT_ATTRIBUTE_VALUE_ID`),
    UNIQUE INDEX `item_variant_attribute_ITEM_VARIANT_ID_VARIANT_ATTRIBUTE_VAL_key`(`ITEM_VARIANT_ID`, `VARIANT_ATTRIBUTE_VALUE_ID`),
    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `delivery_order_item_ITEM_VARIANT_ID_idx` ON `delivery_order_item`(`ITEM_VARIANT_ID`);

-- CreateIndex
CREATE INDEX `invoice_item_ITEM_VARIANT_ID_idx` ON `invoice_item`(`ITEM_VARIANT_ID`);

-- CreateIndex
CREATE INDEX `purchase_order_item_ITEM_VARIANT_ID_idx` ON `purchase_order_item`(`ITEM_VARIANT_ID`);

-- CreateIndex
CREATE INDEX `quotation_item_ITEM_VARIANT_ID_idx` ON `quotation_item`(`ITEM_VARIANT_ID`);

-- CreateIndex
CREATE INDEX `sales_item_ITEM_VARIANT_ID_idx` ON `sales_item`(`ITEM_VARIANT_ID`);

-- CreateIndex
CREATE INDEX `stock_balance_ITEM_VARIANT_ID_idx` ON `stock_balance`(`ITEM_VARIANT_ID`);

-- CreateIndex
CREATE UNIQUE INDEX `stock_balance_ITEM_ID_OUTLET_ID_ITEM_VARIANT_ID_REORDER_THRE_key` ON `stock_balance`(`ITEM_ID`, `OUTLET_ID`, `ITEM_VARIANT_ID`, `REORDER_THRESHOLD`, `IS_DELETED`, `AVAILABLE_QUANTITY`);

-- CreateIndex
CREATE INDEX `stock_movement_ITEM_VARIANT_ID_idx` ON `stock_movement`(`ITEM_VARIANT_ID`);

-- CreateIndex
CREATE INDEX `stock_receipt_ITEM_VARIANT_ID_idx` ON `stock_receipt`(`ITEM_VARIANT_ID`);

-- CreateIndex
CREATE INDEX `stock_snapshot_ITEM_VARIANT_ID_idx` ON `stock_snapshot`(`ITEM_VARIANT_ID`);

-- CreateIndex
CREATE INDEX `warehouse_stock_balance_ITEM_VARIANT_ID_idx` ON `warehouse_stock_balance`(`ITEM_VARIANT_ID`);

-- CreateIndex
CREATE UNIQUE INDEX `warehouse_stock_balance_ITEM_ID_WAREHOUSE_ID_ITEM_VARIANT_ID_key` ON `warehouse_stock_balance`(`ITEM_ID`, `WAREHOUSE_ID`, `ITEM_VARIANT_ID`, `REORDER_THRESHOLD`, `IS_DELETED`, `AVAILABLE_QUANTITY`);

-- CreateIndex
CREATE INDEX `warehouse_stock_movement_ITEM_VARIANT_ID_idx` ON `warehouse_stock_movement`(`ITEM_VARIANT_ID`);

-- CreateIndex
CREATE INDEX `warehouse_stock_receipt_ITEM_VARIANT_ID_idx` ON `warehouse_stock_receipt`(`ITEM_VARIANT_ID`);

-- AddForeignKey
ALTER TABLE `sales_item` ADD CONSTRAINT `sales_item_ITEM_VARIANT_ID_fkey` FOREIGN KEY (`ITEM_VARIANT_ID`) REFERENCES `item_variant`(`ID`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_item` ADD CONSTRAINT `invoice_item_ITEM_VARIANT_ID_fkey` FOREIGN KEY (`ITEM_VARIANT_ID`) REFERENCES `item_variant`(`ID`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `delivery_order_item` ADD CONSTRAINT `delivery_order_item_ITEM_VARIANT_ID_fkey` FOREIGN KEY (`ITEM_VARIANT_ID`) REFERENCES `item_variant`(`ID`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotation_item` ADD CONSTRAINT `quotation_item_ITEM_VARIANT_ID_fkey` FOREIGN KEY (`ITEM_VARIANT_ID`) REFERENCES `item_variant`(`ID`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_item` ADD CONSTRAINT `purchase_order_item_ITEM_VARIANT_ID_fkey` FOREIGN KEY (`ITEM_VARIANT_ID`) REFERENCES `item_variant`(`ID`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_balance` ADD CONSTRAINT `stock_balance_ITEM_VARIANT_ID_fkey` FOREIGN KEY (`ITEM_VARIANT_ID`) REFERENCES `item_variant`(`ID`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_receipt` ADD CONSTRAINT `stock_receipt_ITEM_VARIANT_ID_fkey` FOREIGN KEY (`ITEM_VARIANT_ID`) REFERENCES `item_variant`(`ID`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movement` ADD CONSTRAINT `stock_movement_ITEM_VARIANT_ID_fkey` FOREIGN KEY (`ITEM_VARIANT_ID`) REFERENCES `item_variant`(`ID`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_snapshot` ADD CONSTRAINT `stock_snapshot_ITEM_VARIANT_ID_fkey` FOREIGN KEY (`ITEM_VARIANT_ID`) REFERENCES `item_variant`(`ID`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `warehouse_stock_balance` ADD CONSTRAINT `warehouse_stock_balance_ITEM_VARIANT_ID_fkey` FOREIGN KEY (`ITEM_VARIANT_ID`) REFERENCES `item_variant`(`ID`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `warehouse_stock_receipt` ADD CONSTRAINT `warehouse_stock_receipt_ITEM_VARIANT_ID_fkey` FOREIGN KEY (`ITEM_VARIANT_ID`) REFERENCES `item_variant`(`ID`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `warehouse_stock_movement` ADD CONSTRAINT `warehouse_stock_movement_ITEM_VARIANT_ID_fkey` FOREIGN KEY (`ITEM_VARIANT_ID`) REFERENCES `item_variant`(`ID`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_variant` ADD CONSTRAINT `item_variant_ITEM_ID_fkey` FOREIGN KEY (`ITEM_ID`) REFERENCES `item`(`ID`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_variant_attribute` ADD CONSTRAINT `item_variant_attribute_ITEM_VARIANT_ID_fkey` FOREIGN KEY (`ITEM_VARIANT_ID`) REFERENCES `item_variant`(`ID`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_variant_attribute` ADD CONSTRAINT `item_variant_attribute_VARIANT_ATTRIBUTE_VALUE_ID_fkey` FOREIGN KEY (`VARIANT_ATTRIBUTE_VALUE_ID`) REFERENCES `variant_attribute_value`(`ID`) ON DELETE RESTRICT ON UPDATE CASCADE;
