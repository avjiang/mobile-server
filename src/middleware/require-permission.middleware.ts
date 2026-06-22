import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth-request';
import { UserInfo } from './authorize-middleware';
import { AuthenticationError } from '../api-helpers/error';
import { getEffectivePermissions } from '../auth/permission-cache';

/**
 * Gate a route on a named permission from the global Permission table.
 *
 * Permission names live in src/script/permission_seed.ts. The user's effective
 * permissions are resolved LIVE from the DB (cached ~5 min in permission-cache.ts)
 * rather than read from the JWT, so a permission granted/revoked through the app
 * takes effect within the cache TTL (or immediately, via invalidatePermissions)
 * instead of waiting for the 1-day token to reissue. Super-admin (role id 1) and
 * the avjiang god-account resolve to '*'. If the live resolve fails, we fall back
 * to the JWT-stamped permissions — a transient DB error degrades to the previous
 * (token-based) behavior, never a lockout.
 *
 * Apply this AFTER `requireLoyalty` so plan-tier rejection (402) takes precedence
 * over per-user permission rejection (403).
 */
type PermissionResolver = (db: string, userId: number, username: string) => Promise<string[]>;

export const requirePermission = (
    permission: string,
    // Injectable purely so unit tests can supply a fake; production uses the
    // DB-backed, cached resolver.
    resolve: PermissionResolver = getEffectivePermissions,
) =>
    async (req: AuthRequest, _res: Response, next: NextFunction) => {
        const user = req.user as UserInfo | undefined;
        if (!user) {
            return next(new AuthenticationError(401, 'Not authenticated'));
        }

        let granted: string[];
        try {
            granted = await resolve(user.databaseName, user.userId, user.username);
        } catch (error) {
            // DB unreachable → fall back to the permissions stamped in the token.
            console.error('requirePermission live-resolve failed, falling back to JWT:', error);
            granted = user.permissions ?? [];
        }

        if (granted.includes('*') || granted.includes(permission)) {
            return next();
        }
        return next(new AuthenticationError(403, `Missing permission: ${permission}`));
    };
