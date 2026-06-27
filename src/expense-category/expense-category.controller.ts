import express, { NextFunction, Response } from "express"
import validator from "validator"
import service from "./expense-category.service"
import { ExpenseCategory } from "../../prisma/client/generated/client"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { AuthRequest } from "../middleware/auth-request"
import { CreateExpenseCategoryRequestBody } from "./expense-category.request"
import { SyncRequest } from "src/item/item.request"

const router = express.Router()

let getAll = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    service.getAll(req.user.databaseName, req.user.planType)
        .then((categories: ExpenseCategory[]) => sendResponse(res, categories))
        .catch(next)
}

let getAllExpenseCategory = (req: AuthRequest, res: Response, next: NextFunction) => {
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
        .getAllExpenseCategories(req.user.databaseName, syncRequest, req.user.planType)
        .then(({ categories, total, serverTimestamp }) => sendResponse(res, { data: categories, total, serverTimestamp }))
        .catch(next);
}

let getById = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }
    service.getById(req.user.databaseName, parseInt(req.params.id))
        .then((category: ExpenseCategory) => sendResponse(res, category))
        .catch(next)
}

let createMany = (req: NetworkRequest<CreateExpenseCategoryRequestBody>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    service.createMany(req.user.databaseName, req.body.categories)
        .then((createdCategories: ExpenseCategory[]) => sendResponse(res, createdCategories))
        .catch(next)
}

let update = (req: NetworkRequest<ExpenseCategory>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    const category = req.body
    if (!category || !category.id) {
        throw new RequestValidateError('Update failed: [id] not found')
    }
    service.update(req.user.databaseName, category)
        .then(() => sendResponse(res, "Successfully updated"))
        .catch(next)
}

let remove = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }
    service.remove(req.user.databaseName, parseInt(req.params.id))
        .then(() => sendResponse(res, "Successfully deleted"))
        .catch(next)
}

//routes
router.get("/", getAll)
router.get('/sync', getAllExpenseCategory)
router.get('/:id', getById)
router.post('/create', createMany)
router.put('/update', update)
router.delete('/:id', remove)
export = router
