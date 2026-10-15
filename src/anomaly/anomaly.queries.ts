/**
 * Reads and owner actions behind /anomaly (see anomaly.controller.ts): the rule
 * list with the tenant's settings, saving them, the alert list / detail /
 * summary, and "mark as checked". The engine that creates alerts is
 * anomaly.service.ts.
 */
import { Prisma, PrismaClient } from '../../prisma/client/generated/client';
import { NotFoundError, RequestValidateError } from '../api-helpers/error';
import { invalidateAnomalyConfig, loadStoredConfig, renderEventCopy } from './anomaly.service';
import { activeRules, effectiveSettings, getRule, StoredRuleConfig, validateRuleUpdate } from './registry';

// ── Rules ────────────────────────────────────────────────────────────────────

/** Every running rule for the tenant's business type, with its current settings. */
export async function listRules(prisma: PrismaClient, databaseName: string, planType: string | null | undefined) {
    const stored = await loadStoredConfig(prisma, databaseName, Date.now());
    return activeRules(planType).map((rule) => {
        const settings = effectiveSettings(rule, stored.get(rule.id));
        return {
            id: rule.id,
            status: rule.status,
            severity: rule.severity,
            name: rule.name,
            summary: rule.summary,
            enabled: settings.enabled,
            params: rule.params.map((p) => ({
                key: p.key,
                label: p.label,
                unit: p.unit,
                min: p.min,
                max: p.max,
                default: p.default,
                value: settings.params[p.key],
            })),
        };
    });
}

export interface RuleUpdate {
    ruleId: string;
    enabled?: boolean;
    params?: Record<string, number>;
}

/** Validate every entry first, then upsert them in one transaction. */
export async function saveRules(prisma: PrismaClient, databaseName: string, updates: unknown, userId: number) {
    if (!Array.isArray(updates) || updates.length === 0) throw new RequestValidateError('rules must be a non-empty list');
    for (const u of updates) {
        const error = validateRuleUpdate(u ?? {});
        if (error) throw new RequestValidateError(error);
    }
    const list = updates as RuleUpdate[];
    const existing = await prisma.anomalyRuleConfig.findMany({ where: { ruleId: { in: list.map((u) => u.ruleId) } } });
    const byId = new Map(existing.map((e) => [e.ruleId, e]));

    await prisma.$transaction(
        list.map((u) => {
            const prev = byId.get(u.ruleId);
            const prevParams = (prev?.params ?? {}) as Record<string, unknown>;
            const params = { ...prevParams, ...(u.params ?? {}) } as Prisma.InputJsonValue;
            const enabled = u.enabled ?? prev?.enabled ?? true;
            return prisma.anomalyRuleConfig.upsert({
                where: { ruleId: u.ruleId },
                create: { ruleId: u.ruleId, enabled, params, updatedByUserId: userId },
                update: { enabled, params, updatedByUserId: userId },
            });
        }),
    );
    invalidateAnomalyConfig(databaseName);
}

// ── Events ───────────────────────────────────────────────────────────────────

type EventRow = Prisma.AnomalyEventGetPayload<{}>;

async function outletNames(prisma: PrismaClient, rows: { outletId: number | null }[]): Promise<Map<number, string>> {
    const ids = [...new Set(rows.map((r) => r.outletId).filter((id): id is number => typeof id === 'number'))];
    if (ids.length === 0) return new Map();
    const outlets = await prisma.outlet.findMany({ where: { id: { in: ids } }, select: { id: true, outletName: true } });
    return new Map(outlets.map((o) => [o.id, o.outletName]));
}

function lastOccurredAt(row: EventRow): Date {
    const at = (row.detail as { lastAt?: unknown } | null)?.lastAt;
    const parsed = typeof at === 'string' ? new Date(at) : null;
    return parsed && !isNaN(parsed.getTime()) ? parsed : row.createdAt;
}

