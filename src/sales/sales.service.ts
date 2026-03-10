import { Payment, Prisma, PrismaClient, Sales, SalesItem, StockBalance, StockMovement } from "../../prisma/client/generated/client"
import { Decimal } from 'decimal.js';
import { BusinessLogicError, NotFoundError, InsufficientPointsError, TierMismatchError, SubscriptionExpiredError } from "../api-helpers/error"
import { SalesRequestBody, SalesCreationRequest, CreateSalesRequest, CalculateSalesObject, CalculateSalesItemObject, DiscountBy, DiscountType, CalculateSalesDto } from "./sales.request"
import { getTenantPrisma } from '../db';
import { SyncRequest } from "src/item/item.request";
import PushyService from '../pushy/pushy.service';
import { randomUUID } from 'crypto';
import {
    NotificationMessages,
    formatOutOfStockMessage,
    formatLowStockMessage,
    getOutOfStockTitle,
    getLowStockTitle
} from '../pushy/notification-messages';
import loyaltyService from '../loyalty/loyalty.service';

// Helper: calculate effective stock quantity for deduction/restoration
// For consumption items: quantity * stockConsumptionQty (e.g., 3 orders × 50ml = 150ml)
// For piece-based items (null): quantity as-is (e.g., 3 pieces)
function getEffectiveStockQty(
    quantity: Decimal,
    stockConsumptionQty?: { toString(): string } | null
): Decimal {
    if (stockConsumptionQty != null) {
        return quantity.times(new Decimal(stockConsumptionQty.toString()));
    }
    return quantity;
}

// Extended performedBy with loyaltyTier for loyalty integration
interface PerformedBy {
    userId: number;
    username: string;
    loyaltyTier?: 'none' | 'basic' | 'advanced';
}

// Helper function to send sales notifications (non-blocking)
async function sendSalesNotification(
    tenantId: number,
    outletId: number,
    title: string,
    message: string,
    data: any
): Promise<void> {
    const notificationPayload = {
        title,
        message,
        data: {
            notificationId: randomUUID(),
            type: 'SALES',
            tenantId,
            timestamp: new Date().toISOString(),
            ...data
        }
    };

    // Fire and forget - don't wait for notification to complete
    PushyService.sendToTopic(
        `tenant_${tenantId}_outlet_${outletId}_sales`,
        notificationPayload,
        tenantId
    ).catch(error => {
        // Log error but don't fail the sale transaction
        console.error('Failed to send sales notification:', error);
    });
}

// Helper function to send inventory notifications (non-blocking)
async function sendInventoryNotification(
    tenantId: number,
    outletId: number,
    title: string,
    message: string,
    data: any
): Promise<void> {
    const notificationPayload = {
        title,
        message,
        data: {
            notificationId: randomUUID(),
            type: 'INVENTORY',
            tenantId,
            timestamp: new Date().toISOString(),
            ...data
        }
    };

    // Fire and forget - don't wait for notification to complete
    PushyService.sendToTopic(
        `tenant_${tenantId}_outlet_${outletId}_inventory`,
        notificationPayload,
        tenantId
    ).catch(error => {
        // Log error but don't fail the transaction
        console.error('Failed to send inventory notification:', error);
    });
}

// ============================================
// Loyalty Integration Helpers
// ============================================

/**
 * Process loyalty earn/redeem/subscription within a sales transaction.
 * Called inside $transaction for completeNewSales when status = "Completed".
 * Returns loyalty data to store on the Sales record.
 */
