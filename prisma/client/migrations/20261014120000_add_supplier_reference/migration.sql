-- Supplier reference: the supplier's own number for a delivery order (their
-- surat jalan) or an invoice (their invoice). Our document numbers are
-- server-assigned since 2026-09-28, so this is where the paper's number goes.
-- Optional free text, not unique. Nullable with no default and no index, so
-- MySQL 8 adds it with ALGORITHM=INSTANT: no table copy, no lock.
-- Additive: existing rows read NULL; code that doesn't know the column is unaffected.
ALTER TABLE `delivery_order` ADD COLUMN `SUPPLIER_REFERENCE` VARCHAR(100) NULL;

ALTER TABLE `invoice` ADD COLUMN `SUPPLIER_REFERENCE` VARCHAR(100) NULL;
