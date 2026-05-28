import cache from '../cache/simple-cache.service';
import { NotFoundError, RequestValidateError, InsufficientPointsError } from '../api-helpers/error';
import {
    LoyaltyProgramResponse,
    LoyaltyAccountResponse,
    LoyaltyTierResponse,
    PointsOperationResponse,
    LoyaltyTransactionResponse,
    TransactionHistoryResponse,
} from './loyalty.response';
import {
    CreateProgramRequest,
    UpdateProgramRequest,
    EnrollCustomerRequest,
    EarnPointsRequest,
    RedeemPointsRequest,
    AdjustPointsRequest,
    CreateTierRequest,
    UpdateTierRequest,
    ManualTierAssignRequest,
} from './loyalty.request';

const { getTenantPrisma } = require('../db');

const CACHE_PREFIX = 'loyalty:program:';

// ============================================
// Helpers
// ============================================

const getTenantDb = (databaseName: string) => getTenantPrisma(databaseName);

const getCachedProgram = async (db: string): Promise<any | null> => {
    const cacheKey = CACHE_PREFIX + db;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const prisma = getTenantDb(db);
    const program = await prisma.loyaltyProgram.findFirst({
        where: { deleted: false, isActive: true },
        include: {
            tiers: {
                where: { deleted: false },
                orderBy: { sortOrder: 'asc' },
            },
        },
    });

    if (program) {
        cache.set(cacheKey, program);
    }
    return program;
};

const invalidateProgramCache = (db: string) => {
    cache.invalidate(CACHE_PREFIX + db);
};

