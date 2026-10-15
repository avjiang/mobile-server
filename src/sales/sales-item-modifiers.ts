import { Prisma } from "../../prisma/client/generated/client"
import { CreateSalesItemModifierRequest } from "./sales.request"

/**
 * F&B: persist the modifiers chosen on each sale line (docs/modules/FNB.md).
 *
 * The line price the terminal sends already includes its modifiers, so nothing
 * here touches money. These rows are the snapshot that the receipt, kitchen
 * ticket and "top modifiers" report read. A paid sale is never rejected over a
 * modifier: a deleted option keeps the names the terminal sent (modifierId is
 * dropped if the row no longer exists), and a missing name is filled from the
 * library.
 */

type Line = { modifiers?: CreateSalesItemModifierRequest[] }
type Row = { __order: number }

const MAX_NAME = 100

/**
 * For each request-line index, the positions of its persisted rows. A stocked line
 * that FIFO-splits across receipts becomes several rows; each row carries the
 * line's modifiers, so a row reads whole and "picks × row quantity" sums right.
 * Exported for tests.
 */
export const rowIndexesByLine = (rows: Row[]): Map<number, number[]> => {
    const byLine = new Map<number, number[]>()
    rows.forEach((r, i) => {
        const list = byLine.get(r.__order) ?? []
        list.push(i)
        byLine.set(r.__order, list)
    })
    return byLine
}

const clip = (s: string | undefined | null) => (s ?? "").trim().slice(0, MAX_NAME)

export const attachSalesItemModifiers = async (
    tx: Prisma.TransactionClient,
    salesId: number,
    lines: Line[],
    // The rows just passed to salesItem.createMany, in insertion order.
    rows: Row[],
): Promise<void> => {
    const wanted = lines.some((l) => Array.isArray(l.modifiers) && l.modifiers.length > 0)
    if (!wanted) return

    // createMany returns no ids; one multi-row INSERT gets ascending ids in row order.
    const persisted = await tx.salesItem.findMany({
        where: { salesId },
        orderBy: { id: "asc" },
        select: { id: true },
    })
    if (persisted.length !== rows.length) return // never fail a paid sale over a snapshot

    const ids = new Set<number>()
    lines.forEach((l) => l.modifiers?.forEach((m) => {
        if (typeof m.modifierId === "number") ids.add(m.modifierId)
    }))
    const library = ids.size === 0 ? [] : await tx.modifier.findMany({
        where: { id: { in: [...ids] } },
        select: { id: true, name: true, price: true, group: { select: { name: true } } },
    })
    const byId = new Map(library.map((m) => [m.id, m]))

    const rowsOfLine = rowIndexesByLine(rows)
    const data: Prisma.SalesItemModifierCreateManyInput[] = []
    lines.forEach((line, lineIndex) => {
        const rowIndexes = rowsOfLine.get(lineIndex)
        if (!rowIndexes || !line.modifiers?.length) return
        for (const rowIndex of rowIndexes) for (const m of line.modifiers) {
            const known = typeof m.modifierId === "number" ? byId.get(m.modifierId) : undefined
            const modifierName = clip(m.modifierName) || clip(known?.name)
            if (!modifierName) continue
            const price = typeof m.price === "number" && isFinite(m.price) && m.price >= 0
                ? m.price
                : Number(known?.price ?? 0)
            const quantity = Number.isInteger(m.quantity) && (m.quantity as number) > 0 ? (m.quantity as number) : 1
            data.push({
                salesItemId: persisted[rowIndex].id,
                modifierId: known ? known.id : null,
                groupName: clip(m.groupName) || clip(known?.group.name),
                modifierName,
                price: new Prisma.Decimal(price),
                quantity,
            })
        }
    })
    if (data.length > 0) await tx.salesItemModifier.createMany({ data })
}
