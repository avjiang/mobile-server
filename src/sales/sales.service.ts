import { Payment, Prisma, PrismaClient, Sales, SalesItem, StockBalance, StockMovement } from "../../prisma/client/generated/client"
import { attachSalesItemModifiers } from "./sales-item-modifiers";
import {
    findPaidSaleIdByClientRef,
    findSaleIdByClientRef,
    isClientRefConflict,
    markAlreadyRecorded,
    paymentClientRef,
} from "./client-ref"
import { Decimal } from 'decimal.js';
import { BusinessLogicError, NotFoundError, InsufficientPointsError, TierMismatchError, SubscriptionExpiredError, PlanLimitError, ErrorCode } from "../api-helpers/error"
import { isLitePlan } from "../middleware/require-plan.middleware"
import { SalesRequestBody, SalesCreationRequest, CreateSalesRequest, CalculateSalesObject, CalculateSalesItemObject, DiscountBy, DiscountType, CalculateSalesDto } from "./sales.request"
import { getGlobalPrisma, getTenantPrisma } from '../db';
import { getEffectivePermissions } from '../auth/permission-cache';
import { SyncRequest } from "src/item/item.request";
import PushyService from '../pushy/pushy.service';
import { randomUUID } from 'crypto';
import { NotificationMessages } from '../pushy/notification-messages';
import { sendStockAlerts, StockAlertRow } from '../stock/stock-alerts';
import loyaltyService from '../loyalty/loyalty.service';
import voucherService from '../voucher/voucher.service';
import { netSaleProfit } from './sale-profit';
import { CAP_SETTING_KEY, enforceManualDiscount } from './manual-discount';
import { lineShareOf } from './line-share';
import { latestReceiptCosts } from '../stock/supply-cost';

/**
 * Standard `include` for a sale's line items — excludes soft-deleted lines.
 *
 * `sales_item.IS_DELETED` soft-deletes ONE line without voiding the whole sale.
 * There is no UI or API for this: it is an operator-only data fix applied by raw
 * SQL (drop an erroneous line, then recalculate the sale's totals). The flag is
 * also set in bulk by `remove()`, which cascades it to every line of a deleted
 * sale.
 *
 * Every read that surfaces lines to a client — detail, receipts, delta sync,
 * reports — must exclude them, matching the convention already used by
 * `cost-rate.service`, `item.service` (top-sold) and `sales-cost-restatement`.
 *
 * DELIBERATELY NOT USED by void/return/refund: those reverse stock per line, and
 * whether a soft-deleted line's stock was already corrected by hand is unknown
 * (no SOP exists — the operation is ad-hoc). Filtering there could permanently
 * lose stock, so they keep reversing every line. See the comment at the restore
 * loop in `voidSales`.
 */
const activeSalesItems = { where: { deleted: false } } as const;

// Detail reads (getById / getByRef) also carry each line's F&B modifiers
// (empty for retail / laundry). Not used by the list sync: it never reads lines.
const activeSalesItemsWithModifiers = {
    where: { deleted: false },
    include: {
        selectedModifiers: {
            where: { deleted: false },
            select: { modifierId: true, groupName: true, modifierName: true, price: true, quantity: true },
        },
    },
} as const;

// How many sales a device pulls on its FIRST sync (no cursor yet — fresh install
// or reinstall). Bounded by COUNT, deliberately not by date: a date window's cost
// depends on how busy the tenant is, so it is unbounded and unpredictable, while a
// count window costs the same for a warung and a chain. Anything older stays on the
// server and is reachable via GET /sales/dateRange (the app's date filter), which
// ignores the sync cursor entirely.
// See docs/future/SYNC_COLD_START_AND_SCALABILITY.md.
const COLD_START_SALES_CAP = 100;

// The projection every sales-sync read returns. Extracted so the cold-start and
// delta paths cannot drift apart — a field missing from one of them is a silent
// data-loss bug on the client (see SALES.md §4.4: a field must be in BOTH the
// select and the transform or it never reaches the app).
const salesSyncSelect = {
    id: true,
    outletId: true,
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
    // Terminal attribution (silent-drop fix: in BOTH select and transform)
    siteId: true,
    // Laundry intake→pickup identity (silent-drop fix per SALES.md §4.4:
    // must be in BOTH select and transform or it never reaches the client)
    orderRef: true,
    friendlyNumber: true,
    collectedAt: true,
    // F&B counter queue number + "atas nama" label
    queueNo: true,
    customerLabel: true,
    // Loyalty fields
    loyaltyPointsEarned: true,
    loyaltyPointsRedeemed: true,
    loyaltyPointsRedemptionValue: true,
    loyaltyTierDiscountPercent: true,
    loyaltyTierDiscountAmount: true,
    customerSubscriptionId: true,
    subscriptionDiscountAmount: true,
    // Voucher fields
    voucherId: true,
    voucherDiscountPercentage: true,
    voucherDiscountAmount: true,
    payments: {
        select: {
            method: true
        }
    },
    salesItems: activeSalesItems
} as const;

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

// ============================================
// Pure loyalty helpers (exported via __testables)
// ============================================

/**
 * Decide whether the customer's voucher or tier discount applies on a sale
 * given the configured percentages/amounts. Mirrors the math in
 * `_applyLoyaltyDiscounts` (FE) and `processLoyaltyForSale` (BE) — tie
 * goes to tier (strict `>` on voucher), and voucher FIXED is capped at
 * totalAmount. Returns the winning option's amount + which side won; the
 * caller writes the result onto the Sales record.
 *
 * Pure: no DB, no Prisma — backs docs LOYALTY.md §2 "Discount Stacking
 * Order" + tester guide §16 (Scenarios A–G).
 */
function pickBestDiscount(input: {
    tierDiscountPercentage: number;
    voucherDiscountType?: 'PERCENTAGE' | 'FIXED' | null;
    voucherDiscountPercentage?: number;
    voucherDiscountAmount?: number;
    hasVoucher: boolean;
    totalAmount: Decimal;
}): { winner: 'tier' | 'voucher' | 'none'; tierAmount: Decimal; voucherAmount: Decimal } {
    const zero = new Decimal(0);
    const tierAmount = input.tierDiscountPercentage > 0
        ? input.totalAmount.times(input.tierDiscountPercentage).dividedBy(100)
        : zero;

    let voucherAmount = zero;
    if (input.hasVoucher) {
        if (input.voucherDiscountType === 'PERCENTAGE') {
            voucherAmount = input.totalAmount.times(input.voucherDiscountPercentage ?? 0).dividedBy(100);
        } else if (input.voucherDiscountType === 'FIXED') {
            voucherAmount = new Decimal(input.voucherDiscountAmount ?? 0);
        }
        if (voucherAmount.gt(input.totalAmount)) voucherAmount = input.totalAmount;
    }

    // Strict `>` — tie goes to tier (docs §2 "Tie goes to tier").
    if (voucherAmount.gt(tierAmount) && input.hasVoucher) {
        return { winner: 'voucher', tierAmount, voucherAmount };
    }
    if (tierAmount.gt(0)) {
        return { winner: 'tier', tierAmount, voucherAmount };
    }
    return { winner: 'none', tierAmount, voucherAmount };
}

/**
 * The total the tier discount was taken on, rebuilt from the sale's FINAL
 * total. Stacking is package → tier OR voucher → points (FE
 * `_applyLoyaltyDiscounts`), so final = base × (1 − pct/100) − points and
 * base = (final + points) / (1 − pct/100). The package is not added back: the
 * tier only discounts what the package left.
 */
function tierBaseAfterPackage(finalTotal: Decimal, redemptionValue: Decimal, tierPercentage: number): Decimal {
    return finalTotal.plus(redemptionValue)
        .dividedBy(new Decimal(1).minus(new Decimal(tierPercentage).dividedBy(100)));
}

/**
 * The sale total before ANY loyalty discount (package, tier/voucher, points) —
 * what the package is taken on, since it goes first. Bounds a TIME package's
 * percentage discount in `redeemCustomerSubscription`.
 */
function preLoyaltyTotalOf(finalTotal: Decimal, parts: {
    subscriptionDiscount: Decimal;
    tierDiscount: Decimal;
    voucherDiscount: Decimal;
    redemptionValue: Decimal;
}): Decimal {
    return finalTotal.plus(parts.subscriptionDiscount).plus(parts.tierDiscount)
        .plus(parts.voucherDiscount).plus(parts.redemptionValue);
}

type PointsRoundingMode = 'FLOOR' | 'ROUND' | 'CEIL';

/**
 * Points earned on a completed sale, per docs LOYALTY.md §2 "Points":
 *   totalAmount * program.pointsPerCurrency * tier.pointsMultiplier
 *
 * `totalAmount` is the final price after ALL discounts. The result is
 * rounded to a whole number using the tenant-configured rounding mode
 * (docs §2 "Points are whole numbers only"):
 *   - FLOOR: round down (conservative, default)
 *   - ROUND: round to nearest (0.5 rounds up)
 *   - CEIL : round up (generous)
 *
 * Returns 0 for any non-positive inputs.
 */
function calcPointsEarned(
    totalAmount: Decimal,
    pointsPerCurrency: number,
    pointsMultiplier: number,
    roundingMode: PointsRoundingMode = 'FLOOR',
): number {
    if (totalAmount.lte(0) || pointsPerCurrency <= 0 || pointsMultiplier <= 0) {
        return 0;
    }
    const raw = totalAmount.toNumber() * pointsPerCurrency * pointsMultiplier;
    switch (roundingMode) {
        case 'CEIL':
            return Math.ceil(raw);
        case 'ROUND':
            return Math.round(raw);
        case 'FLOOR':
        default:
            return Math.floor(raw);
    }
}

/**
 * Tier-match validator: the percentage the frontend sent must match the
 * customer's actual tier on file. Tolerance 0.01% to absorb float drift.
 * Throws TierMismatchError if mismatched. Backs docs §8.3
 * "TierMismatchError".
 */
function validateTierMatch(sentPercentage: number, actualPercentage: number): void {
    if (Math.abs(sentPercentage - actualPercentage) > 0.01) {
        throw new TierMismatchError(
            `Tier discount mismatch: requested ${sentPercentage}%, actual ${actualPercentage}%`,
        );
    }
}

// Safely coerce a numeric request field to Decimal. Throws BusinessLogicError
// for non-numeric values so we reject malformed payloads at the boundary.
function toDecimalOrThrow(value: unknown, fieldName: string, itemRef: string): Decimal {
    if (value === null || value === undefined) {
        return new Decimal(0);
    }
    try {
        return new Decimal(value as Decimal.Value);
    } catch {
        throw new BusinessLogicError(`Invalid ${fieldName} for ${itemRef}: must be numeric`);
    }
}

// Reject malformed/negative numerics on sales item rows before any DB work.
// Mirrors the contract documented in docs/modules/STOCK_AND_COST.md §2.
function validateSalesItemNumerics(items: CreateSalesRequest['salesItems']) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new BusinessLogicError('Sale must include at least one sales item');
    }
    for (const item of items) {
        const ref = item.itemName || `itemId ${item.itemId}`;
        const quantity = toDecimalOrThrow(item.quantity, 'quantity', ref);
        if (quantity.lte(0)) {
            throw new BusinessLogicError(`Quantity for ${ref} must be greater than 0`);
        }
        const price = toDecimalOrThrow(item.price, 'price', ref);
        if (price.lt(0)) {
            throw new BusinessLogicError(`Price for ${ref} cannot be negative`);
        }
        const cost = toDecimalOrThrow(item.cost, 'cost', ref);
        if (cost.lt(0)) {
            throw new BusinessLogicError(`Cost for ${ref} cannot be negative`);
        }
        const discount = toDecimalOrThrow(item.discountAmount, 'discountAmount', ref);
        if (discount.lt(0)) {
            throw new BusinessLogicError(`Discount amount for ${ref} cannot be negative`);
        }
        const tax = toDecimalOrThrow(item.taxAmount, 'taxAmount', ref);
        if (tax.lt(0)) {
            throw new BusinessLogicError(`Tax amount for ${ref} cannot be negative`);
        }
    }
}

// Reject malformed/negative payment amounts before any DB work.
function validatePaymentNumerics(payments: Payment[]) {
    if (!Array.isArray(payments)) return;
    for (const [index, payment] of payments.entries()) {
        const ref = `payment[${index}]`;
        const tendered = toDecimalOrThrow(payment.tenderedAmount, 'tenderedAmount', ref);
        if (tendered.lt(0)) {
            throw new BusinessLogicError(`Tendered amount for ${ref} cannot be negative`);
        }
    }
}

// Receive Payment: a payment row records what it actually settles. Cash handed
// over above the balance is change (kept on sales.changeAmount), so each row's
// paidAmount = min(tendered, balance still open), in order — the same rule
// checkout applies. Older apps sent paidAmount = tendered, which overstated cash
// in every report that sums payment rows.
function applyPaymentsToBalance<T extends { tenderedAmount: any }>(payments: T[], remaining: Decimal): (T & { paidAmount: Decimal })[] {
    let open = Decimal.max(remaining, 0);
    return payments.map(payment => {
        const applied = Decimal.min(new Decimal(payment.tenderedAmount), open);
        open = open.minus(applied);
        return { ...payment, paidAmount: applied };
    });
}

// Session that completes a sale on Receive Payment: the last payment that
// carries one (the app stamps the open session on each payment). null when none
// does — e.g. a payment taken with no session open — so the sale keeps today's
// behaviour rather than landing in a guessed session.
function completingSessionOf(payments: { sessionId?: any }[]): number | null {
    for (let i = payments.length - 1; i >= 0; i--) {
        const id = Number(payments[i].sessionId);
        if (Number.isInteger(id) && id > 0) return id;
    }
    return null;
}

// Extended performedBy with loyaltyTier for loyalty integration
interface PerformedBy {
    userId: number;
    username: string;
    loyaltyTier?: 'none' | 'basic' | 'advanced';
    // JWT planName. Only the checkout path sets it (Retail Lite rules below).
    planName?: string | null;
    // Effective permission names from the JWT ('*' = super-admin wildcard). Used to gate
    // the manual stock-source override (AD6 / F3). Missing/empty → no override.
    permissions?: string[];
}

