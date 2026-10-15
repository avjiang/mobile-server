/**
 * AFTER_HOURS — a sale or stock adjustment outside the opening hours the owner
 * set (WIB; a window may wrap midnight, e.g. 18 → 2). Off until switched on.
 * One event per person per WIB day: the first action pushes, later ones add to it.
 */
import { getRule, RULE_ID } from '../registry';
import { wibDay } from '../wib';
import { AnomalyActor, Finding } from './types';

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Hour (0–23) and "HH.MM" of `at` in WIB. */
export function wibClock(at: Date): { hour: number; text: string } {
    const d = new Date(at.getTime() + WIB_OFFSET_MS);
    const hh = d.getUTCHours();
    const mm = d.getUTCMinutes();
    return { hour: hh, text: `${String(hh).padStart(2, '0')}.${String(mm).padStart(2, '0')}` };
}

/** True when `hour` is inside [open, close); a window with close ≤ open wraps midnight. */
export function isOpenHour(hour: number, open: number, close: number): boolean {
    if (open === close) return true; // "always open" — nothing is after hours
    return open < close ? hour >= open && hour < close : hour >= open || hour < close;
}

export interface AfterHoursContext {
    actor: AnomalyActor;
    outletId: number;
    siteId: number | null;
    at: Date;
    what: 'sale' | 'stock';
    documentId: number;
    params: { openHour: number; closeHour: number };
}

export function detectAfterHours(ctx: AfterHoursContext): Finding | null {
    const rule = getRule(RULE_ID.AFTER_HOURS)!;
    const clock = wibClock(ctx.at);
    if (isOpenHour(clock.hour, ctx.params.openHour, ctx.params.closeHour)) return null;
    return {
        ruleId: rule.id,
        severity: rule.severity,
        dedupKey: `${rule.id}|${ctx.actor.userId}|${wibDay(ctx.at)}`,
        userId: ctx.actor.userId,
        username: ctx.actor.username,
        outletId: ctx.outletId,
        siteId: ctx.siteId,
        documentType: ctx.what === 'sale' ? 'SALES' : 'STOCK_ADJUSTMENT',
        documentIds: [ctx.documentId],
        amount: null,
        count: 1,
        detail: {
            time: clock.text,
            what: ctx.what === 'sale'
                ? { id: 'Penjualan', en: 'A sale' }
                : { id: 'Penyesuaian stok', en: 'A stock adjustment' },
            openHour: ctx.params.openHour,
            closeHour: ctx.params.closeHour,
            count: 1,
        },
        notify: true,
        escalation: false,
        accumulate: true,
    };
}
