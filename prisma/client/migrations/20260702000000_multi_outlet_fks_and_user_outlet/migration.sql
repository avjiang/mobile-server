-- Multi-outlet: `user_outlet` table + outlet FKs across the outlet-scoped tables.
--
-- PROD-SAFE + IDEMPOTENT rewrite (2026-07-07). The original version hardcoded
-- `OUTLET_ID = 1` and added nine RESTRICT foreign keys over already-populated
-- tables with no orphan handling and no existence guards — so it would ABORT the
-- whole migration for any tenant DB whose primary outlet isn't id 1 or that has
-- a single stray/legacy OUTLET_ID, and a retry after a partial failure would die
-- on "duplicate constraint." This version:
--   * Resolves each tenant DB's REAL primary outlet id at runtime (outlet.ID is
--     auto-increment and is NOT guaranteed to be 1).
--   * Backfills any orphan OUTLET_ID rows to that primary outlet BEFORE adding the
--     RESTRICT FKs, so FK creation can never abort on a dangling value. Every
--     current tenant is single-outlet, so each scoped row legitimately belongs to
--     the one real outlet; the backfill just corrects legacy/hardcoded ids.
--   * Guards every constraint/index with an information_schema existence check via
--     PREPARE/EXECUTE, so a re-run (including after a partial failure) is a no-op.
-- Runs once per tenant DB.

-- ── Resolve this tenant DB's primary outlet (lowest live id). NULL if none. ──
SET @primary_outlet := (SELECT `ID` FROM `outlet` WHERE `IS_DELETED` = false ORDER BY `ID` ASC LIMIT 1);

-- ── user_outlet table (composite PK on (USER_ID, OUTLET_ID) per spec) ──
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

