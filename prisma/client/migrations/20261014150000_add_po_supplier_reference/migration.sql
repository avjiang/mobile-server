-- The supplier's own order / confirmation number on a purchase order (free text, optional).
-- Additive + nullable: MySQL 8 adds it INSTANT, no table rebuild; the running server ignores it.
ALTER TABLE `purchase_order` ADD COLUMN `SUPPLIER_REFERENCE` VARCHAR(100) NULL;
