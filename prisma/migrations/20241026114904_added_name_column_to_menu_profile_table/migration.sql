/*
  Warnings:

  - You are about to drop the column `NAME` on the `MENU_PROFILE_OUTLET` table. All the data in the column will be lost.
  - Added the required column `NAME` to the `MENU_PROFILE` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `MENU_PROFILE` ADD COLUMN `NAME` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `MENU_PROFILE_OUTLET` DROP COLUMN `NAME`;
