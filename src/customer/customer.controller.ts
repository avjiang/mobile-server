import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./customer.service"
import { Customer } from "../../prisma/client/generated/client"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { CreateCustomersRequestBody } from "./customer.request"
import { AuthRequest } from "src/middleware/auth-request"
import { SyncRequest } from "src/item/item.request"

const router = express.Router()

let getAll = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    service.getAll(req.user.databaseName)
        .then((customers: Customer[]) => sendResponse(res, customers))
        .catch(next)
}

let getAllCustomer = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    const syncRequest: SyncRequest = {
        lastSyncTimestamp: req.query.lastSyncTimestamp as string,
        lastVersion: req.query.lastVersion ? parseInt(req.query.lastVersion as string) : undefined,
        skip: req.query.skip ? parseInt(req.query.skip as string) : undefined,
        take: req.query.take ? parseInt(req.query.take as string) : undefined,
    };
    service
        .getAllCustomers(req.user.databaseName, syncRequest)
        .then(({ customers, total, serverTimestamp }) => sendResponse(res, { data: customers, total, serverTimestamp }))
        .catch(next);
}

let getById = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }
    const customerId: number = parseInt(req.params.id)
    service.getById(customerId, req.user.databaseName)
        .then((customer: Customer) => sendResponse(res, customer))
        .catch(next)
}

let createMany = (req: NetworkRequest<CreateCustomersRequestBody>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    const requestBody = req.body
    service.createMany(requestBody.customers, req.user.databaseName,)
        .then((createdCustomers: Customer[]) => {
            sendResponse(res, createdCustomers)
        })
        .catch(next)
}

let update = (req: NetworkRequest<Customer>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
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
    service.update(customer, req.user.databaseName)
        .then((customer: Customer) => sendResponse(res, customer))
        .catch(next)
}

let remove = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }

    const customerId: number = parseInt(req.params.id)
    service.remove(customerId, req.user.databaseName)
        .then((customer: Customer) => sendResponse(res, "Successfully deleted"))
        .catch(next)
}

//routes
router.get("/", getAll)
router.get('/sync', getAllCustomer)
router.get('/:id', getById)
router.post('/create', createMany)
router.put('/update', update)
router.delete('/:id', remove)
export = router