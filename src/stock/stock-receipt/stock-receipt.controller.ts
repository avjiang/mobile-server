import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./stock-receipt.service"
import { StockReceipt } from "../../../prisma/client/generated/client"
import NetworkRequest from "../../api-helpers/network-request"
import { RequestValidateError } from "../../api-helpers/error"
import { sendResponse } from "../../api-helpers/network"
import { AuthRequest } from "src/middleware/auth-request"
import { StockReceiptsRequestBody } from "./stock-receipt.request"

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

let updateStockReceipt = (req: NetworkRequest<StockReceiptsRequestBody>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    const requestBody = req.body
    if (!requestBody || !requestBody.stockReceipts || requestBody.stockReceipts.length === 0) {
        throw new RequestValidateError('Update failed: stock receipts data missing')
    }
    
    // Validate all stock receipts have IDs
    requestBody.stockReceipts.forEach(stockReceipt => {
        if (!stockReceipt.id) {
            throw new RequestValidateError('Update failed: [id] not found in one of the stock receipts')
        }
    })
    
    service.updateStockReceipts(req.user.databaseName, requestBody)
        .then((updatedStockReceipts: StockReceipt[]) => sendResponse(res, updatedStockReceipts))
        .catch(next)
}

// routes
router.get('/find', getItemStockReceipt)
router.put('/update', updateStockReceipt)
export = router