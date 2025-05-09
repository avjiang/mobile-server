import express, { NextFunction, Request, Response } from "express"
import { sendResponse } from "../api-helpers/network"
import service from "./session.service"
import { Declaration, Session } from "@prisma/client"
import validator from "validator"
import { RequestValidateError } from "../api-helpers/error"
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

let createSession = (req: NetworkRequest<OpenSessionRequest>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    const requestBody = req.body
    service.createSession(requestBody, req.user.databaseName)
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

    service.createDeclarations(requestBody, req.user.databaseName)
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

    service.closeSession(requestBody, req.user.databaseName)
        .then((isSuccess: boolean) => sendResponse(res, isSuccess))
        .catch(next)
}


//routes
router.get('/getDeclarations/:id', getDeclarationsBySessionID)
router.get('/:id', getSessionByID)
router.post('/openSession', createSession)
router.post('/createDeclarations', createDeclarations)
router.put('/closeSession', closeSession)
export = router