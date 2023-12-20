import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./item.service"
import { Item } from "@prisma/client"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { CreateItemBody, CreateItemsRequestBody, StockItem } from "./item.request"

const router = express.Router()

let getAll = (req: Request, res: Response, next: NextFunction) => {
    service.getAll()
        .then((items: Item[]) => sendResponse(res, items))
        .catch(next)
}

let getById = (req: Request, res: Response, next: NextFunction) => {
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }
    const itemId: number = parseInt(req.params.id)
    service.getById(itemId)
        .then((item: Item) => sendResponse(res, item))
        .catch(next)
}

let createMany = (req: NetworkRequest<CreateItemsRequestBody>, res: Response, next: NextFunction) => {
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }

    const requestBody = req.body

    service.createMany(requestBody.items)
    .then((insertedRecordCount: number) => {
        var message = `Successfully created ${insertedRecordCount} items`
        if (insertedRecordCount === 1) {
            message = message.substring(0, message.length-1)
        }
        sendResponse(res, message)
    })
    .catch(next)
}

let update = (req: NetworkRequest<Item>, res: Response, next: NextFunction) => {
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    
    const item = req.body

    if (!item) {
        throw new RequestValidateError('Update failed: data missing')
    }

    if (!item.id) {
        throw new RequestValidateError('Update failed: [id] not found')
    }
    
    service.update(item)
        .then((item: Item) => sendResponse(res, "Successfully updated"))
        .catch(next)
}

let remove = (req: Request, res: Response, next: NextFunction) => {
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }

    const itemId: number = parseInt(req.params.id)
    service.remove(itemId)
        .then(() => sendResponse(res, "Successfully deleted"))
        .catch(next)
}

//routes
router.get("/", getAll)
router.get('/:id', getById)
router.post('/create', createMany)
router.put('/update', update)
router.delete('/:id', remove)
export = router