const toDecimalNumber = (val: any): number => {
    if (val === null || val === undefined) return 0;
    return typeof val === 'number' ? val : Number(val);
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ============================================
// Pure helpers (exported via __testables)
// ============================================

/**
 * Calendar-day delta between two timestamps, rounded up so a sub-day gap
 * still extends timers by at least one day. Returns 0 for non-positive
 * spans (defensive: clock skew, identical timestamps).
 */
const calculateInactiveDays = (deactivatedAt: Date, now: Date): number => {
    const ms = now.getTime() - deactivatedAt.getTime();
    if (ms <= 0) return 0;
    return Math.ceil(ms / MS_PER_DAY);
};

/**
 * Returns the highest-minSpend tier the customer qualifies for, or null
 * if none match. Backs auto-tier promotion (docs LOYALTY.md §2 "Tier
 * Membership" — customers never auto-downgrade; caller decides whether to
 * apply this result.)
 */
const selectHighestQualifyingTier = <T extends { id: number; minSpend: any }>(
    totalSpend: number,
    tiers: T[],
): T | null => {
    const sorted = [...tiers].sort(
        (a, b) => toDecimalNumber(b.minSpend) - toDecimalNumber(a.minSpend),
    );
    for (const tier of sorted) {
        if (totalSpend >= toDecimalNumber(tier.minSpend)) return tier;
    }
    return null;
};

/**
 * FIFO point-batch consumption math: returns the per-batch deductions that
 * should be applied to drain `pointsToRedeem` from the given batches
 * (already ordered oldest-first by the caller). Does NOT mutate input.
 * Throws if batches are insufficient — caller should pre-check via
 * `currentPoints >= pointsToRedeem`, but this is a safety net.
 */
const consumePointsFifo = <T extends { id: number; remainingPoints: any }>(
    batches: T[],
    pointsToRedeem: number,
): { batchId: number; deduct: number; newRemaining: number }[] => {
    if (pointsToRedeem <= 0) return [];

    const deductions: { batchId: number; deduct: number; newRemaining: number }[] = [];
    let remaining = pointsToRedeem;

    for (const batch of batches) {
        if (remaining <= 0) break;
        const batchRemaining = toDecimalNumber(batch.remainingPoints);
        if (batchRemaining <= 0) continue;
        const deduct = Math.min(remaining, batchRemaining);
        deductions.push({
            batchId: batch.id,
            deduct,
            newRemaining: batchRemaining - deduct,
        });
        remaining -= deduct;
    }

    if (remaining > 0) {
        throw new InsufficientPointsError(pointsToRedeem - remaining, pointsToRedeem);
    }
    return deductions;
};

const bulkEnrollCustomers = async (db: string, programId: number) => {
    const prisma = getTenantDb(db);
    const [customers, enrolled] = await Promise.all([
        prisma.customer.findMany({ where: { deleted: false }, select: { id: true } }),
        prisma.loyaltyAccount.findMany({
            where: { loyaltyProgramId: programId, deleted: false },
            select: { customerId: true },
        }),
    ]);
    const enrolledSet = new Set(enrolled.map((e: any) => e.customerId));
    const unenrolled = customers.filter((c: any) => !enrolledSet.has(c.id));
    if (unenrolled.length > 0) {
        await prisma.loyaltyAccount.createMany({
            data: unenrolled.map((c: any) => ({
                customerId: c.id,
                loyaltyProgramId: programId,
            })),
        });
    }
};

// ============================================
// Program CRUD
// ============================================

const getProgram = async (db: string): Promise<LoyaltyProgramResponse | null> => {
    // Return program regardless of isActive so frontend stays in update mode
    const prisma = getTenantDb(db);
    const program = await prisma.loyaltyProgram.findFirst({
        where: { deleted: false },
        include: {
            tiers: {
                where: { deleted: false },
                orderBy: { sortOrder: 'asc' },
            },
        },
    });
    if (!program) return null;

    return {
        id: program.id,
        name: program.name,
        pointsPerCurrency: toDecimalNumber(program.pointsPerCurrency),
        currencyPerPoint: toDecimalNumber(program.currencyPerPoint),
        pointsExpiryDays: program.pointsExpiryDays,
        minRedeemPoints: toDecimalNumber(program.minRedeemPoints),
        pointsRoundingMode: program.pointsRoundingMode,
        isActive: program.isActive,
        tiers: program.tiers.map((t: any) => ({
            id: t.id,
            name: t.name,
            minSpend: toDecimalNumber(t.minSpend),
            discountPercentage: toDecimalNumber(t.discountPercentage),
            pointsMultiplier: toDecimalNumber(t.pointsMultiplier),
            sortOrder: t.sortOrder,
        })),
    };
};

const createProgram = async (db: string, data: CreateProgramRequest): Promise<LoyaltyProgramResponse> => {
    const prisma = getTenantDb(db);

    // Only one active program allowed
    const existing = await prisma.loyaltyProgram.findFirst({
        where: { deleted: false },
    });
    if (existing) {
        throw new RequestValidateError('A loyalty program already exists. Update it instead.');
    }

    const program = await prisma.loyaltyProgram.create({
        data: {
            name: data.name,
            pointsPerCurrency: data.pointsPerCurrency,
            currencyPerPoint: data.currencyPerPoint,
            pointsExpiryDays: data.pointsExpiryDays ?? null,
            minRedeemPoints: data.minRedeemPoints ?? 0,
            ...(data.pointsRoundingMode !== undefined && { pointsRoundingMode: data.pointsRoundingMode }),
        },
    });

    invalidateProgramCache(db);

    // Auto-enroll all existing customers (fire-and-forget)
    bulkEnrollCustomers(db, program.id).catch(err =>
        console.error('Bulk enroll on program create failed:', err)
    );

    return {
        id: program.id,
        name: program.name,
        pointsPerCurrency: toDecimalNumber(program.pointsPerCurrency),
        currencyPerPoint: toDecimalNumber(program.currencyPerPoint),
        pointsExpiryDays: program.pointsExpiryDays,
        minRedeemPoints: toDecimalNumber(program.minRedeemPoints),
        pointsRoundingMode: program.pointsRoundingMode,
        isActive: program.isActive,
        tiers: [],
    };
};

const updateProgram = async (db: string, programId: number, data: UpdateProgramRequest): Promise<LoyaltyProgramResponse> => {
    const prisma = getTenantDb(db);

    // Read old state to detect activation/deactivation transitions
    const oldProgram = data.isActive !== undefined
        ? await prisma.loyaltyProgram.findUnique({
            where: { id: programId },
            select: { isActive: true, deactivatedAt: true },
        })
        : null;

    const isDeactivating = data.isActive === false && oldProgram?.isActive === true;
    const isReactivating = data.isActive === true && oldProgram?.isActive === false;

    const program = await prisma.loyaltyProgram.update({
        where: { id: programId },
        data: {
            ...(data.name !== undefined && { name: data.name }),
            ...(data.pointsPerCurrency !== undefined && { pointsPerCurrency: data.pointsPerCurrency }),
            ...(data.currencyPerPoint !== undefined && { currencyPerPoint: data.currencyPerPoint }),
            ...(data.pointsExpiryDays !== undefined && { pointsExpiryDays: data.pointsExpiryDays }),
            ...(data.minRedeemPoints !== undefined && { minRedeemPoints: data.minRedeemPoints }),
            ...(data.pointsRoundingMode !== undefined && { pointsRoundingMode: data.pointsRoundingMode }),
            ...(data.isActive !== undefined && { isActive: data.isActive }),
            ...(isDeactivating && { deactivatedAt: new Date() }),
            ...(isReactivating && { deactivatedAt: null }),
        },
        include: {
            tiers: {
                where: { deleted: false },
                orderBy: { sortOrder: 'asc' },
            },
        },
    });

    invalidateProgramCache(db);

    // On reactivation: extend subscription endDates and point batch expiresAt by inactive days
    if (isReactivating && oldProgram?.deactivatedAt) {
        const daysInactive = calculateInactiveDays(oldProgram.deactivatedAt, new Date());

        if (daysInactive > 0) {
            // Raw SQL must bump UPDATED_AT — delta sync uses it as the change cursor, so
            // forgetting it makes offline clients never see the extended dates. Audit r1-#8.
            prisma.$executeRaw`
                UPDATE customer_subscription
                SET END_DATE = DATE_ADD(END_DATE, INTERVAL ${daysInactive} DAY),
                    UPDATED_AT = NOW()
                WHERE STATUS = 'ACTIVE' AND END_DATE IS NOT NULL AND IS_DELETED = false
            `.catch((err: unknown) => console.error('Extend subscription dates failed:', err));

            prisma.$executeRaw`
                UPDATE loyalty_point_batch
                SET EXPIRES_AT = DATE_ADD(EXPIRES_AT, INTERVAL ${daysInactive} DAY),
                    UPDATED_AT = NOW()
                WHERE REMAINING_POINTS > 0 AND EXPIRES_AT IS NOT NULL AND IS_DELETED = false
            `.catch((err: unknown) => console.error('Extend point batch expiry failed:', err));

            prisma.$executeRaw`
                UPDATE voucher
                SET EXPIRES_AT = DATE_ADD(EXPIRES_AT, INTERVAL ${daysInactive} DAY),
                    UPDATED_AT = NOW()
                WHERE STATUS = 'ACTIVE' AND EXPIRES_AT IS NOT NULL AND IS_DELETED = false
            `.catch((err: unknown) => console.error('Extend voucher expiry failed:', err));
        }

        // Bulk enroll customers created during inactive period
        bulkEnrollCustomers(db, program.id).catch(err =>
            console.error('Bulk enroll on reactivation failed:', err)
        );
    }

    return {
        id: program.id,
        name: program.name,
        pointsPerCurrency: toDecimalNumber(program.pointsPerCurrency),
        currencyPerPoint: toDecimalNumber(program.currencyPerPoint),
        pointsExpiryDays: program.pointsExpiryDays,
        minRedeemPoints: toDecimalNumber(program.minRedeemPoints),
        pointsRoundingMode: program.pointsRoundingMode,
        isActive: program.isActive,
        tiers: program.tiers.map((t: any) => ({
            id: t.id,
            name: t.name,
            minSpend: toDecimalNumber(t.minSpend),
            discountPercentage: toDecimalNumber(t.discountPercentage),
            pointsMultiplier: toDecimalNumber(t.pointsMultiplier),
            sortOrder: t.sortOrder,
        })),
    };
};

// ============================================
// Customer Enrollment
// ============================================

const enrollCustomer = async (db: string, data: EnrollCustomerRequest): Promise<LoyaltyAccountResponse> => {
    const prisma = getTenantDb(db);

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
        where: { id: data.customerId },
        select: { id: true, firstName: true, lastName: true, deleted: true },
    });
    if (!customer || customer.deleted) {
        throw new NotFoundError('Customer');
    }

    // Verify program exists
    const program = await prisma.loyaltyProgram.findUnique({
        where: { id: data.loyaltyProgramId },
    });
    if (!program || program.deleted || !program.isActive) {
        throw new NotFoundError('Loyalty program');
    }

    // Create account (unique constraint will prevent duplicates)
    const account = await prisma.loyaltyAccount.create({
        data: {
            customerId: data.customerId,
            loyaltyProgramId: data.loyaltyProgramId,
        },
    });

    return {
        id: account.id,
        customerId: account.customerId,
        customerName: `${customer.firstName} ${customer.lastName}`.trim(),
        loyaltyProgramId: account.loyaltyProgramId,
        currentPoints: 0,
        totalEarned: 0,
        totalRedeemed: 0,
        totalSpend: 0,
        loyaltyTier: null,
        isManualTier: false,
        joinedAt: account.joinedAt.toISOString(),
    };
};

