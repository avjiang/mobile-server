import { PrismaClient, Prisma } from "../../prisma/client/generated/client"
import { Decimal } from 'decimal.js';
import { getTenantPrisma } from '../db';

/**
 * Monthly value summary — "what Bayar Yuk! did for you this month".
 *
 * A lean, owner-facing recap (dashboard card + sheet) that makes the value of
 * the subscription visible: money collected after the order, what is still
 * unpaid, customers who came back, drop-off photos, prepaid packages and
 * loyalty. Every plan gets it; the app turns lines for features the plan
 * lacks into an upgrade nudge.
 *
 * Deliberately separate from `generateOutletReport` (~26 queries, heavy): this
 * is ~10 indexed aggregates so the dashboard can call it on every open.
 * See docs/modules/REPORT.md § Monthly value summary.
 */

/** Orders that count: taken and not reversed (same rule as laundry revenue). */
const ORDER_STATUSES = ["Completed", "Partially Paid", "Delivered"];

/**
 * A payment counts as "collected later" when it was recorded this long after
 * its order. Checkout payments are written in the same request as the sale
 * (milliseconds apart, offline replays included), so anything later is a
 * pickup payment (laundry) or a kasbon instalment (retail). Compare CREATED_AT,
 * not BUSINESS_DATE: the checkout payment's business date is also a few ms
 * after the sale's, so a timestamp `>` would count every payment.
 */
const COLLECTED_LATER_GAP_MINUTES = 1;

interface MonthlySummary {
    startDate: string;
    endDate: string;
    orders: { count: number; revenue: number };
    /** Payments on earlier orders received in the period. */
    collectedLater: { count: number; amount: number };
    /** Orders from the period still partly unpaid, and what they owe. */
    outstanding: { count: number; amount: number };
    customers: { served: number; returning: number; new: number };
    /** Laundry only (null for other business types). */
    laundry: { photos: number; pickups: number } | null;
    /** Prepaid packages. `sold` is tenant-wide (a package is not tied to an outlet). */
    packages: { sold: number; soldAmount: number; redemptions: number };
    /** `newMembers` is tenant-wide. */
    loyalty: { pointsEarned: number; pointsRedeemed: number; newMembers: number };
}

const num = (v: Decimal | Prisma.Decimal | number | bigint | null | undefined): number =>
    v == null ? 0 : Number(v.toString());

