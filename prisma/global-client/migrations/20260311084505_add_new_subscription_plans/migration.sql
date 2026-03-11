/*
  Warnings:

  - A unique constraint covering the columns `[PLAN_NAME,PLAN_TYPE]` on the table `subscription_plan` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `subscription_plan_PLAN_NAME_key` ON `subscription_plan`;

-- CreateIndex
CREATE UNIQUE INDEX `subscription_plan_PLAN_NAME_PLAN_TYPE_key` ON `subscription_plan`(`PLAN_NAME`, `PLAN_TYPE`);
