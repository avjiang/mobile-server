-- Settlement "mark as fully paid" rounding write-off.
-- paidAmount stays the REAL cash received; writeOffAmount holds the small remainder
-- forgiven (e.g. transfer rounded the bill down by a few rupiah) so the settlement can
-- close. Fully paid when round(paidAmount + writeOffAmount) >= round(settlementAmount).
-- Additive + nullable/defaulted, so existing rows are unaffected (writeOffAmount = 0).
ALTER TABLE `invoice_settlement`
  ADD COLUMN `WRITE_OFF_AMOUNT` DECIMAL(15,4) NOT NULL DEFAULT 0,
  ADD COLUMN `WRITE_OFF_BY` VARCHAR(191) NULL,
  ADD COLUMN `WRITE_OFF_AT` DATETIME(3) NULL,
  ADD COLUMN `WRITE_OFF_REASON` VARCHAR(191) NULL;