async function processLoyaltyForSale(
    tx: any,
    db: string,
    salesId: number,
    customerId: number,
    totalAmount: Decimal,
    salesBody: CreateSalesRequest,
    performedBy: PerformedBy
): Promise<{
    loyaltyPointsEarned: Decimal;
    loyaltyPointsRedeemed: Decimal;
    loyaltyPointsRedemptionValue: Decimal;
    loyaltyTierDiscountPercent: Decimal;
    loyaltyTierDiscountAmount: Decimal;
    customerSubscriptionId: number | null;
    subscriptionDiscountAmount: Decimal;
    loyaltyAccountId: number | null;
}> {
    const zero = new Decimal(0);
    const result = {
        loyaltyPointsEarned: zero,
        loyaltyPointsRedeemed: zero,
        loyaltyPointsRedemptionValue: zero,
        loyaltyTierDiscountPercent: zero,
        loyaltyTierDiscountAmount: zero,
        customerSubscriptionId: null as number | null,
        subscriptionDiscountAmount: zero,
        loyaltyAccountId: null as number | null,
    };

    // Find loyalty account for this customer
    const account = await tx.loyaltyAccount.findFirst({
        where: { customerId, deleted: false },
        include: performedBy.loyaltyTier === 'advanced' ? { loyaltyTier: true } : undefined,
    });

    if (!account) return result; // Customer not enrolled — skip loyalty entirely
    result.loyaltyAccountId = account.id;

    const program = await loyaltyService.getCachedProgram(db);
    if (!program || !program.isActive) return result;

    const toNum = loyaltyService.toDecimalNumber;

    // 1. VALIDATE tier discount (advanced only)
    if (performedBy.loyaltyTier === 'advanced' && salesBody.loyaltyTierDiscountPercentage && salesBody.loyaltyTierDiscountPercentage > 0) {
        const tier = (account as any).loyaltyTier;
        if (!tier || toNum(tier.discountPercentage) !== salesBody.loyaltyTierDiscountPercentage) {
            throw new TierMismatchError(
                `Tier discount mismatch: requested ${salesBody.loyaltyTierDiscountPercentage}%, actual ${tier ? toNum(tier.discountPercentage) : 0}%`
            );
        }
        result.loyaltyTierDiscountPercent = new Decimal(salesBody.loyaltyTierDiscountPercentage);
        result.loyaltyTierDiscountAmount = new Decimal(salesBody.loyaltyTierDiscountAmount || 0);
    }

    // 2. VALIDATE + EXECUTE point redemption
    const pointsToRedeem = salesBody.loyaltyPointsToRedeem || 0;
    if (pointsToRedeem > 0) {
        const currentPoints = toNum(account.currentPoints);
        if (currentPoints < pointsToRedeem) {
            throw new InsufficientPointsError(currentPoints, pointsToRedeem);
        }

        const minRedeem = toNum(program.minRedeemPoints);
        if (pointsToRedeem < minRedeem) {
            throw new BusinessLogicError(`Minimum redemption is ${minRedeem} points`);
        }

        // FIFO deduction from point batches
        let remaining = pointsToRedeem;
        const batches = await tx.loyaltyPointBatch.findMany({
            where: {
                loyaltyAccountId: account.id,
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
            const batchRemaining = toNum(batch.remainingPoints);
            const deduct = Math.min(remaining, batchRemaining);
            await tx.loyaltyPointBatch.update({
                where: { id: batch.id },
                data: { remainingPoints: batchRemaining - deduct },
            });
            remaining -= deduct;
        }

        // Update account totals
        await tx.loyaltyAccount.update({
            where: { id: account.id },
            data: {
                currentPoints: { decrement: pointsToRedeem },
                totalRedeemed: { increment: pointsToRedeem },
            },
        });

        const updatedAccount = await tx.loyaltyAccount.findUnique({ where: { id: account.id } });
        const newBalance = toNum(updatedAccount.currentPoints);

        // Create REDEEM transaction
        await tx.loyaltyTransaction.create({
            data: {
                loyaltyAccountId: account.id,
                type: 'REDEEM',
                points: -pointsToRedeem,
                balanceAfter: newBalance,
                salesId,
                description: `Redeemed in sale #${salesId}`,
                performedBy: performedBy.username,
            },
        });

        result.loyaltyPointsRedeemed = new Decimal(pointsToRedeem);
        result.loyaltyPointsRedemptionValue = new Decimal(salesBody.loyaltyPointsRedemptionValue || 0);
    }

    // 3. VALIDATE + EXECUTE subscription usage (advanced only)
    if (performedBy.loyaltyTier === 'advanced' && salesBody.customerSubscriptionId) {
        const subscription = await tx.customerSubscription.findUnique({
            where: { id: salesBody.customerSubscriptionId },
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
            throw new BusinessLogicError('Customer subscription not found');
        }
        if (subscription.status !== 'ACTIVE') {
            throw new SubscriptionExpiredError();
        }
        if (subscription.customerId !== customerId) {
            throw new BusinessLogicError('Subscription does not belong to this customer');
        }

        const quantityUsed = salesBody.subscriptionQuantityUsed || 1;

        // For USAGE packages, check and deduct quota
        if (subscription.subscriptionPackage.packageType === 'USAGE') {
            if (subscription.remainingQuota === null || subscription.remainingQuota < quantityUsed) {
                throw new BusinessLogicError(
                    `Insufficient subscription quota. Remaining: ${subscription.remainingQuota ?? 0}`
                );
            }

            await tx.customerSubscription.update({
                where: { id: subscription.id, version: subscription.version },
                data: {
                    remainingQuota: { decrement: quantityUsed },
                    usedQuota: { increment: quantityUsed },
                    version: { increment: 1 },
                },
            });

            // Check if quota depleted
            if ((subscription.remainingQuota - quantityUsed) <= 0) {
                await tx.customerSubscription.update({
                    where: { id: subscription.id },
                    data: { status: 'EXPIRED' },
                });
            }
        } else {
            // TIME package — just track usage
            await tx.customerSubscription.update({
                where: { id: subscription.id },
                data: {
                    usedQuota: { increment: quantityUsed },
                    version: { increment: 1 },
                },
            });
        }

        // Create usage record
        await tx.subscriptionUsage.create({
            data: {
                customerSubscriptionId: subscription.id,
                salesId,
                quantityUsed,
                remainingAfter: subscription.subscriptionPackage.packageType === 'USAGE'
                    ? (subscription.remainingQuota ?? 0) - quantityUsed
                    : -1,
                performedBy: performedBy.username,
            },
        });

        result.customerSubscriptionId = subscription.id;
        result.subscriptionDiscountAmount = new Decimal(salesBody.subscriptionDiscountAmount || 0);
    }

    // 4. EARN points on finalTotalAmount (after ALL discounts)
    if (totalAmount.gt(0)) {
        let pointsMultiplier = 1.0;
        if (performedBy.loyaltyTier === 'advanced' && (account as any).loyaltyTier) {
            pointsMultiplier = toNum((account as any).loyaltyTier.pointsMultiplier);
        }
        const pointsEarned = totalAmount.toNumber() * toNum(program.pointsPerCurrency) * pointsMultiplier;

        if (pointsEarned > 0) {
            const expiresAt = program.pointsExpiryDays
                ? new Date(Date.now() + program.pointsExpiryDays * 24 * 60 * 60 * 1000)
                : null;

            // Create point batch
            await tx.loyaltyPointBatch.create({
                data: {
                    loyaltyAccountId: account.id,
                    originalPoints: pointsEarned,
                    remainingPoints: pointsEarned,
                    expiresAt,
                    salesId,
                },
            });

            // Update account totals
            await tx.loyaltyAccount.update({
                where: { id: account.id },
                data: {
                    currentPoints: { increment: pointsEarned },
                    totalEarned: { increment: pointsEarned },
                    totalSpend: { increment: totalAmount.toNumber() },
                },
            });

            const finalAccount = await tx.loyaltyAccount.findUnique({ where: { id: account.id } });
            const finalBalance = toNum(finalAccount.currentPoints);

            // Create EARN transaction
            await tx.loyaltyTransaction.create({
                data: {
                    loyaltyAccountId: account.id,
                    type: 'EARN',
                    points: pointsEarned,
                    balanceAfter: finalBalance,
                    salesId,
                    description: `Earned from sale #${salesId}`,
                    performedBy: performedBy.username,
                },
            });

            result.loyaltyPointsEarned = new Decimal(pointsEarned);
        }
    }

    return result;
}

/**
 * Reverse loyalty operations when a sale is voided/returned/refunded.
 * Called inside $transaction for void/return/refund.
 */
async function reverseLoyaltyForSale(
    tx: any,
    sale: any,
    performedBy: PerformedBy
): Promise<void> {
    if (!sale.customerId) return;

    const toNum = loyaltyService.toDecimalNumber;

    // Find loyalty account
    const account = await tx.loyaltyAccount.findFirst({
        where: { customerId: sale.customerId, deleted: false },
    });
    if (!account) return;

    // 1. Reverse EARNED points
    const pointsEarned = sale.loyaltyPointsEarned ? new Decimal(sale.loyaltyPointsEarned).toNumber() : 0;
    if (pointsEarned > 0) {
        // Find the point batch for this sale and deduct
        const earnBatch = await tx.loyaltyPointBatch.findFirst({
            where: { loyaltyAccountId: account.id, salesId: sale.id, deleted: false },
        });

        if (earnBatch) {
            const remainingInBatch = toNum(earnBatch.remainingPoints);
            // Deduct remaining (may be less than original if partially spent)
            await tx.loyaltyPointBatch.update({
                where: { id: earnBatch.id },
                data: { remainingPoints: 0, deleted: true, deletedAt: new Date() },
            });

            // Decrement account.currentPoints by whatever was still remaining
            await tx.loyaltyAccount.update({
                where: { id: account.id },
                data: {
                    currentPoints: { decrement: Math.max(remainingInBatch, 0) },
                    totalSpend: { decrement: new Decimal(sale.totalAmount).toNumber() },
                },
            });
        }

        const updatedAccount = await tx.loyaltyAccount.findUnique({ where: { id: account.id } });

        // Create EARN_REVERSAL transaction (idempotent check)
        const existingReversal = await tx.loyaltyTransaction.findFirst({
            where: { salesId: sale.id, type: 'EARN_REVERSAL', deleted: false },
        });
        if (!existingReversal) {
            await tx.loyaltyTransaction.create({
                data: {
                    loyaltyAccountId: account.id,
                    type: 'EARN_REVERSAL',
                    points: -pointsEarned,
                    balanceAfter: toNum(updatedAccount?.currentPoints ?? 0),
                    salesId: sale.id,
                    description: `Earn reversed for sale #${sale.id}`,
                    performedBy: performedBy.username,
                },
            });
        }
    }

    // 2. Restore REDEEMED points
    const pointsRedeemed = sale.loyaltyPointsRedeemed ? new Decimal(sale.loyaltyPointsRedeemed).toNumber() : 0;
    if (pointsRedeemed > 0) {
        // Create a NEW point batch for restored points (no expiry — restored points don't expire)
        await tx.loyaltyPointBatch.create({
            data: {
                loyaltyAccountId: account.id,
                originalPoints: pointsRedeemed,
                remainingPoints: pointsRedeemed,
                expiresAt: null,
            },
        });

        // Increment account.currentPoints
        await tx.loyaltyAccount.update({
            where: { id: account.id },
            data: {
                currentPoints: { increment: pointsRedeemed },
            },
        });

        const updatedAccount2 = await tx.loyaltyAccount.findUnique({ where: { id: account.id } });

        // Create REDEEM_REVERSAL transaction (idempotent check)
        const existingRedeemReversal = await tx.loyaltyTransaction.findFirst({
            where: { salesId: sale.id, type: 'REDEEM_REVERSAL', deleted: false },
        });
        if (!existingRedeemReversal) {
            await tx.loyaltyTransaction.create({
                data: {
                    loyaltyAccountId: account.id,
                    type: 'REDEEM_REVERSAL',
                    points: pointsRedeemed,
                    balanceAfter: toNum(updatedAccount2?.currentPoints ?? 0),
                    salesId: sale.id,
                    description: `Redeem restored for sale #${sale.id}`,
                    performedBy: performedBy.username,
                },
            });
        }
    }

    // 3. Restore subscription quota (advanced only)
    if (sale.customerSubscriptionId) {
        const subscription = await tx.customerSubscription.findUnique({
            where: { id: sale.customerSubscriptionId },
            include: { subscriptionPackage: true },
        });

        if (subscription && subscription.subscriptionPackage.packageType === 'USAGE') {
            // Find original usage record to get quantity
            const usageRecord = await tx.subscriptionUsage.findFirst({
                where: { salesId: sale.id, customerSubscriptionId: subscription.id, deleted: false },
            });
            const quantityToRestore = usageRecord?.quantityUsed ?? 1;

            await tx.customerSubscription.update({
                where: { id: subscription.id },
                data: {
                    remainingQuota: { increment: quantityToRestore },
                    usedQuota: { decrement: quantityToRestore },
                    ...(subscription.status === 'EXPIRED' ? { status: 'ACTIVE' } : {}),
                },
            });

            // Create negative usage record for audit
            if (usageRecord) {
                await tx.subscriptionUsage.update({
                    where: { id: usageRecord.id },
                    data: { deleted: true, deletedAt: new Date() },
                });
            }
        }
    }
}

let getAll = async (databaseName: string, request: SyncRequest) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { outletId, skip = 0, take = 100, lastSyncTimestamp } = request;

    try {
        // Parse last sync timestamp with optimization for null/first sync
        let lastSync: Date;

        if (lastSyncTimestamp && lastSyncTimestamp !== 'null') {
            lastSync = new Date(lastSyncTimestamp);
        } else {
            // Option 1: Limit to recent data (e.g., last 30 days) for first sync
            // const daysBack = 30;
            // lastSync = new Date();
            // lastSync.setDate(lastSync.getDate() - daysBack);

            // Option 2: Or use current business date only
            lastSync = new Date();
            lastSync.setHours(0, 0, 0, 0); // Start of today
        }

        // Ensure outletId is a number
        const parsedOutletId = typeof outletId === 'string' ? parseInt(outletId, 10) : outletId;

        // Build query conditions
        const where = {
            outletId: parsedOutletId,
            deleted: false,
            OR: [
                { createdAt: { gte: lastSync } },
                { updatedAt: { gte: lastSync } }
            ],
        };

        // Count total records
        const total = await tenantPrisma.sales.count({ where });

        const salesArray = await tenantPrisma.sales.findMany({
            where,
            select: {
                id: true,
                businessDate: true,
                salesType: true,
                customerId: true,
                customerName: true,
                phoneNumber: true,
                totalAmount: true,
                paidAmount: true,
                status: true,
                remark: true,
                shipStreet: true,
                isTaxInclusive: true,
                taxAmount: true,
                serviceChargeAmount: true,
                subtotalAmount: true,
                discountAmount: true,
                totalItemDiscountAmount: true,
                deliveredAt: true,
                deliveredBy: true,
                payments: {
                    select: {
                        method: true
                    }
                },
                salesItems: true
            },
            skip,
            take,
            orderBy: [
                { updatedAt: 'desc' },
                { createdAt: 'desc' }
            ]
        })

        // Transform results to include customerName
        const transformedSales = salesArray.map(sale => ({
            id: sale.id,
            businessDate: sale.businessDate,
            salesType: sale.salesType,
            customerId: sale.customerId,
            customerName: sale.customerName,
            phoneNumber: sale.phoneNumber,
            totalAmount: sale.totalAmount,
            paidAmount: sale.paidAmount,
            status: sale.status,
            shipStreet: sale.shipStreet,
            isTaxInclusive: sale.isTaxInclusive,
            taxAmount: sale.taxAmount,
            serviceChargeAmount: sale.serviceChargeAmount,
            subtotalAmount: sale.subtotalAmount,
            discountAmount: sale.discountAmount,
            totalItemDiscountAmount: sale.totalItemDiscountAmount,
            remark: sale.remark,
            totalItems: sale.salesItems.length,
            deliveredAt: sale.deliveredAt,
            deliveredBy: sale.deliveredBy,
            payments: sale.payments || [],
        }));

        // Return with pagination metadata and server timestamp
        return {
            data: transformedSales,
            total,
            serverTimestamp: new Date().toISOString(),
            isFirstSync: !lastSyncTimestamp || lastSyncTimestamp === 'null'
        };
    }
    catch (error) {
        throw error
    }
}

let getByDateRange = async (databaseName: string, request: SyncRequest & { startDate: string, endDate: string }) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { outletId, skip = 0, take = 100, lastSyncTimestamp, startDate, endDate } = request;

    try {
        // Parse last sync timestamp or use a default (e.g., epoch start)
        const lastSync = (lastSyncTimestamp && lastSyncTimestamp !== 'null') ?
            new Date(lastSyncTimestamp) : new Date(0);

        // Ensure outletId is a number
        const parsedOutletId = typeof outletId === 'string' ? parseInt(outletId, 10) : outletId;

        // Parse and validate date range
        const parsedStartDate = new Date(startDate);
        parsedStartDate.setHours(0, 0, 0, 0); // Start of day

        const parsedEndDate = new Date(endDate);
        parsedEndDate.setHours(23, 59, 59, 999); // End of day

        // Ensure dates are valid
        if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
            throw new Error('Invalid date format');
        }

        // Build query conditions with date range
        const where = {
            outletId: parsedOutletId,
            businessDate: {
                gte: parsedStartDate,
                lte: parsedEndDate
            },
            deleted: false,
        };

        // Count total records
        const total = await tenantPrisma.sales.count({ where });

        const salesArray = await tenantPrisma.sales.findMany({
            where,
            select: {
                id: true,
                businessDate: true,
                salesType: true,
                customerId: true,
                customerName: true,
                phoneNumber: true,
                shipStreet: true,
                isTaxInclusive: true,
                taxAmount: true,
                serviceChargeAmount: true,
                subtotalAmount: true,
                discountAmount: true,
                totalItemDiscountAmount: true,
                totalAmount: true,
                paidAmount: true,
                status: true,
                remark: true,
                deliveredAt: true,
                deliveredBy: true,
                payments: {
                    select: {
                        method: true
                    }
                },
                salesItems: true
            },
            skip,
            take,
        });

        // Transform results to include customerName
        const transformedSales = salesArray.map(sale => ({
            id: sale.id,
            businessDate: sale.businessDate,
            salesType: sale.salesType,
            customerId: sale.customerId,
            customerName: sale.customerName,
            phoneNumber: sale.phoneNumber,
            shipStreet: sale.shipStreet,
            isTaxInclusive: sale.isTaxInclusive,
            taxAmount: sale.taxAmount,
            serviceChargeAmount: sale.serviceChargeAmount,
            subtotalAmount: sale.subtotalAmount,
            discountAmount: sale.discountAmount,
            totalItemDiscountAmount: sale.totalItemDiscountAmount,
            totalAmount: sale.totalAmount,
            paidAmount: sale.paidAmount,
            status: sale.status,
            remark: sale.remark,
            totalItems: sale.salesItems.length,
            deliveredAt: sale.deliveredAt,
            deliveredBy: sale.deliveredBy,
            payments: sale.payments || []
        }));

        // Return with pagination metadata and server timestamp
        return {
            data: transformedSales,
            total,
            serverTimestamp: new Date().toISOString()
        };
    }
    catch (error) {
        throw error;
    }
}

