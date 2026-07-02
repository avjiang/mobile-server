import { PrismaClient } from "../../prisma/client/generated/client"
import { getTenantPrisma } from '../db'
import { BusinessLogicError } from "../api-helpers/error"
import {
    createLaundryPhotoUploadTicket,
    UploadTicket,
} from '../catalogue/catalogue-storage.service'

/**
 * Laundry condition photos (≤5 per order). Bytes go straight from the client to
 * Cloudflare R2 via a pre-signed PUT (see catalogue-storage.service); this
 * service mints those tickets and persists the resulting URLs as SalesPhoto
 * rows keyed by orderRef.
 */

const PHOTO_CAP = 5

/** Mint a pre-signed PUT URL for photo #index of an order. */
const mintUploadTicket = (
    tenantId: number,
    orderRef: string,
    index: number,
    contentType: string,
): Promise<UploadTicket> =>
    createLaundryPhotoUploadTicket({ tenantId, orderRef, index, contentType })

/** Persist a photo URL after the client's direct R2 PUT. Enforces the cap. */
const register = async (
    databaseName: string,
    input: { orderRef: string; salesId?: number; photoUrl: string },
) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName)
    const existing = await tenantPrisma.salesPhoto.count({
        where: { orderRef: input.orderRef, deleted: false },
    })
    if (existing >= PHOTO_CAP) {
        throw new BusinessLogicError(`Maximum ${PHOTO_CAP} photos per order`)
    }
    return tenantPrisma.salesPhoto.create({
        data: {
            orderRef: input.orderRef,
            salesId: input.salesId ?? null,
            photoUrl: input.photoUrl,
        },
    })
}

/** List an order's non-deleted photos. */
const listByRef = async (databaseName: string, orderRef: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName)
    return tenantPrisma.salesPhoto.findMany({
        where: { orderRef, deleted: false },
        orderBy: { id: 'asc' },
    })
}

export = { mintUploadTicket, register, listByRef, PHOTO_CAP }
