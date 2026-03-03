import cache from '../cache/simple-cache.service';
import { NotFoundError, RequestValidateError, SubscriptionExpiredError } from '../api-helpers/error';
import {
    SubscriptionPackageResponse,
    PackageCategoryResponse,
    CustomerSubscriptionResponse,
    SubscriptionUsageResponse,
    CustomerSubscriptionListResponse,
} from './subscription-package.response';
import {
    CreatePackageRequest,
    UpdatePackageRequest,
    SubscribeCustomerRequest,
    RecordUsageRequest,
} from './subscription-package.request';

const { getTenantPrisma } = require('../db');

const CACHE_PREFIX = 'loyalty:packages:';

// ============================================
// Helpers
// ============================================

const getTenantDb = (databaseName: string) => getTenantPrisma(databaseName);

const toDecimalNumber = (val: any): number => {
    if (val === null || val === undefined) return 0;
    return typeof val === 'number' ? val : Number(val);
};

const getCachedPackages = async (db: string): Promise<any[]> => {
    const cacheKey = CACHE_PREFIX + db;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const prisma = getTenantDb(db);
    const packages = await prisma.subscriptionPackage.findMany({
        where: { deleted: false, isActive: true },
        include: {
            categories: {
                where: { deleted: false },
                include: {
                    category: { select: { id: true, name: true } },
                },
            },
        },
        orderBy: { name: 'asc' },
    });

    cache.set(cacheKey, packages);
    return packages;
};

const invalidatePackageCache = (db: string) => {
    cache.invalidate(CACHE_PREFIX + db);
};

const formatPackage = (pkg: any): SubscriptionPackageResponse => ({
    id: pkg.id,
    name: pkg.name,
    packageType: pkg.packageType,
    price: toDecimalNumber(pkg.price),
    totalQuota: pkg.totalQuota,
    quotaUnit: pkg.quotaUnit,
    durationDays: pkg.durationDays,
    discountPercentage: pkg.discountPercentage ? toDecimalNumber(pkg.discountPercentage) : null,
    discountAmount: pkg.discountAmount ? toDecimalNumber(pkg.discountAmount) : null,
    validityDays: pkg.validityDays,
    isActive: pkg.isActive,
    categories: (pkg.categories || []).map((c: any) => ({
        categoryId: c.category.id,
        categoryName: c.category.name,
    })),
});

const formatSubscription = (sub: any): CustomerSubscriptionResponse => ({
    id: sub.id,
    customerId: sub.customerId,
    customerName: sub.customer
        ? `${sub.customer.firstName} ${sub.customer.lastName}`.trim()
        : '',
    subscriptionPackageId: sub.subscriptionPackageId,
    packageName: sub.subscriptionPackage?.name ?? '',
    packageType: sub.subscriptionPackage?.packageType ?? sub.packageSnapshot?.packageType ?? '',
    status: sub.status,
    startDate: sub.startDate?.toISOString?.() ?? '',
    endDate: sub.endDate?.toISOString?.() ?? null,
    remainingQuota: sub.remainingQuota,
    usedQuota: sub.usedQuota,
    paidAmount: toDecimalNumber(sub.paidAmount),
    packageSnapshot: sub.packageSnapshot,
});

// ============================================
// Package CRUD
// ============================================

const getPackages = async (db: string): Promise<SubscriptionPackageResponse[]> => {
    const packages = await getCachedPackages(db);
    return packages.map(formatPackage);
};

const getPackageById = async (db: string, packageId: number): Promise<SubscriptionPackageResponse> => {
    const prisma = getTenantDb(db);
    const pkg = await prisma.subscriptionPackage.findUnique({
        where: { id: packageId },
        include: {
            categories: {
                where: { deleted: false },
                include: {
                    category: { select: { id: true, name: true } },
                },
            },
        },
    });
    if (!pkg || pkg.deleted) throw new NotFoundError('Subscription package');
    return formatPackage(pkg);
};