let getPartiallyPaidSales = async (databaseName: string, request: SyncRequest) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { outletId, skip = 0, take = 100, lastSyncTimestamp } = request;

    try {
        // Parse last sync timestamp or use a default (e.g., epoch start)
        const lastSync = (lastSyncTimestamp && lastSyncTimestamp !== 'null') ?
            new Date(lastSyncTimestamp) : new Date(0);

        // Ensure outletId is a number
        const parsedOutletId = typeof outletId === 'string' ? parseInt(outletId, 10) : outletId;

        // Build query conditions for partially paid sales
        const where = {
            outletId: parsedOutletId,
            status: "Partially Paid",
            deleted: false,
            OR: [
                { createdAt: { gte: lastSync } },
                { updatedAt: { gte: lastSync } }
            ],
        };

        // Count total records
        const total = await tenantPrisma.sales.count({ where });

        // Fetch paginated items with explicit ordering - newest first
        const partiallyPaidSales = await tenantPrisma.sales.findMany({
            where,
            select: {
                id: true,
                businessDate: true,
                salesType: true,
                customerId: true,
                customerName: true,
                phoneNumber: true,
                shipStreet: true,
                isTaxInclusive: true,
                taxAmount: true,
                serviceChargeAmount: true,
                subtotalAmount: true,
                discountAmount: true,
                totalItemDiscountAmount: true,
                totalAmount: true,
                paidAmount: true,
                status: true,
                remark: true,
                // customer: {
                //     select: {
                //         firstName: true,
                //         lastName: true,
                //     },
                // },
                payments: {
                    select: {
                        method: true
                    }
                },
                salesItems: true
            },
            skip,
            take,
        });

        // Transform the results to include more readable data
        const transformedSales = partiallyPaidSales.map(sale => ({
            id: sale.id,
            businessDate: sale.businessDate,
            salesType: sale.salesType,
            customerId: sale.customerId,
            customerName: sale.customerName,
            phoneNumber: sale.phoneNumber,
            shipStreet: sale.shipStreet,
            isTaxInclusive: sale.isTaxInclusive,
            taxAmount: sale.taxAmount,
            serviceChargeAmount: sale.serviceChargeAmount,
            subtotalAmount: sale.subtotalAmount,
            discountAmount: sale.discountAmount,
            totalItemDiscountAmount: sale.totalItemDiscountAmount,
            totalAmount: sale.totalAmount,
            paidAmount: sale.paidAmount,
            status: sale.status,
            remark: sale.remark,
            totalItems: sale.salesItems.length,
            payments: sale.payments || []
        }));

        // Return with pagination metadata and server timestamp
        return {
            data: transformedSales,
            total,
            serverTimestamp: new Date().toISOString()
        };
    } catch (error) {
        throw error;
    }
}

let getById = async (databaseName: string, id: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const sales = await tenantPrisma.sales.findUnique({
            where: {
                id: id
            },
            include: {
                salesItems: true,
                payments: true,
                registerLogs: true
            }
        })
        if (!sales) {
            throw new NotFoundError("Sales")
        }

        return sales
    }
    catch (error) {
        throw error
    }
}

