import { randomInt, randomUUID } from "crypto"
import { Prisma, PrismaClient } from "../../prisma/client/generated/client"
import { BusinessLogicError, NotFoundError, RequestValidateError } from "../api-helpers/error"
import { getGlobalPrisma, getTenantPrisma } from "../db"
import { NON_SEATING } from "../floor/floor.service"
import { appendRound, fireRoundTickets, OrderLineInput, Performer, serialize, withLines } from "../order/order.service"
import PushyService from "../pushy/pushy.service"

/**
 * F&B QR self-order (docs/modules/FNB.md, P6; plan docs/future/FNB_QR_SELF_ORDER.md).
 *
 * Three kinds of token, all 10 chars of base62 from a crypto RNG, all at the
 * same URL shape `/q/<token>`:
 * - dynamic: `Order.qrToken`, issued per seating, dies at settle / cancel / 6 h;
 *   a QR round goes straight to the kitchen (unless `requireConfirm`);
 * - static: `Table.qrToken`, a sticker; every order waits for staff;
 * - counter: `QrOrderSetting.counterToken`, take-away with the diner's name;
 *   every order waits for staff.
 * Prices always come from this tenant's menu, never from the client.
 */

const ALPHA = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
export const TOKEN_RE = /^[0-9A-Za-z]{10}$/
export const DYNAMIC_TTL_MS = 6 * 3600_000
const MAX_LINES = 30
const MAX_QTY = 50
const MAX_ORDER_VALUE = 10_000_000
const MAX_PENDING = 40

export const newToken = () => Array.from({ length: 10 }, () => ALPHA[randomInt(ALPHA.length)]).join("")

const uniqueToken = async (tx: Prisma.TransactionClient | PrismaClient) => {
    for (let i = 0; i < 6; i++) {
        const t = newToken()
        const [o, tb, c] = await Promise.all([
            tx.order.findUnique({ where: { qrToken: t }, select: { id: true } }),
            tx.table.findUnique({ where: { qrToken: t }, select: { id: true } }),
            tx.qrOrderSetting.findUnique({ where: { counterToken: t }, select: { id: true } }),
        ])
        if (!o && !tb && !c) return t
    }
    throw new Error("Could not mint a unique QR token")
}

/** The diner's address for [token]: the shop subdomain (the Cloudflare front door). */
export const qrUrl = (slug: string | null, token: string) =>
    slug ? `https://${slug}.bayaryuk.net/q/${token}` : `/q/${token}`

// ── Settings (per outlet) ──────────────────────────────────────────────────

export interface QrSettings {
    enabled: boolean
    tableMode: "dynamic" | "static"
    requireConfirm: boolean
    counterEnabled: boolean
    counterToken: string | null
}

const toSettings = (r: any | null): QrSettings => ({
    enabled: r?.enabled === true,
    tableMode: r?.tableMode === "static" ? "static" : "dynamic",
    requireConfirm: r?.requireConfirm === true,
    counterEnabled: r?.counterEnabled === true,
    counterToken: r?.counterToken ?? null,
})

export const getSettings = async (prisma: PrismaClient | Prisma.TransactionClient, outletId: number): Promise<QrSettings> =>
    toSettings(await prisma.qrOrderSetting.findUnique({ where: { outletId } }))

export const saveSettings = async (databaseName: string, outletId: number, body: any): Promise<QrSettings> => {
    const prisma = getTenantPrisma(databaseName)
    const current = await getSettings(prisma, outletId)
    const next = {
        enabled: body?.enabled === undefined ? current.enabled : body.enabled === true,
        tableMode: body?.tableMode === undefined ? current.tableMode : body.tableMode === "static" ? "static" : "dynamic",
        requireConfirm: body?.requireConfirm === undefined ? current.requireConfirm : body.requireConfirm === true,
        counterEnabled: body?.counterEnabled === undefined ? current.counterEnabled : body.counterEnabled === true,
    }
    let counterToken = current.counterToken
    if (body?.resetCounter === true || (next.counterEnabled && !counterToken)) counterToken = await uniqueToken(prisma)
    const saved = await prisma.qrOrderSetting.upsert({
        where: { outletId },
        create: { outletId, ...next, counterToken },
        update: { ...next, counterToken },
    })
    return toSettings(saved)
}

// ── Merchant: tokens ───────────────────────────────────────────────────────

