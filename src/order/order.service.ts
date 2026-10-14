import { Prisma } from "../../prisma/client/generated/client"
import { BusinessLogicError, NotFoundError, RequestValidateError } from "../api-helpers/error"
import { getTenantPrisma } from "../db"
import { writeKitchenTickets } from "../kitchen/kitchen-tickets"

// F&B open bills (docs/modules/FNB.md, D3/P4). The device mints `orderRef` and
// every line's `lineRef`, so a queued (offline) open / round replays without
// duplicating anything.

export interface OrderLineInput {
    lineRef: string
    itemId: number
    itemVariantId?: number | null
    itemName: string
    variantName?: string | null
    quantity: number
    unitPrice: number
    basePrice?: number | null
    hasTax?: boolean
    modifiers?: { modifierId?: number | null; groupName?: string; modifierName?: string; price?: number; quantity?: number }[]
    note?: string | null
}

export interface Performer { username?: string; siteId?: number | null }

const LIVE = ["OPEN", "SETTLING"]
const withLines = { lines: { orderBy: [{ round: "asc" as const }, { id: "asc" as const }] } }

const serialize = (o: any) => o && ({
    ...o,
    lines: (o.lines ?? []).map((l: any) => ({
        ...l,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        basePrice: l.basePrice == null ? null : Number(l.basePrice),
    })),
})

const sync = async (databaseName: string, outletId: number, lastSyncTimestamp?: string) => {
    const prisma = getTenantPrisma(databaseName)
    const since = lastSyncTimestamp && lastSyncTimestamp !== "null" ? new Date(lastSyncTimestamp) : null
    if (since && isNaN(since.getTime())) throw new RequestValidateError("lastSyncTimestamp is not a valid date")
    const serverTimestamp = new Date().toISOString()
    // Live bills always; closed ones only as a delta (so devices drop them).
    const orders = await prisma.order.findMany({
        where: { outletId, OR: [{ status: { in: LIVE } }, ...(since ? [{ updatedAt: { gte: since } }] : [])] },
        include: withLines,
        orderBy: { openedAt: "asc" },
    })
    return { orders: orders.map(serialize), serverTimestamp }
}

const validateLines = (raw: unknown): OrderLineInput[] => {
    if (!Array.isArray(raw)) throw new RequestValidateError("lines must be a list")
    if (raw.length > 200) throw new RequestValidateError("At most 200 lines per round")
    return raw.map((l: any) => {
        const lineRef = String(l?.lineRef ?? "").trim()
        if (!lineRef || lineRef.length > 64) throw new RequestValidateError("Every line needs a lineRef")
        const qty = Number(l?.quantity)
        const price = Number(l?.unitPrice)
        if (!Number.isInteger(Number(l?.itemId))) throw new RequestValidateError("Every line needs an item")
        if (!(qty > 0) || qty > 999999) throw new RequestValidateError("Line quantity must be more than 0")
        if (!(price >= 0) || price > 999999999) throw new RequestValidateError("Line price is invalid")
        return {
            lineRef,
            itemId: Number(l.itemId),
            itemVariantId: l.itemVariantId ?? null,
            itemName: String(l.itemName ?? "").slice(0, 191),
            variantName: l.variantName ?? null,
            quantity: qty,
            unitPrice: price,
            basePrice: l.basePrice == null ? null : Number(l.basePrice),
            hasTax: l.hasTax === true,
            modifiers: Array.isArray(l.modifiers) ? l.modifiers : [],
            note: l.note ? String(l.note).slice(0, 200) : null,
        }
    })
}

const tableName = async (tx: Prisma.TransactionClient, tableId: number | null) =>
    tableId == null ? null : (await tx.table.findUnique({ where: { id: tableId }, select: { tableNumber: true } }))?.tableNumber ?? null

