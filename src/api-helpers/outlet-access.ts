import { ForbiddenError } from "./error";
import { getTenantPrisma } from "../db";
import { UserInfo } from "../middleware/authorize-middleware";
import { AuthRequest } from "../middleware/auth-request";

/**
 * The single rule for "which outlets may this caller use".
 *
 *  - admin (the god account)            → unrestricted (`null`)
 *  - token carries a non-empty list     → that list
 *  - token lacks it / carries []        → the user's live `user_outlet` rows,
 *                                         else the tenant's primary outlet
 *                                         (lowest live id)
 *
 * The fallback exists for tokens issued before the multi-outlet deploy (no
 * `allowedOutletIds` claim) and for users with no `user_outlet` row yet: such a
 * caller must see their outlet, never an empty list. Used by the outlet
 * middleware, `/outlet` + `/outlet/sync`, and the procurement create checks, so
 * all of them agree.
 *
 * Resolved at most once per request (memoised on the request's user object).
 */
const cache = new WeakMap<UserInfo, Promise<number[]>>();

export async function resolveAllowedOutletIds(user: UserInfo): Promise<number[] | null> {
    if (user.role === "admin") return null;
    if (Array.isArray(user.allowedOutletIds) && user.allowedOutletIds.length > 0) {
        return user.allowedOutletIds;
    }
    let pending = cache.get(user);
    if (!pending) {
        pending = loadFromTenant(user);
        cache.set(user, pending);
    }
    return pending;
}

async function loadFromTenant(user: UserInfo): Promise<number[]> {
    if (!user.databaseName) return [];
    const tenantPrisma = getTenantPrisma(user.databaseName);

    if (typeof user.userId === "number") {
        try {
            const rows = await tenantPrisma.userOutlet.findMany({
                where: { userId: user.userId, deleted: false },
                select: { outletId: true },
                orderBy: [{ isPrimary: "desc" }, { outletId: "asc" }],
            });
            if (rows.length > 0) return rows.map((r) => r.outletId);
        } catch (error) {
            // e.g. user_outlet missing on a tenant the migration has not reached yet.
            console.error(`resolveAllowedOutletIds: user_outlet lookup failed for ${user.databaseName}:`, error);
        }
    }

    try {
        const primary = await tenantPrisma.outlet.findFirst({
            where: { deleted: false },
            orderBy: { id: "asc" },
            select: { id: true },
        });
        return primary ? [primary.id] : [];
    } catch (error) {
        console.error(`resolveAllowedOutletIds: primary outlet lookup failed for ${user.databaseName}:`, error);
        return [];
    }
}

/** Throws 403 unless the caller may use every one of `outletIds` (admins bypass). */
export async function assertOutletsAllowed(req: AuthRequest, outletIds: Array<number | null | undefined>): Promise<void> {
    if (!req.user) return;
    const allowed = await resolveAllowedOutletIds(req.user);
    if (allowed === null) return;
    for (const id of outletIds) {
        if (typeof id !== "number" || !allowed.includes(id)) {
            throw new ForbiddenError("Outlet access denied");
        }
    }
}
