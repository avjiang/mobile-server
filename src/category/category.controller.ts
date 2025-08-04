import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./category.service"
import { Category } from "prisma/client"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { AuthRequest } from "../middleware/auth-request"
import { CreateCategoryRequestBody } from "./category.request"

const router = express.Router()

let getAll = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    service.getAll(req.user.databaseName)
        .then((categories: Category[]) => sendResponse(res, categories))
        .catch(next)
}

let getById = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }
    const categoryId: number = parseInt(req.params.id)
    service.getById(req.user.databaseName, categoryId)
        .then((category: Category) => sendResponse(res, category))
        .catch(next)
}

let createMany = (req: NetworkRequest<CreateCategoryRequestBody>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    const requestBody = req.body
    service.createMany(req.user.databaseName, requestBody.categories)
        .then((createdCategories: Category[]) => {
            // var message = `Successfully created ${insertedRecordCount} category`
            // if (insertedRecordCount === 1) {
            //     message = message.substring(0, message.length - 1)
            // }
            sendResponse(res, createdCategories)
        })
        .catch(next)
}

let update = (req: NetworkRequest<Category>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    const category = req.body
    if (!category) {
        throw new RequestValidateError('Update failed: data missing')
    }
    if (!category.id) {
        throw new RequestValidateError('Update failed: [id] not found')
    }
    service.update(req.user.databaseName, category)
        .then((category: Category) => sendResponse(res, "Successfully updated"))
        .catch(next)
}

let remove = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }
    const categoryId: number = parseInt(req.params.id)
    service.remove(req.user.databaseName, categoryId)
        .then((category: Category) => sendResponse(res, "Successfully deleted"))
        .catch(next)
}

//routes
router.get("/", getAll)
router.get('/:id', getById)
router.post('/create', createMany)
router.put('/update', update)
router.delete('/:id', remove)
export = router