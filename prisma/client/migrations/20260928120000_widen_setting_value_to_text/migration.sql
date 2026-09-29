-- Widen setting.VALUE from VARCHAR(191) to TEXT.
-- 191 characters capped JSON settings (payment_accounts: ~85 chars per bank
-- account, so only two fit) and long free-text ones (receipt_terms — laundry
-- T&C blocks). Widening only: no data is truncated or rewritten.
ALTER TABLE `setting` MODIFY `VALUE` TEXT NOT NULL;
