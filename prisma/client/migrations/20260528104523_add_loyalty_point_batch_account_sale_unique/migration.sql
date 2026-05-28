/*
  Warnings:

  - A unique constraint covering the columns `[LOYALTY_ACCOUNT_ID,SALES_ID]` on the table `loyalty_point_batch` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `loyalty_point_batch_LOYALTY_ACCOUNT_ID_SALES_ID_key` ON `loyalty_point_batch`(`LOYALTY_ACCOUNT_ID`, `SALES_ID`);