const createPackage = async (db: string, data: CreatePackageRequest): Promise<SubscriptionPackageResponse> => {
    const prisma = getTenantDb(db);

    // Validate package type fields
    if (data.packageType === 'USAGE' && (!data.totalQuota || data.totalQuota <= 0)) {
        throw new RequestValidateError('USAGE packages require totalQuota > 0');
    }
    if (data.packageType === 'TIME' && (!data.durationDays || data.durationDays <= 0)) {
        throw new RequestValidateError('TIME packages require durationDays > 0');
    }

    const pkg = await prisma.$transaction(async (tx: any) => {
        const created = await tx.subscriptionPackage.create({
            data: {
                name: data.name,
                packageType: data.packageType,
                price: data.price,
                totalQuota: data.totalQuota ?? null,
                quotaUnit: data.quotaUnit ?? null,
                durationDays: data.durationDays ?? null,
                discountPercentage: data.discountPercentage ?? null,
                discountAmount: data.discountAmount ?? null,
                validityDays: data.validityDays ?? null,
            },
        });

        // Link categories if provided
        if (data.categoryIds?.length) {
            await tx.subscriptionPackageCategory.createMany({
                data: data.categoryIds.map(categoryId => ({
                    subscriptionPackageId: created.id,
                    categoryId,
                })),
            });
        }

        return await tx.subscriptionPackage.findUnique({
            where: { id: created.id },
            include: {
                categories: {
                    where: { deleted: false },
                    include: {
                        category: { select: { id: true, name: true } },
                    },
                },
            },
        });
    });

    invalidatePackageCache(db);
    return formatPackage(pkg);
};

const updatePackage = async (db: string, packageId: number, data: UpdatePackageRequest): Promise<SubscriptionPackageResponse> => {
    const prisma = getTenantDb(db);

    const pkg = await prisma.$transaction(async (tx: any) => {
        const existing = await tx.subscriptionPackage.findUnique({ where: { id: packageId } });
        if (!existing || existing.deleted) throw new NotFoundError('Subscription package');

        await tx.subscriptionPackage.update({
            where: { id: packageId },
            data: {
                ...(data.name !== undefined && { name: data.name }),
                ...(data.packageType !== undefined && { packageType: data.packageType }),
                ...(data.price !== undefined && { price: data.price }),
                ...(data.totalQuota !== undefined && { totalQuota: data.totalQuota }),
                ...(data.quotaUnit !== undefined && { quotaUnit: data.quotaUnit }),
                ...(data.durationDays !== undefined && { durationDays: data.durationDays }),
                ...(data.discountPercentage !== undefined && { discountPercentage: data.discountPercentage }),
                ...(data.discountAmount !== undefined && { discountAmount: data.discountAmount }),
                ...(data.validityDays !== undefined && { validityDays: data.validityDays }),
                ...(data.isActive !== undefined && { isActive: data.isActive }),
            },
        });

        // Update category links if provided
        if (data.categoryIds !== undefined) {
            // Soft-delete all existing
            await tx.subscriptionPackageCategory.updateMany({
                where: { subscriptionPackageId: packageId },
                data: { deleted: true, deletedAt: new Date() },
            });

            // Create new links
            if (data.categoryIds.length > 0) {
                for (const categoryId of data.categoryIds) {
                    await tx.subscriptionPackageCategory.upsert({
                        where: {
                            subscriptionPackageId_categoryId: {
                                subscriptionPackageId: packageId,
                                categoryId,
                            },
                        },
                        update: { deleted: false, deletedAt: null },
                        create: {
                            subscriptionPackageId: packageId,
                            categoryId,
                        },
                    });
                }
            }
        }

        return await tx.subscriptionPackage.findUnique({
            where: { id: packageId },
            include: {
                categories: {
                    where: { deleted: false },
                    include: {
                        category: { select: { id: true, name: true } },
                    },
                },
            },
        });
    });

    invalidatePackageCache(db);
    return formatPackage(pkg);
};

const deletePackage = async (db: string, packageId: number): Promise<void> => {
    const prisma = getTenantDb(db);

    const existing = await prisma.subscriptionPackage.findUnique({ where: { id: packageId } });
    if (!existing || existing.deleted) throw new NotFoundError('Subscription package');

    // Check for active subscriptions
    const activeCount = await prisma.customerSubscription.count({
        where: {
            subscriptionPackageId: packageId,
            status: 'ACTIVE',
            deleted: false,
        },
    });
    if (activeCount > 0) {
        throw new RequestValidateError(`Cannot delete package with ${activeCount} active subscription(s). Cancel them first.`);
    }

    await prisma.subscriptionPackage.update({
        where: { id: packageId },
        data: { deleted: true, deletedAt: new Date(), isActive: false },
    });

    invalidatePackageCache(db);
};