/** The seating's dynamic token ("Cetak ulang QR" reprints the same one). */
export const issueOrderQr = async (databaseName: string, outletId: number, orderRef: string) => {
    const prisma = getTenantPrisma(databaseName)
    const order = await prisma.order.findFirst({ where: { orderRef, outletId } })
    if (!order) throw new NotFoundError("Order")
    if (order.status !== "OPEN") throw new BusinessLogicError(`This bill is ${order.status.toLowerCase()}`)
    if (order.qrToken && order.qrExpiresAt && order.qrExpiresAt.getTime() > Date.now()) {
        return { qrToken: order.qrToken, qrExpiresAt: order.qrExpiresAt }
    }
    const qrToken = await uniqueToken(prisma)
    const qrExpiresAt = new Date(Date.now() + DYNAMIC_TTL_MS)
    await prisma.order.update({ where: { id: order.id }, data: { qrToken, qrExpiresAt, version: { increment: 1 } } })
    return { qrToken, qrExpiresAt }
}

/** A sticker's token: issued, or replaced ("Buat ulang QR" kills the old one). */
export const resetTableQr = async (databaseName: string, outletId: number, tableId: number) => {
    const prisma = getTenantPrisma(databaseName)
    const table = await prisma.table.findFirst({ where: { id: tableId, outletId, deleted: false } })
    if (!table || NON_SEATING.includes(table.shape)) throw new NotFoundError("Table")
    const qrToken = await uniqueToken(prisma)
    await prisma.table.update({ where: { id: table.id }, data: { qrToken, version: { increment: 1 } } })
    return { tableId: table.id, qrToken }
}

// ── Merchant: accept / reject ──────────────────────────────────────────────

/**
 * Accepts a QR order waiting for staff. A seated bill (its target, or the open
 * bill at its table) gets it as a new round; otherwise it becomes an open bill
 * itself. Either way the round's kitchen tickets fire now.
 */
export const accept = async (databaseName: string, outletId: number, orderRef: string, performer: Performer) => {
    const prisma = getTenantPrisma(databaseName)
    const result = await prisma.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({ where: { orderRef, outletId, status: "PENDING_ACCEPT" }, data: { status: "ACCEPTING" } })
        const pending = await tx.order.findFirst({ where: { orderRef, outletId }, include: withLines })
        if (!pending) throw new NotFoundError("Order")
        if (claimed.count === 0) throw new BusinessLogicError(`This QR order is ${pending.status.toLowerCase()}`)
        const target =
            (pending.targetRef
                ? await tx.order.findFirst({ where: { orderRef: pending.targetRef, outletId, status: "OPEN" } })
                : null) ??
            (pending.tableId != null
                ? await tx.order.findFirst({ where: { tableId: pending.tableId, outletId, status: "OPEN", id: { not: pending.id } } })
                : null)
        if (target) {
            const lines: OrderLineInput[] = pending.lines.map((l: any) => ({
                lineRef: `${l.lineRef}:m`.slice(0, 64),
                itemId: l.itemId,
                itemVariantId: l.itemVariantId,
                itemName: l.itemName,
                variantName: l.variantName,
                quantity: Number(l.quantity),
                unitPrice: Number(l.unitPrice),
                basePrice: l.basePrice == null ? null : Number(l.basePrice),
                hasTax: l.hasTax,
                modifiers: (l.modifiers as any[]) ?? [],
                note: l.note,
                source: "qr",
            }))
            const round = await appendRound(tx, target, lines, performer)
            await tx.order.update({
                where: { id: pending.id },
                data: { status: "MERGED", targetRef: target.orderRef, rounds: round, closedAt: new Date(), version: { increment: 1 } },
            })
            return { orderRef: target.orderRef, round }
        }
        const opened = await tx.order.update({
            where: { id: pending.id },
            data: { status: "OPEN", openedBy: performer.username ?? null, openedAt: new Date(), version: { increment: 1 } },
        })
        await fireRoundTickets(tx, opened, 1, performer)
        return { orderRef: opened.orderRef, round: 1 }
    })
    return { ...result, order: serialize(await prisma.order.findUnique({ where: { orderRef: result.orderRef }, include: withLines })) }
}

export const reject = async (databaseName: string, outletId: number, orderRef: string, reason: string) => {
    const prisma = getTenantPrisma(databaseName)
    const why = String(reason ?? "").trim().slice(0, 200)
    if (!why) throw new RequestValidateError("A reason is required")
    const claimed = await prisma.order.updateMany({
        where: { orderRef, outletId, status: "PENDING_ACCEPT" },
        data: { status: "REJECTED", rejectReason: why, closedAt: new Date(), version: { increment: 1 } },
    })
    if (claimed.count === 0) throw new BusinessLogicError("This QR order is no longer waiting")
    return serialize(await prisma.order.findUnique({ where: { orderRef }, include: withLines }))
}

