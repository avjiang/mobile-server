import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./admin.service"
import { Category } from "../../prisma/client"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { AuthRequest } from "../middleware/auth-request"
import { CreateTenantRequest } from "src/admin/admin.request"
import { TenantCostResponse, TenantCreationDto, TotalCostResponse } from "./admin.response"

const router = express.Router()

let createTenant = (req: NetworkRequest<CreateTenantRequest>, res: Response, next: NextFunction) => {
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    if (!req.body || !req.body.tenant.tenantName || !req.body.tenant.plan) {
        res.status(400).json({ error: 'Invalid request. Both tenantName and plan are required.' });
        return;
    }
    const requestBody = req.body
    service.createTenant(requestBody)
        .then((tenant: TenantCreationDto) => {
            sendResponse(res, tenant)
        })
        .catch(next)
}

let getTenantDetails = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }
    const tenantId: number = parseInt(req.params.id)
    service.getTenantCost(req, tenantId)
        .then((response: TenantCostResponse) => {
            sendResponse(res, response);
        })
        .catch(next)
}

let getAllTenantSubscription = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    service.getAllTenantCost()
        .then((response: TotalCostResponse) => {
            sendResponse(res, response);
        })
        .catch(next)
}

//routes
router.get('/tenantDetails/:id', getTenantDetails)
router.get('/getAllTenantSubscription', getAllTenantSubscription)
router.post('/signup', createTenant)

export = router