// ============================================
// Customer Subscription Management
// ============================================

const subscribeCustomer = async (db: string, data: SubscribeCustomerRequest): Promise<CustomerSubscriptionResponse> => {
    const prisma = getTenantDb(db);

    return await prisma.$transaction(async (tx: any) => {
        // Verify customer
        const customer = await tx.customer.findUnique({
            where: { id: data.customerId },
            select: { id: true, firstName: true, lastName: true, deleted: true },
        });
        if (!customer || customer.deleted) throw new NotFoundError('Customer');

        // Verify package
        const pkg = await tx.subscriptionPackage.findUnique({
            where: { id: data.subscriptionPackageId },
            include: {
                categories: {
                    where: { deleted: false },
                    include: {
                        category: { select: { id: true, name: true } },
                    },
                },
            },
        });
        if (!pkg || pkg.deleted || !pkg.isActive) throw new NotFoundError('Subscription package');

        // Calculate end date for TIME packages
        const now = new Date();
        let endDate: Date | null = null;
        if (pkg.packageType === 'TIME' && pkg.durationDays) {
            endDate = new Date(now.getTime() + pkg.durationDays * 24 * 60 * 60 * 1000);
        }
        // For USAGE packages with validityDays
        if (pkg.packageType === 'USAGE' && pkg.validityDays) {
            endDate = new Date(now.getTime() + pkg.validityDays * 24 * 60 * 60 * 1000);
        }

        // Create package snapshot for historical record
        const packageSnapshot = {
            packageId: pkg.id,
            name: pkg.name,
            packageType: pkg.packageType,
            price: toDecimalNumber(pkg.price),
            totalQuota: pkg.totalQuota,
            quotaUnit: pkg.quotaUnit,
            durationDays: pkg.durationDays,
            discountPercentage: pkg.discountPercentage ? toDecimalNumber(pkg.discountPercentage) : null,
            discountAmount: pkg.discountAmount ? toDecimalNumber(pkg.discountAmount) : null,
            categories: pkg.categories.map((c: any) => ({
                categoryId: c.category.id,
                categoryName: c.category.name,
            })),
        };

        const subscription = await tx.customerSubscription.create({
            data: {
                customerId: data.customerId,
                subscriptionPackageId: data.subscriptionPackageId,
                status: 'ACTIVE',
                startDate: now,
                endDate,
                remainingQuota: pkg.packageType === 'USAGE' ? pkg.totalQuota : null,
                paidAmount: data.paidAmount,
                packageSnapshot,
            },
            include: {
                customer: { select: { firstName: true, lastName: true } },
                subscriptionPackage: true,
            },
        });

        return formatSubscription(subscription);
    });
};

const getCustomerSubscriptions = async (
    db: string,
    customerId: number
): Promise<CustomerSubscriptionListResponse> => {
    const prisma = getTenantDb(db);

    const [subscriptions, total] = await Promise.all([
        prisma.customerSubscription.findMany({
            where: { customerId, deleted: false },
            include: {
                customer: { select: { firstName: true, lastName: true } },
                subscriptionPackage: true,
            },
            orderBy: { createdAt: 'desc' },
        }),
        prisma.customerSubscription.count({
            where: { customerId, deleted: false },
        }),
    ]);

    return {
        subscriptions: subscriptions.map(formatSubscription),
        total,
    };
};

const getSubscriptionById = async (db: string, subscriptionId: number): Promise<CustomerSubscriptionResponse> => {
    const prisma = getTenantDb(db);

    const subscription = await prisma.customerSubscription.findUnique({
        where: { id: subscriptionId },
        include: {
            customer: { select: { firstName: true, lastName: true } },
            subscriptionPackage: true,
        },
    });

    if (!subscription || subscription.deleted) throw new NotFoundError('Customer subscription');
    return formatSubscription(subscription);
};

