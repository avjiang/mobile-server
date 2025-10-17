/*
  Warnings:

  - You are about to drop the column `KEY` on the `setting` table. All the data in the column will be lost.
  - You are about to drop the column `TYPE` on the `setting` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[SETTING_DEFINITION_ID,TENANT_ID,USER_ID,OUTLET_ID]` on the table `setting` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `SETTING_DEFINITION_ID` to the `setting` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `setting_KEY_idx` ON `setting`;

-- DropIndex
DROP INDEX `setting_TENANT_ID_USER_ID_OUTLET_ID_KEY_key` ON `setting`;

-- AlterTable
ALTER TABLE `setting` DROP COLUMN `KEY`,
    DROP COLUMN `TYPE`,
    ADD COLUMN `SETTING_DEFINITION_ID` INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX `setting_SETTING_DEFINITION_ID_idx` ON `setting`(`SETTING_DEFINITION_ID`);

-- CreateIndex
CREATE UNIQUE INDEX `setting_SETTING_DEFINITION_ID_TENANT_ID_USER_ID_OUTLET_ID_key` ON `setting`(`SETTING_DEFINITION_ID`, `TENANT_ID`, `USER_ID`, `OUTLET_ID`);
