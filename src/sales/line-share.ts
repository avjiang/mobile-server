/**
 * Line-total amounts on a sales line, and their share when one line is stored
 * as several rows.
 *
 * The app sends some SalesItem amounts for the WHOLE line, not per unit:
 * `subtotalAmount`, `discountAmount`, `taxAmount`, `serviceChargeAmount` and
 * `priceBeforeTax` (the line's taxable base — the line after its own discount
 * and its share of the order discount, ex-tax; 0 for a line without tax — see
 * `_performSalesCalculation` in the FE `sales_calculation_helper.dart`). Only
 * `price` is per unit in the request (the row stores price × qty).
 *
 * So a line-total amount must NEVER be multiplied by quantity. When FIFO
 * splits a line across receipts, each row gets `lineTotal × part / whole`, and
 * the rows add back up to the line total. A single row keeps it unchanged.
 */
import { Decimal } from "decimal.js";

type Num = Decimal.Value | { toString(): string } | null | undefined;

const dec = (v: Num): Decimal =>
    v === null || v === undefined || v === "" ? new Decimal(0) : new Decimal(v.toString());

/**
 * The share of a line-total amount that belongs to `part` of the line's
 * `whole` quantity. `whole` of 0 (never valid for a sale line) returns the
 * whole amount rather than dividing by zero.
 */
export const lineShareOf = (lineTotal: Num, part: Num, whole: Num): Decimal => {
    const total = dec(lineTotal);
    const w = dec(whole);
    if (w.isZero()) return total;
    return total.times(dec(part)).dividedBy(w);
};