// ── Public: shop + token ───────────────────────────────────────────────────

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/

export interface QrShop { tenantId: number; name: string; slug: string; logoUrl: string | null; databaseName: string }

/** The shop's name as its receipts print it (the `company_name` setting, Pengaturan › Toko):
 *  diners see "Kedai Kopi Nanggroe", not the login name. Null when it was never set. */
const receiptName = async (tenantId: number, databaseName: string): Promise<string | null> => {
    try {
        const def = await getGlobalPrisma().settingDefinition.findFirst({ where: { key: "company_name", deleted: false }, select: { id: true } })
        if (!def) return null
        const row = await getTenantPrisma(databaseName).setting.findFirst({
            where: { settingDefinitionId: def.id, tenantId, deleted: false },
            select: { value: true },
        })
        return row?.value?.trim() || null
    } catch {
        return null
    }
}

/** slug → the shop (Pro only; the trial counts). Cached ~60 s: status polling would hit the global DB otherwise. */
const shopCache = new Map<string, { shop: QrShop | null; at: number }>()
export const resolveShop = async (slugRaw: string): Promise<QrShop> => {
    const slug = (slugRaw || "").toLowerCase().trim()
    if (!SLUG_RE.test(slug)) throw new NotFoundError("Shop")
    const hit = shopCache.get(slug)
    if (hit && Date.now() - hit.at < 60_000) {
        if (!hit.shop) throw new NotFoundError("Shop")
        return hit.shop
    }
    const tenant = await getGlobalPrisma().tenant.findUnique({
        where: { slug },
        select: { id: true, databaseName: true, tenantName: true, logoUrl: true },
    })
    let shop: QrShop | null = null
    if (tenant?.databaseName) {
        const onPro = await getGlobalPrisma().tenantSubscription.findFirst({
            where: { tenantId: tenant.id, status: { in: ["Active", "active", "trial"] }, subscriptionPlan: { planName: "Pro" } },
            select: { id: true },
        })
        if (onPro) {
            shop = {
                tenantId: tenant.id,
                name: (await receiptName(tenant.id, tenant.databaseName)) || tenant.tenantName,
                slug,
                logoUrl: tenant.logoUrl?.startsWith("https://") ? tenant.logoUrl : null,
                databaseName: tenant.databaseName,
            }
        }
    }
    if (shopCache.size > 2000) shopCache.clear()
    shopCache.set(slug, { shop, at: Date.now() })
    if (!shop) throw new NotFoundError("Shop")
    return shop
}

export type QrKind = "dynamic" | "static" | "counter"

export interface QrContext {
    kind: QrKind
    outletId: number
    settings: QrSettings
    order?: { id: number; orderRef: string; tableId: number | null } // dynamic
    tableId?: number | null
    tableName?: string | null
}

/** Finds what [token] opens in this tenant, or null ("QR tidak berlaku"). */
export const resolveToken = async (prisma: PrismaClient, token: string): Promise<QrContext | null> => {
    if (!TOKEN_RE.test(token)) return null
    const order = await prisma.order.findUnique({ where: { qrToken: token } })
    if (order) {
        if (order.status !== "OPEN" || !order.qrExpiresAt || order.qrExpiresAt.getTime() < Date.now()) return null
        const settings = await getSettings(prisma, order.outletId)
        if (!settings.enabled || settings.tableMode !== "dynamic") return null
        const table = order.tableId == null ? null : await prisma.table.findUnique({ where: { id: order.tableId } })
        return {
            kind: "dynamic",
            outletId: order.outletId,
            settings,
            order: { id: order.id, orderRef: order.orderRef, tableId: order.tableId },
            tableId: order.tableId,
            tableName: table?.tableNumber ?? order.label ?? null,
        }
    }
    const table = await prisma.table.findUnique({ where: { qrToken: token } })
    if (table) {
        if (table.deleted) return null
        const settings = await getSettings(prisma, table.outletId)
        if (!settings.enabled || settings.tableMode !== "static") return null
        return { kind: "static", outletId: table.outletId, settings, tableId: table.id, tableName: table.tableNumber }
    }
    const counter = await prisma.qrOrderSetting.findUnique({ where: { counterToken: token } })
    if (counter) {
        const settings = toSettings(counter)
        if (!settings.enabled || !settings.counterEnabled) return null
        return { kind: "counter", outletId: counter.outletId, settings }
    }
    return null
}

