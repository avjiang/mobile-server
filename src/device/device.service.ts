import { Prisma, PrismaClient } from "../../prisma/client/generated/client"
import { getTenantPrisma } from '../db'

/**
 * Server-coordinated terminal-number assignment for the laundry friendly-number
 * (`YYMMDD-<terminal>-<seq>`).
 *
 * The terminal number is the `RegisteredDevice.siteId`, unique per tenant via
 * `@@unique([tenantId, siteId])`. Assignment is **find-or-create by
 * `clientDeviceId`** (the device fingerprint), so:
 *  - the same physical device always resolves to the SAME number, across any
 *    number of app reinstalls (the row is never deleted on reinstall);
 *  - a brand-new device gets the LOWEST free number within the tenant, with the
 *    DB unique constraint as the backstop against concurrent races.
 *
 * Lives in the TENANT database (RegisteredDevice is a tenant-schema model), so
 * all of a tenant's terminals coordinate through the one tenant DB they share.
 */

interface RegisterTerminalInput {
    clientDeviceId: string
    deviceName?: string
    deviceType?: string
    appVersion?: string
}

interface RegisterTerminalResult {
    siteId: number
    clientDeviceId: string
    isNew: boolean
}

/** Lowest positive integer not yet used as a siteId within this tenant. */
const computeLowestFreeSiteId = async (
    tenantPrisma: PrismaClient,
    tenantId: number,
): Promise<number> => {
    const rows = await tenantPrisma.registeredDevice.findMany({
        where: { tenantId },
        select: { siteId: true },
        orderBy: { siteId: 'asc' },
    })
    const used = new Set<number>(rows.map(r => r.siteId))
    let n = 1
    while (used.has(n)) n++
    return n
}

const isUniqueViolation = (e: unknown): e is Prisma.PrismaClientKnownRequestError =>
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'

/**
 * Idempotently register this terminal and return its assigned number (siteId).
 * Safe to call on every login.
 */
const registerTerminal = async (
    databaseName: string,
    tenantId: number,
    input: RegisterTerminalInput,
): Promise<RegisterTerminalResult> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName)
    const { clientDeviceId, deviceName, deviceType, appVersion } = input

    // 1. Known device → return its existing number (idempotent; survives reinstall).
    const existing = await tenantPrisma.registeredDevice.findUnique({
        where: { clientDeviceId },
    })
    if (existing) {
        await tenantPrisma.registeredDevice.update({
            where: { clientDeviceId },
            data: {
                lastSeenAt: new Date(),
                status: 'active',
                ...(appVersion ? { appVersion } : {}),
            },
        })
        return { siteId: existing.siteId, clientDeviceId, isNew: false }
    }

    // 2. New device → assign the lowest free number, retrying on races.
    for (let attempt = 0; attempt < 6; attempt++) {
        const candidate = await computeLowestFreeSiteId(tenantPrisma, tenantId)
        try {
            const created = await tenantPrisma.registeredDevice.create({
                data: {
                    clientDeviceId,
                    siteId: candidate,
                    tenantId,
                    deviceName: deviceName && deviceName.length > 0 ? deviceName : 'POS',
                    deviceType: deviceType ?? 'pos',
                    appVersion: appVersion ?? null,
                    status: 'active',
                    lastSeenAt: new Date(),
                },
            })
            return { siteId: created.siteId, clientDeviceId, isNew: true }
        } catch (e) {
            if (!isUniqueViolation(e)) throw e
            // Concurrent registration of THIS device → return the winning row.
            const raced = await tenantPrisma.registeredDevice.findUnique({
                where: { clientDeviceId },
            })
            if (raced) return { siteId: raced.siteId, clientDeviceId, isNew: false }
            // Otherwise another device grabbed `candidate` → recompute & retry.
        }
    }
    throw new Error('Unable to assign a terminal number after multiple attempts')
}

export = { registerTerminal }
