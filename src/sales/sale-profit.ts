import { Decimal } from 'decimal.js';

/**
 * Sale-header profit — the ONE definition of Sales.PROFIT_AMOUNT.
 *
 *   PROFIT_AMOUNT = SUM(sales_item.PROFIT) − sale-level deductions
 *
 * Line profits only know about line-level money (price × qty − cost − line
 * discount − line service charge). Everything the cart takes off AFTER the lines
 * — the manual cart discount and the loyalty chain (tier discount or voucher,
 * prepaid-package / subscription discount, point redemption) — lowers
 * TOTAL_AMOUNT but never reaches a line, so it has to come off the header here.
 * Before 2026-09-28 it didn't: a laundry wash fully covered by a prepaid package
 * had revenue 0 and profit 57,000, and a session showed profit above revenue.
 *
 * Every writer of PROFIT_AMOUNT (sale creation, cost restatement, the backfill
 * script) goes through `netSaleProfit` / `SALE_LEVEL_DEDUCTIONS_SQL`, so a
 * re-sum from lines can never drop the deductions again.
 */

type Money = Decimal | { toString(): string } | number | string | null | undefined;

export interface SaleLevelDeductions {
    discountAmount?: Money;
    loyaltyTierDiscountAmount?: Money;
    voucherDiscountAmount?: Money;
    subscriptionDiscountAmount?: Money;
    loyaltyPointsRedemptionValue?: Money;
}

const toDecimal = (v: Money): Decimal => (v == null ? new Decimal(0) : new Decimal(v.toString()));

export const saleLevelDeductions = (d: SaleLevelDeductions): Decimal =>
    toDecimal(d.discountAmount)
        .plus(toDecimal(d.loyaltyTierDiscountAmount))
        .plus(toDecimal(d.voucherDiscountAmount))
        .plus(toDecimal(d.subscriptionDiscountAmount))
        .plus(toDecimal(d.loyaltyPointsRedemptionValue));

export const netSaleProfit = (lineProfit: Money, d: SaleLevelDeductions): Decimal =>
    toDecimal(lineProfit).minus(saleLevelDeductions(d));

/** The same deductions as a SQL expression over a `sales` row aliased `s`. */
export const SALE_LEVEL_DEDUCTIONS_SQL = `(
    COALESCE(s.DISCOUNT_AMOUNT, 0)
  + COALESCE(s.LOYALTY_TIER_DISCOUNT_AMOUNT, 0)
  + COALESCE(s.VOUCHER_DISCOUNT_AMOUNT, 0)
  + COALESCE(s.SUBSCRIPTION_DISCOUNT_AMOUNT, 0)
  + COALESCE(s.LOYALTY_POINTS_REDEMPTION_VALUE, 0))`;