async function completeNewSales(
    databaseName: string,
    tenantId: number,
    performedBy: PerformedBy,
    salesBody: CreateSalesRequest,
    payments: Payment[]
) {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);

    // Store stock updates outside transaction for notification use
    let stockUpdatesForNotification: any[] = [];

    try {
        const result = await tenantPrisma.$transaction(async (tx) => {
            // Batch all initial queries
            const [stockBalances, stockReceipts, customer, itemTrackStockData] = await Promise.all([
                // Get stock balances for validation (with variant support)
                tx.stockBalance.findMany({
                    where: {
                        OR: salesBody.salesItems.map(item => ({
                            itemId: item.itemId,
                            itemVariantId: item.itemVariantId || null,
                            outletId: salesBody.outletId,
                            deleted: false,
                        })),
                    },
                    select: {
                        id: true, // Added for direct updates
                        itemId: true,
                        itemVariantId: true, // Added for variant support
                        availableQuantity: true,
                        reorderThreshold: true, // For low stock notifications
                        item: {
                            select: {
                                itemName: true,
                                itemCode: true,
                                cost: true, // Fallback cost
                                unitOfMeasure: true, // For consumption-based stock deduction
                            },
                        },
                    },
                }),

                // Get all stock receipts needed for FIFO in one query (with variant support)
                tx.stockReceipt.findMany({
                    where: {
                        OR: salesBody.salesItems.map(item => ({
                            itemId: item.itemId,
                            itemVariantId: item.itemVariantId || null,
                            outletId: salesBody.outletId,
                            deleted: false,
                            quantity: { gt: 0 },
                        })),
                    },
                    select: {
                        id: true,
                        itemId: true,
                        itemVariantId: true, // Added for variant support
                        quantity: true,
                        cost: true,
                        receiptDate: true,
                        createdAt: true,
                    },
                    orderBy: [{ receiptDate: 'asc' }, { createdAt: 'asc' }],
                }),

                // Validate customer if provided
                salesBody.customerId ? tx.customer.findUnique({
                    where: { id: salesBody.customerId },
                    select: { id: true, deleted: true }
                }) : null,

                // Fetch trackStock flag and cost for all items in the sale
                tx.item.findMany({
                    where: { id: { in: [...new Set(salesBody.salesItems.map(i => i.itemId))] } },
                    select: { id: true, trackStock: true, cost: true }
                })
            ]);

            // Validate customer
            if (salesBody.customerId && (!customer || customer.deleted)) {
                throw new Error(`Invalid customerId: ${salesBody.customerId}`);
            }

            // Create lookup maps for better performance (with variant support using composite keys)
            const stockBalanceMap = new Map(
                stockBalances.map(sb => [
                    `${sb.itemId}-${sb.itemVariantId || 'null'}`, // Composite key
                    sb
                ])
            );
            const stockReceiptsByItem = new Map<string, typeof stockReceipts>();
            stockReceipts.forEach(receipt => {
                const lookupKey = `${receipt.itemId}-${receipt.itemVariantId || 'null'}`;
                if (!stockReceiptsByItem.has(lookupKey)) {
                    stockReceiptsByItem.set(lookupKey, []);
                }
                stockReceiptsByItem.get(lookupKey)!.push(receipt);
            });

            // Build trackStock lookup map
            const itemTrackStockMap = new Map(
                itemTrackStockData.map((i: any) => [i.id, { trackStock: i.trackStock, cost: i.cost }])
            );

            // Split sales items into stock-tracked and non-stock-tracked groups
            const stockItems = salesBody.salesItems.filter(i => itemTrackStockMap.get(i.itemId)?.trackStock !== false);
            const nonStockItems = salesBody.salesItems.filter(i => itemTrackStockMap.get(i.itemId)?.trackStock === false);

            // Validate stockConsumptionQty values (only for stock-tracked items)
            for (const item of stockItems) {
                if (item.stockConsumptionQty != null) {
                    const consumptionQty = new Decimal(item.stockConsumptionQty.toString());
                    if (consumptionQty.lte(0)) {
                        throw new BusinessLogicError(
                            `Invalid stockConsumptionQty for item ${item.itemName || item.itemId}: must be a positive number`
                        );
                    }
                }
            }

            // Aggregate effective stock quantities per unique item for validation
            // This fixes a pre-existing bug where duplicate itemIds (consumption items)
            // were each validated independently against the original balance
            const aggregatedEffectiveQtyMap = new Map<string, Decimal>();
            for (const item of stockItems) {
                const lookupKey = `${item.itemId}-${item.itemVariantId || 'null'}`;
                const effectiveQty = getEffectiveStockQty(new Decimal(item.quantity), item.stockConsumptionQty);
                const current = aggregatedEffectiveQtyMap.get(lookupKey) || new Decimal(0);
                aggregatedEffectiveQtyMap.set(lookupKey, current.plus(effectiveQty));
            }

            // Validate stock availability using aggregated quantities
            const stockValidationErrors: string[] = [];
            for (const [lookupKey, totalEffectiveQty] of aggregatedEffectiveQtyMap) {
                const stockBalance = stockBalanceMap.get(lookupKey);
                if (!stockBalance) {
                    const item = salesBody.salesItems.find(i => `${i.itemId}-${i.itemVariantId || 'null'}` === lookupKey)!;
                    const variantInfo = item.variantName ? ` - ${item.variantName}` : '';
                    stockValidationErrors.push(`Stock balance not found for item ${item.itemName || item.itemId}${variantInfo}`);
                    continue;
                }
                if (new Decimal(stockBalance.availableQuantity).lt(totalEffectiveQty)) {
                    const variantInfo = stockBalance.itemVariantId ? ` (variant)` : '';
                    stockValidationErrors.push(
                        `Insufficient stock for ${stockBalance.item.itemName}${variantInfo} (${stockBalance.item.itemCode}). ` +
                        `Available: ${stockBalance.availableQuantity}, Required: ${totalEffectiveQty}`
                    );
                }
            }
            if (stockValidationErrors.length > 0) {
                throw new BusinessLogicError(`Stock validation failed: ${stockValidationErrors.join('; ')}`);
            }

            // Snapshot original receipt quantities BEFORE FIFO mutation
            // (FIFO loop mutates receipt.quantity in-memory for duplicate-item handling)
            const originalReceiptQtyMap = new Map<number, Decimal>();
            for (const receipt of stockReceipts) {
                originalReceiptQtyMap.set(receipt.id, new Decimal(receipt.quantity));
            }

            // Calculate FIFO costs for each sales item
            // Receipt quantities are mutated in-memory so subsequent items with the same
            // itemId see reduced quantities (fixes duplicate-item FIFO bug)
            const salesItemsWithFIFOCost: Array<typeof salesBody.salesItems[0] & {
                usedReceipts: { id: number; quantityUsed: Decimal; cost: Decimal }[]
            }> = [];

            for (const item of stockItems) {
                const lookupKey = `${item.itemId}-${item.itemVariantId || 'null'}`;
                const stockBalance = stockBalanceMap.get(lookupKey)!;
                const effectiveQty = getEffectiveStockQty(new Decimal(item.quantity), item.stockConsumptionQty);

                const itemReceipts = stockReceiptsByItem.get(lookupKey) || [];
                let remainingQuantity = effectiveQty;
                let usedReceipts: { id: number; quantityUsed: Decimal; cost: Decimal }[] = [];

                if (itemReceipts.length === 0) {
                    // Fallback to item cost
                    usedReceipts.push({
                        id: -1,
                        quantityUsed: remainingQuantity,
                        cost: new Decimal(stockBalance.item.cost || 0)
                    });
                } else {
                    // Use FIFO — receipt.quantity is mutated in-memory for subsequent items
                    for (const receipt of itemReceipts) {
                        if (remainingQuantity.lte(0)) break;

                        const availableInReceipt = new Decimal(receipt.quantity);
                        if (availableInReceipt.lte(0)) continue;

                        const quantityToUse = Decimal.min(remainingQuantity, availableInReceipt);
                        remainingQuantity = remainingQuantity.minus(quantityToUse);

                        // Mutate receipt quantity in-memory for subsequent items with same itemId
                        (receipt as any).quantity = availableInReceipt.minus(quantityToUse);

                        usedReceipts.push({
                            id: receipt.id,
                            quantityUsed: quantityToUse,
                            cost: new Decimal(receipt.cost),
                        });
                    }

                    // If still remaining, use last receipt's cost
                    if (remainingQuantity.gt(0) && itemReceipts.length > 0) {
                        const lastReceipt = itemReceipts[itemReceipts.length - 1];
                        usedReceipts.push({
                            id: -1,
                            quantityUsed: remainingQuantity,
                            cost: new Decimal(lastReceipt.cost),
                        });
                    }
                }

                salesItemsWithFIFOCost.push({ ...item, usedReceipts });
            }

            // Calculate payments and sales status
            const totalSalesAmount = new Decimal(salesBody.totalAmount);
            const totalPaymentAmount = payments.reduce((sum, payment) => sum.plus(new Decimal(payment.tenderedAmount)), new Decimal(0));
            const salesStatus = totalPaymentAmount.gte(totalSalesAmount) ? 'Completed' : 'Partially Paid';
            const changeAmount = totalPaymentAmount.gte(totalSalesAmount) ? totalPaymentAmount.minus(totalSalesAmount) : new Decimal(0);

            // Calculate total profit and prepare sales item data
            let totalProfit = new Decimal(0);
            const salesItemData: any[] = [];
            // Aggregate receipt updates by receipt ID to prevent duplicate updates
            // when multiple sales items consume from the same receipt
            const stockReceiptUpdateMap = new Map<number, Decimal>();

            salesItemsWithFIFOCost.forEach((item) => {
                const isConsumptionItem = item.stockConsumptionQty != null;

                if (isConsumptionItem) {
                    // ── Consumption items: single row with weighted-average cost ──
                    const totalQuantity = new Decimal(item.quantity);
                    const totalDiscount = item.discountAmount ? new Decimal(item.discountAmount) : new Decimal(0);
                    const totalServiceCharge = item.serviceChargeAmount ? new Decimal(item.serviceChargeAmount) : new Decimal(0);
                    const totalTax = item.taxAmount ? new Decimal(item.taxAmount) : new Decimal(0);
                    const totalRevenue = new Decimal(item.price).times(totalQuantity);
                    const totalPriceBeforeTax = new Decimal(item.priceBeforeTax).times(totalQuantity);
                    const totalSubtotal = new Decimal(item.subtotalAmount);

                    // Weighted-average cost from FIFO receipts (in stock units)
                    let totalCost = new Decimal(0);
                    for (const receipt of item.usedReceipts) {
                        totalCost = totalCost.plus(new Decimal(receipt.cost).times(receipt.quantityUsed));
                    }

                    const profit = totalRevenue.minus(totalCost).minus(totalDiscount).minus(totalServiceCharge);
                    totalProfit = totalProfit.plus(profit);

                    salesItemData.push({
                        itemId: item.itemId,
                        itemVariantId: item.itemVariantId || null,
                        itemName: item.itemName,
                        itemCode: item.itemCode,
                        variantSku: item.variantSku || null,
                        variantName: item.variantName || null,
                        itemBrand: item.itemBrand,
                        itemModel: item.itemModel,
                        quantity: totalQuantity,
                        cost: totalCost,
                        price: totalRevenue,
                        priceBeforeTax: totalPriceBeforeTax,
                        profit: profit,
                        discountPercentage: item.discountPercentage,
                        discountAmount: totalDiscount,
                        serviceChargeAmount: totalServiceCharge,
                        taxAmount: totalTax,
                        subtotalAmount: totalSubtotal,
                        remark: item.remark || '',
                        deleted: false,
                        stockConsumptionQty: item.stockConsumptionQty,
                        unitOfMeasure: item.unitOfMeasure || null,
                    });

                    // Track receipt updates for consumption item
                    for (const receipt of item.usedReceipts) {
                        if (receipt.id !== -1) {
                            const current = stockReceiptUpdateMap.get(receipt.id) || new Decimal(0);
                            stockReceiptUpdateMap.set(receipt.id, current.plus(receipt.quantityUsed));
                        }
                    }
                } else {
                    // ── Piece-based items: existing multi-row FIFO split ──
                    const totalQuantity = new Decimal(item.quantity);
                    const discountPerUnit = (item.discountAmount ? new Decimal(item.discountAmount) : new Decimal(0)).dividedBy(totalQuantity);
                    const serviceChargePerUnit = (item.serviceChargeAmount ? new Decimal(item.serviceChargeAmount) : new Decimal(0)).dividedBy(totalQuantity);
                    const taxPerUnit = (item.taxAmount ? new Decimal(item.taxAmount) : new Decimal(0)).dividedBy(totalQuantity);

                    item.usedReceipts.forEach((receipt) => {
                        const receiptQuantity = new Decimal(receipt.quantityUsed);
                        const receiptCost = new Decimal(receipt.cost);

                        const revenueForQuantity = new Decimal(item.price).times(receiptQuantity);
                        const costForQuantity = receiptCost.times(receiptQuantity);
                        const totalDiscountForQuantity = discountPerUnit.times(receiptQuantity);
                        const totalTaxForQuantity = taxPerUnit.times(receiptQuantity);
                        const totalServiceChargeForQuantity = serviceChargePerUnit.times(receiptQuantity);
                        const totalPriceBeforeTax = new Decimal(item.priceBeforeTax).times(receiptQuantity);
                        const totalSubtotalForQuantity = (new Decimal(item.subtotalAmount).dividedBy(totalQuantity)).times(receiptQuantity);

                        const profit = revenueForQuantity.minus(costForQuantity).minus(totalDiscountForQuantity).minus(totalServiceChargeForQuantity);
                        totalProfit = totalProfit.plus(profit);

                        salesItemData.push({
                            itemId: item.itemId,
                            itemVariantId: item.itemVariantId || null,
                            itemName: item.itemName,
                            itemCode: item.itemCode,
                            variantSku: item.variantSku || null,
                            variantName: item.variantName || null,
                            itemBrand: item.itemBrand,
                            itemModel: item.itemModel,
                            quantity: receiptQuantity,
                            cost: costForQuantity,
                            price: revenueForQuantity,
                            priceBeforeTax: totalPriceBeforeTax,
                            profit: profit,
                            discountPercentage: item.discountPercentage,
                            discountAmount: totalDiscountForQuantity,
                            serviceChargeAmount: totalServiceChargeForQuantity,
                            taxAmount: totalTaxForQuantity,
                            subtotalAmount: totalSubtotalForQuantity,
                            remark: item.remark || '',
                            deleted: false,
                        });

                        // Track receipt updates for piece-based item
                        if (receipt.id !== -1) {
                            const current = stockReceiptUpdateMap.get(receipt.id) || new Decimal(0);
                            stockReceiptUpdateMap.set(receipt.id, current.plus(receipt.quantityUsed));
                        }
                    });
                }
            });

            // ── Non-stock items: use item.cost directly, no FIFO/stock operations ──
            for (const item of nonStockItems) {
                const itemInfo = itemTrackStockMap.get(item.itemId);
                const qty = new Decimal(item.quantity);
                const unitCost = new Decimal(itemInfo?.cost || 0);
                const totalCost = unitCost.times(qty);
                const totalRevenue = new Decimal(item.price).times(qty);
                const totalDiscount = item.discountAmount ? new Decimal(item.discountAmount) : new Decimal(0);
                const totalServiceCharge = item.serviceChargeAmount ? new Decimal(item.serviceChargeAmount) : new Decimal(0);
                const profit = totalRevenue.minus(totalCost).minus(totalDiscount).minus(totalServiceCharge);
                totalProfit = totalProfit.plus(profit);

                salesItemData.push({
                    itemId: item.itemId,
                    itemVariantId: item.itemVariantId || null,
                    itemName: item.itemName,
                    itemCode: item.itemCode,
                    variantSku: item.variantSku || null,
                    variantName: item.variantName || null,
                    itemBrand: item.itemBrand,
                    itemModel: item.itemModel,
                    quantity: qty,
                    cost: totalCost,
                    price: totalRevenue,
                    priceBeforeTax: new Decimal(item.priceBeforeTax).times(qty),
                    profit: profit,
                    discountPercentage: item.discountPercentage,
                    discountAmount: totalDiscount,
                    serviceChargeAmount: totalServiceCharge,
                    taxAmount: item.taxAmount ? new Decimal(item.taxAmount) : new Decimal(0),
                    subtotalAmount: new Decimal(item.subtotalAmount),
                    remark: item.remark || '',
                    deleted: false,
                });
            }

            // Convert aggregated receipt update map to final update list
            const stockReceiptUpdates: { id: number; newQuantity: Decimal }[] = [];
            for (const [receiptId, totalUsed] of stockReceiptUpdateMap) {
                const originalQty = originalReceiptQtyMap.get(receiptId) || new Decimal(0);
                stockReceiptUpdates.push({ id: receiptId, newQuantity: originalQty.minus(totalUsed) });
            }

            // Create sales record
            const createdSales = await tx.sales.create({
                data: {
                    outletId: salesBody.outletId,
                    businessDate: salesBody.businessDate,
                    salesType: salesBody.salesType.replace(/\b\w/g, (char) => char.toUpperCase()),
                    customerName: salesBody.customerName || '',
                    customerId: salesBody.customerId || null,
                    phoneNumber: salesBody.phoneNumber || '',
                    billStreet: salesBody.billStreet,
                    billCity: salesBody.billCity,
                    billState: salesBody.billState,
                    billPostalCode: salesBody.billPostalCode,
                    billCountry: salesBody.billCountry,
                    shipStreet: salesBody.shipStreet,
                    shipCity: salesBody.shipCity,
                    shipState: salesBody.shipState,
                    shipPostalCode: salesBody.shipPostalCode,
                    shipCountry: salesBody.shipCountry,
                    totalItemDiscountAmount: salesBody.totalItemDiscountAmount,
                    discountPercentage: salesBody.discountPercentage,
                    discountAmount: salesBody.discountAmount,
                    serviceChargeAmount: salesBody.serviceChargeAmount,
                    taxAmount: salesBody.taxAmount,
                    isTaxInclusive: salesBody.isTaxInclusive,
                    roundingAmount: salesBody.roundingAmount,
                    subtotalAmount: salesBody.subtotalAmount,
                    totalAmount: salesBody.totalAmount,
                    paidAmount: totalPaymentAmount,
                    changeAmount: changeAmount,
                    status: salesStatus,
                    remark: salesBody.remark,
                    sessionId: salesBody.sessionId,
                    completedSessionId: totalPaymentAmount.gte(totalSalesAmount) ? salesBody.sessionId : null,
                    eodId: salesBody.eodId,
                    salesQuotationId: salesBody.salesQuotationId,
                    performedBy: salesBody.performedBy,
                    deleted: false,
                    profitAmount: totalProfit,
                },
            });

            // Batch create sales items
            await tx.salesItem.createMany({
                data: salesItemData.map(item => ({
                    ...item,
                    salesId: createdSales.id,
                }))
            });

            // Batch create payments
            await tx.payment.createMany({
                data: payments.map(payment => ({
                    ...payment,
                    salesId: createdSales.id,
                }))
            });

            // ── Loyalty Block ──
            const isFullyPaid = salesStatus === 'Completed';
            if (isFullyPaid && performedBy.loyaltyTier && performedBy.loyaltyTier !== 'none' && salesBody.customerId) {
                const loyaltyResult = await processLoyaltyForSale(
                    tx, databaseName, createdSales.id, salesBody.customerId,
                    totalSalesAmount, salesBody, performedBy
                );

                // Update sales record with loyalty data
                await tx.sales.update({
                    where: { id: createdSales.id },
                    data: {
                        loyaltyPointsEarned: loyaltyResult.loyaltyPointsEarned,
                        loyaltyPointsRedeemed: loyaltyResult.loyaltyPointsRedeemed,
                        loyaltyPointsRedemptionValue: loyaltyResult.loyaltyPointsRedemptionValue,
                        loyaltyTierDiscountPercent: loyaltyResult.loyaltyTierDiscountPercent,
                        loyaltyTierDiscountAmount: loyaltyResult.loyaltyTierDiscountAmount,
                        customerSubscriptionId: loyaltyResult.customerSubscriptionId,
                        subscriptionDiscountAmount: loyaltyResult.subscriptionDiscountAmount,
                    },
                });

                // Fire-and-forget: check tier auto-upgrade (advanced only)
                if (performedBy.loyaltyTier === 'advanced' && loyaltyResult.loyaltyAccountId) {
                    const accountIdForTier = loyaltyResult.loyaltyAccountId;
                    // Post-transaction, non-blocking
                    setImmediate(() => {
                        loyaltyService.checkTierUpgrade(databaseName, accountIdForTier).catch(err =>
                            console.error('Tier auto-upgrade check failed:', err)
                        );
                    });
                }
            }
            // ── End Loyalty Block ──

            // Batch update stock receipts (parallel execution for performance)
            if (stockReceiptUpdates.length > 0) {
                await Promise.all(
                    stockReceiptUpdates.map((update) =>
                        tx.stockReceipt.update({
                            where: { id: update.id },
                            data: {
                                quantity: update.newQuantity,
                                updatedAt: new Date(),
                                version: { increment: 1 },
                                deleted: update.newQuantity.eq(0) ? true : undefined,
                                deletedAt: update.newQuantity.eq(0) ? new Date() : undefined,
                            },
                        })
                    )
                );
            }

            // Prepare stock balance updates and movements (with variant support)
            // Aggregate per unique item to handle duplicate itemIds (consumption items)
            const stockUpdates: any[] = [];
            for (const [lookupKey, totalEffectiveQty] of aggregatedEffectiveQtyMap) {
                const stockBalance = stockBalanceMap.get(lookupKey)!;
                const item = salesBody.salesItems.find(i => `${i.itemId}-${i.itemVariantId || 'null'}` === lookupKey)!;
                const newAvailableQuantity = new Decimal(stockBalance.availableQuantity)
                    .minus(totalEffectiveQty);

                // Check reorder threshold
                const reorderThreshold = stockBalance.reorderThreshold
                    ? new Decimal(stockBalance.reorderThreshold)
                    : null;

                const needsReorder = reorderThreshold
                    ? newAvailableQuantity.lte(reorderThreshold) &&
                    new Decimal(stockBalance.availableQuantity).gt(reorderThreshold)
                    : false;

                stockUpdates.push({
                    stockBalanceId: stockBalance.id,
                    outletId: salesBody.outletId,
                    itemId: item.itemId,
                    itemVariantId: item.itemVariantId || null,
                    itemName: stockBalance.item.itemName,
                    itemCode: stockBalance.item.itemCode,
                    variantName: item.variantName || null,
                    quantity: totalEffectiveQty,
                    previousAvailable: new Decimal(stockBalance.availableQuantity),
                    previousOnHand: new Decimal(stockBalance.availableQuantity),
                    newAvailableQuantity: newAvailableQuantity,
                    reorderThreshold: reorderThreshold?.toNumber(),
                    willBeOutOfStock: newAvailableQuantity.lte(0),
                    needsReorder: needsReorder,
                });
            }

            // Store for notifications outside transaction
            stockUpdatesForNotification = stockUpdates;

            // Batch update stock balances and create movements
            await Promise.all([
                // Update stock balances directly using stored IDs
                ...stockUpdates.map((update) =>
                    tx.stockBalance.update({
                        where: { id: update.stockBalanceId },
                        data: {
                            availableQuantity: { decrement: update.quantity.toNumber() },
                            onHandQuantity: { decrement: update.quantity.toNumber() },
                            version: { increment: 1 },
                            updatedAt: new Date(),
                        },
                    })
                ),

                // Batch create stock movements
                tx.stockMovement.createMany({
                    data: stockUpdates.map(update => ({
                        itemId: update.itemId,
                        itemVariantId: update.itemVariantId,
                        outletId: update.outletId,
                        previousAvailableQuantity: update.previousAvailable.toNumber(),
                        previousOnHandQuantity: update.previousOnHand.toNumber(),
                        availableQuantityDelta: -update.quantity.toNumber(),
                        onHandQuantityDelta: -update.quantity.toNumber(),
                        movementType: 'Sales',
                        documentId: createdSales.id,
                        reason: 'Sales transaction',
                        remark: `Sales #${createdSales.id}`,
                    }))
                })
            ]);

            return createdSales;
        });

        // Prepare all notifications
        const outOfStockItems = stockUpdatesForNotification.filter((u: any) => u.willBeOutOfStock);
        const lowStockItems = stockUpdatesForNotification.filter((u: any) => u.needsReorder && !u.willBeOutOfStock);

        // Send all notifications in parallel (fire-and-forget, don't block response)
        Promise.all([
            // Sales notification
            sendSalesNotification(
                tenantId,
                salesBody.outletId,
                NotificationMessages.sales.newSaleCompleted.title,
                NotificationMessages.sales.newSaleCompleted.message(
                    result.id,
                    new Decimal(result.totalAmount).toFixed(0)
                ),
                {
                    type: 'sale_completed',
                    salesId: result.id,
                    amount: new Decimal(result.totalAmount).toNumber(),
                    customerName: result.customerName || 'Walk-in Customer',
                    status: result.status,
                    itemCount: salesBody.salesItems.length,
                    outletId: salesBody.outletId,
                    triggeringUserId: performedBy.userId,
                    triggeringUsername: performedBy.username,
                    timestamp: new Date().toISOString()
                }
            ),

            // Out-of-stock notification (if needed)
            ...(outOfStockItems.length > 0 ? [
                sendInventoryNotification(
                    tenantId,
                    salesBody.outletId,
                    getOutOfStockTitle(outOfStockItems.length),
                    formatOutOfStockMessage(outOfStockItems),
                    {
                        type: 'out_of_stock',
                        priority: 'high',
                        count: outOfStockItems.length,
                        items: outOfStockItems.map((item: any) => ({
                            itemId: item.itemId,
                            itemName: item.itemName,
                            itemCode: item.itemCode,
                            previousStock: item.previousAvailable.toNumber(),
                            currentStock: 0,
                            soldQuantity: item.quantity.toNumber()
                        })),
                        outletId: salesBody.outletId,
                        salesId: result.id,
                        triggeringUserId: performedBy.userId,
                        triggeringUsername: performedBy.username,
                        timestamp: new Date().toISOString()
                    }
                )
            ] : []),

            // Low-stock notification (if needed)
            ...(lowStockItems.length > 0 ? [
                sendInventoryNotification(
                    tenantId,
                    salesBody.outletId,
                    getLowStockTitle(lowStockItems.length),
                    formatLowStockMessage(lowStockItems),
                    {
                        type: 'low_stock',
                        priority: 'normal',
                        count: lowStockItems.length,
                        items: lowStockItems.map((item: any) => ({
                            itemId: item.itemId,
                            itemName: item.itemName,
                            itemCode: item.itemCode,
                            previousStock: item.previousAvailable.toNumber(),
                            currentStock: item.newAvailableQuantity.toNumber(),
                            reorderThreshold: item.reorderThreshold,
                            soldQuantity: item.quantity.toNumber()
                        })),
                        outletId: salesBody.outletId,
                        salesId: result.id,
                        triggeringUserId: performedBy.userId,
                        triggeringUsername: performedBy.username,
                        timestamp: new Date().toISOString()
                    }
                )
            ] : [])
        ]).catch(error => {
            // Log notification errors but don't fail the response
            console.error('Failed to send notifications:', error);
        });

        return getById(databaseName, result.id);
    } catch (error) {
        throw error;
    }
}

