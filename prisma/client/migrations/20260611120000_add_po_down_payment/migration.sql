-- PO down payment (supplier advance) — additive only.
-- DP is a payment credit drawn down across a PO's invoices; it NEVER mutates
-- totalAmount/discount/cost. All new columns default 0/null so the feature is
-- dormant until a supplier/PO opts in. Safe on prod.

-- Supplier: default draw rate (%)
ALTER TABLE `supplier`
  ADD COLUMN `DEFAULT_DOWN_PAYMENT_PERCENTAGE` DECIMAL(15, 4) NULL;

-- PurchaseOrder: draw rate snapshot + DP totals
ALTER TABLE `purchase_order`
  ADD COLUMN `DOWN_PAYMENT_PERCENTAGE` DECIMAL(15, 4) NULL,
  ADD COLUMN `DOWN_PAYMENT_AMOUNT` DECIMAL(15, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `DOWN_PAYMENT_APPLIED` DECIMAL(15, 4) NOT NULL DEFAULT 0;

-- Invoice: amount drawn from the PO DP balance by this invoice
ALTER TABLE `invoice`
  ADD COLUMN `DOWN_PAYMENT_APPLIED` DECIMAL(15, 4) NOT NULL DEFAULT 0;

-- DP payment ledger (one row per advance paid to the supplier)
CREATE TABLE `purchase_order_payment` (
  `ID` INTEGER NOT NULL AUTO_INCREMENT,
  `PURCHASE_ORDER_ID` INTEGER NOT NULL,
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

  INDEX `purchase_order_payment_PURCHASE_ORDER_ID_idx`(`PURCHASE_ORDER_ID`),
  INDEX `purchase_order_payment_CREATED_AT_UPDATED_AT_DELETED_AT_idx`(`CREATED_AT`, `UPDATED_AT`, `DELETED_AT`),
  PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `purchase_order_payment` ADD CONSTRAINT `purchase_order_payment_PURCHASE_ORDER_ID_fkey` FOREIGN KEY (`PURCHASE_ORDER_ID`) REFERENCES `purchase_order`(`ID`) ON DELETE RESTRICT ON UPDATE CASCADE;
