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

// Delete tenant user and automatically adjust user add-on
let deleteTenantUser = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.tenantId)) {
        throw new RequestValidateError('Tenant ID format incorrect');
    }
    if (!validator.isNumeric(req.params.userId)) {
        throw new RequestValidateError('User ID format incorrect');
    }
    const tenantId: number = parseInt(req.params.tenantId);
    const userId: number = parseInt(req.params.userId);

    service.deleteTenantUser(tenantId, userId)
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

/**
 * POST /tenants/:tenantId/warehouses
 * Create warehouse for tenant (POS Owner only)
 */
let createWarehouse = (req: AuthRequest, res: Response, next: NextFunction) => {
    const tenantId = parseInt(req.params.tenantId);

    if (!tenantId || isNaN(tenantId)) {
        throw new RequestValidateError('Valid tenant ID is required');
    }

    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty');
    }

    const { warehouseName, street, city, state, postalCode, country, contactPhone, contactEmail } = req.body;

    if (!warehouseName) {
        throw new RequestValidateError('Warehouse name is required');
    }

    service.createWarehouseForTenant(tenantId, {
        warehouseName,
        street,
        city,
        state,
        postalCode,
        country,
        contactPhone,
        contactEmail
    })
        .then((response: any) => {
            let message;
            if (response.wasReactivated) {
                // Warehouse was reactivated from soft-deleted state
                message = response.billableWarehouses === 0
                    ? 'Warehouse reactivated successfully (FREE)'
                    : `Warehouse reactivated. Additional charge: ${response.monthlyCost} IDR/month`;
            } else {
                // Warehouse was created fresh
                message = response.billableWarehouses === 0
                    ? 'First warehouse created successfully (FREE)'
                    : `Warehouse created. Additional charge: ${response.monthlyCost} IDR/month`;
            }

            sendResponse(res, {
                success: true,
                message,
                warehouse: response.warehouse,
                wasReactivated: response.wasReactivated,
                billing: {
                    totalWarehouses: response.totalWarehouses,
                    billableWarehouses: response.billableWarehouses,
                    monthlyCost: response.monthlyCost,
                    isFreeWarehouse: response.isFreeWarehouse
                }
            });
        })
        .catch(next);
};

/**
 * DELETE /tenants/:tenantId/warehouses/:id
 * Delete warehouse for tenant (POS Owner only)
 */
let deleteWarehouse = (req: AuthRequest, res: Response, next: NextFunction) => {
    const tenantId = parseInt(req.params.tenantId);
    const warehouseId = parseInt(req.params.id);

    if (!tenantId || isNaN(tenantId)) {
        throw new RequestValidateError('Valid tenant ID is required');
    }

    if (!warehouseId || isNaN(warehouseId)) {
        throw new RequestValidateError('Valid warehouse ID is required');
    }

    service.deleteWarehouseForTenant(tenantId, warehouseId)
        .then((response: any) => {
            sendResponse(res, {
                success: true,
                message: response.message,
                billing: {
                    remainingWarehouses: response.remainingWarehouses,
                    billableWarehouses: response.billableWarehouses,
                    monthlyCost: response.monthlyCost
                }
            });
        })
        .catch(next);
};

/**
 * GET /tenants/:tenantId/warehouses
 * Get all warehouses for tenant (POS Owner only)
 */
let getTenantWarehouses = (req: AuthRequest, res: Response, next: NextFunction) => {
    const tenantId = parseInt(req.params.tenantId);

    if (!tenantId || isNaN(tenantId)) {
        throw new RequestValidateError('Valid tenant ID is required');
    }

    service.getTenantWarehouses(tenantId)
        .then((response: any) => {
            sendResponse(res, response);
        })
        .catch(next);
};

/**
 * PUT /tenants/:tenantId/changePlan
 * Change tenant plan - supports both upgrade and downgrade (POS Owner only)
 * When downgrading to Basic: deactivates all warehouses and push notification devices
 */
let changeTenantPlan = (req: NetworkRequest<{ planName: string }>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.tenantId)) {
        throw new RequestValidateError('ID format incorrect');
    }
    if (!req.body || !req.body.planName) {
        res.status(400).json({ error: 'Invalid request. Plan name is required.' });
        return;
    }

    const tenantId: number = parseInt(req.params.tenantId);
    const { planName } = req.body;

    service.changeTenantPlan(tenantId, planName)
        .then((response: any) => {
            sendResponse(res, response);
        })
        .catch(next);
};

//routes
router.get('/tenantDetails/:id', getTenantDetails)
router.get('/getAllTenantSubscription', getAllTenantSubscription)
router.get('/tenantDevices/:tenantId', getTenantDevices)
router.post('/signup', createTenant)
router.post('/createTenantUser/:tenantId', createTenantUser)
router.delete('/tenants/:tenantId/users/:userId', deleteTenantUser)

// device quota routes
router.post('/addDeviceQuota/:tenantId', addDeviceQuotaForTenant)
router.post('/reduceDeviceQuota/:tenantId', reduceDeviceQuotaForTenant)

// subscription plan routes
router.put('/tenants/:tenantId/changePlan', changeTenantPlan)

// warehouse routes
router.post('/tenants/:tenantId/warehouses', createWarehouse)
router.delete('/tenants/:tenantId/warehouses/:id', deleteWarehouse)
router.get('/tenants/:tenantId/warehouses', getTenantWarehouses)

export = router