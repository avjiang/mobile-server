import express, { NextFunction, Response } from "express"
import validator from "validator"
import service from "./station.service"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { AuthRequest } from "../middleware/auth-request"
import { requirePermission } from "../middleware/require-permission.middleware"
import { PERMISSION } from "../permission/permission-names"

// F&B kitchen stations (docs/modules/FNB.md). Per outlet (X-Outlet-ID). Reads are
// open to every signed-in user; editing is "Manage Inventory", like the menu.
const router = express.Router()

const outletOf = (req: AuthRequest): number => {
    if (!req.outletId) throw new RequestValidateError("Outlet is required")
    return req.outletId
}
const idOf = (raw: string): number => {
    if (!validator.isNumeric(raw ?? "")) throw new RequestValidateError("ID format incorrect")
    return parseInt(raw)
}

router.get("/sync", (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    service.sync(req.user.databaseName, req.outletId, req.query.lastSyncTimestamp as string | undefined)
        .then(({ stations, serverTimestamp }) => sendResponse(res, { data: stations, total: stations.length, serverTimestamp }))
        .catch(next)
})
router.post("/", requirePermission(PERMISSION.MANAGE_INVENTORY), (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    service.create(req.user.databaseName, outletOf(req), req.body ?? {}).then((s) => sendResponse(res, s)).catch(next)
})
router.put("/:id", requirePermission(PERMISSION.MANAGE_INVENTORY), (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    service.update(req.user.databaseName, outletOf(req), idOf(req.params.id), req.body ?? {}).then((s) => sendResponse(res, s)).catch(next)
})
router.delete("/:id", requirePermission(PERMISSION.MANAGE_INVENTORY), (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    service.remove(req.user.databaseName, outletOf(req), idOf(req.params.id)).then(() => sendResponse(res, "Successfully deleted")).catch(next)
})

export = router
