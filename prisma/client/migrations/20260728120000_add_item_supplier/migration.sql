-- Item multi-supplier (Pro-gated). See docs/future/ITEM_MULTI_SUPPLIER.md and
-- docs/modules/ITEM.md.
--
-- Adds the item <-> supplier junction so one item can be purchased from several
-- suppliers WITHOUT duplicating the item (which would fragment stock balances,
-- FIFO layers, barcodes and reports). `item.SUPPLIER_ID` is deliberately KEPT as a
-- denormalized pointer to the preferred supplier, so every read site that only needs
-- a supplier name to display keeps working untouched.
--
-- Additive only — no existing table is altered. The backfill at the bottom is what
-- makes this a no-op for current tenants: every existing item gets exactly one
-- junction row flagged preferred, matching what item.SUPPLIER_ID already says, so
-- the app renders exactly as it does today until someone adds a second supplier.

-- CreateTable
CREATE TABLE `item_supplier` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `ITEM_ID` INTEGER NOT NULL,
    `SUPPLIER_ID` INTEGER NOT NULL,
    `IS_PREFERRED` BOOLEAN NOT NULL DEFAULT false,
    `SUPPLIER_ITEM_CODE` VARCHAR(191) NULL,
    `COST` DECIMAL(15, 4) NULL,
    `LEAD_TIME_DAYS` INTEGER NULL,
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,
    `DELETED_AT` DATETIME(3) NULL,
    `CREATED_AT` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `UPDATED_AT` DATETIME(3) NULL,
    `VERSION` INTEGER NULL DEFAULT 1,

    INDEX `item_supplier_SUPPLIER_ID_idx`(`SUPPLIER_ID`),
    INDEX `item_supplier_UPDATED_AT_idx`(`UPDATED_AT`),
    UNIQUE INDEX `item_supplier_ITEM_ID_SUPPLIER_ID_key`(`ITEM_ID`, `SUPPLIER_ID`),
    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `item_supplier` ADD CONSTRAINT `item_supplier_ITEM_ID_fkey` FOREIGN KEY (`ITEM_ID`) REFERENCES `item`(`ID`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_supplier` ADD CONSTRAINT `item_supplier_SUPPLIER_ID_fkey` FOREIGN KEY (`SUPPLIER_ID`) REFERENCES `supplier`(`ID`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: one preferred row per existing item, mirroring item.SUPPLIER_ID.
--
-- NOT optional. Every supplier-scoped read moves to this table, so an empty junction
-- means the PO/quotation item picker returns nothing for any supplier and every
-- supplier's itemCount reads 0.
--
-- Soft-deleted items are included on purpose: undeleting one must not leave it
-- without a supplier. The join to `supplier` skips items whose SUPPLIER_ID points at
-- a row that no longer exists (historically possible — there was no FK on item.SUPPLIER_ID),
-- which would otherwise abort the whole migration on the new FK.
INSERT INTO `item_supplier`
    (`ITEM_ID`, `SUPPLIER_ID`, `IS_PREFERRED`, `IS_DELETED`, `CREATED_AT`, `UPDATED_AT`, `VERSION`)
SELECT i.`ID`, i.`SUPPLIER_ID`, true, false, NOW(3), NOW(3), 1
FROM `item` i
INNER JOIN `supplier` s ON s.`ID` = i.`SUPPLIER_ID`;
