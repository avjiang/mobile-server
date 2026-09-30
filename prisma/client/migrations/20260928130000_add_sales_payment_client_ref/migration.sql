-- Permanent dedupe of offline-replayed checkouts and payments.
-- CLIENT_REF = the X-Idempotency-Key the app sent with the write. The
-- idempotency_record table forgets keys after 24h, so a checkout the app
-- replays later (a till offline for a day) would otherwise be recorded twice.
--   sales.CLIENT_REF   = the key of the completeNewSales call that created it
--   payment.CLIENT_REF = "<key>:<n>" for the n-th payment of an addPayment call
-- Unique so two concurrent replays can't both insert; NULL for rows created
-- without a key (older clients, web) — MySQL allows many NULLs in a unique index.
-- Additive: no existing row changes.
ALTER TABLE `sales` ADD COLUMN `CLIENT_REF` VARCHAR(64) NULL;
CREATE UNIQUE INDEX `sales_CLIENT_REF_key` ON `sales`(`CLIENT_REF`);

ALTER TABLE `payment` ADD COLUMN `CLIENT_REF` VARCHAR(80) NULL;
CREATE UNIQUE INDEX `payment_CLIENT_REF_key` ON `payment`(`CLIENT_REF`);
