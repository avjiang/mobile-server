import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    activeRules, ANOMALY_RULES, clampParam, effectiveSettings, formatRupiah, getRule, isRunning, itemsPhrase, renderTemplate,
    validateRuleUpdate,
} from '../registry';
import { DETECTORS } from '../rules';

// ── Contract: the JSON registry and the detectors agree ──

test('every running rule has a detector, every detector a registry entry', () => {
    const running = ANOMALY_RULES.filter((r) => r.status !== 'planned' && r.kind !== 'report').map((r) => r.id).sort();
    assert.deepEqual(Object.keys(DETECTORS).sort(), running);
});

test('rule ids are unique and every default sits inside its range', () => {
    const ids = ANOMALY_RULES.map((r) => r.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const r of ANOMALY_RULES) {
        for (const p of r.params) assert.ok(p.min <= p.default && p.default <= p.max, `${r.id}.${p.key}`);
        assert.ok(r.name.id && r.name.en && r.summary.id && r.summary.en, r.id);
    }
});

test('templates only use tokens the engine fills', () => {
    const known = new Set([
        'user', 'outlet', 'count', 'amount', 'sale', 'minutes', 'percent', 'items',
        'expected', 'declared', 'time', 'what', 'supplier', 'document', 'sales', 'rate', 'othersRate', 'profit', 'alertsLine',
    ]);
    for (const r of ANOMALY_RULES) {
        for (const p of r.params) known.add(p.key);
        for (const t of [r.push.title.id, r.push.title.en, r.push.body.id, r.push.body.en]) {
            for (const m of t.matchAll(/\{(\w+)\}/g)) assert.ok(known.has(m[1]), `${r.id}: {${m[1]}}`);
        }
    }
});

test('stricter defaults agreed with the owner (2026-10-02)', () => {
    assert.equal(getRule('REVERSAL_BURST')!.params[0].default, 1);
    assert.equal(getRule('QUICK_REVERSAL')!.params[0].default, 15);
    assert.equal(getRule('LARGE_DISCOUNT')!.params[0].default, 20);
    assert.equal(getRule('LARGE_STOCK_WRITEOFF')!.params[0].default, 250_000);
});

test('the app lists live entries only, by business type', () => {
    assert.ok(activeRules('Retail').every((r) => r.status === 'live'));
    // 5 Phase 1 + after-hours + void-rate outlier + the closing report; retail also supplier price.
    assert.equal(activeRules('Laundry').length, 8);
    assert.equal(activeRules('Retail').length, 9);
    assert.ok(!activeRules(null).some((r) => r.id === 'CASH_SHORTAGE'), 'beta rules are not shown');
});

test('beta rules run, planned ones would not; after-hours starts switched off', () => {
    assert.equal(isRunning(getRule('CASH_SHORTAGE')), true);
    assert.equal(isRunning(getRule('REPEATED_SHORTAGE')), true);
    assert.equal(effectiveSettings(getRule('AFTER_HOURS')!).enabled, false);
    assert.equal(effectiveSettings(getRule('AFTER_HOURS')!, { enabled: true, params: {} }).enabled, true);
});

// ── Settings ──

test('effective settings: defaults without a row, the row overlaid, values clamped', () => {
    const rule = getRule('LARGE_DISCOUNT')!;
    assert.deepEqual(effectiveSettings(rule), { enabled: true, params: { maxPercent: 20 } });
    assert.deepEqual(effectiveSettings(rule, { enabled: false, params: { maxPercent: 35 } }), { enabled: false, params: { maxPercent: 35 } });
    assert.equal(effectiveSettings(rule, { enabled: true, params: { maxPercent: 900 } }).params.maxPercent, 100);
    assert.equal(clampParam(rule.params[0], 'nonsense'), 20);
});

test('validateRuleUpdate rejects unknown rules, unknown params and out-of-range values', () => {
    assert.equal(validateRuleUpdate({ ruleId: 'LARGE_DISCOUNT', enabled: false, params: { maxPercent: 30 } }), null);
    assert.match(validateRuleUpdate({ ruleId: 'NOPE' })!, /Unknown rule/);
    assert.match(validateRuleUpdate({ ruleId: 'CASH_SHORTAGE' })!, /Unknown rule/); // beta: not editable yet
    assert.match(validateRuleUpdate({ ruleId: 'LARGE_DISCOUNT', params: { x: 1 } })!, /Unknown parameter/);
    assert.match(validateRuleUpdate({ ruleId: 'LARGE_DISCOUNT', params: { maxPercent: 0 } })!, /between 1 and 100/);
    assert.match(validateRuleUpdate({ ruleId: 'LARGE_DISCOUNT', enabled: 'yes' })!, /true or false/);
});

// ── Copy ──

test('rupiah per language', () => {
    assert.equal(formatRupiah(1250000, 'id'), 'Rp 1.250.000');
    assert.equal(formatRupiah(1250000, 'en'), 'Rp 1,250,000');
    assert.equal(formatRupiah(999.5, 'id'), 'Rp 1.000');
});

test('templates fill money, bilingual values and drop a missing trailing outlet', () => {
    const t = 'Total {amount} · batas {maxPerDay} · {outlet}';
    assert.equal(renderTemplate(t, { amount: 30000, maxPerDay: 1, outlet: 'Cabang 1' }, 'id'), 'Total Rp 30.000 · batas 1 · Cabang 1');
    assert.equal(renderTemplate(t, { amount: 30000, maxPerDay: 1, outlet: '' }, 'id'), 'Total Rp 30.000 · batas 1');
    assert.equal(renderTemplate('{items}', { items: { id: 'barang', en: 'items' } }, 'en'), 'items');
});

test('itemsPhrase', () => {
    assert.deepEqual(itemsPhrase([]), { id: 'barang', en: 'items' });
    assert.deepEqual(itemsPhrase(['A', 'A']), { id: 'A', en: 'A' });
    assert.deepEqual(itemsPhrase(['A', 'B', 'C']), { id: 'A dan 2 lainnya', en: 'A and 2 more' });
});
