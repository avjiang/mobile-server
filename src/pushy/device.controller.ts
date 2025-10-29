import express, { NextFunction, Request, Response } from 'express';
import PushyService from './pushy.service';
import deviceLimitService from './device.service';
import { PrismaClient as GlobalPrismaClient } from '../../prisma/global-client/generated/global';
import { PrismaClient as TenantPrismaClient } from '../../prisma/client/generated/client';
import { UserInfo } from '../middleware/authorize-middleware';
import { AuthRequest } from '../middleware/auth-request';
import authorizeMiddleware from '../middleware/authorize-middleware';
import { sendResponse, sendErrorResponse } from '../api-helpers/network';
import { RequestValidateError, BusinessLogicError, NotFoundError, ResponseError } from '../api-helpers/error';
const { getGlobalPrisma, getTenantPrisma } = require('../db');

const router = express.Router();
const globalPrisma: GlobalPrismaClient = getGlobalPrisma();

interface RegisterDeviceRequest {
  deviceToken: string;
  platform: 'ios' | 'android' | 'web';
  deviceFingerprint: string;
  deviceName?: string;
  appVersion?: string;
}

interface UpdateDeviceRequest {
  isActive?: boolean;
  platform?: string;
}

const registerDevice = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userInfo = req.user as UserInfo;
  const { deviceToken, platform, deviceFingerprint } = req.body as RegisterDeviceRequest;

  if (!deviceToken || !platform) {
    return next(new RequestValidateError('Device token and platform are required'));
  }

  if (!deviceFingerprint) {
    return next(new RequestValidateError('Device fingerprint is required'));
  }

  try {
    // STEP 1: Check if device with same FINGERPRINT exists for this user
    // This handles the reinstall scenario where Pushy token changes
    const existingDeviceByFingerprint = await globalPrisma.pushyDevice.findFirst({
      where: {
        tenantUserId: userInfo.tenantUserId,
        deviceFingerprint: deviceFingerprint
      }
    });

    if (existingDeviceByFingerprint) {
      // REINSTALL SCENARIO: Same device, new Pushy token
      // Update the device token (Pushy token rotation on reinstall)
      const updatedDevice = await globalPrisma.pushyDevice.update({
        where: {
          id: existingDeviceByFingerprint.id
        },
        data: {
          deviceToken: deviceToken,  // Update to new Pushy token
          platform: platform,
          deviceName: req.body.deviceName || existingDeviceByFingerprint.deviceName,
          appVersion: req.body.appVersion,
          isActive: true,
          lastActiveAt: new Date()
        }
      });

      // Subscribe to topics based on permissions
      const topics = await getUserTopics(userInfo);
      // if (topics.length > 0) {
      //   await PushyService.subscribeToTopics(deviceToken, topics);
      // }

      // Get current device usage (count stays the same for reinstalls)
      const limitCheck = await deviceLimitService.checkDeviceLimit(userInfo.tenantId);

      return sendResponse(res, {
        message: 'Device token updated successfully',
        isReinstall: true,
        device: {
          id: updatedDevice.id,
          deviceToken: updatedDevice.deviceToken,
          deviceFingerprint: updatedDevice.deviceFingerprint,
          platform: updatedDevice.platform,
          isActive: updatedDevice.isActive
        },
        subscribedTopics: topics,
        deviceUsage: {
          current: limitCheck.currentCount,
          maximum: limitCheck.maxAllowed
        }
      });
    }

    // STEP 2: Check if device with same DEVICETOKEN exists (edge case)
    const existingDeviceByToken = await globalPrisma.pushyDevice.findUnique({
      where: {
        deviceToken
      }
    });

    if (existingDeviceByToken) {
      // Edge case: Token collision or upgrading from old version without fingerprint
      if (existingDeviceByToken.tenantUserId !== userInfo.tenantUserId) {
        return next(new BusinessLogicError('Device token already registered to another user'));
      }

      // Same token, same user, but different/no fingerprint
      // Update the device with the new fingerprint
      const updatedDevice = await globalPrisma.pushyDevice.update({
        where: {
          id: existingDeviceByToken.id
        },
        data: {
          deviceFingerprint: deviceFingerprint,
          platform: platform,
          deviceName: req.body.deviceName || existingDeviceByToken.deviceName,
          appVersion: req.body.appVersion,
          isActive: true,
          lastActiveAt: new Date()
        }
      });

      const topics = await getUserTopics(userInfo);
      const limitCheck = await deviceLimitService.checkDeviceLimit(userInfo.tenantId);

      return sendResponse(res, {
        message: 'Device updated successfully',
        isReinstall: false,
        device: {
          id: updatedDevice.id,
          deviceToken: updatedDevice.deviceToken,
          deviceFingerprint: updatedDevice.deviceFingerprint,
          platform: updatedDevice.platform,
          isActive: updatedDevice.isActive
        },
        subscribedTopics: topics,
        deviceUsage: {
          current: limitCheck.currentCount,
          maximum: limitCheck.maxAllowed
        }
      });
    }

    // STEP 3: NEW DEVICE - Check quota
    const limitCheck = await deviceLimitService.checkDeviceLimit(userInfo.tenantId);

    if (!limitCheck.canAddDevice) {
      return next(new BusinessLogicError(limitCheck.message || 'Device limit reached'));
    }

    // STEP 4: Create new device
    const newDevice = await globalPrisma.pushyDevice.create({
      data: {
        tenantUserId: userInfo.tenantUserId,
        deviceToken: deviceToken,
        deviceFingerprint: deviceFingerprint,
        platform: platform,
        deviceName: req.body.deviceName || 'Unnamed Device',
        appVersion: req.body.appVersion || '1.0.0',
        isActive: true,
        createdAt: new Date(),
        lastActiveAt: new Date()
      }
    });

    // STEP 5: Allocate device
    await deviceLimitService.allocateDevice(
      userInfo.tenantId,
      newDevice.id,
      false // Not a paid device initially
    );

    // Subscribe to topics based on permissions
    const topics = await getUserTopics(userInfo);
    // if (topics.length > 0) {
    //   await PushyService.subscribeToTopics(deviceToken, topics);
    // }

    return sendResponse(res, {
      message: 'Device registered successfully',
      isReinstall: false,
      device: {
        id: newDevice.id,
        deviceToken: newDevice.deviceToken,
        deviceFingerprint: newDevice.deviceFingerprint,
        platform: newDevice.platform,
        isActive: newDevice.isActive
      },
      subscribedTopics: topics,
      deviceUsage: {
        current: limitCheck.currentCount + 1,
        maximum: limitCheck.maxAllowed
      }
    });
  } catch (error) {
    console.error('Error registering device:', error);
    next(error);
  }
};

