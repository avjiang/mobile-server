import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./invoice.service"
import { Invoice, StockBalance } from "@prisma/client"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { AuthRequest } from "src/middleware/auth-request"
import { SyncRequest } from "src/item/item.request"
import { CreateInvoiceRequestBody, InvoiceInput } from "./invoice.request"

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
        .then(({ invoices, total, serverTimestamp }) => sendResponse(res, { data: invoices, total, serverTimestamp }))
        .catch(next);
}

let getById = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }
    const invoiceId: number = parseInt(req.params.id)
    service.getById(invoiceId, req.user.databaseName,)
        .then((invoice: Invoice) => sendResponse(res, invoice))
        .catch(next)
}

let createMany = (req: NetworkRequest<CreateInvoiceRequestBody>, res: Response, next: NextFunction) => {
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

let update = (req: NetworkRequest<InvoiceInput>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    const invoice = req.body
    if (!invoice) {
        throw new RequestValidateError('Update failed: data missing')
    }
    if (!invoice.id) {
        throw new RequestValidateError('Update failed: [id] not found')
    }
    service.update(invoice, req.user.databaseName)
        .then((updatedInvoice: any) => sendResponse(res, updatedInvoice))
        .catch(next)
}

//routes
router.get("/sync", getAll)
router.get('/:id', getById)
router.post('/create', createMany)
router.put('/update', update)
export = router