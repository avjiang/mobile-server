/**
 * Anomaly alerts engine (Peringatan Keamanan, Pro) — docs/modules/ANOMALY.md.
 *
 * Three entry points, each called by its service AFTER its transaction commits:
 *   onSaleReversed  — void / return / refund   → REVERSAL_BURST, QUICK_REVERSAL
 *   onSaleCompleted — a new sale                → LARGE_DISCOUNT, BELOW_COST
 *   onStockAdjusted — a manual stock adjustment → LARGE_STOCK_WRITEOFF
 *
 * Fail-open: the public functions never throw and never block the caller (they
 * run on the next tick); an engine error is logged and the sale stands.
 *
 * Order of checks: Pro (cached 1 h) → the actor is not the account owner
 * (Super Admin, '*') → the rule is enabled → the pure detector → record the
 * event (one row per dedupKey) → push on `tenant_{id}_security` when the
 * finding says so and the event is new or got worse.
 */
import { randomUUID } from 'crypto';
import { Decimal } from 'decimal.js';
import { Prisma, PrismaClient } from '../../prisma/client/generated/client';
import { getTenantPrisma } from '../db';
import { getEffectivePermissions } from '../auth/permission-cache';
import PlanCheckService from '../pushy/plan-check.service';
import PushyService from '../pushy/pushy.service';
import { summarizeManualDiscount, ManualDiscountSale, ManualDiscountDecision } from '../sales/manual-discount';
import {
    ANOMALY_RULES, Bilingual, effectiveSettings, EffectiveRuleSettings, getRule, isRunning, renderBilingual, RULE_ID, StoredRuleConfig,
} from './registry';
import {
    AnomalyActor, detectAfterHours, detectBelowCost, detectCashShortage, detectLargeDiscount, detectLargeStockWriteOff,
    detectQuickReversal, detectReversalBurst, detectSupplierPriceRise, Finding,
} from './rules';
import { expectedCash } from './rules/cash-shortage';
import { ReversalKind } from './rules/reversal-burst';
import { startOfWibDay, wibDay } from './wib';

export const SECURITY_TOPIC = (tenantId: number) => `tenant_${tenantId}_security`;
export const ANOMALY_PUSH_TYPE = 'anomaly_alert';

// ── Dependencies (injectable for tests) ──────────────────────────────────────

export interface AnomalyDeps {
    prisma: (databaseName: string) => PrismaClient;
    isPro: (tenantId: number) => Promise<boolean>;
    permissions: (databaseName: string, userId: number, username: string) => Promise<string[]>;
    push: (topic: string, notification: { title: string; message: string; data: Record<string, unknown> }, tenantId: number) => Promise<unknown>;
    now: () => Date;
    log: (message: string, error?: unknown) => void;
}

export const defaultAnomalyDeps: AnomalyDeps = {
    prisma: (db) => getTenantPrisma(db),
    isPro: (tenantId) => PlanCheckService.isProPlan(tenantId),
    permissions: (db, userId, username) => getEffectivePermissions(db, userId, username),
    push: (topic, notification, tenantId) => PushyService.sendToTopic(topic, notification, tenantId),
    now: () => new Date(),
    log: (message, error) => console.error(`[anomaly] ${message}`, error ?? ''),
};

// ── Tenant rule settings (cached 60 s) ───────────────────────────────────────

const CONFIG_TTL_MS = 60_000;
const configCache = new Map<string, { at: number; rows: Map<string, StoredRuleConfig> }>();

export function invalidateAnomalyConfig(databaseName: string): void {
    configCache.delete(databaseName);
}

export async function loadStoredConfig(prisma: PrismaClient, databaseName: string, nowMs: number): Promise<Map<string, StoredRuleConfig>> {
    const hit = configCache.get(databaseName);
    if (hit && nowMs - hit.at < CONFIG_TTL_MS) return hit.rows;
    const rows = await prisma.anomalyRuleConfig.findMany({ select: { ruleId: true, enabled: true, params: true } });
    const map = new Map<string, StoredRuleConfig>(
        rows.map((r) => [r.ruleId, { enabled: r.enabled, params: (r.params ?? {}) as Record<string, unknown> }]),
    );
    configCache.set(databaseName, { at: nowMs, rows: map });
    return map;
}

// ── Copy ─────────────────────────────────────────────────────────────────────

export interface EventCopy {
    name: Bilingual;
    title: Bilingual;
    body: Bilingual;
}

