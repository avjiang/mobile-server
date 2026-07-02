-- Terminal attribution (documents): stamp the terminal (RegisteredDevice.SITE_ID)
-- that created/edited each procurement document, so a multi-terminal outlet can
-- answer "which terminal raised this PO / invoice / settlement / quotation /
-- purchase return / delivery order". Client-supplied (same trust model as
-- PERFORMED_BY / OUTLET_ID). Nullable so existing rows + not-yet-registered
-- devices stay valid. No index: these columns are for record attribution, not
-- report grouping (cf. session.SITE_ID). See docs/modules/PROCUREMENT.md.

-- AlterTable
ALTER TABLE `purchase_order` ADD COLUMN `SITE_ID` INTEGER NULL;
ALTER TABLE `invoice` ADD COLUMN `SITE_ID` INTEGER NULL;
ALTER TABLE `invoice_settlement` ADD COLUMN `SITE_ID` INTEGER NULL;
ALTER TABLE `quotation` ADD COLUMN `SITE_ID` INTEGER NULL;
ALTER TABLE `purchase_return` ADD COLUMN `SITE_ID` INTEGER NULL;
ALTER TABLE `delivery_order` ADD COLUMN `SITE_ID` INTEGER NULL;
