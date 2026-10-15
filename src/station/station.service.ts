import { PrismaClient } from "../../prisma/client/generated/client"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { getTenantPrisma } from "../db"

// F&B kitchen stations ("Dapur", "Bar") — docs/modules/FNB.md, D5.

const MAX_NAME = 50

const sync = async (databaseName: string, outletId: number | undefined, lastSyncTimestamp?: string) => {
    const prisma: PrismaClient = getTenantPrisma(databaseName)
    const since = lastSyncTimestamp && lastSyncTimestamp !== "null" ? new Date(lastSyncTimestamp) : null
    if (since && isNaN(since.getTime())) throw new RequestValidateError("lastSyncTimestamp is not a valid date")
    const serverTimestamp = new Date().toISOString()
    const stations = await prisma.station.findMany({
        where: {
            ...(outletId ? { outletId } : {}),
            ...(since ? { updatedAt: { gte: since } } : { deleted: false }),
        },
        orderBy: [{ sequence: "asc" }, { id: "asc" }],
    })
    return { stations, serverTimestamp }
}

const cleanName = (raw: unknown): string => {
    const name = typeof raw === "string" ? raw.trim() : ""
    if (!name) throw new RequestValidateError("Station name is required")
    if (name.length > MAX_NAME) throw new RequestValidateError(`Station name is longer than ${MAX_NAME} characters`)
    return name
}

const create = async (databaseName: string, outletId: number, body: { name?: string; sequence?: number }) => {
    const prisma = getTenantPrisma(databaseName)
    const name = cleanName(body.name)
    const clash = await prisma.station.findFirst({ where: { outletId, name, deleted: false } })
    if (clash) throw new RequestValidateError(`Station "${name}" already exists`)
    return prisma.station.create({ data: { outletId, name, sequence: body.sequence ?? 0 } })
}

const update = async (databaseName: string, outletId: number, id: number, body: { name?: string; sequence?: number }) => {
    const prisma = getTenantPrisma(databaseName)
    const found = await prisma.station.findFirst({ where: { id, outletId, deleted: false } })
    if (!found) throw new NotFoundError("Station")
    const name = cleanName(body.name ?? found.name)
    const clash = await prisma.station.findFirst({ where: { outletId, name, deleted: false, id: { not: id } } })
    if (clash) throw new RequestValidateError(`Station "${name}" already exists`)
    return prisma.station.update({
        where: { id },
        data: { name, sequence: body.sequence ?? found.sequence, version: { increment: 1 } },
    })
}

/** Soft-deletes the station and unroutes every category / item that pointed at it. */
const remove = async (databaseName: string, outletId: number, id: number) => {
    const prisma = getTenantPrisma(databaseName)
    await prisma.$transaction(async (tx) => {
        const found = await tx.station.findFirst({ where: { id, outletId, deleted: false } })
        if (!found) throw new NotFoundError("Station")
        await tx.station.update({ where: { id }, data: { deleted: true, deletedAt: new Date(), version: { increment: 1 } } })
        await tx.category.updateMany({ where: { stationId: id }, data: { stationId: null } })
        await tx.item.updateMany({ where: { stationId: id }, data: { stationId: null, version: { increment: 1 } } })
    })
}

export = { sync, create, update, remove }
