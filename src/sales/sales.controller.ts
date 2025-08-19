import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./sales.service"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { SalesAnalyticResponseBody } from "./sales.response"
import { CalculateSalesDto, CompleteNewSalesRequest, CompleteSalesRequest, SalesCreationRequest, SalesRequestBody } from "./sales.request"
import { validateDates } from "../helpers/dateHelper"
import { Payment, Prisma, Sales } from "@tenant-prisma"
import { AuthRequest } from "src/middleware/auth-request"
import { SyncRequest } from "src/item/item.request"

const router = express.Router()

interface SelectedSales {
    id: number;
    businessDate: Date;
    salesType: string;
    customerId: number | null;
    totalAmount: number;
    paidAmount: number;
    paymentMethod: string;
    status: string;
    remark: string;
    customerName: string;
    totalItems: number;
}

const getAll = (req: AuthRequest, res: Response, next: NextFunction) => {
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

    service.getAll(req.user.databaseName, syncRequest)
        .then(({ data, total, serverTimestamp }) => {
            sendResponse(res, { data, total, serverTimestamp });
        })
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
        .then(({ data, total, serverTimestamp }) => {
            sendResponse(res, { data, total, serverTimestamp });
        })
        .catch(next);
}

const getById = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }
    const itemId: number = parseInt(req.params.id)
    service.getById(req.user.databaseName, itemId)
        .then((sales: Sales) => sendResponse(res, sales))
        .catch(next)
}

// const create = (req: NetworkRequest<SalesCreationRequest>, res: Response, next: NextFunction) => {
//     if (!req.user) {
//         throw new RequestValidateError('User not authenticated');
//     }
//     if (Object.keys(req.body).length === 0) {
//         throw new RequestValidateError('Request body is empty')
//     }

//     const salesBody = req.body
//     if (!salesBody) {
//         throw new RequestValidateError('Create failed: data missing')
//     }

//     const sales = salesBody.sales
//     if (!sales) {
//         throw new RequestValidateError('Create failed: sales data missing')
//     }

//     service.create(req.user.databaseName, salesBody)
//         .then((sales: Sales) => sendResponse(res, sales))
//         .catch(next)
// }

const completeNewSales = (req: NetworkRequest<CompleteNewSalesRequest>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    const requestBody = req.body
    if (!requestBody) {
        throw new RequestValidateError('Create failed: data missing')
    }
    const sales = requestBody.sales
    if (!sales) {
        throw new RequestValidateError('Create failed: sales data missing')
    }
    const payments = requestBody.payments
    service.completeNewSales(req.user.databaseName, sales, payments)
        .then((sales: Sales) => sendResponse(res, sales))
        .catch(next)
}

// const completeSales = (req: NetworkRequest<CompleteSalesRequest>, res: Response, next: NextFunction) => {
//     if (!req.user) {
//         throw new RequestValidateError('User not authenticated');
//     }
//     if (Object.keys(req.body).length === 0) {
//         throw new RequestValidateError('Request body is empty')
//     }

//     const requestBody = req.body
//     if (!requestBody) {
//         throw new RequestValidateError('Data missing')
//     }

//     const salesId = requestBody.salesId
//     if (salesId == 0) {
//         throw new RequestValidateError('sales ID cannot be 0')
//     }

//     const payments = requestBody.payments
//     if (payments.length > 0) {
//         for (const payment of payments) {
//             if (payment.salesId != salesId) {
//                 throw new RequestValidateError('payment has different sales ID')
//             }
//         }
//     }

//     service.completeSales(req.user.databaseName, salesId, payments)
//         .then((sales: Sales) => sendResponse(res, sales))
//         .catch(next)
// }

const calculateSales = (req: NetworkRequest<CalculateSalesDto>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }

    const requestBody = req.body
    if (!requestBody) {
        throw new RequestValidateError('Data missing')
    }

    service.calculateSales(req.user.databaseName, requestBody)
        .then((sales: CalculateSalesDto) => sendResponse(res, sales))
        .catch(next)
}

