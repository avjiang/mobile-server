/**
 * Loyalty follow-ups — customers to contact because something of theirs is ending.
 *
 * Backs `GET /loyalty/follow-ups` (the app's follow-up screen) and the daily
 * 09:00 WIB push (src/cron/loyalty-follow-up.cron.ts). Four reasons:
 *
 *   points            — unexpired point batches (remaining > 0) expiring in (now, now+days];
 *                       one reason per customer: the sum, dated by the earliest batch
 *   voucher           — ACTIVE vouchers expiring in (now, now+days]; one reason per voucher
 *   package_ending    — ACTIVE packages whose endDate is in (now, now+days]
 *   package_last_use  — ACTIVE packages with remainingQuota = 1 that haven't ended
 *                       (endDate null or > now) — unless already reported as package_ending
 *
 * Deleted customers / rows are skipped. Customers are sorted by their soonest date
 * (null last), then by name.
 *
 * The DB read (`loadFollowUpRows`) is kept apart from the rules (`buildFollowUps`,
 * `hasNewFollowUpToday`), which are pure so they can be unit-tested without a DB.
 */

const { getTenantPrisma } = require('../db');

const DAY_MS = 86_400_000;

export const FOLLOW_UP_DEFAULT_DAYS = 7;
export const FOLLOW_UP_MAX_DAYS = 30;

// ── Types ────────────────────────────────────────────────────────────────────

export interface FollowUpCustomerRow {
    id: number;
    firstName: string | null;
    lastName: string | null;
    mobile: string | null;
}

export interface FollowUpPointBatchRow {
    customerId: number;
    remainingPoints: number;
    expiresAt: Date | null;
}

export interface FollowUpVoucherRow {
    id: number;
    customerId: number;
    label: string | null;
    status: string;
    expiresAt: Date;
}

export interface FollowUpSubscriptionRow {
    id: number;
    customerId: number;
    packageName: string;
    status: string;
    endDate: Date | null;
    remainingQuota: number | null;
    updatedAt: Date | null;
}

/** Everything the rules need, already restricted to non-deleted customers/rows. */
export interface FollowUpRows {
    customers: FollowUpCustomerRow[];
    pointBatches: FollowUpPointBatchRow[];
    vouchers: FollowUpVoucherRow[];
    subscriptions: FollowUpSubscriptionRow[];
}

export type FollowUpReason =
    | { kind: 'points'; points: number; expiresAt: string }
    | { kind: 'voucher'; voucherId: number; label: string | null; expiresAt: string }
    | { kind: 'package_ending'; subscriptionId: number; packageName: string; endDate: string; remainingQuota: number | null }
    | { kind: 'package_last_use'; subscriptionId: number; packageName: string; remainingQuota: number; endDate: string | null };

export interface FollowUpCustomer {
    customerId: number;
    customerName: string;
    mobile: string | null;
    soonestAt: string | null;
    reasons: FollowUpReason[];
}

export interface FollowUpResult {
    days: number;
    generatedAt: string;
    counts: { customers: number; points: number; vouchers: number; packagesEnding: number; packagesLastUse: number };
    customers: FollowUpCustomer[];
}

// ── Pure rules ───────────────────────────────────────────────────────────────

/** `?days=` → default 7, clamped to 1..30 (non-numbers fall back to the default). */
export function clampFollowUpDays(raw: unknown): number {
    const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
    if (!Number.isFinite(n)) return FOLLOW_UP_DEFAULT_DAYS;
    return Math.min(FOLLOW_UP_MAX_DAYS, Math.max(1, Math.trunc(n)));
}

/** True when [d] is in the half-open window (from, to]. */
const inWindow = (d: Date | null | undefined, from: Date, to: Date): d is Date =>
    !!d && d.getTime() > from.getTime() && d.getTime() <= to.getTime();

const isActive = (status: string | null | undefined) => (status ?? '').toUpperCase() === 'ACTIVE';

const windowEnd = (now: Date, days: number) => new Date(now.getTime() + days * DAY_MS);

export const isPointBatchDue = (b: FollowUpPointBatchRow, now: Date, days: number) =>
    b.remainingPoints > 0 && inWindow(b.expiresAt, now, windowEnd(now, days));

export const isVoucherDue = (v: FollowUpVoucherRow, now: Date, days: number) =>
    isActive(v.status) && inWindow(v.expiresAt, now, windowEnd(now, days));

