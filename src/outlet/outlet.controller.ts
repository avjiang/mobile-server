import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./outlet.service"
import { Category } from "../../prisma/client/generated/client"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { AuthRequest } from "../middleware/auth-request"
import { SyncRequest } from "src/item/item.request"

const router = express.Router()

let getAll = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    service.getAll(req.user.databaseName, req.user)
        .then((response: any) => {
            sendResponse(res, response);
        })
        .catch(next)
}

let getOutletSync = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    const syncRequest: SyncRequest = {
        lastSyncTimestamp: req.query.lastSyncTimestamp as string,
        lastVersion: req.query.lastVersion ? parseInt(req.query.lastVersion as string) : undefined,
        skip: req.query.skip ? parseInt(req.query.skip as string) : undefined,
        take: req.query.take ? parseInt(req.query.take as string) : undefined,
    };
    service.getOutletSync(req.user.databaseName, req.user, syncRequest)
        .then(({ data, total, serverTimestamp }) => sendResponse(res, { data, total, serverTimestamp }))
        .catch(next);
}

//routes
router.get("/sync", getOutletSync)
router.get("/", getAll)
export = router