/** The bilingual name / title / body for an event, from its rule's templates. */
export function renderEventCopy(
    event: { ruleId: string; username: string | null; detail: unknown },
    outletName: string | null,
): EventCopy {
    const rule = getRule(event.ruleId);
    const detail = (event.detail ?? {}) as Record<string, unknown>;
    if (!rule) {
        const fallback = { id: event.ruleId, en: event.ruleId };
        return { name: fallback, title: fallback, body: { id: '', en: '' } };
    }
    const vars = { ...detail, user: event.username ?? '—', outlet: outletName ?? '' };
    return { name: rule.name, title: renderBilingual(rule.push.title, vars), body: renderBilingual(rule.push.body, vars) };
}

// ── Recording + push ─────────────────────────────────────────────────────────

export interface EngineContext {
    deps: AnomalyDeps;
    prisma: PrismaClient;
    databaseName: string;
    tenantId: number;
}

/** The registry rule's tenant settings, or null when the rule is off / not running. */
export async function settingsFor(ctx: EngineContext, ruleId: string): Promise<EffectiveRuleSettings | null> {
    const rule = getRule(ruleId);
    if (!isRunning(rule)) return null;
    const stored = await loadStoredConfig(ctx.prisma, ctx.databaseName, ctx.deps.now().getTime());
    const settings = effectiveSettings(rule, stored.get(ruleId));
    return settings.enabled ? settings : null;
}

const toJson = (v: unknown) => v as Prisma.InputJsonValue;

/**
 * Insert the finding, or update the event with the same dedupKey. Returns the
 * row and whether a push is due: the detector asked for one AND the event is new
 * or its count moved (a retried request never pushes twice).
 */
export async function recordFinding(ctx: EngineContext, finding: Finding) {
    // When it last happened: kept in `detail` because UPDATED_AT also moves when
    // someone marks the event checked.
    const detail = { ...finding.detail, lastAt: ctx.deps.now().toISOString() };
    const data = {
        severity: finding.severity,
        outletId: finding.outletId,
        siteId: finding.siteId,
        userId: finding.userId,
        username: finding.username,
        documentType: finding.documentType,
        documentIds: toJson(finding.documentIds),
        amount: finding.amount ? new Prisma.Decimal(finding.amount.toString()) : null,
        count: finding.count,
        detail: toJson(detail),
    };

    const existing = await ctx.prisma.anomalyEvent.findUnique({ where: { dedupKey: finding.dedupKey } });
    if (!existing) {
        try {
            const created = await ctx.prisma.anomalyEvent.create({
                data: { ...data, ruleId: finding.ruleId, dedupKey: finding.dedupKey, status: 'OPEN' },
            });
            return { event: created, push: finding.notify };
        } catch (error) {
            // A concurrent request created it first — fall through to the update.
            if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
        }
    }
    const current = existing ?? (await ctx.prisma.anomalyEvent.findUniqueOrThrow({ where: { dedupKey: finding.dedupKey } }));
    if (finding.accumulate) {
        // Count actions (two adjustments of one item are two), list documents once.
        const before = Array.isArray(current.documentIds) ? (current.documentIds as number[]) : [];
        const ids = [...new Set([...before, ...finding.documentIds])];
        const count = current.count + finding.count;
        const updated = await ctx.prisma.anomalyEvent.update({
            where: { id: current.id },
            data: { documentIds: toJson(ids), count, detail: toJson({ ...detail, count }) },
        });
        return { event: updated, push: false };
    }
    const moved = current.count !== finding.count;
    const reopen = finding.escalation && moved;
    const updated = await ctx.prisma.anomalyEvent.update({
        where: { id: current.id },
        data: {
            ...data,
            ...(reopen ? { status: 'OPEN', acknowledgedAt: null, acknowledgedBy: null, acknowledgedByUserId: null } : {}),
        },
    });
    return { event: updated, push: finding.notify && moved };
}

async function outletNameOf(prisma: PrismaClient, outletId: number | null): Promise<string | null> {
    if (!outletId) return null;
    const outlet = await prisma.outlet.findUnique({ where: { id: outletId }, select: { outletName: true } });
    return outlet?.outletName ?? null;
}

