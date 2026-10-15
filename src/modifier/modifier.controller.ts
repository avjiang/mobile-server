import express, { NextFunction, Response } from "express"
import validator from "validator"
import service from "./modifier.service"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { AuthRequest } from "../middleware/auth-request"
import { requirePermission } from "../middleware/require-permission.middleware"
import { PERMISSION } from "../permission/permission-names"
import { SaveModifierGroupRequest, SetAvailabilityRequest, SetItemModifierGroupsRequest } from "./modifier.request"

// F&B modifier library (docs/modules/FNB.md). Reads are open to every signed-in
// user (the cashier's picker needs them); editing the library is "Manage Inventory",
// like editing the menu; the "Habis" toggle is its own "Mark Menu Sold Out".
const router = express.Router()

const idParam = (raw: string, label = "ID"): number => {
    if (!validator.isNumeric(raw ?? "")) throw new RequestValidateError(`${label} format incorrect`)
    return parseInt(raw)
}

const sync = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    service.sync(req.user.databaseName, req.query.lastSyncTimestamp as string | undefined)
        .then(({ serverTimestamp, ...data }) => sendResponse(res, { data, serverTimestamp }))
        .catch(next)
}

const getGroup = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    service.getGroup(req.user.databaseName, idParam(req.params.id))
        .then((group) => sendResponse(res, group))
        .catch(next)
}

const createGroup = (req: NetworkRequest<SaveModifierGroupRequest>, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    service.createGroup(req.user.databaseName, req.body)
        .then((group) => sendResponse(res, group))
        .catch(next)
}

const updateGroup = (req: NetworkRequest<SaveModifierGroupRequest>, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    service.updateGroup(req.user.databaseName, idParam(req.params.id), req.body)
        .then((group) => sendResponse(res, group))
        .catch(next)
}

const removeGroup = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    service.removeGroup(req.user.databaseName, idParam(req.params.id))
        .then(() => sendResponse(res, "Successfully deleted"))
        .catch(next)
}

const setItemGroups = (req: NetworkRequest<SetItemModifierGroupsRequest>, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    service.setItemGroups(req.user.databaseName, idParam(req.params.itemId, "Item ID"), req.body?.groupIds)
        .then((result) => sendResponse(res, result))
        .catch(next)
}

const setAvailability = (req: NetworkRequest<SetAvailabilityRequest>, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    if (typeof req.body?.isAvailable !== "boolean") throw new RequestValidateError("isAvailable must be true or false")
    service.setModifierAvailability(req.user.databaseName, idParam(req.params.id), req.body.isAvailable)
        .then((modifier) => sendResponse(res, modifier))
        .catch(next)
}

router.get("/sync", sync)
router.get("/group/:id", getGroup)
router.post("/group", requirePermission(PERMISSION.MANAGE_INVENTORY), createGroup)
router.put("/group/:id", requirePermission(PERMISSION.MANAGE_INVENTORY), updateGroup)
router.delete("/group/:id", requirePermission(PERMISSION.MANAGE_INVENTORY), removeGroup)
router.put("/item/:itemId", requirePermission(PERMISSION.MANAGE_INVENTORY), setItemGroups)
router.put("/:id/availability", requirePermission(PERMISSION.MARK_MENU_SOLD_OUT), setAvailability)
export = router
