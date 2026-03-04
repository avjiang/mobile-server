/*
  Warnings:

  - The primary key for the `refresh_token` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `ID` on the `refresh_token` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `refresh_token_TOKEN_idx` ON `refresh_token`;

-- AlterTable
ALTER TABLE `refresh_token` DROP PRIMARY KEY,
    DROP COLUMN `ID`,
    ADD PRIMARY KEY (`TOKEN`);
