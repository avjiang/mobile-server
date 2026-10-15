import { Prisma, PrismaClient } from "../../prisma/client/generated/client"

/**
 * F&B report block (docs/modules/FNB.md): completed sales split by order type
 * (Makan di sini / Bawa pulang / Antar) and the most-chosen modifiers. Null for
 * retail and laundry accounts, like `laundryOps`.
 */
export interface FnbOps {
    byOrderType: { salesType: string; orders: number; revenue: number }[]
    topModifiers: { groupName: string; modifierName: string; count: number; revenue: number }[]
    // Food cost (P3 recipes): the FIFO cost of the ingredient lines recipes added,
    // against the revenue of the dishes they were cooked for. Zero / empty when
    // no dish has a recipe.
    foodCost: number
    recipeRevenue: number
    foodCostPercent: number
    menuMargins: { itemId: number; itemName: string; quantity: number; revenue: number; foodCost: number; marginPercent: number }[]
}

const TOP_MODIFIERS = 10

export const loadFnbOps = async (
    prisma: PrismaClient,
    // Which sales count (outlet + date range, or a session); status/deleted are added here.
    salesWhere: Prisma.SalesWhereInput,
): Promise<FnbOps> => {
    const completed: Prisma.SalesWhereInput = { ...salesWhere, status: "Completed", deleted: false }
    const [types, picks, ingredientLines] = await Promise.all([
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
        prisma.salesItem.groupBy({
            by: ["recipeOfItemId"],
            where: { deleted: false, recipeOfItemId: { not: null }, sales: completed },
            _sum: { cost: true },
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

    // Revenue + units of the dishes that have recipe cost.
    const dishIds = ingredientLines.map((g) => g.recipeOfItemId!).filter((id) => id != null)
    const dishes = dishIds.length === 0 ? [] : await prisma.salesItem.groupBy({
        by: ["itemId", "itemName"],
        where: { deleted: false, itemId: { in: dishIds }, recipeOfItemId: null, sales: completed },
        _sum: { subtotalAmount: true, quantity: true },
    })
    const costOf = new Map(ingredientLines.map((g) => [g.recipeOfItemId!, Number(g._sum.cost ?? 0)]))
    const byDish = new Map<number, { itemId: number; itemName: string; quantity: number; revenue: number; foodCost: number; marginPercent: number }>()
    for (const d of dishes) {
        const row = byDish.get(d.itemId) ?? { itemId: d.itemId, itemName: d.itemName, quantity: 0, revenue: 0, foodCost: costOf.get(d.itemId) ?? 0, marginPercent: 0 }
        row.quantity += Number(d._sum.quantity ?? 0)
        row.revenue += Number(d._sum.subtotalAmount ?? 0)
        byDish.set(d.itemId, row)
    }
    for (const row of byDish.values()) row.marginPercent = row.revenue > 0 ? ((row.revenue - row.foodCost) / row.revenue) * 100 : 0
    const menuMargins = [...byDish.values()].sort((a, b) => b.revenue - a.revenue).slice(0, TOP_MODIFIERS)
    const foodCost = [...costOf.values()].reduce((a, b) => a + b, 0)
    const recipeRevenue = [...byDish.values()].reduce((a, r) => a + r.revenue, 0)
    const foodCostPercent = recipeRevenue > 0 ? (foodCost / recipeRevenue) * 100 : 0

    return { byOrderType, topModifiers, foodCost, recipeRevenue, foodCostPercent, menuMargins }
}
