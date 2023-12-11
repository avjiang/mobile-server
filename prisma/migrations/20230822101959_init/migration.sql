/*
  Warnings:

  - The primary key for the `EOD` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `businessDate` on the `EOD` table. All the data in the column will be lost.
  - You are about to drop the column `closedBy` on the `EOD` table. All the data in the column will be lost.
  - You are about to drop the column `closingDateTime` on the `EOD` table. All the data in the column will be lost.
  - You are about to drop the column `deleted` on the `EOD` table. All the data in the column will be lost.
  - You are about to drop the column `deviceId` on the `EOD` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `EOD` table. All the data in the column will be lost.
  - You are about to drop the column `openedBy` on the `EOD` table. All the data in the column will be lost.
  - You are about to drop the column `openingDateTime` on the `EOD` table. All the data in the column will be lost.
  - You are about to drop the column `outletId` on the `EOD` table. All the data in the column will be lost.
  - You are about to drop the column `verifiedBy` on the `EOD` table. All the data in the column will be lost.
  - You are about to drop the `CardInfo` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Company` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Customer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Declaration` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DeliveryOrder` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DeliveryOrderItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Item` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Outlet` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Payment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PurchaseOrder` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PurchaseOrderItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Referral` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RefreshToken` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RegisterLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Sales` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SalesItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SalesQuotation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SalesQuotationItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Supplier` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `BUSINESS_DATE` to the `EOD` table without a default value. This is not possible if the table is not empty.
  - Added the required column `DEVICE_ID` to the `EOD` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ID` to the `EOD` table without a default value. This is not possible if the table is not empty.
  - Added the required column `OUTLET_ID` to the `EOD` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `EOD` DROP PRIMARY KEY,
    DROP COLUMN `businessDate`,
    DROP COLUMN `closedBy`,
    DROP COLUMN `closingDateTime`,
    DROP COLUMN `deleted`,
    DROP COLUMN `deviceId`,
    DROP COLUMN `id`,
    DROP COLUMN `openedBy`,
    DROP COLUMN `openingDateTime`,
    DROP COLUMN `outletId`,
    DROP COLUMN `verifiedBy`,
    ADD COLUMN `BUSINESS_DATE` DATETIME(3) NOT NULL,
    ADD COLUMN `CLOSED_BY` INTEGER NULL,
    ADD COLUMN `CLOSING_DATE_TIME` DATETIME(3) NULL,
    ADD COLUMN `DEVICE_ID` INTEGER NOT NULL,
    ADD COLUMN `ID` INTEGER NOT NULL AUTO_INCREMENT,
    ADD COLUMN `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `OPENED_BY` INTEGER NULL,
    ADD COLUMN `OPENING_DATE_TIME` DATETIME(3) NULL,
    ADD COLUMN `OUTLET_ID` INTEGER NOT NULL,
    ADD COLUMN `VERIFIED_BY` INTEGER NULL,
    ADD PRIMARY KEY (`ID`);

-- DropTable
DROP TABLE `CardInfo`;

-- DropTable
DROP TABLE `Company`;

-- DropTable
DROP TABLE `Customer`;

-- DropTable
DROP TABLE `Declaration`;

-- DropTable
DROP TABLE `DeliveryOrder`;

-- DropTable
DROP TABLE `DeliveryOrderItem`;

-- DropTable
DROP TABLE `Item`;

-- DropTable
DROP TABLE `Outlet`;

-- DropTable
DROP TABLE `Payment`;

-- DropTable
DROP TABLE `PurchaseOrder`;

-- DropTable
DROP TABLE `PurchaseOrderItem`;

-- DropTable
DROP TABLE `Referral`;

-- DropTable
DROP TABLE `RefreshToken`;

-- DropTable
DROP TABLE `RegisterLog`;

-- DropTable
DROP TABLE `Sales`;

-- DropTable
DROP TABLE `SalesItem`;

-- DropTable
DROP TABLE `SalesQuotation`;

-- DropTable
DROP TABLE `SalesQuotationItem`;

-- DropTable
DROP TABLE `Supplier`;

-- DropTable
DROP TABLE `User`;

-- CreateTable
CREATE TABLE `USER` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `USERNAME` VARCHAR(191) NOT NULL,
    `PASSWORD` VARCHAR(191) NOT NULL,
    `LAST_NAME` VARCHAR(191) NULL,
    `FIRST_NAME` VARCHAR(191) NULL,
    `MOBILE` VARCHAR(191) NULL,
    `EMAIL` VARCHAR(191) NULL,
    `ROLE` VARCHAR(191) NOT NULL,
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `USER_USERNAME_key`(`USERNAME`),
    UNIQUE INDEX `USER_MOBILE_key`(`MOBILE`),
    UNIQUE INDEX `USER_EMAIL_key`(`EMAIL`),
    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `REFRESH_TOKEN` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `USER_ID` INTEGER NOT NULL,
    `USER_TYPE` VARCHAR(191) NOT NULL,
    `TOKEN` VARCHAR(191) NOT NULL,
    `EXPIRED` DATETIME(3) NULL,
    `CREATED_DATETIME` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `CREATED_BY` VARCHAR(191) NULL,
    `IS_REVOKED` DATETIME(3) NULL,
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `REFERRAL` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `USERNAME` VARCHAR(191) NOT NULL,
    `PASSWORD` VARCHAR(191) NOT NULL,
    `LAST_NAME` VARCHAR(191) NULL,
    `FIRST_NAME` VARCHAR(191) NULL,
    `MOBILE` VARCHAR(191) NULL,
    `EMAIL` VARCHAR(191) NULL,
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `REFERRAL_USERNAME_key`(`USERNAME`),
    UNIQUE INDEX `REFERRAL_MOBILE_key`(`MOBILE`),
    UNIQUE INDEX `REFERRAL_EMAIL_key`(`EMAIL`),
    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SUPPLIER` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `COMPANY_NAME` VARCHAR(191) NOT NULL,
    `COMPANY_STREET` VARCHAR(191) NOT NULL,
    `COMPANY_CITY` VARCHAR(191) NOT NULL,
    `COMPANY_STATE` VARCHAR(191) NOT NULL,
    `COMPANY_POSTAL_CODE` VARCHAR(191) NOT NULL,
    `COMPANY_COUNTRY` VARCHAR(191) NOT NULL,
    `COMPANY_REGISTRATION_NUMBER` VARCHAR(191) NOT NULL,
    `PERSON_IN_CHARGE_LAST_NAME` VARCHAR(191) NULL,
    `PERSON_IN_CHARGE_FIRST_NAME` VARCHAR(191) NULL,
    `MOBILE` VARCHAR(191) NULL,
    `EMAIL` VARCHAR(191) NULL,
    `REMARK` VARCHAR(191) NULL,
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CUSTOMER` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `SALUTATION` VARCHAR(191) NULL,
    `LAST_NAME` VARCHAR(191) NULL,
    `FIRST_NAME` VARCHAR(191) NULL,
    `MOBILE` VARCHAR(191) NULL,
    `EMAIL` VARCHAR(191) NULL,
    `GENDER` VARCHAR(191) NULL,
    `BILL_STREET` VARCHAR(191) NULL,
    `BILL_CITY` VARCHAR(191) NULL,
    `BILL_STATE` VARCHAR(191) NULL,
    `BILL_POSTAL_CODE` VARCHAR(191) NULL,
    `BILL_COUNTRY` VARCHAR(191) NULL,
    `BILL_REMARK` VARCHAR(191) NULL,
    `SHIP_STREET` VARCHAR(191) NULL,
    `SHIP_CITY` VARCHAR(191) NULL,
    `SHIP_STATE` VARCHAR(191) NULL,
    `SHIP_POSTAL_CODE` VARCHAR(191) NULL,
    `SHIP_COUNTRY` VARCHAR(191) NULL,
    `SHIP_REMARK` VARCHAR(191) NULL,
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `COMPANY` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `COMPANY_NAME` VARCHAR(191) NOT NULL,
    `STREET` VARCHAR(191) NOT NULL,
    `CITY` VARCHAR(191) NOT NULL,
    `STATE` VARCHAR(191) NOT NULL,
    `POSTAL_CODE` VARCHAR(191) NOT NULL,
    `COUNTRY` VARCHAR(191) NOT NULL,
    `REGISTRATION_NUMBER` VARCHAR(191) NOT NULL,
    `WEBSITE` VARCHAR(191) NULL,
    `REFERRAL_ID` VARCHAR(191) NULL,
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `COMPANY_REGISTRATION_NUMBER_key`(`REGISTRATION_NUMBER`),
    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OUTLET` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `OUTLET_NAME` VARCHAR(191) NOT NULL,
    `STREET` VARCHAR(191) NULL,
    `CITY` VARCHAR(191) NULL,
    `STATE` VARCHAR(191) NULL,
    `POSTAL_CODE` VARCHAR(191) NULL,
    `COUNTRY` VARCHAR(191) NULL,
    `OUTLET_TEL` VARCHAR(191) NULL,
    `OUTLET_EMAIL` VARCHAR(191) NULL,
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ITEM` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `ITEM_CODE` VARCHAR(191) NOT NULL,
    `ITEM_NAME` VARCHAR(191) NOT NULL,
    `ITEM_TYPE` VARCHAR(191) NULL,
    `ITEM_MODEL` VARCHAR(191) NULL,
    `ITEM_BRAND` VARCHAR(191) NULL,
    `ITEM_DESCRIPTION` VARCHAR(191) NULL,
    `CATEGORY` VARCHAR(191) NULL,
    `COST` DECIMAL(65, 30) NOT NULL,
    `PRICE` DECIMAL(65, 30) NOT NULL,
    `IS_OPEN_PRICE` BOOLEAN NOT NULL DEFAULT false,
    `UNIT_OF_MEASURE` VARCHAR(191) NULL,
    `HEIGHT` DECIMAL(65, 30) NOT NULL,
    `WIDTH` DECIMAL(65, 30) NOT NULL,
    `LENGTH` DECIMAL(65, 30) NOT NULL,
    `WEIGHT` DECIMAL(65, 30) NOT NULL,
    `ALTERNATE_LOOKUP` VARCHAR(191) NULL,
    `IMAGE` VARCHAR(191) NULL,
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `ITEM_ITEM_CODE_key`(`ITEM_CODE`),
    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SALES` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `CREATED_DATETIME` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `OUTLET_ID` INTEGER NOT NULL,
    `BUSINESS_DATE` DATETIME(3) NOT NULL,
    `SALES_TYPE` VARCHAR(191) NULL,
    `CUSTOMER_ID` INTEGER NULL,
    `BILL_STREET` VARCHAR(191) NULL,
    `BILL_CITY` VARCHAR(191) NULL,
    `BILL_STATE` VARCHAR(191) NULL,
    `BILL_POSTAL_CODE` VARCHAR(191) NULL,
    `BILL_COUNTRY` VARCHAR(191) NULL,
    `SHIP_STREET` VARCHAR(191) NULL,
    `SHIP_CITY` VARCHAR(191) NULL,
    `SHIP_STATE` VARCHAR(191) NULL,
    `SHIP_POSTAL_CODE` VARCHAR(191) NULL,
    `SHIP_COUNTRY` VARCHAR(191) NULL,
    `DISCOUNT_PERCENTAGE` DECIMAL(65, 30) NOT NULL,
    `DISCOUNT_AMOUNT` DECIMAL(65, 30) NOT NULL,
    `SERVICE_CHARGE_AMOUNT` DECIMAL(65, 30) NOT NULL,
    `TAX_AMOUNT` DECIMAL(65, 30) NOT NULL,
    `ROUNDING_AMOUNT` DECIMAL(65, 30) NOT NULL,
    `SUBTOTAL_AMOUNT` DECIMAL(65, 30) NOT NULL,
    `TOTAL_AMOUNT` DECIMAL(65, 30) NOT NULL,
    `PAID_AMOUNT` DECIMAL(65, 30) NOT NULL,
    `STATUS` VARCHAR(191) NOT NULL,
    `REMARK` VARCHAR(191) NULL,
    `DECLARATION_SESSION_ID` INTEGER NOT NULL,
    `EOD_ID` INTEGER NOT NULL,
    `SALES_QUOTATION_ID` INTEGER NULL,
    `PERFORMED_BY` INTEGER NOT NULL,
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SALES_ITEM` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `SALES_ID` INTEGER NOT NULL,
    `ITEM_ID` INTEGER NOT NULL,
    `QUANTITY` DECIMAL(65, 30) NOT NULL,
    `REMARK` VARCHAR(191) NULL,
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SALES_QUOTATION` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `CREATED_DATETIME` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `OUTLET_ID` INTEGER NOT NULL,
    `CUSTOMER_ID` INTEGER NULL,
    `CUSTOMER_STREET` VARCHAR(191) NULL,
    `CUSTOMER_CITY` VARCHAR(191) NULL,
    `CUSTOMER_STATE` VARCHAR(191) NULL,
    `CUSTOMER_POSTAL_CODE` VARCHAR(191) NULL,
    `CUSTOMER_COUNTRY` VARCHAR(191) NULL,
    `DISCOUNT_PERCENTAGE` DECIMAL(65, 30) NOT NULL,
    `DISCOUNT_AMOUNT` DECIMAL(65, 30) NOT NULL,
    `SERVICE_CHARGE_AMOUNT` DECIMAL(65, 30) NOT NULL,
    `TAX_AMOUNT` DECIMAL(65, 30) NOT NULL,
    `ROUNDING_AMOUNT` DECIMAL(65, 30) NOT NULL,
    `SUBTOTAL_AMOUNT` DECIMAL(65, 30) NOT NULL,
    `TOTAL_AMOUNT` DECIMAL(65, 30) NOT NULL,
    `STATUS` VARCHAR(191) NOT NULL,
    `REMARK` VARCHAR(191) NULL,
    `PERFORMED_BY` INTEGER NOT NULL,
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SALES_QUoTATION_ITEM` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `SALES_QUOTATION_ID` INTEGER NOT NULL,
    `ITEM_ID` INTEGER NOT NULL,
    `QUANTITY` DECIMAL(65, 30) NOT NULL,
    `REMARK` VARCHAR(191) NULL,
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DELIVERY_ORDER` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `OUTLET_ID` INTEGER NOT NULL,
    `CUSTOMER_ID` INTEGER NULL,
    `DELIVERY_STREET` VARCHAR(191) NULL,
    `DELIVERY_CITY` VARCHAR(191) NULL,
    `DELIVERY_STATE` VARCHAR(191) NULL,
    `DELIVERY_POSTAL_CODE` VARCHAR(191) NULL,
    `DELIVERY_COUNTRY` VARCHAR(191) NULL,
    `STATUS` VARCHAR(191) NOT NULL,
    `REMARK` VARCHAR(191) NULL,
    `PERFORMED_BY` INTEGER NOT NULL,
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DELIVERY_ORDER_ITEM` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `DELIVERY_ORDER_ID` INTEGER NOT NULL,
    `ITEM_ID` INTEGER NOT NULL,
    `QUANTITY` DECIMAL(65, 30) NOT NULL,
    `REMARK` VARCHAR(191) NULL,
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PURCHASE_ORDER` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `OUTLET_ID` INTEGER NOT NULL,
    `SUPPLIER_ID` INTEGER NULL,
    `SUPPLIER_STREET` VARCHAR(191) NULL,
    `SUPPLIER_CITY` VARCHAR(191) NULL,
    `SUPPLIER_STATE` VARCHAR(191) NULL,
    `SUPPLIER_POSTAL_CODE` VARCHAR(191) NULL,
    `SUPPLIER_COUNTRY` VARCHAR(191) NULL,
    `DISCOUNT_PERCENTAGE` DECIMAL(65, 30) NOT NULL,
    `DISCOUNT_AMOUNT` DECIMAL(65, 30) NOT NULL,
    `SERVICE_CHARGE_AMOUNT` DECIMAL(65, 30) NOT NULL,
    `TAX_AMOUNT` DECIMAL(65, 30) NOT NULL,
    `ROUNDING_AMOUNT` DECIMAL(65, 30) NOT NULL,
    `SUBTOTAL_AMOUNT` DECIMAL(65, 30) NOT NULL,
    `TOTAL_AMOUNT` DECIMAL(65, 30) NOT NULL,
    `STATUS` VARCHAR(191) NOT NULL,
    `REMARK` VARCHAR(191) NULL,
    `PERFORMED_BY` INTEGER NOT NULL,
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PURCHASE_ORDER_ITEM` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `PURCHASE_ORDER_ID` INTEGER NOT NULL,
    `ITEM_ID` INTEGER NOT NULL,
    `QUANTITY` DECIMAL(65, 30) NOT NULL,
    `REMARK` VARCHAR(191) NULL,
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PAYMENT` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `PAYMENT` VARCHAR(191) NOT NULL,
    `TENDERED_AMOUNT` DECIMAL(65, 30) NOT NULL,
    `PAID_AMOUNT` DECIMAL(65, 30) NOT NULL,
    `CURRENCY_SYMBOL` VARCHAR(191) NOT NULL,
    `SALES_ID` INTEGER NOT NULL,
    `REFERENCE` VARCHAR(191) NULL,
    `REMARK` VARCHAR(191) NULL,
    `CREATED_DATETIME` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `BUSINESS_DATE` DATETIME(3) NOT NULL,
    `STATUS` VARCHAR(191) NOT NULL,
    `OUTLET_ID` INTEGER NOT NULL,
    `DECLARATION_SESSION_ID` INTEGER NOT NULL,
    `EOD_ID` INTEGER NOT NULL,
    `PERFORMED_BY` INTEGER NOT NULL,
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `REGISTER_LOG` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `TYPE` VARCHAR(191) NOT NULL,
    `MODIFIED_AMOUNT` DECIMAL(65, 30) NOT NULL,
    `CURRENCY_SYMBOL` VARCHAR(191) NOT NULL,
    `SALES_ID` INTEGER NOT NULL,
    `REMARK` VARCHAR(191) NULL,
    `CREATED_DATETIME` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `STATUS` VARCHAR(191) NOT NULL,
    `OUTLET_ID` INTEGER NOT NULL,
    `DECLARATION_SESSION_ID` INTEGER NOT NULL,
    `EOD_ID` INTEGER NOT NULL,
    `PERFORMED_BY` INTEGER NOT NULL,
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CARD_INFO` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `PAYMENT_ID` INTEGER NOT NULL,
    `CARD_NUMBER` VARCHAR(191) NULL,
    `CARD_EXPIRY` VARCHAR(191) NULL,
    `TRACE_NUMBER` VARCHAR(191) NULL,
    `TYPE_2` VARCHAR(191) NULL,
    `TYPE_3` VARCHAR(191) NULL,
    `cardRate` DECIMAL(65, 30) NULL,
    `APP_CODE` VARCHAR(191) NULL,
    `CARD_TYPE` VARCHAR(191) NULL,
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DECLARATION` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `DEVICE_ID` INTEGER NOT NULL,
    `OUTLET_ID` INTEGER NOT NULL,
    `EOD_ID` INTEGER NOT NULL,
    `OPENING_DATE_TIME` DATETIME(3) NULL,
    `CLOSING_DATE_TIME` DATETIME(3) NULL,
    `BUSINESS_DATE` DATETIME(3) NOT NULL,
    `VERIFIED_BY` INTEGER NULL,
    `OPENED_BY` INTEGER NULL,
    `CLOSED_BY` INTEGER NULL,
    `IS_DELETED` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