let calculateSales = async (databaseName: string, salesRequestBody: CalculateSalesDto) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        let sales = await performSalesCalculation(salesRequestBody.sales)
        let salesResponse: CalculateSalesDto = {
            sales: sales
        }
        return salesResponse

    }
    catch (error) {
        throw error
    }
}

let performSalesCalculation = async (sales: CalculateSalesObject) => {
    try {
        let items = sales.salesItems
        var subtotal = new Decimal(0);
        var totalItemDiscountAmount = new Decimal(0);

        items.forEach(function (item) {
            item.subtotalAmount = new Decimal(item.price).times(new Decimal(item.quantity));
            item = calculateItemDiscount(item);
            item.subtotalAmount = item.subtotalAmount.minus(item.discountAmount);
            totalItemDiscountAmount = totalItemDiscountAmount.plus(item.discountAmount);
            subtotal = subtotal.plus(item.subtotalAmount);
        })

        sales.totalItemDiscountAmount = totalItemDiscountAmount;
        sales.subtotalAmount = subtotal;
        sales = calculateSalesDiscount(sales);
        sales.taxAmount = new Decimal(0);
        sales.serviceChargeAmount = new Decimal(0);
        sales.roundingAmount = new Decimal(0);
        sales.totalAmount = sales.subtotalAmount.plus(sales.taxAmount).plus(sales.serviceChargeAmount).plus(sales.roundingAmount).minus(sales.discountAmount);

        return sales;
    }
    catch (error) {
        throw error
    }
}

