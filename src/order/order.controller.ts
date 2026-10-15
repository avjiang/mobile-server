import express, { NextFunction, Response } from "express"
import service from "./order.service"
import salesService from "../sales/sales.service"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { AuthRequest } from "../middleware/auth-request"
import { requirePermission } from "../middleware/require-permission.middleware"
import { PERMISSION } from "../permission/permission-names"
import { readClientRef } from "../sales/client-ref"
import { requirePlan } from "../middleware/require-plan.middleware"
import { getGlobalPrisma, getTenantPrisma } from "../db"
import * as qr from "../qr-order/qr-order.service"

// F&B open bills (docs/modules/FNB.md, P4). Per outlet (X-Outlet-ID); taking
// orders and settling them is "Process Sales", like the till.
const router = express.Router()

const outletOf = (req: AuthRequest): number => {
    if (!req.outletId) throw new RequestValidateError("Outlet is required")
    return req.outletId
}
// The bill's device-minted ref rides in the body, so a queued (offline) action
// replays to the same path.
const refOf = (req: AuthRequest): string => {
    const ref = String(req.body?.orderRef ?? "").trim()
    if (!ref) throw new RequestValidateError("orderRef is required")
    return ref
}
const performer = (req: AuthRequest) => ({
    username: req.user?.username,
    siteId: req.body?.siteId == null ? null : Number(req.body.siteId),
})

router.get("/sync", (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    service.sync(req.user.databaseName, outletOf(req), req.query.lastSyncTimestamp as string | undefined)
        .then(({ orders, serverTimestamp }) => sendResponse(res, { data: orders, total: orders.length, serverTimestamp }))
        .catch(next)
})
router.post("/open", requirePermission(PERMISSION.PROCESS_SALES), (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    service.open(req.user.databaseName, outletOf(req), req.body, performer(req)).then((o) => sendResponse(res, o)).catch(next)
})
router.post("/round", requirePermission(PERMISSION.PROCESS_SALES), (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    service.round(req.user.databaseName, outletOf(req), refOf(req), req.body?.lines, performer(req)).then((o) => sendResponse(res, o)).catch(next)
})
router.post("/voidLine", requirePermission(PERMISSION.PROCESS_SALES), (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    service.voidLine(req.user.databaseName, outletOf(req), refOf(req), String(req.body?.lineRef ?? ""), String(req.body?.reason ?? ""))
        .then((o) => sendResponse(res, o)).catch(next)
})
router.post("/move", requirePermission(PERMISSION.PROCESS_SALES), (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    const tableId = req.body?.tableId == null ? null : Number(req.body.tableId)
    service.move(req.user.databaseName, outletOf(req), refOf(req), tableId).then((o) => sendResponse(res, o)).catch(next)
})
router.post("/cancel", requirePermission(PERMISSION.PROCESS_SALES), (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    service.cancel(req.user.databaseName, outletOf(req), refOf(req)).then((o) => sendResponse(res, o)).catch(next)
})
/** Body = {orderRef, sales, payments}: the completeNewSales body built from the bill's lines. */
router.post("/settle", requirePermission(PERMISSION.PROCESS_SALES), (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    const user = req.user
    const sales = req.body?.sales
    if (!sales) throw new RequestValidateError("sales is required")
    // Paying a bill must be idempotent: a retry after a lost response returns the same sale.
    const clientRef = readClientRef(req.header("x-idempotency-key"))
    if (!clientRef) throw new RequestValidateError("x-idempotency-key is required")
    // The sale belongs to the bill's outlet, whatever the body says.
    const outletId = outletOf(req)
    sales.outletId = outletId
    const rounds = Number.isInteger(req.body?.rounds) ? Number(req.body.rounds) : null
    service.settle(user.databaseName, outletId, refOf(req), (tableId) => salesService.completeNewSales(
        user.databaseName,
        user.tenantId,
        { userId: user.userId, username: user.username, loyaltyTier: user.loyaltyTier, permissions: user.permissions, planName: user.planName },
        sales,
        req.body?.payments ?? [],
        clientRef,
        { skipKitchenTickets: true, tableId },
    ) as Promise<{ id: number }>, rounds)
        .then((r) => sendResponse(res, r))
        .catch(next)
})

// ── QR self-order (P6, Pro) ────────────────────────────────────────────────

/** The shop's subdomain, for the diner URLs (null = no catalogue slug yet). */
const slugOf = async (req: AuthRequest): Promise<string | null> => {
    if (!req.user?.tenantId) return null
    const t = await getGlobalPrisma().tenant.findUnique({ where: { id: req.user.tenantId }, select: { slug: true } })
    return t?.slug ?? null
}

const withUrls = async (req: AuthRequest, settings: qr.QrSettings) => {
    const slug = await slugOf(req)
    return { ...settings, slug, counterUrl: settings.counterToken ? qr.qrUrl(slug, settings.counterToken) : null }
}

/** GET /order/qr/settings — this outlet's QR ordering setup. */
router.get("/qr/settings", requirePlan("Pro"), (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    qr.getSettings(getTenantPrisma(req.user.databaseName), outletOf(req))
        .then((st) => withUrls(req, st))
        .then((d) => sendResponse(res, d))
        .catch(next)
})

/** PUT /order/qr/settings {enabled?, tableMode?, requireConfirm?, counterEnabled?, resetCounter?} */
router.put("/qr/settings", requirePlan("Pro"), requirePermission(PERMISSION.MANAGE_FLOOR_PLAN), (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    qr.saveSettings(req.user.databaseName, outletOf(req), req.body ?? {})
        .then((st) => withUrls(req, st))
        .then((d) => sendResponse(res, d))
        .catch(next)
})

/** POST /order/qr {orderRef} — the seating's dynamic QR (the same one on a reprint). Needs a connection. */
router.post("/qr", requirePlan("Pro"), requirePermission(PERMISSION.PROCESS_SALES), (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    qr.issueOrderQr(req.user.databaseName, outletOf(req), refOf(req))
        .then(async (t) => ({ ...t, url: qr.qrUrl(await slugOf(req), t.qrToken) }))
        .then((d) => sendResponse(res, d))
        .catch(next)
})

/** POST /order/qr/table {tableId} — issue / replace a table sticker's QR. */
router.post("/qr/table", requirePlan("Pro"), requirePermission(PERMISSION.MANAGE_FLOOR_PLAN), (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    const tableId = Number(req.body?.tableId)
    if (!Number.isInteger(tableId)) throw new RequestValidateError("tableId is required")
    qr.resetTableQr(req.user.databaseName, outletOf(req), tableId)
        .then(async (t) => ({ ...t, url: qr.qrUrl(await slugOf(req), t.qrToken) }))
        .then((d) => sendResponse(res, d))
        .catch(next)
})

/** POST /order/accept {orderRef} — a QR order waiting for staff goes to the kitchen. */
router.post("/accept", requirePlan("Pro"), requirePermission(PERMISSION.PROCESS_SALES), (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    qr.accept(req.user.databaseName, outletOf(req), refOf(req), performer(req)).then((d) => sendResponse(res, d)).catch(next)
})

/** POST /order/reject {orderRef, reason} */
router.post("/reject", requirePlan("Pro"), requirePermission(PERMISSION.PROCESS_SALES), (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    qr.reject(req.user.databaseName, outletOf(req), refOf(req), String(req.body?.reason ?? "")).then((d) => sendResponse(res, d)).catch(next)
})

export = router
