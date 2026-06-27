import { SyncRequest } from "src/item/item.request";
import { PrismaClient, ExpenseRecurringTemplate, Prisma } from "../../prisma/client/generated/client"
import { RequestValidateError } from "../api-helpers/error"
import { getTenantPrisma } from '../db';

const toCreateInput = (t: ExpenseRecurringTemplate): Prisma.ExpenseRecurringTemplateCreateManyInput => ({
    outletId: t.outletId ?? 1,
    expenseCategoryId: t.expenseCategoryId,
    amount: t.amount,
    dayOfMonth: t.dayOfMonth ?? null,
    effectiveFrom: t.effectiveFrom ? new Date(t.effectiveFrom) : new Date(),
    effectiveTo: t.effectiveTo ? new Date(t.effectiveTo) : null,
    active: t.active ?? true,
});

let getAllTemplates = async (
    databaseName: string,
    syncRequest: SyncRequest
): Promise<{ templates: any[]; total: number; serverTimestamp: string }> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { lastSyncTimestamp, lastVersion, skip = 0, take = 100 } = syncRequest;
    try {
        const lastSync = (lastSyncTimestamp && lastSyncTimestamp !== 'null') ? new Date(lastSyncTimestamp) : new Date(0);
        let where: any = lastVersion
            ? { version: { gt: lastVersion } }
            : { OR: [{ createdAt: { gte: lastSync } }, { updatedAt: { gte: lastSync } }, { deletedAt: { gte: lastSync } }] };
        const total = await tenantPrisma.expenseRecurringTemplate.count({ where });
        const templates = await tenantPrisma.expenseRecurringTemplate.findMany({ where, skip, take });
        return { templates, total, serverTimestamp: new Date().toISOString() };
    } catch (error) {
        throw error;
    }
};

let createMany = async (databaseName: string, templates: ExpenseRecurringTemplate[]) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        if (!templates || templates.length === 0) throw new RequestValidateError('No templates to create');
        const result = await tenantPrisma.expenseRecurringTemplate.createMany({ data: templates.map(toCreateInput) });
        return result.count;
    } catch (error) {
        throw error;
    }
};

let update = async (databaseName: string, template: ExpenseRecurringTemplate) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        return await tenantPrisma.expenseRecurringTemplate.update({
            where: { id: template.id },
            data: {
                expenseCategoryId: template.expenseCategoryId,
                amount: template.amount,
                dayOfMonth: template.dayOfMonth ?? null,
                effectiveFrom: template.effectiveFrom ? new Date(template.effectiveFrom) : undefined,
                effectiveTo: template.effectiveTo ? new Date(template.effectiveTo) : null,
                active: template.active,
            },
        });
    } catch (error) {
        throw error;
    }
};

let remove = async (databaseName: string, id: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        return await tenantPrisma.expenseRecurringTemplate.update({ where: { id }, data: { deleted: true } });
    } catch (error) {
        throw error;
    }
};

// Post every active, effective template for the given month as a monthly Expense.
// Idempotent: the expense (recurringTemplateId, periodMonth) unique index makes a
// second "post this month" a no-op (P2002 caught + skipped). Supports back-fill.
let postMonth = async (databaseName: string, periodMonth: string): Promise<number> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const parts = periodMonth.split('-');
    if (parts.length !== 2) throw new RequestValidateError("periodMonth must be 'YYYY-MM'");
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]); // 1-12
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);

    const templates = await tenantPrisma.expenseRecurringTemplate.findMany({
        where: {
            active: true,
            deleted: false,
            effectiveFrom: { lte: monthEnd },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: monthStart } }],
        },
    });

    let posted = 0;
    for (const t of templates) {
        const day = t.dayOfMonth ? Math.min(t.dayOfMonth, 28) : 1;
        const businessDate = new Date(year, month - 1, day);
        try {
            await tenantPrisma.expense.create({
                data: {
                    outletId: t.outletId,
                    expenseCategoryId: t.expenseCategoryId,
                    cadence: 'monthly',
                    amount: t.amount,
                    businessDate,
                    periodMonth,
                    paymentSource: 'noncash',
                    recurringTemplateId: t.id,
                    note: 'Recurring',
                },
            });
            posted++;
        } catch (e: any) {
            if (e?.code === 'P2002') continue; // already posted this month — skip
            throw e;
        }
    }
    return posted;
};

export = { getAllTemplates, createMany, update, remove, postMonth }
