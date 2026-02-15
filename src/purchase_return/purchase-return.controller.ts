import express, { NextFunction, Response } from "express"
import validator from "validator"
import service from "./purchase-return.service"
import { PurchaseReturn } from "../../prisma/client/generated/client"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { AuthRequest } from "src/middleware/auth-request"
import { CancelPurchaseReturnInput, CreatePurchaseReturnRequestBody, PurchaseReturnInput } from "./purchase-return.request"

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
        .then(({ purchaseReturns, total, serverTimestamp }) => sendResponse(res, { data: purchaseReturns, total, serverTimestamp }))
        .catch(next);
}

const getAllByDateRange = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    const { outletId, skip, take, startDate, endDate } = req.query;

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
    const takeNum = Math.min(
        take && validator.isNumeric(take as string) ? parseInt(take as string) : 100,
        500
    );
    const dateRangeRequest = {
        outletId: outletId as string,
        skip: skipNum,
        take: takeNum,
        startDate: startDate as string,
        endDate: endDate as string
    };
    service.getByDateRange(req.user.databaseName, dateRangeRequest)
        .then(({ purchaseReturns, total, serverTimestamp }) => {
            sendResponse(res, { data: purchaseReturns, total, serverTimestamp });
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
    const purchaseReturnId: number = parseInt(req.params.id)
    service.getById(purchaseReturnId, req.user.databaseName)
        .then((purchaseReturn: PurchaseReturn) => sendResponse(res, purchaseReturn))
        .catch(next)
}

const getByInvoiceId = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.invoiceId)) {
        throw new RequestValidateError('Invoice ID format incorrect')
    }
    const invoiceId: number = parseInt(req.params.invoiceId)
    service.getByInvoiceId(invoiceId, req.user.databaseName)
        .then(({ purchaseReturns }) => sendResponse(res, { data: purchaseReturns }))
        .catch(next)
}

let createMany = (req: NetworkRequest<CreatePurchaseReturnRequestBody>, res: Response, next: NextFunction) => {
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

let update = (req: NetworkRequest<PurchaseReturnInput>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    const purchaseReturn = req.body
    if (!purchaseReturn) {
        throw new RequestValidateError('Update failed: data missing')
    }
    if (!purchaseReturn.id) {
        throw new RequestValidateError('Update failed: [id] not found')
    }
    service.update(purchaseReturn, req.user.databaseName)
        .then((updatedPurchaseReturn: any) => sendResponse(res, updatedPurchaseReturn))
        .catch(next)
}

let cancelPurchaseReturn = (req: NetworkRequest<CancelPurchaseReturnInput>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }
    const purchaseReturnId: number = parseInt(req.params.id)
    const cancelData: CancelPurchaseReturnInput = {
        cancelReason: req.body?.cancelReason,
        performedBy: req.body?.performedBy
    }
    service.cancel(purchaseReturnId, cancelData, req.user.databaseName)
        .then((updatedPurchaseReturn: any) => sendResponse(res, updatedPurchaseReturn))
        .catch(next)
}

let deletePurchaseReturn = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }
    const purchaseReturnId: number = parseInt(req.params.id)
    const performedBy = req.body?.performedBy || req.user.username || undefined
    service.deletePurchaseReturn(purchaseReturnId, req.user.databaseName, performedBy)
        .then((message: string) => sendResponse(res, { message }))
        .catch(next)
}

//routes
router.get("/sync", getAll)
router.get('/dateRange', getAllByDateRange)
router.get('/byInvoice/:invoiceId', getByInvoiceId)
router.get('/:id', getById)
router.post('/create', createMany)
router.put('/update', update)
router.put('/cancel/:id', cancelPurchaseReturn)
router.delete('/:id', deletePurchaseReturn)

export = router
