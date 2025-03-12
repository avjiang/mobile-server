import express, { NextFunction, Request, Response } from "express";
import service from "./tenant.service";
import NetworkRequest from "../api-helpers/network-request";
import { TenantRequestBody } from "./tenant.request";
import { sendResponse } from "../api-helpers/network";
import { RequestValidateError } from "../api-helpers/error";
import { TenantDto } from "./tenant.response";
import { Tenant, TenantUser } from "../../node_modules/.prisma/global-client";

const router = express.Router()

let getAll = (req: Request, res: Response, next: NextFunction) => {
    service.getAll()
        .then((tenants: TenantDto[]) => sendResponse(res, tenants))
        .catch(next)
}

let create = (req: NetworkRequest<TenantRequestBody>, res: Response, next: NextFunction) => {
    const authenticateBody = req.body

    // const ipAddress = req.ip
    // service.authenticate(authenticateBody, ipAddress)
    //     .then((response: TokenResponseBody) => sendResponse(res, response))
    //     .catch(next)
}

//routes

router.get("/", getAll)
router.post('/create', create)
export = router