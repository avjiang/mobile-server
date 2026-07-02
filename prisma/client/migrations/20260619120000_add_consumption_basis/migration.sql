-- Laundry consumption basis: how a recipe line consumes its supply.
--   'perKg'  → rate × load weight (detergent, the existing behaviour)
--   'perLoad'→ flat amount per wash, independent of weight (e.g. 1 tabung of LPG)
-- Default 'perKg' so every existing recipe line keeps its current behaviour.
ALTER TABLE `item_consumable`
  ADD COLUMN `CONSUMPTION_BASIS` VARCHAR(191) NOT NULL DEFAULT 'perKg';
