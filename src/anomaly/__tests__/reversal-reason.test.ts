import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReversalReason, reversalAuditData } from '../../sales/reversal-reason';

test('no reason (older apps) is accepted as null', () => {
    assert.equal(parseReversalReason({ siteId: 3 }), null);
    assert.equal(parseReversalReason(undefined), null);
});

test('a code is normalised and a note trimmed', () => {
    assert.deepEqual(parseReversalReason({ reasonCode: ' wrong_input ', reasonNote: '  ' }), { code: 'WRONG_INPUT', note: null });
    assert.deepEqual(parseReversalReason({ reasonCode: 'DAMAGED', reasonNote: ' bocor ' }), { code: 'DAMAGED', note: 'bocor' });
});

test('OTHER needs a note; unknown codes, notes alone and long notes are rejected', () => {
    assert.throws(() => parseReversalReason({ reasonCode: 'OTHER' }), /required when reasonCode is OTHER/);
    assert.deepEqual(parseReversalReason({ reasonCode: 'OTHER', reasonNote: 'salah meja' }), { code: 'OTHER', note: 'salah meja' });
    assert.throws(() => parseReversalReason({ reasonCode: 'BECAUSE' }), /Unknown reasonCode/);
    assert.throws(() => parseReversalReason({ reasonNote: 'x' }), /reasonCode is required/);
    assert.throws(() => parseReversalReason({ reasonCode: 'OTHER', reasonNote: 'x'.repeat(256) }), /longer than 255/);
});

test('audit columns', () => {
    const at = new Date('2026-10-15T01:02:03Z');
    assert.deepEqual(reversalAuditData({ userId: 4, username: 'chs', reason: null, at }), {
        reversedByUserId: 4, reversedBy: 'chs', reversedAt: at, reversalReasonCode: null, reversalReasonNote: null,
    });
});
