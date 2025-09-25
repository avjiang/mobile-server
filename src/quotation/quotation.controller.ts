import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./quotation.service"
import { Quotation, StockBalance } from "../../prisma/client/generated/client"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { AuthRequest } from "src/middleware/auth-request"
import { SyncRequest } from "src/item/item.request"
import { CreateQuotationRequestBody, QuotationInput } from "./quotation.request"

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
        .then(({ quotations, total, serverTimestamp }) => sendResponse(res, { data: quotations, total, serverTimestamp }))
        .catch(next);
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
        .then(({ quotations, total, serverTimestamp }) => {
            sendResponse(res, { data: quotations, total, serverTimestamp });
        })
        .catch(next);
}

let getById = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }
    const quotationId: number = parseInt(req.params.id)
    service.getById(quotationId, req.user.databaseName,)
        .then((quotation: Quotation) => sendResponse(res, quotation))
        .catch(next)
}

let createMany = (req: NetworkRequest<CreateQuotationRequestBody>, res: Response, next: NextFunction) => {
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

let cancel = (req: NetworkRequest<QuotationInput>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    const quotation = req.body
    if (!quotation) {
        throw new RequestValidateError('Update failed: data missing')
    }
    if (!quotation.id) {
        throw new RequestValidateError('Update failed: [id] not found')
    }
    service.cancel(quotation, req.user.databaseName)
        .then((updatedQuotation: any) => sendResponse(res, updatedQuotation))
        .catch(next)
}

let update = (req: NetworkRequest<QuotationInput>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    const quotation = req.body
    if (!quotation) {
        throw new RequestValidateError('Update failed: data missing')
    }
    if (!quotation.id) {
        throw new RequestValidateError('Update failed: [id] not found')
    }
    service.update(quotation, req.user.databaseName)
        .then((updatedQuotation: any) => sendResponse(res, updatedQuotation))
        .catch(next)
}

let deleteQuotation = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }
    const quotationId: number = parseInt(req.params.id)
    service.deleteQuotation(quotationId, req.user.databaseName)
        .then((message: string) => sendResponse(res, { message }))
        .catch(next)
}

//routes
router.get("/sync", getAll)
router.get('/dateRange', getAllByDateRange)
router.get('/:id', getById)
router.post('/cancel', cancel)
router.post('/create', createMany)
router.put('/update', update)
router.delete('/:id', deleteQuotation)
export = router