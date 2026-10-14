-- F&B P0 (docs/future/FNB_FEATURES.md D1/D3/D5): drop the unused F&B scaffolding from the
-- baseline schema. `menu_*` is replaced by Item (D1); `sales_item_modifier` (P1) and `recipe`
-- (P3) are recreated in their new shape; `order_routing` gives way to `kitchen_ticket` (P2);
-- `split_bill` becomes N payments on one settle (P4); `reservation`/`waitlist` have no demand yet.
--
-- GUARD: these tables are expected to be empty everywhere (0 rows since the baseline). If any
-- row exists, the CHECK below fails the INSERT and the migration stops before anything is
-- dropped. Then stop and reassess (§7 #5) — never delete the guard to push it through.
CREATE TEMPORARY TABLE `_fnb_p0_guard` (`ROWS_FOUND` INT NOT NULL, CHECK (`ROWS_FOUND` = 0));
INSERT INTO `_fnb_p0_guard` (`ROWS_FOUND`) SELECT
    (SELECT COUNT(*) FROM `menu_profile_outlet`) + (SELECT COUNT(*) FROM `menu_profile`) +
    (SELECT COUNT(*) FROM `menu_category`) + (SELECT COUNT(*) FROM `menu_item`) +
    (SELECT COUNT(*) FROM `menu_item_modifier_group`) + (SELECT COUNT(*) FROM `menu_item_modifier`) +
    (SELECT COUNT(*) FROM `recipe`) + (SELECT COUNT(*) FROM `sales_item_modifier`) +
    (SELECT COUNT(*) FROM `order_routing`) + (SELECT COUNT(*) FROM `reservation`) +
    (SELECT COUNT(*) FROM `waitlist`) + (SELECT COUNT(*) FROM `split_bill`);
DROP TEMPORARY TABLE `_fnb_p0_guard`;

-- DropForeignKey
ALTER TABLE `sales_item_modifier` DROP FOREIGN KEY `sales_item_modifier_MENU_ITEM_MODIFIER_ID_fkey`;

-- DropForeignKey
ALTER TABLE `sales_item_modifier` DROP FOREIGN KEY `sales_item_modifier_SALES_ITEM_ID_fkey`;

-- DropForeignKey
ALTER TABLE `menu_profile_outlet` DROP FOREIGN KEY `menu_profile_outlet_OUTLET_ID_fkey`;

-- DropForeignKey
ALTER TABLE `menu_profile_outlet` DROP FOREIGN KEY `menu_profile_outlet_MENU_PROFILE_ID_fkey`;

-- DropForeignKey
ALTER TABLE `menu_category` DROP FOREIGN KEY `menu_category_MENU_PROFILE_ID_fkey`;

-- DropForeignKey
ALTER TABLE `menu_item` DROP FOREIGN KEY `menu_item_MENU_CATEGORY_ID_fkey`;

-- DropForeignKey
ALTER TABLE `menu_item_modifier_group` DROP FOREIGN KEY `menu_item_modifier_group_MENU_ITEM_ID_fkey`;

-- DropForeignKey
ALTER TABLE `menu_item_modifier` DROP FOREIGN KEY `menu_item_modifier_MENU_ITEM_MODIFIER_GROUP_ID_fkey`;

-- DropForeignKey
ALTER TABLE `recipe` DROP FOREIGN KEY `recipe_MENU_ITEM_MODIFIER_ID_fkey`;

-- DropForeignKey
ALTER TABLE `recipe` DROP FOREIGN KEY `recipe_MENU_ITEM_ID_fkey`;

-- DropForeignKey
ALTER TABLE `recipe` DROP FOREIGN KEY `recipe_ITEM_ID_fkey`;

-- DropForeignKey
ALTER TABLE `reservation` DROP FOREIGN KEY `reservation_OUTLET_ID_fkey`;

-- DropForeignKey
ALTER TABLE `reservation` DROP FOREIGN KEY `reservation_CUSTOMER_ID_fkey`;

-- DropForeignKey
ALTER TABLE `reservation` DROP FOREIGN KEY `reservation_TABLE_ID_fkey`;

-- DropForeignKey
ALTER TABLE `order_routing` DROP FOREIGN KEY `order_routing_SALES_ITEM_ID_fkey`;

-- DropForeignKey
ALTER TABLE `order_routing` DROP FOREIGN KEY `order_routing_STATION_ID_fkey`;

-- DropForeignKey
ALTER TABLE `waitlist` DROP FOREIGN KEY `waitlist_OUTLET_ID_fkey`;

-- DropForeignKey
ALTER TABLE `waitlist` DROP FOREIGN KEY `waitlist_CUSTOMER_ID_fkey`;

-- DropForeignKey
ALTER TABLE `split_bill` DROP FOREIGN KEY `split_bill_PAYMENT_ID_fkey`;

-- DropForeignKey
ALTER TABLE `split_bill` DROP FOREIGN KEY `split_bill_CUSTOMER_ID_fkey`;

-- DropTable
DROP TABLE `sales_item_modifier`;

-- DropTable
DROP TABLE `menu_profile_outlet`;

-- DropTable
DROP TABLE `menu_profile`;

-- DropTable
DROP TABLE `menu_category`;

-- DropTable
DROP TABLE `menu_item`;

-- DropTable
DROP TABLE `menu_item_modifier_group`;

-- DropTable
DROP TABLE `menu_item_modifier`;

-- DropTable
DROP TABLE `recipe`;

-- DropTable
DROP TABLE `reservation`;

-- DropTable
DROP TABLE `order_routing`;

-- DropTable
DROP TABLE `waitlist`;

-- DropTable
DROP TABLE `split_bill`;