let calculateItemDiscount = (item: CalculateSalesItemObject) => {
    switch (item.discountType) {
        case DiscountType.Manual:
            let subtotalBeforeDiscount = new Decimal(item.subtotalAmount)
            switch (item.discountBy) {
                case DiscountBy.Amount:
                    let discountPercentage = (new Decimal(item.discountAmount).times(100)).dividedBy(subtotalBeforeDiscount);
                    if (discountPercentage.gt(100)) {
                        item.discountPercentage = new Decimal(100);
                        item.discountAmount = subtotalBeforeDiscount;
                    }
                    else {
                        item.discountPercentage = discountPercentage;
                        item.discountAmount = new Decimal(item.discountAmount);
                    }
                    break
                case DiscountBy.Percentage:
                    item.discountAmount = subtotalBeforeDiscount.times(new Decimal(item.discountPercentage).dividedBy(100));
                    item.discountPercentage = new Decimal(item.discountPercentage);
                    break
                default:
                    item.discountAmount = new Decimal(0);
                    item.discountPercentage = new Decimal(0);
                    break
            }
            break
        default:
            // Ensure discountAmount and discountPercentage are Decimal for non-manual discount types
            item.discountAmount = new Decimal(item.discountAmount || 0);
            item.discountPercentage = new Decimal(item.discountPercentage || 0);
            break
    }
    return item
}

let calculateSalesDiscount = (sales: CalculateSalesObject) => {
    switch (sales.discountBy) {
        case DiscountBy.Amount:
            let discountPercentage = (new Decimal(sales.discountAmount).times(100)).dividedBy(new Decimal(sales.subtotalAmount));
            if (discountPercentage.gt(100)) {
                sales.discountPercentage = new Decimal(100);
                sales.discountAmount = new Decimal(sales.subtotalAmount);
            }
            else {
                sales.discountPercentage = discountPercentage;
                sales.discountAmount = new Decimal(sales.discountAmount);
            }
            break
        case DiscountBy.Percentage:
            sales.discountAmount = new Decimal(sales.subtotalAmount).times(new Decimal(sales.discountPercentage).dividedBy(100));
            sales.discountPercentage = new Decimal(sales.discountPercentage);
            break
        default:
            sales.discountAmount = new Decimal(0);
            sales.discountPercentage = new Decimal(0);
            break
    }
    return sales
}

let update = async (databaseName: string, salesRequest: SalesRequestBody) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        await tenantPrisma.$transaction(async (tx) => {
            //separate sales & salesitem to perform update to different tables
            let { items, ...sales } = salesRequest.sales
            items.forEach(async function (salesItem) {
                await tx.salesItem.update({
                    where: {
                        id: salesItem.id
                    },
                    data: salesItem
                })
            })
            await tx.sales.update({
                where: {
                    id: sales.id
                },
                data: sales
            })
        })
    }
    catch (error) {
        throw error
    }
}

let remove = async (databaseName: string, id: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        await tenantPrisma.$transaction(async (tx) => {
            await tx.sales.update({
                where: {
                    id: id
                },
                data: {
                    deleted: true
                }
            })
            await tx.salesItem.updateMany({
                where: {
                    salesId: id
                },
                data: {
                    deleted: true
                }
            })
        })
    }
    catch (error) {
        throw error
    }
}

let getTotalSalesData = async (databaseName: string, sessionID: number, loyaltyTier?: 'none' | 'basic' | 'advanced') => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const includeLoyalty = loyaltyTier && loyaltyTier !== 'none';

        // Fetch all sales for the session with minimal fields (single query)
        const allSales = await tenantPrisma.sales.findMany({
            where: {
                sessionId: sessionID,
                deleted: false
            },
            select: {
                status: true,
                totalAmount: true,
                paidAmount: true,
                profitAmount: true,
                changeAmount: true,
                // Conditionally include loyalty fields (0 extra cost — same query)
                ...(includeLoyalty ? {
                    loyaltyPointsEarned: true,
                    loyaltyPointsRedeemed: true,
                    loyaltyTierDiscountAmount: true,
                    customerSubscriptionId: true,
                } : {}),
            }
        });

        // Filter and aggregate in memory by status
        const completedSales = allSales.filter(sale => sale.status === "Completed");
        const partiallyPaidSales = allSales.filter(sale => sale.status === "Partially Paid");
        const voidedSales = allSales.filter(sale => sale.status === "Voided");
        const returnedSales = allSales.filter(sale => sale.status === "Returned");
        const refundedSales = allSales.filter(sale => sale.status === "Refunded");
        const deliveredSales = allSales.filter(sale => sale.status === "Delivered");
        const activeSales = [...completedSales, ...partiallyPaidSales, ...deliveredSales];

        // Aggregate active sales (Completed + Partially Paid + Delivered)
        let activeTotalAmount = new Decimal(0);
        let activePaidAmount = new Decimal(0);
        let activeProfitAmount = new Decimal(0);
        let activeChangeAmount = new Decimal(0);

        activeSales.forEach(sale => {
            activeTotalAmount = activeTotalAmount.plus(sale.totalAmount);
            activePaidAmount = activePaidAmount.plus(sale.paidAmount);
            activeProfitAmount = activeProfitAmount.plus(sale.profitAmount);
            activeChangeAmount = activeChangeAmount.plus(sale.changeAmount || 0);
        });

        // Aggregate partially paid sales
        let partiallyPaidTotalAmount = new Decimal(0);
        let partiallyPaidPaidAmount = new Decimal(0);

        partiallyPaidSales.forEach(sale => {
            partiallyPaidTotalAmount = partiallyPaidTotalAmount.plus(sale.totalAmount);
            partiallyPaidPaidAmount = partiallyPaidPaidAmount.plus(sale.paidAmount);
        });

        // Calculate derived metrics using Decimal arithmetic
        const netRevenue = activeTotalAmount;
        const netProfit = activeProfitAmount;

        const totalTransactions = activeSales.length + voidedSales.length +
            returnedSales.length + refundedSales.length;

        const averageTransactionValue = activeSales.length > 0 ?
            netRevenue.dividedBy(activeSales.length) : new Decimal(0);

        const outstandingAmount = partiallyPaidTotalAmount.minus(partiallyPaidPaidAmount);

        // Loyalty metrics (only computed if loyalty is enabled)
        let loyaltyMetrics = undefined;
        if (includeLoyalty) {
            let totalPointsEarned = new Decimal(0);
            let totalPointsRedeemed = new Decimal(0);
            let totalLoyaltyDiscount = new Decimal(0);
            let subscriptionUsageCount = 0;

            activeSales.forEach((sale: any) => {
                if (sale.loyaltyPointsEarned) totalPointsEarned = totalPointsEarned.plus(sale.loyaltyPointsEarned);
                if (sale.loyaltyPointsRedeemed) totalPointsRedeemed = totalPointsRedeemed.plus(sale.loyaltyPointsRedeemed);
                if (sale.loyaltyTierDiscountAmount) totalLoyaltyDiscount = totalLoyaltyDiscount.plus(sale.loyaltyTierDiscountAmount);
                if (sale.customerSubscriptionId) subscriptionUsageCount++;
            });

            loyaltyMetrics = {
                totalLoyaltyPointsEarned: totalPointsEarned,
                totalLoyaltyPointsRedeemed: totalPointsRedeemed,
                totalLoyaltyDiscountAmount: totalLoyaltyDiscount,
                totalSubscriptionUsages: subscriptionUsageCount,
            };
        }

        return {
            // Summary metrics
            salesCount: activeSales.length,
            totalRevenue: netRevenue,
            totalProfit: netProfit,

            // Enhanced metrics
            averageTransactionValue: Math.round(averageTransactionValue.toNumber() * 100) / 100,
            totalPaidAmount: activePaidAmount,
            totalChangeGiven: activeChangeAmount,
            outstandingAmount: outstandingAmount,

            // Transaction counts by status
            transactionCounts: {
                total: totalTransactions,
                completed: completedSales.length,
                partiallyPaid: partiallyPaidSales.length,
                delivered: deliveredSales.length,
                voided: voidedSales.length,
                returned: returnedSales.length,
                refunded: refundedSales.length,
            },

            // Loyalty metrics (only present when loyalty is enabled)
            ...(loyaltyMetrics ? { loyaltyMetrics } : {}),
        };
    }
    catch (error) {
        throw error
    }
}

