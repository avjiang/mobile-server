import { AuthRequest } from "src/middleware/auth-request";
import { RequestValidateError } from "./error";

/**
 * Returns the request's resolved outlet id for outlet-scoped mutations.
 *
 * `requireOutletAccess` (global middleware) has already populated `req.outletId`
 * from the explicit outlet context (body/query/params/`X-Outlet-ID`) OR, when the
 * request omits it, from the caller's primary-outlet default — so a released app
 * that never sends `X-Outlet-ID` no longer 400s here. This helper reads that
 * resolved value and, when a body `outletId` is supplied, asserts it agrees.
 *
 * ⚠️  The primary-outlet default is only safe while every tenant is single-outlet.
 *     See the caveat in outlet-authorization.middleware.ts / OUTLET_MERGE_AUDIT.md
 *     (BE-2) before onboarding a multi-outlet tenant.
 *
 * Throws `RequestValidateError` (400) only when no outlet context could be
 * resolved at all (e.g. a zero-outlet tenant), or when the body's `outletId`
 * disagrees with the resolved outlet.
 */
export function requireOutletHeader(
    req: AuthRequest,
    bodyOutletId?: number | null
): number {
    const resolved = req.outletId;
    if (resolved === undefined || resolved === null || isNaN(resolved)) {
        throw new RequestValidateError('Outlet context is required');
    }
    if (bodyOutletId !== undefined && bodyOutletId !== null && bodyOutletId !== resolved) {
        throw new RequestValidateError('Body outletId does not match the request outlet');
    }
    return resolved;
}
