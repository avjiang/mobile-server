-- Storefront branding for the public online catalogue (see docs/future/ONLINE_CATALOGUE.md)
ALTER TABLE `tenant` ADD COLUMN `LOGO_URL` VARCHAR(191) NULL;
ALTER TABLE `tenant` ADD COLUMN `COVER_URL` VARCHAR(191) NULL;
