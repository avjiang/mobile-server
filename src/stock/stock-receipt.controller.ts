import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./stock-receipt.service"
import { StockReceipt } from "prisma/client"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { UpdateStockChecksRequestBody } from "./stock-movement.request"
import { AuthRequest } from "src/middleware/auth-request"

const router = express.Router()

let getItemStockReceipt = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated')
    }

    const outletId = req.query.outletId ? parseInt(req.query.outletId as string) : undefined
    const itemId = req.query.itemId as string
    if (!validator.isNumeric(itemId)) {
        throw new RequestValidateError('Item ID format incorrect')
    }

    service.getItemStockReceipt(req.user.databaseName, parseInt(itemId), outletId)
        .then((stockReceipts: StockReceipt[]) => sendResponse(res, stockReceipts))
        .catch(next)
}

// routes
router.get('/find', getItemStockReceipt)
// router.put('/update', updateManyStockChecks)
export = router