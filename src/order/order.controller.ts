import express, { NextFunction, Response } from "express"
import service from "./order.service"
import salesService from "../sales/sales.service"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { AuthRequest } from "../middleware/auth-request"
import { requirePermission } from "../middleware/require-permission.middleware"
import { PERMISSION } from "../permission/permission-names"
import { readClientRef } from "../sales/client-ref"

// F&B open bills (docs/modules/FNB.md, P4). Per outlet (X-Outlet-ID); taking
// orders and settling them is "Process Sales", like the till.
const router = express.Router()

const outletOf = (req: AuthRequest): number => {
    if (!req.outletId) throw new RequestValidateError("Outlet is required")
    return req.outletId
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
router.post("/:ref/round", requirePermission(PERMISSION.PROCESS_SALES), (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    service.round(req.user.databaseName, outletOf(req), req.params.ref, req.body?.lines, performer(req)).then((o) => sendResponse(res, o)).catch(next)
})
router.post("/:ref/voidLine", requirePermission(PERMISSION.PROCESS_SALES), (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    service.voidLine(req.user.databaseName, outletOf(req), req.params.ref, String(req.body?.lineRef ?? ""), String(req.body?.reason ?? ""))
        .then((o) => sendResponse(res, o)).catch(next)
})
router.put("/:ref/table", requirePermission(PERMISSION.PROCESS_SALES), (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    const tableId = req.body?.tableId == null ? null : Number(req.body.tableId)
    service.move(req.user.databaseName, outletOf(req), req.params.ref, tableId).then((o) => sendResponse(res, o)).catch(next)
})
router.post("/:ref/cancel", requirePermission(PERMISSION.PROCESS_SALES), (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    service.cancel(req.user.databaseName, outletOf(req), req.params.ref).then((o) => sendResponse(res, o)).catch(next)
})
/** Body = the completeNewSales body ({sales, payments}) built from the bill's lines. */
router.post("/:ref/settle", requirePermission(PERMISSION.PROCESS_SALES), (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    const user = req.user
    const sales = req.body?.sales
    if (!sales) throw new RequestValidateError("sales is required")
    const clientRef = readClientRef(req.header("x-idempotency-key"))
    service.settle(user.databaseName, outletOf(req), req.params.ref, (tableId) => salesService.completeNewSales(
        user.databaseName,
        user.tenantId,
        { userId: user.userId, username: user.username, loyaltyTier: user.loyaltyTier, permissions: user.permissions, planName: user.planName },
        sales,
        req.body?.payments ?? [],
        clientRef,
        { skipKitchenTickets: true, tableId },
    ) as Promise<{ id: number }>)
        .then((r) => sendResponse(res, r))
        .catch(next)
})

export = router
