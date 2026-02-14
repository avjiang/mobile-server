-- CreateIndex
CREATE INDEX `delivery_order_OUTLET_ID_DELIVERY_DATE_idx` ON `delivery_order`(`OUTLET_ID`, `DELIVERY_DATE`);

-- CreateIndex
CREATE INDEX `invoice_OUTLET_ID_INVOICE_DATE_idx` ON `invoice`(`OUTLET_ID`, `INVOICE_DATE`);

-- CreateIndex
CREATE INDEX `purchase_order_OUTLET_ID_PURCHASE_ORDER_DATE_idx` ON `purchase_order`(`OUTLET_ID`, `PURCHASE_ORDER_DATE`);

-- CreateIndex
CREATE INDEX `purchase_return_OUTLET_ID_RETURN_DATE_idx` ON `purchase_return`(`OUTLET_ID`, `RETURN_DATE`);

-- CreateIndex
CREATE INDEX `quotation_OUTLET_ID_QUOTATION_DATE_idx` ON `quotation`(`OUTLET_ID`, `QUOTATION_DATE`);
