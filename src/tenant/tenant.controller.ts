import express, { NextFunction, Request, Response } from "express";
import service from "./tenant.service";
import NetworkRequest from "../api-helpers/network-request";
import { CreateTenantRequestBody } from "./tenant.request";
import { sendResponse } from "../api-helpers/network";
import { RequestValidateError } from "../api-helpers/error";
import { TenantCreationDto, TenantDto } from "./tenant.response";
import { Tenant, TenantUser } from "../../node_modules/.prisma/global-client";

const router = express.Router()

let getAll = (req: Request, res: Response, next: NextFunction) => {
    service.getAll()
        .then((tenants: TenantDto[]) => sendResponse(res, tenants))
        .catch(next)
}

let create = (req: NetworkRequest<CreateTenantRequestBody>, res: Response, next: NextFunction) => {
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    const requestBody = req.body
    service.create(requestBody.tenant)
        .then((tenant: TenantCreationDto) => {
            sendResponse(res, tenant)
        })
        .catch(next)
}

//routes
router.get("/", getAll)
router.post('/signup', create)
export = router