const unregisterDevice = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userInfo = req.user as UserInfo;
  const { deviceToken } = req.params;

  if (!deviceToken) {
    return next(new RequestValidateError('Device token is required'));
  }

  try {
    // Find device
    const device = await globalPrisma.pushyDevice.findUnique({
      where: {
        deviceToken
      }
    });

    if (!device) {
      return next(new NotFoundError('Device'));
    }

    if (device.tenantUserId !== userInfo.tenantUserId) {
      return next(new BusinessLogicError('Unauthorized to unregister this device'));
    }

    // Unsubscribe from all topics
    const topics = await getUserTopics(userInfo);
    // if (topics.length > 0) {
    //   await PushyService.unsubscribeFromTopics(deviceToken, topics);
    // }

    // Deallocate device
    await deviceLimitService.deallocateDevice(device.id);

    // Mark device as inactive
    await globalPrisma.pushyDevice.update({
      where: {
        id: device.id
      },
      data: {
        isActive: false
      }
    });

    return sendResponse(res, {
      message: 'Device unregistered successfully'
    });
  } catch (error) {
    console.error('Error unregistering device:', error);
    next(error);
  }
};

const getUserDevices = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userInfo = req.user as UserInfo;

  try {
    const devices = await globalPrisma.pushyDevice.findMany({
      where: {
        tenantUserId: userInfo.tenantUserId
      },
      orderBy: {
        lastActiveAt: 'desc'
      }
    });

    // Get tenant-wide device usage stats
    const limitCheck = await deviceLimitService.checkDeviceLimit(userInfo.tenantId);

    return sendResponse(res, {
      devices: devices.map(d => ({
        id: d.id,
        deviceToken: d.deviceToken,
        platform: d.platform,
        isActive: d.isActive,
        createdAt: d.createdAt,
        lastActiveAt: d.lastActiveAt
      })),
      deviceUsage: {
        current: limitCheck.currentCount,
        maximum: limitCheck.maxAllowed
      }
    });
  } catch (error) {
    console.error('Error getting user devices:', error);
    next(error);
  }
};