/** The push the app parses as `anomaly_alert` (Indonesian banner; both languages in data). */
export function buildAnomalyPush(args: {
    tenantId: number;
    event: { id: number; ruleId: string; severity: string; count: number; outletId: number | null; userId: number | null; username: string | null };
    copy: EventCopy;
    outletName: string | null;
    now: Date;
}) {
    const { event, copy } = args;
    return {
        title: copy.title.id,
        message: copy.body.id,
        data: {
            // One inbox row per event state: a re-send of the same count dedupes.
            notificationId: `anomaly_${args.tenantId}_${event.id}_${event.count}`,
            type: ANOMALY_PUSH_TYPE,
            tenantId: args.tenantId,
            anomalyEventId: event.id,
            ruleId: event.ruleId,
            severity: event.severity,
            count: event.count,
            // 0 = tenant-wide: the inbox shows it in every outlet. The outlet it
            // happened in travels separately.
            outletId: 0,
            alertOutletId: event.outletId ?? 0,
            outletName: args.outletName ?? '',
            titleId: copy.title.id,
            messageId: copy.body.id,
            titleEn: copy.title.en,
            messageEn: copy.body.en,
            // The actor: their own devices drop it (FE isSelfTriggeredPush), everyone else gets it.
            triggeringUserId: event.userId ?? 0,
            triggeringUsername: event.username ?? '',
            timestamp: args.now.toISOString(),
        },
    };
}

export async function handleFinding(ctx: EngineContext, finding: Finding | null): Promise<void> {
    if (!finding) return;
    const { event, push } = await recordFinding(ctx, finding);
    if (!push) return;
    const outletName = await outletNameOf(ctx.prisma, event.outletId);
    const copy = renderEventCopy(event, outletName);
    const notification = buildAnomalyPush({ tenantId: ctx.tenantId, event, copy, outletName, now: ctx.deps.now() });
    await ctx.deps.push(SECURITY_TOPIC(ctx.tenantId), notification, ctx.tenantId);
}

/**
 * Pro + not the owner. Returns the engine context, or null to stop. `knownPermissions`
 * saves a lookup when the caller already resolved them (sale create).
 */
async function begin(
    deps: AnomalyDeps,
    databaseName: string,
    tenantId: number,
    actor: AnomalyActor,
    knownPermissions?: readonly string[],
): Promise<EngineContext | null> {
    if (!(await deps.isPro(tenantId))) return null;
    const permissions = knownPermissions ?? (await deps.permissions(databaseName, actor.userId, actor.username));
    if (permissions.includes('*')) return null; // the account owner never alerts about themselves
    return { deps, prisma: deps.prisma(databaseName), databaseName, tenantId };
}

/** A context for the nightly job (no request user): Pro only. */
export async function systemContext(deps: AnomalyDeps, databaseName: string, tenantId: number): Promise<EngineContext | null> {
    if (!(await deps.isPro(tenantId))) return null;
    return { deps, prisma: deps.prisma(databaseName), databaseName, tenantId };
}

/** Run off the request path; never throws. Returns the promise for tests. */
function runSafely(deps: AnomalyDeps, what: string, work: () => Promise<void>): Promise<void> {
    return new Promise<void>((resolve) => {
        setImmediate(() => {
            work()
                .catch((error) => deps.log(`${what} failed`, error))
                .finally(resolve);
        });
    });
}

// ── Entry points ─────────────────────────────────────────────────────────────

const KIND_BY_STATUS: Record<string, ReversalKind> = { Voided: 'void', Returned: 'return', Refunded: 'refund' };

export interface SaleReversedInput {
    databaseName: string;
    tenantId: number;
    actor: AnomalyActor;
    saleId: number;
    kind: ReversalKind;
}

