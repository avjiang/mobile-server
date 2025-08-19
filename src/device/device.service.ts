import { PrismaClient, Tenant, TenantUser, SubscriptionPlan } from "../../prisma/global-client/generated/global";
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { RegisterDeviceRequest } from "./device.request";
const { getGlobalPrisma, getTenantPrisma, initializeTenantDatabase } = require('../db');

const prisma: PrismaClient = getGlobalPrisma()

let registerDevice = async (databaseName: string, request: RegisterDeviceRequest) => {
    // try {
    //     const existingDevice = await prisma.registeredDevice.findUnique({
    //         where: { clientDeviceId: request.clientDeviceId }
    //     });
    //     if (existingDevice) {
    //         return { siteId: existingDevice.siteId };
    //     }
    //     // Generate next site ID for this tenant using transaction for safety
    //     const result = await prisma.$transaction(async (tx) => {
    //         // Get and increment currentSiteId
    //         const counter = await tx.tenantSiteIdCounter.upsert({
    //             where: { tenantId: request.tenantId },
    //             update: { currentSiteId: { increment: 1 } },
    //             create: { tenantId: request.tenantId, currentSiteId: 1 }, // Start at 1 for new tenants
    //             select: { currentSiteId: true }
    //         });
    //         // Use the incremented siteId for the new device
    //         const newDevice = await tx.registeredDevice.create({
    //             data: {
    //                 clientDeviceId: request.clientDeviceId,
    //                 siteId: counter.currentSiteId, // Use the incremented value
    //                 tenantId: request.tenantId,
    //                 deviceName: request.deviceName,
    //                 deviceType: request.deviceType,
    //                 appVersion: request.appVersion,
    //             }
    //         });
    //         return { siteId: newDevice.siteId };
    //     });
    //     return result;
    // } catch (error) {
    //     throw error;
    // }
}

export = { registerDevice }