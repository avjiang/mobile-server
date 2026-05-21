-- CreateTable: user_outlet (if it doesn't already exist)
CREATE TABLE IF NOT EXISTS `user_outlet` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `USER_ID` INTEGER NOT NULL,
    `OUTLET_ID` INTEGER NOT NULL,
    `IS_PRIMARY` BOOLEAN NOT NULL DEFAULT false,
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,
    `DELETED_AT` DATETIME(3) NULL,
    `CREATED_AT` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `UPDATED_AT` DATETIME(3) NULL,
    `VERSION` INTEGER NULL DEFAULT 1,

    INDEX `user_outlet_USER_ID_idx`(`USER_ID`),
    INDEX `user_outlet_OUTLET_ID_idx`(`OUTLET_ID`),
    UNIQUE INDEX `user_outlet_USER_ID_OUTLET_ID_key`(`USER_ID`, `OUTLET_ID`),
    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: user_outlet → user
ALTER TABLE `user_outlet` ADD CONSTRAINT `user_outlet_USER_ID_fkey`
    FOREIGN KEY (`USER_ID`) REFERENCES `user`(`ID`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: user_outlet → outlet
ALTER TABLE `user_outlet` ADD CONSTRAINT `user_outlet_OUTLET_ID_fkey`
    FOREIGN KEY (`OUTLET_ID`) REFERENCES `outlet`(`ID`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed: assign every existing non-deleted user to outlet 1
INSERT INTO `user_outlet` (`USER_ID`, `OUTLET_ID`, `IS_PRIMARY`, `IS_DELETED`, `CREATED_AT`)
SELECT `ID`, 1, true, false, NOW()
FROM `user`
WHERE `IS_DELETED` = false
ON DUPLICATE KEY UPDATE `IS_PRIMARY` = VALUES(`IS_PRIMARY`);

-- CreateIndex: missing outletId indexes on payment, register_log, session
CREATE INDEX `payment_OUTLET_ID_idx` ON `payment`(`OUTLET_ID`);
CREATE INDEX `register_log_OUTLET_ID_idx` ON `register_log`(`OUTLET_ID`);
CREATE INDEX `session_OUTLET_ID_idx` ON `session`(`OUTLET_ID`);

-- AddForeignKey: menu_profile_outlet → menu_profile
ALTER TABLE `menu_profile_outlet` ADD CONSTRAINT `menu_profile_outlet_MENU_PROFILE_ID_fkey`
    FOREIGN KEY (`MENU_PROFILE_ID`) REFERENCES `menu_profile`(`ID`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Note: Session open-per-user-outlet uniqueness is enforced at the application layer
-- in session.service.ts (MySQL does not support partial unique indexes with WHERE clauses).
