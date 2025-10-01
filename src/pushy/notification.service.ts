import PushyService from './pushy.service';
import { PrismaClient as GlobalPrismaClient, TenantUser } from '../../prisma/global-client/generated/global';
import { PrismaClient as TenantPrismaClient, User } from '../../prisma/client/generated/client';
const { getGlobalPrisma, getTenantPrisma } = require('../db');

interface NotificationRequest {
  tenantId: number;
  type: 'SALES' | 'INVENTORY' | 'CUSTOMER' | 'REPORT' | 'SYSTEM';
  title: string;
  message: string;
  triggerUserId?: number;
  planName?: string | null; // Added to check plan from JWT
  data?: any;
}

interface TopicNotificationRequest extends NotificationRequest {
  permissionName: string;
  outletId?: number; // Optional: for outlet-specific notifications
}

interface DeviceNotificationRequest extends NotificationRequest {
  userIds: number[];
}

class NotificationService {
  private static instance: NotificationService;
  private globalPrisma: GlobalPrismaClient;

  private constructor() {
    this.globalPrisma = getGlobalPrisma();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public async sendPermissionBasedNotification(
    request: TopicNotificationRequest
  ): Promise<void> {
    try {
      // Check plan from JWT token only
      if (request.planName !== 'Pro') {
        console.log(`Skipping notification for tenant ${request.tenantId} - Plan: ${request.planName || 'None'}`);
        return;
      }

      // Build topic based on whether this is outlet-specific or tenant-wide
      let topic: string;
      if (request.outletId) {
        // Outlet-specific notification (e.g., sales, inventory, orders)
        topic = `tenant_${request.tenantId}_outlet_${request.outletId}_${request.permissionName}`;
      } else {
        // Tenant-wide notification (e.g., financial, system alerts)
        topic = `tenant_${request.tenantId}_${request.permissionName}`;
      }
      
      const notificationData = {
        title: request.title,
        message: request.message,
        data: {
          type: request.type,
          tenantId: request.tenantId,
          triggerUserId: request.triggerUserId,
          timestamp: new Date().toISOString(),
          ...request.data
        }
      };

      const result = await PushyService.sendToTopic(topic, notificationData);
      
      if (!result.success) {
        console.error('Failed to send permission-based notification:', result.error);
      } else {
        console.log(`Notification sent to topic ${topic}:`, result.id);
      }
    } catch (error) {
      console.error('Error in sendPermissionBasedNotification:', error);
    }
  }

  public async sendToSpecificUsers(
    request: DeviceNotificationRequest
  ): Promise<void> {
    try {
      // Check plan from JWT token only
      if (request.planName !== 'Pro') {
        console.log(`Skipping notification for tenant ${request.tenantId} - Plan: ${request.planName || 'None'}`);
        return;
      }

      const tenantUsers = await this.globalPrisma.tenantUser.findMany({
        where: {
          id: {
            in: request.userIds
          },
          tenantId: request.tenantId
        }
      });

      if (tenantUsers.length === 0) {
        console.log('No valid users found for notification');
        return;
      }

      const devices = await this.globalPrisma.pushyDevice.findMany({
        where: {
          tenantUserId: {
            in: tenantUsers.map(u => u.id)
          },
          isActive: true
        }
      });

      if (devices.length === 0) {
        console.log('No active devices found for users');
        return;
      }

      const deviceTokens = devices.map(d => d.deviceToken);
      
      const notificationData = {
        title: request.title,
        message: request.message,
        data: {
          type: request.type,
          tenantId: request.tenantId,
          triggerUserId: request.triggerUserId,
          timestamp: new Date().toISOString(),
          ...request.data
        }
      };

      const result = await PushyService.sendToDevices(deviceTokens, notificationData);
      
      if (!result.success) {
        console.error('Failed to send user-specific notification:', result.error);
      } else {
        console.log(`Notification sent to ${deviceTokens.length} devices:`, result.id);
      }
    } catch (error) {
      console.error('Error in sendToSpecificUsers:', error);
    }
  }

  public async sendSalesNotification(
    tenantId: number,
    title: string,
    message: string,
    triggerUserId?: number,
    planName?: string | null,
    data?: any,
    outletId?: number
  ): Promise<void> {
    await this.sendPermissionBasedNotification({
      tenantId,
      type: 'SALES',
      permissionName: 'sales',
      title,
      message,
      triggerUserId,
      planName,
      data,
      outletId // Sales are outlet-specific
    });
  }

  public async sendInventoryNotification(
    tenantId: number,
    title: string,
    message: string,
    triggerUserId?: number,
    planName?: string | null,
    data?: any,
    outletId?: number
  ): Promise<void> {
    await this.sendPermissionBasedNotification({
      tenantId,
      type: 'INVENTORY',
      permissionName: 'inventory',
      title,
      message,
      triggerUserId,
      planName,
      data,
      outletId // Inventory alerts are outlet-specific
    });
  }

  public async sendCustomerNotification(
    tenantId: number,
    title: string,
    message: string,
    triggerUserId?: number,
    planName?: string | null,
    data?: any
  ): Promise<void> {
    await this.sendPermissionBasedNotification({
      tenantId,
      type: 'CUSTOMER',
      permissionName: 'customer',
      title,
      message,
      triggerUserId,
      planName,
      data
    });
  }

  public async sendReportNotification(
    tenantId: number,
    title: string,
    message: string,
    triggerUserId?: number,
    planName?: string | null,
    data?: any
  ): Promise<void> {
    await this.sendPermissionBasedNotification({
      tenantId,
      type: 'REPORT',
      permissionName: 'report',
      title,
      message,
      triggerUserId,
      planName,
      data
    });
  }

  public async sendSystemNotification(
    tenantId: number,
    title: string,
    message: string,
    triggerUserId?: number,
    planName?: string | null,
    data?: any
  ): Promise<void> {
    await this.sendPermissionBasedNotification({
      tenantId,
      type: 'SYSTEM',
      permissionName: 'system',
      title,
      message,
      triggerUserId,
      planName,
      data
    });
  }

  public async getUserNotificationPreferences(
    userId: number,
    tenantDatabaseName: string
  ): Promise<any> {
    const tenantPrisma: TenantPrismaClient = getTenantPrisma(tenantDatabaseName);
    
    try {
      const preferences = await tenantPrisma.notificationPreference.findUnique({
        where: {
          userId
        }
      });
      
      return preferences;
    } catch (error) {
      console.error('Error getting user notification preferences:', error);
      return null;
    } finally {
      await tenantPrisma.$disconnect();
    }
  }

  public async updateUserNotificationPreferences(
    userId: number,
    tenantDatabaseName: string,
    preferences: any
  ): Promise<any> {
    const tenantPrisma: TenantPrismaClient = getTenantPrisma(tenantDatabaseName);
    
    try {
      const updated = await tenantPrisma.notificationPreference.upsert({
        where: {
          userId
        },
        update: preferences,
        create: {
          userId,
          ...preferences
        }
      });
      
      return updated;
    } catch (error) {
      console.error('Error updating user notification preferences:', error);
      throw error;
    } finally {
      await tenantPrisma.$disconnect();
    }
  }
}

export default NotificationService.getInstance();