-- Online-catalogue product specifications for retail / F&B items: a single
-- free-text block (the whole spec sheet, pasted by the user) stored as TEXT.
-- Presentational only — edited as a whole with the item, never queried/filtered,
-- so no child table. Additive + nullable: existing rows have no specs until set.
ALTER TABLE `item` ADD COLUMN `SPECIFICATIONS` TEXT NULL;