// ============================================
// Account Lookup
// ============================================

const getAccountByCustomerId = async (db: string, customerId: number): Promise<LoyaltyAccountResponse | null> => {
    const prisma = getTenantDb(db);

    const account = await prisma.loyaltyAccount.findFirst({
        where: { customerId, deleted: false },
        include: {
            customer: { select: { firstName: true, lastName: true } },
            loyaltyTier: true,
        },
    });

    if (!account) return null;

    return {
        id: account.id,
        customerId: account.customerId,
        customerName: `${account.customer.firstName} ${account.customer.lastName}`.trim(),
        loyaltyProgramId: account.loyaltyProgramId,
        currentPoints: toDecimalNumber(account.currentPoints),
        totalEarned: toDecimalNumber(account.totalEarned),
        totalRedeemed: toDecimalNumber(account.totalRedeemed),
        totalSpend: toDecimalNumber(account.totalSpend),
        loyaltyTier: account.loyaltyTier ? {
            id: account.loyaltyTier.id,
            name: account.loyaltyTier.name,
            minSpend: toDecimalNumber(account.loyaltyTier.minSpend),
            discountPercentage: toDecimalNumber(account.loyaltyTier.discountPercentage),
            pointsMultiplier: toDecimalNumber(account.loyaltyTier.pointsMultiplier),
            sortOrder: account.loyaltyTier.sortOrder,
        } : null,
        isManualTier: account.isManualTier,
        joinedAt: account.joinedAt.toISOString(),
    };
};

