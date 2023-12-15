import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./customer.service"
import { Customer } from "@prisma/client"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { CreateCustomersRequestBody } from "./customer.request"

const router = express.Router()

let getAll = (req: Request, res: Response, next: NextFunction) => {
    service.getAll()
        .then((customers: Customer[]) => sendResponse(res, customers))
        .catch(next)
}

let getById = (req: Request, res: Response, next: NextFunction) => {
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }
    const supplierId: number = parseInt(req.params.id)
    service.getById(supplierId)
        .then((customer: Customer) => sendResponse(res, customer))
        .catch(next)
}

let createMany = (req: NetworkRequest<CreateCustomersRequestBody>, res: Response, next: NextFunction) => {
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }

    const requestBody = req.body

    service.createMany(requestBody.customers)
    .then((insertedRecordCount: number) => {
        var message = `Successfully created ${insertedRecordCount} customers`
        if (insertedRecordCount === 1) {
            message = message.substring(0, message.length-1)
        }
        sendResponse(res, message)
    })
    .catch(next)
}

let update = (req: NetworkRequest<Customer>, res: Response, next: NextFunction) => {
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    
    const customer = req.body

    if (!customer) {
        throw new RequestValidateError('Update failed: data missing')
    }

    if (!customer.id) {
        throw new RequestValidateError('Update failed: [id] not found')
    }
    
    service.update(customer)
        .then((customer: Customer) => sendResponse(res, "Successfully updated"))
        .catch(next)
}

let remove = (req: Request, res: Response, next: NextFunction) => {
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }

    const customerId: number = parseInt(req.params.id)
    service.remove(customerId)
        .then((customer: Customer) => sendResponse(res, "Successfully deleted"))
        .catch(next)
}

//routes
router.get("/", getAll)
router.get('/:id', getById)
router.post('/create', createMany)
router.put('/update', update)
router.delete('/:id', remove)
export = router