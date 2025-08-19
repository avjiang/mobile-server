import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./stock-balance.service"
import { StockBalance } from "../../prisma/client/generated/client"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { CreateStocksRequestBody, StockAdjustmentRequestBody, UpdateStocksRequestBody } from "./stock-balance.request"
import { AuthRequest } from "src/middleware/auth-request"
import { SyncRequest } from "src/item/item.request"

const router = express.Router()

let getAllStock = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    const syncRequest: SyncRequest = {
        lastSyncTimestamp: req.query.lastSyncTimestamp as string,
        lastVersion: req.query.lastVersion ? parseInt(req.query.lastVersion as string) : undefined,
        skip: req.query.skip ? parseInt(req.query.skip as string) : undefined,
        take: req.query.take ? parseInt(req.query.take as string) : undefined,
    };
    service
        .getAllStock(req.user.databaseName, syncRequest)
        .then(({ stockBalances, total, serverTimestamp }) => sendResponse(res, { data: stockBalances, total, serverTimestamp }))
        .catch(next);
}

let getStockByItemId = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    const itemId = req.query.itemId as string
    if (!validator.isNumeric(itemId)) {
        throw new RequestValidateError('Item ID format incorrect')
    }
    service.getStockByItemId(req.user.databaseName, parseInt(itemId))
        .then((stock: StockBalance) => sendResponse(res, stock))
        .catch(next)
}

let stockAdjustment = (req: NetworkRequest<StockAdjustmentRequestBody>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    const requestBody = req.body
    service.stockAdjustment(req.user.databaseName, requestBody.stockAdjustments)
        .then((adjustedRecordCount: number) => {
            var message = `Successfully adjusted ${adjustedRecordCount} stocks`
            if (adjustedRecordCount === 1) {
                message = message.substring(0, message.length - 1)
            }
            sendResponse(res, message)
        })
        .catch(next)
}

let updateManyStocks = (req: NetworkRequest<UpdateStocksRequestBody>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }

    const requestBody = req.body

    requestBody.stocks.forEach(stock => {
        if (!stock.id) {
            throw new RequestValidateError('Update failed: one of the stock [id] not found')
        }

        if (stock.id == 0) {
            throw new RequestValidateError('Update failed: one of the stock [id] cannot be 0')
        }
    });

    service.updateManyStocks(req.user.databaseName, requestBody.stocks)
        .then((updatedRecordCount: number) => {
            var message = `Successfully updated ${updatedRecordCount} stocks`
            if (updatedRecordCount === 1) {
                message = message.substring(0, message.length - 1)
            }
            sendResponse(res, message)
        })
        .catch(next)
}

let removeStock = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }

    const stockId: number = parseInt(req.params.id)
    service.removeStock(req.user.databaseName, stockId)
        .then((stock: StockBalance) => sendResponse(res, "Successfully deleted"))
        .catch(next)
}

//routes
router.get("/sync", getAllStock)
router.get('/find', getStockByItemId)
router.put('/adjustment', stockAdjustment)
router.put('/update', updateManyStocks)
// router.post('/create', createManyStocks)
// router.delete('/:id', removeStock)
export = router