// ============================================
// Points Operations
// ============================================

const earnPoints = async (
    db: string,
    accountId: number,
    data: EarnPointsRequest,
    performedBy?: string
): Promise<PointsOperationResponse> => {
    const prisma = getTenantDb(db);

    if (data.points <= 0) {
        throw new RequestValidateError('Points must be positive');
    }

    const program = await getCachedProgram(db);
    if (!program) {
        throw new RequestValidateError('Loyalty program is not active');
    }

    return await prisma.$transaction(async (tx: any) => {
        const account = await tx.loyaltyAccount.findUnique({
            where: { id: accountId },
        });
        if (!account || account.deleted) {
            throw new NotFoundError('Loyalty account');
        }

        // Get expiry config from program
        const expiresAt = program.pointsExpiryDays
            ? new Date(Date.now() + program.pointsExpiryDays * 24 * 60 * 60 * 1000)
            : null;

        // Create point batch
        await tx.loyaltyPointBatch.create({
            data: {
                loyaltyAccountId: accountId,
                originalPoints: data.points,
                remainingPoints: data.points,
                expiresAt,
                salesId: data.salesId ?? null,
            },
        });

        // Update account totals
        const updatedAccount = await tx.loyaltyAccount.update({
            where: { id: accountId },
            data: {
                currentPoints: { increment: data.points },
                totalEarned: { increment: data.points },
            },
        });

        const newBalance = toDecimalNumber(updatedAccount.currentPoints);

        // Create transaction record
        const transaction = await tx.loyaltyTransaction.create({
            data: {
                loyaltyAccountId: accountId,
                type: 'EARN',
                points: data.points,
                balanceAfter: newBalance,
                salesId: data.salesId ?? null,
                description: data.description ?? null,
                performedBy: performedBy ?? null,
            },
        });

        return {
            success: true,
            message: `Earned ${data.points} points`,
            account: {
                currentPoints: newBalance,
                totalEarned: toDecimalNumber(updatedAccount.totalEarned),
                totalRedeemed: toDecimalNumber(updatedAccount.totalRedeemed),
            },
            transaction: formatTransaction(transaction),
        };
    });
};