// ── Stock sourcing (AD6) ──────────────────────────────────────────────────────
// A sale draws stock from the outlet first, then from warehouse(s) for any
// remainder (automatic per-line split). A user holding this permission (or super
// admin) may instead force a single explicit source for the whole sale.
const OVERRIDE_STOCK_SOURCE_PERMISSION = 'Override Stock Source';

type SaleSourceKind = 'OUTLET' | 'WAREHOUSE';

/**
 * One stock location a sale can draw from (outlet or a single warehouse), bundling
 * its Prisma delegates + the in-memory FIFO/consumption state built during a sale.
 * The two table-sets share identical FIFO mechanics, so the same loop drives both.
 */
interface SaleStockSource {
    kind: SaleSourceKind;
    locationId: number;
    balanceDelegate: any;   // tx.stockBalance | tx.warehouseStockBalance
    receiptDelegate: any;   // tx.stockReceipt | tx.warehouseStockReceipt
    movementDelegate: any;  // tx.stockMovement | tx.warehouseStockMovement
    locWhere: any;          // { outletId } | { warehouseId }
    balanceMap: Map<string, any>;        // lookupKey -> balance row
    receiptsByItem: Map<string, any[]>;  // lookupKey -> FIFO receipts (mutated in-memory)
    originalReceiptQty: Map<number, Decimal>; // receiptId -> qty before this sale
    remainingBalance: Map<string, Decimal>;   // lookupKey -> available left to allocate
    receiptUpdateMap: Map<number, Decimal>;   // receiptId -> qty consumed this sale
    consumedByItem: Map<string, Decimal>;     // lookupKey -> total consumed (for balance/movement)
}

function makeSaleStockSource(tx: any, kind: SaleSourceKind, locationId: number): SaleStockSource {
    const isWh = kind === 'WAREHOUSE';
    return {
        kind,
        locationId,
        balanceDelegate: isWh ? tx.warehouseStockBalance : tx.stockBalance,
        receiptDelegate: isWh ? tx.warehouseStockReceipt : tx.stockReceipt,
        movementDelegate: isWh ? tx.warehouseStockMovement : tx.stockMovement,
        locWhere: isWh ? { warehouseId: locationId } : { outletId: locationId },
        balanceMap: new Map(),
        receiptsByItem: new Map(),
        originalReceiptQty: new Map(),
        remainingBalance: new Map(),
        receiptUpdateMap: new Map(),
        consumedByItem: new Map(),
    };
}

// Helper function to send sales notifications (non-blocking)
/**
 * Classifies the laundry SERVICE items among the given sales' line items:
 *   'wash' — a service item with a machine capacity (`defaultLoadWeightKg > 0`)
 *   'jasa' — a service item without one (flat or per-kg per-piece service)
 * Supplies and retail products are omitted (not in the map). A load weight alone
 * can't classify an order — a per-kg jasa also carries a weight — so the machine
 * capacity is the reliable signal. One indexed `IN (...)` query; empty map for
 * retail tenants / item-less orders. The caller folds these per line into a single
 * per-order kind (wash / jasa / mixed) so a combined order isn't mislabelled.
 */
async function loadLaundryServiceKinds(
    tenantPrisma: PrismaClient,
    sales: Array<{ salesItems: Array<{ itemId: number }> }>,
): Promise<Map<number, 'wash' | 'jasa'>> {
    const kinds = new Map<number, 'wash' | 'jasa'>();
    const itemIds = [...new Set(sales.flatMap(s => s.salesItems.map(si => si.itemId)))];
    if (itemIds.length === 0) return kinds;
    const items = await tenantPrisma.item.findMany({
        where: { id: { in: itemIds }, itemType: 'service' },
        select: { id: true, defaultLoadWeightKg: true },
    });
    for (const it of items) {
        kinds.set(it.id, Number(it.defaultLoadWeightKg ?? 0) > 0 ? 'wash' : 'jasa');
    }
    return kinds;
}

/**
 * Folds the per-item kinds into a single per-order tag:
 *   'wash'  — only wash service line(s)
 *   'jasa'  — only per-piece/per-kg service line(s)
 *   'mixed' — both (e.g. a wash + an ironing add-on)
 *   null    — neither (retail / supplies only)
 */
/// A laundry supply-depletion line: the consumable consumed by a wash/service —
/// zero price, no processed weight, but a tracked consumption quantity (matches
/// the FE `_isLaundrySupplyLine` / pickup-screen reconstruction). Retail has none.
function isSupplyLine(
    it: { price: any; loadWeightKg: any; stockConsumptionQty: any },
): boolean {
    return (
        Number(it.price ?? 0) === 0 &&
        (it.loadWeightKg == null || Number(it.loadWeightKg) === 0) &&
        it.stockConsumptionQty != null &&
        Number(it.stockConsumptionQty) > 0
    );
}

/// Single in-memory pass over an order's lines producing every per-order field the
/// sales-list payload needs: billable `totalItems` (supplies excluded), total
/// processed `loadWeightKg` (sum of wash-service weights; null for retail), and the
/// `laundryServiceKind` ('wash' | 'jasa' | 'mixed' | null). Replaces three separate
/// scans (count + weight reduce + kind classify) with one loop.
function summarizeSalesLines(
    salesItems: Array<{ itemId: number; price: any; loadWeightKg: any; stockConsumptionQty: any }>,
    serviceKinds: Map<number, 'wash' | 'jasa'>,
): { totalItems: number; loadWeightKg: number | null; laundryServiceKind: 'wash' | 'jasa' | 'mixed' | null } {
    let totalItems = 0;
    let weight = 0;
    let hasWash = false;
    let hasJasa = false;
    for (const it of salesItems) {
        if (!isSupplyLine(it)) totalItems++;
        weight += Number(it.loadWeightKg ?? 0);
        const k = serviceKinds.get(it.itemId);
        if (k === 'wash') hasWash = true;
        else if (k === 'jasa') hasJasa = true;
    }
    const laundryServiceKind = hasWash && hasJasa ? 'mixed' : hasWash ? 'wash' : hasJasa ? 'jasa' : null;
    return { totalItems, loadWeightKg: weight > 0 ? weight : null, laundryServiceKind };
}

type SalesSyncRow = Prisma.SalesGetPayload<{ select: typeof salesSyncSelect }>;

/// The client row for one sale — shared by EVERY sales-list read the app syncs
/// (delta / cold start, date range, partially paid). The app upserts these rows
/// whole into its local `sales_histories` table, so a read that omits a field
/// doesn't just leave it out: it erases it on the device. That happened
/// 2026-09-28 — the partially-paid read had its own trimmed copy without
/// orderRef / friendlyNumber / collectedAt, and pay-at-pickup laundry orders
/// vanished from the pickup queue. Add new fields HERE (and to
/// salesSyncSelect), never to one query.
function toSalesSyncRow(sale: SalesSyncRow, serviceKinds: Map<number, 'wash' | 'jasa'>) {
    return {
        id: sale.id,
        outletId: sale.outletId,
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
        // Laundry per-order rollups (billable item count with supplies
        // excluded, total processed weight, and service kind) computed in a
        // single in-memory pass over the already-loaded lines. null weight/kind
        // for retail → payload unchanged.
        ...summarizeSalesLines(sale.salesItems, serviceKinds),
        deliveredAt: sale.deliveredAt,
        deliveredBy: sale.deliveredBy,
        // Terminal attribution
        siteId: sale.siteId,
        // Laundry intake→pickup identity
        orderRef: sale.orderRef,
        friendlyNumber: sale.friendlyNumber,
        collectedAt: sale.collectedAt,
        // F&B counter queue number + "atas nama" label
        queueNo: sale.queueNo,
        customerLabel: sale.customerLabel,
        // Loyalty fields
        loyaltyPointsEarned: sale.loyaltyPointsEarned,
        loyaltyPointsRedeemed: sale.loyaltyPointsRedeemed,
        loyaltyPointsRedemptionValue: sale.loyaltyPointsRedemptionValue,
        loyaltyTierDiscountPercent: sale.loyaltyTierDiscountPercent,
        loyaltyTierDiscountAmount: sale.loyaltyTierDiscountAmount,
        customerSubscriptionId: sale.customerSubscriptionId,
        subscriptionDiscountAmount: sale.subscriptionDiscountAmount,
        // Voucher fields
        voucherId: sale.voucherId,
        voucherDiscountPercentage: sale.voucherDiscountPercentage,
        voucherDiscountAmount: sale.voucherDiscountAmount,
        payments: sale.payments || [],
    };
}

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

// ============================================
// Loyalty Integration Helpers
// ============================================

/**
 * Credit earned points for a fully-paid sale — or just bump totalSpend when
 * rounding yields 0 points (small tickets must still progress toward tier
 * auto-upgrade). Shared by the creation path (processLoyaltyForSale step 4)
 * and the pay-on-collection completion path (addPaymentToPartiallyPaidSales)
 * so both apply calcPointsEarned with the tenant's rounding mode — points are
 * whole numbers only (docs LOYALTY.md §2).
 * `account` must include `loyaltyTier` when the tenant is on advanced loyalty.
 * Returns the whole-number points credited.
 */
async function creditEarnedPoints(
    tx: any,
    account: any,
    program: any,
    salesId: number,
    totalAmount: Decimal,
    performedBy: PerformedBy,
): Promise<number> {
    const toNum = loyaltyService.toDecimalNumber;
    let pointsMultiplier = 1.0;
    if (performedBy.loyaltyTier === 'advanced' && account.loyaltyTier) {
        pointsMultiplier = toNum(account.loyaltyTier.pointsMultiplier);
    }
    const pointsEarned = calcPointsEarned(
        totalAmount,
        toNum(program.pointsPerCurrency),
        pointsMultiplier,
        program.pointsRoundingMode,
    );

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
                totalSpend: { increment: totalAmount.toNumber() },
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
                description: `Earned from sale #${salesId}`,
                performedBy: performedBy.username,
            },
        });
    } else {
        // Sale paid but earned 0 points after rounding — still bump totalSpend for tier eligibility.
        await tx.loyaltyAccount.update({
            where: { id: account.id },
            data: { totalSpend: { increment: totalAmount.toNumber() } },
        });
    }
    return pointsEarned;
}

/**
 * Validate + execute one use of a customer's prepaid package (step 3 of
 * processLoyaltyForSale). Not gated on the loyalty tier: a package the customer
 * already paid for stays redeemable after the shop steps down from Pro or its
 * Pro trial ends — only SELLING new packages needs advanced loyalty.
 */
