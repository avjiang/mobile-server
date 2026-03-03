import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth-request';
import { UserInfo } from './authorize-middleware';
import { LoyaltyNotEnabledError } from '../api-helpers/error';

type LoyaltyTierLevel = 'basic' | 'advanced';

const TIER_LEVELS: Record<string, number> = {
    'none': 0,
    'basic': 1,
    'advanced': 2,
};

/**
 * Middleware factory to gate routes by loyalty tier level.
 *
 * requireLoyalty('basic')    — requires at least Pro plan (basic loyalty)
 * requireLoyalty('advanced') — requires Pro plan + Advanced Loyalty add-on
 */
export const requireLoyalty = (minTier: LoyaltyTierLevel) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        const user = req.user as UserInfo;
        const currentTier = user?.loyaltyTier || 'none';
        const currentLevel = TIER_LEVELS[currentTier] ?? 0;
        const requiredLevel = TIER_LEVELS[minTier] ?? 0;

        if (currentLevel < requiredLevel) {
            return next(new LoyaltyNotEnabledError());
        }

        next();
    };
};
