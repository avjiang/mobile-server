import { RequestValidateError } from "../api-helpers/error"
import { getTenantPrisma } from "../db"

// F&B floor map (docs/modules/FNB.md, P4): areas and where each table stands.
// Logical canvas 1000 × 700 per area.

export const CANVAS = { width: 1000, height: 700 }
// Tables are square / round / rect; "marker" (Kasir, Pintu masuk) and "wall"
// are drawn on the map but never hold a bill.
const SHAPES = ["square", "round", "rect", "marker", "wall"]
export const NON_SEATING = ["marker", "wall"]
const ROTATIONS = [0, 45, 90]

export interface AreaInput { id?: number; key?: string; name: string; sequence?: number }
export interface TableInput {
    id?: number
    // The area: an existing id, or the `key` of an area created in the same save.
    areaId?: number | null
    areaKey?: string
    name: string
    seats?: number
    x?: number; y?: number; width?: number; height?: number
    shape?: string
    rotation?: number
}

const sync = async (databaseName: string, outletId: number, lastSyncTimestamp?: string) => {
    const prisma = getTenantPrisma(databaseName)
    const since = lastSyncTimestamp && lastSyncTimestamp !== "null" ? new Date(lastSyncTimestamp) : null
    if (since && isNaN(since.getTime())) throw new RequestValidateError("lastSyncTimestamp is not a valid date")
    const serverTimestamp = new Date().toISOString()
    const changed = since ? { updatedAt: { gte: since } } : { deleted: false }
    const [areas, tables] = await Promise.all([
        prisma.floorArea.findMany({ where: { outletId, ...changed }, orderBy: [{ sequence: "asc" }, { id: "asc" }] }),
        prisma.table.findMany({ where: { outletId, ...changed }, orderBy: [{ sequence: "asc" }, { id: "asc" }] }),
    ])
    return { areas, tables, serverTimestamp }
}

const clamp = (v: unknown, lo: number, hi: number, dflt: number) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt
}

/**
 * Saves the outlet's whole floor plan in one transaction: the areas and tables
 * sent are the plan — any other live area/table of the outlet is removed (a
 * table with an open order is refused, it must be moved first).
 */
const save = async (databaseName: string, outletId: number, body: { areas?: AreaInput[]; tables?: TableInput[] }) => {
    const areas = Array.isArray(body.areas) ? body.areas : []
    const tables = Array.isArray(body.tables) ? body.tables : []
    if (areas.length > 30) throw new RequestValidateError("At most 30 areas")
    if (tables.length > 300) throw new RequestValidateError("At most 300 tables")
    const prisma = getTenantPrisma(databaseName)
    return prisma.$transaction(async (tx) => {
        const keyToId = new Map<string, number>()
        const keepAreas: number[] = []
        for (const [i, a] of areas.entries()) {
            const name = String(a.name ?? "").trim().slice(0, 50)
            if (!name) throw new RequestValidateError("Every area needs a name")
            if (a.id) {
                const found = await tx.floorArea.findFirst({ where: { id: a.id, outletId, deleted: false } })
                if (!found) throw new RequestValidateError(`Area ${a.id} not found`)
                await tx.floorArea.update({ where: { id: a.id }, data: { name, sequence: a.sequence ?? i, version: { increment: 1 } } })
                keepAreas.push(a.id)
                if (a.key) keyToId.set(a.key, a.id)
            } else {
                const created = await tx.floorArea.create({ data: { outletId, name, sequence: a.sequence ?? i } })
                keepAreas.push(created.id)
                if (a.key) keyToId.set(a.key, created.id)
            }
        }
        const keepTables: number[] = []
        const seen = new Set<string>()
        for (const [i, t] of tables.entries()) {
            const name = String(t.name ?? "").trim().slice(0, 20)
            if (!name) throw new RequestValidateError("Every table needs a name")
            const unique = name.toLowerCase()
            if (seen.has(unique)) throw new RequestValidateError(`Table "${name}" appears twice`)
            seen.add(unique)
            const areaId = t.areaKey ? keyToId.get(t.areaKey) ?? null : (t.areaId ?? null)
            if (areaId !== null && !keepAreas.includes(areaId)) throw new RequestValidateError(`Table "${name}" is in an unknown area`)
            const data = {
                tableNumber: name,
                capacity: Math.round(clamp(t.seats, 1, 50, 4)),
                areaId,
                width: clamp(t.width, 20, 600, 110), // 20 = a wall's thickness
                height: clamp(t.height, 20, 600, 110),
                x: 0, y: 0,
                shape: SHAPES.includes(String(t.shape)) ? String(t.shape) : "square",
                rotation: ROTATIONS.includes(Number(t.rotation)) ? Number(t.rotation) : 0,
                sequence: i,
            }
            data.x = clamp(t.x, 0, CANVAS.width - data.width, 0)
            data.y = clamp(t.y, 0, CANVAS.height - data.height, 0)
            if (t.id) {
                const found = await tx.table.findFirst({ where: { id: t.id, outletId, deleted: false } })
                if (!found) throw new RequestValidateError(`Table ${t.id} not found`)
                await tx.table.update({ where: { id: t.id }, data: { ...data, version: { increment: 1 } } })
                keepTables.push(t.id)
            } else {
                const created = await tx.table.create({ data: { ...data, outletId } })
                keepTables.push(created.id)
            }
        }
        const removing = await tx.table.findMany({ where: { outletId, deleted: false, id: { notIn: keepTables } }, select: { id: true, tableNumber: true } })
        if (removing.length > 0) {
            const busy = await tx.order.findFirst({
                where: { tableId: { in: removing.map((r) => r.id) }, status: { in: ["OPEN", "SETTLING"] } },
                select: { table: { select: { tableNumber: true } } },
            })
            if (busy) throw new RequestValidateError(`Table "${busy.table?.tableNumber}" has an open bill — move it first`)
            await tx.table.updateMany({ where: { id: { in: removing.map((r) => r.id) } }, data: { deleted: true, deletedAt: new Date() } })
        }
        await tx.floorArea.updateMany({ where: { outletId, deleted: false, id: { notIn: keepAreas } }, data: { deleted: true, deletedAt: new Date() } })
        const [savedAreas, savedTables] = await Promise.all([
            tx.floorArea.findMany({ where: { outletId, deleted: false }, orderBy: [{ sequence: "asc" }, { id: "asc" }] }),
            tx.table.findMany({ where: { outletId, deleted: false }, orderBy: [{ sequence: "asc" }, { id: "asc" }] }),
        ])
        return { areas: savedAreas, tables: savedTables }
    })
}

export default { sync, save }
