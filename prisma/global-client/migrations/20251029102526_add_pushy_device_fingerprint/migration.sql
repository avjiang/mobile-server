/*
  Warnings:

  - A unique constraint covering the columns `[TENANT_USER_ID,DEVICE_FINGERPRINT]` on the table `pushy_device` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `pushy_device` ADD COLUMN `DEVICE_FINGERPRINT` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `pushy_device_DEVICE_FINGERPRINT_idx` ON `pushy_device`(`DEVICE_FINGERPRINT`);

-- CreateIndex
CREATE UNIQUE INDEX `pushy_device_TENANT_USER_ID_DEVICE_FINGERPRINT_key` ON `pushy_device`(`TENANT_USER_ID`, `DEVICE_FINGERPRINT`);
