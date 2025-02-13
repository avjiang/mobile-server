/*
  Warnings:

  - You are about to alter the column `CARD_RATE` on the `CARD_INFO` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `DECLARATION_AMOUNT` on the `DECLARATION` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `DIFFERENCE_AMOUNT` on the `DECLARATION` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `TOTAL_PAYMENT_AMOUNT` on the `DECLARATION` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `QUANTITY` on the `DELIVERY_ORDER_ITEM` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `COST` on the `ITEM` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `PRICE` on the `ITEM` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `HEIGHT` on the `ITEM` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `WIDTH` on the `ITEM` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `LENGTH` on the `ITEM` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `WEIGHT` on the `ITEM` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `PRICE` on the `MENU_ITEM` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `PRICE` on the `MENU_ITEM_MODIFIER` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `TENDERED_AMOUNT` on the `PAYMENT` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `PAID_AMOUNT` on the `PAYMENT` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `DISCOUNT_PERCENTAGE` on the `PURCHASE_ORDER` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `DISCOUNT_AMOUNT` on the `PURCHASE_ORDER` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `SERVICE_CHARGE_AMOUNT` on the `PURCHASE_ORDER` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `TAX_AMOUNT` on the `PURCHASE_ORDER` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `ROUNDING_AMOUNT` on the `PURCHASE_ORDER` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `SUBTOTAL_AMOUNT` on the `PURCHASE_ORDER` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `TOTAL_AMOUNT` on the `PURCHASE_ORDER` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `QUANTITY` on the `PURCHASE_ORDER_ITEM` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `MODIFIED_AMOUNT` on the `REGISTER_LOG` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `TOTAL_ITEM_DISCOUNT_AMOUNT` on the `SALES` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `DISCOUNT_PERCENTAGE` on the `SALES` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `DISCOUNT_AMOUNT` on the `SALES` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `PROFIT_AMOUNT` on the `SALES` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `SERVICE_CHARGE_AMOUNT` on the `SALES` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `TAX_AMOUNT` on the `SALES` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `ROUNDING_AMOUNT` on the `SALES` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `SUBTOTAL_AMOUNT` on the `SALES` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `TOTAL_AMOUNT` on the `SALES` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `PAID_AMOUNT` on the `SALES` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `CHANGE_AMOUNT` on the `SALES` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `QUANTITY` on the `SALES_ITEM` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `COST` on the `SALES_ITEM` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `PRICE` on the `SALES_ITEM` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `PROFIT` on the `SALES_ITEM` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `DISCOUNT_PERCENTAGE` on the `SALES_ITEM` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `DISCOUNT_AMOUNT` on the `SALES_ITEM` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `SERVICE_CHARGE_AMOUNT` on the `SALES_ITEM` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `TAX_AMOUNT` on the `SALES_ITEM` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `SUBTOTAL_AMOUNT` on the `SALES_ITEM` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `DISCOUNT_PERCENTAGE` on the `SALES_QUOTATION` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `DISCOUNT_AMOUNT` on the `SALES_QUOTATION` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `SERVICE_CHARGE_AMOUNT` on the `SALES_QUOTATION` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `TAX_AMOUNT` on the `SALES_QUOTATION` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `ROUNDING_AMOUNT` on the `SALES_QUOTATION` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `SUBTOTAL_AMOUNT` on the `SALES_QUOTATION` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `TOTAL_AMOUNT` on the `SALES_QUOTATION` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `QUANTITY` on the `SALES_QUOTATION_ITEM` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `OPENING_AMOUNT` on the `SESSION` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `AVAILABLE_QUANTITY` on the `STOCK` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `ON_HAND_QUANTITY` on the `STOCK` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `AVAILABLE_QUANTITY` on the `STOCK_CHECK` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.
  - You are about to alter the column `ON_HAND_QUANTITY` on the `STOCK_CHECK` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Double`.

*/
-- AlterTable
ALTER TABLE `CARD_INFO` MODIFY `CARD_RATE` DOUBLE NULL;

-- AlterTable
ALTER TABLE `DECLARATION` MODIFY `DECLARATION_AMOUNT` DOUBLE NOT NULL,
    MODIFY `DIFFERENCE_AMOUNT` DOUBLE NOT NULL,
    MODIFY `TOTAL_PAYMENT_AMOUNT` DOUBLE NOT NULL;

-- AlterTable
ALTER TABLE `DELIVERY_ORDER_ITEM` MODIFY `QUANTITY` DOUBLE NOT NULL;

-- AlterTable
ALTER TABLE `ITEM` MODIFY `COST` DOUBLE NOT NULL,
    MODIFY `PRICE` DOUBLE NOT NULL,
    MODIFY `HEIGHT` DOUBLE NOT NULL,
    MODIFY `WIDTH` DOUBLE NOT NULL,
    MODIFY `LENGTH` DOUBLE NOT NULL,
    MODIFY `WEIGHT` DOUBLE NOT NULL;

