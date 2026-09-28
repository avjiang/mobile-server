import { Request, Response, NextFunction } from "express";
import { ForbiddenError, RequestValidateError } from "../api-helpers/error";
import { AuthRequest } from "./auth-request";
import { resolveAllowedOutletIds } from "../api-helpers/outlet-access";

/**
 * Outlet-authorization + default-resolution middleware.
 *
 * Two responsibilities:
 *  1. When the request carries an explicit outlet context (body → query → params
 *     → `X-Outlet-ID` header), validate it and authorize it against the caller's
 *     allowed outlets (admins bypass). A token without `allowedOutletIds` resolves
 *     them from user_outlet / the tenant's primary outlet (api-helpers/outlet-access.ts).
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

            // Admin users bypass outlet restrictions (resolve → null). A token without
            // allowedOutletIds (issued before the multi-outlet deploy) is resolved from
            // user_outlet / the tenant's primary outlet — see api-helpers/outlet-access.ts.
            if (req.user) {
                const allowedOutletIds = await resolveAllowedOutletIds(req.user);
                if (allowedOutletIds !== null && !allowedOutletIds.includes(requestedOutletId)) {
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

    // 2. Token without allowedOutletIds: the shared allow-list rule, whose first entry
    //    is the user's primary user_outlet row, else the tenant's primary outlet.
    //    Never throws (lookup failures resolve to []), so a default-resolution failure
    //    never blocks the request; endpoints that need an outlet surface their own error.
    if (!req.user) return undefined;
    const allowed = await resolveAllowedOutletIds(req.user);
    return allowed?.[0];
}
