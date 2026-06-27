import { SyncRequest } from "src/item/item.request";
import { PrismaClient, ExpenseCategory } from "../../prisma/client/generated/client"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { getTenantPrisma } from '../db';

// Per-vertical default expense categories. Lazy-seeded on first read so a tenant
// always has sensible buckets without a seed script (mirrors the Category master
// pattern). Inventoried supplies (detergent, plastic bag, ingredients) are
// DELIBERATELY absent — they are Class-A COGS, never expenses
// (docs/future/EXPENSE_AND_CASH_RECONCILIATION.md §3 rule #1).
const defaultCategoriesFor = (planType?: string | null): { name: string; kind: string; vertical: string }[] => {
    const pt = (planType || '').toLowerCase();

    const common = [
        { name: 'Rent', kind: 'opex' },
        { name: 'Electricity', kind: 'opex' },
        { name: 'Water', kind: 'opex' },
        { name: 'Salary', kind: 'opex' },
        { name: 'Daily wage', kind: 'opex' },
        { name: 'Transport', kind: 'opex' },
        { name: 'Supplies', kind: 'opex' },
        { name: 'Other', kind: 'opex' },
    ];

    let vertical: string;
    let extra: { name: string; kind: string }[];

    if (pt.includes('laundry')) {
        vertical = 'laundry';
        extra = [
            { name: 'Gas', kind: 'opex' },
            { name: 'Ironing labor', kind: 'opex' },
            { name: 'THR', kind: 'opex' },
        ];
    } else if (pt.includes('f&b') || pt.includes('fnb') || pt.includes('food')) {
        vertical = 'fnb';
        extra = [
            { name: 'Gas', kind: 'opex' },
            { name: 'Platform fee', kind: 'opex' },
            { name: 'Wastage', kind: 'cogs-wastage' },
        ];
    } else {
        vertical = 'retail';
        extra = [
            { name: 'Packaging', kind: 'opex' },
            { name: 'Payment fee', kind: 'opex' },
        ];
    }

    return [...common, ...extra].map(c => ({ ...c, vertical }));
};

// Create default categories only if the tenant has none yet (idempotent on name).
const ensureSeeded = async (tenantPrisma: PrismaClient, planType?: string | null) => {
    const count = await tenantPrisma.expenseCategory.count();
    if (count > 0) return;
    const defaults = defaultCategoriesFor(planType);
    await tenantPrisma.expenseCategory.createMany({
        data: defaults,
        skipDuplicates: true,
    });
};

let getAll = async (databaseName: string, planType?: string | null) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        await ensureSeeded(tenantPrisma, planType);
        return await tenantPrisma.expenseCategory.findMany({
            where: { deleted: false },
            orderBy: { name: 'asc' },
        });
    }
    catch (error) {
        throw error
    }
}

let getAllExpenseCategories = async (
    databaseName: string,
    syncRequest: SyncRequest,
    planType?: string | null,
): Promise<{ categories: any[]; total: number; serverTimestamp: string }> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { lastSyncTimestamp, lastVersion, skip = 0, take = 100 } = syncRequest;

    try {
        await ensureSeeded(tenantPrisma, planType);

        const lastSync = (lastSyncTimestamp && lastSyncTimestamp !== 'null') ?
            new Date(lastSyncTimestamp) : new Date(0);

        let where: any;
        if (lastVersion) {
            where = { version: { gt: lastVersion } };
        } else {
            where = {
                OR: [
                    { createdAt: { gte: lastSync } },
                    { updatedAt: { gte: lastSync } },
                    { deletedAt: { gte: lastSync } }
                ],
            };
        }

        const total = await tenantPrisma.expenseCategory.count({ where });
        const categories = await tenantPrisma.expenseCategory.findMany({
            where,
            skip,
            take,
        });

        return {
            categories,
            total,
            serverTimestamp: new Date().toISOString(),
        };
    } catch (error) {
        throw error;
    }
};

let getById = async (databaseName: string, id: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const category = await tenantPrisma.expenseCategory.findUnique({
            where: { id }
        })
        if (!category) {
            throw new NotFoundError("Expense category")
        }
        return category
    }
    catch (error) {
        throw error
    }
}

let createMany = async (databaseName: string, categories: ExpenseCategory[]) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const categoryNames = categories.map(cat => cat.name);
        const existingCategories = await tenantPrisma.expenseCategory.findMany({
            where: {
                name: { in: categoryNames },
                deleted: false
            },
            select: { name: true }
        });

        if (existingCategories.length > 0) {
            const existingNames = existingCategories.map(cat => cat.name);
            throw new RequestValidateError(`Expense category names already exist: ${existingNames.join(', ')}`);
        }

        await tenantPrisma.expenseCategory.createMany({
            data: categories,
        });
        return await tenantPrisma.expenseCategory.findMany({
            where: { name: { in: categoryNames } },
        });
    }
    catch (error) {
        throw error
    }
}

let update = async (databaseName: string, category: ExpenseCategory) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const existingCategory = await tenantPrisma.expenseCategory.findFirst({
            where: {
                name: category.name,
                id: { not: category.id },
                deleted: false
            }
        });

        if (existingCategory) {
            throw new RequestValidateError(`Expense category name '${category.name}' already exists`);
        }

        return await tenantPrisma.expenseCategory.update({
            where: { id: category.id },
            data: category
        })
    }
    catch (error) {
        throw error
    }
}

let remove = async (databaseName: string, id: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        return await tenantPrisma.expenseCategory.update({
            where: { id },
            data: { deleted: true }
        })
    }
    catch (error) {
        throw error
    }
}

export = { getAll, getAllExpenseCategories, getById, createMany, update, remove }
