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
import { AuthRequest } from "../middleware/auth-request"

const router = express.Router()

let getAll = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    service.getAll(req.user.databaseName)
        .then((items: ItemDto[]) => sendResponse(res, items))
        .catch(next)
}

let getAllBySupplierId = (req: AuthRequest, res: Response, next: NextFunction) => {
    const { supplierId } = req.query

    if (!supplierId) {
        return new RequestValidateError('supplierd is required')
    }
    if (!validator.isNumeric(supplierId as string)) {
        throw new RequestValidateError('Supplier ID format incorrect')
    }
    if (!req.user) {
        throw new RequestValidateError('User not authenticated')
    }
    const supplierIdParam = Number(supplierId)
    service.getAllBySupplierId(req.user.databaseName, supplierIdParam)
        .then((items: ItemDto[]) => sendResponse(res, items))
        .catch(next)
}

let getAllByCategoryId = (req: AuthRequest, res: Response, next: NextFunction) => {
    const { categoryId } = req.query

    if (!categoryId) {
        return new RequestValidateError('Category ID is required')
    }
    if (!validator.isNumeric(categoryId as string)) {
        throw new RequestValidateError('Category ID format incorrect')
    }
    if (!req.user) {
        throw new RequestValidateError('User not authenticated')
    }
    const categoryIdParam = Number(categoryId)
    service.getAllByCategoryId(req.user.databaseName, categoryIdParam)
        .then((items: ItemDto[]) => sendResponse(res, items))
        .catch(next)
}

let getById = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }
    if (!req.user) {
        throw new RequestValidateError('User not authenticated')
    }
    const itemId: number = parseInt(req.params.id)
    service.getById(req.user?.databaseName, itemId)
        .then((item: ItemDto) => sendResponse(res, item))
        .catch(next)
}

let createMany = (req: NetworkRequest<CreateItemsRequestBody>, res: Response, next: NextFunction) => {
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    // Transform with enableImplicitConversion to allow transformation for nested objects
    const requestBody = plainToInstance(
        CreateItemsRequestBody,
        req.body,
        { excludeExtraneousValues: true }
    );
    service.createMany(req.user.databaseName, requestBody.items)
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
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    const item = req.body

    if (!item) {
        throw new RequestValidateError('Update failed: data missing')
    }
    if (!item.id) {
        throw new RequestValidateError('Update failed: [id] not found')
    }

    service.update(req.user.databaseName, item)
        .then((item: Item) => sendResponse(res, "Successfully updated"))
        .catch(next)
}

let remove = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    const itemId: number = parseInt(req.params.id)
    service.remove(req.user.databaseName, itemId)
        .then(() => sendResponse(res, "Successfully deleted"))
        .catch(next)
}

let getSoldItemRanking = (req: AuthRequest, res: Response, next: NextFunction) => {
    const { startDate, endDate } = req.query
    if (!startDate || !endDate) {
        return new RequestValidateError('startDate and endDate are required')
    }
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    validateDates(startDate as string, endDate as string)

    service.getSoldItemRanking(req.user.databaseName, startDate as string, endDate as string)
        .then((itemSoldObjects: ItemSoldRankingResponseBody) => sendResponse(res, itemSoldObjects))
        .catch(next)
}

let getLowStockItemCount = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
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
    service.getLowStockItemCount(req.user.databaseName, lowStockQuantityParam, isIncludedZeroStockParam)
        .then((lowStockItemCount: number) => sendResponse(res, lowStockItemCount))
        .catch(next)
}

let getLowStockItems = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
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
    service.getLowStockItems(req.user.databaseName, lowStockQuantityParam, isIncludedZeroStockParam)
        .then((lowStockItems: ItemDto[]) => sendResponse(res, lowStockItems))
        .catch(next)
}

//routes
router.get("/", getAll)
router.get("/getBySupplierId", getAllBySupplierId)
router.get("/getByCategoryId", getAllByCategoryId)
router.get("/getLowStockItemCount", getLowStockItemCount)
router.get("/getLowStockItems", getLowStockItems)
router.get("/getItemSoldRanking", getSoldItemRanking)
router.get('/:id', getById)
router.post('/create', createMany)
router.put('/update', update)
router.delete('/:id', remove)
export = router