let addPaymentToPartiallyPaidSales = async (
    databaseName: string,
    tenantId: number,
    performedBy: PerformedBy,
    salesId: number,
    payments: Payment[]
) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const result = await tenantPrisma.$transaction(async (tx) => {
            // Get the sales record
            const sales = await tx.sales.findUnique({
                where: {
                    id: salesId
                }
            });
            if (!sales) {
                throw new NotFoundError("Sales");
            }
            if (sales.status !== "Partially Paid") {
                throw new BusinessLogicError("Only partially paid sales can receive additional payments");
            }
            // Calculate the remaining amount to be paid
            const remainingAmount = new Decimal(sales.totalAmount).minus(new Decimal(sales.paidAmount));
            if (remainingAmount.lte(0)) {
                throw new BusinessLogicError("This sales record is already fully paid");
            }

            // Calculate total of new payments
            const totalNewPaymentAmount = payments.reduce((sum, payment) => sum.plus(new Decimal(payment.tenderedAmount)), new Decimal(0));
            if (totalNewPaymentAmount.lte(0)) {
                throw new BusinessLogicError("Total payment amount must be greater than zero");
            }

            // Update payments with salesId
            const paymentsWithSalesId = payments.map(payment => ({
                ...payment,
                salesId: salesId
            }));
            // Create the payment records
            await tx.payment.createMany({
                data: paymentsWithSalesId
            });
            // Update the sales record
            const updatedPaidAmount = new Decimal(sales.paidAmount).plus(totalNewPaymentAmount);
            const isFullyPaid = updatedPaidAmount.gte(new Decimal(sales.totalAmount));

            // Calculate change amount if payment exceeds the remaining amount
            const changeAmount = isFullyPaid ?
                updatedPaidAmount.minus(new Decimal(sales.totalAmount)) :
                new Decimal(0); // No change if still partially paid

            // Update sales status and payment details
            const updatedSales = await tx.sales.update({
                where: {
                    id: salesId
                },
                data: {
                    paidAmount: updatedPaidAmount,
                    changeAmount: changeAmount,
                    status: isFullyPaid ? "Completed" : "Partially Paid"
                }
            });

            // ── Loyalty Earn on Completion ──
            if (isFullyPaid && performedBy.loyaltyTier && performedBy.loyaltyTier !== 'none' && sales.customerId) {
                const toNum = loyaltyService.toDecimalNumber;
                const account = await tx.loyaltyAccount.findFirst({
                    where: { customerId: sales.customerId, deleted: false },
                    include: performedBy.loyaltyTier === 'advanced' ? { loyaltyTier: true } : undefined,
                });

                if (account) {
                    const program = await loyaltyService.getCachedProgram(databaseName);
                    if (program && program.isActive) {
                        const saleTotal = new Decimal(sales.totalAmount);
                        let pointsMultiplier = 1.0;
                        if (performedBy.loyaltyTier === 'advanced' && (account as any).loyaltyTier) {
                            pointsMultiplier = toNum((account as any).loyaltyTier.pointsMultiplier);
                        }
                        const pointsEarned = saleTotal.toNumber() * toNum(program.pointsPerCurrency) * pointsMultiplier;

                        if (pointsEarned > 0) {
                            const expiresAt = program.pointsExpiryDays
                                ? new Date(Date.now() + program.pointsExpiryDays * 24 * 60 * 60 * 1000)
                                : null;

                            await tx.loyaltyPointBatch.create({
                                data: {
                                    loyaltyAccountId: account.id,
                                    originalPoints: pointsEarned,
                                    remainingPoints: pointsEarned,
                                    expiresAt,
                                    salesId,
                                },
                            });

                            await tx.loyaltyAccount.update({
                                where: { id: account.id },
                                data: {
                                    currentPoints: { increment: pointsEarned },
                                    totalEarned: { increment: pointsEarned },
                                    totalSpend: { increment: saleTotal.toNumber() },
                                },
                            });

                            const finalAccount = await tx.loyaltyAccount.findUnique({ where: { id: account.id } });

                            await tx.loyaltyTransaction.create({
                                data: {
                                    loyaltyAccountId: account.id,
                                    type: 'EARN',
                                    points: pointsEarned,
                                    balanceAfter: toNum(finalAccount?.currentPoints ?? 0),
                                    salesId,
                                    description: `Earned from completed sale #${salesId}`,
                                    performedBy: performedBy.username,
                                },
                            });

                            await tx.sales.update({
                                where: { id: salesId },
                                data: { loyaltyPointsEarned: pointsEarned },
                            });

                            // Fire-and-forget tier upgrade check
                            if (performedBy.loyaltyTier === 'advanced') {
                                setImmediate(() => {
                                    loyaltyService.checkTierUpgrade(databaseName, account.id).catch(err =>
                                        console.error('Tier auto-upgrade check failed:', err)
                                    );
                                });
                            }
                        }
                    }
                }
            }
            // ── End Loyalty Earn ──

            return { updatedSales, totalNewPaymentAmount, remainingAmount };
        });

        // Send notification after successful transaction
        const isCompleted = result.updatedSales.status === 'Completed';
        const notificationConfig = isCompleted
            ? NotificationMessages.sales.paymentCompleted
            : NotificationMessages.sales.paymentAdded;

        await sendSalesNotification(
            tenantId,
            result.updatedSales.outletId,
            notificationConfig.title,
            notificationConfig.message(
                result.updatedSales.id,
                result.totalNewPaymentAmount.toFixed(0)
            ),
            {
                type: result.updatedSales.status === 'Completed' ? 'payment_completed' : 'payment_added',
                salesId: result.updatedSales.id,
                paymentAmount: result.totalNewPaymentAmount.toNumber(),
                remainingAmount: result.remainingAmount.toNumber(),
                newStatus: result.updatedSales.status,
                outletId: result.updatedSales.outletId,
                triggeringUserId: performedBy.userId,
                triggeringUsername: performedBy.username,
                timestamp: new Date().toISOString()
            }
        );

        // Return the complete updated sales record with all relationships
        return getById(databaseName, salesId);
    }
    catch (error) {
        throw error;
    }
}

let voidSales = async (
    databaseName: string,
    tenantId: number,
    performedBy: PerformedBy,
    salesId: number
) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const result = await tenantPrisma.$transaction(async (tx) => {
            // Get the sales record
            const sales = await tx.sales.findUnique({
                where: {
                    id: salesId,
                    deleted: false
                },
                include: {
                    salesItems: true,
                    payments: true
                }
            });
            if (!sales) {
                throw new NotFoundError("Sales");
            }
            if (sales.status === "Delivered") {
                throw new BusinessLogicError("Cannot void a delivered sale");
            }
            if (sales.status !== "Completed") {
                throw new BusinessLogicError("Only completed sales can be voided");
            }

            // Update sales status to voided
            const updatedSales = await tx.sales.update({
                where: {
                    id: salesId
                },
                data: {
                    status: "Voided"
                }
            });

            // Update payment status to voided
            await tx.payment.updateMany({
                where: {
                    salesId: salesId
                },
                data: {
                    status: "Voided"
                }
            });

            // Restore stock for each sales item (with variant support)
            await Promise.all(
                sales.salesItems.map(async (salesItem) => {
                    const restoreQty = getEffectiveStockQty(
                        new Decimal(salesItem.quantity),
                        salesItem.stockConsumptionQty
                    );

                    // Update Stock Balance - add back the quantities
                    const stockBalance = await tx.stockBalance.findFirst({
                        where: {
                            itemId: salesItem.itemId,
                            itemVariantId: salesItem.itemVariantId || null,
                            outletId: sales.outletId,
                            deleted: false,
                        },
                    });

                    if (stockBalance) {
                        await tx.stockBalance.update({
                            where: {
                                id: stockBalance.id,
                            },
                            data: {
                                availableQuantity: {
                                    increment: restoreQty.toNumber(),
                                },
                                onHandQuantity: {
                                    increment: restoreQty.toNumber(),
                                },
                            },
                        });
                        // Create Stock Movement record for the void
                        await tx.stockMovement.create({
                            data: {
                                itemId: salesItem.itemId,
                                itemVariantId: salesItem.itemVariantId || null,
                                outletId: sales.outletId,
                                previousAvailableQuantity: stockBalance.availableQuantity.toNumber(),
                                previousOnHandQuantity: stockBalance.onHandQuantity.toNumber(),
                                availableQuantityDelta: restoreQty.toNumber(),
                                onHandQuantityDelta: restoreQty.toNumber(),
                                movementType: 'Sales Void',
                                documentId: salesId,
                                reason: '',
                                remark: `Sales #${salesId} voided`,
                            },
                        });
                    }
                })
            );

            // ── Loyalty Reversal ──
            if (performedBy.loyaltyTier && performedBy.loyaltyTier !== 'none' && sales.customerId) {
                await reverseLoyaltyForSale(tx, sales, performedBy);
            }
            // ── End Loyalty Reversal ──

            return updatedSales;
        });

        // Send notification after successful void
        await sendSalesNotification(
            tenantId,
            result.outletId,
            NotificationMessages.sales.saleVoided.title,
            NotificationMessages.sales.saleVoided.message(
                result.id,
                new Decimal(result.totalAmount).toFixed(0)
            ),
            {
                type: 'sale_voided',
                salesId: result.id,
                amount: new Decimal(result.totalAmount).toNumber(),
                customerName: result.customerName || 'Walk-in Customer',
                previousStatus: 'Completed',
                outletId: result.outletId,
                triggeringUserId: performedBy.userId,
                triggeringUsername: performedBy.username,
                timestamp: new Date().toISOString()
            }
        );

        return getById(databaseName, salesId);
    }
    catch (error) {
        throw error;
    }
}

let returnSales = async (
    databaseName: string,
    tenantId: number,
    performedBy: PerformedBy,
    salesId: number
) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const result = await tenantPrisma.$transaction(async (tx) => {
            // Get the sales record
            const sales = await tx.sales.findUnique({
                where: {
                    id: salesId,
                    deleted: false
                },
                include: {
                    salesItems: true,
                    payments: true
                }
            });
            if (!sales) {
                throw new NotFoundError("Sales");
            }
            if (sales.status === "Delivered") {
                throw new BusinessLogicError("Cannot return a delivered sale. Please contact support.");
            }
            if (sales.status !== "Completed") {
                throw new BusinessLogicError("Only completed sales can be returned");
            }

            // Update sales status to returned
            const updatedSales = await tx.sales.update({
                where: {
                    id: salesId
                },
                data: {
                    status: "Returned"
                }
            });

            // Update payment status to returned
            await tx.payment.updateMany({
                where: {
                    salesId: salesId
                },
                data: {
                    status: "Returned"
                }
            });

            // Restore stock for each sales item (with variant support)
            await Promise.all(
                sales.salesItems.map(async (salesItem) => {
                    const restoreQty = getEffectiveStockQty(
                        new Decimal(salesItem.quantity),
                        salesItem.stockConsumptionQty
                    );

                    // Update Stock Balance - add back the quantities
                    const stockBalance = await tx.stockBalance.findFirst({
                        where: {
                            itemId: salesItem.itemId,
                            itemVariantId: salesItem.itemVariantId || null,
                            outletId: sales.outletId,
                            deleted: false,
                        },
                    });

                    if (stockBalance) {
                        await tx.stockBalance.update({
                            where: {
                                id: stockBalance.id,
                            },
                            data: {
                                availableQuantity: {
                                    increment: restoreQty.toNumber(),
                                },
                                onHandQuantity: {
                                    increment: restoreQty.toNumber(),
                                },
                            },
                        });

                        // Create Stock Movement record for the return
                        await tx.stockMovement.create({
                            data: {
                                itemId: salesItem.itemId,
                                itemVariantId: salesItem.itemVariantId || null,
                                outletId: sales.outletId,
                                previousAvailableQuantity: stockBalance.availableQuantity,
                                previousOnHandQuantity: stockBalance.onHandQuantity,
                                availableQuantityDelta: restoreQty.toNumber(),
                                onHandQuantityDelta: restoreQty.toNumber(),
                                movementType: 'Sales Return',
                                documentId: salesId,
                                reason: '',
                                remark: `Sales #${salesId} returned`,
                            },
                        });
                    }
                })
            );

            // ── Loyalty Reversal ──
            if (performedBy.loyaltyTier && performedBy.loyaltyTier !== 'none' && sales.customerId) {
                await reverseLoyaltyForSale(tx, sales, performedBy);
            }
            // ── End Loyalty Reversal ──

            return updatedSales;
        });

        // Send notification after successful return
        await sendSalesNotification(
            tenantId,
            result.outletId,
            NotificationMessages.sales.saleReturned.title,
            NotificationMessages.sales.saleReturned.message(
                result.id,
                new Decimal(result.totalAmount).toFixed(0)
            ),
            {
                type: 'sale_returned',
                salesId: result.id,
                amount: new Decimal(result.totalAmount).toNumber(),
                customerName: result.customerName || 'Walk-in Customer',
                previousStatus: 'Completed',
                outletId: result.outletId,
                triggeringUserId: performedBy.userId,
                triggeringUsername: performedBy.username,
                timestamp: new Date().toISOString()
            }
        );

        return getById(databaseName, salesId);
    }
    catch (error) {
        throw error;
    }
}

