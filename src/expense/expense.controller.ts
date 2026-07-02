import express, { NextFunction, Response } from "express"
import validator from "validator"
import service from "./expense.service"
import { Expense } from "../../prisma/client/generated/client"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { AuthRequest } from "../middleware/auth-request"
import { CreateExpenseRequestBody } from "./expense.request"
import { SyncRequest } from "src/item/item.request"

const router = express.Router()

let getAllExpense = (req: AuthRequest, res: Response, next: NextFunction) => {
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
        .getAllExpenses(req.user.databaseName, syncRequest)
        .then(({ expenses, total, serverTimestamp }) => sendResponse(res, { data: expenses, total, serverTimestamp }))
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
        .then((expense: Expense) => sendResponse(res, expense))
        .catch(next)
}

let createMany = (req: NetworkRequest<CreateExpenseRequestBody>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    service.createMany(req.user.databaseName, req.body.expenses)
        .then((count: number) => sendResponse(res, count))
        .catch(next)
}

let update = (req: NetworkRequest<Expense>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    const expense = req.body
    if (!expense || !expense.id) {
        throw new RequestValidateError('Update failed: [id] not found')
    }
    service.update(req.user.databaseName, expense)
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
router.get('/sync', getAllExpense)
router.get('/:id', getById)
router.post('/create', createMany)
router.put('/update', update)
router.delete('/:id', remove)
export = router