export function onSaleReversed(input: SaleReversedInput, deps: AnomalyDeps = defaultAnomalyDeps): Promise<void> {
    return runSafely(deps, `onSaleReversed(sale ${input.saleId})`, async () => {
        const ctx = await begin(deps, input.databaseName, input.tenantId, input.actor);
        if (!ctx) return;

        const sale = await ctx.prisma.sales.findUnique({
            where: { id: input.saleId },
            select: {
                id: true, friendlyNumber: true, outletId: true, siteId: true, totalAmount: true, createdAt: true,
                performedByUserId: true, reversedAt: true,
                payments: { where: { deleted: false }, select: { method: true, createdAt: true } },
            },
        });
        if (!sale) return;
        const reversedAt = sale.reversedAt ?? deps.now();

        const burst = await settingsFor(ctx, RULE_ID.REVERSAL_BURST);
        if (burst) {
            const today = await ctx.prisma.sales.findMany({
                where: {
                    reversedByUserId: input.actor.userId,
                    reversedAt: { gte: startOfWibDay(reversedAt) },
                    deleted: false,
                },
                select: { id: true, totalAmount: true, status: true },
                orderBy: { reversedAt: 'asc' },
            });
            await handleFinding(ctx, detectReversalBurst({
                actor: input.actor,
                outletId: sale.outletId,
                siteId: sale.siteId,
                wibDay: wibDay(reversedAt),
                reversalsToday: today.map((s) => ({ salesId: s.id, amount: s.totalAmount.toString(), kind: KIND_BY_STATUS[s.status] ?? 'void' })),
                params: { maxPerDay: burst.params.maxPerDay },
            }));
        }

        const quick = await settingsFor(ctx, RULE_ID.QUICK_REVERSAL);
        if (quick) {
            await handleFinding(ctx, detectQuickReversal({
                actor: input.actor,
                kind: input.kind,
                reversedAt,
                sale: {
                    id: sale.id,
                    friendlyNumber: sale.friendlyNumber,
                    outletId: sale.outletId,
                    siteId: sale.siteId,
                    performedByUserId: sale.performedByUserId,
                    totalAmount: sale.totalAmount.toString(),
                    createdAt: sale.createdAt,
                    payments: sale.payments,
                },
                params: { withinMinutes: quick.params.withinMinutes },
            }));
        }
    });
}

export interface SaleCompletedInput {
    databaseName: string;
    tenantId: number;
    actor: AnomalyActor;
    /** Live-resolved permissions completeNewSales already has. */
    permissions: readonly string[];
    saleId: number;
    /** The checkout body (manual discount fields). */
    salesBody: ManualDiscountSale;
    discountDecision: ManualDiscountDecision;
}

export function onSaleCompleted(input: SaleCompletedInput, deps: AnomalyDeps = defaultAnomalyDeps): Promise<void> {
    return runSafely(deps, `onSaleCompleted(sale ${input.saleId})`, async () => {
        const ctx = await begin(deps, input.databaseName, input.tenantId, input.actor, input.permissions);
        if (!ctx) return;

        const discount = await settingsFor(ctx, RULE_ID.LARGE_DISCOUNT);
        const belowCost = await settingsFor(ctx, RULE_ID.BELOW_COST);
        const afterHours = await settingsFor(ctx, RULE_ID.AFTER_HOURS);
        if (!discount && !belowCost && !afterHours) return;

        const sale = await ctx.prisma.sales.findUnique({
            where: { id: input.saleId },
            select: {
                id: true, friendlyNumber: true, outletId: true, siteId: true, discountAmount: true,
                salesItems: {
                    where: { deleted: false },
                    select: { itemId: true, itemVariantId: true, itemName: true, variantName: true, price: true, cost: true, discountAmount: true },
                },
            },
        });
        if (!sale) return;
        const saleRef = { id: sale.id, friendlyNumber: sale.friendlyNumber, outletId: sale.outletId, siteId: sale.siteId };

        if (discount) {
            await handleFinding(ctx, detectLargeDiscount({
                actor: input.actor,
                sale: saleRef,
                summary: summarizeManualDiscount(input.salesBody),
                acceptedLate: input.discountDecision.action === 'accept-late',
                params: { maxPercent: discount.params.maxPercent },
            }));
        }
        if (afterHours) {
            // When it was rung: the phone's checkout instant (an offline sale
            // arrives later), else now. Never businessDate — a backdated sale is noon.
            const rung = input.salesBody.clientCreatedAt ? new Date(input.salesBody.clientCreatedAt) : null;
            await handleFinding(ctx, detectAfterHours({
                actor: input.actor,
                outletId: sale.outletId,
                siteId: sale.siteId,
                at: rung && !isNaN(rung.getTime()) ? rung : deps.now(),
                what: 'sale',
                documentId: sale.id,
                params: { openHour: afterHours.params.openHour, closeHour: afterHours.params.closeHour },
            }));
        }
        if (belowCost) {
            await handleFinding(ctx, detectBelowCost({
                actor: input.actor,
                sale: { ...saleRef, orderDiscount: sale.discountAmount.toString() },
                lines: sale.salesItems.map((l) => ({
                    itemId: l.itemId,
                    itemVariantId: l.itemVariantId,
                    itemName: l.itemName,
                    variantName: l.variantName,
                    price: l.price.toString(),
                    cost: l.cost.toString(),
                    discountAmount: l.discountAmount.toString(),
                })),
            }));
        }
    });
}

