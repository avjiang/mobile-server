import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./sales.service"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { CalculateSalesResponseBody, SalesResponseBody } from "./sales.response"
import { CalculateSalesRequestBody, SalesCreationRequestBody, SalesRequestBody } from "./sales.request"

const router = express.Router()

let getAll = (req: Request, res: Response, next: NextFunction) => {
    service.getAll()
        .then((salesArray: SalesResponseBody[]) => sendResponse(res, salesArray))
        .catch(next)
}

let getById = (req: Request, res: Response, next: NextFunction) => {
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }
    const itemId: number = parseInt(req.params.id)
    service.getById(itemId)
        .then((sales: SalesResponseBody) => sendResponse(res, sales))
        .catch(next)
}

// let create = (req: NetworkRequest<SalesRequestBody>, res: Response, next: NextFunction) => {
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

//     service.create(salesBody)
//         .then((sales: SalesResponseBody) => sendResponse(res, sales))
//         .catch(next)
// }

let create = (req: NetworkRequest<SalesCreationRequestBody>, res: Response, next: NextFunction) => {
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
        .then((sales: SalesResponseBody) => sendResponse(res, sales))
        .catch(next)
}


let calculateSales = (req: NetworkRequest<CalculateSalesRequestBody>, res: Response, next: NextFunction) => {
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }

    const requestBody = req.body
    if (!requestBody) {
        throw new RequestValidateError('Data missing')
    }

    service.calculateSales(requestBody)
    .then((sales: CalculateSalesResponseBody) => sendResponse(res, sales))
    .catch(next)
}

let update = (req: NetworkRequest<SalesRequestBody>, res: Response, next: NextFunction) => {
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

let remove = (req: Request, res: Response, next: NextFunction) => {
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }

    const salesId: number = parseInt(req.params.id)
    service.remove(salesId)
        .then(() => sendResponse(res, "Successfully deleted"))
        .catch(next)
}

//routes
router.get("/", getAll)
router.get('/:id', getById)
router.post('/create', create)
router.post('/calculate', calculateSales)
router.put('/update', update)
router.delete('/:id', remove)
export = router