async function redeemCustomerSubscription(
    tx: any,
    customerId: number,
    salesId: number,
    preLoyaltyTotal: Decimal,
    salesBody: CreateSalesRequest,
    performedBy: PerformedBy,
): Promise<{ customerSubscriptionId: number; subscriptionDiscountAmount: Decimal }> {
    const toNum = loyaltyService.toDecimalNumber;
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
    // Audit r2-#2: status may still read ACTIVE if the daily expiry cron has not run yet.
    // Also defend against device-clock skew that lets a stale FE submit a past-end-date sub.
    if (subscription.endDate && new Date() > subscription.endDate) {
        throw new SubscriptionExpiredError();
    }
    if (subscription.customerId !== customerId) {
        throw new BusinessLogicError('Subscription does not belong to this customer');
    }

    // Server-authoritative quota: for USAGE packages, recompute the credits
    // to deduct from the cart itself — one credit per unit of a matching-
    // category item with subtotal > 0 (zero-priced bundled lines like free
    // detergent get no benefit and must not burn quota). Coverage is capped
    // at remainingQuota, most expensive units first (mirrors the FE
    // `_usageCoverage`): a cart with more eligible units than credits gets
    // only the covered units free and the rest stay payable. The client-sent
    // subscriptionQuantityUsed is ignored; legacy clients hardcode 1, which
    // under-deducts multi-item carts. TIME packages keep usedQuota as a
    // plain per-sale counter (1).
    let quantityUsed = 1;
    // Upper bound for the USAGE discount: value of the covered units only.
    let usageCoveredValue: Decimal | null = null;
    if (subscription.subscriptionPackage.packageType === 'USAGE') {
        const packageCategoryIds = new Set(
            subscription.subscriptionPackage.categories.map((c: any) => c.categoryId),
        );
        const cartItemIds = (salesBody.salesItems ?? [])
            .filter((it: any) => !it.deleted)
            .map((it: any) => it.itemId);
        const cartItems = await tx.item.findMany({
            where: { id: { in: cartItemIds } },
            select: { id: true, categoryId: true },
        });
        const itemCategoryById = new Map(cartItems.map((it: any) => [it.id, it.categoryId]));
        const eligible: { unitPrice: Decimal; quantity: number }[] = [];
        for (const it of salesBody.salesItems ?? []) {
            if ((it as any).deleted) continue;
            const categoryId = itemCategoryById.get(it.itemId);
            const subtotal = new Decimal(it.subtotalAmount ?? 0);
            const quantity = new Decimal(it.quantity ?? 0).toNumber();
            if (categoryId != null && packageCategoryIds.has(categoryId) && subtotal.gt(0) && quantity > 0) {
                eligible.push({ unitPrice: subtotal.dividedBy(quantity), quantity });
            }
        }
        if (eligible.length === 0) {
            throw new BusinessLogicError(
                'Subscription cannot be used: no items in this sale match the package categories',
            );
        }
        eligible.sort((a, b) => b.unitPrice.comparedTo(a.unitPrice));
        let remaining = subscription.remainingQuota ?? Number.POSITIVE_INFINITY;
        let unitsCovered = 0;
        let coveredValue = new Decimal(0);
        for (const line of eligible) {
            if (remaining <= 0) break;
            const take = Math.min(line.quantity, remaining);
            coveredValue = coveredValue.plus(line.unitPrice.times(take));
            unitsCovered += take;
            remaining -= take;
        }
        quantityUsed = Math.ceil(unitsCovered);
        usageCoveredValue = coveredValue;
        if (quantityUsed <= 0) {
            throw new BusinessLogicError(
                'Subscription cannot be used: no remaining quota covers any item in this sale',
            );
        }
    }

    // For USAGE packages, check and deduct quota
    if (subscription.subscriptionPackage.packageType === 'USAGE') {
        if (subscription.remainingQuota === null || subscription.remainingQuota < quantityUsed) {
            throw new BusinessLogicError(
                `Insufficient subscription quota. Remaining: ${subscription.remainingQuota ?? 0}`
            );
        }

        // Optimistic-lock with assertion: prisma.update silently no-ops on 0 matches
        // when a composite where misses, so we use updateMany and check count.
        // Race: two cashiers both reading version=N — the second update sees 0 rows.
        const decrementResult = await tx.customerSubscription.updateMany({
            where: { id: subscription.id, version: subscription.version },
            data: {
                remainingQuota: { decrement: quantityUsed },
                usedQuota: { increment: quantityUsed },
                version: { increment: 1 },
            },
        });
        if (decrementResult.count !== 1) {
            throw new BusinessLogicError(
                'Subscription was modified concurrently. Please retry the sale.'
            );
        }

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

    // Audit r1-#4: subscriptionDiscountAmount was previously stored as-sent. Bound it.
    // The package category × item matching is item-level; doing a full recompute here
    // would require per-item category lookups. Instead we apply a tight upper bound:
    //   - TIME + fixed: discount ≤ package.discountAmount
    //   - TIME + %: discount ≤ preDiscountTotal × pct / 100
    //   - USAGE: discount ≤ preDiscountTotal (100% of matching items, max = full cart)
    // preDiscountTotal = the cart total before THIS subscription discount was
    // applied — the pre-loyalty total, since the package goes first. (It used
    // to be final + package, which left out tier/voucher and points and could
    // reject a valid TIME % package sale that also used a voucher.)
    const sentSubDiscount = new Decimal(salesBody.subscriptionDiscountAmount || 0);
    const preDiscountTotal = preLoyaltyTotal;
    const pkg = subscription.subscriptionPackage;
    let maxSubDiscount: Decimal;
    if (pkg.packageType === 'TIME') {
        if (pkg.discountPercentage && toNum(pkg.discountPercentage) > 0) {
            maxSubDiscount = preDiscountTotal.times(toNum(pkg.discountPercentage)).dividedBy(100);
        } else if (pkg.discountAmount && toNum(pkg.discountAmount) > 0) {
            maxSubDiscount = new Decimal(toNum(pkg.discountAmount));
        } else {
            maxSubDiscount = new Decimal(0);
        }
    } else {
        // USAGE — 100% off the quota-covered units only (computed above),
        // never the whole matching subtotal: with 8 credits left and 11
        // eligible washes, only 8 units' value is discountable.
        maxSubDiscount = usageCoveredValue ?? preDiscountTotal;
    }
    if (sentSubDiscount.gt(maxSubDiscount.plus(0.01))) {
        throw new BusinessLogicError(
            `Subscription discount exceeds maximum allowed: sent ${sentSubDiscount}, max ${maxSubDiscount}`
        );
    }
    return { customerSubscriptionId: subscription.id, subscriptionDiscountAmount: sentSubDiscount };
}

/**
 * Process loyalty earn/redeem/subscription within a sales transaction.
 * Called inside $transaction by completeNewSales for ANY sale with a customer
 * (Completed, Partially Paid, pay-on-collection): the discount legs (tier /
 * voucher / redemption / subscription, steps 0-3) are locked into the price
 * at creation, so their deductions MUST execute at creation too — otherwise a
 * deferred-payment sale grants the discount without burning points / quota /
 * voucher. Only the EARN leg (step 4) is gated on `includeEarn` (= fully
 * paid); for deferred sales it runs later via addPaymentToPartiallyPaidSales
 * when the balance clears.
 * Returns loyalty data to store on the Sales record.
 */
async function processLoyaltyForSale(
    tx: any,
    db: string,
    salesId: number,
    customerId: number,
    totalAmount: Decimal,
    salesBody: CreateSalesRequest,
    performedBy: PerformedBy,
    includeEarn: boolean
): Promise<{
    loyaltyPointsEarned: Decimal;
    loyaltyPointsRedeemed: Decimal;
    loyaltyPointsRedemptionValue: Decimal;
    loyaltyTierDiscountPercent: Decimal;
    loyaltyTierDiscountAmount: Decimal;
    customerSubscriptionId: number | null;
    subscriptionDiscountAmount: Decimal;
    loyaltyAccountId: number | null;
    voucherId: number | null;
    voucherDiscountPercentage: Decimal;
    voucherDiscountAmount: Decimal;
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
        voucherId: null as number | null,
        voucherDiscountPercentage: zero,
        voucherDiscountAmount: zero,
    };

    // Loyalty off (Basic/Lite, or after a step down from Pro): points are frozen
    // and nothing is EARNED — but whatever the customer already holds is still
    // USED ("a lower plan blocks adding, never using"): a prepaid package, a
    // voucher issued on Pro, and — for a sale rung up on Pro and synced after
    // the step down — the points and tier discount the till already gave.
    // Ignoring those legs kept the discount in the total but left the voucher
    // ACTIVE, the points undeducted and the sale's discount fields at 0.
    const loyaltyOff = !performedBy.loyaltyTier || performedBy.loyaltyTier === 'none';
    const carriesLoyaltyLegs = !!salesBody.voucherId
        || (salesBody.loyaltyPointsToRedeem || 0) > 0
        || (salesBody.loyaltyTierDiscountPercentage || 0) > 0;
    if (loyaltyOff && !carriesLoyaltyLegs) {
        if (salesBody.customerSubscriptionId) {
            // Only the package applies here, so pre-loyalty = final + package.
            const preLoyaltyTotal = totalAmount.plus(new Decimal(salesBody.subscriptionDiscountAmount || 0));
            Object.assign(result, await redeemCustomerSubscription(
                tx, customerId, salesId, preLoyaltyTotal, salesBody, performedBy,
            ));
        }
        return result;
    }
    const tierDiscountAllowed = performedBy.loyaltyTier === 'advanced' || loyaltyOff;

    // Find loyalty account for this customer
    const account = await tx.loyaltyAccount.findFirst({
        where: { customerId, deleted: false },
        include: tierDiscountAllowed ? { loyaltyTier: true } : undefined,
    });

    // No points or tier can apply (customer not enrolled, or the program is
    // switched off), but a voucher the customer holds and a prepaid package
    // still do. Both exits used to return before them, so the till gave the
    // discount while the voucher stayed ACTIVE (reusable) and the package
    // quota was never taken.
    const redeemHeldValueOnly = async () => {
        if (salesBody.voucherId) {
            const voucherBase = voucherService.voucherBaseAfterPackage(
                totalAmount, new Decimal(0), salesBody.voucherDiscountAmount,
            );
            if (voucherBase.gt(0)) {
                const voucherResult = await voucherService.validateAndRedeemVoucher(
                    tx, salesBody.voucherId, customerId, salesId, voucherBase,
                    salesBody.voucherDiscountPercentage, salesBody.voucherDiscountAmount,
                );
                result.voucherId = voucherResult.voucherId;
                result.voucherDiscountPercentage = voucherResult.voucherDiscountPercentage;
                result.voucherDiscountAmount = voucherResult.voucherDiscountAmount;
            }
        }
        if (salesBody.customerSubscriptionId) {
            const preLoyaltyTotal = preLoyaltyTotalOf(totalAmount, {
                subscriptionDiscount: new Decimal(salesBody.subscriptionDiscountAmount || 0),
                tierDiscount: zero,
                voucherDiscount: result.voucherDiscountAmount,
                redemptionValue: zero,
            });
            Object.assign(result, await redeemCustomerSubscription(
                tx, customerId, salesId, preLoyaltyTotal, salesBody, performedBy,
            ));
        }
        return result;
    };

    if (!account) return await redeemHeldValueOnly();
    result.loyaltyAccountId = account.id;

    const program = await loyaltyService.getCachedProgram(db);
    if (!program || !program.isActive) return await redeemHeldValueOnly();

    const toNum = loyaltyService.toDecimalNumber;

    // Stacking order (FE `_applyLoyaltyDiscounts`): prepaid package → tier OR
    // voucher on what the package left → points. `totalAmount` is the FINAL
    // figure, so each base below is rebuilt from it.
    const redemptionValueSent = new Decimal(salesBody.loyaltyPointsToRedeem || 0)
        .times(toNum(program.currencyPerPoint));

    // 0. VALIDATE voucher (if present — runs BEFORE tier discount)
    if (salesBody.voucherId) {
        // The voucher is taken on the total AFTER the package. Validating
        // against the final total rejected every voucher sale ("sent 6000,
        // expected 5400" on a 60,000 cart at 10%).
        const voucherBase = voucherService.voucherBaseAfterPackage(
            totalAmount,
            redemptionValueSent,
            salesBody.voucherDiscountAmount,
        );
        // Nothing left after the package (it covered the whole sale): the
        // voucher is worth 0 here, so it is NOT redeemed — it stays ACTIVE for
        // a sale where it is worth something. The FE never sends one in this
        // case; this guards a client that does.
        if (voucherBase.gt(0)) {
            const voucherResult = await voucherService.validateAndRedeemVoucher(
                tx, salesBody.voucherId, customerId, salesId, voucherBase,
                salesBody.voucherDiscountPercentage, salesBody.voucherDiscountAmount,
            );
            result.voucherId = voucherResult.voucherId;
            result.voucherDiscountPercentage = voucherResult.voucherDiscountPercentage;
            result.voucherDiscountAmount = voucherResult.voucherDiscountAmount;
        }
        // Skip tier discount — voucher and tier are mutually exclusive
    }

    // 1. VALIDATE tier discount (advanced, or a sale rung up on advanced and
    // synced after a step down) — skipped if voucher was applied
    else if (tierDiscountAllowed && salesBody.loyaltyTierDiscountPercentage && salesBody.loyaltyTierDiscountPercentage > 0) {
        const tier = (account as any).loyaltyTier;
        const actualPercentage = tier ? toNum(tier.discountPercentage) : 0;
        validateTierMatch(salesBody.loyaltyTierDiscountPercentage, actualPercentage);
        // Recompute amount from the authoritative percentage (audit r1-#9: the
        // client-sent amount could be inflated) — but on the SAME base the FE
        // stacking uses: the total after the package. `totalAmount` here is the
        // FINAL figure (after package, tier and redemption), so reverse the
        // waterfall: base = (final + redemption) / (1 - pct/100). Using final
        // directly understated the stored amount (e.g. 2% on a 30,000 cart with
        // 5,000 redeemed stored 488 instead of 600, and subtotal - discounts no
        // longer reconciled to the total).
        result.loyaltyTierDiscountPercent = new Decimal(actualPercentage);
        if (actualPercentage > 0 && actualPercentage < 100) {
            const tierBase = tierBaseAfterPackage(totalAmount, redemptionValueSent, actualPercentage);
            result.loyaltyTierDiscountAmount = tierBase.times(actualPercentage).dividedBy(100);
        } else {
            result.loyaltyTierDiscountAmount = totalAmount.times(actualPercentage).dividedBy(100);
        }
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

        // Recompute redemption value server-side. Audit r1-#5: client-trusted value
        // could be inflated independently of pointsToRedeem.
        result.loyaltyPointsRedeemed = new Decimal(pointsToRedeem);
        result.loyaltyPointsRedemptionValue = new Decimal(pointsToRedeem).times(toNum(program.currencyPerPoint));
    }

    // 3. VALIDATE + EXECUTE subscription usage (any tier, see redeemCustomerSubscription)
    if (salesBody.customerSubscriptionId) {
        const preLoyaltyTotal = preLoyaltyTotalOf(totalAmount, {
            subscriptionDiscount: new Decimal(salesBody.subscriptionDiscountAmount || 0),
            tierDiscount: result.loyaltyTierDiscountAmount,
            voucherDiscount: result.voucherDiscountAmount,
            redemptionValue: result.loyaltyPointsRedemptionValue,
        });
        Object.assign(result, await redeemCustomerSubscription(
            tx, customerId, salesId, preLoyaltyTotal, salesBody, performedBy,
        ));
    }

    // 4. EARN points on finalTotalAmount (after ALL discounts) — only when the
    // sale is fully paid at creation. Deferred-payment sales earn later via
    // addPaymentToPartiallyPaidSales once the balance clears. Never with
    // loyalty off: points are frozen below Pro.
    if (includeEarn && !loyaltyOff && totalAmount.gt(0)) {
        const pointsEarned = await creditEarnedPoints(tx, account, program, salesId, totalAmount, performedBy);
        if (pointsEarned > 0) {
            result.loyaltyPointsEarned = new Decimal(pointsEarned);
        }
    }

    return result;
}

/**
 * Give back the package quota a voided/returned/refunded sale used. Runs for
 * every tier and without a loyalty account: a package use recorded while on
 * Pro (or the Pro trial) is restored even after the shop stepped down.
 */