const cancelSubscription = async (db: string, subscriptionId: number): Promise<CustomerSubscriptionResponse> => {
    const prisma = getTenantDb(db);

    const subscription = await prisma.customerSubscription.findUnique({
        where: { id: subscriptionId },
    });
    if (!subscription || subscription.deleted) throw new NotFoundError('Customer subscription');
    if (subscription.status === 'CANCELLED') {
        throw new RequestValidateError('Subscription is already cancelled');
    }

    const updated = await prisma.customerSubscription.update({
        where: { id: subscriptionId },
        data: { status: 'CANCELLED' },
        include: {
            customer: { select: { firstName: true, lastName: true } },
            subscriptionPackage: true,
        },
    });

    return formatSubscription(updated);
};

const recordUsage = async (
    db: string,
    data: RecordUsageRequest,
    performedBy?: string
): Promise<SubscriptionUsageResponse> => {
    const prisma = getTenantDb(db);
    const quantityUsed = data.quantityUsed ?? 1;

    return await prisma.$transaction(async (tx: any) => {
        // Fetch subscription with version for optimistic locking
        const subscription = await tx.customerSubscription.findUnique({
            where: { id: data.customerSubscriptionId },
            include: {
                subscriptionPackage: {
                    include: {
                        categories: {
                            where: { deleted: false },
                            select: { categoryId: true },
                        },
                    },
                },
            },
        });

        if (!subscription || subscription.deleted) {
            throw new NotFoundError('Customer subscription');
        }
        if (subscription.status !== 'ACTIVE') {
            throw new SubscriptionExpiredError();
        }

        // Check end date for TIME packages
        if (subscription.endDate && new Date() > subscription.endDate) {
            await tx.customerSubscription.update({
                where: { id: subscription.id },
                data: { status: 'EXPIRED' },
            });
            throw new SubscriptionExpiredError();
        }

        // For USAGE packages, check quota
        if (subscription.subscriptionPackage.packageType === 'USAGE') {
            if (subscription.remainingQuota === null || subscription.remainingQuota < quantityUsed) {
                throw new RequestValidateError(
                    `Insufficient quota. Remaining: ${subscription.remainingQuota ?? 0}, Required: ${quantityUsed}`
                );
            }
        }

        // Update subscription (optimistic locking via version)
        const updateData: any = {
            usedQuota: { increment: quantityUsed },
            version: { increment: 1 },
        };

        if (subscription.subscriptionPackage.packageType === 'USAGE') {
            updateData.remainingQuota = { decrement: quantityUsed };
        }

        const updated = await tx.customerSubscription.update({
            where: {
                id: subscription.id,
                version: subscription.version, // Optimistic lock
            },
            data: updateData,
        });

        // If USAGE and quota hit 0, mark as expired
        if (subscription.subscriptionPackage.packageType === 'USAGE' && updated.remainingQuota <= 0) {
            await tx.customerSubscription.update({
                where: { id: subscription.id },
                data: { status: 'EXPIRED' },
            });
        }

        // Create usage record
        const usage = await tx.subscriptionUsage.create({
            data: {
                customerSubscriptionId: subscription.id,
                salesId: data.salesId,
                quantityUsed,
                remainingAfter: subscription.subscriptionPackage.packageType === 'USAGE'
                    ? (subscription.remainingQuota ?? 0) - quantityUsed
                    : -1,
                performedBy: performedBy ?? null,
            },
        });

        return {
            id: usage.id,
            customerSubscriptionId: usage.customerSubscriptionId,
            salesId: usage.salesId,
            quantityUsed: usage.quantityUsed,
            remainingAfter: usage.remainingAfter,
            performedBy: usage.performedBy,
            createdAt: usage.createdAt?.toISOString?.() ?? new Date().toISOString(),
        };
    });
};

// ============================================
// Exports
// ============================================

export default {
    // Package CRUD
    getPackages,
    getPackageById,
    createPackage,
    updatePackage,
    deletePackage,
    // Customer subscriptions
    subscribeCustomer,
    getCustomerSubscriptions,
    getSubscriptionById,
    cancelSubscription,
    // Usage
    recordUsage,
    // Cache helpers (for sales integration)
    getCachedPackages,
    invalidatePackageCache,
};
