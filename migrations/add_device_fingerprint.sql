-- Migration: Add device fingerprint support for Pushy devices
-- Purpose: Solve app reinstallation duplicate device problem
-- Date: 2024-01-15

-- Step 1: Add DEVICE_FINGERPRINT column (nullable for backward compatibility)
ALTER TABLE `pushy_device`
ADD COLUMN `DEVICE_FINGERPRINT` VARCHAR(255) NULL AFTER `DEVICE_TOKEN`;

-- Step 2: Add index on DEVICE_FINGERPRINT for fast lookups
CREATE INDEX `pushy_device_DEVICE_FINGERPRINT_idx` ON `pushy_device`(`DEVICE_FINGERPRINT`);

-- Step 3: Add unique constraint (tenantUserId + deviceFingerprint)
-- This ensures one fingerprint per user
ALTER TABLE `pushy_device`
ADD CONSTRAINT `unique_user_device_fingerprint`
UNIQUE (`TENANT_USER_ID`, `DEVICE_FINGERPRINT`);

-- Step 4: Update existing records (optional - for data quality)
-- Set a placeholder fingerprint for existing devices based on deviceToken
-- This is optional and can be skipped if you want to let devices migrate naturally
-- UPDATE `pushy_device`
-- SET `DEVICE_FINGERPRINT` = CONCAT('legacy-', SUBSTRING(`DEVICE_TOKEN`, 1, 20))
-- WHERE `DEVICE_FINGERPRINT` IS NULL;

-- Verification queries:
-- SELECT COUNT(*) as total_devices FROM pushy_device;
-- SELECT COUNT(*) as devices_with_fingerprint FROM pushy_device WHERE DEVICE_FINGERPRINT IS NOT NULL;
-- SELECT COUNT(*) as devices_without_fingerprint FROM pushy_device WHERE DEVICE_FINGERPRINT IS NULL;

-- Rollback (if needed):
-- ALTER TABLE `pushy_device` DROP INDEX `pushy_device_DEVICE_FINGERPRINT_idx`;
-- ALTER TABLE `pushy_device` DROP CONSTRAINT `unique_user_device_fingerprint`;
-- ALTER TABLE `pushy_device` DROP COLUMN `DEVICE_FINGERPRINT`;