let refundSales = async (
    databaseName: string,
    tenantId: number,
    performedBy: PerformedBy,
    salesId: number
) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const result = await tenantPrisma.$transaction(async (tx) => {
            // Get the sales record
            const sales = await tx.sales.findUnique({
                where: {
                    id: salesId,
                    deleted: false
                },
                include: {
                    salesItems: true,
                    payments: true
                }
            });
            if (!sales) {
                throw new NotFoundError("Sales");
            }
            if (sales.status === "Delivered") {
                throw new BusinessLogicError("Cannot refund a delivered sale. Please contact support.");
            }
            if (sales.status !== "Completed") {
                throw new BusinessLogicError("Only completed sales can be refunded");
            }

            // Update sales status to refunded
            const updatedSales = await tx.sales.update({
                where: {
                    id: salesId
                },
                data: {
                    status: "Refunded"
                }
            });

            // Update payment status to refunded
            await tx.payment.updateMany({
                where: {
                    salesId: salesId
                },
                data: {
                    status: "Refunded"
                }
            });

            // Restore stock for each sales item (with variant support)
            await Promise.all(
                sales.salesItems.map(async (salesItem) => {
                    const restoreQty = getEffectiveStockQty(
                        new Decimal(salesItem.quantity),
                        salesItem.stockConsumptionQty
                    );

                    // Update Stock Balance - add back the quantities
                    const stockBalance = await tx.stockBalance.findFirst({
                        where: {
                            itemId: salesItem.itemId,
                            itemVariantId: salesItem.itemVariantId || null,
                            outletId: sales.outletId,
                            deleted: false,
                        },
                    });
                    if (stockBalance) {
                        await tx.stockBalance.update({
                            where: {
                                id: stockBalance.id,
                            },
                            data: {
                                availableQuantity: {
                                    increment: restoreQty.toNumber(),
                                },
                                onHandQuantity: {
                                    increment: restoreQty.toNumber(),
                                },
                            },
                        });

                        // Create Stock Movement record for the refund
                        await tx.stockMovement.create({
                            data: {
                                itemId: salesItem.itemId,
                                itemVariantId: salesItem.itemVariantId || null,
                                outletId: sales.outletId,
                                previousAvailableQuantity: stockBalance.availableQuantity,
                                previousOnHandQuantity: stockBalance.onHandQuantity,
                                availableQuantityDelta: restoreQty.toNumber(),
                                onHandQuantityDelta: restoreQty.toNumber(),
                                movementType: 'Sales Refund',
                                documentId: salesId,
                                reason: '',
                                remark: `Sales #${salesId} refunded`,
                            },
                        });
                    }
                })
            );

            // ── Loyalty Reversal ──
            if (performedBy.loyaltyTier && performedBy.loyaltyTier !== 'none' && sales.customerId) {
                await reverseLoyaltyForSale(tx, sales, performedBy);
            }
            // ── End Loyalty Reversal ──

            return updatedSales;
        });

        // Send notification after successful refund
        await sendSalesNotification(
            tenantId,
            result.outletId,
            NotificationMessages.sales.saleRefunded.title,
            NotificationMessages.sales.saleRefunded.message(
                result.id,
                new Decimal(result.totalAmount).toFixed(0)
            ),
            {
                type: 'sale_refunded',
                salesId: result.id,
                amount: new Decimal(result.totalAmount).toNumber(),
                customerName: result.customerName || 'Walk-in Customer',
                previousStatus: 'Completed',
                outletId: result.outletId,
                triggeringUserId: performedBy.userId,
                triggeringUsername: performedBy.username,
                timestamp: new Date().toISOString()
            }
        );

        return getById(databaseName, salesId);
    }
    catch (error) {
        throw error;
    }
}

let getDeliveryList = async (
    databaseName: string,
    outletId: number,
    businessDateFrom?: Date,
    businessDateTo?: Date,
    customerId?: number
) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const where: any = {
            outletId: outletId,
            salesType: 'DELIVERY',
            status: {
                in: ['Completed', 'Partially Paid']
            },
            deliveredAt: null,
            deleted: false,
        };

        if (businessDateFrom) {
            where.businessDate = { gte: businessDateFrom };
        }
        if (businessDateTo) {
            where.businessDate = { ...where.businessDate, lte: businessDateTo };
        }
        if (customerId) {
            where.customerId = customerId;
        }

        const deliveryList = await tenantPrisma.sales.findMany({
            where,
            select: {
                id: true,
                businessDate: true,
                customerName: true,
                phoneNumber: true,
                shipStreet: true,
                shipCity: true,
                shipState: true,
                shipPostalCode: true,
                shipCountry: true,
                totalAmount: true,
                paidAmount: true,
                status: true,
                remark: true,
                createdAt: true,
                salesItems: {
                    select: {
                        itemName: true,
                        itemCode: true,
                        itemVariantId: true,
                        variantSku: true,
                        variantName: true,
                        quantity: true,
                        price: true,
                        subtotalAmount: true,
                        stockConsumptionQty: true,
                        unitOfMeasure: true,
                    },
                    where: {
                        deleted: false
                    }
                }
            },
            orderBy: {
                businessDate: 'asc'
            }
        });

        return deliveryList;
    } catch (error) {
        throw error;
    }
}

let getDeliveredList = async (
    databaseName: string,
    request: { outletId?: string, skip?: number, take?: number, startDate: string, endDate: string }
) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { outletId, skip = 0, take = 100, startDate, endDate } = request;

    try {
        const parsedOutletId = typeof outletId === 'string' ? parseInt(outletId, 10) : outletId;

        const parsedStartDate = new Date(startDate);
        parsedStartDate.setUTCHours(0, 0, 0, 0);

        const parsedEndDate = new Date(endDate);
        parsedEndDate.setUTCHours(23, 59, 59, 999);

        if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
            throw new Error('Invalid date format');
        }

        const where = {
            outletId: parsedOutletId,
            salesType: 'DELIVERY',
            deliveredAt: {
                not: null,
                gte: parsedStartDate,
                lte: parsedEndDate,
            },
            deleted: false,
        };

        const [total, sales] = await Promise.all([
            tenantPrisma.sales.count({ where }),
            tenantPrisma.sales.findMany({
                where,
                skip,
                take,
                orderBy: [
                    { deliveredAt: 'desc' },
                    { id: 'desc' }
                ],
                select: {
                    id: true,
                    businessDate: true,
                    customerName: true,
                    phoneNumber: true,
                    shipStreet: true,
                    shipCity: true,
                    shipState: true,
                    shipPostalCode: true,
                    shipCountry: true,
                    totalAmount: true,
                    paidAmount: true,
                    status: true,
                    remark: true,
                    createdAt: true,
                    deliveredAt: true,
                    deliveredBy: true,
                    deliveryNotes: true,
                    salesItems: {
                        select: {
                            itemName: true,
                            itemCode: true,
                            itemVariantId: true,
                            variantSku: true,
                            variantName: true,
                            quantity: true,
                            price: true,
                            subtotalAmount: true,
                            stockConsumptionQty: true,
                            unitOfMeasure: true,
                        },
                        where: {
                            deleted: false
                        }
                    }
                }
            })
        ]);

        return {
            data: sales,
            total,
            serverTimestamp: new Date().toISOString(),
        };
    } catch (error) {
        throw error;
    }
}

let confirmDeliveryBatch = async (
    databaseName: string,
    tenantId: number,
    performedBy: { userId: number, username: string },
    salesIds: number[],
    deliveryNotes?: string,
    deliveredAt?: Date
) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);

    try {
        const result = await tenantPrisma.$transaction(async (tx) => {
            // Validate all sales exist and are eligible for delivery
            const sales = await tx.sales.findMany({
                where: {
                    id: { in: salesIds },
                    deleted: false
                }
            });

            if (sales.length !== salesIds.length) {
                throw new NotFoundError('One or more sales records not found');
            }

            // Validate each sale
            const validationErrors: string[] = [];
            sales.forEach(sale => {
                if (sale.salesType !== 'Delivery') {
                    validationErrors.push(`Sales #${sale.id} is not a delivery sale`);
                }
                if (!['Completed', 'Partially Paid'].includes(sale.status)) {
                    validationErrors.push(
                        `Sales #${sale.id} has invalid status: ${sale.status}. Only Completed or Partially Paid sales can be delivered.`
                    );
                }
                if (sale.deliveredAt !== null) {
                    validationErrors.push(`Sales #${sale.id} has already been delivered`);
                }
            });

            if (validationErrors.length > 0) {
                throw new BusinessLogicError(validationErrors.join('; '));
            }

            // Separate sales by payment status
            const completedSales = sales.filter(s => s.status === 'Completed').map(s => s.id);
            const partiallyPaidSales = sales.filter(s => s.status === 'Partially Paid').map(s => s.id);

            const deliveryData = {
                deliveredAt: deliveredAt || new Date(),
                deliveredBy: performedBy.username,
                deliveryNotes: deliveryNotes || '',
                updatedAt: new Date()
            };

            // Update completed sales to 'Delivered' status
            if (completedSales.length > 0) {
                await tx.sales.updateMany({
                    where: { id: { in: completedSales } },
                    data: {
                        status: 'Delivered',
                        ...deliveryData
                    }
                });
            }

            // Update partially paid sales - keep 'Partially Paid' status
            if (partiallyPaidSales.length > 0) {
                await tx.sales.updateMany({
                    where: { id: { in: partiallyPaidSales } },
                    data: deliveryData
                });
            }

            return sales;
        });

        // Send delivery notification (non-blocking)
        const outletId = result[0]?.outletId;
        if (outletId) {
            PushyService.sendToTopic(
                `tenant_${tenantId}_outlet_${outletId}_delivery`,
                {
                    title: NotificationMessages.delivery.deliveriesConfirmed.title,
                    message: NotificationMessages.delivery.deliveriesConfirmed.message(salesIds.length),
                    data: {
                        type: 'delivery_confirmed',
                        salesIds: salesIds,
                        deliveredBy: performedBy.username,
                        deliveredAt: deliveredAt || new Date(),
                        count: salesIds.length,
                        outletId: outletId,
                        triggeringUserId: performedBy.userId,
                        triggeringUsername: performedBy.username,
                        timestamp: new Date().toISOString()
                    }
                },
                tenantId
            ).catch(error => {
                console.error('Failed to send delivery notification:', error);
            });
        }

        return {
            successCount: salesIds.length,
            deliveredSalesIds: salesIds,
            deliveredAt: deliveredAt || new Date()
        };
    } catch (error) {
        throw error;
    }
}

export = {
    getAll,
    getByDateRange,
    getById,
    calculateSales,
    completeNewSales,
    update,
    remove,
    getTotalSalesData,
    getPartiallyPaidSales,
    addPaymentToPartiallyPaidSales,
    voidSales,
    returnSales,
    refundSales,
    getDeliveryList,
    getDeliveredList,
    confirmDeliveryBatch
}