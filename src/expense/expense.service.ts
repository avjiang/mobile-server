import { SyncRequest } from "src/item/item.request";
import { PrismaClient, Expense, Prisma } from "../../prisma/client/generated/client"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { getTenantPrisma } from '../db';

// Map a client-supplied expense payload to a Prisma create input. We map fields
// explicitly (rather than spreading) so derived/unknown keys can't reach Prisma
// and `businessDate` is coerced to a Date.
const toCreateInput = (e: Expense): Prisma.ExpenseCreateManyInput => ({
    outletId: e.outletId ?? 1,
    sessionId: e.sessionId ?? null,
    expenseCategoryId: e.expenseCategoryId,
    cadence: e.cadence ?? 'oneoff',
    amount: e.amount,
    businessDate: e.businessDate ? new Date(e.businessDate) : new Date(),
    periodMonth: e.periodMonth ?? null,
    note: e.note ?? '',
    paymentSource: e.paymentSource ?? 'cash',
    recurringTemplateId: e.recurringTemplateId ?? null,
    sourceMovementId: e.sourceMovementId ?? null,
    receiptUrl: e.receiptUrl ?? null,
    performedBy: e.performedBy ?? null,
});

let getAllExpenses = async (
    databaseName: string,
    syncRequest: SyncRequest
): Promise<{ expenses: any[]; total: number; serverTimestamp: string }> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { lastSyncTimestamp, lastVersion, skip = 0, take = 100 } = syncRequest;

    try {
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

        const total = await tenantPrisma.expense.count({ where });
        const expenses = await tenantPrisma.expense.findMany({
            where,
            skip,
            take,
            orderBy: { businessDate: 'desc' },
        });

        return {
            expenses,
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
        const expense = await tenantPrisma.expense.findUnique({
            where: { id }
        })
        if (!expense) {
            throw new NotFoundError("Expense")
        }
        return expense
    }
    catch (error) {
        throw error
    }
}

let createMany = async (databaseName: string, expenses: Expense[]) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        if (!expenses || expenses.length === 0) {
            throw new RequestValidateError('No expenses to create');
        }
        const data = expenses.map(toCreateInput);
        const result = await tenantPrisma.expense.createMany({ data });
        return result.count;
    }
    catch (error) {
        throw error
    }
}

let update = async (databaseName: string, expense: Expense) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        return await tenantPrisma.expense.update({
            where: { id: expense.id },
            data: {
                expenseCategoryId: expense.expenseCategoryId,
                cadence: expense.cadence,
                amount: expense.amount,
                businessDate: expense.businessDate ? new Date(expense.businessDate) : undefined,
                periodMonth: expense.periodMonth ?? null,
                note: expense.note ?? '',
                paymentSource: expense.paymentSource,
                sessionId: expense.sessionId ?? null,
                outletId: expense.outletId ?? 1,
            }
        })
    }
    catch (error) {
        throw error
    }
}

let remove = async (databaseName: string, id: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        return await tenantPrisma.expense.update({
            where: { id },
            data: { deleted: true }
        })
    }
    catch (error) {
        throw error
    }
}

export = { getAllExpenses, getById, createMany, update, remove }
