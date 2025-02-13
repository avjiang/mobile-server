/*
  Warnings:

  - Made the column `WEBSITE` on table `COMPANY` required. This step will fail if there are existing NULL values in that column.
  - Made the column `REFERRAL_ID` on table `COMPANY` required. This step will fail if there are existing NULL values in that column.
  - Made the column `SALUTATION` on table `CUSTOMER` required. This step will fail if there are existing NULL values in that column.
  - Made the column `LAST_NAME` on table `CUSTOMER` required. This step will fail if there are existing NULL values in that column.
  - Made the column `FIRST_NAME` on table `CUSTOMER` required. This step will fail if there are existing NULL values in that column.
  - Made the column `MOBILE` on table `CUSTOMER` required. This step will fail if there are existing NULL values in that column.
  - Made the column `EMAIL` on table `CUSTOMER` required. This step will fail if there are existing NULL values in that column.
  - Made the column `GENDER` on table `CUSTOMER` required. This step will fail if there are existing NULL values in that column.
  - Made the column `BILL_STREET` on table `CUSTOMER` required. This step will fail if there are existing NULL values in that column.
  - Made the column `BILL_CITY` on table `CUSTOMER` required. This step will fail if there are existing NULL values in that column.
  - Made the column `BILL_STATE` on table `CUSTOMER` required. This step will fail if there are existing NULL values in that column.
  - Made the column `BILL_POSTAL_CODE` on table `CUSTOMER` required. This step will fail if there are existing NULL values in that column.
  - Made the column `BILL_COUNTRY` on table `CUSTOMER` required. This step will fail if there are existing NULL values in that column.
  - Made the column `BILL_REMARK` on table `CUSTOMER` required. This step will fail if there are existing NULL values in that column.
  - Made the column `SHIP_STREET` on table `CUSTOMER` required. This step will fail if there are existing NULL values in that column.
  - Made the column `SHIP_CITY` on table `CUSTOMER` required. This step will fail if there are existing NULL values in that column.
  - Made the column `SHIP_STATE` on table `CUSTOMER` required. This step will fail if there are existing NULL values in that column.
  - Made the column `SHIP_POSTAL_CODE` on table `CUSTOMER` required. This step will fail if there are existing NULL values in that column.
  - Made the column `SHIP_COUNTRY` on table `CUSTOMER` required. This step will fail if there are existing NULL values in that column.
  - Made the column `SHIP_REMARK` on table `CUSTOMER` required. This step will fail if there are existing NULL values in that column.
  - Made the column `ITEM_TYPE` on table `ITEM` required. This step will fail if there are existing NULL values in that column.
  - Made the column `ITEM_MODEL` on table `ITEM` required. This step will fail if there are existing NULL values in that column.
  - Made the column `ITEM_BRAND` on table `ITEM` required. This step will fail if there are existing NULL values in that column.
  - Made the column `ITEM_DESCRIPTION` on table `ITEM` required. This step will fail if there are existing NULL values in that column.
  - Made the column `CATEGORY` on table `ITEM` required. This step will fail if there are existing NULL values in that column.
  - Made the column `UNIT_OF_MEASURE` on table `ITEM` required. This step will fail if there are existing NULL values in that column.
  - Made the column `ALTERNATE_LOOKUP` on table `ITEM` required. This step will fail if there are existing NULL values in that column.
  - Made the column `IMAGE` on table `ITEM` required. This step will fail if there are existing NULL values in that column.
  - Made the column `STREET` on table `OUTLET` required. This step will fail if there are existing NULL values in that column.
  - Made the column `CITY` on table `OUTLET` required. This step will fail if there are existing NULL values in that column.
  - Made the column `STATE` on table `OUTLET` required. This step will fail if there are existing NULL values in that column.
  - Made the column `POSTAL_CODE` on table `OUTLET` required. This step will fail if there are existing NULL values in that column.
  - Made the column `COUNTRY` on table `OUTLET` required. This step will fail if there are existing NULL values in that column.
  - Made the column `OUTLET_TEL` on table `OUTLET` required. This step will fail if there are existing NULL values in that column.
  - Made the column `OUTLET_EMAIL` on table `OUTLET` required. This step will fail if there are existing NULL values in that column.
  - Made the column `REFERENCE` on table `PAYMENT` required. This step will fail if there are existing NULL values in that column.
  - Made the column `REMARK` on table `PAYMENT` required. This step will fail if there are existing NULL values in that column.
  - Made the column `REMARK` on table `REGISTER_LOG` required. This step will fail if there are existing NULL values in that column.
  - Made the column `SALES_TYPE` on table `SALES` required. This step will fail if there are existing NULL values in that column.
  - Made the column `CUSTOMER_ID` on table `SALES` required. This step will fail if there are existing NULL values in that column.
  - Made the column `BILL_STREET` on table `SALES` required. This step will fail if there are existing NULL values in that column.
  - Made the column `BILL_CITY` on table `SALES` required. This step will fail if there are existing NULL values in that column.
  - Made the column `BILL_STATE` on table `SALES` required. This step will fail if there are existing NULL values in that column.
  - Made the column `BILL_POSTAL_CODE` on table `SALES` required. This step will fail if there are existing NULL values in that column.
  - Made the column `BILL_COUNTRY` on table `SALES` required. This step will fail if there are existing NULL values in that column.
  - Made the column `SHIP_STREET` on table `SALES` required. This step will fail if there are existing NULL values in that column.
  - Made the column `SHIP_CITY` on table `SALES` required. This step will fail if there are existing NULL values in that column.
  - Made the column `SHIP_STATE` on table `SALES` required. This step will fail if there are existing NULL values in that column.
  - Made the column `SHIP_POSTAL_CODE` on table `SALES` required. This step will fail if there are existing NULL values in that column.
  - Made the column `SHIP_COUNTRY` on table `SALES` required. This step will fail if there are existing NULL values in that column.
  - Made the column `REMARK` on table `SALES` required. This step will fail if there are existing NULL values in that column.
  - Made the column `SALES_QUOTATION_ID` on table `SALES` required. This step will fail if there are existing NULL values in that column.
  - Made the column `REMARK` on table `SALES_ITEM` required. This step will fail if there are existing NULL values in that column.
  - Made the column `PERSON_IN_CHARGE_LAST_NAME` on table `SUPPLIER` required. This step will fail if there are existing NULL values in that column.
  - Made the column `PERSON_IN_CHARGE_FIRST_NAME` on table `SUPPLIER` required. This step will fail if there are existing NULL values in that column.
  - Made the column `MOBILE` on table `SUPPLIER` required. This step will fail if there are existing NULL values in that column.
  - Made the column `EMAIL` on table `SUPPLIER` required. This step will fail if there are existing NULL values in that column.
  - Made the column `REMARK` on table `SUPPLIER` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `COMPANY` MODIFY `COMPANY_NAME` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `STREET` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `CITY` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `STATE` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `POSTAL_CODE` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `COUNTRY` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `WEBSITE` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `REFERRAL_ID` VARCHAR(191) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE `CUSTOMER` MODIFY `SALUTATION` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `LAST_NAME` VARCHAR(191) NOT NULL,
    MODIFY `FIRST_NAME` VARCHAR(191) NOT NULL,
    MODIFY `MOBILE` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `EMAIL` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `GENDER` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `BILL_STREET` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `BILL_CITY` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `BILL_STATE` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `BILL_POSTAL_CODE` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `BILL_COUNTRY` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `BILL_REMARK` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `SHIP_STREET` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `SHIP_CITY` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `SHIP_STATE` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `SHIP_POSTAL_CODE` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `SHIP_COUNTRY` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `SHIP_REMARK` VARCHAR(191) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE `ITEM` MODIFY `ITEM_TYPE` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `ITEM_MODEL` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `ITEM_BRAND` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `ITEM_DESCRIPTION` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `CATEGORY` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `UNIT_OF_MEASURE` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `HEIGHT` DOUBLE NOT NULL DEFAULT 0,
    MODIFY `WIDTH` DOUBLE NOT NULL DEFAULT 0,
    MODIFY `LENGTH` DOUBLE NOT NULL DEFAULT 0,
    MODIFY `WEIGHT` DOUBLE NOT NULL DEFAULT 0,
    MODIFY `ALTERNATE_LOOKUP` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `IMAGE` VARCHAR(191) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE `OUTLET` MODIFY `STREET` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `CITY` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `STATE` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `POSTAL_CODE` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `COUNTRY` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `OUTLET_TEL` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `OUTLET_EMAIL` VARCHAR(191) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE `PAYMENT` MODIFY `CURRENCY_SYMBOL` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `REFERENCE` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `REMARK` VARCHAR(191) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE `REGISTER_LOG` MODIFY `CURRENCY_SYMBOL` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `REMARK` VARCHAR(191) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE `SALES` MODIFY `SALES_TYPE` VARCHAR(191) NOT NULL,
    MODIFY `CUSTOMER_ID` INTEGER NOT NULL DEFAULT 0,
    MODIFY `BILL_STREET` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `BILL_CITY` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `BILL_STATE` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `BILL_POSTAL_CODE` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `BILL_COUNTRY` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `SHIP_STREET` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `SHIP_CITY` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `SHIP_STATE` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `SHIP_POSTAL_CODE` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `SHIP_COUNTRY` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `TOTAL_ITEM_DISCOUNT_AMOUNT` DOUBLE NOT NULL DEFAULT 0,
    MODIFY `DISCOUNT_PERCENTAGE` DOUBLE NOT NULL DEFAULT 0,
    MODIFY `DISCOUNT_AMOUNT` DOUBLE NOT NULL DEFAULT 0,
    MODIFY `SERVICE_CHARGE_AMOUNT` DOUBLE NOT NULL DEFAULT 0,
    MODIFY `TAX_AMOUNT` DOUBLE NOT NULL DEFAULT 0,
    MODIFY `ROUNDING_AMOUNT` DOUBLE NOT NULL DEFAULT 0,
    MODIFY `PAID_AMOUNT` DOUBLE NOT NULL DEFAULT 0,
    MODIFY `CHANGE_AMOUNT` DOUBLE NOT NULL DEFAULT 0,
    MODIFY `REMARK` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `SALES_QUOTATION_ID` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `SALES_ITEM` MODIFY `DISCOUNT_PERCENTAGE` DOUBLE NOT NULL DEFAULT 0,
    MODIFY `DISCOUNT_AMOUNT` DOUBLE NOT NULL DEFAULT 0,
    MODIFY `SERVICE_CHARGE_AMOUNT` DOUBLE NOT NULL DEFAULT 0,
    MODIFY `TAX_AMOUNT` DOUBLE NOT NULL DEFAULT 0,
    MODIFY `REMARK` VARCHAR(191) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE `STOCK_CHECK` MODIFY `REMARK` VARCHAR(191) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE `SUPPLIER` MODIFY `COMPANY_STREET` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `COMPANY_CITY` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `COMPANY_STATE` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `COMPANY_POSTAL_CODE` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `COMPANY_COUNTRY` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `COMPANY_REGISTRATION_NUMBER` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `PERSON_IN_CHARGE_LAST_NAME` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `PERSON_IN_CHARGE_FIRST_NAME` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `MOBILE` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `EMAIL` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `REMARK` VARCHAR(191) NOT NULL DEFAULT '';
