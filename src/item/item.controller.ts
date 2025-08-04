import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./item.service"
import { Item } from "../../prisma/client"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { CreateItemsRequestBody, SyncRequest } from "./item.request"
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
    const syncRequest: SyncRequest = {
        lastSyncTimestamp: req.query.lastSyncTimestamp as string,
        lastVersion: req.query.lastVersion ? parseInt(req.query.lastVersion as string) : undefined,
        skip: req.query.skip ? parseInt(req.query.skip as string) : undefined,
        take: req.query.take ? parseInt(req.query.take as string) : undefined,
    };
    service
        .getAll(req.user.databaseName, syncRequest)
        .then(({ items, total, serverTimestamp }) => {
            sendResponse(res, { data: items, total, serverTimestamp });
        })
        .catch(next);
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
        .then((items: any[]) => sendResponse(res, items))
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
        .then((items: any[]) => sendResponse(res, items))
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
        .then((item) => sendResponse(res, item))
        .catch(next)
}

let createMany = (req: NetworkRequest<CreateItemsRequestBody>, res: Response, next: NextFunction) => {
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    const requestBody = plainToInstance(
        CreateItemsRequestBody,
        req.body,
        { excludeExtraneousValues: true }
    );
    service.createMany(req.user.databaseName, requestBody.items)
        .then((insertedItems: Item[]) => {
            // var message = `Successfully created ${insertedItems} items`
            // if (insertedRecordCount === 1) {
            //     message = message.substring(0, message.length - 1)
            // }
            sendResponse(res, insertedItems)
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
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    const { sessionID } = req.query
    const sessionIdNum = typeof sessionID === 'string' && validator.isNumeric(sessionID) ? parseInt(sessionID) : undefined
    if (sessionIdNum === undefined) {
        throw new RequestValidateError('sessionID is required and must be a number')
    }
    service.getSoldItemsBySessionId(req.user.databaseName, sessionIdNum)
        .then((itemSoldObjects) => {
            const response = {
                ...itemSoldObjects,
            };
            sendResponse(res, response);
        })
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
    // service.getLowStockItems(req.user.databaseName, lowStockQuantityParam, isIncludedZeroStockParam)
    //     .then((lowStockItems: ItemDto[]) => sendResponse(res, lowStockItems))
    //     .catch(next)
    service.getLowStockItems(req.user.databaseName, lowStockQuantityParam, isIncludedZeroStockParam)
        .then((lowStockItems: Item[]) => sendResponse(res, lowStockItems))
        .catch(next)
}

//routes
router.get("/sync", getAll)
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