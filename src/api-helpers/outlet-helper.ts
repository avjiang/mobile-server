import { AuthRequest } from "src/middleware/auth-request";
import { RequestValidateError } from "./error";

/**
 * Reads `X-Outlet-ID` directly from the header and asserts the body's
 * (optional) `outletId` field matches. Use this in controllers that mutate
 * outlet-scoped records — the global outlet-authz middleware's body→query→
 * params→header fallback means a body-provided `outletId` would otherwise
 * silently satisfy any check on `req.outletId`, making "header missing"
 * undetectable. This helper makes the header authoritative.
 *
 * Throws `RequestValidateError` (400) on missing/invalid header, or when the
 * body's `outletId` disagrees with the header. Returns the parsed outletId
 * on success.
 */
export function requireOutletHeader(
    req: AuthRequest,
    bodyOutletId?: number | null
): number {
    const raw = req.headers['x-outlet-id'];
    if (raw === undefined || raw === null || raw === '') {
        throw new RequestValidateError('X-Outlet-ID header is required');
    }
    const outletId = parseInt(String(raw), 10);
    if (isNaN(outletId)) {
        throw new RequestValidateError('Invalid X-Outlet-ID header');
    }
    if (bodyOutletId !== undefined && bodyOutletId !== null && bodyOutletId !== outletId) {
        throw new RequestValidateError('Body outletId does not match X-Outlet-ID header');
    }
    return outletId;
}