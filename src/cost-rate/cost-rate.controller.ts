import express, { NextFunction, Response } from "express"
import validator from "validator"
import service from "./cost-rate.service"
import { CostRate } from "../../prisma/client/generated/client"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { AuthRequest } from "../middleware/auth-request"
import { CreateCostRateRequestBody, GenerateForSessionRequestBody } from "./cost-rate.request"
import { SyncRequest } from "src/item/item.request"

const router = express.Router()

let getAll = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError('User not authenticated');
    const syncRequest: SyncRequest = {
        lastSyncTimestamp: req.query.lastSyncTimestamp as string,
        lastVersion: req.query.lastVersion ? parseInt(req.query.lastVersion as string) : undefined,
        skip: req.query.skip ? parseInt(req.query.skip as string) : undefined,
        take: req.query.take ? parseInt(req.query.take as string) : undefined,
    };
    service.getAllRates(req.user.databaseName, syncRequest)
        .then(({ rates, total, serverTimestamp }) => sendResponse(res, { data: rates, total, serverTimestamp }))
        .catch(next);
}

let createMany = (req: NetworkRequest<CreateCostRateRequestBody>, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError('User not authenticated');
    if (Object.keys(req.body).length === 0) throw new RequestValidateError('Request body is empty')
    service.createMany(req.user.databaseName, req.body.rates)
        .then((count: number) => sendResponse(res, count))
        .catch(next)
}

let update = (req: NetworkRequest<CostRate>, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError('User not authenticated');
    if (!req.body || !req.body.id) throw new RequestValidateError('Update failed: [id] not found')
    service.update(req.user.databaseName, req.body)
        .then(() => sendResponse(res, "Successfully updated"))
        .catch(next)
}

let remove = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError('User not authenticated');
    if (!validator.isNumeric(req.params.id)) throw new RequestValidateError('ID format incorrect')
    service.remove(req.user.databaseName, parseInt(req.params.id))
        .then(() => sendResponse(res, "Successfully deleted"))
        .catch(next)
}

let generateForSession = (req: NetworkRequest<GenerateForSessionRequestBody>, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError('User not authenticated');
    const sessionId = req.body?.sessionId;
    if (!sessionId) throw new RequestValidateError('sessionId is required')
    service.generateForSession(req.user.databaseName, sessionId)
        .then((count: number) => sendResponse(res, count))
        .catch(next)
}

//routes
router.get('/sync', getAll)
router.post('/create', createMany)
router.put('/update', update)
router.post('/generateForSession', generateForSession)
router.delete('/:id', remove)
export = router