/** Appends a round inside [tx]; lines already stored (by lineRef) are skipped. */
const appendRound = async (tx: Prisma.TransactionClient, order: { id: number; outletId: number; orderRef: string; rounds: number; tableId: number | null; label: string | null; queueNo: string | null; salesType: string; siteId: number | null }, lines: OrderLineInput[], performer: Performer) => {
    if (lines.length === 0) return 0
    const existing = new Set((await tx.orderLine.findMany({ where: { lineRef: { in: lines.map((l) => l.lineRef) } }, select: { lineRef: true } })).map((l) => l.lineRef))
    const fresh = lines.filter((l) => !existing.has(l.lineRef))
    if (fresh.length === 0) return order.rounds
    const round = order.rounds + 1
    await tx.orderLine.createMany({
        data: fresh.map((l) => ({
            orderId: order.id,
            lineRef: l.lineRef,
            round,
            itemId: l.itemId,
            itemVariantId: l.itemVariantId ?? null,
            itemName: l.itemName,
            variantName: l.variantName ?? null,
            quantity: new Prisma.Decimal(l.quantity),
            unitPrice: new Prisma.Decimal(l.unitPrice),
            basePrice: l.basePrice == null ? null : new Prisma.Decimal(l.basePrice),
            hasTax: l.hasTax ?? false,
            modifiers: (l.modifiers ?? []) as Prisma.InputJsonValue,
            note: l.note ?? null,
            createdBy: performer.username ?? null,
        })),
    })
    await tx.order.update({ where: { id: order.id }, data: { rounds: round, version: { increment: 1 } } })
    const table = await tableName(tx, order.tableId)
    await writeKitchenTickets(tx, {
        outletId: order.outletId,
        source: "order",
        orderRef: order.orderRef,
        round,
        queueNo: order.queueNo,
        label: [table ? `Meja ${table}` : null, order.label].filter(Boolean).join(" · ") || null,
        salesType: order.salesType,
        siteId: performer.siteId ?? order.siteId,
    }, fresh.map((l) => ({
        itemId: l.itemId,
        itemName: l.itemName,
        variantName: l.variantName,
        quantity: l.quantity,
        specialInstructions: l.note ?? undefined,
        modifiers: (l.modifiers ?? []).map((m) => ({ groupName: m.groupName, modifierName: m.modifierName, quantity: m.quantity })),
    })))
    return round
}

const assertTableFree = async (tx: Prisma.TransactionClient, outletId: number, tableId: number, exceptOrderId?: number) => {
    const table = await tx.table.findFirst({ where: { id: tableId, outletId, deleted: false } })
    if (!table) throw new RequestValidateError("Table not found")
    const busy = await tx.order.findFirst({ where: { tableId, status: { in: LIVE }, ...(exceptOrderId ? { id: { not: exceptOrderId } } : {}) } })
    if (busy) throw new BusinessLogicError(`Table ${table.tableNumber} already has an open bill`)
}

const open = async (databaseName: string, outletId: number, body: any, performer: Performer) => {
    const orderRef = String(body?.orderRef ?? "").trim()
    if (!orderRef || orderRef.length > 64) throw new RequestValidateError("orderRef is required")
    const lines = body?.lines === undefined ? [] : validateLines(body.lines)
    const prisma = getTenantPrisma(databaseName)
    const id = await prisma.$transaction(async (tx) => {
        const found = await tx.order.findUnique({ where: { orderRef } })
        if (found) return found.id // replay
        const tableId = body?.tableId == null ? null : Number(body.tableId)
        if (tableId != null) await assertTableFree(tx, outletId, tableId)
        const order = await tx.order.create({
            data: {
                outletId,
                orderRef,
                tableId,
                salesType: String(body?.salesType ?? "Dine-In").slice(0, 32),
                label: body?.label ? String(body.label).trim().slice(0, 100) || null : null,
                queueNo: body?.queueNo ? String(body.queueNo).slice(0, 16) : null,
                guestCount: Number.isInteger(body?.guestCount) ? body.guestCount : null,
                openedBy: performer.username ?? null,
                siteId: performer.siteId ?? null,
            },
        })
        await appendRound(tx, order, lines, performer)
        return order.id
    })
    return serialize(await prisma.order.findUnique({ where: { id }, include: withLines }))
}

const liveOrder = async (tx: Prisma.TransactionClient, outletId: number, orderRef: string) => {
    const order = await tx.order.findFirst({ where: { orderRef, outletId } })
    if (!order) throw new NotFoundError("Order")
    if (order.status !== "OPEN") throw new BusinessLogicError(`This bill is ${order.status.toLowerCase()}`)
    return order
}