const redeemPoints = async (
    db: string,
    accountId: number,
    data: RedeemPointsRequest,
    performedBy?: string
): Promise<PointsOperationResponse> => {
    const prisma = getTenantDb(db);

    if (data.points <= 0) {
        throw new RequestValidateError('Points must be positive');
    }

    const program = await getCachedProgram(db);
    if (!program) {
        throw new RequestValidateError('Loyalty program is not active');
    }

    return await prisma.$transaction(async (tx: any) => {
        // Lock the account row
        const account = await tx.loyaltyAccount.findUnique({
            where: { id: accountId },
        });
        if (!account || account.deleted) {
            throw new NotFoundError('Loyalty account');
        }

        const currentPoints = toDecimalNumber(account.currentPoints);
        if (currentPoints < data.points) {
            throw new InsufficientPointsError(currentPoints, data.points);
        }

        // Check minimum redemption
        const minRedeem = toDecimalNumber(program.minRedeemPoints);
        if (data.points < minRedeem) {
            throw new RequestValidateError(`Minimum redemption is ${minRedeem} points`);
        }

        // FIFO deduction from point batches
        const batches = await tx.loyaltyPointBatch.findMany({
            where: {
                loyaltyAccountId: accountId,
                remainingPoints: { gt: 0 },
                deleted: false,
            },
            orderBy: [
                { expiresAt: { sort: 'asc', nulls: 'last' } },
                { earnedAt: 'asc' },
            ],
        });

        for (const { batchId, newRemaining } of consumePointsFifo(batches, data.points)) {
            await tx.loyaltyPointBatch.update({
                where: { id: batchId },
                data: { remainingPoints: newRemaining },
            });
        }

        // Update account totals
        const updatedAccount = await tx.loyaltyAccount.update({
            where: { id: accountId },
            data: {
                currentPoints: { decrement: data.points },
                totalRedeemed: { increment: data.points },
            },
        });

        const newBalance = toDecimalNumber(updatedAccount.currentPoints);

        // Create transaction record
        const transaction = await tx.loyaltyTransaction.create({
            data: {
                loyaltyAccountId: accountId,
                type: 'REDEEM',
                points: -data.points,
                balanceAfter: newBalance,
                salesId: data.salesId ?? null,
                description: data.description ?? null,
                performedBy: performedBy ?? null,
            },
        });

        return {
            success: true,
            message: `Redeemed ${data.points} points`,
            account: {
                currentPoints: newBalance,
                totalEarned: toDecimalNumber(updatedAccount.totalEarned),
                totalRedeemed: toDecimalNumber(updatedAccount.totalRedeemed),
            },
            transaction: formatTransaction(transaction),
        };
    });
};

