import { PrismaClient, Customer } from "../../prisma/client/generated/client"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { getTenantPrisma } from '../db';
import { SyncRequest } from "src/item/item.request";

let getAll = async (databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const customers = await tenantPrisma.customer.findMany();
        return customers;
    }
    catch (error) {
        throw error;
    }
}

let getAllCustomers = async (
    databaseName: string,
    syncRequest: SyncRequest
): Promise<{ customers: any[]; total: number; serverTimestamp: string }> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { lastSyncTimestamp, lastVersion, skip = 0, take = 100 } = syncRequest;

    try {
        // Parse last sync timestamp or use a default (e.g., epoch start)
        const lastSync = (lastSyncTimestamp && lastSyncTimestamp !== 'null') ?
            new Date(lastSyncTimestamp) : new Date(0);

        // Build query conditions
        let where: any;

        if (lastVersion) {
            where = { version: { gt: lastVersion } };
        } else {
            // Delta change detection for customers only
            where = {
                OR: [
                    // Direct customer changes
                    { createdAt: { gte: lastSync } },
                    { updatedAt: { gte: lastSync } },
                    { deletedAt: { gte: lastSync } }
                ],
                deleted: false
            };
        }

        // Count total matching records
        const total = await tenantPrisma.customer.count({ where });

        // Fetch paginated customers
        const customers = await tenantPrisma.customer.findMany({
            where,
            skip,
            take,
        });

        return {
            customers,
            total,
            serverTimestamp: new Date().toISOString(),
        };
    } catch (error) {
        throw error;
    }
};

let getById = async (id: number, databaseName: string, loyaltyTier?: 'none' | 'basic' | 'advanced') => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const includeLoyalty = loyaltyTier && loyaltyTier !== 'none';

        const customer = await tenantPrisma.customer.findUnique({
            where: {
                id: id
            },
            ...(includeLoyalty ? {
                include: {
                    loyaltyAccounts: {
                        where: { deleted: false },
                        include: loyaltyTier === 'advanced' ? {
                            loyaltyTier: true,
                        } : undefined,
                        take: 1,
                    },
                    ...(loyaltyTier === 'advanced' ? {
                        customerSubscriptions: {
                            where: { deleted: false, status: 'ACTIVE' },
                            include: {
                                subscriptionPackage: {
                                    select: {
                                        id: true,
                                        name: true,
                                        packageType: true,
                                        discountPercentage: true,
                                        discountAmount: true,
                                        categories: {
                                            select: {
                                                categoryId: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    } : {}),
                },
            } : {}),
        })
        if (!customer) {
            throw new NotFoundError("Customer");
        }
        return customer;
    }
    catch (error) {
        throw error;
    }
}

let createMany = async (customers: Customer[], databaseName: string, loyaltyTier?: 'none' | 'basic' | 'advanced') => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // Collect non-empty emails and mobiles from incoming data
        const emails = customers.map(c => c.email).filter(e => e) as string[];
        const mobiles = customers.map(c => c.mobile).filter(m => m) as string[];

        // Check if any email or mobile already exists
        const existing = await tenantPrisma.customer.findFirst({
            where: {
                deleted: false,
                OR: [
                    ...(emails.length > 0 ? [{ email: { in: emails } }] : []),
                    ...(mobiles.length > 0 ? [{ mobile: { in: mobiles } }] : []),
                ],
            },
            select: { email: true, mobile: true },
        });

        if (existing) {
            const conflict = existing.email && emails.includes(existing.email)
                ? `Email '${existing.email}' already exists`
                : `Mobile '${existing.mobile}' already exists`;
            throw new RequestValidateError(conflict);
        }

        await tenantPrisma.customer.createMany({
            data: customers,
        });
        const createdCustomers = await tenantPrisma.customer.findMany({
            where: {
                firstName: { in: customers.map(c => c.firstName) },
                lastName: { in: customers.map(c => c.lastName) },
            },
        });

        // Auto-enroll new customers into active loyalty program
        if (loyaltyTier && loyaltyTier !== 'none') {
            try {
                const program = await tenantPrisma.loyaltyProgram.findFirst({
                    where: { deleted: false, isActive: true },
                    select: { id: true },
                });
                if (program) {
                    await tenantPrisma.loyaltyAccount.createMany({
                        data: createdCustomers.map(c => ({
                            customerId: c.id,
                            loyaltyProgramId: program.id,
                        })),
                    });
                }
            } catch (err) {
                console.error('Auto-enroll failed:', err);
            }
        }

        return createdCustomers;
    }
    catch (error) {
        throw error;
    }
}

let update = async (customer: Customer, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const updatedCustomer = await tenantPrisma.customer.update({
            where: {
                id: customer.id
            },
            data: customer
        });
        return updatedCustomer;
    }
    catch (error) {
        throw error;
    }
}

let remove = async (id: number, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const updatedCustomer = await tenantPrisma.customer.update({
            where: {
                id: id
            },
            data: {
                deleted: true
            }
        })
        return updatedCustomer
    }
    catch (error) {
        throw error
    }
}

export = { getAll, getAllCustomers, getById, createMany, update, remove }