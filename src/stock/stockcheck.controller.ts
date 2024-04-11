import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./stockcheck.service"
import { StockCheck } from "@prisma/client"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { CreateStockChecksRequestBody, UpdateStockChecksRequestBody } from "./stockcheck.request"

const router = express.Router()

let getAllStockCheck = (req: Request, res: Response, next: NextFunction) => {
    service.getAllStockCheck()
        .then((stockChecks: StockCheck[]) => sendResponse(res, stockChecks))
        .catch(next)
}

let getStockChecksByItemCodeAndOutlet = (req: Request, res: Response, next: NextFunction) => {
    const outletId = parseInt(req.query.outletId as string)
    const itemCode = req.query.itemCode as string
    if (isNaN(outletId)) {
        throw new RequestValidateError('Outlet ID format incorrect')
    }

    if (typeof itemCode !== 'string') {
        throw new RequestValidateError('Item Code invalid')
    }
    service.getStockChecksByItemCodeAndOutlet(itemCode, outletId)
        .then((stockCheck: StockCheck[]) => sendResponse(res, stockCheck))
        .catch(next)
}

let createManyStockChecks = (req: NetworkRequest<CreateStockChecksRequestBody>, res: Response, next: NextFunction) => {
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }

    const requestBody = req.body

    service.createManyStockChecks(requestBody.stockChecks)
    .then((insertedRecordCount: number) => {
        var message = `Successfully created ${insertedRecordCount} stockChecks`
        if (insertedRecordCount === 1) {
            message = message.substring(0, message.length-1)
        }
        sendResponse(res, message)
    })
    .catch(next)
}

let updateManyStockChecks = (req: NetworkRequest<UpdateStockChecksRequestBody>, res: Response, next: NextFunction) => {
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
    
    service.updateManyStockChecks(requestBody.stockChecks)
        .then(() => sendResponse(res, "Successfully updated"))
        .catch(next)
}

//routes
router.get("/", getAllStockCheck)
router.get('', getStockChecksByItemCodeAndOutlet)
// router.post('/create', createManyStockChecks)
router.put('/update', updateManyStockChecks)
export = router