import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth-request';
import { UserInfo } from './authorize-middleware';
import { AuthenticationError, ErrorCode, PlanLimitError } from '../api-helpers/error';

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

/** Retail Lite shows this many days of sales history (older rows stay stored). */
export const LITE_HISTORY_DAYS = 30;

/**
 * Clamp a history start date for Retail Lite: nothing older than
 * [LITE_HISTORY_DAYS] is returned. Other plans get the date back unchanged
 * (a missing date stays missing). Stored, not shown — upgrading brings it back.
 */
export const clampHistoryStart = (planName: string | null | undefined, start: Date | undefined): Date | undefined => {
    if (!isLitePlan(planName)) return start;
    const floor = new Date(Date.now() - LITE_HISTORY_DAYS * 24 * 60 * 60 * 1000);
    return !start || start < floor ? floor : start;
};

/** True when the plan name is the Retail Lite plan (case-insensitive). */
export const isLitePlan = (planName: string | null | undefined): boolean =>
    (planName ?? '').toLowerCase() === 'lite';

/**
 * Deny-list counterpart of [requirePlan]: rejects ONLY the named plans with a
 * 402 + `PLAN_FEATURE_LOCKED`, and lets everything else through — including a
 * null plan (the internal admin account, or a tenant between subscriptions),
 * which an allow-list would wrongly lock out.
 *
 * e.g. `rejectPlan('Lite')` — purchasing is not part of Retail Lite.
 */
export const rejectPlan = (...deniedPlans: string[]) =>
    (req: AuthRequest, _res: Response, next: NextFunction) => {
        const user = req.user as UserInfo | undefined;
        if (!user) {
            return next(new AuthenticationError(401, 'Not authenticated'));
        }
        const plan = (user.planName ?? '').toLowerCase();
        if (deniedPlans.map((p) => p.toLowerCase()).includes(plan)) {
            return next(new PlanLimitError(
                `This feature is not included in the ${user.planName} plan`,
                ErrorCode.PlanFeatureLocked,
                { plan: user.planName ?? '' },
            ));
        }
        return next();
    };
