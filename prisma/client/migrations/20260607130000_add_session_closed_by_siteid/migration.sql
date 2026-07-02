-- Terminal attribution (cont.): record the terminal that CLOSED a session, which
-- may differ from the opener (`SITE_ID`). Nullable; client-supplied in the close
-- request. See docs/modules/SESSION.md + docs/modules/SALES.md.

-- AlterTable
ALTER TABLE `session` ADD COLUMN `CLOSED_BY_SITE_ID` INTEGER NULL;