export function toEventDto(row: EventRow, outletName: string | null) {
    const copy = renderEventCopy(row, outletName);
    return {
        id: row.id,
        ruleId: row.ruleId,
        severity: row.severity,
        status: row.status,
        outletId: row.outletId,
        outletName,
        siteId: row.siteId,
        userId: row.userId,
        username: row.username,
        documentType: row.documentType,
        documentIds: Array.isArray(row.documentIds) ? row.documentIds : [],
        amount: row.amount,
        count: row.count,
        detail: row.detail,
        // The latest occurrence (a burst grows through the day); not UPDATED_AT,
        // which acknowledging also moves.
        lastOccurredAt: lastOccurredAt(row),
        name: copy.name,
        title: copy.title,
        body: copy.body,
        acknowledgedBy: row.acknowledgedBy,
        acknowledgedAt: row.acknowledgedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

/** Rows the caller may see: their outlets (null list = all) plus events with no outlet. */
function outletScope(allowedOutletIds: number[] | null): Prisma.AnomalyEventWhereInput {
    if (allowedOutletIds === null) return {};
    return { OR: [{ outletId: null }, { outletId: { in: allowedOutletIds } }] };
}

export interface EventFilter {
    status?: string;
    severity?: string;
    outletId?: number;
    cursor?: number;
    limit?: number;
}

const STATUSES = ['OPEN', 'ACKNOWLEDGED'];
const SEVERITIES = ['INFO', 'WARNING', 'CRITICAL'];

export async function listEvents(prisma: PrismaClient, allowedOutletIds: number[] | null, filter: EventFilter) {
    if (filter.status && !STATUSES.includes(filter.status)) throw new RequestValidateError(`Unknown status ${filter.status}`);
    if (filter.severity && !SEVERITIES.includes(filter.severity)) throw new RequestValidateError(`Unknown severity ${filter.severity}`);
    const limit = Math.min(Math.max(filter.limit ?? 30, 1), 100);
    const rows = await prisma.anomalyEvent.findMany({
        where: {
            AND: [
                outletScope(allowedOutletIds),
                filter.status ? { status: filter.status } : {},
                filter.severity ? { severity: filter.severity } : {},
                filter.outletId ? { outletId: filter.outletId } : {},
            ],
        },
        // Newest first by when it started — stable: acknowledging doesn't move a row.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    const page = rows.slice(0, limit);
    const names = await outletNames(prisma, page);
    return {
        events: page.map((r) => toEventDto(r, r.outletId ? names.get(r.outletId) ?? null : null)),
        nextCursor: rows.length > limit ? page[page.length - 1].id : null,
    };
}

async function findVisible(prisma: PrismaClient, allowedOutletIds: number[] | null, id: number) {
    const row = await prisma.anomalyEvent.findFirst({ where: { AND: [{ id }, outletScope(allowedOutletIds)] } });
    if (!row) throw new NotFoundError('Anomaly event');
    return row;
}

/** One alert with what it is about: the sales (incl. who reversed them and why). */
export async function getEvent(prisma: PrismaClient, allowedOutletIds: number[] | null, id: number) {
    const row = await findVisible(prisma, allowedOutletIds, id);
    const names = await outletNames(prisma, [row]);
    const dto = toEventDto(row, row.outletId ? names.get(row.outletId) ?? null : null);

    let sales: unknown[] = [];
    const ids = (Array.isArray(row.documentIds) ? row.documentIds : []).filter((v): v is number => typeof v === 'number');
    if (row.documentType === 'SALES' && ids.length > 0) {
        const found = await prisma.sales.findMany({
            where: { id: { in: ids } },
            select: {
                id: true, friendlyNumber: true, orderRef: true, businessDate: true, createdAt: true, status: true, totalAmount: true,
                customerName: true, performedBy: true, discountAmount: true, totalItemDiscountAmount: true,
                reversedBy: true, reversedAt: true, reversalReasonCode: true, reversalReasonNote: true,
                payments: { where: { deleted: false }, select: { method: true, paidAmount: true, createdAt: true } },
            },
        });
        const order = new Map(ids.map((v, i) => [v, i]));
        sales = found.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    }
    return { ...dto, sales };
}

export async function acknowledgeEvent(
    prisma: PrismaClient, allowedOutletIds: number[] | null, id: number, user: { userId: number; username: string },
) {
    const row = await findVisible(prisma, allowedOutletIds, id);
    const updated = row.status === 'ACKNOWLEDGED'
        ? row
        : await prisma.anomalyEvent.update({
            where: { id },
            data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date(), acknowledgedBy: user.username, acknowledgedByUserId: user.userId },
        });
    const names = await outletNames(prisma, [updated]);
    return toEventDto(updated, updated.outletId ? names.get(updated.outletId) ?? null : null);
}

/** Open alerts for the dashboard row and the hub tile. */
export async function summary(prisma: PrismaClient, allowedOutletIds: number[] | null) {
    const scope = outletScope(allowedOutletIds);
    const [openCount, criticalCount] = await Promise.all([
        prisma.anomalyEvent.count({ where: { AND: [scope, { status: 'OPEN' }] } }),
        prisma.anomalyEvent.count({ where: { AND: [scope, { status: 'OPEN', severity: 'CRITICAL' }] } }),
    ]);
    return { openCount, criticalCount };
}

/** Keep `getRule` reachable for the controller's 404 on an unknown rule id. */
export { getRule };
export type { StoredRuleConfig };
