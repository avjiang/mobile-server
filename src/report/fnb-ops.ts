import { Prisma, PrismaClient } from "../../prisma/client/generated/client"

/**
 * F&B report block (docs/modules/FNB.md): completed sales split by order type
 * (Makan di sini / Bawa pulang / Antar) and the most-chosen modifiers. Null for
 * retail and laundry accounts, like `laundryOps`.
 */
export interface FnbOps {
    byOrderType: { salesType: string; orders: number; revenue: number }[]
    topModifiers: { groupName: string; modifierName: string; count: number; revenue: number }[]
}

const TOP_MODIFIERS = 10

export const loadFnbOps = async (
    prisma: PrismaClient,
    // Which sales count (outlet + date range, or a session); status/deleted are added here.
    salesWhere: Prisma.SalesWhereInput,
): Promise<FnbOps> => {
    const completed: Prisma.SalesWhereInput = { ...salesWhere, status: "Completed", deleted: false }
    const [types, picks] = await Promise.all([
        prisma.sales.groupBy({
            by: ["salesType"],
            where: completed,
            _count: { id: true },
            _sum: { totalAmount: true },
        }),
        prisma.salesItemModifier.findMany({
            where: { deleted: false, salesItem: { deleted: false, sales: completed } },
            select: { groupName: true, modifierName: true, price: true, quantity: true, salesItem: { select: { quantity: true } } },
        }),
    ])

    const byOrderType = types
        .map((t) => ({ salesType: t.salesType, orders: t._count.id, revenue: Number(t._sum.totalAmount ?? 0) }))
        .sort((a, b) => b.orders - a.orders)

    // A pick counts once per unit sold: "2× Nasi goreng + extra telur" is 2 eggs.
    const tally = new Map<string, { groupName: string; modifierName: string; count: number; revenue: number }>()
    for (const p of picks) {
        const units = p.quantity * Number(p.salesItem.quantity)
        const key = `${p.groupName}\u0000${p.modifierName}`
        const row = tally.get(key) ?? { groupName: p.groupName, modifierName: p.modifierName, count: 0, revenue: 0 }
        row.count += units
        row.revenue += units * Number(p.price)
        tally.set(key, row)
    }
    const topModifiers = [...tally.values()].sort((a, b) => b.count - a.count).slice(0, TOP_MODIFIERS)

    return { byOrderType, topModifiers }
}
