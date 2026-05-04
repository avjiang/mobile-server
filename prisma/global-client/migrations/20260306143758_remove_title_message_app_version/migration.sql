/*
  Warnings:

  - You are about to drop the column `MESSAGE` on the `app_version` table. All the data in the column will be lost.
  - You are about to drop the column `TITLE` on the `app_version` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `app_version` DROP COLUMN `MESSAGE`,
    DROP COLUMN `TITLE`;
