import { PrismaClient } from '../../prisma/client/generated/client';
import { Decimal } from 'decimal.js';
import { getTenantPrisma } from '../db';
import { BusinessLogicError, NotFoundError, RequestValidateError } from '../api-helpers/error';
import cache from '../cache/simple-cache.service';
import { CreateRewardRuleRequest, UpdateRewardRuleRequest, ManualIssueVoucherRequest } from './voucher.request';

const CACHE_PREFIX = 'voucher:rules:';

const toNum = (val: any): number => {
    if (val === null || val === undefined) return 0;
    return typeof val === 'number' ? val : Number(val.toString());
};

// ============================================
// Pure helpers (exported via __testables)
// ============================================

/**
 * Compute the voucher discount amount given its type, configured values,
 * and the running cart total. FIXED is capped at totalAmount; PERCENTAGE
 * caps the computed result at totalAmount. Matches the math in
 * `validateAndRedeemVoucher` and the FE's `_applyLoyaltyDiscounts`.
 *
 * Returns Decimals so the caller can use them directly in transaction
 * writes without re-wrapping.
 */
const voucherDiscountFor = (
    discountType: string,
    discountPercentage: any,
    discountAmount: any,
    totalAmount: Decimal,
): { discountPercentage: Decimal; discountAmount: Decimal } => {
    let amount: Decimal;
    let percentage = new Decimal(0);

    if (discountType === 'PERCENTAGE') {
        percentage = new Decimal((discountPercentage ?? 0).toString());
        amount = totalAmount.times(percentage).dividedBy(100);
        if (amount.gt(totalAmount)) amount = totalAmount;
    } else {
        // FIXED
        amount = new Decimal((discountAmount ?? 0).toString());
        if (amount.gt(totalAmount)) amount = totalAmount;
    }

    return { discountPercentage: percentage, discountAmount: amount };
};

/**
 * Decide the post-void status of a previously-REDEEMED voucher. Returns
 * 'ACTIVE' if the voucher hasn't reached its expiry yet — the customer
 * gets it back; 'EXPIRED' otherwise (per docs §8.4 FAQ).
 */
const shouldRestoreVoucher = (expiresAt: Date, now: Date): 'ACTIVE' | 'EXPIRED' => {
    return expiresAt.getTime() > now.getTime() ? 'ACTIVE' : 'EXPIRED';
};

/**
 * For a repeatable SPEND_MILESTONE rule, how many voucher issuances does
 * the given totalSpend warrant? floor(totalSpend / threshold). Caller
 * subtracts existingCount to decide how many vouchers to mint. Backs
 * docs §2 "isRepeatable: true → voucher issued every time the threshold
 * is crossed".
 */
const expectedRepeatableVoucherCount = (
    totalSpend: Decimal,
    threshold: Decimal,
): number => {
    if (threshold.lte(0)) return 0;
    return Math.floor(totalSpend.dividedBy(threshold).toNumber());
};

/**
 * Format the human-readable voucher label that appears at checkout.
 * Backs the "Spend RM 1,000 Reward — 10% off" formatting documented in
 * §2 Reward Rules.
 */
const formatVoucherLabel = (
    ruleName: string,
    discountType: string,
    discountPercentage?: any,
    discountAmount?: any,
): string => {
    const discountLabel = discountType === 'PERCENTAGE'
        ? `${toNum(discountPercentage)}% off`
        : `RM ${toNum(discountAmount)} off`;
    return `${ruleName} — ${discountLabel}`;
};

// ============================================
// Reward Rule Caching
// ============================================

const getCachedRewardRules = async (db: string) => {
    const cacheKey = CACHE_PREFIX + db;
    const cached = cache.get(cacheKey);
    if (cached) return cached as any[];

    const prisma = getTenantPrisma(db);
    const rules = await prisma.rewardRule.findMany({
        where: { deleted: false, isActive: true },
        orderBy: { spendThreshold: 'asc' },
    });

    cache.set(cacheKey, rules);
    return rules;
};

