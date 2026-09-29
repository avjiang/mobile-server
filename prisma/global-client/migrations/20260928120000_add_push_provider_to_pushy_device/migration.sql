-- Push notifications moved from Pushy to Firebase Cloud Messaging. Each device
-- row records which transport issued its DEVICE_TOKEN so the backend sends to
-- it the right way. Existing rows are Pushy installs, hence the default.
ALTER TABLE `pushy_device`
  ADD COLUMN `PROVIDER` VARCHAR(191) NOT NULL DEFAULT 'pushy';
