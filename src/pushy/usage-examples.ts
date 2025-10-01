/**
 * Push Notification Usage Examples
 * 
 * This file demonstrates how to integrate push notifications into existing services
 * 
 * IMPORTANT: Push notifications are only available for tenants on the Pro plan.
 * Plan name should be passed from JWT token (req.user.planName) to notification methods.
 * Notifications will be automatically skipped if planName !== 'Pro'.
 */

import NotificationService from './notification.service';
import PlanCheckService from './plan-check.service';
import { UserInfo } from '../middleware/authorize-middleware';

// ============================================
// SALES SERVICE INTEGRATION EXAMPLE
// ============================================

export class SalesServiceExample {
  async createSale(saleData: any, userInfo: UserInfo) {
    try {
      // Create sale logic here...
      const sale = { id: 123, amount: 100, customerName: 'John Doe' };

      // Pass planName from JWT token (userInfo.planName)
      // Notification will be silently skipped if planName !== 'Pro'
      await NotificationService.sendSalesNotification(
        userInfo.tenantId,
        'New Sale Created',
        `Sale #${sale.id} for $${sale.amount} to ${sale.customerName}`,
        userInfo.userId, // The user who created the sale (for client-side filtering)
        userInfo.planName, // Pass plan from JWT
        {
          saleId: sale.id,
          amount: sale.amount,
          customerName: sale.customerName
        }
      );

      return sale;
    } catch (error) {
      console.error('Error creating sale:', error);
      throw error;
    }
  }
}

// ============================================
// INVENTORY SERVICE INTEGRATION EXAMPLE
// ============================================

export class InventoryServiceExample {
  async checkLowStock(userInfo: UserInfo) {
    try {
      // Check inventory logic here...
      const lowStockItems = [
        { name: 'Product A', quantity: 5 },
        { name: 'Product B', quantity: 2 }
      ];

      if (lowStockItems.length > 0) {
        // Send notification to users with 'Receive Inventory Notification' permission
        await NotificationService.sendInventoryNotification(
          userInfo.tenantId,
          'Low Stock Alert',
          `${lowStockItems.length} items are running low on stock`,
          undefined, // System-triggered, no specific user
          userInfo.planName, // Pass plan from JWT
          {
            items: lowStockItems,
            timestamp: new Date().toISOString()
          }
        );
      }

      return lowStockItems;
    } catch (error) {
      console.error('Error checking low stock:', error);
      throw error;
    }
  }
}

// ============================================
// CUSTOMER SERVICE INTEGRATION EXAMPLE
// ============================================

// export class CustomerServiceExample {
//   async createCustomer(customerData: any, tenantId: number, userId: number) {
//     try {
//       // Create customer logic here...
//       const customer = { id: 456, name: 'Jane Smith', email: 'jane@example.com' };

//       // Send notification to users with 'Receive Customer Notification' permission
//       await NotificationService.sendCustomerNotification(
//         tenantId,
//         'New Customer Registered',
//         `${customer.name} has been added as a new customer`,
//         userId,
//         {
//           customerId: customer.id,
//           customerName: customer.name,
//           customerEmail: customer.email
//         }
//       );

//       return customer;
//     } catch (error) {
//       console.error('Error creating customer:', error);
//       throw error;
//     }
//   }
// }

// ============================================
// REPORT SERVICE INTEGRATION EXAMPLE
// ============================================

// export class ReportServiceExample {
//   async generateMonthlyReport(tenantId: number) {
//     try {
//       // Generate report logic here...
//       const report = {
//         id: 789,
//         month: 'November 2024',
//         totalSales: 50000,
//         topProduct: 'Product X'
//       };

//       // Send notification to users with 'Receive Report Notification' permission
//       await NotificationService.sendReportNotification(
//         tenantId,
//         'Monthly Report Ready',
//         `${report.month} report is now available for viewing`,
//         undefined, // System-generated
//         {
//           reportId: report.id,
//           month: report.month,
//           totalSales: report.totalSales,
//           topProduct: report.topProduct
//         }
//       );

//       return report;
//     } catch (error) {
//       console.error('Error generating report:', error);
//       throw error;
//     }
//   }
// }

// ============================================
// DIRECT USER NOTIFICATION EXAMPLE
// ============================================

