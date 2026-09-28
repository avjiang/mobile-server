import { Request, Response, NextFunction } from "express";
import { ForbiddenError, RequestValidateError } from "../api-helpers/error";
import { AuthRequest } from "./auth-request";
import { getTenantPrisma } from "../db";

/**
 * Outlet-authorization + default-resolution middleware.
 *
 * Two responsibilities:
 *  1. When the request carries an explicit outlet context (body → query → params
 *     → `X-Outlet-ID` header), validate it and authorize it against the caller's
 *     `allowedOutletIds` (admins bypass).
 *  2. When it does NOT (the currently-released app sends no `X-Outlet-ID`), resolve
 *     a DEFAULT outlet server-side so outlet-scoped endpoints keep working instead
 *     of 400-ing. The default is the caller's PRIMARY outlet — from the JWT
 *     (`allowedOutletIds[0]`, zero DB cost) or, for pre-multi-outlet tokens that
 *     don't carry it, a one-shot lookup of the tenant's primary/first outlet.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ ⚠️  MULTI-OUTLET SAFETY CAVEAT — READ BEFORE ONBOARDING A MULTI-OUTLET TENANT │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ The default-to-primary-outlet fallback is ONLY safe while every tenant is     │
 * │ single-outlet (true as of 2026-07). For a genuinely multi-outlet tenant, a    │
 * │ request that omits the outlet context would be silently attributed to the     │
 * │ PRIMARY outlet — writing a sale/session/payment to the wrong outlet. Before    │
 * │ any tenant goes multi-outlet, the released app MUST be forced to always send  │
 * │ `X-Outlet-ID` (hard force-update wall) and this fallback MUST be removed /     │
 * │ turned into a 400. See docs/future/OUTLET_MERGE_AUDIT.md (BE-2).              │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */
export const requireOutletAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        // Extract outletId from body → query → params → header (in that order)
        const rawOutletId =
            req.body?.outletId ??
            req.query?.outletId ??
            req.params?.outletId ??
            req.headers['x-outlet-id'];

        // 0 / "0" is the clients' "no outlet selected" sentinel (the Flutter app's
        // initiateGET/POST/PUT/DEL default `outletId` to 0). Treat it as ABSENT so it
        // falls through to resolveDefaultOutletId() below rather than being read as an
        // explicit outlet context and 403-ing. Without this, a client that has not yet
        // selected an outlet can never load /outlet/sync to pick one — a login deadlock.
        const isUnsetSentinel = rawOutletId === 0 || rawOutletId === '0';

        if (rawOutletId !== undefined && rawOutletId !== null && rawOutletId !== '' && !isUnsetSentinel) {
            // ── Explicit outlet context: validate + authorize ──
            const requestedOutletId = parseInt(String(rawOutletId), 10);

            if (isNaN(requestedOutletId)) {
                throw new RequestValidateError("Invalid Outlet ID");
            }

            req.outletId = requestedOutletId;

            // Admin users bypass outlet restrictions
            if (req.user?.role !== "admin") {
                const allowedOutletIds = req.user?.allowedOutletIds || [];

                // Empty allow-list = pre-multi-outlet token; can't authorize a specific
                // id against it, so fall through (single-outlet reality). Once tokens
                // reliably carry allowedOutletIds this branch stops being reachable.
                if (allowedOutletIds.length > 0 && !allowedOutletIds.includes(requestedOutletId)) {
                    throw new ForbiddenError("Outlet access denied");
                }
            }
        } else if (req.user) {
            // ── No explicit context: default to the caller's primary outlet ──
            req.outletId = await resolveDefaultOutletId(req);
        }

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Resolve the caller's default outlet when the request omits an outlet context.
 * Token first (no DB), then a one-shot DB lookup for pre-multi-outlet tokens.
 * Returns undefined if nothing resolves (e.g. a zero-outlet tenant) — callers
 * that require an outlet still enforce it downstream.
 */
async function resolveDefaultOutletId(req: AuthRequest): Promise<number | undefined> {
    // 1. From JWT — for a single-outlet tenant this IS the primary outlet. Zero cost.
    const fromToken = req.user?.allowedOutletIds?.[0];
    if (typeof fromToken === 'number' && !isNaN(fromToken)) {
        return fromToken;
    }

    // 2. Pre-multi-outlet token (no allowedOutletIds): resolve from the tenant DB.
    const databaseName = req.user?.databaseName;
    const userId = req.user?.userId;
    if (!databaseName) return undefined;

    try {
        const tenantPrisma = getTenantPrisma(databaseName);

        // Prefer the user's own primary user_outlet row…
        if (typeof userId === 'number') {
            const primary = await tenantPrisma.userOutlet.findFirst({
                where: { userId, isPrimary: true, deleted: false },
                select: { outletId: true },
            });
            if (primary) return primary.outletId;
        }

        // …otherwise the tenant's lowest live outlet id.
        const anyOutlet = await tenantPrisma.outlet.findFirst({
            where: { deleted: false },
            orderBy: { id: 'asc' },
            select: { id: true },
        });
        return anyOutlet?.id;
    } catch {
        // Never block the request on a default-resolution failure; downstream
        // endpoints that truly require an outlet will surface their own error.
        return undefined;
    }
}