export interface StockAdjustedInput {
    databaseName: string;
    tenantId: number;
    actor: AnomalyActor;
    siteId: number | null;
    /** Every adjusted line (outlet + item) — for AFTER_HOURS. */
    adjusted?: { itemId: number; outletId: number }[];
    /** stockAdjustment's `wastageEntries`: FIFO cost of each negative adjustQuantity line. */
    writeOffs: { itemId: number; outletId: number; cost: Decimal.Value; reason: string }[];
}

export function onStockAdjusted(input: StockAdjustedInput, deps: AnomalyDeps = defaultAnomalyDeps): Promise<void> {
    const adjusted = input.adjusted ?? [];
    if (input.writeOffs.length === 0 && adjusted.length === 0) return Promise.resolve();
    return runSafely(deps, 'onStockAdjusted', async () => {
        const ctx = await begin(deps, input.databaseName, input.tenantId, input.actor);
        if (!ctx) return;

        const afterHours = await settingsFor(ctx, RULE_ID.AFTER_HOURS);
        if (afterHours) {
            // Adjustments carry no client time: judged on when they reach the server.
            for (const outletId of [...new Set(adjusted.map((a) => a.outletId))]) {
                await handleFinding(ctx, detectAfterHours({
                    actor: input.actor,
                    outletId,
                    siteId: input.siteId,
                    at: deps.now(),
                    what: 'stock',
                    documentId: adjusted.find((a) => a.outletId === outletId)!.itemId,
                    params: { openHour: afterHours.params.openHour, closeHour: afterHours.params.closeHour },
                }));
            }
        }

        const settings = await settingsFor(ctx, RULE_ID.LARGE_STOCK_WRITEOFF);
        if (!settings || input.writeOffs.length === 0) return;

        const itemIds = [...new Set(input.writeOffs.map((w) => w.itemId))];
        const items = await ctx.prisma.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, itemName: true } });
        const nameOf = new Map(items.map((i) => [i.id, i.itemName]));
        const requestKey = randomUUID();

        const byOutlet = new Map<number, typeof input.writeOffs>();
        for (const w of input.writeOffs) byOutlet.set(w.outletId, [...(byOutlet.get(w.outletId) ?? []), w]);
        for (const [outletId, entries] of byOutlet) {
            await handleFinding(ctx, detectLargeStockWriteOff({
                actor: input.actor,
                outletId,
                siteId: input.siteId,
                requestKey,
                entries: entries.map((e) => ({ itemId: e.itemId, itemName: nameOf.get(e.itemId) ?? `#${e.itemId}`, cost: e.cost, reason: e.reason })),
                params: { maxAmount: settings.params.maxAmount },
            }));
        }
    });
}

/** Server-side expected cash for one session (CASH_SHORTAGE, REPEATED_SHORTAGE). */
export async function sessionExpectedCash(prisma: PrismaClient, sessionId: number): Promise<{ expected: Decimal; outletId: number; siteId: number | null } | null> {
    const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { openingAmount: true, outletId: true, closedBySiteId: true, siteId: true },
    });
    if (!session) return null;
    const [payments, expenses] = await Promise.all([
        prisma.payment.findMany({
            where: { sessionId, deleted: false, status: { notIn: ['Voided', 'Returned', 'Refunded'] } },
            select: { method: true, paidAmount: true },
        }),
        prisma.expense.findMany({
            where: { sessionId, deleted: false, paymentSource: 'cash' },
            select: { amount: true },
        }),
    ]);
    return {
        expected: expectedCash({
            openingAmount: session.openingAmount.toString(),
            cashPayments: payments.filter((p) => (p.method ?? '').trim().toLowerCase() === 'cash').map((p) => p.paidAmount.toString()),
            cashExpenses: expenses.map((e) => e.amount.toString()),
        }),
        outletId: session.outletId,
        siteId: session.closedBySiteId ?? session.siteId ?? null,
    };
}

export interface CashDeclaredInput {
    databaseName: string;
    tenantId: number;
    actor: AnomalyActor;
    declarations: { sessionID: number; paymentType: string; declarationAmount: Decimal.Value }[];
}

