import { Prisma, PrismaClient } from "../../prisma/client/generated/client"
import { Decimal } from "decimal.js"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { getTenantPrisma } from "../db"

// F&B recipes (docs/modules/FNB.md, D4).

export interface RecipeLineInput {
    ingredientItemId: number
    quantity: number
    batchYield?: number | null
}

const MAX_LINES = 40
const MAX_QTY = 999999

const sync = async (databaseName: string, lastSyncTimestamp?: string) => {
    const prisma: PrismaClient = getTenantPrisma(databaseName)
    const since = lastSyncTimestamp && lastSyncTimestamp !== "null" ? new Date(lastSyncTimestamp) : null
    if (since && isNaN(since.getTime())) throw new RequestValidateError("lastSyncTimestamp is not a valid date")
    const serverTimestamp = new Date().toISOString()
    const rows = await prisma.recipe.findMany({
        where: since ? { updatedAt: { gte: since } } : { deleted: false },
        orderBy: [{ sequence: "asc" }, { id: "asc" }],
    })
    return {
        recipes: rows.map((r) => ({ ...r, quantity: Number(r.quantity), batchYield: r.batchYield == null ? null : Number(r.batchYield) })),
        serverTimestamp,
    }
}

const validate = (lines: unknown): RecipeLineInput[] => {
    if (!Array.isArray(lines)) throw new RequestValidateError("lines must be a list")
    if (lines.length > MAX_LINES) throw new RequestValidateError(`A recipe has at most ${MAX_LINES} ingredients`)
    const seen = new Set<number>()
    return lines.map((l: any) => {
        const id = Number(l?.ingredientItemId)
        const qty = Number(l?.quantity)
        const yieldN = l?.batchYield == null || l?.batchYield === "" ? null : Number(l.batchYield)
        if (!Number.isInteger(id)) throw new RequestValidateError("Every line needs an ingredient")
        if (seen.has(id)) throw new RequestValidateError("An ingredient appears twice")
        seen.add(id)
        if (!isFinite(qty) || qty <= 0 || qty > MAX_QTY) throw new RequestValidateError("Ingredient quantity must be more than 0")
        if (yieldN !== null && (!isFinite(yieldN) || yieldN <= 0 || yieldN > MAX_QTY)) {
            throw new RequestValidateError("Batch yield must be more than 0")
        }
        return { ingredientItemId: id, quantity: qty, batchYield: yieldN }
    })
}

/** Makes [lines] exactly the recipe of a dish ({itemId}) or an option ({modifierId}). */
const setRecipe = async (databaseName: string, owner: { itemId?: number; modifierId?: number }, rawLines: unknown) => {
    const lines = validate(rawLines)
    const prisma = getTenantPrisma(databaseName)
    await prisma.$transaction(async (tx) => {
        if (owner.itemId != null) {
            const dish = await tx.item.findFirst({ where: { id: owner.itemId, deleted: false }, select: { id: true } })
            if (!dish) throw new NotFoundError("Item")
        } else {
            const option = await tx.modifier.findFirst({ where: { id: owner.modifierId, deleted: false }, select: { id: true } })
            if (!option) throw new NotFoundError("Modifier")
        }
        const ids = lines.map((l) => l.ingredientItemId)
        if (ids.length > 0) {
            // Ingredients are supplies: stock-tracked, never sold, allowed to go short
            // (a paid sale is never rejected over an ingredient).
            const found = await tx.item.findMany({ where: { id: { in: ids }, deleted: false, itemType: "supply" }, select: { id: true } })
            if (found.length !== ids.length) throw new RequestValidateError("Ingredients must be supply items")
            if (owner.itemId != null && ids.includes(owner.itemId)) throw new RequestValidateError("A dish can't be its own ingredient")
        }
        const where = owner.itemId != null ? { itemId: owner.itemId, modifierId: null } : { modifierId: owner.modifierId }
        await tx.recipe.updateMany({
            where: { ...where, deleted: false },
            data: { deleted: true, deletedAt: new Date(), version: { increment: 1 } },
        })
        if (lines.length > 0) {
            await tx.recipe.createMany({
                data: lines.map((l, i) => ({
                    itemId: owner.itemId ?? null,
                    modifierId: owner.modifierId ?? null,
                    ingredientItemId: l.ingredientItemId,
                    quantity: new Prisma.Decimal(l.quantity),
                    batchYield: l.batchYield == null ? null : new Prisma.Decimal(l.batchYield),
                    sequence: i,
                })),
            })
        }
    })
    return { ...owner, lines }
}

