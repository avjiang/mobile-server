import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canRemoveDevice } from '../device-access';
import { PERMISSION } from '../../permission/permission-names';

test('a user can remove their own device without any permission', () => {
  assert.equal(canRemoveDevice(7, 7, []), true);
});

test("a user without Manage Push Notification Devices cannot remove someone else's device", () => {
  assert.equal(canRemoveDevice(7, 9, ['Receive Notification']), false);
});

test("the device manager and the super admin can remove anyone's device", () => {
  assert.equal(canRemoveDevice(7, 9, [PERMISSION.MANAGE_PUSH_DEVICES]), true);
  assert.equal(canRemoveDevice(7, 9, ['*']), true);
});