// ── Public: menu + pricing ─────────────────────────────────────────────────

export interface QrMenuItem {
    id: number
    name: string
    description: string | null
    price: number
    imageUrl: string | null
    categoryId: number | null
    variants: { id: number; name: string; price: number }[]
    groups: number[]
    // Not sent to the diner (stripped before render); the bill needs it.
    hasTax?: boolean
}

export interface QrMenuGroup {
    id: number
    name: string
    min: number
    max: number
    free: number
    options: { id: number; name: string; price: number; isDefault: boolean }[]
}

export interface QrMenu {
    categories: { id: number; name: string; icon: string | null }[]
    items: QrMenuItem[]
    groups: QrMenuGroup[]
}

const num = (d: any) => (d == null ? 0 : Number(d))
const img = (u: string | null | undefined) => (u && u.startsWith("https://") ? u : null)

/** What a diner can order now: available dishes (no supplies, no "Habis"), with their option groups. */
export const loadMenu = async (prisma: PrismaClient, outletId: number): Promise<QrMenu> => {
    const rows = await prisma.item.findMany({
        where: { deleted: false, isAvailable: true, itemType: { not: "supply" } },
        select: {
            id: true,
            itemName: true,
            itemDescription: true,
            price: true,
            image: true,
            hasVariants: true,
            hasTax: true,
            categoryId: true,
            variants: { where: { deleted: false }, select: { id: true, variantName: true, price: true } },
        },
        orderBy: { itemName: "asc" },
        take: 500,
    })
    const ids = rows.map((r) => r.id)
    const links = ids.length === 0 ? [] : await prisma.itemModifierGroup.findMany({
        where: { deleted: false, itemId: { in: ids } },
        orderBy: { sequence: "asc" },
    })
    const groupIds = [...new Set(links.map((l) => l.groupId))]
    const groupRows = groupIds.length === 0 ? [] : await prisma.modifierGroup.findMany({
        where: { id: { in: groupIds }, deleted: false, OR: [{ outletId: null }, { outletId }] },
        include: { modifiers: { where: { deleted: false, isAvailable: true }, orderBy: { sequence: "asc" } } },
    })
    const liveGroups = new Set(groupRows.map((g) => g.id))
    const catIds = [...new Set(rows.map((r) => r.categoryId).filter((c): c is number => c != null))]
    const cats = catIds.length === 0 ? [] : await prisma.category.findMany({
        where: { id: { in: catIds }, deleted: false },
        select: { id: true, name: true, icon: true },
        orderBy: { name: "asc" },
    })
    return {
        categories: cats.map((c) => ({ id: c.id, name: c.name, icon: c.icon ?? null })),
        items: rows.map((r) => ({
            id: r.id,
            name: r.itemName,
            description: r.itemDescription && r.itemDescription.length > 0 ? r.itemDescription : null,
            price: num(r.price),
            imageUrl: img(r.image),
            categoryId: r.categoryId ?? null,
            variants: r.hasVariants
                ? r.variants.map((v) => ({ id: v.id, name: v.variantName, price: v.price == null ? num(r.price) : num(v.price) }))
                : [],
            groups: links.filter((l) => l.itemId === r.id && liveGroups.has(l.groupId)).map((l) => l.groupId),
            hasTax: r.hasTax === true,
        })),
        groups: groupRows.map((g) => ({
            id: g.id,
            name: g.name,
            min: g.minSelect,
            max: g.maxSelect,
            free: g.freeLimit ?? 0,
            options: g.modifiers.map((m) => ({ id: m.id, name: m.name, price: num(m.price), isDefault: m.isDefault })),
        })),
    }
}

/**
 * Re-prices the diner's cart from the menu: unknown / sold-out items, options
 * outside the item's groups and broken min/max rules are refused. Free picks
 * go to the priciest options (the till's rule).
 */