const generateMonthlySummary = async (
    databaseName: string,
    outletId: number,
    startDate: Date,
    endDate: Date,
    planType?: string | null,
): Promise<MonthlySummary> => {
    const prisma: PrismaClient = getTenantPrisma(databaseName);
    const isLaundry = planType === 'Laundry';
    const inPeriod = { gte: startDate, lte: endDate };
    const periodOrders = { outletId, businessDate: inPeriod, deleted: false };

    const [
        orders,
        outstanding,
        collectedLater,
        customerRows,
        newCustomers,
        packagesSold,
        redemptions,
        loyaltyPoints,
        newMembers,
        laundry,
    ] = await Promise.all([
        prisma.sales.aggregate({
            where: { ...periodOrders, status: { in: ORDER_STATUSES } },
            _count: { id: true },
            _sum: { totalAmount: true },
        }),
        prisma.sales.aggregate({
            where: { ...periodOrders, status: 'Partially Paid' },
            _count: { id: true },
            _sum: { totalAmount: true, paidAmount: true },
        }),
        prisma.$queryRaw<{ orders: bigint; amount: Prisma.Decimal | null }[]>`
            SELECT COUNT(DISTINCT p.SALES_ID) AS orders, SUM(p.PAID_AMOUNT) AS amount
            FROM payment p
            JOIN sales s ON s.ID = p.SALES_ID
            WHERE p.OUTLET_ID = ${outletId}
              AND p.BUSINESS_DATE BETWEEN ${startDate} AND ${endDate}
              AND p.IS_DELETED = 0
              AND p.STATUS NOT IN ('Voided', 'Refunded')
              AND s.IS_DELETED = 0
              AND s.STATUS NOT IN ('Voided')
              AND p.CREATED_AT > s.CREATED_AT + INTERVAL ${COLLECTED_LATER_GAP_MINUTES} MINUTE`,
        // Customers served in the period, and how many of them had ordered before it.
        prisma.$queryRaw<{ served: bigint; returning: bigint }[]>`
            SELECT COUNT(*) AS served,
                   COALESCE(SUM(EXISTS (
                       SELECT 1 FROM sales o
                       WHERE o.CUSTOMER_ID = m.CUSTOMER_ID
                         AND o.BUSINESS_DATE < ${startDate}
                         AND o.IS_DELETED = 0
                         AND o.STATUS <> 'Voided'
                   )), 0) AS returning
            FROM (
                SELECT DISTINCT CUSTOMER_ID FROM sales
                WHERE OUTLET_ID = ${outletId}
                  AND BUSINESS_DATE BETWEEN ${startDate} AND ${endDate}
                  AND CUSTOMER_ID IS NOT NULL
                  AND IS_DELETED = 0
                  AND STATUS <> 'Voided'
            ) m`,
        prisma.customer.count({ where: { deleted: false, createdAt: inPeriod } }),
        prisma.customerSubscription.aggregate({
            where: { deleted: false, startDate: inPeriod },
            _count: { id: true },
            _sum: { paidAmount: true },
        }),
        prisma.sales.count({
            where: { ...periodOrders, status: { in: ORDER_STATUSES }, customerSubscriptionId: { not: null } },
        }),
        prisma.sales.aggregate({
            where: { ...periodOrders, status: { in: ORDER_STATUSES } },
            _sum: { loyaltyPointsEarned: true, loyaltyPointsRedeemed: true },
        }),
        prisma.loyaltyAccount.count({ where: { deleted: false, joinedAt: inPeriod } }),
        isLaundry ? laundryCounts(prisma, outletId, startDate, endDate) : Promise.resolve(null),
    ]);

    const owed = new Decimal(num(outstanding._sum.totalAmount)).minus(num(outstanding._sum.paidAmount));

    return {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        orders: { count: orders._count.id, revenue: num(orders._sum.totalAmount) },
        collectedLater: { count: num(collectedLater[0]?.orders), amount: num(collectedLater[0]?.amount) },
        outstanding: { count: outstanding._count.id, amount: Decimal.max(owed, 0).toNumber() },
        customers: {
            served: num(customerRows[0]?.served),
            returning: num(customerRows[0]?.returning),
            new: newCustomers,
        },
        laundry,
        packages: {
            sold: packagesSold._count.id,
            soldAmount: num(packagesSold._sum.paidAmount),
            redemptions,
        },
        loyalty: {
            pointsEarned: num(loyaltyPoints._sum.loyaltyPointsEarned),
            pointsRedeemed: num(loyaltyPoints._sum.loyaltyPointsRedeemed),
            newMembers,
        },
    };
};

/** Drop-off photos on the period's orders, and orders collected in the period. */
const laundryCounts = async (
    prisma: PrismaClient, outletId: number, startDate: Date, endDate: Date,
): Promise<{ photos: number; pickups: number }> => {
    const [photoRows, pickups] = await Promise.all([
        prisma.$queryRaw<{ photos: bigint }[]>`
            SELECT COUNT(*) AS photos
            FROM sales_photo ph
            JOIN sales s ON s.ORDER_REF = ph.ORDER_REF
            WHERE s.OUTLET_ID = ${outletId}
              AND s.BUSINESS_DATE BETWEEN ${startDate} AND ${endDate}
              AND s.IS_DELETED = 0
              AND ph.IS_DELETED = 0`,
        prisma.sales.count({
            where: { outletId, deleted: false, collectedAt: { gte: startDate, lte: endDate } },
        }),
    ]);
    return { photos: num(photoRows[0]?.photos), pickups };
};

export = { generateMonthlySummary };