-- AlterTable
ALTER TABLE `MENU_ITEM` MODIFY `PRICE` DOUBLE NOT NULL;

-- AlterTable
ALTER TABLE `MENU_ITEM_MODIFIER` MODIFY `PRICE` DOUBLE NOT NULL;

-- AlterTable
ALTER TABLE `PAYMENT` MODIFY `TENDERED_AMOUNT` DOUBLE NOT NULL,
    MODIFY `PAID_AMOUNT` DOUBLE NOT NULL;

-- AlterTable
ALTER TABLE `PURCHASE_ORDER` MODIFY `DISCOUNT_PERCENTAGE` DOUBLE NOT NULL,
    MODIFY `DISCOUNT_AMOUNT` DOUBLE NOT NULL,
    MODIFY `SERVICE_CHARGE_AMOUNT` DOUBLE NOT NULL,
    MODIFY `TAX_AMOUNT` DOUBLE NOT NULL,
    MODIFY `ROUNDING_AMOUNT` DOUBLE NOT NULL,
    MODIFY `SUBTOTAL_AMOUNT` DOUBLE NOT NULL,
    MODIFY `TOTAL_AMOUNT` DOUBLE NOT NULL;

-- AlterTable
ALTER TABLE `PURCHASE_ORDER_ITEM` MODIFY `QUANTITY` DOUBLE NOT NULL;

-- AlterTable
ALTER TABLE `REGISTER_LOG` MODIFY `MODIFIED_AMOUNT` DOUBLE NOT NULL;

-- AlterTable
ALTER TABLE `SALES` MODIFY `TOTAL_ITEM_DISCOUNT_AMOUNT` DOUBLE NOT NULL,
    MODIFY `DISCOUNT_PERCENTAGE` DOUBLE NOT NULL,
    MODIFY `DISCOUNT_AMOUNT` DOUBLE NOT NULL,
    MODIFY `PROFIT_AMOUNT` DOUBLE NOT NULL,
    MODIFY `SERVICE_CHARGE_AMOUNT` DOUBLE NOT NULL,
    MODIFY `TAX_AMOUNT` DOUBLE NOT NULL,
    MODIFY `ROUNDING_AMOUNT` DOUBLE NOT NULL,
    MODIFY `SUBTOTAL_AMOUNT` DOUBLE NOT NULL,
    MODIFY `TOTAL_AMOUNT` DOUBLE NOT NULL,
    MODIFY `PAID_AMOUNT` DOUBLE NOT NULL,
    MODIFY `CHANGE_AMOUNT` DOUBLE NOT NULL;

-- AlterTable
ALTER TABLE `SALES_ITEM` MODIFY `QUANTITY` DOUBLE NOT NULL,
    MODIFY `COST` DOUBLE NOT NULL,
    MODIFY `PRICE` DOUBLE NOT NULL,
    MODIFY `PROFIT` DOUBLE NOT NULL,
    MODIFY `DISCOUNT_PERCENTAGE` DOUBLE NOT NULL,
    MODIFY `DISCOUNT_AMOUNT` DOUBLE NOT NULL,
    MODIFY `SERVICE_CHARGE_AMOUNT` DOUBLE NOT NULL,
    MODIFY `TAX_AMOUNT` DOUBLE NOT NULL,
    MODIFY `SUBTOTAL_AMOUNT` DOUBLE NOT NULL;

-- AlterTable
ALTER TABLE `SALES_QUOTATION` MODIFY `DISCOUNT_PERCENTAGE` DOUBLE NOT NULL,
    MODIFY `DISCOUNT_AMOUNT` DOUBLE NOT NULL,
    MODIFY `SERVICE_CHARGE_AMOUNT` DOUBLE NOT NULL,
    MODIFY `TAX_AMOUNT` DOUBLE NOT NULL,
    MODIFY `ROUNDING_AMOUNT` DOUBLE NOT NULL,
    MODIFY `SUBTOTAL_AMOUNT` DOUBLE NOT NULL,
    MODIFY `TOTAL_AMOUNT` DOUBLE NOT NULL;

-- AlterTable
ALTER TABLE `SALES_QUOTATION_ITEM` MODIFY `QUANTITY` DOUBLE NOT NULL;

-- AlterTable
ALTER TABLE `SESSION` MODIFY `OPENING_AMOUNT` DOUBLE NOT NULL;

-- AlterTable
ALTER TABLE `STOCK` MODIFY `AVAILABLE_QUANTITY` DOUBLE NOT NULL,
    MODIFY `ON_HAND_QUANTITY` DOUBLE NOT NULL;

-- AlterTable
ALTER TABLE `STOCK_CHECK` MODIFY `AVAILABLE_QUANTITY` DOUBLE NOT NULL,
    MODIFY `ON_HAND_QUANTITY` DOUBLE NOT NULL;
