-- AlterTable: laundry actual processed weight on a wash-service sales line (machine price stays fixed; this drives KG reporting)
ALTER TABLE `sales_item` ADD COLUMN `LOAD_WEIGHT_KG` DECIMAL(15, 4) NULL;

-- CreateIndex: composite index for the outlet report's (outlet + date-range + status) filter — benefits every account type
CREATE INDEX `sales_OUTLET_ID_BUSINESS_DATE_STATUS_idx` ON `sales`(`OUTLET_ID`, `BUSINESS_DATE`, `STATUS`);
