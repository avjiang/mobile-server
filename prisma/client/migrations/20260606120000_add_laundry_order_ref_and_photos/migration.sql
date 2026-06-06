-- AlterTable: laundry intake→pickup identity on Sales.
--   ORDER_REF      = client-minted UUID, the durable QR scan/lookup key (unique).
--   FRIENDLY_NUMBER = YYMMDD-<terminal>-<seq>, human display/search only.
--   COLLECTED_AT    = set when the bag is collected at pickup.
ALTER TABLE `sales`
    ADD COLUMN `ORDER_REF` VARCHAR(191) NULL,
    ADD COLUMN `FRIENDLY_NUMBER` VARCHAR(191) NULL,
    ADD COLUMN `COLLECTED_AT` DATETIME(3) NULL;

-- CreateIndex: orderRef is unique (backs GET /sales/ref/:orderRef).
CREATE UNIQUE INDEX `sales_ORDER_REF_key` ON `sales`(`ORDER_REF`);

-- CreateTable: laundry condition photos (≤5 per order), keyed by ORDER_REF so a
-- photo survives the gap before an offline sale receives its server id.
CREATE TABLE `sales_photo` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `ORDER_REF` VARCHAR(191) NOT NULL,
    `SALES_ID` INTEGER NULL,
    `PHOTO_URL` VARCHAR(191) NOT NULL,
    `UPLOADED_AT` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,

    INDEX `sales_photo_ORDER_REF_idx`(`ORDER_REF`),
    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
