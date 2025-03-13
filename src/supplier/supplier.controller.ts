import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./supplier.service"
import { Supplier } from "@prisma/client"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { CreateSuppliersRequestBody } from "./supplier.request"

const router = express.Router()

let getAll = (req: Request, res: Response, next: NextFunction) => {
    service.getAll()
        .then((suppliers: Supplier[]) => sendResponse(res, suppliers))
        .catch(next)
}

let getById = (req: Request, res: Response, next: NextFunction) => {
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }
    const supplierId: number = parseInt(req.params.id)
    service.getById(supplierId)
        .then((supplier: Supplier) => sendResponse(res, supplier))
        .catch(next)
}

let createMany = (req: NetworkRequest<CreateSuppliersRequestBody>, res: Response, next: NextFunction) => {
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    const requestBody = req.body
    service.createMany(requestBody.suppliers)
    .then((insertedRecordCount: number) => {
        var message = `Successfully created ${insertedRecordCount} suppliers`
        if (insertedRecordCount === 1) {
            message = message.substring(0, message.length-1)
        }
        sendResponse(res, message)
    })
    .catch(next)
}

let update = (req: NetworkRequest<Supplier>, res: Response, next: NextFunction) => {
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
    
    service.update(supplier)
        .then((supplier: Supplier) => sendResponse(res, "Successfully updated"))
        .catch(next)
}

let remove = (req: Request, res: Response, next: NextFunction) => {
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }

    const supplierId: number = parseInt(req.params.id)
    service.remove(supplierId)
        .then((supplier: Supplier) => sendResponse(res, "Successfully deleted"))
        .catch(next)
}

//routes
router.get("/", getAll)
router.get('/:id', getById)
router.post('/create', createMany)
router.put('/update', update)
router.delete('/:id', remove)
export = router