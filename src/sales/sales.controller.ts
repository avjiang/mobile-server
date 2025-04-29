import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./sales.service"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { SalesAnalyticResponseBody } from "./sales.response"
import { CalculateSalesDto, CompleteNewSalesRequest, CompleteSalesRequest, SalesCreationRequest, SalesRequestBody } from "./sales.request"
import { validateDates } from "../helpers/dateHelper"
import { Prisma, Sales } from "@prisma/client"
import { AuthRequest } from "src/middleware/auth-request"

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
    if (!validator.isNumeric(req.params.outletid)) {
        throw new RequestValidateError('ID format incorrect')
    }
    const outletID: number = parseInt(req.params.outletid)
    service.getAll(req.user.databaseName, outletID)
        .then((salesArray: SelectedSales[]) => sendResponse(res, salesArray))
        .catch(next)
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

const create = (req: NetworkRequest<SalesCreationRequest>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }

    const salesBody = req.body
    if (!salesBody) {
        throw new RequestValidateError('Create failed: data missing')
    }

    const sales = salesBody.sales
    if (!sales) {
        throw new RequestValidateError('Create failed: sales data missing')
    }

    service.create(req.user.databaseName, salesBody)
        .then((sales: Sales) => sendResponse(res, sales))
        .catch(next)
}

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

const completeSales = (req: NetworkRequest<CompleteSalesRequest>, res: Response, next: NextFunction) => {
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

    const salesId = requestBody.salesId
    if (salesId == 0) {
        throw new RequestValidateError('sales ID cannot be 0')
    }

    const payments = requestBody.payments
    if (payments.length > 0) {
        for (const payment of payments) {
            if (payment.salesId != salesId) {
                throw new RequestValidateError('payment has different sales ID')
            }
        }
    }

    service.completeSales(req.user.databaseName, salesId, payments)
        .then((sales: Sales) => sendResponse(res, sales))
        .catch(next)
}

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
    const { startDate, endDate } = req.query
    if (!startDate || !endDate) {
        return new RequestValidateError('startDate and endDate are required')
    }
    validateDates(startDate as string, endDate as string)

    service.getTotalSalesData(req.user.databaseName, startDate as string, endDate as string)
        .then((salesData: SalesAnalyticResponseBody) => sendResponse(res, salesData))
        .catch(next)
}

// let getTotalProfit = (req: Request, res: Response, next: NextFunction) => {
//     const { startDate, endDate } = req.query
//     if (!startDate || !endDate) {
//         return new RequestValidateError('startDate and endDate are required' )
//       }

//     if (!validator.isISO8601(startDate as string)) {
//         throw new RequestValidateError('startDate is not a valid date')
//     }

//     if (!validator.isISO8601(endDate as string)) {
//         throw new RequestValidateError('endDate is not a valid date')
//     }
//     service.getTotalProfit(startDate as string, endDate as string)
//         .then((salesData: SalesAnalyticResponseBody) => sendResponse(res, salesData))
//         .catch(next)
// }

// let getTotalRevenue = (req: Request, res: Response, next: NextFunction) => {
//     const { startDate, endDate } = req.query
//     if (!startDate || !endDate) {
//         return new RequestValidateError('startDate and endDate are required' )
//       }

//     if (!validator.isISO8601(startDate as string)) {
//         throw new RequestValidateError('startDate is not a valid date')
//     }

//     if (!validator.isISO8601(endDate as string)) {
//         throw new RequestValidateError('endDate is not a valid date')
//     }
//     service.getTotalRevenue(startDate as string, endDate as string)
//         .then((salesData: SalesAnalyticResponseBody) => sendResponse(res, salesData))
//         .catch(next)
// }

//routes
router.get('/getTotalSalesData', getTotalSalesData)
router.get('/:id', getById)
router.get('/outlet/:outletid', getAll)
router.post('/create', create)
router.post('/calculate', calculateSales)
router.post('/completeNewSales', completeNewSales)
router.post('/completeSales', completeSales)
router.put('/update', update)
router.delete('/:id', remove)
// router.get('/getTotalProfit', getTotalProfit)
// router.get('/getTotalRevenue', getTotalRevenue)
export = router