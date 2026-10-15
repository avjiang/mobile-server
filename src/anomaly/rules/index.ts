/**
 * Detector registration by rule id. A contract test checks this map against
 * anomaly-rules.json: every live/beta rule has a detector and every detector
 * has a registry entry.
 */
import { RULE_ID } from '../registry';
import { detectReversalBurst } from './reversal-burst';
import { detectQuickReversal } from './quick-reversal';
import { detectLargeDiscount } from './large-discount';
import { detectBelowCost } from './below-cost';
import { detectLargeStockWriteOff } from './large-stock-writeoff';
import { detectCashShortage } from './cash-shortage';
import { detectAfterHours } from './after-hours';
import { detectSupplierPriceRise } from './supplier-price-rise';
import { detectVoidRateOutlier } from './void-rate-outlier';
import { detectRepeatedShortage } from './repeated-shortage';

export const DETECTORS: Record<string, (ctx: any) => unknown> = {
    [RULE_ID.REVERSAL_BURST]: detectReversalBurst,
    [RULE_ID.QUICK_REVERSAL]: detectQuickReversal,
    [RULE_ID.LARGE_DISCOUNT]: detectLargeDiscount,
    [RULE_ID.BELOW_COST]: detectBelowCost,
    [RULE_ID.LARGE_STOCK_WRITEOFF]: detectLargeStockWriteOff,
    [RULE_ID.CASH_SHORTAGE]: detectCashShortage,
    [RULE_ID.AFTER_HOURS]: detectAfterHours,
    [RULE_ID.SUPPLIER_PRICE_RISE]: detectSupplierPriceRise,
    [RULE_ID.VOID_RATE_OUTLIER]: detectVoidRateOutlier,
    [RULE_ID.REPEATED_SHORTAGE]: detectRepeatedShortage,
};

export {
    detectReversalBurst, detectQuickReversal, detectLargeDiscount, detectBelowCost, detectLargeStockWriteOff,
    detectCashShortage, detectAfterHours, detectSupplierPriceRise, detectVoidRateOutlier, detectRepeatedShortage,
};
export * from './types';
