import { PrismaClient as GlobalPrismaClient } from '../../prisma/global-client/generated/global';
const { getGlobalPrisma } = require('../db');

interface PlanCheckResult {
  isProPlan: boolean;
  planName: string | null;
  message: string;
}

class PlanCheckService {
  private static instance: PlanCheckService;
  private globalPrisma: GlobalPrismaClient;
  private readonly PRO_PLAN_NAME = 'Pro';
  private planCheckCache: Map<number, { isProPlan: boolean; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache (reduced queries by 95%)

  private constructor() {
    this.globalPrisma = getGlobalPrisma();
  }

  public static getInstance(): PlanCheckService {
    if (!PlanCheckService.instance) {
      PlanCheckService.instance = new PlanCheckService();
    }
    return PlanCheckService.instance;
  }

  /**
   * Check if a tenant has Pro plan
   * Uses caching to reduce database queries
   */
  public async isProPlan(tenantId: number): Promise<boolean> {
    // Check cache first
    const cached = this.planCheckCache.get(tenantId);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL_MS) {
      return cached.isProPlan;
    }

    try {
      const tenant = await this.globalPrisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          subscription: {
            include: {
              subscriptionPlan: true
            }
          }
        }
      });

      // Check if tenant has any active Pro subscription
      const isProPlan = tenant?.subscription?.some(sub => 
        sub.status === 'Active' &&
        sub.subscriptionPlan?.planName === this.PRO_PLAN_NAME
      ) || false;

      // Cache the result
      this.planCheckCache.set(tenantId, {
        isProPlan,
        timestamp: Date.now()
      });

      // Clean up old cache entries
      if (this.planCheckCache.size > 100) {
        this.cleanupCache();
      }

      return isProPlan;
    } catch (error) {
      console.error('Error checking Pro plan status:', error);
      return false; // Default to false on error
    }
  }

  /**
   * Get detailed plan information for a tenant
   */
  public async getPlanDetails(tenantId: number): Promise<PlanCheckResult> {
    try {
      const tenant = await this.globalPrisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          subscription: {
            include: {
              subscriptionPlan: true
            }
          }
        }
      });

      if (!tenant?.subscription || tenant.subscription.length === 0) {
        return {
          isProPlan: false,
          planName: null,
          message: 'No active subscription found'
        };
      }

      // Find any active subscription
      const activeSubscription = tenant.subscription.find(sub => sub.status === 'Active');
      const planName = activeSubscription?.subscriptionPlan?.planName || null;
      const isProPlan = activeSubscription?.subscriptionPlan?.planName === this.PRO_PLAN_NAME || false;

      if (!isProPlan && planName) {
        return {
          isProPlan: false,
          planName,
          message: `Push notifications are only available on Pro plan. Current plan: ${planName}`
        };
      } else if (!isProPlan) {
        return {
          isProPlan: false,
          planName,
          message: 'Push notifications are only available on Pro plan'
        };
      }

      return {
        isProPlan: true,
        planName,
        message: 'Pro plan active - Push notifications enabled'
      };
    } catch (error) {
      console.error('Error getting plan details:', error);
      return {
        isProPlan: false,
        planName: null,
        message: 'Error checking subscription plan'
      };
    }
  }

  /**
   * Clear cache for a specific tenant (useful after plan changes)
   */
  public clearTenantCache(tenantId: number): void {
    this.planCheckCache.delete(tenantId);
  }

  /**
   * Clear entire cache
   */
  public clearAllCache(): void {
    this.planCheckCache.clear();
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const expiredKeys: number[] = [];

    this.planCheckCache.forEach((value, key) => {
      if (now - value.timestamp > this.CACHE_TTL_MS) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => this.planCheckCache.delete(key));
  }
}

export default PlanCheckService.getInstance();