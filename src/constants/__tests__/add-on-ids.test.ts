import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADD_ON_IDS, isNonBillableAddOn } from '../add-on-ids';

test('the retired Extra Device add-on is never billed, on any plan type', () => {
  for (const planType of ['Retail', 'Laundry', 'F&B', null]) {
    assert.equal(isNonBillableAddOn(ADD_ON_IDS.EXTRA_DEVICE, planType), true);
  }
});

test('Advanced Loyalty is free only on Laundry and F&B Pro (bundled into the plan)', () => {
  assert.equal(isNonBillableAddOn(ADD_ON_IDS.ADVANCED_LOYALTY, 'Laundry'), true);
  assert.equal(isNonBillableAddOn(ADD_ON_IDS.ADVANCED_LOYALTY, 'F&B', 'Pro'), true);
  assert.equal(isNonBillableAddOn(ADD_ON_IDS.ADVANCED_LOYALTY, 'F&B', 'Basic'), false);
  assert.equal(isNonBillableAddOn(ADD_ON_IDS.ADVANCED_LOYALTY, 'F&B'), false);
  assert.equal(isNonBillableAddOn(ADD_ON_IDS.ADVANCED_LOYALTY, 'Retail', 'Pro'), false);
});

test('extra users and extra warehouses stay billable', () => {
  for (const planType of ['Retail', 'Laundry', 'F&B']) {
    assert.equal(isNonBillableAddOn(ADD_ON_IDS.EXTRA_USER, planType), false);
    assert.equal(isNonBillableAddOn(ADD_ON_IDS.EXTRA_WAREHOUSE, planType), false);
  }
});
