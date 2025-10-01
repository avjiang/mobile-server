import { Request, Response } from 'express';
import PushyService from './pushy.service';
import DeviceLimitService from './device-limit.service';
import { PrismaClient as GlobalPrismaClient } from '../../prisma/global-client/generated/global';
import { PrismaClient as TenantPrismaClient } from '../../prisma/client/generated/client';
import { UserInfo } from '../middleware/authorize-middleware';
import { AuthRequest } from '../middleware/auth-request';
const { getGlobalPrisma, getTenantPrisma } = require('../db');

interface RegisterDeviceRequest {
  deviceToken: string;
  platform: 'ios' | 'android' | 'web';
}

interface UpdateDeviceRequest {
  isActive?: boolean;
  platform?: string;
}

class DeviceController {
  private globalPrisma: GlobalPrismaClient;

  constructor() {
    this.globalPrisma = getGlobalPrisma();
  }

  public registerDevice = async (req: AuthRequest, res: Response) => {
    try {
      const userInfo = req.user as UserInfo;
      const { deviceToken, platform } = req.body as RegisterDeviceRequest;

      if (!deviceToken || !platform) {
        return res.status(400).json({
          success: false,
          message: 'Device token and platform are required'
        });
      }

      // Frontend will handle Pro plan checking before allowing device registration
      // Check device limit
      const limitCheck = await DeviceLimitService.checkDeviceLimit(userInfo.tenantId);

      if (!limitCheck.canAddDevice) {
        return res.status(403).json({
          success: false,
          message: limitCheck.message,
          requiresPayment: limitCheck.requiresPayment,
          additionalCost: limitCheck.additionalCost,
          currentCount: limitCheck.currentCount,
          maxAllowed: limitCheck.maxAllowed
        });
      }

      // Check if device already exists
      const existingDevice = await this.globalPrisma.pushyDevice.findUnique({
        where: {
          deviceToken
        }
      });

      if (existingDevice) {
        if (existingDevice.tenantUserId !== userInfo.tenantUserId) {
          return res.status(409).json({
            success: false,
            message: 'Device is already registered to another user'
          });
        }

        // Update existing device
        const updatedDevice = await this.globalPrisma.pushyDevice.update({
          where: {
            id: existingDevice.id
          },
          data: {
            isActive: true,
            platform,
            lastActiveAt: new Date()
          }
        });

        // Subscribe to topics based on permissions
        const topics = await this.getUserTopics(userInfo);
        if (topics.length > 0) {
          await PushyService.subscribeToTopics(deviceToken, topics);
        }

        return res.status(200).json({
          success: true,
          message: 'Device updated successfully',
          device: {
            id: updatedDevice.id,
            deviceToken: updatedDevice.deviceToken,
            platform: updatedDevice.platform,
            isActive: updatedDevice.isActive
          },
          subscribedTopics: topics
        });
      }

      // Create new device
      const newDevice = await this.globalPrisma.pushyDevice.create({
        data: {
          tenantUserId: userInfo.tenantUserId,
          deviceToken,
          platform,
          isActive: true,
          createdAt: new Date(),
          lastActiveAt: new Date()
        }
      });

      // Allocate device
      await DeviceLimitService.allocateDevice(
        userInfo.tenantId,
        newDevice.id,
        false // Not a paid device initially
      );

      // Subscribe to topics based on permissions
      const topics = await this.getUserTopics(userInfo);
      if (topics.length > 0) {
        await PushyService.subscribeToTopics(deviceToken, topics);
      }

      return res.status(201).json({
        success: true,
        message: 'Device registered successfully',
        device: {
          id: newDevice.id,
          deviceToken: newDevice.deviceToken,
          platform: newDevice.platform,
          isActive: newDevice.isActive
        },
        subscribedTopics: topics,
        deviceStats: {
          currentCount: limitCheck.currentCount + 1,
          maxAllowed: limitCheck.maxAllowed
        }
      });
    } catch (error) {
      console.error('Error registering device:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to register device'
      });
    }
  };

  public unregisterDevice = async (req: AuthRequest, res: Response) => {
    try {
      const userInfo = req.user as UserInfo;
      const { deviceToken } = req.params;

      if (!deviceToken) {
        return res.status(400).json({
          success: false,
          message: 'Device token is required'
        });
      }

      // Find device
      const device = await this.globalPrisma.pushyDevice.findUnique({
        where: {
          deviceToken
        }
      });

      if (!device) {
        return res.status(404).json({
          success: false,
          message: 'Device not found'
        });
      }

      if (device.tenantUserId !== userInfo.tenantUserId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to unregister this device'
        });
      }

      // Unsubscribe from all topics
      const topics = await this.getUserTopics(userInfo);
      if (topics.length > 0) {
        await PushyService.unsubscribeFromTopics(deviceToken, topics);
      }

      // Deallocate device
      await DeviceLimitService.deallocateDevice(device.id);

      // Mark device as inactive
      await this.globalPrisma.pushyDevice.update({
        where: {
          id: device.id
        },
        data: {
          isActive: false
        }
      });

      return res.status(200).json({
        success: true,
        message: 'Device unregistered successfully'
      });
    } catch (error) {
      console.error('Error unregistering device:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to unregister device'
      });
    }
  };

  public getUserDevices = async (req: AuthRequest, res: Response) => {
    try {
      const userInfo = req.user as UserInfo;

      const devices = await this.globalPrisma.pushyDevice.findMany({
        where: {
          tenantUserId: userInfo.tenantUserId
        },
        orderBy: {
          lastActiveAt: 'desc'
        }
      });

      return res.status(200).json({
        success: true,
        devices: devices.map(d => ({
          id: d.id,
          deviceToken: d.deviceToken,
          platform: d.platform,
          isActive: d.isActive,
          createdAt: d.createdAt,
          lastActiveAt: d.lastActiveAt
        }))
      });
    } catch (error) {
      console.error('Error getting user devices:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get devices'
      });
    }
  };

  public getTenantDeviceStats = async (req: AuthRequest, res: Response) => {
    try {
      const userInfo = req.user as UserInfo;

      // Check if user has admin permissions
      if (userInfo.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const stats = await DeviceLimitService.getTenantDeviceStats(userInfo.tenantId);
      const limitCheck = await DeviceLimitService.checkDeviceLimit(userInfo.tenantId);

      return res.status(200).json({
        success: true,
        stats: {
          ...stats,
          limit: {
            currentCount: limitCheck.currentCount,
            maxAllowed: limitCheck.maxAllowed,
            canAddDevice: limitCheck.canAddDevice,
            requiresPayment: limitCheck.requiresPayment,
            additionalCost: limitCheck.additionalCost
          }
        }
      });
    } catch (error) {
      console.error('Error getting tenant device stats:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get device stats'
      });
    }
  };

  public purchaseAdditionalDevice = async (req: AuthRequest, res: Response) => {
    try {
      const userInfo = req.user as UserInfo;
      const { quantity = 1 } = req.body;

      // Check if user has admin permissions
      if (userInfo.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const result = await DeviceLimitService.purchaseAdditionalDevice(
        userInfo.tenantId,
        quantity
      );

      return res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Error purchasing additional device:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to purchase additional device slot'
      });
    }
  };

  public updateDeviceStatus = async (req: AuthRequest, res: Response) => {
    try {
      const userInfo = req.user as UserInfo;
      const { deviceToken } = req.params;
      const { isActive } = req.body as UpdateDeviceRequest;

      if (!deviceToken) {
        return res.status(400).json({
          success: false,
          message: 'Device token is required'
        });
      }

      const device = await this.globalPrisma.pushyDevice.findUnique({
        where: {
          deviceToken
        }
      });

      if (!device) {
        return res.status(404).json({
          success: false,
          message: 'Device not found'
        });
      }

      if (device.tenantUserId !== userInfo.tenantUserId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to update this device'
        });
      }

      const updatedDevice = await this.globalPrisma.pushyDevice.update({
        where: {
          id: device.id
        },
        data: {
          isActive,
          lastActiveAt: new Date()
        }
      });

      // Handle topic subscriptions based on active status
      const topics = await this.getUserTopics(userInfo);
      if (isActive && topics.length > 0) {
        await PushyService.subscribeToTopics(deviceToken, topics);
      } else if (!isActive && topics.length > 0) {
        await PushyService.unsubscribeFromTopics(deviceToken, topics);
      }

      return res.status(200).json({
        success: true,
        message: 'Device status updated successfully',
        device: {
          id: updatedDevice.id,
          deviceToken: updatedDevice.deviceToken,
          platform: updatedDevice.platform,
          isActive: updatedDevice.isActive
        }
      });
    } catch (error) {
      console.error('Error updating device status:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update device status'
      });
    }
  };

  private getUserTopics = async (userInfo: UserInfo): Promise<string[]> => {
    try {
      const tenantPrisma: TenantPrismaClient = getTenantPrisma(userInfo.databaseName);

      // Get user with roles and permissions
      const user = await tenantPrisma.user.findUnique({
        where: {
          id: userInfo.userId
        },
        include: {
          roles: {
            include: {
              permission: true
            }
          }
        }
      });

      await tenantPrisma.$disconnect();

      if (!user) {
        return [];
      }

      // Get permission IDs from roles
      const permissionIds = new Set<number>();
      user.roles.forEach(role => {
        role.permission.forEach(rolePermission => {
          permissionIds.add(rolePermission.permissionId);
        });
      });

      // Fetch permissions from global database
      const permissions = await this.globalPrisma.permission.findMany({
        where: {
          id: {
            in: Array.from(permissionIds)
          }
        }
      });

      // Extract notification permissions (check both name and category)
      const notificationPermissions = new Set<string>();
      permissions.forEach(permission => {
        // Check if permission starts with "Receive" AND is in "Notifications" category
        if (permission.name.startsWith('Receive ') && 
            permission.category === 'Notifications') {
          notificationPermissions.add(permission.name);
        }
      });

      // Generate topics
      const topics: string[] = [];

      // Add tenant-wide topic (for system-level notifications)
      topics.push(`tenant_${userInfo.tenantId}`);

      // Add permission-based topics at tenant level
      // These are used for tenant-wide notifications (e.g., financial, system alerts)
      notificationPermissions.forEach(permission => {
        // Convert permission name to topic: "Receive Sales Notification" -> "sales"
        const shortPermission = permission
          .replace('Receive ', '')
          .replace(' Notification', '')
          .replace(' Alert', '')
          .toLowerCase();
        
        // Add tenant-level permission topic
        topics.push(`tenant_${userInfo.tenantId}_${shortPermission}`);
        
        // Note: Outlet-specific topics like `tenant_${tenantId}_outlet_${outletId}_${shortPermission}`
        // will be subscribed dynamically when the user is working in a specific outlet context
        // This is handled by the client app based on the current outlet selection
      });

      // Add user-specific topic for direct messages
      topics.push(`tenant_${userInfo.tenantId}_user_${userInfo.tenantUserId}`);

      return topics;
    } catch (error) {
      console.error('Error getting user topics:', error);
      return [];
    }
  };
}

export default new DeviceController();