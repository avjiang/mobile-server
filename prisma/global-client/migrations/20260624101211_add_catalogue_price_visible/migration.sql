-- Per-tenant "Show Price" toggle for the public online catalogue. When false, the
-- catalogue page hides all prices, the price sort control, and the price in the
-- WhatsApp order prefill. Defaults true so existing tenants are unaffected.
ALTER TABLE `tenant`
  ADD COLUMN `CATALOGUE_PRICE_VISIBLE` BOOLEAN NOT NULL DEFAULT true;