const invalidateRulesCache = (db: string) => {
    cache.delete(CACHE_PREFIX + db);
};

// ============================================
// Reward Rule CRUD
// ============================================

const getRewardRules = async (db: string) => {
    const prisma = getTenantPrisma(db);
    const rules = await prisma.rewardRule.findMany({
        where: { deleted: false },
        orderBy: { spendThreshold: 'asc' },
    });
    return rules.map(formatRule);
};

const createRewardRule = async (db: string, data: CreateRewardRuleRequest) => {
    validateRuleDiscountFields(data.discountType, data.discountPercentage, data.discountAmount);
    if (!data.spendThreshold || data.spendThreshold <= 0) {
        throw new RequestValidateError('spendThreshold must be greater than 0');
    }
    if (!data.expiryDays || data.expiryDays <= 0) {
        throw new RequestValidateError('expiryDays must be greater than 0');
    }

    const prisma = getTenantPrisma(db);
    const rule = await prisma.rewardRule.create({
        data: {
            name: data.name,
            spendThreshold: data.spendThreshold,
            isRepeatable: data.isRepeatable ?? false,
            discountType: data.discountType,
            discountPercentage: data.discountPercentage ?? null,
            discountAmount: data.discountAmount ?? null,
            expiryDays: data.expiryDays,
            minPurchaseAmount: data.minPurchaseAmount ?? null,
        },
    });

    invalidateRulesCache(db);
    return formatRule(rule);
};

