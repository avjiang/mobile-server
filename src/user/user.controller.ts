import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./user.service"
import { Category, RolePermission, Role } from "prisma/client"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { AuthRequest } from "../middleware/auth-request"
import { SyncRequest } from "src/item/item.request"
import { UpdateUserRequestBody } from "./user.request"

const router = express.Router()

let getAll = (req: AuthRequest, res: Response, next: NextFunction) => {
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
        .getAll(req.user.databaseName, syncRequest)
        .then(({ users, total, serverTimestamp }) => sendResponse(res, { data: users, total, serverTimestamp }))
        .catch(next);
}

const getById = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }
    const userId: number = parseInt(req.params.id)
    service.getById(req.user.databaseName, userId)
        .then((user) => sendResponse(res, user))
        .catch(next)
}

const update = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }
    const userId: number = parseInt(req.params.id)
    const updateData: UpdateUserRequestBody = req.body
    service.update(req.user.databaseName, userId, updateData)
        .then((user) => sendResponse(res, user))
        .catch(next)
}

//routes
router.get('/sync', getAll)
router.get('/:id', getById)
router.put('/update/:id', update)
export = router