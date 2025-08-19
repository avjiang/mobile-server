import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./stock-movement.service"
import { StockMovement } from "@prisma/tenant-prisma"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { CreateStockChecksRequestBody, UpdateStockChecksRequestBody } from "./stock-movement.request"
import { AuthRequest } from "src/middleware/auth-request"

const router = express.Router()

let getAllStockCheck = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated')
    }

    service.getAllStockCheck(req.user.databaseName)
        .then((stockChecks: StockMovement[]) => sendResponse(res, stockChecks))
        .catch(next)
}

let getStockChecksByItemIdAndOutlet = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated')
    }

    const outletId = parseInt(req.query.outletId as string)
    const itemId = req.query.itemId as string
    if (!validator.isNumeric(itemId)) {
        throw new RequestValidateError('Item ID format incorrect')
    }

    service.getStockChecksByItemIdAndOutlet(req.user.databaseName, parseInt(itemId), outletId)
        .then((stockCheck: StockMovement[]) => sendResponse(res, stockCheck))
        .catch(next)
}

let createManyStockChecks = (req: NetworkRequest<CreateStockChecksRequestBody>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated')
    }

    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }

    const requestBody = req.body

    service.createManyStockChecks(req.user.databaseName, requestBody.stockChecks)
        .then((insertedRecordCount: number) => {
            var message = `Successfully created ${insertedRecordCount} stockChecks`
            if (insertedRecordCount === 1) {
                message = message.substring(0, message.length - 1)
            }
            sendResponse(res, message)
        })
        .catch(next)
}

let updateManyStockChecks = (req: NetworkRequest<UpdateStockChecksRequestBody>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated')
    }

    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }

    const requestBody = req.body

    requestBody.stockChecks.forEach(stockCheck => {
        if (!stockCheck.id) {
            throw new RequestValidateError('Update failed: one of the stock check [id] not found')
        }

        if (stockCheck.id == 0) {
            throw new RequestValidateError('Update failed: one of the stock check [id] cannot be 0')
        }
    });

    service.updateManyStockChecks(req.user.databaseName, requestBody.stockChecks)
        .then(() => sendResponse(res, "Successfully updated"))
        .catch(next)
}

//routes
router.get("/", getAllStockCheck)
router.get('/find', getStockChecksByItemIdAndOutlet)
// router.post('/create', createManyStockChecks)
router.put('/update', updateManyStockChecks)
export = router