const updateRewardRule = async (db: string, ruleId: number, data: UpdateRewardRuleRequest) => {
    const prisma = getTenantPrisma(db);
    const existing = await prisma.rewardRule.findFirst({
        where: { id: ruleId, deleted: false },
    });
    if (!existing) throw new NotFoundError('RewardRule');

    // Validate discount fields if either discountType or discount values are being updated
    const effectiveType = data.discountType ?? existing.discountType;
    const effectivePercentage = data.discountPercentage !== undefined ? data.discountPercentage : toNum(existing.discountPercentage);
    const effectiveAmount = data.discountAmount !== undefined ? data.discountAmount : toNum(existing.discountAmount);
    if (data.discountType || data.discountPercentage !== undefined || data.discountAmount !== undefined) {
        validateRuleDiscountFields(effectiveType, effectivePercentage || undefined, effectiveAmount || undefined);
    }

    if (data.spendThreshold !== undefined && data.spendThreshold <= 0) {
        throw new RequestValidateError('spendThreshold must be greater than 0');
    }
    if (data.expiryDays !== undefined && data.expiryDays <= 0) {
        throw new RequestValidateError('expiryDays must be greater than 0');
    }

    const rule = await prisma.rewardRule.update({
        where: { id: ruleId },
        data: {
            ...(data.name !== undefined && { name: data.name }),
            ...(data.spendThreshold !== undefined && { spendThreshold: data.spendThreshold }),
            ...(data.isRepeatable !== undefined && { isRepeatable: data.isRepeatable }),
            ...(data.discountType !== undefined && { discountType: data.discountType }),
            ...(data.discountPercentage !== undefined && { discountPercentage: data.discountPercentage }),
            ...(data.discountAmount !== undefined && { discountAmount: data.discountAmount }),
            ...(data.expiryDays !== undefined && { expiryDays: data.expiryDays }),
            ...(data.minPurchaseAmount !== undefined && { minPurchaseAmount: data.minPurchaseAmount }),
            ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
    });

    invalidateRulesCache(db);
    return formatRule(rule);
};

const deleteRewardRule = async (db: string, ruleId: number) => {
    const prisma = getTenantPrisma(db);
    const existing = await prisma.rewardRule.findFirst({
        where: { id: ruleId, deleted: false },
    });
    if (!existing) throw new NotFoundError('RewardRule');

    await prisma.rewardRule.update({
        where: { id: ruleId },
        data: { deleted: true, deletedAt: new Date() },
    });

    invalidateRulesCache(db);
};

// ============================================
// Voucher Listing
// ============================================

const getVouchersByCustomerId = async (db: string, customerId: number, status?: string) => {
    const prisma = getTenantPrisma(db);

    const isActiveOnly = !status || status === 'ACTIVE';

    const vouchers = await prisma.voucher.findMany({
        where: {
            customerId,
            deleted: false,
            ...(isActiveOnly ? {
                status: 'ACTIVE',
                expiresAt: { gt: new Date() },
            } : {}),
        },
        orderBy: { createdAt: 'desc' },
    });

    return vouchers;
};

// ============================================
// Manual Voucher Issuance
// ============================================

const issueVoucher = async (db: string, data: ManualIssueVoucherRequest) => {
    validateRuleDiscountFields(data.discountType, data.discountPercentage, data.discountAmount);

    const prisma = getTenantPrisma(db);

    // Verify customer exists
    const customer = await prisma.customer.findFirst({
        where: { id: data.customerId, deleted: false },
    });
    if (!customer) throw new NotFoundError('Customer');

    // Try to find loyalty account (optional for manual issuance)
    const account = await prisma.loyaltyAccount.findFirst({
        where: { customerId: data.customerId, deleted: false },
    });

    const expiresAt = new Date(Date.now() + data.expiryDays * 24 * 60 * 60 * 1000);

    const voucher = await prisma.voucher.create({
        data: {
            rewardRuleId: null,
            customerId: data.customerId,
            loyaltyAccountId: account?.id ?? null,
            discountType: data.discountType,
            discountPercentage: data.discountPercentage ?? null,
            discountAmount: data.discountAmount ?? null,
            minPurchaseAmount: data.minPurchaseAmount ?? null,
            status: 'ACTIVE',
            milestoneSpendSnapshot: null,
            label: data.label,
            expiresAt,
        },
    });

    return voucher;
};

// ============================================
// Voucher Validation (for sale redemption)
// ============================================

const validateAndRedeemVoucher = async (
    tx: any,
    voucherId: number,
    customerId: number,
    salesId: number,
    totalAmount: Decimal,
    sentDiscountPercentage?: number,
    sentDiscountAmount?: number,
): Promise<{
    voucherId: number;
    voucherDiscountPercentage: Decimal;
    voucherDiscountAmount: Decimal;
}> => {
    const voucher = await tx.voucher.findFirst({
        where: { id: voucherId, deleted: false },
    });

    if (!voucher) throw new NotFoundError('Voucher');
    if (voucher.status !== 'ACTIVE') throw new BusinessLogicError('Voucher is not active');
    if (voucher.expiresAt <= new Date()) throw new BusinessLogicError('Voucher has expired');
    if (voucher.customerId !== customerId) throw new BusinessLogicError('Voucher does not belong to this customer');

    if (voucher.minPurchaseAmount) {
        const minAmount = new Decimal(voucher.minPurchaseAmount.toString());
        if (totalAmount.lt(minAmount)) {
            throw new BusinessLogicError(`Minimum purchase amount of ${minAmount} not met`);
        }
    }

    // Validate discount amount matches voucher
    const { discountPercentage: expectedPercentage, discountAmount: expectedAmount } =
        voucherDiscountFor(
            voucher.discountType,
            voucher.discountPercentage,
            voucher.discountAmount,
            totalAmount,
        );

    // Cross-validate percentage for PERCENTAGE vouchers
    if (voucher.discountType === 'PERCENTAGE' &&
        sentDiscountPercentage !== undefined && sentDiscountPercentage !== null) {
        if (Math.abs(sentDiscountPercentage - expectedPercentage.toNumber()) > 0.01) {
            throw new BusinessLogicError(
                `Voucher discount percentage mismatch: sent ${sentDiscountPercentage}%, expected ${expectedPercentage}%`
            );
        }
    }

    // Validate sent amount matches expected (allow small rounding tolerance)
    if (sentDiscountAmount !== undefined && sentDiscountAmount !== null) {
        const sentDec = new Decimal(sentDiscountAmount);
        if (sentDec.minus(expectedAmount).abs().gt(0.01)) {
            throw new BusinessLogicError(
                `Voucher discount amount mismatch: sent ${sentDec}, expected ${expectedAmount}`
            );
        }
    }

    // Atomic test-and-set: only flip ACTIVE → REDEEMED. Concurrent sales for the same
    // voucher each enter this block, but only the first updateMany matches; the second
    // sees count === 0 because status is now REDEEMED.
    const redeemResult = await tx.voucher.updateMany({
        where: { id: voucherId, status: 'ACTIVE', deleted: false },
        data: {
            status: 'REDEEMED',
            redeemedAt: new Date(),
            redeemedInSalesId: salesId,
        },
    });
    if (redeemResult.count !== 1) {
        throw new BusinessLogicError('Voucher was already redeemed by another sale');
    }

    return {
        voucherId: voucher.id,
        voucherDiscountPercentage: expectedPercentage,
        voucherDiscountAmount: expectedAmount,
    };
};

// ============================================
// Voucher Restoration (on void/return/refund)
// ============================================

const restoreVoucherForSale = async (tx: any, saleId: number) => {
    const voucher = await tx.voucher.findFirst({
        where: { redeemedInSalesId: saleId, deleted: false },
    });

    if (!voucher || voucher.status !== 'REDEEMED') return;

    const newStatus = shouldRestoreVoucher(voucher.expiresAt, new Date());
    if (newStatus === 'ACTIVE') {
        await tx.voucher.update({
            where: { id: voucher.id },
            data: {
                status: 'ACTIVE',
                redeemedAt: null,
                redeemedInSalesId: null,
            },
        });
    } else {
        await tx.voucher.update({
            where: { id: voucher.id },
            data: {
                status: 'EXPIRED',
                redeemedInSalesId: null,
            },
        });
    }
};

// ============================================
// Milestone Check (auto-issuance after sale)
// ============================================

const checkMilestones = async (db: string, customerId: number) => {
    const prisma = getTenantPrisma(db);

    // Fresh read of account (this runs post-transaction via setImmediate)
    const account = await prisma.loyaltyAccount.findFirst({
        where: { customerId, deleted: false },
    });
    if (!account) return;

    const totalSpend = new Decimal(account.totalSpend.toString());
    const rules = await getCachedRewardRules(db);

    for (const rule of rules) {
        if (rule.triggerType !== 'SPEND_MILESTONE') continue;

        const threshold = new Decimal(rule.spendThreshold.toString());

        // Audit r2-#5: count must INCLUDE soft-deleted vouchers — an admin who revoked
        // a milestone voucher must not cause a re-issue. Without this, deleting a
        // legitimately-earned voucher silently grants another one.
        // Audit r2-#4: per-issuance work is wrapped in a transaction that re-counts and
        // inserts only if still short — concurrent setImmediate callbacks dedupe themselves.
        if (!rule.isRepeatable) {
            const issuedOnce = await issueIfMissing(
                prisma, rule, customerId, account.id, totalSpend, threshold, 1,
            );
            if (!issuedOnce) continue;
        } else {
            const expectedCount = expectedRepeatableVoucherCount(totalSpend, threshold);
            // Loop attempts, each idempotent. The first call that loses the race
            // returns false, breaking the loop.
            for (let i = 1; i <= expectedCount; i++) {
                const issued = await issueIfMissing(
                    prisma, rule, customerId, account.id, totalSpend, threshold, i,
                );
                if (!issued) continue; // skip and try next slot — already exists
            }
        }
    }
};

/**
 * Atomic-by-transaction milestone issuance. Re-counts inside the tx; only issues
 * if existing count (including soft-deleted) is still below the target slot.
 * Returns true when a new voucher was inserted, false when the slot was already
 * filled by a concurrent caller.
 */
const issueIfMissing = async (
    prisma: PrismaClient,
    rule: any,
    customerId: number,
    loyaltyAccountId: number,
    totalSpend: Decimal,
    threshold: Decimal,
    targetSlot: number,
): Promise<boolean> => {
    if (totalSpend.lt(threshold.times(targetSlot))) return false;
    return await prisma.$transaction(async (tx: any) => {
        const existingCount = await tx.voucher.count({
            where: { customerId, rewardRuleId: rule.id },
        });
        if (existingCount >= targetSlot) return false;
        await issueVoucherFromRule(tx, rule, customerId, loyaltyAccountId, totalSpend);
        return true;
    });
};

// ============================================
// Helpers
// ============================================

const issueVoucherFromRule = async (
    prisma: PrismaClient | any, // accepts $transaction tx client too
    rule: any,
    customerId: number,
    loyaltyAccountId: number,
    totalSpend: Decimal,
) => {
    const expiresAt = new Date(Date.now() + rule.expiryDays * 24 * 60 * 60 * 1000);
    const label = formatVoucherLabel(
        rule.name,
        rule.discountType,
        rule.discountPercentage,
        rule.discountAmount,
    );

    await prisma.voucher.create({
        data: {
            rewardRuleId: rule.id,
            customerId,
            loyaltyAccountId,
            discountType: rule.discountType,
            discountPercentage: rule.discountPercentage,
            discountAmount: rule.discountAmount,
            minPurchaseAmount: rule.minPurchaseAmount,
            status: 'ACTIVE',
            milestoneSpendSnapshot: totalSpend.toNumber(),
            label,
            expiresAt,
        },
    });
};

const validateRuleDiscountFields = (
    discountType: string,
    discountPercentage?: number,
    discountAmount?: number,
) => {
    if (discountType === 'PERCENTAGE') {
        if (!discountPercentage || discountPercentage <= 0 || discountPercentage > 100) {
            throw new RequestValidateError('discountPercentage must be between 1 and 100 for PERCENTAGE type');
        }
    } else if (discountType === 'FIXED') {
        if (!discountAmount || discountAmount <= 0) {
            throw new RequestValidateError('discountAmount must be greater than 0 for FIXED type');
        }
    } else {
        throw new RequestValidateError('discountType must be PERCENTAGE or FIXED');
    }
};

const formatRule = (rule: any) => ({
    id: rule.id,
    name: rule.name,
    triggerType: rule.triggerType,
    spendThreshold: toNum(rule.spendThreshold),
    isRepeatable: rule.isRepeatable,
    discountType: rule.discountType,
    discountPercentage: rule.discountPercentage ? toNum(rule.discountPercentage) : null,
    discountAmount: rule.discountAmount ? toNum(rule.discountAmount) : null,
    expiryDays: rule.expiryDays,
    minPurchaseAmount: rule.minPurchaseAmount ? toNum(rule.minPurchaseAmount) : null,
    isActive: rule.isActive,
    createdAt: rule.createdAt?.toISOString?.() ?? new Date().toISOString(),
    updatedAt: rule.updatedAt?.toISOString?.() ?? new Date().toISOString(),
});

export default {
    // Rule CRUD
    getRewardRules,
    createRewardRule,
    updateRewardRule,
    deleteRewardRule,
    // Voucher listing
    getVouchersByCustomerId,
    // Manual issuance
    issueVoucher,
    // Sales integration
    validateAndRedeemVoucher,
    restoreVoucherForSale,
    // Milestone check
    checkMilestones,
    // Cache helpers
    getCachedRewardRules,
    invalidateRulesCache,
    // Pure helpers exposed for unit testing
    __testables: {
        toNum,
        voucherDiscountFor,
        shouldRestoreVoucher,
        expectedRepeatableVoucherCount,
        formatVoucherLabel,
        validateRuleDiscountFields,
        formatRule,
    },
};
