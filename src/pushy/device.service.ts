import { PrismaClient as GlobalPrismaClient } from '../../prisma/global-client/generated/global';
const { getGlobalPrisma } = require('../db');

const globalPrisma: GlobalPrismaClient = getGlobalPrisma();
const BASE_DEVICE_LIMIT = 3;
const COST_PER_ADDITIONAL_DEVICE = 19000; // IDR 19,000 per month

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
    // Get all active outlets for this tenant
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
            subscriptionAddOn: {
              include: {
                addOn: true
              }
            }
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

    // Calculate total device limit across all outlet subscriptions
    let totalBaseDevices = 0;
    let totalAdditionalDevices = 0;

    const DEVICE_ADDON_ID = 2; // Push Notification Device add-on ID

    for (const outlet of tenantOutlets) {
      for (const subscription of outlet.subscriptions) {
        // Add base devices from each outlet's subscription plan
        const basePlanLimit = subscription.subscriptionPlan?.maxDevices || BASE_DEVICE_LIMIT;
        totalBaseDevices += basePlanLimit;

        // Add additional device add-ons for this subscription (filter by ID instead of name)
        const additionalDevices = subscription.subscriptionAddOn
          .filter(addon => addon.addOnId === DEVICE_ADDON_ID)
          .reduce((sum, addon) => sum + addon.quantity, 0);
        totalAdditionalDevices += additionalDevices;
      }
    }

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
    await globalPrisma.pushyDeviceAllocation.delete({
      where: {
        deviceId
      }
    });
  } catch (error) {
    console.error('Error deallocating device:', error);
    throw error;
  }
};

const getTenantDeviceStats = async (tenantId: number): Promise<any> => {
  try {
    // Get all devices allocated to this tenant
    const allocations = await globalPrisma.pushyDeviceAllocation.findMany({
      where: {
        tenantId
      },
      include: {
        device: {
          include: {
            tenantUser: {
              select: {
                username: true
              }
            }
          }
        }
      }
    });

    const devices = allocations.map(a => ({
      ...a.device,
      allocation: {
        allocationType: a.allocationType,
        activatedAt: a.activatedAt,
        subscriptionId: a.subscriptionId
      }
    }));

    const activeCount = devices.filter(d => d.isActive).length;
    const inactiveCount = devices.filter(d => !d.isActive).length;
    const paidCount = devices.filter(d => d.allocation?.allocationType === 'addon').length;

    return {
      totalDevices: devices.length,
      activeDevices: activeCount,
      inactiveDevices: inactiveCount,
      paidDevices: paidCount,
      freeDevices: activeCount - paidCount,
      devices: devices.map(d => ({
        id: d.id,
        deviceToken: d.deviceToken,
        platform: d.platform,
        isActive: d.isActive,
        isPaid: d.allocation?.allocationType === 'addon' || false,
        username: d.tenantUser?.username || 'Unknown',
        createdAt: d.createdAt,
        lastActiveAt: d.lastActiveAt
      }))
    };
  } catch (error) {
    console.error('Error getting tenant device stats:', error);
    throw error;
  }
};

const purchaseAdditionalDevice = async (
  tenantId: number,
  quantity: number = 1,
  outletId?: number
): Promise<any> => {
  try {
    // If outletId provided, add to specific outlet subscription
    // Otherwise, find the first active subscription
    let subscription;

    if (outletId) {
      subscription = await globalPrisma.tenantSubscription.findFirst({
        where: {
          tenantId,
          outletId,
          status: {
            in: ['Active', 'active', 'trial']
          }
        }
      });
    } else {
      // Default to first active subscription found
      subscription = await globalPrisma.tenantSubscription.findFirst({
        where: {
          tenantId,
          status: {
            in: ['Active', 'active', 'trial']
          }
        }
      });
    }

    if (!subscription) {
      throw new Error('No active subscription found for the specified outlet');
    }

    // Find or create the additional device add-on
    let addOn = await globalPrisma.subscriptionAddOn.findFirst({
      where: {
        name: 'Push Notification Device'
      }
    });

    if (!addOn) {
      addOn = await globalPrisma.subscriptionAddOn.create({
        data: {
          name: 'Push Notification Device',
          addOnType: 'device',
          pricePerUnit: COST_PER_ADDITIONAL_DEVICE,
          maxQuantity: null, // unlimited
          scope: 'tenant',
          description: 'Additional push notification device slot (IDR 19,000/month per device)'
        }
      });
    }

    // Check if tenant subscription already has this add-on
    const existingAddOn = await globalPrisma.tenantSubscriptionAddOn.findFirst({
      where: {
        tenantSubscriptionId: subscription.id,
        addOnId: addOn.id
      }
    });

    if (existingAddOn) {
      // Update quantity
      const updated = await globalPrisma.tenantSubscriptionAddOn.update({
        where: {
          id: existingAddOn.id
        },
        data: {
          quantity: existingAddOn.quantity + quantity
        }
      });

      return {
        success: true,
        message: `Added ${quantity} additional device slot(s)`,
        totalAdditionalDevices: updated.quantity,
        monthlyAdditionalCost: updated.quantity * COST_PER_ADDITIONAL_DEVICE
      };
    } else {
      // Create new add-on usage
      const created = await globalPrisma.tenantSubscriptionAddOn.create({
        data: {
          tenantSubscriptionId: subscription.id,
          addOnId: addOn.id,
          quantity
        }
      });

      return {
        success: true,
        message: `Added ${quantity} additional device slot(s)`,
        totalAdditionalDevices: created.quantity,
        monthlyAdditionalCost: created.quantity * COST_PER_ADDITIONAL_DEVICE
      };
    }
  } catch (error) {
    console.error('Error purchasing additional device:', error);
    throw error;
  }
};

const removeAdditionalDevice = async (
  tenantId: number,
  quantity: number = 1
): Promise<any> => {
  try {
    const subscription = await globalPrisma.tenantSubscription.findFirst({
      where: {
        tenantId,
        status: 'Active'
      },
      include: {
        subscriptionAddOn: {
          include: {
            addOn: true
          }
        }
      }
    });

    if (!subscription) {
      throw new Error('No active subscription found');
    }

    const DEVICE_ADDON_ID = 2; // Push Notification Device add-on ID
    const deviceAddOn = subscription.subscriptionAddOn.find(
      addon => addon.addOnId === DEVICE_ADDON_ID
    );

    if (!deviceAddOn) {
      throw new Error('No additional device add-on found');
    }

    if (deviceAddOn.quantity <= quantity) {
      // Remove the add-on completely
      await globalPrisma.tenantSubscriptionAddOn.delete({
        where: {
          id: deviceAddOn.id
        }
      });

      return {
        success: true,
        message: 'Removed all additional device slots',
        totalAdditionalDevices: 0,
        monthlyAdditionalCost: 0
      };
    } else {
      // Reduce quantity
      const updated = await globalPrisma.tenantSubscriptionAddOn.update({
        where: {
          id: deviceAddOn.id
        },
        data: {
          quantity: deviceAddOn.quantity - quantity
        }
      });

      return {
        success: true,
        message: `Removed ${quantity} additional device slot(s)`,
        totalAdditionalDevices: updated.quantity,
        monthlyAdditionalCost: updated.quantity * COST_PER_ADDITIONAL_DEVICE
      };
    }
  } catch (error) {
    console.error('Error removing additional device:', error);
    throw error;
  }
};

export = {
  checkDeviceLimit,
  allocateDevice,
  deallocateDevice,
  getTenantDeviceStats,
  purchaseAdditionalDevice,
  removeAdditionalDevice
};