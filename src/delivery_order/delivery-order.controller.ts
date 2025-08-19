import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./delivery-order.service"
import { DeliveryOrder, StockBalance } from "../../prisma/client/generated/client"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { AuthRequest } from "src/middleware/auth-request"
import { SyncRequest } from "src/item/item.request"
import { CreateDeliveryOrderRequestBody, DeliveryOrderInput } from "./delivery-order.request"

const router = express.Router()

let getAll = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    const { outletId, skip, take, lastSyncTimestamp } = req.query;

    // Validate outletId
    if (!outletId || !validator.isNumeric(outletId as string)) {
        throw new RequestValidateError('Valid outletId is required');
    }

    const skipNum = skip && validator.isNumeric(skip as string) ? parseInt(skip as string) : 0;
    const takeNum = take && validator.isNumeric(take as string) ? parseInt(take as string) : 100;

    const syncRequest = {
        outletId: outletId as string,
        skip: skipNum,
        take: takeNum,
        lastSyncTimestamp: lastSyncTimestamp as string
    };
    service
        .getAll(req.user.databaseName, syncRequest)
        .then(({ deliveryOrders, total, serverTimestamp }) => sendResponse(res, { data: deliveryOrders, total, serverTimestamp }))
        .catch(next);
}

let getById = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }
    const deliveryOrderId: number = parseInt(req.params.id)
    service.getById(deliveryOrderId, req.user.databaseName,)
        .then((deliveryOrder: DeliveryOrder) => sendResponse(res, deliveryOrder))
        .catch(next)
}

const getAllByDateRange = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    const { outletId, skip, take, lastSyncTimestamp, startDate, endDate } = req.query;

    // Validate outletId
    if (!outletId || !validator.isNumeric(outletId as string)) {
        throw new RequestValidateError('Valid outletId is required');
    }
    // Validate date parameters
    if (!startDate || !endDate) {
        throw new RequestValidateError('Both startDate and endDate are required');
    }
    try {
        // Basic date format validation
        const parsedStartDate = new Date(startDate as string);
        const parsedEndDate = new Date(endDate as string);

        if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
            throw new Error('Invalid date format');
        }
        if (parsedEndDate < parsedStartDate) {
            throw new Error('endDate cannot be before startDate');
        }
    } catch (error) {
        throw new RequestValidateError(`Date validation error`);
    }
    const skipNum = skip && validator.isNumeric(skip as string) ? parseInt(skip as string) : 0;
    const takeNum = take && validator.isNumeric(take as string) ? parseInt(take as string) : 100;
    const dateRangeRequest = {
        outletId: outletId as string,
        skip: skipNum,
        take: takeNum,
        lastSyncTimestamp: lastSyncTimestamp as string,
        startDate: startDate as string,
        endDate: endDate as string
    };
    service.getByDateRange(req.user.databaseName, dateRangeRequest)
        .then(({ deliveryOrders, total, serverTimestamp }) => {
            sendResponse(res, { data: deliveryOrders, total, serverTimestamp });
        })
        .catch(next);
}

let createMany = (req: NetworkRequest<CreateDeliveryOrderRequestBody>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    const requestBody = req.body
    service.createMany(req.user.databaseName, requestBody)
        .then((response) => {
            sendResponse(res, response)
        })
        .catch(next)
}

let update = (req: NetworkRequest<DeliveryOrderInput>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    const deliveryOrder = req.body
    if (!deliveryOrder) {
        throw new RequestValidateError('Update failed: data missing')
    }
    if (!deliveryOrder.id) {
        throw new RequestValidateError('Update failed: [id] not found')
    }
    service.update(deliveryOrder, req.user.databaseName)
        .then((updatedDeliveryOrder: any) => sendResponse(res, updatedDeliveryOrder))
        .catch(next)
}

//routes
router.get("/sync", getAll)
router.get('/dateRange', getAllByDateRange)
router.get('/:id', getById)
router.post('/create', createMany)
router.put('/update', update)
export = router