export const priceCart = (menu: QrMenu, raw: unknown): OrderLineInput[] => {
    if (!Array.isArray(raw) || raw.length === 0) throw new RequestValidateError("The order is empty")
    if (raw.length > MAX_LINES) throw new RequestValidateError(`At most ${MAX_LINES} lines`)
    const items = new Map(menu.items.map((i) => [i.id, i]))
    const groups = new Map(menu.groups.map((g) => [g.id, g]))
    let total = 0
    const lines = raw.map((l: any) => {
        const item = items.get(Number(l?.itemId))
        if (!item) throw new BusinessLogicError("An item is no longer available")
        const qty = Number(l?.quantity)
        if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new RequestValidateError("Quantity must be 1–50")
        let base = item.price
        let variantName: string | null = null
        let variantId: number | null = null
        if (item.variants.length > 0) {
            const v = item.variants.find((x) => x.id === Number(l?.variantId))
            if (!v) throw new RequestValidateError(`Choose a variant for ${item.name}`)
            base = v.price
            variantName = v.name
            variantId = v.id
        }
        const picked = new Set<number>((Array.isArray(l?.modifierIds) ? l.modifierIds : []).map((x: any) => Number(x)))
        const mods: { modifierId: number; groupName: string; modifierName: string; price: number; quantity: number }[] = []
        let extra = 0
        for (const gid of item.groups) {
            const g = groups.get(gid)
            if (!g) continue
            const chosen = g.options.filter((o) => picked.has(o.id))
            if (chosen.length < g.min) throw new RequestValidateError(`Choose ${g.name}`)
            if (g.max > 0 && chosen.length > g.max) throw new RequestValidateError(`Too many choices in ${g.name}`)
            const byPrice = [...chosen].sort((a, b) => b.price - a.price)
            byPrice.forEach((o, i) => {
                const price = i < g.free ? 0 : o.price
                extra += price
                mods.push({ modifierId: o.id, groupName: g.name, modifierName: o.name, price, quantity: 1 })
                picked.delete(o.id)
            })
        }
        if (picked.size > 0) throw new RequestValidateError("An option is no longer available")
        const unit = base + extra
        total += unit * qty
        return {
            lineRef: randomUUID(),
            itemId: item.id,
            itemVariantId: variantId,
            itemName: item.name,
            variantName,
            quantity: qty,
            unitPrice: unit,
            basePrice: base,
            hasTax: item.hasTax === true,
            modifiers: mods,
            note: l?.note ? String(l.note).trim().slice(0, 120) || null : null,
            source: "qr",
        } satisfies OrderLineInput
    })
    if (total > MAX_ORDER_VALUE) throw new RequestValidateError("This order is too large — please order at the counter")
    return lines
}

// ── Public: submit + status ────────────────────────────────────────────────

const notify = (tenantId: number, outletId: number, title: string, message: string, data: Record<string, unknown>) => {
    PushyService.sendToTopic(
        `tenant_${tenantId}_outlet_${outletId}_sales`,
        {
            title,
            message,
            data: { notificationId: randomUUID(), type: "order_status", tenantId, outletId, timestamp: new Date().toISOString(), ...data },
        },
        tenantId,
    ).catch((e: unknown) => console.error("QR order push failed (kept going):", e))
}

export interface QrSubmitResult { orderRef: string; round: number; status: "PENDING" | "ACCEPTED" }

/** Records the diner's cart: a round on the seated bill, or a QR order waiting for staff. */
export const submit = async (shop: QrShop, token: string, body: any): Promise<QrSubmitResult> => {
    const prisma = getTenantPrisma(shop.databaseName)
    const ctx = await resolveToken(prisma, token)
    if (!ctx) throw new NotFoundError("QR")
    const menu = await loadMenu(prisma, ctx.outletId)
    const lines = priceCart(menu, body?.lines)
    const name = body?.name ? String(body.name).trim().slice(0, 60) : ""
    if (ctx.kind === "counter" && !name) throw new RequestValidateError("Please write your name")
    const performer: Performer = { username: "QR" }

    if (ctx.kind === "dynamic" && !ctx.settings.requireConfirm) {
        const round = await prisma.$transaction(async (tx) => {
            const order = await tx.order.findFirst({ where: { id: ctx.order!.id, status: "OPEN" } })
            if (!order) throw new NotFoundError("QR")
            return appendRound(tx, order, lines, performer)
        })
        notify(shop.tenantId, ctx.outletId, ctx.tableName ? `Meja ${ctx.tableName}` : "Pesanan QR", "Pesanan baru dari QR dikirim ke dapur", {
            orderId: ctx.order!.orderRef, status: "ACCEPTED", tableNumber: ctx.tableName ?? null, items: lines.map((l) => `${l.quantity}× ${l.itemName}`),
        })
        return { orderRef: ctx.order!.orderRef, round, status: "ACCEPTED" }
    }

    // A flood guard: past this many orders waiting at one outlet, send diners to the counter.
    const waiting = await prisma.order.count({ where: { outletId: ctx.outletId, status: "PENDING_ACCEPT" } })
    if (waiting >= MAX_PENDING) throw new BusinessLogicError("Many orders are waiting — please order at the counter")
    const orderRef = randomUUID()
    await prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
            data: {
                outletId: ctx.outletId,
                orderRef,
                tableId: ctx.tableId ?? null,
                status: "PENDING_ACCEPT",
                source: "qr",
                salesType: ctx.kind === "counter" ? "Take Away" : "Dine-In",
                label: name || null,
                targetRef: ctx.kind === "dynamic" ? ctx.order!.orderRef : null,
                openedBy: "QR",
            },
        })
        await tx.orderLine.createMany({
            data: lines.map((l) => ({
                orderId: order.id,
                lineRef: l.lineRef,
                round: 1,
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
                source: "qr",
                createdBy: "QR",
            })),
        })
        await tx.order.update({ where: { id: order.id }, data: { rounds: 1 } })
    })
    notify(shop.tenantId, ctx.outletId, "Pesanan QR menunggu", ctx.tableName ? `Meja ${ctx.tableName} — terima atau tolak` : `${name} — terima atau tolak`, {
        orderId: orderRef, status: "PENDING_ACCEPT", tableNumber: ctx.tableName ?? null, items: lines.map((l) => `${l.quantity}× ${l.itemName}`),
    })
    return { orderRef, round: 1, status: "PENDING" }
}

