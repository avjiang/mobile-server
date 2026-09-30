/**
 * Manual discount at checkout — per product line + whole order (SPRINT_008).
 *
 * Payload semantics (FE sends, BE stores as-is — no new columns):
 *   SalesItem.discountAmount      = the line's manual discount in Rp, whole line
 *   SalesItem.discountPercentage  = % typed when the cashier chose %, else 0
 *   Sales.totalItemDiscountAmount = Σ line discountAmount
 *   Sales.discountAmount          = manual ORDER discount in Rp
 *   Sales.discountPercentage      = % typed when % chosen, else 0
 *
 * Two checks run on completeNewSales:
 *  1. Sanity (RequestValidateError, no errorCode) — only a tampered or broken
 *     client sends a negative discount, one larger than what it discounts, a %
 *     outside 0–100, or a header total that disagrees with its lines.
 *  2. Cap — a user WITHOUT "Give Discount" (and not '*') may discount at most
 *     `cashier_max_discount_percent` % of the sale's gross (Σ price × qty),
 *     + Rp 1 rounding tolerance. Over it → DISCOUNT_ABOVE_LIMIT { percent }.
 *
 * Offline rule: a sale can reach us long after the money changed hands (the
 * phone's offline outbox). A 4xx there would eventually drop a real sale, so a
 * sale rung more than LATE_SALE_AFTER_MS ago is ACCEPTED over the cap and a
 * warning is logged instead. "Rung at" = the client timestamp `clientCreatedAt`
 * when the app sends one (stamped at checkout, never backdated), else the sale's
 * `businessDate` — which the app stamps with the checkout instant unless the
 * cashier picked a backdate (then it is noon of the picked day, i.e. "late").
 *
 * Everything here is pure except `enforceManualDiscount`, whose I/O (the cap
 * setting) is injected so the tests need no database.
 */
import { Decimal } from "decimal.js";
import { ErrorCode, RequestValidateError } from "../api-helpers/error";
import { PERMISSION } from "../permission/permission-names";

/** Rp tolerance for client-side rounding on every bound. */
export const RUPIAH_TOLERANCE = 1;
/** A sale rung longer ago than this is a late (offline-outbox) arrival. */
export const LATE_SALE_AFTER_MS = 10 * 60 * 1000;
/** Tenant setting key holding the cap for users without "Give Discount". */
export const CAP_SETTING_KEY = "cashier_max_discount_percent";

type Num = Decimal.Value | { toString(): string } | null | undefined;

export interface ManualDiscountLine {
    price?: Num;
    quantity?: Num;
    discountAmount?: Num;
    discountPercentage?: Num;
}

export interface ManualDiscountSale {
    discountAmount?: Num;
    discountPercentage?: Num;
    totalItemDiscountAmount?: Num;
    businessDate?: Date | string | null;
    clientCreatedAt?: Date | string | null;
    salesItems?: ManualDiscountLine[] | null;
}

export interface ManualDiscountSummary {
    /** Σ price × qty, before any discount. */
    gross: Decimal;
    /** Σ line discountAmount. */
    itemAmount: Decimal;
    /** Order discountAmount. */
    orderAmount: Decimal;
    /** itemAmount + orderAmount. */
    total: Decimal;
}

const dec = (v: Num): Decimal => {
    if (v === null || v === undefined || v === "") return new Decimal(0);
    try {
        const d = new Decimal(v.toString());
        return d.isFinite() ? d : new Decimal(NaN);
    } catch {
        return new Decimal(NaN);
    }
};

const isBad = (d: Decimal) => d.isNaN() || !d.isFinite();

/**
 * Sanity-check the discount fields and total them. Throws RequestValidateError
 * (no errorCode — a genuine client never trips these) on the first violation.
 */
export function summarizeManualDiscount(sale: ManualDiscountSale): ManualDiscountSummary {
    const lines = sale.salesItems ?? [];
    let gross = new Decimal(0);
    let itemAmount = new Decimal(0);
    let orderBase = new Decimal(0);

    lines.forEach((line, i) => {
        const base = dec(line.price).times(dec(line.quantity));
        const disc = dec(line.discountAmount);
        const pct = dec(line.discountPercentage);
        if (isBad(base) || isBad(disc) || isBad(pct)) {
            throw new RequestValidateError(`Invalid discount on line ${i + 1}: not a number`);
        }
        if (disc.lt(0)) {
            throw new RequestValidateError(`Invalid discount on line ${i + 1}: discountAmount is negative`);
        }
        if (disc.gt(Decimal.max(base, 0).plus(RUPIAH_TOLERANCE))) {
            throw new RequestValidateError(
                `Invalid discount on line ${i + 1}: discountAmount ${disc} exceeds the line total ${base}`,
            );
        }
        if (pct.lt(0) || pct.gt(100)) {
            throw new RequestValidateError(`Invalid discount on line ${i + 1}: discountPercentage must be 0–100`);
        }
        gross = gross.plus(base);
        itemAmount = itemAmount.plus(disc);
        orderBase = orderBase.plus(base.minus(disc));
    });

    const orderAmount = dec(sale.discountAmount);
    const orderPct = dec(sale.discountPercentage);
    if (isBad(orderAmount) || isBad(orderPct)) {
        throw new RequestValidateError("Invalid order discount: not a number");
    }
    if (orderAmount.lt(0)) {
        throw new RequestValidateError("Invalid order discount: discountAmount is negative");
    }
    if (orderAmount.gt(Decimal.max(orderBase, 0).plus(RUPIAH_TOLERANCE))) {
        throw new RequestValidateError(
            `Invalid order discount: discountAmount ${orderAmount} exceeds the discounted subtotal ${orderBase}`,
        );
    }
    if (orderPct.lt(0) || orderPct.gt(100)) {
        throw new RequestValidateError("Invalid order discount: discountPercentage must be 0–100");
    }

    // The header total is what the reports read; it must agree with the lines.
    if (sale.totalItemDiscountAmount !== undefined && sale.totalItemDiscountAmount !== null) {
        const header = dec(sale.totalItemDiscountAmount);
        if (isBad(header) || header.minus(itemAmount).abs().gt(RUPIAH_TOLERANCE)) {
            throw new RequestValidateError(
                `Invalid discount: totalItemDiscountAmount ${header} does not match the lines' ${itemAmount}`,
            );
        }
    }

    return { gross, itemAmount, orderAmount, total: itemAmount.plus(orderAmount) };
}

