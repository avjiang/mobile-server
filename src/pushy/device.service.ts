import { PrismaClient as GlobalPrismaClient } from '../../prisma/global-client/generated/global';
const { getGlobalPrisma } = require('../db');

const globalPrisma: GlobalPrismaClient = getGlobalPrisma();

interface DeviceLimitCheck {
  canAddDevice: boolean;
  currentCount: number;
  /** `null` = no limit. Push devices are unlimited on Pro since 2026-09-29. */
  maxAllowed: number | null;
  message?: string;
}

interface DeviceAllocation {
  tenantId: number;
  deviceId: number;
  allocationType: string;
  subscriptionId?: number | null;
  activatedAt: Date;
}

/**
 * Whether the tenant may register one more push device.
 *
 * Since 2026-09-29 there is no device quota: FCM has no per-device cost, so a
 * Pro tenant can receive pushes on every phone its users log in on (seats are
 * the billed limit). The Extra Device add-on is retired (`isRetiredAddOn`).
 * The Pro-plan gate lives in the callers (`userInfo.planName !== 'Pro'`).
 * An allocation row still marks a device as in use, so the device screens and
 * admin removal keep working.
 */
const checkDeviceLimit = async (tenantId: number): Promise<DeviceLimitCheck> => {
  try {
    const activeOutlets = await globalPrisma.tenantOutlet.count({
      where: {
        tenantId,
        isActive: true,
        subscriptions: { some: { status: { in: ['Active', 'active', 'trial'] } } }
      }
    });

    const currentDevices = await globalPrisma.pushyDeviceAllocation.count({
      where: {
        tenantId,
        device: {
          isActive: true
        }
      }
    });

    if (activeOutlets === 0) {
      return {
        canAddDevice: false,
        currentCount: currentDevices,
        maxAllowed: 0,
        message: 'No active outlets found'
      };
    }

    return {
      canAddDevice: true,
      currentCount: currentDevices,
      maxAllowed: null,
      message: 'Device can be added'
    };
  } catch (error) {
    console.error('Error checking device limit:', error);
    throw error;
  }
};

const allocateDevice = async (
  tenantId: number,
  deviceId: number
): Promise<DeviceAllocation> => {
  try {
    // Get active subscription
    const subscription = await globalPrisma.tenantSubscription.findFirst({
      where: {
        tenantId,
        status: { in: ['Active', 'active', 'trial'] }
      }
    });

    const allocation = await globalPrisma.pushyDeviceAllocation.create({
      data: {
        tenantId,
        deviceId,
        subscriptionId: subscription?.id,
        allocationType: 'included',
        activatedAt: new Date()
      }
    });

    return {
      tenantId: allocation.tenantId,
      deviceId: allocation.deviceId,
      allocationType: allocation.allocationType,
      subscriptionId: allocation.subscriptionId,
      activatedAt: allocation.activatedAt
    };
  } catch (error) {
    console.error('Error allocating device:', error);
    throw error;
  }
};

const deallocateDevice = async (deviceId: number): Promise<void> => {
  try {
    // Check if allocation exists first
    const allocation = await globalPrisma.pushyDeviceAllocation.findUnique({
      where: { deviceId }
    });

    // Only delete if allocation exists
    if (allocation) {
      await globalPrisma.pushyDeviceAllocation.delete({
        where: { deviceId }
      });
    }
  } catch (error) {
    console.error('Error deallocating device:', error);
    throw error;
  }
};

export = {
  checkDeviceLimit,
  allocateDevice,
  deallocateDevice
};