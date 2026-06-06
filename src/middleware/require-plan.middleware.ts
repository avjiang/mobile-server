import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth-request';
import { UserInfo } from './authorize-middleware';
import { AuthenticationError } from '../api-helpers/error';

/**
 * Gate a route on the tenant's subscription tier (`planName` JWT claim).
 *
 * Rejection uses **402 Payment Required** (plan-tier gate) so it's distinct from
 * 403 (per-user permission). Apply BEFORE `requirePermission` so the plan gate
 * takes precedence. Case-insensitive.
 *
 * e.g. `requirePlan('Pro')` — online catalogue is a Pro-tier feature.
 */
export const requirePlan = (...allowedPlans: string[]) =>
    (req: AuthRequest, _res: Response, next: NextFunction) => {
        const user = req.user as UserInfo | undefined;
        if (!user) {
            return next(new AuthenticationError(401, 'Not authenticated'));
        }
        const plan = (user.planName ?? '').toLowerCase();
        const allowed = allowedPlans.map((p) => p.toLowerCase());
        if (allowed.includes(plan)) {
            return next();
        }
        return next(
            new AuthenticationError(
                402,
                `This feature requires the ${allowedPlans.join(' / ')} plan`
            )
        );
    };
