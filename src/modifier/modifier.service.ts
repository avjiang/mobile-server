import { Prisma, PrismaClient } from "../../prisma/client/generated/client"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { getTenantPrisma } from "../db"
import { ModifierInput, SaveModifierGroupRequest } from "./modifier.request"

const MAX_NAME = 100
const MAX_PRICE = 999999999
const MAX_OPTIONS = 50

type Tx = Prisma.TransactionClient

/**
 * Delta sync for the whole modifier library: groups, their options and the
 * item ↔ group links changed since `lastSyncTimestamp`, deleted rows included so
 * the client can drop them. The library is small (tens of rows), so it is one
 * unpaginated call that the client applies in a single Drift transaction.
 */
const sync = async (databaseName: string, lastSyncTimestamp?: string) => {
    const prisma: PrismaClient = getTenantPrisma(databaseName)
    const since = lastSyncTimestamp && lastSyncTimestamp !== "null" ? new Date(lastSyncTimestamp) : null
    if (since && isNaN(since.getTime())) {
        throw new RequestValidateError("lastSyncTimestamp is not a valid date")
    }
    // Taken BEFORE the reads so a write landing mid-sync is picked up next time.
    const serverTimestamp = new Date().toISOString()
    const changed = since ? { updatedAt: { gte: since } } : {}
    // A first sync skips rows that were already deleted: nothing local to drop.
    const live = since ? {} : { deleted: false }

    const [groups, modifiers, links] = await Promise.all([
        prisma.modifierGroup.findMany({ where: { ...changed, ...live }, orderBy: { id: "asc" } }),
        prisma.modifier.findMany({ where: { ...changed, ...live }, orderBy: { id: "asc" } }),
        prisma.itemModifierGroup.findMany({ where: { ...changed, ...live }, orderBy: { id: "asc" } }),
    ])
    return {
        groups,
        modifiers: modifiers.map((m) => ({ ...m, price: Number(m.price) })),
        links,
        serverTimestamp,
    }
}

const validate = (body: SaveModifierGroupRequest) => {
    const name = body.name?.trim()
    if (!name) throw new RequestValidateError("Group name is required")
    if (name.length > MAX_NAME) throw new RequestValidateError(`Group name is longer than ${MAX_NAME} characters`)
    if (!Array.isArray(body.modifiers) || body.modifiers.length === 0) {
        throw new RequestValidateError("A group needs at least one option")
    }
    if (body.modifiers.length > MAX_OPTIONS) {
        throw new RequestValidateError(`A group has at most ${MAX_OPTIONS} options`)
    }
    const minSelect = body.minSelect ?? 0
    const maxSelect = body.maxSelect ?? 1
    if (!Number.isInteger(minSelect) || minSelect < 0) throw new RequestValidateError("minSelect must be 0 or more")
    if (!Number.isInteger(maxSelect) || maxSelect < 1 || maxSelect < minSelect) {
        throw new RequestValidateError("maxSelect must be at least 1 and not below minSelect")
    }
    if (minSelect > body.modifiers.length) {
        throw new RequestValidateError("minSelect is more than the number of options")
    }
    const freeLimit = body.freeLimit ?? null
    if (freeLimit !== null && (!Number.isInteger(freeLimit) || freeLimit < 0 || freeLimit > maxSelect)) {
        throw new RequestValidateError("freeLimit must be between 0 and maxSelect")
    }
    const seen = new Set<string>()
    for (const m of body.modifiers) {
        const n = m.name?.trim()
        if (!n) throw new RequestValidateError("Every option needs a name")
        if (n.length > MAX_NAME) throw new RequestValidateError(`Option name is longer than ${MAX_NAME} characters`)
        const key = n.toLowerCase()
        if (seen.has(key)) throw new RequestValidateError(`Option "${n}" appears twice`)
        seen.add(key)
        const price = m.price ?? 0
        if (typeof price !== "number" || !isFinite(price) || price < 0 || price > MAX_PRICE) {
            throw new RequestValidateError(`Option "${n}" has an invalid price`)
        }
    }
    if (body.itemIds !== undefined && !Array.isArray(body.itemIds)) {
        throw new RequestValidateError("itemIds must be a list")
    }
    return { name, minSelect, maxSelect, freeLimit }
}

