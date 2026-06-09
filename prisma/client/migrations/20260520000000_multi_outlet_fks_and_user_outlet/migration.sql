-- CreateTable: user_outlet (composite PK on (USER_ID, OUTLET_ID) per spec)
CREATE TABLE IF NOT EXISTS `user_outlet` (
    `USER_ID` INTEGER NOT NULL,
    `OUTLET_ID` INTEGER NOT NULL,
    `IS_PRIMARY` BOOLEAN NOT NULL DEFAULT false,
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,
    `DELETED_AT` DATETIME(3) NULL,
    `CREATED_AT` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `UPDATED_AT` DATETIME(3) NULL,
    `VERSION` INTEGER NULL DEFAULT 1,

    INDEX `user_outlet_OUTLET_ID_idx`(`OUTLET_ID`),
    PRIMARY KEY (`USER_ID`, `OUTLET_ID`)
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

-- CreateIndex: menu_profile_outlet outletId (was missing)
CREATE INDEX `menu_profile_outlet_OUTLET_ID_idx` ON `menu_profile_outlet`(`OUTLET_ID`);

-- CreateIndex: sales stockSourceOutletId (backs the new nullable FK)
CREATE INDEX `sales_STOCK_SOURCE_OUTLET_ID_idx` ON `sales`(`STOCK_SOURCE_OUTLET_ID`);

-- AddForeignKey: outlet FK constraints on the 10 outlet-scoped tables
ALTER TABLE `sales` ADD CONSTRAINT `sales_OUTLET_ID_fkey`
    FOREIGN KEY (`OUTLET_ID`) REFERENCES `outlet`(`ID`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `sales` ADD CONSTRAINT `sales_STOCK_SOURCE_OUTLET_ID_fkey`
    FOREIGN KEY (`STOCK_SOURCE_OUTLET_ID`) REFERENCES `outlet`(`ID`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `payment` ADD CONSTRAINT `payment_OUTLET_ID_fkey`
    FOREIGN KEY (`OUTLET_ID`) REFERENCES `outlet`(`ID`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `session` ADD CONSTRAINT `session_OUTLET_ID_fkey`
    FOREIGN KEY (`OUTLET_ID`) REFERENCES `outlet`(`ID`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `invoice` ADD CONSTRAINT `invoice_OUTLET_ID_fkey`
    FOREIGN KEY (`OUTLET_ID`) REFERENCES `outlet`(`ID`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `delivery_order` ADD CONSTRAINT `delivery_order_OUTLET_ID_fkey`
    FOREIGN KEY (`OUTLET_ID`) REFERENCES `outlet`(`ID`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `quotation` ADD CONSTRAINT `quotation_OUTLET_ID_fkey`
    FOREIGN KEY (`OUTLET_ID`) REFERENCES `outlet`(`ID`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `purchase_order` ADD CONSTRAINT `purchase_order_OUTLET_ID_fkey`
    FOREIGN KEY (`OUTLET_ID`) REFERENCES `outlet`(`ID`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `register_log` ADD CONSTRAINT `register_log_OUTLET_ID_fkey`
    FOREIGN KEY (`OUTLET_ID`) REFERENCES `outlet`(`ID`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `menu_profile_outlet` ADD CONSTRAINT `menu_profile_outlet_OUTLET_ID_fkey`
    FOREIGN KEY (`OUTLET_ID`) REFERENCES `outlet`(`ID`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Note: Session open-per-user-outlet uniqueness is enforced at the application layer
-- in session.service.ts (MySQL does not support partial unique indexes with WHERE clauses).
