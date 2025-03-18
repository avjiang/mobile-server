import express, { NextFunction, Request, Response } from "express";
import service from "./tenant.service";
import NetworkRequest from "../api-helpers/network-request";
import { CreateTenantRequest } from "./tenant.request";
import { sendResponse } from "../api-helpers/network";
import { RequestValidateError } from "../api-helpers/error";
import { TenantCreationDto, TenantDto } from "./tenant.response";
import { Tenant, TenantUser } from "../../node_modules/.prisma/global-client";
import { AuthRequest } from "../middleware/auth-request";

const router = express.Router()

let getAll = (req: AuthRequest, res: Response, next: NextFunction) => {
    service.getAll()
        .then((tenants) => sendResponse(res, tenants))
        .catch(next)
}

let create = (req: NetworkRequest<CreateTenantRequest>, res: Response, next: NextFunction) => {
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    if (!req.body || !req.body.tenant.tenantName || !req.body.tenant.plan) {
        res.status(400).json({ error: 'Invalid request. Both tenantName and plan are required.' });
        return;
    }
    const requestBody = req.body
    service.create(requestBody)
        .then((tenant: TenantCreationDto) => {
            sendResponse(res, tenant)
        })
        .catch(next)
}

//routes
router.get("/", getAll)
router.post('/signup', create)
export = router