const optionData = (m: ModifierInput, index: number) => ({
    name: m.name.trim(),
    price: new Prisma.Decimal(m.price ?? 0),
    itemId: m.itemId ?? null,
    isAvailable: m.isAvailable ?? true,
    isDefault: m.isDefault ?? false,
    sequence: m.sequence ?? index,
})

const assertItemsExist = async (tx: Tx, itemIds: number[]) => {
    const ids = [...new Set(itemIds)]
    if (ids.length === 0) return
    const found = await tx.item.count({ where: { id: { in: ids }, deleted: false } })
    if (found !== ids.length) throw new RequestValidateError("One or more items no longer exist")
}

/** Reconciles a group's option list: update by id, create new, soft-delete the missing. */
const saveOptions = async (tx: Tx, groupId: number, inputs: ModifierInput[]) => {
    const existing = await tx.modifier.findMany({ where: { groupId, deleted: false }, select: { id: true } })
    const existingIds = new Set(existing.map((e) => e.id))
    const keptIds = new Set<number>()
    const stockIds = inputs.map((m) => m.itemId).filter((id): id is number => typeof id === "number")
    await assertItemsExist(tx, stockIds)

    for (const [i, m] of inputs.entries()) {
        if (m.id !== undefined && m.id !== null) {
            if (!existingIds.has(m.id)) throw new RequestValidateError(`Option ${m.id} is not in this group`)
            keptIds.add(m.id)
            await tx.modifier.update({
                where: { id: m.id },
                data: { ...optionData(m, i), version: { increment: 1 } },
            })
        } else {
            await tx.modifier.create({ data: { ...optionData(m, i), groupId } })
        }
    }
    const removed = [...existingIds].filter((id) => !keptIds.has(id))
    if (removed.length > 0) {
        await tx.modifier.updateMany({
            where: { id: { in: removed } },
            data: { deleted: true, deletedAt: new Date(), version: { increment: 1 } },
        })
    }
}

/** Makes `itemIds` exactly the set of items offering this group. */
const saveGroupItems = async (tx: Tx, groupId: number, itemIds: number[]) => {
    const ids = [...new Set(itemIds)]
    await assertItemsExist(tx, ids)
    await tx.itemModifierGroup.updateMany({
        where: { groupId, deleted: false, itemId: { notIn: ids } },
        data: { deleted: true },
    })
    for (const itemId of ids) {
        // A new link goes to the end of that item's picker.
        const last = await tx.itemModifierGroup.aggregate({
            where: { itemId, deleted: false },
            _max: { sequence: true },
        })
        await tx.itemModifierGroup.upsert({
            where: { itemId_groupId: { itemId, groupId } },
            update: { deleted: false },
            create: { itemId, groupId, sequence: (last._max.sequence ?? -1) + 1 },
        })
    }
}

const createGroup = async (databaseName: string, body: SaveModifierGroupRequest) => {
    const fields = validate(body)
    const prisma = getTenantPrisma(databaseName)
    const id = await prisma.$transaction(async (tx) => {
        const group = await tx.modifierGroup.create({
            data: { ...fields, sequence: body.sequence ?? 0 },
        })
        await saveOptions(tx, group.id, body.modifiers)
        if (body.itemIds) await saveGroupItems(tx, group.id, body.itemIds)
        return group.id
    })
    return getGroup(databaseName, id)
}

