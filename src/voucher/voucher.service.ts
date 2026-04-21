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
    let expectedAmount: Decimal;
    let expectedPercentage = new Decimal(0);

    if (voucher.discountType === 'PERCENTAGE') {
        expectedPercentage = new Decimal(voucher.discountPercentage.toString());
        expectedAmount = totalAmount.times(expectedPercentage).dividedBy(100);
        // Cap at totalAmount
        if (expectedAmount.gt(totalAmount)) expectedAmount = totalAmount;

        // Cross-validate percentage
        if (sentDiscountPercentage !== undefined && sentDiscountPercentage !== null) {
            if (Math.abs(sentDiscountPercentage - expectedPercentage.toNumber()) > 0.01) {
                throw new BusinessLogicError(
                    `Voucher discount percentage mismatch: sent ${sentDiscountPercentage}%, expected ${expectedPercentage}%`
                );
            }
        }
    } else {
        // FIXED
        expectedAmount = new Decimal(voucher.discountAmount.toString());
        // Cap at totalAmount
        if (expectedAmount.gt(totalAmount)) expectedAmount = totalAmount;
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

    // Mark voucher as redeemed
    await tx.voucher.update({
        where: { id: voucherId },
        data: {
            status: 'REDEEMED',
            redeemedAt: new Date(),
            redeemedInSalesId: salesId,
        },
    });

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

    if (voucher.expiresAt > new Date()) {
        // Not expired — restore to ACTIVE
        await tx.voucher.update({
            where: { id: voucher.id },
            data: {
                status: 'ACTIVE',
                redeemedAt: null,
                redeemedInSalesId: null,
            },
        });
    } else {
        // Expired — set to EXPIRED, clear sales link
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

        if (!rule.isRepeatable) {
            // Non-repeatable: check if customer already has a voucher from this rule
            const existing = await prisma.voucher.findFirst({
                where: { customerId, rewardRuleId: rule.id, deleted: false },
            });
            if (existing) continue;

            if (totalSpend.gte(threshold)) {
                await issueVoucherFromRule(prisma, rule, customerId, account.id, totalSpend);
            }
        } else {
            // Repeatable: calculate expected count vs existing count
            const existingCount = await prisma.voucher.count({
                where: { customerId, rewardRuleId: rule.id, deleted: false },
            });
            const expectedCount = Math.floor(totalSpend.dividedBy(threshold).toNumber());

            if (expectedCount > existingCount) {
                const toIssue = expectedCount - existingCount;
                for (let i = 0; i < toIssue; i++) {
                    await issueVoucherFromRule(prisma, rule, customerId, account.id, totalSpend);
                }
            }
        }
    }
};

// ============================================
// Helpers
// ============================================

const issueVoucherFromRule = async (
    prisma: PrismaClient,
    rule: any,
    customerId: number,
    loyaltyAccountId: number,
    totalSpend: Decimal,
) => {
    const expiresAt = new Date(Date.now() + rule.expiryDays * 24 * 60 * 60 * 1000);

    const discountLabel = rule.discountType === 'PERCENTAGE'
        ? `${toNum(rule.discountPercentage)}% off`
        : `RM ${toNum(rule.discountAmount)} off`;

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
            label: `${rule.name} — ${discountLabel}`,
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
};
