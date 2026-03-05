-- CreateIndex
CREATE INDEX `customer_VERSION_idx` ON `customer`(`VERSION`);

-- CreateIndex
CREATE INDEX `customer_IS_DELETED_CREATED_AT_idx` ON `customer`(`IS_DELETED`, `CREATED_AT`);

-- CreateIndex
CREATE INDEX `customer_IS_DELETED_UPDATED_AT_idx` ON `customer`(`IS_DELETED`, `UPDATED_AT`);

-- CreateIndex
CREATE INDEX `customer_IS_DELETED_DELETED_AT_idx` ON `customer`(`IS_DELETED`, `DELETED_AT`);