-- AddForeignKey: user_outlet → user (guarded)
SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'user_outlet' AND CONSTRAINT_NAME = 'user_outlet_USER_ID_fkey');
SET @sql := IF(@fk = 0, 'ALTER TABLE `user_outlet` ADD CONSTRAINT `user_outlet_USER_ID_fkey` FOREIGN KEY (`USER_ID`) REFERENCES `user`(`ID`) ON DELETE RESTRICT ON UPDATE CASCADE', 'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- AddForeignKey: user_outlet → outlet (guarded)
SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'user_outlet' AND CONSTRAINT_NAME = 'user_outlet_OUTLET_ID_fkey');
SET @sql := IF(@fk = 0, 'ALTER TABLE `user_outlet` ADD CONSTRAINT `user_outlet_OUTLET_ID_fkey` FOREIGN KEY (`OUTLET_ID`) REFERENCES `outlet`(`ID`) ON DELETE RESTRICT ON UPDATE CASCADE', 'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Seed: assign every existing non-deleted user to the REAL primary outlet.
-- Skips entirely on a zero-outlet DB (@primary_outlet IS NULL). Idempotent.
INSERT INTO `user_outlet` (`USER_ID`, `OUTLET_ID`, `IS_PRIMARY`, `IS_DELETED`, `CREATED_AT`)
SELECT `ID`, @primary_outlet, true, false, NOW()
FROM `user`
WHERE `IS_DELETED` = false AND @primary_outlet IS NOT NULL
ON DUPLICATE KEY UPDATE `IS_PRIMARY` = VALUES(`IS_PRIMARY`);

-- ── Backfill orphan OUTLET_ID rows to the primary outlet before adding RESTRICT
--    FKs (no-op when there are no orphans, or on a zero-outlet DB). ──
UPDATE `sales` t LEFT JOIN `outlet` o ON t.`OUTLET_ID` = o.`ID` SET t.`OUTLET_ID` = @primary_outlet WHERE o.`ID` IS NULL AND @primary_outlet IS NOT NULL;
UPDATE `payment` t LEFT JOIN `outlet` o ON t.`OUTLET_ID` = o.`ID` SET t.`OUTLET_ID` = @primary_outlet WHERE o.`ID` IS NULL AND @primary_outlet IS NOT NULL;
UPDATE `session` t LEFT JOIN `outlet` o ON t.`OUTLET_ID` = o.`ID` SET t.`OUTLET_ID` = @primary_outlet WHERE o.`ID` IS NULL AND @primary_outlet IS NOT NULL;
UPDATE `invoice` t LEFT JOIN `outlet` o ON t.`OUTLET_ID` = o.`ID` SET t.`OUTLET_ID` = @primary_outlet WHERE o.`ID` IS NULL AND @primary_outlet IS NOT NULL;
UPDATE `delivery_order` t LEFT JOIN `outlet` o ON t.`OUTLET_ID` = o.`ID` SET t.`OUTLET_ID` = @primary_outlet WHERE o.`ID` IS NULL AND @primary_outlet IS NOT NULL;
UPDATE `quotation` t LEFT JOIN `outlet` o ON t.`OUTLET_ID` = o.`ID` SET t.`OUTLET_ID` = @primary_outlet WHERE o.`ID` IS NULL AND @primary_outlet IS NOT NULL;
UPDATE `purchase_order` t LEFT JOIN `outlet` o ON t.`OUTLET_ID` = o.`ID` SET t.`OUTLET_ID` = @primary_outlet WHERE o.`ID` IS NULL AND @primary_outlet IS NOT NULL;
UPDATE `register_log` t LEFT JOIN `outlet` o ON t.`OUTLET_ID` = o.`ID` SET t.`OUTLET_ID` = @primary_outlet WHERE o.`ID` IS NULL AND @primary_outlet IS NOT NULL;
UPDATE `menu_profile_outlet` t LEFT JOIN `outlet` o ON t.`OUTLET_ID` = o.`ID` SET t.`OUTLET_ID` = @primary_outlet WHERE o.`ID` IS NULL AND @primary_outlet IS NOT NULL;
-- STOCK_SOURCE_OUTLET_ID is nullable with an ON DELETE SET NULL FK: null out orphans, keep valid refs.
UPDATE `sales` t LEFT JOIN `outlet` o ON t.`STOCK_SOURCE_OUTLET_ID` = o.`ID` SET t.`STOCK_SOURCE_OUTLET_ID` = NULL WHERE t.`STOCK_SOURCE_OUTLET_ID` IS NOT NULL AND o.`ID` IS NULL;

-- ── Indexes (guarded; MySQL has no CREATE INDEX IF NOT EXISTS) ──
SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment' AND INDEX_NAME = 'payment_OUTLET_ID_idx');
SET @sql := IF(@idx = 0, 'CREATE INDEX `payment_OUTLET_ID_idx` ON `payment`(`OUTLET_ID`)', 'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'register_log' AND INDEX_NAME = 'register_log_OUTLET_ID_idx');
SET @sql := IF(@idx = 0, 'CREATE INDEX `register_log_OUTLET_ID_idx` ON `register_log`(`OUTLET_ID`)', 'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'session' AND INDEX_NAME = 'session_OUTLET_ID_idx');
SET @sql := IF(@idx = 0, 'CREATE INDEX `session_OUTLET_ID_idx` ON `session`(`OUTLET_ID`)', 'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'menu_profile_outlet' AND INDEX_NAME = 'menu_profile_outlet_OUTLET_ID_idx');
SET @sql := IF(@idx = 0, 'CREATE INDEX `menu_profile_outlet_OUTLET_ID_idx` ON `menu_profile_outlet`(`OUTLET_ID`)', 'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales' AND INDEX_NAME = 'sales_STOCK_SOURCE_OUTLET_ID_idx');
SET @sql := IF(@idx = 0, 'CREATE INDEX `sales_STOCK_SOURCE_OUTLET_ID_idx` ON `sales`(`STOCK_SOURCE_OUTLET_ID`)', 'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── Foreign keys (all guarded) ──
-- menu_profile_outlet → menu_profile
SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'menu_profile_outlet' AND CONSTRAINT_NAME = 'menu_profile_outlet_MENU_PROFILE_ID_fkey');
SET @sql := IF(@fk = 0, 'ALTER TABLE `menu_profile_outlet` ADD CONSTRAINT `menu_profile_outlet_MENU_PROFILE_ID_fkey` FOREIGN KEY (`MENU_PROFILE_ID`) REFERENCES `menu_profile`(`ID`) ON DELETE RESTRICT ON UPDATE CASCADE', 'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- sales → outlet (OUTLET_ID)
SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'sales' AND CONSTRAINT_NAME = 'sales_OUTLET_ID_fkey');
SET @sql := IF(@fk = 0, 'ALTER TABLE `sales` ADD CONSTRAINT `sales_OUTLET_ID_fkey` FOREIGN KEY (`OUTLET_ID`) REFERENCES `outlet`(`ID`) ON DELETE RESTRICT ON UPDATE CASCADE', 'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- sales → outlet (STOCK_SOURCE_OUTLET_ID, nullable, SET NULL)
SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'sales' AND CONSTRAINT_NAME = 'sales_STOCK_SOURCE_OUTLET_ID_fkey');
SET @sql := IF(@fk = 0, 'ALTER TABLE `sales` ADD CONSTRAINT `sales_STOCK_SOURCE_OUTLET_ID_fkey` FOREIGN KEY (`STOCK_SOURCE_OUTLET_ID`) REFERENCES `outlet`(`ID`) ON DELETE SET NULL ON UPDATE CASCADE', 'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- payment → outlet
SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'payment' AND CONSTRAINT_NAME = 'payment_OUTLET_ID_fkey');
SET @sql := IF(@fk = 0, 'ALTER TABLE `payment` ADD CONSTRAINT `payment_OUTLET_ID_fkey` FOREIGN KEY (`OUTLET_ID`) REFERENCES `outlet`(`ID`) ON DELETE RESTRICT ON UPDATE CASCADE', 'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- session → outlet
SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'session' AND CONSTRAINT_NAME = 'session_OUTLET_ID_fkey');
SET @sql := IF(@fk = 0, 'ALTER TABLE `session` ADD CONSTRAINT `session_OUTLET_ID_fkey` FOREIGN KEY (`OUTLET_ID`) REFERENCES `outlet`(`ID`) ON DELETE RESTRICT ON UPDATE CASCADE', 'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- invoice → outlet
SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'invoice' AND CONSTRAINT_NAME = 'invoice_OUTLET_ID_fkey');
SET @sql := IF(@fk = 0, 'ALTER TABLE `invoice` ADD CONSTRAINT `invoice_OUTLET_ID_fkey` FOREIGN KEY (`OUTLET_ID`) REFERENCES `outlet`(`ID`) ON DELETE RESTRICT ON UPDATE CASCADE', 'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- delivery_order → outlet
SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'delivery_order' AND CONSTRAINT_NAME = 'delivery_order_OUTLET_ID_fkey');
SET @sql := IF(@fk = 0, 'ALTER TABLE `delivery_order` ADD CONSTRAINT `delivery_order_OUTLET_ID_fkey` FOREIGN KEY (`OUTLET_ID`) REFERENCES `outlet`(`ID`) ON DELETE RESTRICT ON UPDATE CASCADE', 'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- quotation → outlet
SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'quotation' AND CONSTRAINT_NAME = 'quotation_OUTLET_ID_fkey');
SET @sql := IF(@fk = 0, 'ALTER TABLE `quotation` ADD CONSTRAINT `quotation_OUTLET_ID_fkey` FOREIGN KEY (`OUTLET_ID`) REFERENCES `outlet`(`ID`) ON DELETE RESTRICT ON UPDATE CASCADE', 'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- purchase_order → outlet
SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_order' AND CONSTRAINT_NAME = 'purchase_order_OUTLET_ID_fkey');
SET @sql := IF(@fk = 0, 'ALTER TABLE `purchase_order` ADD CONSTRAINT `purchase_order_OUTLET_ID_fkey` FOREIGN KEY (`OUTLET_ID`) REFERENCES `outlet`(`ID`) ON DELETE RESTRICT ON UPDATE CASCADE', 'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- register_log → outlet
SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'register_log' AND CONSTRAINT_NAME = 'register_log_OUTLET_ID_fkey');
SET @sql := IF(@fk = 0, 'ALTER TABLE `register_log` ADD CONSTRAINT `register_log_OUTLET_ID_fkey` FOREIGN KEY (`OUTLET_ID`) REFERENCES `outlet`(`ID`) ON DELETE RESTRICT ON UPDATE CASCADE', 'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- menu_profile_outlet → outlet
SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'menu_profile_outlet' AND CONSTRAINT_NAME = 'menu_profile_outlet_OUTLET_ID_fkey');
SET @sql := IF(@fk = 0, 'ALTER TABLE `menu_profile_outlet` ADD CONSTRAINT `menu_profile_outlet_OUTLET_ID_fkey` FOREIGN KEY (`OUTLET_ID`) REFERENCES `outlet`(`ID`) ON DELETE RESTRICT ON UPDATE CASCADE', 'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Note: Session open-per-user-outlet uniqueness is enforced at the application layer
-- in session.service.ts (MySQL does not support partial unique indexes with WHERE clauses).
