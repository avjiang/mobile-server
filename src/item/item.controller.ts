import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./item.service"
import { Item } from "@prisma/client"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { CreateItemsRequestBody } from "./item.request"
import { ItemDto, ItemSoldRankingResponseBody } from "./item.response"
import { parseBoolean } from "../helpers/booleanHelper"
import { validateDates } from "../helpers/dateHelper"
import { plainToClass, plainToInstance } from "class-transformer";

const router = express.Router()

let getAll = (req: Request, res: Response, next: NextFunction) => {
    service.getAll()
        .then((items: ItemDto[]) => sendResponse(res, items))
        .catch(next)
}

let getById = (req: Request, res: Response, next: NextFunction) => {
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }
    const itemId: number = parseInt(req.params.id)
    service.getById(itemId)
        .then((item: ItemDto) => sendResponse(res, item))
        .catch(next)
}

let createMany = (req: NetworkRequest<CreateItemsRequestBody>, res: Response, next: NextFunction) => {
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }

    // Transform with enableImplicitConversion to allow transformation for nested objects
    const requestBody = plainToInstance(
        CreateItemsRequestBody,
        req.body,
        { excludeExtraneousValues: true }
    );

    service.createMany(requestBody.items)
        .then((insertedRecordCount: number) => {
            var message = `Successfully created ${insertedRecordCount} items`
            if (insertedRecordCount === 1) {
                message = message.substring(0, message.length - 1)
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

let getSoldItemRanking = (req: Request, res: Response, next: NextFunction) => {
    const { startDate, endDate } = req.query
    if (!startDate || !endDate) {
        return new RequestValidateError('startDate and endDate are required')
    }

    validateDates(startDate as string, endDate as string)

    service.getSoldItemRanking(startDate as string, endDate as string)
        .then((itemSoldObjects: ItemSoldRankingResponseBody) => sendResponse(res, itemSoldObjects))
        .catch(next)
}

let getLowStockItemCount = (req: Request, res: Response, next: NextFunction) => {
    const { lowStockQuantity, isIncludedZeroStock } = req.query

    if (!lowStockQuantity || !isIncludedZeroStock) {
        return new RequestValidateError('startDate and endDate are required')
    }
    if (!validator.isNumeric(lowStockQuantity as string)) {
        throw new RequestValidateError('lowStockQuantity is not a number')
    }

    if (!validator.isBoolean(isIncludedZeroStock as string)) {
        throw new RequestValidateError('isIncludedZeroStock is not a valid boolean')
    }

    const lowStockQuantityParam = Number(lowStockQuantity)
    const isIncludedZeroStockParam = parseBoolean(isIncludedZeroStock as string)
    service.getLowStockItemCount(lowStockQuantityParam, isIncludedZeroStockParam)
        .then((lowStockItemCount: number) => sendResponse(res, lowStockItemCount))
        .catch(next)
}

let getLowStockItems = (req: Request, res: Response, next: NextFunction) => {
    const { lowStockQuantity, isIncludedZeroStock } = req.query

    if (!lowStockQuantity || !isIncludedZeroStock) {
        return new RequestValidateError('startDate and endDate are required')
    }
    if (!validator.isNumeric(lowStockQuantity as string)) {
        throw new RequestValidateError('lowStockQuantity is not a number')
    }

    if (!validator.isBoolean(isIncludedZeroStock as string)) {
        throw new RequestValidateError('isIncludedZeroStock is not a valid boolean')
    }

    const lowStockQuantityParam = Number(lowStockQuantity)
    const isIncludedZeroStockParam = parseBoolean(isIncludedZeroStock as string)
    service.getLowStockItems(lowStockQuantityParam, isIncludedZeroStockParam)
        .then((lowStockItems: ItemDto[]) => sendResponse(res, lowStockItems))
        .catch(next)
}

//routes
router.get("/", getAll)
router.get("/getLowStockItemCount", getLowStockItemCount)
router.get("/getLowStockItems", getLowStockItems)
router.get("/getItemSoldRanking", getSoldItemRanking)
router.get('/:id', getById)
router.post('/create', createMany)
router.put('/update', update)
router.delete('/:id', remove)
export = router