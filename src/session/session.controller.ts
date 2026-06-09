import express, { NextFunction, Request, Response } from "express"
import { sendResponse } from "../api-helpers/network"
import service from "./session.service"
import { Declaration, Session } from "../../prisma/client/generated/client"
import validator from "validator"
import { RequestValidateError } from "../api-helpers/error"
import { requireOutletHeader } from "../api-helpers/outlet-helper"
import { CloseSessionRequest, OpenSessionRequest } from "./session.request"
import NetworkRequest from "../api-helpers/network-request"
import { AuthRequest } from "src/middleware/auth-request"

const router = express.Router()

let getDeclarationsBySessionID = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }
    const sessionID: number = parseInt(req.params.id)

    service.getDeclarationsBySessionID(sessionID, req.user.databaseName)
        .then((declarations: Declaration[]) => sendResponse(res, declarations))
        .catch(next)
}

let getSessionByID = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }
    const sessionID: number = parseInt(req.params.id)

    service.getSessionByID(sessionID, req.user.databaseName)
        .then((session: Session) => sendResponse(res, session))
        .catch(next)
}

let getOpenSession = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    const outletIdRaw = req.query.outletId
    const userIdRaw = req.query.userId
    const outletIdStr = typeof outletIdRaw === 'string' ? outletIdRaw : ''
    const userIdStr = typeof userIdRaw === 'string' ? userIdRaw : ''
    if (!validator.isNumeric(outletIdStr)) {
        throw new RequestValidateError('outletId query param required and must be numeric')
    }
    if (!validator.isNumeric(userIdStr)) {
        throw new RequestValidateError('userId query param required and must be numeric')
    }
    const outletId: number = parseInt(outletIdStr)
    const userId: number = parseInt(userIdStr)

    service.getOpenSession(outletId, userId, req.user.databaseName)
        .then((session: Session | null) => sendResponse(res, session))
        .catch(next)
}

let createSession = (req: NetworkRequest<OpenSessionRequest>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    const requestBody = req.body
    // Make the X-Outlet-ID header authoritative. The global outlet-authz
    // middleware's fallback order (body→query→params→header) means a body
    // outletId would otherwise silently satisfy a req.outletId check, masking
    // a missing/disagreeing header.
    const outletId = requireOutletHeader(req, requestBody.outletId);
    service.createSession(requestBody, req.user.databaseName, outletId)
        .then((session: Session) => sendResponse(res, session))
        .catch(next)
}

let createDeclarations = (req: NetworkRequest<Declaration[]>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }

    const requestBody = req.body
    const outletId = requireOutletHeader(req);

    service.createDeclarations(requestBody, req.user.databaseName, outletId)
        .then((declarationsCount: number) => sendResponse(res, declarationsCount))
        .catch(next)
}


let closeSession = (req: NetworkRequest<CloseSessionRequest>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }

    const requestBody = req.body
    const outletId = requireOutletHeader(req);

    service.closeSession(requestBody, req.user.databaseName, outletId)
        .then((isSuccess: boolean) => sendResponse(res, isSuccess))
        .catch(next)
}


//routes
// NOTE: specific GET routes MUST be registered before the wildcard '/:id'
// or Express will route them to getSessionByID and fail numeric validation.
router.get('/getDeclarations/:id', getDeclarationsBySessionID)
router.get('/getOpenSession', getOpenSession)
router.get('/:id', getSessionByID)
router.post('/openSession', createSession)
router.post('/createDeclarations', createDeclarations)
router.put('/closeSession', closeSession)
export = router