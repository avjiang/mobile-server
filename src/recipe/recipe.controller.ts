import express, { NextFunction, Response } from "express"
import validator from "validator"
import service from "./recipe.service"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { AuthRequest } from "../middleware/auth-request"
import { requirePermission } from "../middleware/require-permission.middleware"
import { requirePlan } from "../middleware/require-plan.middleware"
import { PERMISSION } from "../permission/permission-names"

// F&B recipes (docs/modules/FNB.md, D4). Reading is open (the till never needs
// it — the server expands); writing a recipe is Pro + Manage Inventory.
const router = express.Router()

const idOf = (raw: string): number => {
    if (!validator.isNumeric(raw ?? "")) throw new RequestValidateError("ID format incorrect")
    return parseInt(raw)
}

router.get("/sync", (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    service.sync(req.user.databaseName, req.query.lastSyncTimestamp as string | undefined)
        .then(({ recipes, serverTimestamp }) => sendResponse(res, { data: recipes, total: recipes.length, serverTimestamp }))
        .catch(next)
})
router.put("/item/:itemId", requirePlan("Pro"), requirePermission(PERMISSION.MANAGE_INVENTORY), (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    service.setRecipe(req.user.databaseName, { itemId: idOf(req.params.itemId) }, req.body?.lines).then((r) => sendResponse(res, r)).catch(next)
})
router.put("/modifier/:modifierId", requirePlan("Pro"), requirePermission(PERMISSION.MANAGE_INVENTORY), (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    service.setRecipe(req.user.databaseName, { modifierId: idOf(req.params.modifierId) }, req.body?.lines).then((r) => sendResponse(res, r)).catch(next)
})

export = router