export interface ExpandableLine {
    itemId: number
    quantity: unknown
    modifiers?: { modifierId?: number | null; quantity?: number }[]
}

/**
 * The stock-consumption lines a sale's recipes add (D4): per sold unit,
 * Σ quantity / batchYield of the dish's recipe, plus each picked option's recipe
 * × its picks. Returned in the laundry supply-line shape (price 0, quantity =
 * units sold, stockConsumptionQty = per unit) and merged per ingredient per
 * source line. Pure — the caller loads [recipes]. Exported for tests.
 */
export const expandRecipeLines = (
    lines: ExpandableLine[],
    recipes: { itemId: number | null; modifierId: number | null; ingredientItemId: number; quantity: Decimal.Value; batchYield: Decimal.Value | null }[],
): { sourceIndex: number; ingredientItemId: number; quantity: number; stockConsumptionQty: Decimal }[] => {
    const byItem = new Map<number, typeof recipes>()
    const byModifier = new Map<number, typeof recipes>()
    for (const r of recipes) {
        if (r.modifierId != null) byModifier.set(r.modifierId, [...(byModifier.get(r.modifierId) ?? []), r])
        else if (r.itemId != null) byItem.set(r.itemId, [...(byItem.get(r.itemId) ?? []), r])
    }
    const perUnit = (r: (typeof recipes)[number]) =>
        new Decimal(r.quantity).div(r.batchYield == null || new Decimal(r.batchYield).lte(0) ? 1 : new Decimal(r.batchYield))
    const out: { sourceIndex: number; ingredientItemId: number; quantity: number; stockConsumptionQty: Decimal }[] = []
    lines.forEach((line, sourceIndex) => {
        const units = Number(line.quantity ?? 0)
        if (!(units > 0)) return
        const need = new Map<number, Decimal>()
        for (const r of byItem.get(line.itemId) ?? []) {
            need.set(r.ingredientItemId, (need.get(r.ingredientItemId) ?? new Decimal(0)).plus(perUnit(r)))
        }
        for (const m of line.modifiers ?? []) {
            if (m.modifierId == null) continue
            const picks = Number.isInteger(m.quantity) && (m.quantity as number) > 0 ? (m.quantity as number) : 1
            for (const r of byModifier.get(m.modifierId) ?? []) {
                need.set(r.ingredientItemId, (need.get(r.ingredientItemId) ?? new Decimal(0)).plus(perUnit(r).times(picks)))
            }
        }
        for (const [ingredientItemId, qty] of need) {
            if (qty.gt(0)) out.push({ sourceIndex, ingredientItemId, quantity: units, stockConsumptionQty: qty })
        }
    })
    return out
}

/** Loads the recipes a sale's lines need. Empty when no line has one. */
export const loadRecipesFor = async (tx: Prisma.TransactionClient, lines: ExpandableLine[]) => {
    const itemIds = [...new Set(lines.map((l) => l.itemId).filter((id) => Number.isInteger(id)))]
    const modifierIds = [...new Set(lines.flatMap((l) => (l.modifiers ?? []).map((m) => m.modifierId)).filter((id): id is number => Number.isInteger(id)))]
    if (itemIds.length === 0 && modifierIds.length === 0) return []
    return tx.recipe.findMany({
        where: {
            deleted: false,
            OR: [
                ...(itemIds.length ? [{ itemId: { in: itemIds }, modifierId: null }] : []),
                ...(modifierIds.length ? [{ modifierId: { in: modifierIds } }] : []),
            ],
            ingredient: { deleted: false, itemType: "supply" },
        },
        select: { itemId: true, modifierId: true, ingredientItemId: true, quantity: true, batchYield: true, ingredient: { select: { itemName: true, itemCode: true, unitOfMeasure: true } } },
    })
}

export default { sync, setRecipe }
