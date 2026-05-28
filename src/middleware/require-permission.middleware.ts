import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth-request';
import { UserInfo } from './authorize-middleware';
import { AuthenticationError } from '../api-helpers/error';

/**
 * Gate a route on a named permission from the global Permission table.
 *
 * Permission names live in src/script/permission_seed.ts. The user's effective
 * permissions are stamped into the JWT at login (auth.service.ts.fetchUserPermissions);
 * super-admin (role id 1) and the avjiang god-account get '*'.
 *
 * Apply this AFTER `requireLoyalty` so plan-tier rejection (402) takes precedence
 * over per-user permission rejection (403).
 */
export const requirePermission = (permission: string) =>
    (req: AuthRequest, _res: Response, next: NextFunction) => {
        const user = req.user as UserInfo | undefined;
        if (!user) {
            return next(new AuthenticationError(401, 'Not authenticated'));
        }
        const granted = user.permissions ?? [];
        if (granted.includes('*') || granted.includes(permission)) {
            return next();
        }
        return next(new AuthenticationError(403, `Missing permission: ${permission}`));
    };