const update = (req: NetworkRequest<SalesRequestBody>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }

    const salesBody = req.body

    if (!salesBody) {
        throw new RequestValidateError('Update failed: data missing')
    }

    if (!salesBody.sales.id) {
        throw new RequestValidateError('Update failed: [id] not found')
    }

    service.update(req.user.databaseName, salesBody)
        .then(() => sendResponse(res, "Successfully updated"))
        .catch(next)
}

const remove = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }

    const salesId: number = parseInt(req.params.id)
    service.remove(req.user.databaseName, salesId)
        .then(() => sendResponse(res, "Successfully deleted"))
        .catch(next)
}

const getTotalSalesData = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    const { sessionID } = req.query
    const sessionIdNum = typeof sessionID === 'string' && validator.isNumeric(sessionID) ? parseInt(sessionID) : undefined
    if (sessionIdNum === undefined) {
        throw new RequestValidateError('sessionID is required and must be a number')
    }
    service.getTotalSalesData(req.user.databaseName, sessionIdNum)
        .then((salesData) => sendResponse(res, salesData))
        .catch(next)
}

const getPartiallyPaidSales = (req: AuthRequest, res: Response, next: NextFunction) => {
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

    const paginationRequest = {
        outletId: outletId as string,
        skip: skipNum,
        take: takeNum,
        lastSyncTimestamp: lastSyncTimestamp as string
    };
    service
        .getPartiallyPaidSales(req.user.databaseName, paginationRequest)
        .then(({ data, total, serverTimestamp }) => {
            sendResponse(res, { data: data, total, serverTimestamp });
        })
        .catch(next);
}

interface AddPaymentRequest {
    salesId: number;
    payments: Payment[];
}

// Add this controller function along with other controller functions
const addPaymentToPartiallyPaidSales = (req: NetworkRequest<AddPaymentRequest>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty');
    }
    const requestBody = req.body;
    if (!requestBody) {
        throw new RequestValidateError('Data missing');
    }
    const salesId = requestBody.salesId;
    if (!salesId || salesId === 0) {
        throw new RequestValidateError('Sales ID is required and cannot be 0');
    }
    const payments = requestBody.payments;
    if (!payments || !Array.isArray(payments) || payments.length === 0) {
        throw new RequestValidateError('At least one payment is required');
    }
    service.addPaymentToPartiallyPaidSales(req.user.databaseName, salesId, payments)
        .then((sales: Sales) => sendResponse(res, sales))
        .catch(next);
}

const voidSales = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect');
    }
    const salesId: number = parseInt(req.params.id);
    service.voidSales(req.user.databaseName, salesId)
        .then((sales: Sales) => sendResponse(res, sales))
        .catch(next);
}

const returnSales = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect');
    }
    const salesId: number = parseInt(req.params.id);
    service.returnSales(req.user.databaseName, salesId)
        .then((sales: Sales) => sendResponse(res, sales))
        .catch(next);
}

const refundSales = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect');
    }
    const salesId: number = parseInt(req.params.id);
    service.refundSales(req.user.databaseName, salesId)
        .then((sales: Sales) => sendResponse(res, sales))
        .catch(next);
}

//routes
router.get('/getTotalSalesData', getTotalSalesData)
router.get('/getPartiallyPaidSales', getPartiallyPaidSales)
router.get('/outlet', getAll)
router.get('/dateRange', getAllByDateRange)
router.get('/:id', getById)
// router.post('/create', create)
router.post('/calculate', calculateSales)
router.post('/completeNewSales', completeNewSales)
// router.post('/completeSales', completeSales)
router.post('/addPayment', addPaymentToPartiallyPaidSales);
router.put('/update', update)
router.put('/void/:id', voidSales)
router.put('/return/:id', returnSales)
router.put('/refund/:id', refundSales)
router.delete('/:id', remove)

export = router