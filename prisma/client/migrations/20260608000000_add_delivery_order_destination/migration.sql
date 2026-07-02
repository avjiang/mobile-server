-- Delivery Order goods-receipt destination (Pro warehouse feature).
-- DESTINATION_LOCATION_TYPE defaults to 'OUTLET' so all existing delivery orders
-- keep receiving stock into the outlet exactly as before. When 'WAREHOUSE', received
-- stock flows into WAREHOUSE_ID instead. Additive + safe.

ALTER TABLE `delivery_order`
  ADD COLUMN `DESTINATION_LOCATION_TYPE` VARCHAR(191) NOT NULL DEFAULT 'OUTLET',
  ADD COLUMN `WAREHOUSE_ID` INTEGER NULL;