export class DirectNotificationExample {
  async notifySpecificUsers(tenantId: number, userIds: number[], message: string) {
    try {
      // Send notification to specific users
      await NotificationService.sendToSpecificUsers({
        tenantId,
        type: 'SYSTEM',
        title: 'Important Update',
        message,
        userIds,
        data: {
          priority: 'high',
          timestamp: new Date().toISOString()
        }
      });

      return { success: true, notifiedUsers: userIds.length };
    } catch (error) {
      console.error('Error sending direct notification:', error);
      throw error;
    }
  }
}

// ============================================
// USER PREFERENCES MANAGEMENT EXAMPLE
// ============================================

export class PreferencesExample {
  async updateNotificationPreferences(
    userId: number,
    tenantDatabaseName: string,
    preferences: any
  ) {
    try {
      // Update user's notification preferences
      const updated = await NotificationService.updateUserNotificationPreferences(
        userId,
        tenantDatabaseName,
        {
          salesNotifications: preferences.sales ?? true,
          inventoryAlerts: preferences.inventory ?? true,
          customerUpdates: preferences.customer ?? true,
          reportNotifications: preferences.reports ?? true,
          systemAlerts: preferences.system ?? true,
          lowStockThreshold: preferences.lowStockThreshold ?? 10
        }
      );

      return updated;
    } catch (error) {
      console.error('Error updating preferences:', error);
      throw error;
    }
  }

  async getNotificationPreferences(userId: number, tenantDatabaseName: string) {
    try {
      const preferences = await NotificationService.getUserNotificationPreferences(
        userId,
        tenantDatabaseName
      );

      return preferences || {
        salesNotifications: true,
        inventoryAlerts: true,
        customerUpdates: true,
        reportNotifications: true,
        systemAlerts: true,
        lowStockThreshold: 10
      };
    } catch (error) {
      console.error('Error getting preferences:', error);
      return null;
    }
  }
}

// ============================================
// MANUAL PLAN CHECKING EXAMPLE
// ============================================

// export class ManualPlanCheckExample {
//   /**
//    * Example of manually checking Pro plan before performing push notification operations
//    * This is useful when you want to provide different UI/UX for non-Pro users
//    */
//   async checkPlanAndNotify(tenantId: number) {
//     try {
//       // Get detailed plan information
//       const planDetails = await PlanCheckService.getPlanDetails(tenantId);

//       if (!planDetails.isProPlan) {
//         // Handle non-Pro plan case
//         console.log(planDetails.message); // e.g., "Push notifications are only available on Pro plan. Current plan: Basic"
//         return {
//           success: false,
//           message: planDetails.message,
//           currentPlan: planDetails.planName,
//           upgradeRequired: true
//         };
//       }

//       // Pro plan confirmed - proceed with notifications
//       console.log('Pro plan active - notifications enabled');

//       // Notification will still check plan internally (double-check for safety)
//       await NotificationService.sendSystemNotification(
//         tenantId,
//         'System Update',
//         'Your system has been updated successfully',
//         undefined,
//         { timestamp: new Date().toISOString() }
//       );

//       return {
//         success: true,
//         message: 'Notification sent successfully'
//       };
//     } catch (error) {
//       console.error('Error in manual plan check:', error);
//       throw error;
//     }
//   }

//   /**
//    * Example of simple boolean plan check
//    * Useful for conditional logic without needing detailed error messages
//    */
//   async isProPlan(tenantId: number): Promise<boolean> {
//     return await PlanCheckService.isProPlan(tenantId);
//   }

//   /**
//    * Example of clearing plan cache after subscription upgrade
//    * Call this after a tenant upgrades to Pro plan
//    */
//   async onPlanUpgrade(tenantId: number) {
//     // Clear the cache so next check gets fresh data
//     PlanCheckService.clearTenantCache(tenantId);

//     // Verify the new plan status
//     const isNowPro = await PlanCheckService.isProPlan(tenantId);

//     if (isNowPro) {
//       console.log(`Tenant ${tenantId} upgraded to Pro - push notifications enabled`);

//       // Send a welcome notification
//       await NotificationService.sendSystemNotification(
//         tenantId,
//         'Welcome to Pro!',
//         'Push notifications are now enabled for your account',
//         undefined,
//         { upgradeDate: new Date().toISOString() }
//       );
//     }
//   }
// }