const adjustPoints = async (
    db: string,
    accountId: number,
    data: AdjustPointsRequest,
    performedBy?: string
): Promise<PointsOperationResponse> => {
    const prisma = getTenantDb(db);

    if (data.points === 0) {
        throw new RequestValidateError('Points cannot be zero');
    }

    const program = await getCachedProgram(db);
    if (!program) {
        throw new RequestValidateError('Loyalty program is not active');
    }

    return await prisma.$transaction(async (tx: any) => {
        const account = await tx.loyaltyAccount.findUnique({
            where: { id: accountId },
        });
        if (!account || account.deleted) {
            throw new NotFoundError('Loyalty account');
        }

        const currentPoints = toDecimalNumber(account.currentPoints);
        if (data.points < 0 && currentPoints < Math.abs(data.points)) {
            throw new InsufficientPointsError(currentPoints, Math.abs(data.points));
        }

        // If adding points, create a batch (no expiry for adjustments)
        if (data.points > 0) {
            await tx.loyaltyPointBatch.create({
                data: {
                    loyaltyAccountId: accountId,
                    originalPoints: data.points,
                    remainingPoints: data.points,
                    expiresAt: null,
                },
            });
        }

        // If removing points, FIFO deduction
        if (data.points < 0) {
            let remaining = Math.abs(data.points);
            const batches = await tx.loyaltyPointBatch.findMany({
                where: {
                    loyaltyAccountId: accountId,
                    remainingPoints: { gt: 0 },
                    deleted: false,
                },
                orderBy: [
                    { expiresAt: { sort: 'asc', nulls: 'last' } },
                    { earnedAt: 'asc' },
                ],
            });

            for (const batch of batches) {
                if (remaining <= 0) break;
                const batchRemaining = toDecimalNumber(batch.remainingPoints);
                const deduct = Math.min(remaining, batchRemaining);
                await tx.loyaltyPointBatch.update({
                    where: { id: batch.id },
                    data: { remainingPoints: batchRemaining - deduct },
                });
                remaining -= deduct;
            }
        }

        // Update account
        const updatedAccount = await tx.loyaltyAccount.update({
            where: { id: accountId },
            data: {
                currentPoints: { increment: data.points },
                ...(data.points > 0 ? { totalEarned: { increment: data.points } } : {}),
                ...(data.points < 0 ? { totalRedeemed: { increment: Math.abs(data.points) } } : {}),
            },
        });

        const newBalance = toDecimalNumber(updatedAccount.currentPoints);

        const transaction = await tx.loyaltyTransaction.create({
            data: {
                loyaltyAccountId: accountId,
                type: 'ADJUST',
                points: data.points,
                balanceAfter: newBalance,
                description: data.description,
                performedBy: performedBy ?? null,
            },
        });

        return {
            success: true,
            message: `Adjusted ${data.points > 0 ? '+' : ''}${data.points} points`,
            account: {
                currentPoints: newBalance,
                totalEarned: toDecimalNumber(updatedAccount.totalEarned),
                totalRedeemed: toDecimalNumber(updatedAccount.totalRedeemed),
            },
            transaction: formatTransaction(transaction),
        };
    });
};

// ============================================
// Transaction History
// ============================================

const getTransactions = async (
    db: string,
    accountId: number,
    options: { cursor?: number; limit?: number }
): Promise<TransactionHistoryResponse> => {
    const prisma = getTenantDb(db);
    const limit = Math.min(options.limit || 20, 100);

    const where: any = {
        loyaltyAccountId: accountId,
        deleted: false,
    };
    if (options.cursor) {
        where.id = { lt: options.cursor };
    }

    const [transactions, total] = await Promise.all([
        prisma.loyaltyTransaction.findMany({
            where,
            orderBy: { id: 'desc' },
            take: limit + 1, // fetch one extra for cursor
        }),
        prisma.loyaltyTransaction.count({
            where: { loyaltyAccountId: accountId, deleted: false },
        }),
    ]);

    const hasMore = transactions.length > limit;
    const results = hasMore ? transactions.slice(0, limit) : transactions;
    const nextCursor = hasMore ? results[results.length - 1].id : null;

    return {
        transactions: results.map(formatTransaction),
        total,
        cursor: nextCursor,
    };
};

// ============================================
// Tier Management (Phase 4 — Advanced only)
// ============================================

const createTier = async (db: string, data: CreateTierRequest): Promise<LoyaltyTierResponse> => {
    const prisma = getTenantDb(db);

    const tier = await prisma.loyaltyTier.create({
        data: {
            loyaltyProgramId: data.loyaltyProgramId,
            name: data.name,
            minSpend: data.minSpend,
            discountPercentage: data.discountPercentage ?? 0,
            pointsMultiplier: data.pointsMultiplier ?? 1,
            sortOrder: data.sortOrder ?? 0,
        },
    });

    invalidateProgramCache(db);

    return {
        id: tier.id,
        name: tier.name,
        minSpend: toDecimalNumber(tier.minSpend),
        discountPercentage: toDecimalNumber(tier.discountPercentage),
        pointsMultiplier: toDecimalNumber(tier.pointsMultiplier),
        sortOrder: tier.sortOrder,
    };
};

