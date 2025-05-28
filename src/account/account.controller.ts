import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./account.service"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { AuthRequest } from "../middleware/auth-request"
import { AccountRequest } from "./account.request"
import { OutletDetailsResponse } from "./account.response"

const router = express.Router()

let getAccountDetails = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    const accountRequest: AccountRequest = {
        outletId: req.query.outletId ? parseInt(req.query.outletId as string) : undefined,
        tenantId: req.query.tenantId ? parseInt(req.query.tenantId as string) : undefined,
    };
    service.getAccountDetails(accountRequest)
        .then((response: OutletDetailsResponse) => {
            sendResponse(res, response);
        })
        .catch(next)
}

//routes
router.get('/accountDetails', getAccountDetails)

export = router