export type DinerStatus = "PENDING" | "ACCEPTED" | "PREPARING" | "READY" | "REJECTED" | "CLOSED"

const RANK = ["NEW", "PREPARING", "READY", "SERVED"]

/** What the diner sees for their submission ([orderRef] + [round]) and, for a seated bill, the bill so far. */
export const status = async (shop: QrShop, orderRef: string, roundRaw: unknown) => {
    const prisma = getTenantPrisma(shop.databaseName)
    let order = await prisma.order.findUnique({ where: { orderRef }, include: withLines })
    // Only QR orders and bills a QR was issued for are readable here.
    if (!order || (order.source !== "qr" && !order.qrToken)) throw new NotFoundError("Order")
    let round = Number(roundRaw) || 1
    if (order.status === "PENDING_ACCEPT" || order.status === "ACCEPTING") return { status: "PENDING" as DinerStatus, rounds: [], billTotal: 0 }
    if (order.status === "REJECTED") return { status: "REJECTED" as DinerStatus, reason: order.rejectReason, rounds: [], billTotal: 0 }
    if (order.status === "MERGED" && order.targetRef) {
        round = order.rounds
        order = await prisma.order.findUnique({ where: { orderRef: order.targetRef }, include: withLines })
        if (!order) throw new NotFoundError("Order")
    }
    const tickets = await prisma.kitchenTicket.findMany({ where: { orderRef: order.orderRef, deleted: false }, select: { round: true, status: true } })
    const roundStatus = (r: number) => {
        const ts = tickets.filter((t) => t.round === r)
        if (ts.length === 0) return null
        return ts.map((t) => t.status).reduce((a, b) => (RANK.indexOf(a) <= RANK.indexOf(b) ? a : b))
    }
    const mine = roundStatus(round)
    let s: DinerStatus = mine === "READY" || mine === "SERVED" ? "READY" : mine === "PREPARING" ? "PREPARING" : "ACCEPTED"
    if (order.status === "SETTLED" || order.status === "VOID") s = s === "READY" ? "READY" : "CLOSED"
    const live = order.lines.filter((l: any) => !l.voided)
    const rounds = [...new Set(live.map((l: any) => l.round as number))].sort((a, b) => a - b).map((r) => ({
        round: r,
        status: roundStatus(r),
        lines: live.filter((l: any) => l.round === r).map((l: any) => ({
            quantity: Number(l.quantity),
            name: l.itemName,
            details: [
                ...(((l.modifiers as any[]) ?? []).map((m) => (Number(m.price) > 0 ? `+ ${m.modifierName}` : m.modifierName))),
                ...(l.note ? [l.note] : []),
            ].join(" · "),
        })),
    }))
    // Not "total": the response envelope lifts a top-level `total` out of data.
    const billTotal = live.reduce((a: number, l: any) => a + Number(l.quantity) * Number(l.unitPrice), 0)
    return { status: s, round, rounds, billTotal, closed: order.status === "SETTLED" || order.status === "VOID" }
}