/** After `POST /session/createDeclarations`: CASH_SHORTAGE per cash declaration. */
export function onCashDeclared(input: CashDeclaredInput, deps: AnomalyDeps = defaultAnomalyDeps): Promise<void> {
    const cash = input.declarations.filter((d) => (d.paymentType ?? '').trim().toLowerCase() === 'cash');
    if (cash.length === 0) return Promise.resolve();
    return runSafely(deps, 'onCashDeclared', async () => {
        const ctx = await begin(deps, input.databaseName, input.tenantId, input.actor);
        if (!ctx) return;
        const settings = await settingsFor(ctx, RULE_ID.CASH_SHORTAGE);
        if (!settings) return;
        for (const d of cash) {
            const session = await sessionExpectedCash(ctx.prisma, d.sessionID);
            if (!session) continue;
            await handleFinding(ctx, detectCashShortage({
                actor: input.actor,
                outletId: session.outletId,
                siteId: session.siteId,
                sessionId: d.sessionID,
                expected: session.expected,
                declared: d.declarationAmount,
                params: { minShortage: settings.params.minShortage },
            }));
        }
    });
}

export interface DeliveryReceivedInput {
    databaseName: string;
    tenantId: number;
    actor: AnomalyActor;
    deliveryOrderIds: number[];
}

/** After a delivery order is created or updated: SUPPLIER_PRICE_RISE on its received lines. */
export function onDeliveryReceived(input: DeliveryReceivedInput, deps: AnomalyDeps = defaultAnomalyDeps): Promise<void> {
    if (input.deliveryOrderIds.length === 0) return Promise.resolve();
    return runSafely(deps, 'onDeliveryReceived', async () => {
        const ctx = await begin(deps, input.databaseName, input.tenantId, input.actor);
        if (!ctx) return;
        const settings = await settingsFor(ctx, RULE_ID.SUPPLIER_PRICE_RISE);
        if (!settings) return;

        for (const id of input.deliveryOrderIds) {
            const order = await ctx.prisma.deliveryOrder.findUnique({
                where: { id },
                select: {
                    id: true, outletId: true, siteId: true, supplierId: true, trackingNumber: true, supplierReference: true, deleted: true,
                    deliveryOrderItems: {
                        where: { deleted: false, receivedQuantity: { gt: 0 } },
                        select: {
                            itemId: true, itemVariantId: true, variantName: true, receivedQuantity: true, unitPrice: true,
                            item: { select: { itemName: true } },
                        },
                    },
                },
            });
            if (!order || order.deleted || !order.supplierId || order.deliveryOrderItems.length === 0) continue;
            const supplier = await ctx.prisma.supplier.findUnique({ where: { id: order.supplierId }, select: { companyName: true } });

            const agreed = await ctx.prisma.itemSupplier.findMany({
                where: { supplierId: order.supplierId, deleted: false, itemId: { in: order.deliveryOrderItems.map((l) => l.itemId) } },
                select: { itemId: true, cost: true },
            });
            const agreedBy = new Map(agreed.filter((a) => a.cost && new Decimal(a.cost.toString()).gt(0)).map((a) => [a.itemId, a.cost!.toString()]));

            const lines = [];
            for (const l of order.deliveryOrderItems) {
                let baseline: string | null = agreedBy.get(l.itemId) ?? null;
                if (baseline === null) {
                    // That supplier's previous received price for this item/variant.
                    const previous = await ctx.prisma.deliveryOrderItem.findFirst({
                        where: {
                            itemId: l.itemId,
                            itemVariantId: l.itemVariantId ?? null,
                            deleted: false,
                            receivedQuantity: { gt: 0 },
                            unitPrice: { gt: 0 },
                            deliveryOrderId: { lt: order.id },
                            deliveryOrder: { supplierId: order.supplierId, deleted: false },
                        },
                        orderBy: { deliveryOrderId: 'desc' },
                        select: { unitPrice: true },
                    });
                    baseline = previous?.unitPrice ? previous.unitPrice.toString() : null;
                }
                lines.push({
                    name: l.variantName ? `${l.item.itemName} (${l.variantName})` : l.item.itemName,
                    unitPrice: (l.unitPrice ?? 0).toString(),
                    quantity: l.receivedQuantity,
                    baseline,
                });
            }
            await handleFinding(ctx, detectSupplierPriceRise({
                actor: input.actor,
                outletId: order.outletId,
                siteId: order.siteId,
                deliveryOrderId: order.id,
                document: order.supplierReference || order.trackingNumber || `#${order.id}`,
                supplier: supplier?.companyName ?? '',
                lines,
                params: { minPercent: settings.params.minPercent, minRupiah: settings.params.minRupiah },
            }));
        }
    });
}

/** For the contract test and the rules endpoint. */
export const _registry = ANOMALY_RULES;