const updateTier = async (db: string, tierId: number, data: UpdateTierRequest): Promise<LoyaltyTierResponse> => {
    const prisma = getTenantDb(db);

    const tier = await prisma.loyaltyTier.update({
        where: { id: tierId },
        data: {
            ...(data.name !== undefined && { name: data.name }),
            ...(data.minSpend !== undefined && { minSpend: data.minSpend }),
            ...(data.discountPercentage !== undefined && { discountPercentage: data.discountPercentage }),
            ...(data.pointsMultiplier !== undefined && { pointsMultiplier: data.pointsMultiplier }),
            ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        },
    });

    invalidateProgramCache(db);

    return {
        id: tier.id,
        name: tier.name,
        minSpend: toDecimalNumber(tier.minSpend),
        discountPercentage: toDecimalNumber(tier.discountPercentage),
        pointsMultiplier: toDecimalNumber(tier.pointsMultiplier),
        sortOrder: tier.sortOrder,
    };
};

const deleteTier = async (db: string, tierId: number): Promise<void> => {
    const prisma = getTenantDb(db);

    await prisma.$transaction(async (tx: any) => {
        // Remove tier from all accounts that reference it
        await tx.loyaltyAccount.updateMany({
            where: { loyaltyTierId: tierId },
            data: { loyaltyTierId: null, isManualTier: false },
        });

        // Soft-delete the tier
        await tx.loyaltyTier.update({
            where: { id: tierId },
            data: { deleted: true, deletedAt: new Date() },
        });
    });

    invalidateProgramCache(db);
};

const assignTier = async (db: string, accountId: number, data: ManualTierAssignRequest): Promise<LoyaltyAccountResponse> => {
    const prisma = getTenantDb(db);

    // Audit r2-#7: reject soft-deleted tier — assigning a tombstoned tier would
    // leave the account pointing at a row that future tier listings filter out,
    // and discountPercentage from a deleted tier would still be honored at checkout.
    if (data.loyaltyTierId !== null && data.loyaltyTierId !== undefined) {
        const tier = await prisma.loyaltyTier.findFirst({
            where: { id: data.loyaltyTierId, deleted: false },
            select: { id: true },
        });
        if (!tier) throw new NotFoundError('Loyalty tier');
    }

    const updatedAccount = await prisma.loyaltyAccount.update({
        where: { id: accountId },
        data: {
            loyaltyTierId: data.loyaltyTierId,
            isManualTier: data.isManualTier,
        },
        include: {
            customer: { select: { firstName: true, lastName: true } },
            loyaltyTier: true,
        },
    });

    return {
        id: updatedAccount.id,
        customerId: updatedAccount.customerId,
        customerName: `${updatedAccount.customer.firstName} ${updatedAccount.customer.lastName}`.trim(),
        loyaltyProgramId: updatedAccount.loyaltyProgramId,
        currentPoints: toDecimalNumber(updatedAccount.currentPoints),
        totalEarned: toDecimalNumber(updatedAccount.totalEarned),
        totalRedeemed: toDecimalNumber(updatedAccount.totalRedeemed),
        totalSpend: toDecimalNumber(updatedAccount.totalSpend),
        loyaltyTier: updatedAccount.loyaltyTier ? {
            id: updatedAccount.loyaltyTier.id,
            name: updatedAccount.loyaltyTier.name,
            minSpend: toDecimalNumber(updatedAccount.loyaltyTier.minSpend),
            discountPercentage: toDecimalNumber(updatedAccount.loyaltyTier.discountPercentage),
            pointsMultiplier: toDecimalNumber(updatedAccount.loyaltyTier.pointsMultiplier),
            sortOrder: updatedAccount.loyaltyTier.sortOrder,
        } : null,
        isManualTier: updatedAccount.isManualTier,
        joinedAt: updatedAccount.joinedAt.toISOString(),
    };
};

/**
 * Auto-upgrade tier based on totalSpend (fire-and-forget, called post-transaction)
 */
