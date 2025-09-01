import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./invoice_settlement.service"
import { Invoice, StockBalance } from "../../prisma/client/generated/client"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { AuthRequest } from "src/middleware/auth-request"
import { SyncRequest } from "src/item/item.request"
import { CreateInvoiceSettlementRequestBody, InvoiceSettlementInput } from "./invoice_settlement.request"

const router = express.Router()

const createSettlement = (req: NetworkRequest<CreateInvoiceSettlementRequestBody>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    const requestBody = req.body
    service.createSettlement(req.user.databaseName, requestBody)
        .then((response) => {
            sendResponse(res, response)
        })
        .catch(next)
}

const getAllSettlements = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    const { skip, take, lastSyncTimestamp, startDate, endDate } = req.query;

    const skipNum = skip && validator.isNumeric(skip as string) ? parseInt(skip as string) : 0;
    const takeNum = take && validator.isNumeric(take as string) ? parseInt(take as string) : 100;

    const request = {
        skip: skipNum,
        take: takeNum,
        lastSyncTimestamp: lastSyncTimestamp as string,
        startDate: startDate as string,
        endDate: endDate as string
    };
    service.getSettlements(req.user.databaseName, request)
        .then(({ settlements, total, serverTimestamp }) => {
            sendResponse(res, { data: settlements, total, serverTimestamp });
        })
        .catch(next);
}

const getAllSettlementsByDateRange = (req: AuthRequest, res: Response, next: NextFunction) => {
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
        .then(({ settlements, total, serverTimestamp }) => {
            sendResponse(res, { data: settlements, total, serverTimestamp });
        })
        .catch(next);
}

const getSettlementById = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }
    const settlementId: number = parseInt(req.params.id)
    service.getSettlementById(settlementId, req.user.databaseName)
        .then((settlement) => sendResponse(res, settlement))
        .catch(next)
}

const updateSettlement = (req: NetworkRequest<InvoiceSettlementInput>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    const settlement = req.body
    if (!settlement) {
        throw new RequestValidateError('Update failed: data missing')
    }
    if (!settlement.id) {
        throw new RequestValidateError('Update failed: [id] not found')
    }
    service.updateSettlement(settlement, req.user.databaseName)
        .then((updatedSettlement: any) => sendResponse(res, updatedSettlement))
        .catch(next)
}

// Settlement routes
router.get('/sync', getAllSettlements)
router.get('/dateRange', getAllSettlementsByDateRange)
router.get('/:id', getSettlementById)
router.post('/create', createSettlement)
router.put('/update', updateSettlement)

export = router