import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./supplier.service"
import { Supplier } from "../../prisma/client"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { CreateSuppliersRequestBody } from "./supplier.request"
import { AuthRequest } from "src/middleware/auth-request"
import { SyncRequest } from "src/item/item.request"

const router = express.Router()

let getAll = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    service.getAll(req.user.databaseName)
        .then((suppliers: Supplier[]) => sendResponse(res, suppliers))
        .catch(next)
}

let getAllSupplier = (req: AuthRequest, res: Response, next: NextFunction) => {
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
        .getAllSuppliers(req.user.databaseName, syncRequest)
        .then(({ suppliers, total, serverTimestamp }) => sendResponse(res, { data: suppliers, total, serverTimestamp }))
        .catch(next);
}

let getById = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }
    const supplierId: number = parseInt(req.params.id)
    service.getById(supplierId, req.user.databaseName)
        .then((supplier: Supplier) => sendResponse(res, supplier))
        .catch(next)
}

let createMany = (req: NetworkRequest<CreateSuppliersRequestBody>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    const requestBody = req.body
    service.createMany(requestBody.suppliers, req.user.databaseName,)
        .then((createdSuppliers: Supplier[]) => {
            sendResponse(res, createdSuppliers)
        })
        .catch(next)
}

let update = (req: NetworkRequest<Supplier>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    const supplier = req.body
    if (!supplier) {
        throw new RequestValidateError('Update failed: data missing')
    }
    if (!supplier.id) {
        throw new RequestValidateError('Update failed: [id] not found')
    }
    service.update(supplier, req.user.databaseName)
        .then((supplier: Supplier) => sendResponse(res, supplier))
        .catch(next)
}

let remove = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }

    const supplierId: number = parseInt(req.params.id)
    service.remove(supplierId, req.user.databaseName)
        .then((supplier: Supplier) => sendResponse(res, "Successfully deleted"))
        .catch(next)
}

//routes
router.get("/", getAll)
router.get('/sync', getAllSupplier)
router.get('/:id', getById)
router.post('/create', createMany)
router.put('/update', update)
router.delete('/:id', remove)
export = router