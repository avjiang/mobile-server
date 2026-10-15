import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startOfWibDay, wibDay } from '../wib';

test('a UTC evening is the next WIB day', () => {
    assert.equal(wibDay(new Date('2026-10-14T17:30:00Z')), '2026-10-15');
    assert.equal(wibDay(new Date('2026-10-14T16:59:59Z')), '2026-10-14');
});

test('WIB midnight is 17:00 UTC the day before', () => {
    assert.equal(startOfWibDay(new Date('2026-10-15T03:00:00Z')).toISOString(), '2026-10-14T17:00:00.000Z');
});
