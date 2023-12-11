-- AlterTable
ALTER TABLE `User` ADD COLUMN `deleted` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `RefreshToken` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `userType` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expired` DATETIME(3) NULL,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdByIP` VARCHAR(191) NULL,
    `revoked` DATETIME(3) NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Referral` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NULL,
    `firstName` VARCHAR(191) NULL,
    `mobile` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `Referral_username_key`(`username`),
    UNIQUE INDEX `Referral_mobile_key`(`mobile`),
    UNIQUE INDEX `Referral_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Supplier` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyName` VARCHAR(191) NOT NULL,
    `companyStreet` VARCHAR(191) NOT NULL,
    `companyCity` VARCHAR(191) NOT NULL,
    `companyState` VARCHAR(191) NOT NULL,
    `companyPostalCode` VARCHAR(191) NOT NULL,
    `compantCountry` VARCHAR(191) NOT NULL,
    `companyRegisterNumber` VARCHAR(191) NOT NULL,
    `personInChargeLastName` VARCHAR(191) NULL,
    `personInChargeFirstName` VARCHAR(191) NULL,
    `mobile` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `remark` VARCHAR(191) NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Customer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `salutation` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `firstName` VARCHAR(191) NULL,
    `mobile` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `gender` VARCHAR(191) NULL,
    `billStreet` VARCHAR(191) NULL,
    `billCity` VARCHAR(191) NULL,
    `billState` VARCHAR(191) NULL,
    `billPostalCode` VARCHAR(191) NULL,
    `billCountry` VARCHAR(191) NULL,
    `billRemark` VARCHAR(191) NULL,
    `shipStreet` VARCHAR(191) NULL,
    `shipCity` VARCHAR(191) NULL,
    `shipState` VARCHAR(191) NULL,
    `shipPostalCode` VARCHAR(191) NULL,
    `shipCountry` VARCHAR(191) NULL,
    `shipRemark` VARCHAR(191) NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Company` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyName` VARCHAR(191) NOT NULL,
    `street` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `postalCode` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NOT NULL,
    `registerNumber` VARCHAR(191) NOT NULL,
    `website` VARCHAR(191) NULL,
    `referralId` VARCHAR(191) NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `Company_registerNumber_key`(`registerNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Outlet` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `outletName` VARCHAR(191) NOT NULL,
    `street` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `postalCode` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `outletTel` VARCHAR(191) NULL,
    `outletEmail` VARCHAR(191) NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Item` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `itemCode` VARCHAR(191) NOT NULL,
    `itemName` VARCHAR(191) NOT NULL,
    `itemType` VARCHAR(191) NULL,
    `itemModel` VARCHAR(191) NULL,
    `itemBrand` VARCHAR(191) NULL,
    `itemDescription` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `cost` DECIMAL(65, 30) NOT NULL,
    `price` DECIMAL(65, 30) NOT NULL,
    `isOpenPrice` BOOLEAN NOT NULL DEFAULT false,
    `unitOfMeasure` VARCHAR(191) NULL,
    `height` DECIMAL(65, 30) NOT NULL,
    `width` DECIMAL(65, 30) NOT NULL,
    `length` DECIMAL(65, 30) NOT NULL,
    `weight` DECIMAL(65, 30) NOT NULL,
    `alternateLookUp` VARCHAR(191) NULL,
    `image` VARCHAR(191) NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `Item_itemCode_key`(`itemCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Sales` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `outletId` INTEGER NOT NULL,
    `businessDate` DATETIME(3) NOT NULL,
    `salesType` VARCHAR(191) NULL,
    `customerId` INTEGER NULL,
    `billStreet` VARCHAR(191) NULL,
    `billCity` VARCHAR(191) NULL,
    `billState` VARCHAR(191) NULL,
    `billPostalCode` VARCHAR(191) NULL,
    `billCountry` VARCHAR(191) NULL,
    `shipStreet` VARCHAR(191) NULL,
    `shipCity` VARCHAR(191) NULL,
    `shipState` VARCHAR(191) NULL,
    `shipPostalCode` VARCHAR(191) NULL,
    `shipCountry` VARCHAR(191) NULL,
    `discountPercentage` DECIMAL(65, 30) NOT NULL,
    `discountAmount` DECIMAL(65, 30) NOT NULL,
    `serviceChargeAmount` DECIMAL(65, 30) NOT NULL,
    `taxAmount` DECIMAL(65, 30) NOT NULL,
    `roundingAmount` DECIMAL(65, 30) NOT NULL,
    `subtotalAmount` DECIMAL(65, 30) NOT NULL,
    `totalAmount` DECIMAL(65, 30) NOT NULL,
    `paidAmount` DECIMAL(65, 30) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `remark` VARCHAR(191) NULL,
    `declarationSessionId` INTEGER NOT NULL,
    `eodId` INTEGER NOT NULL,
    `salesQuotationId` INTEGER NULL,
    `performedBy` INTEGER NOT NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SalesItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `salesId` INTEGER NOT NULL,
    `itemId` INTEGER NOT NULL,
    `quantity` DECIMAL(65, 30) NOT NULL,
    `remark` VARCHAR(191) NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SalesQuotation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `outletId` INTEGER NOT NULL,
    `customerId` INTEGER NULL,
    `customerStreet` VARCHAR(191) NULL,
    `customerCity` VARCHAR(191) NULL,
    `customerState` VARCHAR(191) NULL,
    `customerPostalCode` VARCHAR(191) NULL,
    `customerCountry` VARCHAR(191) NULL,
    `discountPercentage` DECIMAL(65, 30) NOT NULL,
    `discountAmount` DECIMAL(65, 30) NOT NULL,
    `serviceChargeAmount` DECIMAL(65, 30) NOT NULL,
    `taxAmount` DECIMAL(65, 30) NOT NULL,
    `roundingAmount` DECIMAL(65, 30) NOT NULL,
    `subtotalAmount` DECIMAL(65, 30) NOT NULL,
    `totalAmount` DECIMAL(65, 30) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `remark` VARCHAR(191) NULL,
    `performedBy` INTEGER NOT NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SalesQuotationItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `salesQuotationId` INTEGER NOT NULL,
    `itemId` INTEGER NOT NULL,
    `quantity` DECIMAL(65, 30) NOT NULL,
    `remark` VARCHAR(191) NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeliveryOrder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `outletId` INTEGER NOT NULL,
    `customerId` INTEGER NULL,
    `deliveryStreet` VARCHAR(191) NULL,
    `deliveryCity` VARCHAR(191) NULL,
    `deliveryState` VARCHAR(191) NULL,
    `deliveryPostalCode` VARCHAR(191) NULL,
    `deliveryCountry` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL,
    `remark` VARCHAR(191) NULL,
    `performedBy` INTEGER NOT NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeliveryOrderItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `deliveryOrderId` INTEGER NOT NULL,
    `itemId` INTEGER NOT NULL,
    `quantity` DECIMAL(65, 30) NOT NULL,
    `remark` VARCHAR(191) NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseOrder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `outletId` INTEGER NOT NULL,
    `supplierId` INTEGER NULL,
    `supplierStreet` VARCHAR(191) NULL,
    `supplierCity` VARCHAR(191) NULL,
    `supplierState` VARCHAR(191) NULL,
    `supplierPostalCode` VARCHAR(191) NULL,
    `supplierCountry` VARCHAR(191) NULL,
    `discountPercentage` DECIMAL(65, 30) NOT NULL,
    `discountAmount` DECIMAL(65, 30) NOT NULL,
    `serviceChargeAmount` DECIMAL(65, 30) NOT NULL,
    `taxAmount` DECIMAL(65, 30) NOT NULL,
    `roundingAmount` DECIMAL(65, 30) NOT NULL,
    `subtotalAmount` DECIMAL(65, 30) NOT NULL,
    `totalAmount` DECIMAL(65, 30) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `remark` VARCHAR(191) NULL,
    `performedBy` INTEGER NOT NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseOrderItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `purchaseOrderId` INTEGER NOT NULL,
    `itemId` INTEGER NOT NULL,
    `quantity` DECIMAL(65, 30) NOT NULL,
    `remark` VARCHAR(191) NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `method` VARCHAR(191) NOT NULL,
    `tenderedAmount` DECIMAL(65, 30) NOT NULL,
    `paidAmount` DECIMAL(65, 30) NOT NULL,
    `currencySymbol` VARCHAR(191) NOT NULL,
    `salesId` INTEGER NOT NULL,
    `reference` VARCHAR(191) NULL,
    `remark` VARCHAR(191) NULL,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `businessDate` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `outletId` INTEGER NOT NULL,
    `declarationSessionId` INTEGER NOT NULL,
    `eodId` INTEGER NOT NULL,
    `performedBy` INTEGER NOT NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RegisterLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(191) NOT NULL,
    `modifiedAmount` DECIMAL(65, 30) NOT NULL,
    `currencySymbol` VARCHAR(191) NOT NULL,
    `salesId` INTEGER NOT NULL,
    `remark` VARCHAR(191) NULL,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` VARCHAR(191) NOT NULL,
    `outletId` INTEGER NOT NULL,
    `declarationSessionId` INTEGER NOT NULL,
    `eodId` INTEGER NOT NULL,
    `performedBy` INTEGER NOT NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CardInfo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `paymentId` INTEGER NOT NULL,
    `cardNumber` VARCHAR(191) NULL,
    `cardExpiry` VARCHAR(191) NULL,
    `traceNumber` VARCHAR(191) NULL,
    `type2` VARCHAR(191) NULL,
    `type3` VARCHAR(191) NULL,
    `cardRate` DECIMAL(65, 30) NULL,
    `appCode` VARCHAR(191) NULL,
    `cardType` VARCHAR(191) NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Declaration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `deviceId` INTEGER NOT NULL,
    `outletId` INTEGER NOT NULL,
    `eodId` INTEGER NOT NULL,
    `openingDateTime` DATETIME(3) NULL,
    `closingDateTime` DATETIME(3) NULL,
    `businessDate` DATETIME(3) NOT NULL,
    `verifiedBy` INTEGER NULL,
    `openedBy` INTEGER NULL,
    `closedBy` INTEGER NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EOD` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `deviceId` INTEGER NOT NULL,
    `outletId` INTEGER NOT NULL,
    `openingDateTime` DATETIME(3) NULL,
    `closingDateTime` DATETIME(3) NULL,
    `businessDate` DATETIME(3) NOT NULL,
    `verifiedBy` INTEGER NULL,
    `openedBy` INTEGER NULL,
    `closedBy` INTEGER NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