const round = async (databaseName: string, outletId: number, orderRef: string, rawLines: unknown, performer: Performer) => {
    const lines = validateLines(rawLines)
    const prisma = getTenantPrisma(databaseName)
    await prisma.$transaction(async (tx) => appendRound(tx, await liveOrder(tx, outletId, orderRef), lines, performer))
    return serialize(await prisma.order.findUnique({ where: { orderRef }, include: withLines }))
}

const voidLine = async (databaseName: string, outletId: number, orderRef: string, lineRef: string, reason: string) => {
    const prisma = getTenantPrisma(databaseName)
    await prisma.$transaction(async (tx) => {
        const order = await liveOrder(tx, outletId, orderRef)
        const line = await tx.orderLine.findFirst({ where: { orderId: order.id, lineRef } })
        if (!line) throw new NotFoundError("Order line")
        if (!line.voided) {
            await tx.orderLine.update({ where: { id: line.id }, data: { voided: true, voidReason: reason.trim().slice(0, 200) || null } })
            await tx.order.update({ where: { id: order.id }, data: { version: { increment: 1 } } })
        }
    })
    return serialize(await prisma.order.findUnique({ where: { orderRef }, include: withLines }))
}

const move = async (databaseName: string, outletId: number, orderRef: string, tableId: number | null) => {
    const prisma = getTenantPrisma(databaseName)
    await prisma.$transaction(async (tx) => {
        const order = await liveOrder(tx, outletId, orderRef)
        if (tableId != null) await assertTableFree(tx, outletId, tableId, order.id)
        await tx.order.update({ where: { id: order.id }, data: { tableId, version: { increment: 1 } } })
    })
    return serialize(await prisma.order.findUnique({ where: { orderRef }, include: withLines }))
}

/** Cancels a bill with nothing left on it (every line voided, or none). */
const cancel = async (databaseName: string, outletId: number, orderRef: string) => {
    const prisma = getTenantPrisma(databaseName)
    await prisma.$transaction(async (tx) => {
        const order = await liveOrder(tx, outletId, orderRef)
        const live = await tx.orderLine.count({ where: { orderId: order.id, voided: false } })
        if (live > 0) throw new BusinessLogicError("Void the bill's items first")
        await tx.order.update({ where: { id: order.id }, data: { status: "VOID", closedAt: new Date(), version: { increment: 1 } } })
    })
    return serialize(await prisma.order.findUnique({ where: { orderRef }, include: withLines }))
}

/**
 * Claims the bill (OPEN → SETTLING, one device wins), runs [completeSale], then
 * closes it (SETTLED + the sale id) — or releases it back to OPEN if the sale
 * failed. A replay of a settled bill returns its sale id.
 */
const settle = async (
    databaseName: string,
    outletId: number,
    orderRef: string,
    completeSale: (tableId: number | null) => Promise<{ id: number }>,
): Promise<{ salesId: number; alreadySettled?: boolean }> => {
    const prisma = getTenantPrisma(databaseName)
    const claimed = await prisma.order.updateMany({ where: { orderRef, outletId, status: "OPEN" }, data: { status: "SETTLING" } })
    const order = await prisma.order.findFirst({ where: { orderRef, outletId } })
    if (!order) throw new NotFoundError("Order")
    if (claimed.count === 0) {
        if (order.status === "SETTLED" && order.settledSalesId) return { salesId: order.settledSalesId, alreadySettled: true }
        throw new BusinessLogicError(order.status === "SETTLING" ? "This bill is being paid on another device" : `This bill is ${order.status.toLowerCase()}`)
    }
    try {
        const sale = await completeSale(order.tableId)
        await prisma.order.update({
            where: { id: order.id },
            data: { status: "SETTLED", settledSalesId: sale.id, closedAt: new Date(), version: { increment: 1 } },
        })
        return { salesId: sale.id }
    } catch (e) {
        await prisma.order.update({ where: { id: order.id }, data: { status: "OPEN" } })
        throw e
    }
}

export default { sync, open, round, voidLine, move, cancel, settle }
