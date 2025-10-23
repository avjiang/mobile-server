import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./admin.service"
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

// New: create tenant user (global) + user (tenant DB), no roles assigned
let createTenantUser = (req: NetworkRequest<{ username: string; password: string }>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.tenantId)) {
        throw new RequestValidateError('ID format incorrect');
    }
    if (!req.body || !req.body.username || !req.body.password) {
        res.status(400).json({ error: 'Invalid request. Both username and password are required.' });
        return;
    }
    const tenantId: number = parseInt(req.params.tenantId);
    const { username, password } = req.body;

    service.createTenantUser(tenantId, { username, password })
        .then((response: any) => {
            sendResponse(res, response);
        })
        .catch(next);
}

// Provider/Owner: Add device quota for tenant
let addDeviceQuotaForTenant = (req: NetworkRequest<{ quantity: number }>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.tenantId)) {
        throw new RequestValidateError('ID format incorrect');
    }
    if (!req.body || !req.body.quantity || req.body.quantity <= 0) {
        res.status(400).json({ error: 'Invalid request. Quantity must be a positive number.' });
        return;
    }
    const tenantId: number = parseInt(req.params.tenantId);
    const { quantity } = req.body;

    service.addDeviceQuotaForTenant(tenantId, quantity)
        .then((response: any) => {
            sendResponse(res, response);
        })
        .catch(next);
}

// Provider/Owner: Reduce device quota for tenant (auto-deactivates excess devices)
let reduceDeviceQuotaForTenant = (req: NetworkRequest<{ quantity: number }>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.tenantId)) {
        throw new RequestValidateError('ID format incorrect');
    }
    if (!req.body || !req.body.quantity || req.body.quantity <= 0) {
        res.status(400).json({ error: 'Invalid request. Quantity must be a positive number.' });
        return;
    }
    const tenantId: number = parseInt(req.params.tenantId);
    const { quantity } = req.body;

    service.reduceDeviceQuotaForTenant(tenantId, quantity)
        .then((response: any) => {
            sendResponse(res, response);
        })
        .catch(next);
}

// Provider/Owner: Get all devices for a tenant
let getTenantDevices = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.tenantId)) {
        throw new RequestValidateError('ID format incorrect');
    }
    const tenantId: number = parseInt(req.params.tenantId);

    service.getTenantDevices(tenantId)
        .then((response: any) => {
            sendResponse(res, response);
        })
        .catch(next);
}

//routes
router.get('/tenantDetails/:id', getTenantDetails)
router.get('/getAllTenantSubscription', getAllTenantSubscription)
router.get('/tenantDevices/:tenantId', getTenantDevices)
router.post('/signup', createTenant)
router.post('/createTenantUser/:tenantId', createTenantUser)
router.post('/addDeviceQuota/:tenantId', addDeviceQuotaForTenant)
router.post('/reduceDeviceQuota/:tenantId', reduceDeviceQuotaForTenant)

export = router