/**
 * `manualDiscount` block of the session / outlet / laundry reports (SPRINT_008).
 *
 *   "manualDiscount": {
 *     "totalAmount": 45600, "itemAmount": 30100, "orderAmount": 15500, "salesCount": 7,
 *     "byUser": [ { "userId": 3, "username": "budi", "amount": 30100, "salesCount": 5 } ]
 *   }
 *
 * A sale's manual discount = Sales.totalItemDiscountAmount (Σ line discounts) +
 * Sales.discountAmount (order discount). Callers pass the SAME sales filter their
 * revenue uses, so the block reconciles with the headline figures.
 *
 * `Sales.performedBy` is the client-sent display name — the user's "First Last",
 * or the username when they have no name (FE SalesHelper.setDefaultValues). It is
 * resolved back to a user by username first, then by full name; an unresolved
 * name is kept as its own row with userId 0 so no discount goes missing.
 */
import { Decimal } from "decimal.js";
import { PrismaClient } from "../../prisma/client/generated/client";

type Num = Decimal.Value | { toString(): string } | null | undefined;

export interface ManualDiscountSaleRow {
    totalItemDiscountAmount: Num;
    discountAmount: Num;
    performedBy: string | null;
}

export interface ReportUserRow {
    id: number;
    username: string;
    firstName: string | null;
    lastName: string | null;
}

export interface ManualDiscountByUser {
    userId: number;
    username: string;
    amount: number;
    salesCount: number;
}

export interface ManualDiscountReport {
    totalAmount: number;
    itemAmount: number;
    orderAmount: number;
    salesCount: number;
    byUser: ManualDiscountByUser[];
}

export const EMPTY_MANUAL_DISCOUNT: ManualDiscountReport = Object.freeze({
    totalAmount: 0, itemAmount: 0, orderAmount: 0, salesCount: 0, byUser: [],
}) as ManualDiscountReport;

const dec = (v: Num) => new Decimal(v === null || v === undefined ? 0 : v.toString());
const norm = (s: string | null | undefined) => (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

/** performedBy → user, by username then by "First Last" (case-insensitive). */
export function resolvePerformer(
    performedBy: string | null,
    users: readonly ReportUserRow[],
): { userId: number; username: string } {
    const key = norm(performedBy);
    const byUsername = users.find((u) => norm(u.username) === key);
    if (byUsername) return { userId: byUsername.id, username: byUsername.username };
    const byName = users.find(
        (u) => key !== "" && norm([u.firstName, u.lastName].filter((p) => p && p.trim()).join(" ")) === key,
    );
    if (byName) return { userId: byName.id, username: byName.username };
    return { userId: 0, username: (performedBy ?? "").trim() };
}

/** Pure: aggregate discounted sales into the report block. */
export function buildManualDiscountReport(
    sales: readonly ManualDiscountSaleRow[],
    users: readonly ReportUserRow[],
): ManualDiscountReport {
    let item = new Decimal(0);
    let order = new Decimal(0);
    let count = 0;
    const byUser = new Map<string, { userId: number; username: string; amount: Decimal; salesCount: number }>();

    for (const s of sales) {
        const i = dec(s.totalItemDiscountAmount);
        const o = dec(s.discountAmount);
        const total = i.plus(o);
        if (total.lte(0)) continue;
        item = item.plus(i);
        order = order.plus(o);
        count++;
        const who = resolvePerformer(s.performedBy, users);
        const key = who.userId > 0 ? `id:${who.userId}` : `name:${norm(who.username)}`;
        const row = byUser.get(key) ?? { ...who, amount: new Decimal(0), salesCount: 0 };
        row.amount = row.amount.plus(total);
        row.salesCount++;
        byUser.set(key, row);
    }

    return {
        totalAmount: item.plus(order).toNumber(),
        itemAmount: item.toNumber(),
        orderAmount: order.toNumber(),
        salesCount: count,
        byUser: [...byUser.values()]
            .sort((a, b) => b.amount.comparedTo(a.amount) || a.username.localeCompare(b.username))
            .map((r) => ({ userId: r.userId, username: r.username, amount: r.amount.toNumber(), salesCount: r.salesCount })),
    };
}

/**
 * Load + build the block for one report. `where` is the report's revenue filter
 * (e.g. `{ completedSessionId, status: "Completed", deleted: false }`); only the
 * discounted sales in it are read, and users only when there are any.
 */
export async function loadManualDiscountReport(
    tenantPrisma: PrismaClient,
    where: Record<string, unknown>,
): Promise<ManualDiscountReport> {
    const sales = await tenantPrisma.sales.findMany({
        where: {
            ...where,
            OR: [{ totalItemDiscountAmount: { gt: 0 } }, { discountAmount: { gt: 0 } }],
        },
        select: { totalItemDiscountAmount: true, discountAmount: true, performedBy: true },
    });
    if (sales.length === 0) return { ...EMPTY_MANUAL_DISCOUNT, byUser: [] };
    const users = await tenantPrisma.user.findMany({
        select: { id: true, username: true, firstName: true, lastName: true },
        orderBy: { id: "asc" },
    });
    return buildManualDiscountReport(sales, users);
}
