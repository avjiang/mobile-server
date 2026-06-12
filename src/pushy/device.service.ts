import { PrismaClient as GlobalPrismaClient } from '../../prisma/global-client/generated/global';
import { ADD_ON_IDS } from '../constants/add-on-ids';
const { getGlobalPrisma } = require('../db');

const globalPrisma: GlobalPrismaClient = getGlobalPrisma();
const BASE_DEVICE_LIMIT = 3;
const COST_PER_ADDITIONAL_DEVICE = 20000; // IDR 20,000 per month

interface DeviceLimitCheck {
  canAddDevice: boolean;
  currentCount: number;
  maxAllowed: number;
  requiresPayment: boolean;
  additionalCost?: number;
  message?: string;
}

interface DeviceAllocation {
  tenantId: number;
  deviceId: number;
  allocationType: string;
  subscriptionId?: number | null;
  activatedAt: Date;
}

const checkDeviceLimit = async (tenantId: number): Promise<DeviceLimitCheck> => {
  try {
    // Get all active outlets for this tenant (base device limit from plans)
    const tenantOutlets = await globalPrisma.tenantOutlet.findMany({
      where: {
        tenantId,
        isActive: true
      },
      include: {
        subscriptions: {
          where: {
            status: {
              in: ['Active', 'active', 'trial']
            }
          },
          include: {
            subscriptionPlan: true,
          }
        }
      }
    });

    if (!tenantOutlets || tenantOutlets.length === 0) {
      return {
        canAddDevice: false,
        currentCount: 0,
        maxAllowed: 0,
        requiresPayment: false,
        message: 'No active outlets found'
      };
    }

    // Calculate base device limit from subscription plans
    let totalBaseDevices = 0;
    for (const outlet of tenantOutlets) {
      for (const subscription of outlet.subscriptions) {
        const basePlanLimit = subscription.subscriptionPlan?.maxDevices || BASE_DEVICE_LIMIT;
        totalBaseDevices += basePlanLimit;
      }
    }

    // Get additional devices from tenant-level add-on
    const deviceAddOn = await globalPrisma.tenantAddOn.findUnique({
      where: { tenantId_addOnId: { tenantId, addOnId: ADD_ON_IDS.EXTRA_DEVICE } }
    });
    const totalAdditionalDevices = deviceAddOn?.quantity ?? 0;

    // Get current active device count for this tenant (tenant-wide pool)
    const currentDevices = await globalPrisma.pushyDeviceAllocation.count({
      where: {
        tenantId,
        device: {
          isActive: true
        }
      }
    });

    const maxAllowed = totalBaseDevices + totalAdditionalDevices;

    // Check if can add device
    const canAddDevice = currentDevices < maxAllowed;

    // Determine if payment required
    const requiresPayment = !canAddDevice && currentDevices >= maxAllowed;

    return {
      canAddDevice,
      currentCount: currentDevices,
      maxAllowed,
      requiresPayment,
      additionalCost: requiresPayment ? COST_PER_ADDITIONAL_DEVICE : undefined,
      message: canAddDevice
        ? 'Device can be added'
        : requiresPayment
          ? `Device limit reached. Purchase additional device slot for IDR ${COST_PER_ADDITIONAL_DEVICE.toLocaleString('id-ID')}/month`
          : 'Device limit reached'
    };
  } catch (error) {
    console.error('Error checking device limit:', error);
    throw error;
  }
};

const allocateDevice = async (
  tenantId: number,
  deviceId: number,
  isPaid: boolean = false
): Promise<DeviceAllocation> => {
  try {
    // Get active subscription
    const subscription = await globalPrisma.tenantSubscription.findFirst({
      where: {
        tenantId,
        status: 'Active'
      }
    });

    const allocation = await globalPrisma.pushyDeviceAllocation.create({
      data: {
        tenantId,
        deviceId,
        subscriptionId: subscription?.id,
        allocationType: isPaid ? 'addon' : 'included',
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