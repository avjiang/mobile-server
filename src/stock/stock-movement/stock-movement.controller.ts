import express, { NextFunction, Response } from "express"
import validator from "validator"
import service from "./stock-movement.service"
import { RequestValidateError } from "../../api-helpers/error"
import { sendResponse } from "../../api-helpers/network"
import { AuthRequest } from "src/middleware/auth-request"

const router = express.Router()

let getStockChecksByItemIdAndOutlet = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated')
    }

    const outletId = parseInt(req.query.outletId as string)
    const itemId = req.query.itemId as string
    const itemVariantId = req.query.itemVariantId as string | undefined

    if (!validator.isNumeric(itemId)) {
        throw new RequestValidateError('Item ID format incorrect')
    }

    // Parse itemVariantId: "null" string means null, numeric string means number, undefined means don't filter
    let parsedVariantId: number | null | undefined = undefined;
    if (itemVariantId !== undefined) {
        if (itemVariantId === 'null') {
            parsedVariantId = null;
        } else if (validator.isNumeric(itemVariantId)) {
            parsedVariantId = parseInt(itemVariantId);
        } else {
            throw new RequestValidateError('Item Variant ID format incorrect');
        }
    }

    service.getStockChecksByItemIdAndOutlet(req.user.databaseName, parseInt(itemId), outletId, parsedVariantId)
        .then((stockCheck: any[]) => sendResponse(res, stockCheck))
        .catch(next)
}

//routes
router.get('/find', getStockChecksByItemIdAndOutlet)
export = router
