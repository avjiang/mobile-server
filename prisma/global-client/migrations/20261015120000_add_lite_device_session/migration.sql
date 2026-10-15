-- Lite one-device rule: the device a Lite login is active on, and the session each
-- refresh token belongs to. Additive: a new table and a nullable column.
CREATE TABLE `tenant_user_session` (
    `TENANT_USER_ID` INTEGER NOT NULL,
    `SESSION_ID` VARCHAR(191) NOT NULL,
    `CLIENT_DEVICE_ID` VARCHAR(191) NULL,
    `DEVICE_NAME` VARCHAR(191) NULL,
    `STARTED_AT` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `LAST_SEEN_AT` DATETIME(3) NULL,

    PRIMARY KEY (`TENANT_USER_ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `refresh_token` ADD COLUMN `SESSION_ID` VARCHAR(191) NULL;
