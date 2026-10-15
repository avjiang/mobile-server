import { Prisma } from "../../prisma/client/generated/client"

/**
 * F&B kitchen tickets (docs/modules/FNB.md, D5): when a counter sale completes,
 * its lines are grouped by kitchen station (Item.stationId ?? Category.stationId
 * ?? none) and each group is stored as a KitchenTicket snapshot — what the
 * printer prints and the KDS (P5) shows. Never fails the sale it rides on.
 */

export interface TicketLineInput {
    itemId: number
    itemName?: string
    variantName?: string | null
    quantity?: unknown
    specialInstructions?: string
    isLaundryComponent?: boolean
    modifiers?: { groupName?: string; modifierName?: string; quantity?: number }[]
}

export interface TicketLine {
    itemId: number
    name: string
    variantName?: string
    quantity: number
    modifiers: { groupName: string; modifierName: string; quantity: number }[]
    note?: string
}

/** Groups lines by station id (null = unrouted), keeping the cart order. Exported for tests. */
export const groupByStation = (
    lines: TicketLineInput[],
    stationOf: (itemId: number) => number | null,
): Map<number | null, TicketLine[]> => {
    const groups = new Map<number | null, TicketLine[]>()
    for (const l of lines) {
        // Laundry supplies and F&B recipe ingredients are stock, not kitchen work.
        if (l.isLaundryComponent || (l as any).__recipe) continue
        const station = stationOf(l.itemId)
        const list = groups.get(station) ?? []
        list.push({
            itemId: l.itemId,
            name: (l.itemName ?? "").trim(),
            ...(l.variantName ? { variantName: l.variantName } : {}),
            quantity: Number(l.quantity ?? 1) || 1,
            modifiers: (l.modifiers ?? [])
                .filter((m) => (m.modifierName ?? "").trim() !== "")
                .map((m) => ({
                    groupName: (m.groupName ?? "").trim(),
                    modifierName: (m.modifierName ?? "").trim(),
                    quantity: Number.isInteger(m.quantity) && (m.quantity as number) > 0 ? (m.quantity as number) : 1,
                })),
            ...(l.specialInstructions?.trim() ? { note: l.specialInstructions.trim() } : {}),
        })
        groups.set(station, list)
    }
    return groups
}

export interface TicketSource {
    outletId: number
    source?: "sale" | "order"
    salesId?: number | null
    orderRef?: string | null
    round?: number
    queueNo?: string | null
    label?: string | null
    salesType?: string | null
    siteId?: number | null
}

/** One KitchenTicket per station for [lines]; never throws (returns 0 on failure). */
export const writeKitchenTickets = async (
    tx: Prisma.TransactionClient,
    src: TicketSource,
    lines: TicketLineInput[],
): Promise<number> => {
    try {
        const ids = [...new Set(lines.map((l) => l.itemId).filter((id) => Number.isInteger(id)))]
        if (ids.length === 0) return 0
        const items = await tx.item.findMany({
            where: { id: { in: ids } },
            select: { id: true, stationId: true, category: { select: { stationId: true } } },
        })
        const route = new Map(items.map((i) => [i.id, i.stationId ?? i.category?.stationId ?? null]))
        // A station deleted (or of another outlet) since routing was set → unrouted.
        const stationIds = [...new Set([...route.values()].filter((s): s is number => s !== null))]
        const live = stationIds.length === 0 ? new Set<number>() : new Set(
            (await tx.station.findMany({ where: { id: { in: stationIds }, outletId: src.outletId, deleted: false }, select: { id: true } }))
                .map((s) => s.id),
        )
        const groups = groupByStation(lines, (itemId) => {
            const s = route.get(itemId) ?? null
            return s !== null && live.has(s) ? s : null
        })
        const data: Prisma.KitchenTicketCreateManyInput[] = [...groups.entries()].map(([stationId, ticketLines]) => ({
            outletId: src.outletId,
            stationId,
            source: src.source ?? "sale",
            salesId: src.salesId ?? null,
            orderRef: src.orderRef ?? null,
            round: src.round ?? 1,
            queueNo: src.queueNo ?? null,
            label: src.label ?? null,
            salesType: src.salesType ?? null,
            lines: ticketLines as unknown as Prisma.InputJsonValue,
            siteId: src.siteId ?? null,
        }))
        if (data.length > 0) await tx.kitchenTicket.createMany({ data })
        return data.length
    } catch (e) {
        console.error("writeKitchenTickets failed (kept going):", e)
        return 0
    }
}

export const writeSaleKitchenTickets = (
    tx: Prisma.TransactionClient,
    sale: { id: number; outletId: number; queueNo?: string | null; customerLabel?: string | null; salesType?: string | null; siteId?: number | null },
    lines: TicketLineInput[],
): Promise<number> => writeKitchenTickets(tx, {
    outletId: sale.outletId,
    source: "sale",
    salesId: sale.id,
    queueNo: sale.queueNo,
    label: sale.customerLabel,
    salesType: sale.salesType,
    siteId: sale.siteId,
}, lines)
