import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDailyReport, wibHour, wibWeek } from '../anomaly-daily.cron';

const now = new Date('2026-10-15T14:05:00Z'); // Thursday 21:05 WIB

test('WIB hour and the Monday of the WIB week', () => {
    assert.equal(wibHour(now), 21);
    assert.equal(wibWeek(now), '2026-10-12');
    assert.equal(wibWeek(new Date('2026-10-18T18:00:00Z')), '2026-10-19', 'Sunday 18:00 UTC is Monday 01:00 WIB');
});

test('a quiet day says so', () => {
    const n = buildDailyReport(11, { sales: 58, total: 3_910_000, profit: 910_000, alertsToday: 0, openToday: 0 }, now)!;
    assert.equal(n.title, 'Tutup toko: Rp 3.910.000 · 58 transaksi');
    assert.equal(n.message, 'Laba kotor Rp 910.000 · Hari ini aman ✅');
    assert.equal(n.data.type, 'daily_report');
    assert.equal(n.data.notificationId, 'daily_11_2026-10-15');
    assert.equal(n.data.outletId, 0);
    assert.equal(n.data.triggeringUserId, 0);
    assert.equal(n.data.titleEn, 'Closing: Rp 3,910,000 · 58 sales');
});

test('alerts today, some still open', () => {
    const n = buildDailyReport(11, { sales: 63, total: 4_250_000, profit: 1_180_000, alertsToday: 3, openToday: 1 }, now)!;
    assert.equal(n.message, 'Laba kotor Rp 1.180.000 · ⚠️ 3 peringatan hari ini — 1 belum dicek');
});

test('no sales and no alerts: nothing is sent', () => {
    assert.equal(buildDailyReport(11, { sales: 0, total: 0, profit: 0, alertsToday: 0, openToday: 0 }, now), null);
});