async function restoreCustomerSubscriptionForSale(tx: any, sale: any): Promise<void> {
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
                    // Reactivate only if quota exhaustion was the reason it expired —
                    // a subscription past its validity endDate stays EXPIRED even
                    // though the quota is restored.
                    ...(subscription.status === 'EXPIRED' &&
                        (!subscription.endDate || subscription.endDate > new Date())
                        ? { status: 'ACTIVE' }
                        : {}),
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

    // Package quota and voucher first — neither depends on a loyalty account
    // (a voucher can be held, and redeemed, without one).
    await restoreCustomerSubscriptionForSale(tx, sale);
    if (sale.voucherId) {
        await voucherService.restoreVoucherForSale(tx, sale.id);
    }

    // Find loyalty account
    const account = await tx.loyaltyAccount.findFirst({
        where: { customerId: sale.customerId, deleted: false },
    });
    if (!account) return;

    // 1. Reverse EARNED points
    const pointsEarned = sale.loyaltyPointsEarned ? new Decimal(sale.loyaltyPointsEarned).toNumber() : 0;
    const saleTotalForReversal = sale.totalAmount ? new Decimal(sale.totalAmount).toNumber() : 0;
    if (pointsEarned > 0) {
        const earnBatch = await tx.loyaltyPointBatch.findFirst({
            where: { loyaltyAccountId: account.id, salesId: sale.id, deleted: false },
        });

        // remainingInBatch = points the customer hadn't spent yet from this earn.
        // Those are the only points we can claw back from currentPoints; the rest were
        // already redeemed elsewhere and stay redeemed.
        let remainingInBatch = 0;
        if (earnBatch) {
            remainingInBatch = Math.max(toNum(earnBatch.remainingPoints), 0);
            await tx.loyaltyPointBatch.update({
                where: { id: earnBatch.id },
                data: { remainingPoints: 0, deleted: true, deletedAt: new Date() },
            });
        }

        // Account totals: always reverse the full earn (totalEarned) and the full sale spend
        // (totalSpend) regardless of whether the batch still existed. Only currentPoints is
        // bounded by what's still in the batch.
        await tx.loyaltyAccount.update({
            where: { id: account.id },
            data: {
                currentPoints: { decrement: remainingInBatch },
                totalEarned: { decrement: pointsEarned },
                totalSpend: { decrement: saleTotalForReversal },
            },
        });

        const updatedAccount = await tx.loyaltyAccount.findUnique({ where: { id: account.id } });

        const existingReversal = await tx.loyaltyTransaction.findFirst({
            where: { salesId: sale.id, type: 'EARN_REVERSAL', deleted: false },
        });
        if (!existingReversal) {
            // points field reflects actual balance impact (what we took back from currentPoints),
            // matching balanceAfter. The original earn amount is recoverable via the sale record.
            await tx.loyaltyTransaction.create({
                data: {
                    loyaltyAccountId: account.id,
                    type: 'EARN_REVERSAL',
                    points: -remainingInBatch,
                    balanceAfter: toNum(updatedAccount?.currentPoints ?? 0),
                    salesId: sale.id,
                    description: `Earn reversed for sale #${sale.id} (original ${pointsEarned}, clawed back ${remainingInBatch})`,
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

}

let getAll = async (databaseName: string, request: SyncRequest) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { outletId, skip = 0, take = 100, lastSyncTimestamp } = request;

    try {
        // Ensure outletId is a number
        const parsedOutletId = typeof outletId === 'string' ? parseInt(outletId, 10) : outletId;

        // No cursor yet = fresh install / reinstall. Previously this fell back to
        // "start of today", which left a merchant staring at an almost-empty Sales
        // History and reading it as data loss. Now it returns a bounded slice of
        // recent history instead. See docs/future/SYNC_COLD_START_AND_SCALABILITY.md.
        const isColdStart = !lastSyncTimestamp || lastSyncTimestamp === 'null';

        let salesArray;
        let total: number;

        if (isColdStart) {
            // Newest N by ID. Ordering by `id` (the primary key) rather than
            // `updatedAt` is deliberate and load-bearing: there is no index on
            // UPDATED_AT, so ordering by it forces a filesort over the outlet's whole
            // history to return a handful of rows (measured on prod: 22.9ms / 3,139
            // rows scanned vs 0.86ms / 200 rows for this plan). A PK backward scan
            // also cannot be un-chosen by the optimiser as the table grows.
            // IDs are auto-increment, so newest-by-id == newest-created, and the app
            // already sorts its local list by salesId DESC — the order matches.
            const recentSales = await tenantPrisma.sales.findMany({
                where: { outletId: parsedOutletId, deleted: false },
                select: salesSyncSelect,
                orderBy: { id: 'desc' },
                take: COLD_START_SALES_CAP,
            });

            // ...plus every order still awaiting collection, however old. The laundry
            // pending-pickup queue reads ONLY from the device's local database (no
            // server call), so any uncollected order that falls outside the newest-N
            // window would vanish from that queue — the shop would lose track of
            // garments physically in the shop. Bounded by real-world work in progress,
            // not by history length. Empty for retail tenants (no orderRef).
            const uncollectedOrders = await tenantPrisma.sales.findMany({
                where: {
                    outletId: parsedOutletId,
                    deleted: false,
                    collectedAt: null,
                    orderRef: { not: null },
                },
                select: salesSyncSelect,
                orderBy: { id: 'desc' },
            });

            // Union, newest first. The two sets overlap for recent uncollected orders.
            const byId = new Map<number, typeof recentSales[number]>();
            for (const sale of recentSales) byId.set(sale.id, sale);
            for (const sale of uncollectedOrders) byId.set(sale.id, sale);
            const coldStartSet = Array.from(byId.values()).sort((a, b) => b.id - a.id);

            // `total` is the size of the whole cold-start set, and the rows returned
            // are a proper `skip`/`take` slice of it — so the client's pagination loop
            // (`skip += take; if (skip >= total) break`) walks it exactly once with no
            // repeats. Slicing in memory rather than re-querying is safe because the
            // set is bounded by construction: at most COLD_START_SALES_CAP recent rows
            // plus however much laundry is physically in the shop.
            //
            // Do NOT "optimise" this back to `total = salesArray.length` with `skip`
            // ignored: for a retail tenant the set is exactly `take` so the loop ends
            // after one request and the bug is invisible, but a laundry tenant with
            // more than `take` uncollected orders would make the client request page
            // after page and receive the identical full set each time.
            //
            // No COUNT(*) is issued either way — on prod that costs 17.9ms, more than
            // the row fetch itself, to serve a deliberately capped page.
            total = coldStartSet.length;
            salesArray = coldStartSet.slice(skip, skip + take);
        } else {
            const lastSync = new Date(lastSyncTimestamp as string);

            // Filter on `updatedAt` alone — NOT `createdAt OR updatedAt`.
            //
            // Prisma's @updatedAt sets the column on INSERT as well as UPDATE, so
            // `createdAt` was always redundant. Verified on prod 2026-08-13 across
            // all 15 tenant DBs: 0 rows with a null UPDATED_AT, 0 with
            // UPDATED_AT < CREATED_AT.
            //
            // The `OR` is what blocked the index: MySQL cannot serve an OR across
            // two columns from one index, so it fell back to `(OUTLET_ID)` and a
            // filesort. Benchmarked on a 22,016-row copy — the OR form ignores
            // `(OUTLET_ID, UPDATED_AT)` entirely (24.6ms, 10,844 rows examined,
            // filesort); this form uses it (0.97ms, 324 rows, backward index scan,
            // no sort). The index and this simplification only pay off together.
            //
            // ⚠️ House rule dependency: every raw-SQL `UPDATE` on `sales` must set
            // `UPDATED_AT = NOW()`. A hand-patched row that skips it is now
            // invisible to delta sync rather than merely mis-ordered.
            const where = {
                outletId: parsedOutletId,
                deleted: false,
                updatedAt: { gte: lastSync },
            };

            // Count total records
            total = await tenantPrisma.sales.count({ where });

            salesArray = await tenantPrisma.sales.findMany({
                where,
                select: salesSyncSelect,
                skip,
                take,
                orderBy: [
                    { updatedAt: 'desc' },
                    { createdAt: 'desc' }
                ]
            });
        }

        // Laundry: classify each order as a machine "wash", a per-piece/per-kg
        // "service" (jasa), or "mixed". A processed weight alone can't tell them
        // apart — a per-kg jasa (e.g. ironing charged by the kg) also carries a load
        // weight — so the real signal is the item's machine capacity, which only a
        // wash has. One batched, indexed lookup; empty for retail tenants.
        const serviceKinds = await loadLaundryServiceKinds(tenantPrisma, salesArray);

        // Transform results to include customerName
        const transformedSales = salesArray.map(sale => toSalesSyncRow(sale, serviceKinds));

        // Return with pagination metadata and server timestamp
        return {
            data: transformedSales,
            total,
            serverTimestamp: new Date().toISOString(),
            isFirstSync: isColdStart
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
            select: salesSyncSelect,
            skip,
            take,
        });

        // Laundry order kind classification — see loadLaundryServiceKinds. Batched
        // lookup so the partial-payment / pickup queue can label Wash vs Jasa too.
        const serviceKinds = await loadLaundryServiceKinds(tenantPrisma, salesArray);

        // Transform results to include customerName
        const transformedSales = salesArray.map(sale => toSalesSyncRow(sale, serviceKinds));

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
        // Same projection + transform as every other sales-sync read — these rows
        // are upserted whole on the device (see toSalesSyncRow).
        const partiallyPaidSales = await tenantPrisma.sales.findMany({
            where,
            select: salesSyncSelect,
            skip,
            take,
        });

        const serviceKinds = await loadLaundryServiceKinds(tenantPrisma, partiallyPaidSales);
        const transformedSales = partiallyPaidSales.map(sale => toSalesSyncRow(sale, serviceKinds));

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

let getById = async (databaseName: string, id: number, outletId?: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // Outlet-scoped read: findFirst({ id, outletId }) so outlet A cannot read
        // outlet B's sale by guessing the id (matches the write-path scoping).
        const sales = await tenantPrisma.sales.findFirst({
            where: {
                id: id,
                outletId: outletId
            },
            include: {
                salesItems: activeSalesItemsWithModifiers,
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

/**
 * Laundry pickup: fetch a sale by its client-minted orderRef (the QR scan key).
 * Mirrors getById but keyed by the unique orderRef column.
 */
let getByRef = async (databaseName: string, orderRef: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const sales = await tenantPrisma.sales.findUnique({
        where: { orderRef },
        include: {
            salesItems: activeSalesItemsWithModifiers,
            payments: true,
            registerLogs: true,
        },
    })
    if (!sales) {
        throw new NotFoundError("Sales")
    }
    return sales
}

/**
 * Laundry pickup: mark an order collected by orderRef.
 *
 * Sets `collectedAt` and, only when the sale is already fully paid, transitions
 * status → Completed. Outstanding balances are settled separately via the
 * existing add-payment flow BEFORE collect is called, so we never force a
 * still-owed sale to Completed here.
 */
let collect = async (databaseName: string, orderRef: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const sale = await tenantPrisma.sales.findUnique({ where: { orderRef } })
    if (!sale) {
        throw new NotFoundError("Sales")
    }
    const fullyPaid = new Decimal(sale.paidAmount.toString())
        .gte(new Decimal(sale.totalAmount.toString()))
    await tenantPrisma.sales.update({
        where: { orderRef },
        data: {
            collectedAt: new Date(),
            ...(fullyPaid ? { status: 'Completed' } : {}),
        },
    })
    return getByRef(databaseName, orderRef)
}

/**
 * Retail Lite takes full payment only (no kasbon, no partial payment) and has
 * no delivery orders. Checked before any stock or payment work.
 */
/** Retail Lite may void a sale for this long after it was made. */
const LITE_VOID_WINDOW_MS = 24 * 60 * 60 * 1000;

function assertLiteSale(salesBody: CreateSalesRequest, payments: Payment[]): void {
    const total = new Decimal(salesBody.totalAmount ?? 0);
    const paid = (payments ?? []).reduce(
        (sum, p) => sum.plus(new Decimal((p as any).tenderedAmount ?? 0)),
        new Decimal(0),
    );
    if (paid.lt(total)) {
        throw new PlanLimitError(
            'Partial payment and kasbon are not part of the Lite plan',
            ErrorCode.PlanFeatureLocked,
            { plan: 'Lite' },
        );
    }
    if ((salesBody.salesType ?? '').toLowerCase().replace(/[^a-z]/g, '') === 'delivery') {
        throw new PlanLimitError(
            'Delivery orders are not part of the Lite plan',
            ErrorCode.PlanFeatureLocked,
            { plan: 'Lite' },
        );
    }
}

/**
 * A TENANT-scope setting's stored value (null when never set). The definition
 * lives in the global DB, the value in the tenant DB — same lookup as the public
 * catalogue's `default_currency`. Falls back to the definition's default.
 */
async function readTenantSettingValue(tenantPrisma: PrismaClient, key: string): Promise<string | null> {
    const def = await getGlobalPrisma().settingDefinition.findUnique({
        where: { key },
        select: { id: true, defaultValue: true },
    });
    if (!def) return null;
    const setting = await tenantPrisma.setting.findFirst({
        where: { settingDefinitionId: def.id, userId: null, outletId: null, deleted: false },
        select: { value: true },
        orderBy: { id: 'asc' },
    });
    return setting?.value ?? def.defaultValue ?? null;
}

async function completeNewSales(
    databaseName: string,
    tenantId: number,
    performedBy: PerformedBy,
    salesBody: CreateSalesRequest,
    payments: Payment[],
    clientRef: string | null = null,
) {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);

    // A replay of a checkout we already recorded (see ./client-ref.ts): return
    // that sale instead of creating a second one, however old the replay is.
    if (clientRef) {
        const existingId = await findSaleIdByClientRef(tenantPrisma, clientRef);
        if (existingId !== null) {
            return markAlreadyRecorded(await getById(databaseName, existingId));
        }
    }

    if (isLitePlan(performedBy.planName)) {
        assertLiteSale(salesBody, payments);
    }

    validateSalesItemNumerics(salesBody.salesItems);
    validatePaymentNumerics(payments);

    // Resolve the stock-source override permission LIVE (cached ~5 min) rather than
    // from the JWT, so a grant/revoke takes effect within the cache TTL instead of
    // waiting for the 1-day token to reissue. Falls back to the token-stamped
    // permissions if the live resolve fails (transient DB error → previous behavior).
    let effectivePermissions: string[];
    try {
        effectivePermissions = await getEffectivePermissions(
            databaseName, performedBy.userId, performedBy.username,
        );
    } catch (error) {
        console.error('completeNewSales live-resolve failed, falling back to JWT:', error);
        effectivePermissions = performedBy.permissions ?? [];
    }
    const canOverride = effectivePermissions.some(
        (p) => p === '*' || p === OVERRIDE_STOCK_SOURCE_PERMISSION,
    );

    // Manual discount: sanity-check the per-line + order discount, and cap it for
    // users without "Give Discount" (fresh sales only — a late offline-outbox
    // arrival is accepted and logged). See ./manual-discount.ts.
    await enforceManualDiscount(
        salesBody,
        {
            databaseName,
            userId: performedBy.userId,
            username: performedBy.username,
            permissions: effectivePermissions,
            saleRef: clientRef ?? salesBody.orderRef ?? null,
        },
        { readCapSetting: () => readTenantSettingValue(tenantPrisma, CAP_SETTING_KEY) },
    );

    // Store stock updates outside transaction for notification use
    let stockUpdatesForNotification: StockAlertRow[] = [];
    // Loyalty follow-ups fire AFTER commit — scheduling them inside the tx
    // callback runs them pre-commit (stale totalSpend can miss a threshold
    // upgrade) and loses them if the process dies before commit.
    let postCommitTierAccountId: number | null = null;
    let postCommitMilestoneCustomerId: number | null = null;

    try {
        const result = await tenantPrisma.$transaction(async (tx) => {
            // ── Stock sourcing (AD6): automatic per-line "outlet-first → warehouse split",
            // with a permission-gated whole-sale override. When the tenant has no active
            // warehouse and no override is in effect, `sources` is just [outlet] and every
            // read/write below is byte-for-byte the historical outlet-only path.
            // See docs/future/WAREHOUSE_COMPLETION.md §A.
            // `canOverride` is resolved live above (before the tx), not from the JWT.
            const overrideRequested =
                salesBody.stockSourceType === 'OUTLET' || salesBody.stockSourceType === 'WAREHOUSE';
            const overrideActive = overrideRequested && canOverride;

            const sources: SaleStockSource[] = [];
            if (overrideActive && salesBody.stockSourceType === 'WAREHOUSE') {
                // Manual override → that warehouse only, no fallback.
                const whId = salesBody.stockSourceWarehouseId ?? 0;
                const wh = await tx.warehouse.findFirst({ where: { id: whId, deleted: false }, select: { id: true } });
                if (!wh) throw new BusinessLogicError(`Warehouse ${whId} not found or inactive`);
                sources.push(makeSaleStockSource(tx, 'WAREHOUSE', whId));
            } else if (overrideActive) {
                // Manual override → outlet only, no fallback.
                sources.push(makeSaleStockSource(tx, 'OUTLET', salesBody.outletId));
            } else {
                // Automatic: outlet first, then every active warehouse (FIFO split-fill).
                // F1-ready: this is the candidate-warehouse list (single warehouse in v1).
                sources.push(makeSaleStockSource(tx, 'OUTLET', salesBody.outletId));
                const activeWarehouses = await tx.warehouse.findMany({
                    where: { deleted: false },
                    select: { id: true },
                    orderBy: { id: 'asc' },
                });
                for (const w of activeWarehouses) sources.push(makeSaleStockSource(tx, 'WAREHOUSE', w.id));
            }
            // splitCapable = more than one source participates (≥1 warehouse joined the resolver).
            const splitCapable = sources.length > 1;

            const balanceSelect = {
                id: true,
                itemId: true,
                itemVariantId: true,
                availableQuantity: true,
                reorderThreshold: true,
                item: { select: { itemName: true, itemCode: true, cost: true, unitOfMeasure: true } },
            };
            const receiptSelect = {
                id: true,
                itemId: true,
                itemVariantId: true,
                quantity: true,
                cost: true,
                receiptDate: true,
                createdAt: true,
            };

            // Batch-load balances + receipts for every source (parallel), plus customer +
            // item flags. Typed loosely (delegates resolved dynamically per source).
            const [perSourceResults, customer, itemTrackStockData, outlet]: [Array<[any[], any[]]>, any, any[], any] = await Promise.all([
                Promise.all(
                    sources.map((src) =>
                        Promise.all([
                            src.balanceDelegate.findMany({
                                where: {
                                    OR: salesBody.salesItems.map(item => ({
                                        itemId: item.itemId,
                                        itemVariantId: item.itemVariantId || null,
                                        ...src.locWhere,
                                        deleted: false,
                                    })),
                                },
                                select: balanceSelect,
                            }),
                            src.receiptDelegate.findMany({
                                where: {
                                    OR: salesBody.salesItems.map(item => ({
                                        itemId: item.itemId,
                                        itemVariantId: item.itemVariantId || null,
                                        ...src.locWhere,
                                        deleted: false,
                                        quantity: { gt: 0 },
                                    })),
                                },
                                select: receiptSelect,
                                orderBy: [{ receiptDate: 'asc' }, { createdAt: 'asc' }],
                            }),
                        ])
                    )
                ) as Promise<Array<[any[], any[]]>>,

                // Validate customer if provided
                salesBody.customerId ? tx.customer.findUnique({
                    where: { id: salesBody.customerId },
                    select: { id: true, deleted: true }
                }) : null,

                // Fetch trackStock flag and cost for all items in the sale
                tx.item.findMany({
                    where: { id: { in: [...new Set(salesBody.salesItems.map(i => i.itemId))] } },
                    select: { id: true, trackStock: true, cost: true, itemType: true }
                }),

                // Validate outlet existence
                tx.outlet.findUnique({
                    where: { id: salesBody.outletId },
                    select: { id: true, deleted: true }
                })
            ]);

            // Validate outlet
            if (!outlet || outlet.deleted) {
                throw new BusinessLogicError(`Invalid outletId: ${salesBody.outletId}. Outlet does not exist or has been deleted.`);
            }

            // Validate stockSourceOutletId if present
            if (salesBody.stockSourceOutletId !== undefined && salesBody.stockSourceOutletId !== null) {
                const sourceOutlet = await tx.outlet.findUnique({
                    where: { id: salesBody.stockSourceOutletId },
                    select: { id: true, deleted: true }
                });
                if (!sourceOutlet || sourceOutlet.deleted) {
                    throw new BusinessLogicError(`Invalid stockSourceOutletId: ${salesBody.stockSourceOutletId}. Source outlet does not exist or has been deleted.`);
                }
            }

            // Validate customer
            if (salesBody.customerId && (!customer || customer.deleted)) {
                throw new Error(`Invalid customerId: ${salesBody.customerId}`);
            }

            // Build per-source lookup maps (composite key itemId-variant). Receipts are
            // mutated in-memory during FIFO so later lines for the same item see depletion.
            sources.forEach((src, i) => {
                const [balances, receipts] = perSourceResults[i];
                src.balanceMap = new Map(
                    balances.map((sb: any) => [`${sb.itemId}-${sb.itemVariantId || 'null'}`, sb])
                );
                src.receiptsByItem = new Map();
                for (const r of receipts) {
                    const key = `${r.itemId}-${r.itemVariantId || 'null'}`;
                    if (!src.receiptsByItem.has(key)) src.receiptsByItem.set(key, []);
                    src.receiptsByItem.get(key)!.push(r);
                }
                src.originalReceiptQty = new Map(receipts.map((r: any) => [r.id, new Decimal(r.quantity)]));
            });

            // Build trackStock lookup map
            const itemTrackStockMap = new Map(
                itemTrackStockData.map((i: any) => [i.id, { trackStock: i.trackStock, cost: i.cost, itemType: i.itemType }])
            );

            // Laundry SUPPLY lines (detergent, softener, plastic, LPG…) may run short:
            // owner rule 2026-10-02 — running out of a supply never blocks a wash. The
            // sale goes through and the supply's balance at the first source goes
            // NEGATIVE (the app shows the shortage via GET stockMovement/supply-shortages).
            // Retail / non-supply items keep the strict validation below.
            const isShortAllowed = (lookupKey: string) =>
                itemTrackStockMap.get(Number(lookupKey.split('-')[0]))?.itemType === 'supply';
            const shortKeys = new Set<string>(); // short-allowed keys that are actually short

            // Split sales items into stock-tracked and non-stock-tracked groups
            const stockItems = salesBody.salesItems.filter(i => itemTrackStockMap.get(i.itemId)?.trackStock !== false);
            const nonStockItems = salesBody.salesItems.filter(i => itemTrackStockMap.get(i.itemId)?.trackStock === false);

            // Preserve the caller's line order through the stock/non-stock split and
            // the FIFO row expansion below. salesItemData is otherwise built as
            // [all stock rows] + [all non-stock rows], which separates a laundry
            // service line from the supply lines it consumed (a service may be
            // non-stock while its consumables are stock-tracked, or vice versa) — so
            // on reload the service↔supply grouping is lost. We tag every produced
            // row with its original payload index and restore that order before
            // createMany. Keyed by object reference (the filtered arrays reuse the
            // same item objects).
            const originalLineIndex = new Map<any, number>();
            salesBody.salesItems.forEach((it, idx) => originalLineIndex.set(it, idx));

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

            // Validate COMBINED availability across all sources (atomic — fail before any
            // write). Also seed each source's remainingBalance ledger used by the split.
            const stockValidationErrors: string[] = [];
            for (const [lookupKey, totalEffectiveQty] of aggregatedEffectiveQtyMap) {
                let combinedAvail = new Decimal(0);
                let anyBalance = false;
                let itemInfo: any = null;
                for (const src of sources) {
                    const b = src.balanceMap.get(lookupKey);
                    if (b) {
                        anyBalance = true;
                        itemInfo = itemInfo || b.item;
                        combinedAvail = combinedAvail.plus(new Decimal(b.availableQuantity));
                    }
                    src.remainingBalance.set(lookupKey, b ? new Decimal(b.availableQuantity) : new Decimal(0));
                }
                const item = salesBody.salesItems.find(i => `${i.itemId}-${i.itemVariantId || 'null'}` === lookupKey)!;
                if (isShortAllowed(lookupKey)) {
                    // A negative existing balance is fine here: the split loop's
                    // `take.lte(0)` skips it, and the shortfall lands on sources[0].
                    if (!anyBalance || combinedAvail.lt(totalEffectiveQty)) shortKeys.add(lookupKey);
                    continue;
                }
                if (!anyBalance) {
                    const variantInfo = item.variantName ? ` - ${item.variantName}` : '';
                    stockValidationErrors.push(`Stock balance not found for item ${item.itemName || item.itemId}${variantInfo}`);
                    continue;
                }
                if (combinedAvail.lt(totalEffectiveQty)) {
                    const variantInfo = item.itemVariantId ? ` (variant)` : '';
                    const srcNote = splitCapable ? ' (outlet + warehouse)' : '';
                    stockValidationErrors.push(
                        `Insufficient stock for ${itemInfo?.itemName || item.itemName}${variantInfo} (${itemInfo?.itemCode || item.itemCode}). ` +
                        `Available: ${combinedAvail}${srcNote}, Required: ${totalEffectiveQty}`
                    );
                }
            }
            if (stockValidationErrors.length > 0) {
                throw new BusinessLogicError(`Stock validation failed: ${stockValidationErrors.join('; ')}`);
            }

            // Unit cost for a supply shortfall: the item row's cost is 0 by design for a
            // stock-tracked supply, so price it at the latest purchase (receipt) cost —
            // keeps "laba setelah bahan" as accurate as the data allows. One batched
            // query, only when a supply is actually short.
            const shortfallCostByItem = shortKeys.size > 0
                ? await latestReceiptCosts(
                    tx,
                    [...shortKeys].map(k => Number(k.split('-')[0])),
                    salesBody.outletId,
                    new Map([...itemTrackStockMap].map(([id, v]: [any, any]) => [id, v.cost])),
                )
                : new Map<number, Decimal>();

            // Calculate FIFO costs for each sales line, splitting across sources in priority
            // order (outlet first, then warehouse). Each used-receipt is tagged with its
            // source index. Receipt quantities + remainingBalance are mutated in-memory so
            // later lines for the same item see depletion (fixes duplicate-item FIFO bug).
            const salesItemsWithFIFOCost: Array<typeof salesBody.salesItems[0] & {
                usedReceipts: { srcIndex: number; id: number; quantityUsed: Decimal; cost: Decimal }[]
                __order: number
            }> = [];

            for (const item of stockItems) {
                const lookupKey = `${item.itemId}-${item.itemVariantId || 'null'}`;
                const effectiveQty = getEffectiveStockQty(new Decimal(item.quantity), item.stockConsumptionQty);
                const fallbackCost = new Decimal(itemTrackStockMap.get(item.itemId)?.cost || 0);
                let remaining = effectiveQty;
                const usedReceipts: { srcIndex: number; id: number; quantityUsed: Decimal; cost: Decimal }[] = [];

                for (let si = 0; si < sources.length && remaining.gt(0); si++) {
                    const src = sources[si];
                    const avail = src.remainingBalance.get(lookupKey) || new Decimal(0);
                    const take = Decimal.min(remaining, avail);
                    if (take.lte(0)) continue;

                    const itemReceipts = src.receiptsByItem.get(lookupKey) || [];
                    let need = take;
                    if (itemReceipts.length === 0) {
                        // Source has balance but no FIFO receipts → fall back to item cost.
                        usedReceipts.push({ srcIndex: si, id: -1, quantityUsed: need, cost: fallbackCost });
                        need = new Decimal(0);
                    } else {
                        for (const receipt of itemReceipts) {
                            if (need.lte(0)) break;
                            const availableInReceipt = new Decimal(receipt.quantity);
                            if (availableInReceipt.lte(0)) continue;
                            const quantityToUse = Decimal.min(need, availableInReceipt);
                            need = need.minus(quantityToUse);
                            (receipt as any).quantity = availableInReceipt.minus(quantityToUse);
                            usedReceipts.push({ srcIndex: si, id: receipt.id, quantityUsed: quantityToUse, cost: new Decimal(receipt.cost) });
                        }
                        // Receipts short within this source's portion → last receipt's cost.
                        if (need.gt(0)) {
                            const lastReceipt = itemReceipts[itemReceipts.length - 1];
                            usedReceipts.push({ srcIndex: si, id: -1, quantityUsed: need, cost: new Decimal(lastReceipt.cost) });
                            need = new Decimal(0);
                        }
                    }
                    src.remainingBalance.set(lookupKey, avail.minus(take));
                    remaining = remaining.minus(take);
                }

                if (remaining.gt(0)) {
                    if (!isShortAllowed(lookupKey)) {
                        // Unreachable after combined validation — defensive guard.
                        throw new BusinessLogicError(`Insufficient combined stock for item ${item.itemName || item.itemId}`);
                    }
                    // Supply shortfall → charge it to the first source (the outlet, or the
                    // override source); its balance goes negative. No receipt (id -1).
                    usedReceipts.push({
                        srcIndex: 0,
                        id: -1,
                        quantityUsed: remaining,
                        cost: shortfallCostByItem.get(item.itemId) ?? fallbackCost,
                    });
                    const src0 = sources[0];
                    src0.remainingBalance.set(lookupKey, (src0.remainingBalance.get(lookupKey) || new Decimal(0)).minus(remaining));
                    remaining = new Decimal(0);
                }

                salesItemsWithFIFOCost.push({ ...item, usedReceipts, __order: originalLineIndex.get(item) ?? 0 });
            }

            // Calculate payments and sales status
            const totalSalesAmount = new Decimal(salesBody.totalAmount);
            const totalPaymentAmount = payments.reduce((sum, payment) => sum.plus(new Decimal(payment.tenderedAmount)), new Decimal(0));
            const salesStatus = totalPaymentAmount.gte(totalSalesAmount) ? 'Completed' : 'Partially Paid';
            const changeAmount = totalPaymentAmount.gte(totalSalesAmount) ? totalPaymentAmount.minus(totalSalesAmount) : new Decimal(0);

            // Calculate total profit and prepare sales item data
            let totalProfit = new Decimal(0);
            const salesItemData: any[] = [];

            salesItemsWithFIFOCost.forEach((item) => {
                const isConsumptionItem = item.stockConsumptionQty != null;

                if (isConsumptionItem) {
                    // ── Consumption items: single row with weighted-average cost ──
                    const totalQuantity = new Decimal(item.quantity);
                    const totalDiscount = item.discountAmount ? new Decimal(item.discountAmount) : new Decimal(0);
                    const totalServiceCharge = item.serviceChargeAmount ? new Decimal(item.serviceChargeAmount) : new Decimal(0);
                    const totalTax = item.taxAmount ? new Decimal(item.taxAmount) : new Decimal(0);
                    const totalRevenue = new Decimal(item.price).times(totalQuantity);
                    // priceBeforeTax is already the LINE total (FE sends the line's taxable base) — never × qty.
                    const totalPriceBeforeTax = new Decimal(item.priceBeforeTax ?? 0);
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
                        loadWeightKg: item.loadWeightKg ?? null,
                        specialInstructions: item.specialInstructions || '',
                        __order: item.__order,
                    });
                } else {
                    // ── Piece-based items: existing multi-row FIFO split ──
                    const totalQuantity = new Decimal(item.quantity);
                    const discountPerUnit = (item.discountAmount ? new Decimal(item.discountAmount) : new Decimal(0)).dividedBy(totalQuantity);
                    const serviceChargePerUnit = (item.serviceChargeAmount ? new Decimal(item.serviceChargeAmount) : new Decimal(0)).dividedBy(totalQuantity);
                    const taxPerUnit = (item.taxAmount ? new Decimal(item.taxAmount) : new Decimal(0)).dividedBy(totalQuantity);

                    item.usedReceipts.forEach((receipt) => {
                        const receiptQuantity = new Decimal(receipt.quantityUsed);
                        const receiptCost = new Decimal(receipt.cost);

                        // Cost provenance: link the line to the receipt that priced it
                        // (id -1 = fallback cost, no receipt → stays NULL).
                        const receiptSource = receipt.id !== -1 ? sources[receipt.srcIndex] : null;

                        const revenueForQuantity = new Decimal(item.price).times(receiptQuantity);
                        const costForQuantity = receiptCost.times(receiptQuantity);
                        const totalDiscountForQuantity = discountPerUnit.times(receiptQuantity);
                        const totalTaxForQuantity = taxPerUnit.times(receiptQuantity);
                        const totalServiceChargeForQuantity = serviceChargePerUnit.times(receiptQuantity);
                        // priceBeforeTax is a LINE total → this receipt's share of it, like subtotalAmount.
                        const totalPriceBeforeTax = lineShareOf(item.priceBeforeTax, receiptQuantity, totalQuantity);
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
                            stockConsumptionQty: null,
                            unitOfMeasure: item.unitOfMeasure || null,
                            loadWeightKg: item.loadWeightKg ?? null,
                            specialInstructions: item.specialInstructions || '',
                            stockReceiptId: receiptSource?.kind === 'OUTLET' ? receipt.id : null,
                            warehouseStockReceiptId: receiptSource?.kind === 'WAREHOUSE' ? receipt.id : null,
                            __order: item.__order,
                        });
                    });
                }
            });

            // Consolidate FIFO consumption per source: receiptUpdateMap (receipt depletion)
            // and consumedByItem (balance decrement + movement). Driven off the source-tagged
            // usedReceipts so a split line records against each actual location.
            for (const fifoItem of salesItemsWithFIFOCost) {
                const lookupKey = `${fifoItem.itemId}-${fifoItem.itemVariantId || 'null'}`;
                for (const ur of fifoItem.usedReceipts) {
                    const src = sources[ur.srcIndex];
                    if (ur.id !== -1) {
                        src.receiptUpdateMap.set(ur.id, (src.receiptUpdateMap.get(ur.id) || new Decimal(0)).plus(ur.quantityUsed));
                    }
                    src.consumedByItem.set(lookupKey, (src.consumedByItem.get(lookupKey) || new Decimal(0)).plus(ur.quantityUsed));
                }
            }

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
                    priceBeforeTax: new Decimal(item.priceBeforeTax ?? 0), // LINE total already — never × qty
                    profit: profit,
                    discountPercentage: item.discountPercentage,
                    discountAmount: totalDiscount,
                    serviceChargeAmount: totalServiceCharge,
                    taxAmount: item.taxAmount ? new Decimal(item.taxAmount) : new Decimal(0),
                    subtotalAmount: new Decimal(item.subtotalAmount),
                    remark: item.remark || '',
                    deleted: false,
                    stockConsumptionQty: null,
                    unitOfMeasure: item.unitOfMeasure || null,
                    loadWeightKg: item.loadWeightKg ?? null,
                    specialInstructions: item.specialInstructions || '',
                    __order: originalLineIndex.get(item) ?? 0,
                });
            }

            // Compute sale-level stock-source provenance from what was ACTUALLY consumed.
            const consumedFrom = (s: SaleStockSource) =>
                [...s.consumedByItem.values()].some((q) => q.gt(0));
            const outletUsed = sources.some((s) => s.kind === 'OUTLET' && consumedFrom(s));
            const warehouseUsedSource = sources.find((s) => s.kind === 'WAREHOUSE' && consumedFrom(s));
            const warehouseUsed = !!warehouseUsedSource;

            let saleStockSourceType: string | null;
            let saleStockSourceOutletId: number | null;
            let saleStockSourceWarehouseId: number | null;
            if (overrideActive) {
                // Manual whole-sale override → record the chosen single source verbatim.
                saleStockSourceType = salesBody.stockSourceType ?? 'OUTLET';
                saleStockSourceOutletId = saleStockSourceType === 'OUTLET' ? salesBody.outletId : null;
                saleStockSourceWarehouseId = saleStockSourceType === 'WAREHOUSE' ? (salesBody.stockSourceWarehouseId ?? null) : null;
            } else if (!splitCapable) {
                // No active warehouse → byte-for-byte the historical outlet path (null source).
                saleStockSourceType = salesBody.stockSourceType ?? null;
                saleStockSourceOutletId = salesBody.stockSourceOutletId ?? null;
                saleStockSourceWarehouseId = null;
            } else if (outletUsed && warehouseUsed) {
                saleStockSourceType = 'MIXED';
                saleStockSourceOutletId = salesBody.outletId;
                saleStockSourceWarehouseId = warehouseUsedSource!.locationId;
            } else if (warehouseUsed) {
                saleStockSourceType = 'WAREHOUSE';
                saleStockSourceOutletId = null;
                saleStockSourceWarehouseId = warehouseUsedSource!.locationId;
            } else {
                saleStockSourceType = 'OUTLET';
                saleStockSourceOutletId = salesBody.outletId;
                saleStockSourceWarehouseId = null;
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
                    // Terminal attribution — which terminal rang this sale (client-supplied).
                    siteId: salesBody.siteId ?? null,
                    deleted: false,
                    // Line profits minus the cart discount; the loyalty block below
                    // also takes off tier/voucher/package/redemption (sale-profit.ts).
                    profitAmount: netSaleProfit(totalProfit, { discountAmount: salesBody.discountAmount }),
                    // Laundry intake→pickup identity (null for retail / when not sent)
                    orderRef: salesBody.orderRef || null,
                    friendlyNumber: salesBody.friendlyNumber || null,
                    // F&B counter queue number + "atas nama" label, stored as sent.
                    queueNo: salesBody.queueNo?.trim().slice(0, 16) || null,
                    customerLabel: salesBody.customerLabel?.trim().slice(0, 100) || null,
                    // Offline-replay dedupe key (./client-ref.ts); null without a key.
                    clientRef,
                    // Stock-source provenance — computed from actual per-line consumption
                    // (OUTLET / WAREHOUSE / MIXED), or null for non-warehouse tenants.
                    stockSourceType: saleStockSourceType,
                    stockSourceOutletId: saleStockSourceOutletId,
                    stockSourceWarehouseId: saleStockSourceWarehouseId,
                },
            });

            // Restore the caller's line order so persisted rows keep the cart's
            // interleaving (service line followed by the supplies it consumed).
            // Stable sort: multiple FIFO-split rows for one piece-based line share
            // an __order and keep their relative split order. __order is stripped
            // before the insert (it is not a column).
            salesItemData.sort((a, b) => a.__order - b.__order);

            // Batch create sales items
            await tx.salesItem.createMany({
                data: salesItemData.map(({ __order, ...item }) => ({
                    ...item,
                    salesId: createdSales.id,
                }))
            });

            // F&B: snapshot each line's modifiers onto every persisted row of that
            // request line (a FIFO split yields several rows for one line).
            await attachSalesItemModifiers(tx, createdSales.id, salesBody.salesItems, salesItemData);

            // Batch create payments
            await tx.payment.createMany({
                data: payments.map(payment => ({
                    ...payment,
                    salesId: createdSales.id,
                    // Terminal attribution — the terminal that took the payment.
                    // Prefer a payment-level siteId; fall back to the sale's terminal.
                    siteId: (payment as any).siteId ?? salesBody.siteId ?? null,
                }))
            });

            // ── Loyalty Block ──
            // Runs for ANY sale with a customer — Partially Paid / pay-on-collection
            // included. The discounts are already locked into totalAmount by the FE,
            // so redemption / subscription quota / voucher must be deducted NOW;
            // only the earn leg waits for full payment (includeEarn).
            const isFullyPaid = salesStatus === 'Completed';
            const loyaltyOn = !!performedBy.loyaltyTier && performedBy.loyaltyTier !== 'none';
            // With loyalty off, the block still runs for value the customer
            // holds from Pro: a package, a voucher, or (a sale rung up on Pro
            // and synced after the step down) points / a tier discount.
            const usesHeldValue = !!salesBody.customerSubscriptionId
                || !!salesBody.voucherId
                || (salesBody.loyaltyPointsToRedeem || 0) > 0
                || (salesBody.loyaltyTierDiscountPercentage || 0) > 0;
            if (salesBody.customerId && (loyaltyOn || usesHeldValue)) {
                const loyaltyResult = await processLoyaltyForSale(
                    tx, databaseName, createdSales.id, salesBody.customerId,
                    totalSalesAmount, salesBody, performedBy, isFullyPaid
                );

                // Update sales record with loyalty + voucher data
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
                        voucherId: loyaltyResult.voucherId,
                        voucherDiscountPercentage: loyaltyResult.voucherDiscountPercentage,
                        voucherDiscountAmount: loyaltyResult.voucherDiscountAmount,
                        // These discounts lowered totalAmount, so they lower profit
                        // too — a package-covered wash is revenue 0, profit −cost.
                        profitAmount: netSaleProfit(totalProfit, {
                            discountAmount: salesBody.discountAmount,
                            ...loyaltyResult,
                        }),
                    },
                });

                // Tier auto-upgrade + voucher milestones are deferred to after
                // the transaction commits (see postCommit* declarations above).
                if (performedBy.loyaltyTier === 'advanced' && loyaltyResult.loyaltyAccountId) {
                    postCommitTierAccountId = loyaltyResult.loyaltyAccountId;
                }
                // Milestone vouchers are issued only while loyalty is on — a
                // loyalty-off sale can still return an account when it redeemed
                // value held from Pro.
                if (loyaltyOn && loyaltyResult.loyaltyAccountId && salesBody.customerId) {
                    postCommitMilestoneCustomerId = salesBody.customerId;
                }
            }
            // ── End Loyalty Block ──

            // ── Per-source stock writes (receipts → balances → movements). For a normal
            // outlet-only sale `sources` is just [outlet] → identical to the legacy path;
            // a split sale writes against each location it actually drew from.
            const receiptUpdateOps: Promise<any>[] = [];
            for (const src of sources) {
                for (const [receiptId, totalUsed] of src.receiptUpdateMap) {
                    const originalQty = src.originalReceiptQty.get(receiptId) || new Decimal(0);
                    const newQuantity = originalQty.minus(totalUsed);
                    receiptUpdateOps.push(
                        src.receiptDelegate.update({
                            where: { id: receiptId },
                            data: {
                                quantity: newQuantity,
                                updatedAt: new Date(),
                                version: { increment: 1 },
                                deleted: newQuantity.eq(0) ? true : undefined,
                                deletedAt: newQuantity.eq(0) ? new Date() : undefined,
                            },
                        })
                    );
                }
            }
            if (receiptUpdateOps.length > 0) {
                await Promise.all(receiptUpdateOps);
            }

            // Build balance decrements + movements per source + collect notification
            // candidates (outlet only drives low/out-of-stock alerts in v1).
            const balanceOps: Promise<any>[] = [];
            const movementOps: Promise<any>[] = [];
            const stockUpdatesForNotif: StockAlertRow[] = [];
            for (const src of sources) {
                const movementData: any[] = [];
                for (const [lookupKey, consumedQty] of src.consumedByItem) {
                    if (consumedQty.lte(0)) continue;
                    const balance = src.balanceMap.get(lookupKey);
                    const item = salesBody.salesItems.find(i => `${i.itemId}-${i.itemVariantId || 'null'}` === lookupKey)!;
                    const prev = balance ? new Decimal(balance.availableQuantity) : new Decimal(0);
                    const newAvail = prev.minus(consumedQty);
                    const reorderThreshold = balance?.reorderThreshold ? new Decimal(balance.reorderThreshold) : null;

                    if (balance) {
                        balanceOps.push(
                            src.balanceDelegate.update({
                                where: { id: balance.id },
                                data: {
                                    availableQuantity: { decrement: consumedQty.toNumber() },
                                    onHandQuantity: { decrement: consumedQty.toNumber() },
                                    version: { increment: 1 },
                                    updatedAt: new Date(),
                                },
                            })
                        );
                    } else {
                        // Only reachable for a supply short-fall at a location that never
                        // stocked it: open its balance row already in the negative.
                        balanceOps.push(
                            src.balanceDelegate.create({
                                data: {
                                    itemId: item.itemId,
                                    itemVariantId: item.itemVariantId || null,
                                    ...src.locWhere,
                                    availableQuantity: consumedQty.neg().toNumber(),
                                    onHandQuantity: consumedQty.neg().toNumber(),
                                    reorderThreshold: null,
                                    deleted: false,
                                    version: 1,
                                },
                            })
                        );
                    }

                    movementData.push({
                        itemId: item.itemId,
                        itemVariantId: item.itemVariantId || null,
                        ...src.locWhere,
                        previousAvailableQuantity: prev.toNumber(),
                        previousOnHandQuantity: prev.toNumber(),
                        availableQuantityDelta: -consumedQty.toNumber(),
                        onHandQuantityDelta: -consumedQty.toNumber(),
                        movementType: 'Sales',
                        documentId: createdSales.id,
                        reason: 'Sales transaction',
                        remark: `Sales #${createdSales.id}`,
                        // Outlet movements carry terminal attribution (siteId); warehouse
                        // movements carry performedBy (no siteId column).
                        ...(src.kind === 'OUTLET'
                            ? { siteId: salesBody.siteId ?? null }
                            : { performedBy: performedBy.username }),
                    });

                    if (src.kind === 'OUTLET') {
                        // Low / out-of-stock alert candidate; the crossing rule
                        // (stock/stock-alerts.ts) decides after commit — a supply
                        // already in the negative never pushes again on every wash.
                        stockUpdatesForNotif.push({
                            itemId: item.itemId,
                            itemVariantId: item.itemVariantId || null,
                            itemName: balance?.item?.itemName ?? item.itemName,
                            itemCode: balance?.item?.itemCode ?? item.itemCode,
                            variantName: item.variantName || null,
                            quantity: consumedQty,
                            previousAvailable: prev,
                            newAvailable: newAvail,
                            reorderThreshold,
                        });
                    }
                }
                if (movementData.length > 0) {
                    movementOps.push(src.movementDelegate.createMany({ data: movementData }));
                }
            }

            // Store for notifications outside transaction
            stockUpdatesForNotification = stockUpdatesForNotif;

            await Promise.all([...balanceOps, ...movementOps]);

            return createdSales;
        });

        // ── Post-commit loyalty follow-ups (fire-and-forget) ──
        if (postCommitTierAccountId !== null) {
            const accountIdForTier = postCommitTierAccountId;
            setImmediate(() => {
                loyaltyService.checkTierUpgrade(databaseName, accountIdForTier).catch(err =>
                    console.error('Tier auto-upgrade check failed:', err)
                );
            });
        }
        if (postCommitMilestoneCustomerId !== null) {
            const custId = postCommitMilestoneCustomerId;
            setImmediate(() => {
                voucherService.checkMilestones(databaseName, custId).catch(err =>
                    console.error('Voucher milestone check failed:', err)
                );
            });
        }

        // Low / out-of-stock alerts — the shared crossing rule and payloads
        // (stock/stock-alerts.ts); fire-and-forget, never blocks the response.
        sendStockAlerts({
            tenantId,
            outletId: salesBody.outletId,
            rows: stockUpdatesForNotification,
            triggeringUserId: performedBy.userId,
            triggeringUsername: performedBy.username,
            source: 'sale',
            salesId: result.id,
        });

        // Send the sale notification (fire-and-forget, don't block response)
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
            )
        ]).catch(error => {
            // Log notification errors but don't fail the response
            console.error('Failed to send notifications:', error);
        });

        return getById(databaseName, result.id);
    } catch (error) {
        // A concurrent replay with the same key committed first: the unique
        // index rejected this insert, so answer with the sale it created.
        if (clientRef && isClientRefConflict(error)) {
            const existingId = await findSaleIdByClientRef(tenantPrisma, clientRef);
            if (existingId !== null) {
                return markAlreadyRecorded(await getById(databaseName, existingId));
            }
        }
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

let update = async (databaseName: string, salesRequest: SalesRequestBody, outletId: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        await tenantPrisma.$transaction(async (tx) => {
            //separate sales & salesitem to perform update to different tables
            let { items, ...sales } = salesRequest.sales
            // Scope by outletId so a user in outlet A cannot edit a sale belonging
            // to outlet B by guessing its id.
            const existing = await tx.sales.findFirst({
                where: { id: sales.id, outletId, deleted: false },
                select: { id: true }
            })
            if (!existing) {
                throw new NotFoundError("Sales");
            }
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

let remove = async (databaseName: string, id: number, outletId: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        await tenantPrisma.$transaction(async (tx) => {
            // Scope by outletId so cross-outlet deletions surface as 404.
            const existing = await tx.sales.findFirst({
                where: { id, outletId, deleted: false },
                select: { id: true }
            })
            if (!existing) {
                throw new NotFoundError("Sales");
            }
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
                    voucherDiscountAmount: true,
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
            let totalVoucherDiscount = new Decimal(0);
            let subscriptionUsageCount = 0;

            activeSales.forEach((sale: any) => {
                if (sale.loyaltyPointsEarned) totalPointsEarned = totalPointsEarned.plus(sale.loyaltyPointsEarned);
                if (sale.loyaltyPointsRedeemed) totalPointsRedeemed = totalPointsRedeemed.plus(sale.loyaltyPointsRedeemed);
                if (sale.loyaltyTierDiscountAmount) totalLoyaltyDiscount = totalLoyaltyDiscount.plus(sale.loyaltyTierDiscountAmount);
                if (sale.voucherDiscountAmount) totalVoucherDiscount = totalVoucherDiscount.plus(sale.voucherDiscountAmount);
                if (sale.customerSubscriptionId) subscriptionUsageCount++;
            });

            loyaltyMetrics = {
                totalLoyaltyPointsEarned: totalPointsEarned,
                totalLoyaltyPointsRedeemed: totalPointsRedeemed,
                totalLoyaltyDiscountAmount: totalLoyaltyDiscount,
                totalVoucherDiscountAmount: totalVoucherDiscount,
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

/**
 * Daily revenue trend for the dashboard sparkline + "vs yesterday" chip.
 *
 * Performance / cost notes:
 * - Single parameterised aggregate query. Day-bucketing + SUM happen IN MySQL,
 *   so the wire transfers at most `days` rows (not every sale row).
 * - Rides the existing composite index @@index([outletId, businessDate, status]):
 *   outletId equality + businessDate range seek; STATUS filtered via index-condition
 *   pushdown. Work scales with one outlet × N days, never the whole table.
 * - Days are bucketed by the CLIENT's calendar day when `utcOffsetMinutes` is
 *   supplied (the app sends its device offset), so the sparkline agrees with the
 *   outlet report and Sales History — both of which bound periods by the user's
 *   local day. `businessDate` is stored as a UTC instant, so bucketing by the raw
 *   UTC day skews every bar by the tenant's offset (7h for WIB) and pushes sales
 *   rung up 00:00–06:59 local into the previous bar. Omitted => 0 => the previous
 *   UTC-day behaviour, so older APKs are unaffected.
 * - Revenue definition matches getTotalSalesData (SUM(totalAmount) of active sales:
 *   Completed + Partially Paid + Delivered) so the graph agrees with the headline.
 */
let getRevenueTrend = async (databaseName: string, outletId: number, days: number = 7, utcOffsetMinutes: number = 0) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // Clamp to a sane window (defensive; avoids an unbounded scan if a bad value slips through).
        const windowDays = Math.min(Math.max(Math.trunc(days) || 7, 1), 31);
        // Clamp to the real-world UTC offset range (-12:00 … +14:00). Defensive:
        // a junk value would otherwise shift every bucket arbitrarily.
        const offsetMinutes = Math.min(Math.max(Math.trunc(utcOffsetMinutes) || 0, -720), 840);
        const offsetMs = offsetMinutes * 60_000;

        // Work in "shifted" time: adding the offset to a UTC instant makes its
        // UTC-date fields read as the client's LOCAL calendar date, so the same
        // Date.UTC arithmetic below yields local day boundaries. Subtracting the
        // offset converts those boundaries back to real UTC instants for the query.
        // offsetMinutes = 0 reduces to the original UTC-day behaviour exactly.
        const nowShifted = new Date(Date.now() + offsetMs);
        const y = nowShifted.getUTCFullYear();
        const m = nowShifted.getUTCMonth();
        const d = nowShifted.getUTCDate();

        // [start, end) as real UTC instants bounding the client's local day window.
        const end = new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0) - offsetMs);
        const start = new Date(Date.UTC(y, m, d - (windowDays - 1), 0, 0, 0, 0) - offsetMs);

        // Aggregate in the DB. DATE() truncation isn't expressible via Prisma groupBy, so use a
        // parameterised raw query (still safe — values are bound, not interpolated).
        //
        // NOTE: `GROUP BY day` groups by the SELECT alias, deliberately. Repeating the
        // expression (`GROUP BY DATE(BUSINESS_DATE + INTERVAL ${offsetMinutes} MINUTE)`)
        // fails under `sql_mode=only_full_group_by` with error 1055: the two `INTERVAL ?`
        // placeholders are separate bound parameters, so MySQL does not recognise the
        // two expressions as identical. Grouping by the alias sidesteps that.
        const rows = await tenantPrisma.$queryRaw<Array<{ day: Date | string; revenue: Prisma.Decimal | string | null }>>(
            Prisma.sql`
                SELECT DATE(BUSINESS_DATE + INTERVAL ${offsetMinutes} MINUTE) AS day,
                       CAST(SUM(TOTAL_AMOUNT) AS DECIMAL(18,4))               AS revenue
                FROM   sales
                WHERE  OUTLET_ID     = ${outletId}
                  AND  BUSINESS_DATE >= ${start}
                  AND  BUSINESS_DATE <  ${end}
                  AND  STATUS IN ('Completed', 'Partially Paid', 'Delivered')
                  AND  IS_DELETED = 0
                GROUP BY day
                ORDER BY day ASC
            `
        );

        // Index returned rows by YYYY-MM-DD for zero-fill.
        const byDay = new Map<string, number>();
        for (const r of rows) {
            const key = typeof r.day === 'string' ? r.day.slice(0, 10) : r.day.toISOString().slice(0, 10);
            const rev = r.revenue == null ? 0 : Number(r.revenue);
            byDay.set(key, rev);
        }

        // Build a dense, zero-filled series oldest→newest so the client can plot
        // directly. Keys are the client's LOCAL calendar dates — the same space the
        // SQL now groups in — so `byDay` lookups line up.
        const series: Array<{ date: string; revenue: number }> = [];
        for (let i = 0; i < windowDays; i++) {
            const dayDate = new Date(Date.UTC(y, m, d - (windowDays - 1 - i), 0, 0, 0, 0));
            const key = dayDate.toISOString().slice(0, 10);
            series.push({ date: key, revenue: byDay.get(key) ?? 0 });
        }

        const todayRevenue = series[series.length - 1]?.revenue ?? 0;
        const yesterdayRevenue = series.length >= 2 ? series[series.length - 2].revenue : 0;
        // null trend when there's no baseline (avoids divide-by-zero / fake 100%).
        const trendPct = yesterdayRevenue > 0
            ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 1000) / 10
            : null;

        return {
            series,
            todayRevenue,
            yesterdayRevenue,
            trendPct,
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
    payments: Payment[],
    outletId: number,
    clientRef: string | null = null,
) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);

    // A replay of a payment we already recorded (see ./client-ref.ts). Checked
    // before the status guard: if that payment completed the sale, the guard
    // would reject the replay ("only partially paid…") instead of confirming it.
    if (clientRef) {
        const paidSaleId = await findPaidSaleIdByClientRef(tenantPrisma, clientRef);
        if (paidSaleId !== null) {
            return markAlreadyRecorded(await getById(databaseName, paidSaleId));
        }
    }
    // Loyalty follow-ups fire AFTER commit (see completeNewSales note).
    let postCommitTierAccountId: number | null = null;
    let postCommitMilestoneCustomerId: number | null = null;
    try {
        const result = await tenantPrisma.$transaction(async (tx) => {
            // Scope by outletId so the partially-paid sale must belong to the
            // requesting outlet — otherwise cross-outlet payments slip through.
            const sales = await tx.sales.findFirst({
                where: {
                    id: salesId,
                    outletId: outletId,
                    deleted: false
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

            // Update payments with salesId (+ the replay-dedupe ref, "<key>:<n>")
            const paymentsWithSalesId = applyPaymentsToBalance(payments, remainingAmount).map((payment, index) => ({
                ...payment,
                salesId: salesId,
                clientRef: clientRef ? paymentClientRef(clientRef, index) : null,
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

            // The session that takes the last payment is the one that completes the
            // sale: session reports count revenue by completedSessionId, the same
            // way a sale paid in full at checkout carries its session. Left unset,
            // every order settled here (laundry paid at pickup, retail debts) was
            // in no session's revenue at all.
            const completingSessionId = isFullyPaid ? completingSessionOf(payments) : null;

            // Update sales status and payment details
            const updatedSales = await tx.sales.update({
                where: {
                    id: salesId
                },
                data: {
                    paidAmount: updatedPaidAmount,
                    changeAmount: changeAmount,
                    status: isFullyPaid ? "Completed" : "Partially Paid",
                    ...(completingSessionId ? { completedSessionId: completingSessionId } : {}),
                }
            });

            // ── Loyalty Earn on Completion ──
            // Steps 0-3 (redeem / subscription / voucher) already ran at sale
            // creation; only the EARN leg was deferred until full payment.
            // creditEarnedPoints applies calcPointsEarned with the tenant's
            // rounding mode — the previous inline math credited fractional points.
            if (isFullyPaid && performedBy.loyaltyTier && performedBy.loyaltyTier !== 'none' && sales.customerId) {
                const account = await tx.loyaltyAccount.findFirst({
                    where: { customerId: sales.customerId, deleted: false },
                    include: performedBy.loyaltyTier === 'advanced' ? { loyaltyTier: true } : undefined,
                });

                if (account) {
                    const program = await loyaltyService.getCachedProgram(databaseName);
                    if (program && program.isActive) {
                        const saleTotal = new Decimal(sales.totalAmount);
                        if (saleTotal.gt(0)) {
                            const pointsEarned = await creditEarnedPoints(
                                tx, account, program, salesId, saleTotal, performedBy
                            );

                            if (pointsEarned > 0) {
                                await tx.sales.update({
                                    where: { id: salesId },
                                    data: { loyaltyPointsEarned: pointsEarned },
                                });
                            }

                            // Tier upgrade + milestones deferred to post-commit
                            // (pre-commit scheduling reads stale totals and is
                            // lost on process restart).
                            if (performedBy.loyaltyTier === 'advanced') {
                                postCommitTierAccountId = account.id;
                            }
                            postCommitMilestoneCustomerId = sales.customerId;
                        }
                    }
                }
            }
            // ── End Loyalty Earn ──

            return { updatedSales, totalNewPaymentAmount, remainingAmount };
        });

        // ── Post-commit loyalty follow-ups (fire-and-forget) ──
        if (postCommitTierAccountId !== null) {
            const accountIdForTier = postCommitTierAccountId;
            setImmediate(() => {
                loyaltyService.checkTierUpgrade(databaseName, accountIdForTier).catch(err =>
                    console.error('Tier auto-upgrade check failed:', err)
                );
            });
        }
        if (postCommitMilestoneCustomerId !== null) {
            const custId = postCommitMilestoneCustomerId;
            setImmediate(() => {
                voucherService.checkMilestones(databaseName, custId).catch(err =>
                    console.error('Voucher milestone check failed:', err)
                );
            });
        }

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
        // A concurrent replay with the same key committed first.
        if (clientRef && isClientRefConflict(error)) {
            const paidSaleId = await findPaidSaleIdByClientRef(tenantPrisma, clientRef);
            if (paidSaleId !== null) {
                return markAlreadyRecorded(await getById(databaseName, paidSaleId));
            }
        }
        throw error;
    }
}

/**
 * Atomically claim a sale's reversal transition (Completed → Voided/Returned/Refunded).
 *
 * The three reversal endpoints used to read the sale, check
 * `status === "Completed"`, then write the new status. Under MySQL's default
 * REPEATABLE READ that read takes no lock, so two concurrent requests for the
 * same sale could BOTH pass the check and BOTH restore stock — double-crediting
 * inventory. That is exactly what happened to sale #6068 on 2026-07-26 (two taps
 * 197ms apart, two distinct idempotency keys, stock restored twice).
 *
 * Expressing the transition as a single conditional write closes the window: the
 * first request flips the row, the loser matches zero rows and throws before it
 * can touch stock or loyalty.
 *
 * Returns the freshly-updated sale so callers keep their existing return shape.
 */
const claimSalesReversal = async (
    tx: Prisma.TransactionClient,
    salesId: number,
    toStatus: string,
    conflictMessage: string
) => {
    const claimed = await tx.sales.updateMany({
        where: { id: salesId, deleted: false, status: "Completed" },
        data: { status: toStatus },
    });
    if (claimed.count === 0) {
        // Lost the race (or the status moved between the read and here).
        throw new BusinessLogicError(conflictMessage);
    }
    return await tx.sales.findUniqueOrThrow({ where: { id: salesId } });
};

let voidSales = async (
    databaseName: string,
    tenantId: number,
    performedBy: PerformedBy,
    salesId: number,
    outletId: number,
    // Acting terminal performing the mutation (client-supplied, nullable).
    actingSiteId?: number | null
) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const result = await tenantPrisma.$transaction(async (tx) => {
            // Get the sales record, scoped to the requesting outlet so a user in
            // outlet A cannot void a sale belonging to outlet B by guessing its id.
            const sales = await tx.sales.findFirst({
                where: {
                    id: salesId,
                    outletId: outletId,
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
            // Retail Lite has no returns or refunds, so a void there is only for
            // fixing a mistake: within 24 hours of the sale (timezone-proof).
            if (isLitePlan(performedBy.planName) && sales.createdAt &&
                Date.now() - sales.createdAt.getTime() > LITE_VOID_WINDOW_MS) {
                throw new PlanLimitError(
                    'On the Lite plan a sale can only be voided within 24 hours',
                    ErrorCode.PlanFeatureLocked,
                    { plan: 'Lite' },
                );
            }

            // Atomically claim the transition — see claimSalesReversal. The
            // check above gives the precise error message; this is what makes
            // a concurrent second void impossible.
            const updatedSales = await claimSalesReversal(
                tx,
                salesId,
                "Voided",
                "Only completed sales can be voided"
            );

            // Update payment status to voided
            await tx.payment.updateMany({
                where: {
                    salesId: salesId
                },
                data: {
                    status: "Voided"
                }
            });

            // Restore stock for each sales item (with variant support).
            //
            // NOTE: this deliberately reads UNFILTERED lines (`salesItems: true`
            // above, not `activeSalesItems`). A soft-deleted line's stock may or
            // may not have already been corrected by the operator who deleted it —
            // the operation is ad-hoc raw SQL with no SOP — so skipping it here
            // could permanently lose stock. Reversing every line at worst
            // double-restores in a rare hand-patched sale, which is recoverable;
            // under-restoring is not. Revisit if a real remove-line feature lands.
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
                                // Attributed to the acting terminal (the device performing
                                // the reversal); falls back to the sale's terminal of record.
                                siteId: actingSiteId ?? sales.siteId ?? null,
                            },
                        });
                    }
                })
            );

            // ── Loyalty Reversal ──
            // Data-driven: reverse whatever the sale recorded, even after a step down.
            if (sales.customerId) {
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
                type: 'sales_voided', // the app's PushyTopicType name
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
    salesId: number,
    outletId: number,
    // Acting terminal performing the mutation (client-supplied, nullable).
    actingSiteId?: number | null
) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const result = await tenantPrisma.$transaction(async (tx) => {
            // Get the sales record, scoped to the requesting outlet.
            const sales = await tx.sales.findFirst({
                where: {
                    id: salesId,
                    outletId: outletId,
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

            // Atomically claim the transition — see claimSalesReversal. The
            // check above gives the precise error message; this is what makes
            // a concurrent second return impossible.
            const updatedSales = await claimSalesReversal(
                tx,
                salesId,
                "Returned",
                "Only completed sales can be returned"
            );

            // Update payment status to returned
            await tx.payment.updateMany({
                where: {
                    salesId: salesId
                },
                data: {
                    status: "Returned"
                }
            });

            // Restore stock for each sales item (with variant support).
            //
            // NOTE: this deliberately reads UNFILTERED lines (`salesItems: true`
            // above, not `activeSalesItems`). A soft-deleted line's stock may or
            // may not have already been corrected by the operator who deleted it —
            // the operation is ad-hoc raw SQL with no SOP — so skipping it here
            // could permanently lose stock. Reversing every line at worst
            // double-restores in a rare hand-patched sale, which is recoverable;
            // under-restoring is not. Revisit if a real remove-line feature lands.
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
                                previousAvailableQuantity: stockBalance.availableQuantity.toNumber(),
                                previousOnHandQuantity: stockBalance.onHandQuantity.toNumber(),
                                availableQuantityDelta: restoreQty.toNumber(),
                                onHandQuantityDelta: restoreQty.toNumber(),
                                movementType: 'Sales Return',
                                documentId: salesId,
                                reason: '',
                                remark: `Sales #${salesId} returned`,
                                // Attributed to the acting terminal (the device performing
                                // the reversal); falls back to the sale's terminal of record.
                                siteId: actingSiteId ?? sales.siteId ?? null,
                            },
                        });
                    }
                })
            );

            // ── Loyalty Reversal ──
            // Data-driven: reverse whatever the sale recorded, even after a step down.
            if (sales.customerId) {
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
                type: 'sales_returned', // the app's PushyTopicType name
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
    salesId: number,
    outletId: number,
    // Acting terminal performing the mutation (client-supplied, nullable).
    actingSiteId?: number | null
) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const result = await tenantPrisma.$transaction(async (tx) => {
            // Get the sales record, scoped to the requesting outlet.
            const sales = await tx.sales.findFirst({
                where: {
                    id: salesId,
                    outletId: outletId,
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

            // Atomically claim the transition — see claimSalesReversal. The
            // check above gives the precise error message; this is what makes
            // a concurrent second refund impossible.
            const updatedSales = await claimSalesReversal(
                tx,
                salesId,
                "Refunded",
                "Only completed sales can be refunded"
            );

            // Update payment status to refunded
            await tx.payment.updateMany({
                where: {
                    salesId: salesId
                },
                data: {
                    status: "Refunded"
                }
            });

            // Restore stock for each sales item (with variant support).
            //
            // NOTE: this deliberately reads UNFILTERED lines (`salesItems: true`
            // above, not `activeSalesItems`). A soft-deleted line's stock may or
            // may not have already been corrected by the operator who deleted it —
            // the operation is ad-hoc raw SQL with no SOP — so skipping it here
            // could permanently lose stock. Reversing every line at worst
            // double-restores in a rare hand-patched sale, which is recoverable;
            // under-restoring is not. Revisit if a real remove-line feature lands.
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
                                previousAvailableQuantity: stockBalance.availableQuantity.toNumber(),
                                previousOnHandQuantity: stockBalance.onHandQuantity.toNumber(),
                                availableQuantityDelta: restoreQty.toNumber(),
                                onHandQuantityDelta: restoreQty.toNumber(),
                                movementType: 'Sales Refund',
                                documentId: salesId,
                                reason: '',
                                remark: `Sales #${salesId} refunded`,
                                // Attributed to the acting terminal (the device performing
                                // the reversal); falls back to the sale's terminal of record.
                                siteId: actingSiteId ?? sales.siteId ?? null,
                            },
                        });
                    }
                })
            );

            // ── Loyalty Reversal ──
            // Data-driven: reverse whatever the sale recorded, even after a step down.
            if (sales.customerId) {
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
                type: 'sales_refunded', // the app's PushyTopicType name
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
    outletId: number,
    deliveryNotes?: string,
    deliveredAt?: Date
) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);

    try {
        await tenantPrisma.$transaction(async (tx) => {
            // Validate all sales exist in the requesting outlet. Any id that
            // belongs to another outlet (or doesn't exist) drops out of the
            // result and we surface a 404 — never letting a user confirm
            // delivery of a sale that isn't theirs.
            const sales = await tx.sales.findMany({
                where: {
                    id: { in: salesIds },
                    outletId: outletId,
                    deleted: false
                }
            });

            if (sales.length !== salesIds.length) {
                throw new NotFoundError('One or more sales records not found in this outlet');
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

        // Send delivery notification (non-blocking). All sales were filtered
        // by the requesting outlet, so we route the topic by that outlet. It goes
        // to the outlet's SALES topic: no permission ever produced a `_delivery`
        // topic, so nobody received it (fixed 2026-10-14).
        if (outletId) {
            PushyService.sendToTopic(
                `tenant_${tenantId}_outlet_${outletId}_sales`,
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

/**
 * Edit ONLY the contact fields (customerName / phoneNumber) of an existing sale.
 *
 * This is the single sanctioned path for mutating an otherwise-immutable sale
 * snapshot — used to fix walk-in typos in the captured name/phone. It deliberately
 * touches NOTHING else: not customerId, addresses, amounts, status, or items.
 *
 * `updatedAt` is bumped automatically by Prisma's `@updatedAt` on the Sales model.
 *
 * @throws NotFoundError if no non-deleted sale with `salesId` exists in the tenant.
 */
let updateSalesContact = async (
    databaseName: string,
    salesId: number,
    details: {
        customerName?: string; phoneNumber?: string; remark?: string;
        shipStreet?: string; shipCity?: string; shipState?: string;
        shipPostalCode?: string; shipCountry?: string;
    },
    // Scopes the lookup to the requesting outlet so a user in outlet A cannot
    // edit a sale belonging to outlet B by guessing its id (MULTI_OUTLET_BE.md §5.2).
    outletId?: number
) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);

    // Build a minimal patch containing only the provided fields (already trimmed by
    // the controller). Whitelisted to safe metadata only — never money/stock/status.
    const data: typeof details = {};
    const fields: Array<keyof typeof details> = [
        'customerName', 'phoneNumber', 'remark',
        'shipStreet', 'shipCity', 'shipState', 'shipPostalCode', 'shipCountry',
    ];
    for (const field of fields) {
        if (details[field] !== undefined) data[field] = details[field];
    }

    // Guard: the sale must exist, not be soft-deleted, and belong to the
    // requesting outlet.
    const existing = await tenantPrisma.sales.findFirst({
        where: {
            id: salesId,
            deleted: false,
            ...(outletId !== undefined ? { outletId } : {}),
        },
        select: { id: true },
    });
    if (!existing) {
        throw new NotFoundError("Sales");
    }

    // No-op patch (neither field provided) — return current snapshot unchanged.
    if (Object.keys(data).length === 0) {
        return getById(databaseName, salesId, outletId);
    }

    await tenantPrisma.sales.update({
        where: { id: salesId },
        data, // @updatedAt bumps UPDATED_AT automatically
    });

    return getById(databaseName, salesId, outletId);
}

export = {
    getAll,
    getByDateRange,
    getById,
    updateSalesContact,
    getByRef,
    collect,
    calculateSales,
    completeNewSales,
    update,
    remove,
    getTotalSalesData,
    getRevenueTrend,
    getPartiallyPaidSales,
    addPaymentToPartiallyPaidSales,
    voidSales,
    returnSales,
    refundSales,
    getDeliveryList,
    getDeliveredList,
    confirmDeliveryBatch,
    // Pure helpers exposed for unit testing — no DB access.
    __testables: {
        getEffectiveStockQty,
        validateSalesItemNumerics,
        validatePaymentNumerics,
        applyPaymentsToBalance,
        completingSessionOf,
        toDecimalOrThrow,
        // Loyalty helpers
        pickBestDiscount,
        calcPointsEarned,
        validateTierMatch,
        tierBaseAfterPackage,
        preLoyaltyTotalOf,
        // Concurrency guard shared by void/return/refund
        claimSalesReversal,
        // Client row shared by every sales-sync read
        salesSyncSelect,
        toSalesSyncRow,
    },
}