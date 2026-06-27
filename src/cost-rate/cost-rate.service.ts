import { SyncRequest } from "src/item/item.request";
import { PrismaClient, CostRate, Prisma } from "../../prisma/client/generated/client"
import { Decimal } from 'decimal.js'
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { getTenantPrisma } from '../db';

const toCreateInput = (r: CostRate): Prisma.CostRateCreateManyInput => ({
    outletId: r.outletId ?? 1,
    expenseCategoryId: r.expenseCategoryId,
    costType: r.costType,
    basis: r.basis,
    rate: r.rate,
    effectiveFrom: r.effectiveFrom ? new Date(r.effectiveFrom) : new Date(),
    active: r.active ?? true,
});

let getAllRates = async (
    databaseName: string,
    syncRequest: SyncRequest
): Promise<{ rates: any[]; total: number; serverTimestamp: string }> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { lastSyncTimestamp, lastVersion, skip = 0, take = 100 } = syncRequest;
    try {
        const lastSync = (lastSyncTimestamp && lastSyncTimestamp !== 'null') ? new Date(lastSyncTimestamp) : new Date(0);
        let where: any = lastVersion
            ? { version: { gt: lastVersion } }
            : { OR: [{ createdAt: { gte: lastSync } }, { updatedAt: { gte: lastSync } }, { deletedAt: { gte: lastSync } }] };
        const total = await tenantPrisma.costRate.count({ where });
        const rates = await tenantPrisma.costRate.findMany({ where, skip, take });
        return { rates, total, serverTimestamp: new Date().toISOString() };
    } catch (error) {
        throw error;
    }
};

let createMany = async (databaseName: string, rates: CostRate[]) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        if (!rates || rates.length === 0) throw new RequestValidateError('No cost rates to create');
        const result = await tenantPrisma.costRate.createMany({ data: rates.map(toCreateInput) });
        return result.count;
    } catch (error) {
        throw error;
    }
};

let update = async (databaseName: string, rate: CostRate) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        return await tenantPrisma.costRate.update({
            where: { id: rate.id },
            data: {
                expenseCategoryId: rate.expenseCategoryId,
                costType: rate.costType,
                basis: rate.basis,
                rate: rate.rate,
                effectiveFrom: rate.effectiveFrom ? new Date(rate.effectiveFrom) : undefined,
                active: rate.active,
            },
        });
    } catch (error) {
        throw error;
    }
};

let remove = async (databaseName: string, id: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        return await tenantPrisma.costRate.update({ where: { id }, data: { deleted: true } });
    } catch (error) {
        throw error;
    }
};

// Generate Class-B (per-shift) expenses for a session from the active cost rates.
// cost = rate × driverQuantity(session), driver resolved per basis. Idempotent:
// prior auto-generated rows for the session (note sentinel) are soft-deleted
// before regenerating, so re-running replaces rather than duplicates.
const AUTO_NOTE_PREFIX = '[auto:cr:';

let generateForSession = async (databaseName: string, sessionId: number): Promise<number> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);

    const session = await tenantPrisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundError('Session');

    const rates = await tenantPrisma.costRate.findMany({ where: { active: true, deleted: false } });
    if (rates.length === 0) return 0;

    // Completed sales for this session (drives perTransaction / percentOfSales).
    const completedSales = await tenantPrisma.sales.findMany({
        where: { completedSessionId: sessionId, status: 'Completed', deleted: false },
        select: { id: true, totalAmount: true },
    });
    const txnCount = completedSales.length;
    const netRevenue = completedSales.reduce((sum, s) => sum.plus(s.totalAmount ?? new Decimal(0)), new Decimal(0));
    const salesIds = completedSales.map(s => s.id);

    // Ironing kg (drives perKg) — sum loadWeightKg of ironing-flagged item lines.
    let ironingKg = new Decimal(0);
    if (salesIds.length > 0) {
        const ironingItems = await tenantPrisma.item.findMany({ where: { includesIroning: true }, select: { id: true } });
        const ironingItemIds = ironingItems.map(i => i.id);
        if (ironingItemIds.length > 0) {
            const kgAgg = await tenantPrisma.salesItem.aggregate({
                where: { salesId: { in: salesIds }, itemId: { in: ironingItemIds }, deleted: false },
                _sum: { loadWeightKg: true },
            });
            ironingKg = kgAgg._sum.loadWeightKg ?? new Decimal(0);
        }
    }

    // Replace any previous auto-generated cost-rate expenses for this session.
    await tenantPrisma.expense.updateMany({
        where: { sessionId, note: { startsWith: AUTO_NOTE_PREFIX }, deleted: false },
        data: { deleted: true },
    });

    let posted = 0;
    for (const r of rates) {
        const rate = r.rate ?? new Decimal(0);
        let amount = new Decimal(0);
        switch (r.basis) {
            case 'perTransaction':
                amount = rate.times(txnCount);
                break;
            case 'percentOfSales':
                amount = netRevenue.times(rate).dividedBy(100);
                break;
            case 'perKg':
                amount = rate.times(ironingKg);
                break;
            case 'perShift':
            case 'perDay':
                amount = rate;
                break;
            default:
                amount = new Decimal(0);
        }
        if (amount.lessThanOrEqualTo(0)) continue;
        await tenantPrisma.expense.create({
            data: {
                outletId: r.outletId,
                sessionId,
                expenseCategoryId: r.expenseCategoryId,
                cadence: 'perShift',
                amount,
                businessDate: session.businessDate,
                paymentSource: 'noncash',
                note: `${AUTO_NOTE_PREFIX}${r.id}] ${r.costType}`,
            },
        });
        posted++;
    }
    return posted;
};

export = { getAllRates, createMany, update, remove, generateForSession }