export const isPackageEnding = (s: FollowUpSubscriptionRow, now: Date, days: number) =>
    isActive(s.status) && inWindow(s.endDate, now, windowEnd(now, days));

/** One use left and not ended yet (whether or not it also ends inside the window). */
export const isPackageOnLastUse = (s: FollowUpSubscriptionRow, now: Date) =>
    isActive(s.status) && s.remainingQuota === 1 && (s.endDate == null || s.endDate.getTime() > now.getTime());

/** Points as a plain number without float dust from summing decimals. */
const roundPoints = (n: number) => Math.round(n * 10_000) / 10_000;

const reasonDate = (r: FollowUpReason): string | null => {
    switch (r.kind) {
        case 'points':
        case 'voucher':
            return r.expiresAt;
        case 'package_ending':
        case 'package_last_use':
            return r.endDate;
    }
};

/** Ascending ISO date, nulls last. */
const compareDates = (a: string | null, b: string | null) => {
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a < b ? -1 : 1;
};

export function buildFollowUps(rows: FollowUpRows, now: Date, days: number): FollowUpResult {
    const byCustomer = new Map<number, FollowUpReason[]>();
    const add = (customerId: number, reason: FollowUpReason) => {
        const list = byCustomer.get(customerId) ?? [];
        list.push(reason);
        byCustomer.set(customerId, list);
    };

    // points — one reason per customer: the sum, dated by the earliest batch
    const points = new Map<number, { total: number; earliest: Date }>();
    for (const b of rows.pointBatches) {
        if (!isPointBatchDue(b, now, days)) continue;
        const cur = points.get(b.customerId);
        if (!cur) {
            points.set(b.customerId, { total: b.remainingPoints, earliest: b.expiresAt! });
        } else {
            cur.total += b.remainingPoints;
            if (b.expiresAt!.getTime() < cur.earliest.getTime()) cur.earliest = b.expiresAt!;
        }
    }
    for (const [customerId, p] of points) {
        add(customerId, { kind: 'points', points: roundPoints(p.total), expiresAt: p.earliest.toISOString() });
    }

    // vouchers — one reason per voucher
    for (const v of rows.vouchers) {
        if (!isVoucherDue(v, now, days)) continue;
        const label = v.label && v.label.trim() !== '' ? v.label : null;
        add(v.customerId, { kind: 'voucher', voucherId: v.id, label, expiresAt: v.expiresAt.toISOString() });
    }

    // packages — ending wins over last-use, so a package is reported once
    for (const s of rows.subscriptions) {
        if (isPackageEnding(s, now, days)) {
            add(s.customerId, {
                kind: 'package_ending',
                subscriptionId: s.id,
                packageName: s.packageName,
                endDate: s.endDate!.toISOString(),
                remainingQuota: s.remainingQuota,
            });
        } else if (isPackageOnLastUse(s, now)) {
            add(s.customerId, {
                kind: 'package_last_use',
                subscriptionId: s.id,
                packageName: s.packageName,
                remainingQuota: 1,
                endDate: s.endDate ? s.endDate.toISOString() : null,
            });
        }
    }

    const customerById = new Map(rows.customers.map(c => [c.id, c]));
    const customers: FollowUpCustomer[] = [];
    for (const [customerId, reasons] of byCustomer) {
        const c = customerById.get(customerId);
        if (!c) continue; // deleted / unknown customer
        reasons.sort((a, b) => compareDates(reasonDate(a), reasonDate(b)));
        const soonestAt = reasons.map(reasonDate).reduce<string | null>((min, d) => (compareDates(d, min) < 0 ? d : min), null);
        const mobile = c.mobile && c.mobile.trim() !== '' ? c.mobile : null;
        customers.push({
            customerId,
            customerName: `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim(),
            mobile,
            soonestAt,
            reasons,
        });
    }

    customers.sort((a, b) =>
        compareDates(a.soonestAt, b.soonestAt)
        || a.customerName.localeCompare(b.customerName)
        || a.customerId - b.customerId);

    const counts = { customers: customers.length, points: 0, vouchers: 0, packagesEnding: 0, packagesLastUse: 0 };
    for (const c of customers) {
        for (const r of c.reasons) {
            if (r.kind === 'points') counts.points++;
            else if (r.kind === 'voucher') counts.vouchers++;
            else if (r.kind === 'package_ending') counts.packagesEnding++;
            else counts.packagesLastUse++;
        }
    }

    return { days, generatedAt: now.toISOString(), counts, customers };
}

/**
 * Noise control for the daily push: true when something entered the 7-day list
 * since yesterday's run — a point batch / voucher / package ending in
 * (now+6d, now+7d], or a package that dropped to its last use in the past 24h
 * (`updatedAt > now-24h`). Only rows of known (non-deleted) customers count.
 */
export function hasNewFollowUpToday(rows: FollowUpRows, now: Date): boolean {
    const known = new Set(rows.customers.map(c => c.id));
    const from = new Date(now.getTime() + 6 * DAY_MS);
    const to = new Date(now.getTime() + 7 * DAY_MS);
    const since = now.getTime() - DAY_MS;

    return rows.pointBatches.some(b => known.has(b.customerId) && b.remainingPoints > 0 && inWindow(b.expiresAt, from, to))
        || rows.vouchers.some(v => known.has(v.customerId) && isActive(v.status) && inWindow(v.expiresAt, from, to))
        || rows.subscriptions.some(s => known.has(s.customerId) && (
            (isActive(s.status) && inWindow(s.endDate, from, to))
            || (isPackageOnLastUse(s, now) && !!s.updatedAt && s.updatedAt.getTime() > since)));
}

// ── DB read ──────────────────────────────────────────────────────────────────

const toNumber = (v: any): number => (typeof v === 'number' ? v : Number(v ?? 0));

/**
 * Reads the candidate rows for a (now, now+days] window. The queries already
 * apply the rules; `buildFollowUps` re-checks them, so the two can't drift apart.
 */
export async function loadFollowUpRows(databaseName: string, now: Date, days: number): Promise<FollowUpRows> {
    const prisma = getTenantPrisma(databaseName);
    const until = windowEnd(now, days);
    const liveCustomer = { deleted: false };

    const [batches, vouchers, subscriptions] = await Promise.all([
        prisma.loyaltyPointBatch.findMany({
            where: {
                deleted: false,
                remainingPoints: { gt: 0 },
                expiresAt: { gt: now, lte: until },
                loyaltyAccount: { deleted: false, customer: liveCustomer },
            },
            select: { remainingPoints: true, expiresAt: true, loyaltyAccount: { select: { customerId: true } } },
        }),
        prisma.voucher.findMany({
            where: {
                deleted: false,
                status: 'ACTIVE',
                expiresAt: { gt: now, lte: until },
                customer: liveCustomer,
            },
            select: { id: true, customerId: true, label: true, status: true, expiresAt: true },
        }),
        prisma.customerSubscription.findMany({
            where: {
                deleted: false,
                status: 'ACTIVE',
                customer: liveCustomer,
                OR: [
                    { endDate: { gt: now, lte: until } },
                    { remainingQuota: 1, OR: [{ endDate: null }, { endDate: { gt: now } }] },
                ],
            },
            select: {
                id: true, customerId: true, status: true, endDate: true, remainingQuota: true, updatedAt: true,
                packageSnapshot: true,
                subscriptionPackage: { select: { name: true } },
            },
        }),
    ]);

    const customerIds = new Set<number>([
        ...batches.map((b: any) => b.loyaltyAccount.customerId),
        ...vouchers.map((v: any) => v.customerId),
        ...subscriptions.map((s: any) => s.customerId),
    ]);
    const customers = customerIds.size === 0 ? [] : await prisma.customer.findMany({
        where: { id: { in: Array.from(customerIds) }, deleted: false },
        select: { id: true, firstName: true, lastName: true, mobile: true },
    });

    return {
        customers,
        pointBatches: batches.map((b: any) => ({
            customerId: b.loyaltyAccount.customerId,
            remainingPoints: toNumber(b.remainingPoints),
            expiresAt: b.expiresAt,
        })),
        vouchers,
        subscriptions: subscriptions.map((s: any) => ({
            id: s.id,
            customerId: s.customerId,
            // The live package name; the purchase-time snapshot if the package row has none.
            packageName: s.subscriptionPackage?.name || (s.packageSnapshot as any)?.name || '',
            status: s.status,
            endDate: s.endDate,
            remainingQuota: s.remainingQuota,
            updatedAt: s.updatedAt,
        })),
    };
}

export async function getFollowUps(databaseName: string, days: number, now: Date = new Date()): Promise<FollowUpResult> {
    const rows = await loadFollowUpRows(databaseName, now, days);
    return buildFollowUps(rows, now, days);
}

export default { getFollowUps };
