-- Invoice settlement partial payments (down payment) + transfer fee.
-- PAID_AMOUNT defaults to 0 then is backfilled to SETTLEMENT_AMOUNT so every
-- existing settlement reads as fully paid (legacy behavior). PAYMENT_STATUS is
-- orthogonal to STATUS (which tracks tax-number completeness). Additive + safe.

ALTER TABLE `invoice_settlement`
  ADD COLUMN `PAID_AMOUNT` DECIMAL(15, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `TRANSFER_FEE_AMOUNT` DECIMAL(15, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `PAYMENT_STATUS` VARCHAR(191) NOT NULL DEFAULT 'PAID';

-- Existing settlements were always full-amount: mark them fully paid.
-- UPDATED_AT bump so delta sync re-delivers the rows with the new fields.
UPDATE `invoice_settlement` SET `PAID_AMOUNT` = `SETTLEMENT_AMOUNT`, `UPDATED_AT` = NOW(3);

-- Payment ledger: one row per payment against a settlement.
CREATE TABLE `invoice_settlement_payment` (
  `ID` INTEGER NOT NULL AUTO_INCREMENT,
  `INVOICE_SETTLEMENT_ID` INTEGER NOT NULL,
  `PAYMENT_DATE` DATETIME(3) NOT NULL,
  `PAYMENT_METHOD` VARCHAR(191) NULL,
  `AMOUNT` DECIMAL(15, 4) NOT NULL,
  `TRANSFER_FEE_AMOUNT` DECIMAL(15, 4) NOT NULL DEFAULT 0,
  `REFERENCE` VARCHAR(191) NULL,
  `REMARK` VARCHAR(191) NULL DEFAULT '',
  `PERFORMED_BY` VARCHAR(191) NULL DEFAULT '',
  `SITE_ID` INTEGER NULL,
  `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,
  `DELETED_AT` DATETIME(3) NULL,
  `CREATED_AT` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `UPDATED_AT` DATETIME(3) NULL,
  `VERSION` INTEGER NULL DEFAULT 1,

  INDEX `invoice_settlement_payment_INVOICE_SETTLEMENT_ID_idx`(`INVOICE_SETTLEMENT_ID`),
  INDEX `invoice_settlement_payment_CREATED_AT_UPDATED_AT_DELETED_AT_idx`(`CREATED_AT`, `UPDATED_AT`, `DELETED_AT`),
  PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `invoice_settlement_payment` ADD CONSTRAINT `invoice_settlement_payment_INVOICE_SETTLEMENT_ID_fkey` FOREIGN KEY (`INVOICE_SETTLEMENT_ID`) REFERENCES `invoice_settlement`(`ID`) ON DELETE RESTRICT ON UPDATE CASCADE;
