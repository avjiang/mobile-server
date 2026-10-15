/**
 * Security alerts — the nightly job (Pro). Every hour 17:05–23:05 WIB; a tenant
 * is handled at ITS closing-report hour (rule DAILY_REPORT, param `hour`,
 * default 21):
 *
 *  1. VOID_RATE_OUTLIER and REPEATED_SHORTAGE over the last 7 days (each only
 *     when switched on / running) — before the report, so tonight's report
 *     counts them;
 *  2. the closing report "Laporan Tutup Toko" (when DAILY_REPORT is on): today's
 *     sales, total, gross profit and alerts, or "Hari ini aman ✅". Skipped on a
 *     day with no sales and no alerts. Push `daily_report` on
 *     `tenant_{id}_security`, one per tenant per WIB day.
 *
 * Pure builders are exported for tests; docs/modules/ANOMALY.md (FE repo).
 */

import { Decimal } from 'decimal.js';
import { PrismaClient } from '../../prisma/client/generated/client';
import {
    AnomalyDeps, defaultAnomalyDeps, EngineContext, handleFinding, loadStoredConfig, SECURITY_TOPIC, sessionExpectedCash,
    settingsFor, systemContext,
} from '../anomaly/anomaly.service';
import { effectiveSettings, formatRupiah, getRule, RULE_ID } from '../anomaly/registry';
import { detectRepeatedShortage } from '../anomaly/rules/repeated-shortage';
import { detectVoidRateOutlier } from '../anomaly/rules/void-rate-outlier';
import { startOfWibDay, wibDay } from '../anomaly/wib';

const { getGlobalPrisma, disconnectTenantClient, databasesOnServer } = require('../db');

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const SALE_STATUSES = ['Completed', 'Partially Paid', 'Delivered'];

export const DAILY_REPORT_PUSH_TYPE = 'daily_report';

/** The WIB hour (0–23) of `at`. */
export function wibHour(at: Date): number {
    return new Date(at.getTime() + WIB_OFFSET_MS).getUTCHours();
}

/** Monday of `at`'s WIB week, yyyy-mm-dd (weekly dedupe key). */
export function wibWeek(at: Date): string {
    const local = new Date(at.getTime() + WIB_OFFSET_MS);
    const daysSinceMonday = (local.getUTCDay() + 6) % 7;
    return wibDay(new Date(at.getTime() - daysSinceMonday * DAY_MS));
}

export interface DailyFigures {
    sales: number;
    total: Decimal.Value;
    profit: Decimal.Value;
    alertsToday: number;
    openToday: number;
}

/** The closing-report push, or null on a day with nothing to report. */
export function buildDailyReport(tenantId: number, figures: DailyFigures, now: Date) {
    if (figures.sales === 0 && figures.alertsToday === 0) return null;
    const rule = getRule(RULE_ID.DAILY_REPORT)!;
    const alerts = figures.alertsToday === 0
        ? { id: 'Hari ini aman ✅', en: 'All quiet today ✅' }
        : figures.openToday === 0
            ? { id: `⚠️ ${figures.alertsToday} peringatan hari ini, semua sudah dicek`, en: `⚠️ ${figures.alertsToday} alerts today, all checked` }
            : { id: `⚠️ ${figures.alertsToday} peringatan hari ini — ${figures.openToday} belum dicek`, en: `⚠️ ${figures.alertsToday} alerts today — ${figures.openToday} not checked` };
    const fill = (template: string, lang: 'id' | 'en') => template
        .replace('{amount}', formatRupiah(figures.total, lang))
        .replace('{count}', String(figures.sales))
        .replace('{profit}', formatRupiah(figures.profit, lang))
        .replace('{alertsLine}', alerts[lang]);
    const title = { id: fill(rule.push.title.id, 'id'), en: fill(rule.push.title.en, 'en') };
    const body = { id: fill(rule.push.body.id, 'id'), en: fill(rule.push.body.en, 'en') };
    return {
        title: title.id,
        message: body.id,
        data: {
            // One per tenant per WIB day: devices and a live-socket replay keep one inbox row.
            notificationId: `daily_${tenantId}_${wibDay(now)}`,
            type: DAILY_REPORT_PUSH_TYPE,
            tenantId,
            day: wibDay(now),
            sales: figures.sales,
            total: new Decimal(figures.total).toNumber(),
            profit: new Decimal(figures.profit).toNumber(),
            alertsToday: figures.alertsToday,
            openToday: figures.openToday,
            titleId: title.id,
            messageId: body.id,
            titleEn: title.en,
            messageEn: body.en,
            // Sent by the system: tenant-wide, nobody's own action.
            outletId: 0,
            triggeringUserId: 0,
            triggeringUsername: '',
            timestamp: now.toISOString(),
        },
    };
}

