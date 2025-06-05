import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./permission.service"
import { Category, RolePermission } from "@prisma/client"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { SyncRequest } from "../item/item.request"

const router = express.Router()

let getAll = (req: NetworkRequest<any>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    const { outletId, skip, take, lastSyncTimestamp } = req.query;
    const skipNum = skip && validator.isNumeric(skip as string) ? parseInt(skip as string) : 0;
    const takeNum = take && validator.isNumeric(take as string) ? parseInt(take as string) : 100;
    const syncRequest = {
        skip: skipNum,
        take: takeNum,
        lastSyncTimestamp: lastSyncTimestamp as string
    };
    service.getAll(syncRequest)
        .then(({ data, total, serverTimestamp }) => {
            sendResponse(res, { data, total, serverTimestamp });
        })
        .catch(next);
}

//routes
router.get("/sync", getAll)
// router.get('/:id', getById)
// router.put('/update', update)
// router.delete('/:id', remove)
export = router