/** True when the permission list grants an uncapped manual discount. */
export function canGiveAnyDiscount(permissions: readonly string[] | null | undefined): boolean {
    return (permissions ?? []).some((p) => p === "*" || p === PERMISSION.GIVE_DISCOUNT);
}

/** The stored setting value as a cap in 0–100; missing / unparseable → 0. */
export function parseCapPercent(raw: string | null | undefined): number {
    const n = Number(raw);
    if (raw === null || raw === undefined || String(raw).trim() === "" || !Number.isFinite(n)) return 0;
    return Math.min(100, Math.max(0, n));
}

/** "10" for 10, "12.5" for 12.5 — no trailing ".0" (FE interpolates it as-is). */
export function formatPercent(percent: number): string {
    return String(Number(percent.toFixed(2)));
}

/** The client's "rung at" instant: clientCreatedAt, else businessDate; null if neither parses. */
export function saleRungAt(sale: ManualDiscountSale): Date | null {
    for (const v of [sale.clientCreatedAt, sale.businessDate]) {
        if (v === null || v === undefined || v === "") continue;
        const d = v instanceof Date ? v : new Date(v);
        if (!Number.isNaN(d.getTime())) return d;
    }
    return null;
}

/** A sale rung more than LATE_SALE_AFTER_MS before `now` (or with no usable timestamp). */
export function isLateSale(rungAt: Date | null, now: Date): boolean {
    if (!rungAt) return true; // Can't prove it is fresh → never drop it.
    return now.getTime() - rungAt.getTime() > LATE_SALE_AFTER_MS;
}

export type ManualDiscountDecision =
    | { action: "allow" }
    | { action: "accept-late"; limit: Decimal }
    | { action: "reject"; percent: string; limit: Decimal };

/** Pure cap decision for a sale whose summary already passed the sanity check. */
export function decideManualDiscount(args: {
    summary: ManualDiscountSummary;
    canGiveAnyDiscount: boolean;
    capPercent: number;
    rungAt: Date | null;
    now: Date;
}): ManualDiscountDecision {
    const { summary, capPercent } = args;
    if (summary.total.lte(0) || args.canGiveAnyDiscount) return { action: "allow" };
    const limit = Decimal.max(summary.gross, 0).times(capPercent).dividedBy(100);
    if (summary.total.lte(limit.plus(RUPIAH_TOLERANCE))) return { action: "allow" };
    if (isLateSale(args.rungAt, args.now)) return { action: "accept-late", limit };
    return { action: "reject", percent: formatPercent(capPercent), limit };
}

export interface EnforceManualDiscountContext {
    databaseName: string;
    userId: number;
    username: string;
    /** Effective permissions (live-resolved, JWT fallback). */
    permissions: readonly string[];
    /** Idempotency key / order ref — only for the warning line. */
    saleRef: string | null;
    now?: Date;
}

export interface EnforceManualDiscountDeps {
    /** Raw `cashier_max_discount_percent` value for the tenant (null = not set). */
    readCapSetting: () => Promise<string | null>;
    warn?: (line: string) => void;
}

/**
 * Sanity-check + cap-check a sale. Throws RequestValidateError (sanity) or
 * RequestValidateError(DISCOUNT_ABOVE_LIMIT) for a fresh sale over the cap;
 * logs and returns for a late one.
 */
export async function enforceManualDiscount(
    sale: ManualDiscountSale,
    ctx: EnforceManualDiscountContext,
    deps: EnforceManualDiscountDeps,
): Promise<ManualDiscountDecision> {
    const summary = summarizeManualDiscount(sale);
    const privileged = canGiveAnyDiscount(ctx.permissions);
    if (summary.total.lte(0) || privileged) return { action: "allow" };

    const capPercent = parseCapPercent(await deps.readCapSetting());
    const now = ctx.now ?? new Date();
    const rungAt = saleRungAt(sale);
    const decision = decideManualDiscount({ summary, canGiveAnyDiscount: privileged, capPercent, rungAt, now });

    if (decision.action === "accept-late") {
        const age = rungAt ? `${Math.round((now.getTime() - rungAt.getTime()) / 60000)}m` : "unknown";
        (deps.warn ?? console.warn)(
            `[manual-discount] accepted late sale over the cashier cap: tenant=${ctx.databaseName} ` +
            `user=${ctx.username}(${ctx.userId}) ref=${ctx.saleRef ?? "none"} ` +
            `total=${summary.total.toFixed(2)} cap=${formatPercent(capPercent)}% ` +
            `limit=${decision.limit.toFixed(2)} gross=${summary.gross.toFixed(2)} ` +
            `rungAt=${rungAt?.toISOString() ?? "none"} age=${age}`,
        );
    } else if (decision.action === "reject") {
        throw new RequestValidateError(
            `Manual discount above your limit of ${decision.percent}% of the sale`,
            ErrorCode.DiscountAboveLimit,
            { percent: decision.percent },
        );
    }
    return decision;
}
