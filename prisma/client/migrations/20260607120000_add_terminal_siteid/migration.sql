-- Terminal attribution: stamp the originating terminal (RegisteredDevice.SITE_ID)
-- onto every transactional record so multi-terminal outlets can answer "which
-- terminal performed X". Client-supplied (same trust model as PERFORMED_BY /
-- OUTLET_ID / SESSION_ID). Nullable so existing rows + not-yet-registered
-- devices stay valid. See docs/modules/SALES.md + docs/modules/AUTH.md.

-- AlterTable
ALTER TABLE `sales` ADD COLUMN `SITE_ID` INTEGER NULL;
ALTER TABLE `payment` ADD COLUMN `SITE_ID` INTEGER NULL;
ALTER TABLE `stock_movement` ADD COLUMN `SITE_ID` INTEGER NULL;
ALTER TABLE `session` ADD COLUMN `SITE_ID` INTEGER NULL;

-- CreateIndex (per-terminal report grouping / attribution lookups)
CREATE INDEX `sales_SITE_ID_idx` ON `sales`(`SITE_ID`);
CREATE INDEX `payment_SITE_ID_idx` ON `payment`(`SITE_ID`);
CREATE INDEX `stock_movement_SITE_ID_idx` ON `stock_movement`(`SITE_ID`);