async function dailyFigures(prisma: PrismaClient, now: Date): Promise<DailyFigures> {
    const since = startOfWibDay(now);
    const [sales, alertsToday, openToday] = await Promise.all([
        prisma.sales.aggregate({
            where: { createdAt: { gte: since }, deleted: false, status: { in: SALE_STATUSES } },
            _count: { _all: true },
            _sum: { totalAmount: true, profitAmount: true },
        }),
        prisma.anomalyEvent.count({ where: { createdAt: { gte: since } } }),
        prisma.anomalyEvent.count({ where: { createdAt: { gte: since }, status: 'OPEN' } }),
    ]);
    return {
        sales: sales._count._all,
        total: (sales._sum.totalAmount ?? 0).toString(),
        profit: (sales._sum.profitAmount ?? 0).toString(),
        alertsToday,
        openToday,
    };
}

async function usernames(prisma: PrismaClient, ids: number[]): Promise<Map<number, string>> {
    if (ids.length === 0) return new Map();
    const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, username: true } });
    return new Map(users.map((u) => [u.id, u.username]));
}

/** The account owner ('*') never alerts about themselves — same rule as the request hooks. */
async function isOwner(ctx: EngineContext, userId: number, username: string): Promise<boolean> {
    try {
        return (await ctx.deps.permissions(ctx.databaseName, userId, username)).includes('*');
    } catch {
        return false;
    }
}

export async function checkVoidRates(ctx: EngineContext, now: Date): Promise<void> {
    const settings = await settingsFor(ctx, RULE_ID.VOID_RATE_OUTLIER);
    if (!settings) return;
    const since = new Date(now.getTime() - 7 * DAY_MS);
    const [rung, reversed] = await Promise.all([
        ctx.prisma.sales.groupBy({
            by: ['outletId', 'performedByUserId'],
            where: { createdAt: { gte: since }, deleted: false, performedByUserId: { not: null } },
            _count: { _all: true },
        }),
        ctx.prisma.sales.groupBy({
            by: ['outletId', 'reversedByUserId'],
            where: { reversedAt: { gte: since }, deleted: false, reversedByUserId: { not: null } },
            _count: { _all: true },
        }),
    ]);
    const outlets = new Set([...rung.map((r) => r.outletId), ...reversed.map((r) => r.outletId)]);
    const names = await usernames(ctx.prisma, [...new Set([
        ...rung.map((r) => r.performedByUserId!), ...reversed.map((r) => r.reversedByUserId!),
    ])]);
    for (const outletId of outlets) {
        const salesBy = new Map(rung.filter((r) => r.outletId === outletId).map((r) => [r.performedByUserId!, r._count._all]));
        const reversalsBy = new Map(reversed.filter((r) => r.outletId === outletId).map((r) => [r.reversedByUserId!, r._count._all]));
        const totalSales = [...salesBy.values()].reduce((a, b) => a + b, 0);
        const totalReversals = [...reversalsBy.values()].reduce((a, b) => a + b, 0);
        for (const [userId, userReversals] of reversalsBy) {
            const username = names.get(userId) ?? `#${userId}`;
            const finding = detectVoidRateOutlier({
                userId,
                username,
                outletId,
                week: wibWeek(now),
                userSales: salesBy.get(userId) ?? 0,
                userReversals,
                othersSales: totalSales - (salesBy.get(userId) ?? 0),
                othersReversals: totalReversals - userReversals,
                params: { multiple: settings.params.multiple, minReversals: settings.params.minReversals },
            });
            if (finding && !(await isOwner(ctx, userId, username))) await handleFinding(ctx, finding);
        }
    }
}

