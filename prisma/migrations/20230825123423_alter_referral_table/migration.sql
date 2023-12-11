/*
  Warnings:

  - You are about to drop the column `EMAIL` on the `REFERRAL` table. All the data in the column will be lost.
  - You are about to drop the column `FIRST_NAME` on the `REFERRAL` table. All the data in the column will be lost.
  - You are about to drop the column `LAST_NAME` on the `REFERRAL` table. All the data in the column will be lost.
  - You are about to drop the column `MOBILE` on the `REFERRAL` table. All the data in the column will be lost.
  - You are about to drop the column `PASSWORD` on the `REFERRAL` table. All the data in the column will be lost.
  - You are about to drop the column `USERNAME` on the `REFERRAL` table. All the data in the column will be lost.
  - Added the required column `REFERRAL_ID` to the `REFERRAL` table without a default value. This is not possible if the table is not empty.
  - Added the required column `USER_ID` to the `REFERRAL` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `REFERRAL_EMAIL_key` ON `REFERRAL`;

-- DropIndex
DROP INDEX `REFERRAL_MOBILE_key` ON `REFERRAL`;

-- DropIndex
DROP INDEX `REFERRAL_USERNAME_key` ON `REFERRAL`;

-- AlterTable
ALTER TABLE `REFERRAL` DROP COLUMN `EMAIL`,
    DROP COLUMN `FIRST_NAME`,
    DROP COLUMN `LAST_NAME`,
    DROP COLUMN `MOBILE`,
    DROP COLUMN `PASSWORD`,
    DROP COLUMN `USERNAME`,
    ADD COLUMN `REFERRAL_ID` INTEGER NOT NULL,
    ADD COLUMN `USER_ID` INTEGER NOT NULL;