const checkDeviceEligibility = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userInfo = req.user as UserInfo;
  const { deviceFingerprint } = req.query;

  try {
    // Check if tenant is on Pro plan
    if (userInfo.planName !== 'Pro') {
      return sendResponse(res, {
        canRegister: false,
        reason: 'Push notifications are only available for Pro plan',
        currentPlan: userInfo.planName,
        deviceUsage: {
          current: 0,
          maximum: 0
        }
      });
    }

    // If deviceFingerprint is provided, check if this device already exists for this user
    if (deviceFingerprint && typeof deviceFingerprint === 'string') {
      const existingDevice = await globalPrisma.pushyDevice.findFirst({
        where: {
          tenantUserId: userInfo.tenantUserId,
          deviceFingerprint: deviceFingerprint
        }
      });

      if (existingDevice) {
        // This is a reinstall scenario - device already registered
        const limitCheck = await deviceLimitService.checkDeviceLimit(userInfo.tenantId);

        return sendResponse(res, {
          canRegister: true,
          reason: 'Existing device will be reactivated',
          isReinstall: true,
          existingDevice: {
            id: existingDevice.id,
            deviceName: existingDevice.deviceName,
            platform: existingDevice.platform,
            lastActiveAt: existingDevice.lastActiveAt
          },
          deviceUsage: {
            current: limitCheck.currentCount,
            maximum: limitCheck.maxAllowed
          },
          requiresPayment: false,
          additionalCost: 0
        });
      }
    }

    // Check device limit for NEW devices
    const limitCheck = await deviceLimitService.checkDeviceLimit(userInfo.tenantId);

    return sendResponse(res, {
      canRegister: limitCheck.canAddDevice,
      reason: limitCheck.canAddDevice
        ? 'Device registration allowed'
        : limitCheck.message || 'Device limit reached',
      isReinstall: false,
      deviceUsage: {
        current: limitCheck.currentCount,
        maximum: limitCheck.maxAllowed
      },
      requiresPayment: limitCheck.requiresPayment || false,
      additionalCost: limitCheck.additionalCost || 0
    });
  } catch (error) {
    console.error('Error checking device eligibility:', error);
    next(error);
  }
};

const getTenantDeviceStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userInfo = req.user as UserInfo;

  // Check if user has admin permissions
  if (userInfo.role !== 'admin') {
    return next(new BusinessLogicError('Admin access required'));
  }

  try {
    const stats = await deviceLimitService.getTenantDeviceStats(userInfo.tenantId);
    const limitCheck = await deviceLimitService.checkDeviceLimit(userInfo.tenantId);

    return sendResponse(res, {
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
    next(error);
  }
};

const purchaseAdditionalDevice = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userInfo = req.user as UserInfo;
  const { quantity = 1 } = req.body;

  // Check if user has admin permissions
  if (userInfo.role !== 'admin') {
    return next(new BusinessLogicError('Admin access required'));
  }

  try {
    const result = await deviceLimitService.purchaseAdditionalDevice(
      userInfo.tenantId,
      quantity
    );

    return sendResponse(res, result);
  } catch (error) {
    console.error('Error purchasing additional device:', error);
    next(error);
  }
};

const updateDeviceStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userInfo = req.user as UserInfo;
  const { deviceToken } = req.params;
  const { isActive } = req.body as UpdateDeviceRequest;

  if (!deviceToken) {
    return next(new RequestValidateError('Device token is required'));
  }

  try {
    const device = await globalPrisma.pushyDevice.findUnique({
      where: {
        deviceToken
      }
    });

    if (!device) {
      return next(new NotFoundError('Device'));
    }

    if (device.tenantUserId !== userInfo.tenantUserId) {
      return next(new BusinessLogicError('Unauthorized to update this device'));
    }

    const updatedDevice = await globalPrisma.pushyDevice.update({
      where: {
        id: device.id
      },
      data: {
        isActive,
        lastActiveAt: new Date()
      }
    });

    // Handle topic subscriptions based on active status
    const topics = await getUserTopics(userInfo);
    // if (isActive && topics.length > 0) {
    //   await PushyService.subscribeToTopics(deviceToken, topics);
    // } else if (!isActive && topics.length > 0) {
    //   await PushyService.unsubscribeFromTopics(deviceToken, topics);
    // }

    return sendResponse(res, {
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
    next(error);
  }
};

const getUserTopics = async (userInfo: UserInfo): Promise<string[]> => {
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
    const permissions = await globalPrisma.permission.findMany({
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

// Device management routes
router.get('/devices/checkQuota', checkDeviceEligibility);
router.post('/devices/register', registerDevice);
router.delete('/devices/:deviceToken', unregisterDevice);
router.get('/devices/user', getUserDevices);
router.patch('/devices/:deviceToken/status', updateDeviceStatus);

// Admin routes
router.get('/admin/devices/stats', getTenantDeviceStats);
router.post('/admin/devices/purchase', purchaseAdditionalDevice);

export = router;