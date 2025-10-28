import { PrismaClient as GlobalPrismaClient } from '../../prisma/global-client/generated/global';
const { getGlobalPrisma } = require('../db');
import PlanCheckService from './plan-check.service';

class TokenInvalidationService {
  private static instance: TokenInvalidationService;
  private globalPrisma: GlobalPrismaClient;

  private constructor() {
    this.globalPrisma = getGlobalPrisma();
  }

  public static getInstance(): TokenInvalidationService {
    if (!TokenInvalidationService.instance) {
      TokenInvalidationService.instance = new TokenInvalidationService();
    }
    return TokenInvalidationService.instance;
  }

  /**
   * Invalidate all refresh tokens for a tenant when plan changes
   * This forces all users to re-login and get updated plan info in JWT
   */
  public async invalidateTenantTokensOnPlanChange(tenantId: number): Promise<void> {
    try {
      // Clear plan cache first
      PlanCheckService.clearTenantCache(tenantId);

      // First, get all tenant users for this tenant
      const tenantUsers = await this.globalPrisma.tenantUser.findMany({
        where: {
          tenantId,
          isDeleted: false
        },
        select: {
          id: true
        }
      });

      const tenantUserIds = tenantUsers.map(u => u.id);

      if (tenantUserIds.length === 0) {
        console.log(`No active users found for tenant ${tenantId}`);
        return;
      }

      // Mark all active refresh tokens as revoked instead of deleting
      const result = await this.globalPrisma.refreshToken.updateMany({
        where: {
          tenantUserId: {
            in: tenantUserIds
          },
          revoked: null,
          deleted: false
        },
        data: {
          revoked: new Date(),
          deleted: true
        }
      });

      console.log(`Revoked ${result.count} refresh tokens for tenant ${tenantId} due to plan change`);

      // Note: JWT access tokens cannot be invalidated directly as they are stateless
      // They will naturally expire based on their expiry time (typically short-lived)
      // Users will be forced to re-authenticate when trying to refresh their tokens

    } catch (error) {
      console.error('Error invalidating tenant tokens:', error);
      throw error;
    }
  }

  /**
   * Invalidate tokens for specific users (useful for individual plan changes)
   */
  public async invalidateUserTokens(tenantUserIds: number[]): Promise<void> {
    try {
      // Mark tokens as revoked instead of deleting for audit trail
      const result = await this.globalPrisma.refreshToken.updateMany({
        where: {
          tenantUserId: {
            in: tenantUserIds
          },
          revoked: null,
          deleted: false
        },
        data: {
          revoked: new Date(),
          deleted: true
        }
      });

      console.log(`Revoked ${result.count} refresh tokens for users: ${tenantUserIds.join(', ')}`);
    } catch (error) {
      console.error('Error invalidating user tokens:', error);
      throw error;
    }
  }

  /**
   * Invalidate all tokens for a specific tenant user
   */
  public async invalidateSingleUserTokens(tenantUserId: number): Promise<void> {
    try {
      const result = await this.globalPrisma.refreshToken.updateMany({
        where: {
          tenantUserId,
          revoked: null,
          deleted: false
        },
        data: {
          revoked: new Date(),
          deleted: true
        }
      });

      console.log(`Revoked ${result.count} refresh tokens for tenant user ${tenantUserId}`);
    } catch (error) {
      console.error('Error invalidating single user tokens:', error);
      throw error;
    }
  }

  /**
   * Hook to be called when a subscription plan is upgraded or downgraded
   * This should be integrated into your subscription management logic
   */
  public async onPlanChange(tenantId: number, oldPlan: string | null, newPlan: string): Promise<void> {
    console.log(`Plan change detected for tenant ${tenantId}: ${oldPlan || 'None'} -> ${newPlan}`);

    // Only invalidate tokens if the plan actually changed
    if (oldPlan !== newPlan) {
      await this.invalidateTenantTokensOnPlanChange(tenantId);

      // Optionally, send push notifications to inform users
      // await this.notifyUsersOfPlanChange(tenantId, oldPlan, newPlan);

      // Log the plan change event (optional - for audit trail)
      console.log(`Plan change completed for tenant ${tenantId}. All users must re-login to continue.`);
    }
  }

  /**
   * Get count of active refresh tokens for a tenant (useful for monitoring)
   */
  public async getActiveTokenCount(tenantId: number): Promise<number> {
    try {
      // First get tenant user IDs
      const tenantUsers = await this.globalPrisma.tenantUser.findMany({
        where: {
          tenantId,
          isDeleted: false
        },
        select: {
          id: true
        }
      });

      const tenantUserIds = tenantUsers.map(u => u.id);

      if (tenantUserIds.length === 0) {
        return 0;
      }

      // Count active (non-revoked, non-deleted, non-expired) tokens
      const count = await this.globalPrisma.refreshToken.count({
        where: {
          tenantUserId: {
            in: tenantUserIds
          },
          revoked: null,
          deleted: false,
          OR: [
            { expired: null },
            { expired: { gt: new Date() } }
          ]
        }
      });
      return count;
    } catch (error) {
      console.error('Error counting active tokens:', error);
      return 0;
    }
  }
  /**
   * Clean up old revoked/expired tokens (maintenance task)
   */
  public async cleanupOldTokens(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await this.globalPrisma.refreshToken.deleteMany({
        where: {
          OR: [
            {
              revoked: {
                lt: cutoffDate
              }
            },
            {
              expired: {
                lt: cutoffDate
              }
            },
            {
              deleted: true,
              created: {
                lt: cutoffDate
              }
            }
          ]
        }
      });

      console.log(`Cleaned up ${result.count} old tokens`);
      return result.count;
    } catch (error) {
      console.error('Error cleaning up old tokens:', error);
      return 0;
    }
  }
}

export default TokenInvalidationService.getInstance();