const updateGroup = async (databaseName: string, id: number, body: SaveModifierGroupRequest) => {
    const fields = validate(body)
    const prisma = getTenantPrisma(databaseName)
    await prisma.$transaction(async (tx) => {
        const group = await tx.modifierGroup.findFirst({ where: { id, deleted: false } })
        if (!group) throw new NotFoundError("Modifier group")
        await tx.modifierGroup.update({
            where: { id },
            data: { ...fields, sequence: body.sequence ?? group.sequence, version: { increment: 1 } },
        })
        await saveOptions(tx, id, body.modifiers)
        if (body.itemIds) await saveGroupItems(tx, id, body.itemIds)
    })
    return getGroup(databaseName, id)
}

/** Soft-deletes the group, its options and its item links. Past sales keep their snapshot. */
const removeGroup = async (databaseName: string, id: number) => {
    const prisma = getTenantPrisma(databaseName)
    await prisma.$transaction(async (tx) => {
        const group = await tx.modifierGroup.findFirst({ where: { id, deleted: false } })
        if (!group) throw new NotFoundError("Modifier group")
        const now = new Date()
        await tx.modifierGroup.update({
            where: { id },
            data: { deleted: true, deletedAt: now, version: { increment: 1 } },
        })
        await tx.modifier.updateMany({
            where: { groupId: id, deleted: false },
            data: { deleted: true, deletedAt: now, version: { increment: 1 } },
        })
        await tx.itemModifierGroup.updateMany({ where: { groupId: id, deleted: false }, data: { deleted: true } })
    })
}

const getGroup = async (databaseName: string, id: number) => {
    const prisma = getTenantPrisma(databaseName)
    const group = await prisma.modifierGroup.findFirst({
        where: { id, deleted: false },
        include: {
            modifiers: { where: { deleted: false }, orderBy: { sequence: "asc" } },
            itemModifierGroups: { where: { deleted: false }, select: { itemId: true } },
        },
    })
    if (!group) throw new NotFoundError("Modifier group")
    const { itemModifierGroups, ...rest } = group
    return {
        ...rest,
        modifiers: group.modifiers.map((m) => ({ ...m, price: Number(m.price) })),
        itemIds: itemModifierGroups.map((l) => l.itemId),
    }
}

/** Makes `groupIds` (in order) exactly the groups this item offers. */
const setItemGroups = async (databaseName: string, itemId: number, groupIds: number[]) => {
    if (!Array.isArray(groupIds) || groupIds.some((g) => !Number.isInteger(g))) {
        throw new RequestValidateError("groupIds must be a list of ids")
    }
    const ids = [...new Set(groupIds)]
    const prisma = getTenantPrisma(databaseName)
    await prisma.$transaction(async (tx) => {
        const item = await tx.item.findFirst({ where: { id: itemId, deleted: false }, select: { id: true } })
        if (!item) throw new NotFoundError("Item")
        if (ids.length > 0) {
            const found = await tx.modifierGroup.count({ where: { id: { in: ids }, deleted: false } })
            if (found !== ids.length) throw new RequestValidateError("One or more modifier groups no longer exist")
        }
        await tx.itemModifierGroup.updateMany({
            where: { itemId, deleted: false, groupId: { notIn: ids } },
            data: { deleted: true },
        })
        for (const [sequence, groupId] of ids.entries()) {
            await tx.itemModifierGroup.upsert({
                where: { itemId_groupId: { itemId, groupId } },
                update: { deleted: false, sequence },
                create: { itemId, groupId, sequence },
            })
        }
    })
    return { itemId, groupIds: ids }
}

/** "Habis" toggle on one option, e.g. the kitchen ran out of cheese. */
const setModifierAvailability = async (databaseName: string, id: number, isAvailable: boolean) => {
    const prisma = getTenantPrisma(databaseName)
    const found = await prisma.modifier.findFirst({ where: { id, deleted: false }, select: { id: true } })
    if (!found) throw new NotFoundError("Modifier")
    const m = await prisma.modifier.update({
        where: { id },
        data: { isAvailable, version: { increment: 1 } },
    })
    return { ...m, price: Number(m.price) }
}

export = {
    sync,
    getGroup,
    createGroup,
    updateGroup,
    removeGroup,
    setItemGroups,
    setModifierAvailability,
}