export async function checkRepeatedShortages(ctx: EngineContext, now: Date): Promise<void> {
    const settings = await settingsFor(ctx, RULE_ID.REPEATED_SHORTAGE);
    if (!settings) return;
    const since = new Date(now.getTime() - 7 * DAY_MS);
    const declarations = await ctx.prisma.declaration.findMany({
        where: { createdAt: { gte: since }, deleted: false },
        select: { sessionID: true, paymentType: true, declarationAmount: true, session: { select: { closeByUserID: true, outletId: true } } },
    });
    const byUser = new Map<number, { outletId: number; shortages: { sessionId: number; amount: string }[] }>();
    for (const d of declarations) {
        if ((d.paymentType ?? '').trim().toLowerCase() !== 'cash' || !d.session?.closeByUserID) continue;
        const expected = await sessionExpectedCash(ctx.prisma, d.sessionID);
        if (!expected) continue;
        const shortage = expected.expected.minus(d.declarationAmount.toString());
        const entry = byUser.get(d.session.closeByUserID) ?? { outletId: d.session.outletId, shortages: [] };
        entry.shortages.push({ sessionId: d.sessionID, amount: shortage.toString() });
        byUser.set(d.session.closeByUserID, entry);
    }
    const names = await usernames(ctx.prisma, [...byUser.keys()]);
    for (const [userId, entry] of byUser) {
        const username = names.get(userId) ?? `#${userId}`;
        const finding = detectRepeatedShortage({
            userId,
            username,
            outletId: entry.outletId,
            week: wibWeek(now),
            shortages: entry.shortages,
            params: { minCount: settings.params.minCount },
        });
        if (finding && !(await isOwner(ctx, userId, username))) await handleFinding(ctx, finding);
    }
}

/** One tenant at `now`: does nothing unless `now` is its report hour. Returns whether a report went out. */
export async function runTenantNightly(ctx: EngineContext, now: Date): Promise<boolean> {
    const stored = await loadStoredConfig(ctx.prisma, ctx.databaseName, now.getTime());
    const report = effectiveSettings(getRule(RULE_ID.DAILY_REPORT)!, stored.get(RULE_ID.DAILY_REPORT));
    if (wibHour(now) !== report.params.hour) return false;

    for (const [name, check] of [['void-rate', checkVoidRates], ['repeated-shortage', checkRepeatedShortages]] as const) {
        try {
            await check(ctx, now);
        } catch (error) {
            ctx.deps.log(`nightly ${name} failed for tenant ${ctx.tenantId}`, error);
        }
    }

    if (!report.enabled) return false;
    const notification = buildDailyReport(ctx.tenantId, await dailyFigures(ctx.prisma, now), now);
    if (!notification) return false;
    await ctx.deps.push(SECURITY_TOPIC(ctx.tenantId), notification, ctx.tenantId);
    return true;
}

async function processAnomalyDaily(now: Date = new Date(), deps: AnomalyDeps = defaultAnomalyDeps): Promise<void> {
    const globalPrisma = getGlobalPrisma();
    let reports = 0;
    try {
        // Live Pro plans (Pro trial included) — the only tenants with security alerts.
        const tenantOutlets = await globalPrisma.tenantOutlet.findMany({
            where: {
                isActive: true,
                subscriptions: { some: { status: { in: ['Active', 'active', 'trial'] }, subscriptionPlan: { planName: 'Pro' } } },
            },
            include: { tenant: { select: { databaseName: true, id: true } } },
        });
        const tenantMap = new Map<string, number>();
        for (const outlet of tenantOutlets) {
            if (outlet.tenant?.databaseName) tenantMap.set(outlet.tenant.databaseName, outlet.tenant.id);
        }
        const onServer: Set<string> = await databasesOnServer();

        for (const [dbName, tenantId] of tenantMap) {
            if (!onServer.has(dbName)) continue;
            try {
                const ctx = await systemContext(deps, dbName, tenantId);
                if (ctx && (await runTenantNightly(ctx, now))) reports++;
            } catch (error) {
                console.error(`[Cron] Security nightly failed for tenant ${tenantId} (${dbName}):`, error);
            } finally {
                await disconnectTenantClient(dbName);
            }
        }
        console.log(`[Cron] Security nightly (${wibHour(now)}:05 WIB) complete. Closing reports sent: ${reports}`);
    } catch (error) {
        console.error('[Cron] Fatal error in security nightly:', error);
    }
}

export { processAnomalyDaily };