const checkTierUpgrade = async (db: string, accountId: number): Promise<void> => {
    try {
        const prisma = getTenantDb(db);
        const account = await prisma.loyaltyAccount.findUnique({
            where: { id: accountId },
        });

        if (!account || account.deleted || account.isManualTier) return;

        const program = await getCachedProgram(db);
        if (!program?.tiers?.length) return;

        const totalSpend = toDecimalNumber(account.totalSpend);

        const qualifyingTier = selectHighestQualifyingTier(totalSpend, program.tiers);
        const newTierId: number | null = qualifyingTier?.id ?? null;

        // Only upgrade, never auto-downgrade
        if (newTierId && newTierId !== account.loyaltyTierId) {
            const currentTier = program.tiers.find((t: any) => t.id === account.loyaltyTierId);
            const newTier = program.tiers.find((t: any) => t.id === newTierId);
            if (!currentTier || toDecimalNumber(newTier.minSpend) > toDecimalNumber(currentTier.minSpend)) {
                await prisma.loyaltyAccount.update({
                    where: { id: accountId },
                    data: { loyaltyTierId: newTierId },
                });
            }
        }
    } catch (error) {
        // Fire-and-forget — don't fail the main transaction
        console.error('Tier auto-upgrade check failed:', error);
    }
};

// ============================================
// Tier List (standalone)
// ============================================

const getTiersByProgramId = async (db: string, programId: number): Promise<LoyaltyTierResponse[]> => {
    const prisma = getTenantDb(db);

    const tiers = await prisma.loyaltyTier.findMany({
        where: { loyaltyProgramId: programId, deleted: false },
        orderBy: { sortOrder: 'asc' },
    });

    return tiers.map((t: any) => ({
        id: t.id,
        name: t.name,
        minSpend: toDecimalNumber(t.minSpend),
        discountPercentage: toDecimalNumber(t.discountPercentage),
        pointsMultiplier: toDecimalNumber(t.pointsMultiplier),
        sortOrder: t.sortOrder,
    }));
};

// ============================================
// Expiring Points Preview
// ============================================

const getExpiringPoints = async (
    db: string,
    accountId: number,
    days: number = 30
): Promise<{ totalExpiring: number; batches: { points: number; expiresAt: string }[] }> => {
    const prisma = getTenantDb(db);

    const account = await prisma.loyaltyAccount.findUnique({
        where: { id: accountId },
    });
    if (!account || account.deleted) {
        throw new NotFoundError('Loyalty account');
    }

    const cutoffDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const batches = await prisma.loyaltyPointBatch.findMany({
        where: {
            loyaltyAccountId: accountId,
            remainingPoints: { gt: 0 },
            deleted: false,
            expiresAt: {
                not: null,
                lte: cutoffDate,
            },
        },
        orderBy: { expiresAt: 'asc' },
        select: { remainingPoints: true, expiresAt: true },
    });

    let totalExpiring = 0;
    const result = batches.map((b: any) => {
        const points = toDecimalNumber(b.remainingPoints);
        totalExpiring += points;
        return {
            points,
            expiresAt: b.expiresAt.toISOString(),
        };
    });

    return { totalExpiring, batches: result };
};

// ============================================
// Helpers
// ============================================

const formatTransaction = (t: any): LoyaltyTransactionResponse => ({
    id: t.id,
    type: t.type,
    points: toDecimalNumber(t.points),
    balanceAfter: toDecimalNumber(t.balanceAfter),
    salesId: t.salesId,
    description: t.description,
    performedBy: t.performedBy,
    createdAt: t.createdAt?.toISOString?.() ?? new Date().toISOString(),
});

export default {
    // Program
    getProgram,
    createProgram,
    updateProgram,
    // Enrollment
    enrollCustomer,
    // Account
    getAccountByCustomerId,
    // Points
    earnPoints,
    redeemPoints,
    adjustPoints,
    // History
    getTransactions,
    // Tiers (advanced)
    createTier,
    updateTier,
    deleteTier,
    assignTier,
    getTiersByProgramId,
    checkTierUpgrade,
    // Expiring points
    getExpiringPoints,
    // Cache helpers (for sales integration)
    getCachedProgram,
    toDecimalNumber,
    invalidateProgramCache,
    // Pure helpers exposed for unit testing
    __testables: {
        toDecimalNumber,
        calculateInactiveDays,
        selectHighestQualifyingTier,
        consumePointsFifo,
        formatTransaction,
    },
};
