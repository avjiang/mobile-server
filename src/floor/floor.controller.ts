import express, { NextFunction, Response } from "express"
import service from "./floor.service"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { AuthRequest } from "../middleware/auth-request"
import { requirePermission } from "../middleware/require-permission.middleware"
import { PERMISSION } from "../permission/permission-names"

// F&B floor map (docs/modules/FNB.md, P4). Per outlet (X-Outlet-ID). Everyone
// reads it; editing is "Manage Floor Plan" ("Atur denah meja").
const router = express.Router()

const outletOf = (req: AuthRequest): number => {
    if (!req.outletId) throw new RequestValidateError("Outlet is required")
    return req.outletId
}

router.get("/sync", (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    service.sync(req.user.databaseName, outletOf(req), req.query.lastSyncTimestamp as string | undefined)
        .then(({ serverTimestamp, ...data }) => sendResponse(res, { data, serverTimestamp }))
        .catch(next)
})
router.put("/", requirePermission(PERMISSION.MANAGE_FLOOR_PLAN), (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    service.save(req.user.databaseName, outletOf(req), req.body ?? {}).then((d) => sendResponse(res, d)).catch(next)
})

export = router
