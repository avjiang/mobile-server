import { Decimal } from 'decimal.js';

/**
 * Currency-aware money helpers for settlement/payment maths.
 *
 * Money columns are stored Decimal(15,4), but real currencies only have so many
 * minor digits — IDR has none (no sub-rupiah), MYR/USD have two (cents). Comparing
 * a stored bill against a paid amount at 4 decimals strands settlements forever on
 * fractions a currency can never actually pay (e.g. a line-tax remainder of 0.3243).
 *
 * `roundToCurrency` snaps a value to the currency's real minor unit so those
 * sub-unit phantoms vanish. `evaluateMarkAsPaid` implements the capped, shortfall-only
 * "mark as fully paid" decision (validated by smoke_mark_as_paid). See
 * docs/future/CATALOGUE_AND_SETTLEMENT_ENHANCEMENTS.md §3.
 */

// Minor-unit digits per ISO currency. Default to 2 for anything unlisted.
const MINOR_UNITS: Record<string, number> = { IDR: 0, JPY: 0, KRW: 0, VND: 0, MYR: 2, USD: 2, SGD: 2, EUR: 2 };

// Absolute write-off floor per currency (in major units) — the smallest gap we
// always allow to be closed regardless of bill size. Default 1.
const WRITE_OFF_FLOOR: Record<string, number> = { IDR: 1000 };

// Proportional write-off cap: 0.1% of the (rounded) bill. The effective cap is
// max(floor, pct * bill) — so tiny bills still get the floor, large bills scale up.
const WRITE_OFF_PCT = new Decimal('0.001');

export function currencyMinorUnits(currency: string | null | undefined): number {
    const c = (currency || 'IDR').toUpperCase();
    return c in MINOR_UNITS ? MINOR_UNITS[c] : 2;
}

function floorFor(currency: string | null | undefined): number {
    const c = (currency || 'IDR').toUpperCase();
    return c in WRITE_OFF_FLOOR ? WRITE_OFF_FLOOR[c] : 1;
}

/** Snap a value to the currency's real minor unit (HALF_UP). */
export function roundToCurrency(value: Decimal.Value, currency: string | null | undefined): Decimal {
    return new Decimal(value).toDecimalPlaces(currencyMinorUnits(currency), Decimal.ROUND_HALF_UP);
}

/** The maximum shortfall that may be written off via "mark as fully paid". */
export function markAsPaidCap(billRounded: Decimal, currency: string | null | undefined): Decimal {
    return roundToCurrency(
        Decimal.max(new Decimal(floorFor(currency)), billRounded.times(WRITE_OFF_PCT)),
        currency,
    );
}

export type MarkAsPaidStatus = 'ALREADY_PAID' | 'CAN_MARK_PAID' | 'BLOCKED_TOO_LARGE';

export interface MarkAsPaidEvaluation {
    status: MarkAsPaidStatus;
    /** Amount to write off (== rounded outstanding) when CAN_MARK_PAID; otherwise 0. */
    writeOff: Decimal;
    billRounded: Decimal;
    settledRounded: Decimal; // paid + already-written-off, rounded
    outstanding: Decimal;    // bill − settled, rounded (>=0 means a shortfall remains)
    cap: Decimal | null;
}

/**
 * Decide whether a settlement can be closed via "mark as fully paid".
 * `settledRaw` = paidAmount + any existing writeOffAmount (the real coverage so far).
 * Pure + deterministic — the caller recomputes this server-side inside the txn.
 */
export function evaluateMarkAsPaid(
    settlementAmountRaw: Decimal.Value,
    settledRaw: Decimal.Value,
    currency: string | null | undefined,
): MarkAsPaidEvaluation {
    const billRounded = roundToCurrency(settlementAmountRaw, currency);
    const settledRounded = roundToCurrency(settledRaw, currency);
    const outstanding = billRounded.minus(settledRounded);

    if (outstanding.lessThanOrEqualTo(0)) {
        return { status: 'ALREADY_PAID', writeOff: new Decimal(0), billRounded, settledRounded, outstanding, cap: null };
    }
    const cap = markAsPaidCap(billRounded, currency);
    if (outstanding.greaterThan(cap)) {
        return { status: 'BLOCKED_TOO_LARGE', writeOff: new Decimal(0), billRounded, settledRounded, outstanding, cap };
    }
    return { status: 'CAN_MARK_PAID', writeOff: outstanding, billRounded, settledRounded, outstanding, cap };
}
