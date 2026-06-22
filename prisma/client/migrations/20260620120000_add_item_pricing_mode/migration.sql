-- Item pricing mode: how PRICE becomes a line total at sale time.
-- null/'per_piece' = legacy (price × qty, or × machine capacity for a wash
-- service); 'flat_per_load' = PRICE is the per-load total charged as-is;
-- 'per_kg' = price × actual load weight (reserved). Additive + nullable, so
-- existing rows keep legacy behaviour until the aceh_wash backfill sets them.
ALTER TABLE `item` ADD COLUMN `PRICING_MODE` VARCHAR(191) NULL;
