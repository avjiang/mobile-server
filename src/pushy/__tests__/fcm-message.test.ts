import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMessage } from '../fcm.service';

test('FCM message carries the notification as a JSON string (FCM data must be strings)', () => {
  const payload = {
    title: 'Penjualan selesai',
    message: 'Rp 187.550',
    notificationId: 'abc-123',
    tenantId: 5,
    outletId: 1,
    triggeringUserId: 7,
    items: [{ id: 1, qty: 2 }],
  };

  const message = buildMessage(payload.title, payload.message, payload);

  const data = message.data as Record<string, unknown>;
  assert.deepEqual(Object.keys(data), ['payload']);
  assert.equal(typeof data.payload, 'string');
  // The app decodes this back into the exact map (ints and nested values intact)
  assert.deepEqual(JSON.parse(data.payload as string), payload);
});

test('Android is data-only + high priority; iOS gets a system alert', () => {
  const message = buildMessage('T', 'B', { title: 'T', message: 'B' });

  // No top-level notification block: on Android the app shows it itself, so it
  // can skip the user's own actions.
  assert.equal((message as Record<string, unknown>).notification, undefined);
  assert.equal(message.android?.priority, 'high');
  assert.deepEqual(message.apns?.payload?.aps?.alert, { title: 'T', body: 'B' });
  assert.equal(message.apns?.payload?.aps?.contentAvailable, true);
});
