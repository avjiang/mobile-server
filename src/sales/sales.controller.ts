import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./sales.service"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { SalesAnalyticResponseBody } from "./sales.response"
import { CalculateSalesDto, CompleteNewSalesRequest, CompleteSalesRequest, SalesCreationRequest, SalesRequestBody } from "./sales.request"
import { validateDates } from "../helpers/dateHelper"
import { Sales } from "@prisma/client"

const router = express.Router()

const getAll = (req: Request, res: Response, next: NextFunction) => {
    service.getAll()
        .then((salesArray: Sales[]) => sendResponse(res, salesArray))
        .catch(next)
}

const getById = (req: Request, res: Response, next: NextFunction) => {
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }
    const itemId: number = parseInt(req.params.id)
    service.getById(itemId)
        .then((sales: Sales) => sendResponse(res, sales))
        .catch(next)
}

const create = (req: NetworkRequest<SalesCreationRequest>, res: Response, next: NextFunction) => {
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

    service.create(salesBody)
        .then((sales: Sales) => sendResponse(res, sales))
        .catch(next)
}

const completeNewSales = (req: NetworkRequest<CompleteNewSalesRequest>, res: Response, next: NextFunction) => {
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

    service.completeNewSales(sales, payments)
        .then((sales: Sales) => sendResponse(res, sales))
        .catch(next)
}

const completeSales = (req: NetworkRequest<CompleteSalesRequest>, res: Response, next: NextFunction) => {
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

    service.completeSales(salesId, payments)
        .then((sales: Sales) => sendResponse(res, sales))
        .catch(next)
}

const calculateSales = (req: NetworkRequest<CalculateSalesDto>, res: Response, next: NextFunction) => {
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }

    const requestBody = req.body
    if (!requestBody) {
        throw new RequestValidateError('Data missing')
    }

    service.calculateSales(requestBody)
        .then((sales: CalculateSalesDto) => sendResponse(res, sales))
        .catch(next)
}

const update = (req: NetworkRequest<SalesRequestBody>, res: Response, next: NextFunction) => {
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

    service.update(salesBody)
        .then(() => sendResponse(res, "Successfully updated"))
        .catch(next)
}

const remove = (req: Request, res: Response, next: NextFunction) => {
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }

    const salesId: number = parseInt(req.params.id)
    service.remove(salesId)
        .then(() => sendResponse(res, "Successfully deleted"))
        .catch(next)
}

const getTotalSalesData = (req: Request, res: Response, next: NextFunction) => {
    const { startDate, endDate } = req.query
    if (!startDate || !endDate) {
        return new RequestValidateError('startDate and endDate are required')
    }

    validateDates(startDate as string, endDate as string)

    service.getTotalSalesData(startDate as string, endDate as string)
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
router.get("/", getAll)
router.get('/getTotalSalesData', getTotalSalesData)
// router.get('/getTotalProfit', getTotalProfit)
// router.get('/getTotalRevenue', getTotalRevenue)
router.get('/:id', getById)
router.post('/create', create)
router.post('/calculate', calculateSales)
router.post('/completeNewSales', completeNewSales)
router.post('/completeSales', completeSales)
router.put('/update', update)
router.delete('/:id', remove)
export = router