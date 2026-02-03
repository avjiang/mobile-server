import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./admin.service"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { AuthRequest } from "../middleware/auth-request"
import { CreateTenantRequest } from "src/admin/admin.request"
import {
    TenantCostResponse,
    TenantCreationDto,
    TotalCostResponse,
    RecordPaymentResponse,
    PaymentListResponse,
    AllPaymentsResponse,
    TenantBillingSummaryResponse,
    UpcomingPaymentsSummaryResponse,
    UpcomingPaymentsResponse,
    TenantUsersResponse,
    TenantOverviewResponse
} from "./admin.response"

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

/**
 * GET /tenants/:tenantId/users
 * Get all users for a specific tenant
 */
let getTenantUsers = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.tenantId)) {
        throw new RequestValidateError('Tenant ID format incorrect');
    }

    const tenantId: number = parseInt(req.params.tenantId);
    const includeDeleted = req.query.includeDeleted === 'true';

    service.getTenantUsers(tenantId, includeDeleted)
        .then((response: TenantUsersResponse) => {
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

// ============================================
// Payment Management Endpoints
// ============================================

/**
 * POST /tenants/:tenantId/outlets/:outletId/payments
 * Record payment and extend subscription
 */
let recordPayment = (req: NetworkRequest<{
    amount: number;
    paymentMethod: string;
    paymentDate: string;
    referenceNumber?: string;
    extensionMonths?: number;
    notes?: string;
}>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.tenantId)) {
        throw new RequestValidateError('Tenant ID format incorrect');
    }
    if (!validator.isNumeric(req.params.outletId)) {
        throw new RequestValidateError('Outlet ID format incorrect');
    }
    if (!req.body || !req.body.amount || !req.body.paymentMethod || !req.body.paymentDate) {
        res.status(400).json({ error: 'Invalid request. amount, paymentMethod, and paymentDate are required.' });
        return;
    }
    if (req.body.amount <= 0) {
        res.status(400).json({ error: 'Invalid request. Amount must be a positive number.' });
        return;
    }

    const tenantId: number = parseInt(req.params.tenantId);
    const outletId: number = parseInt(req.params.outletId);
    const { amount, paymentMethod, paymentDate, referenceNumber, extensionMonths, notes } = req.body;

    service.recordPayment(tenantId, outletId, {
        amount,
        paymentMethod,
        paymentDate: new Date(paymentDate),
        referenceNumber,
        extensionMonths: extensionMonths || 1,
        notes
    })
        .then((response: RecordPaymentResponse) => {
            sendResponse(res, response);
        })
        .catch(next);
};

/**
 * GET /tenants/:tenantId/payments
 * Get payment history for a tenant (all outlets or filtered by outletId)
 */
let getTenantPayments = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.tenantId)) {
        throw new RequestValidateError('Tenant ID format incorrect');
    }

    const tenantId: number = parseInt(req.params.tenantId);
    const outletId = req.query.outletId ? parseInt(req.query.outletId as string) : undefined;
    const fromDate = req.query.from ? new Date(req.query.from as string) : undefined;
    const toDate = req.query.to ? new Date(req.query.to as string) : undefined;
    if (toDate) toDate.setHours(23, 59, 59, 999); // Include entire day
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string), 100) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    service.getPaymentsByTenant(tenantId, { outletId, fromDate, toDate, limit, offset })
        .then((response: PaymentListResponse) => {
            sendResponse(res, response);
        })
        .catch(next);
};

/**
 * GET /payments
 * Get all payments across tenants (admin dashboard)
 * Requires from and to date range to prevent full table scan
 */
let getAllPayments = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!req.query.from || !req.query.to) {
        res.status(400).json({ error: 'Invalid request. from and to date range are required.' });
        return;
    }

    const tenantId = req.query.tenantId ? parseInt(req.query.tenantId as string) : undefined;
    const fromDate = new Date(req.query.from as string);
    const toDate = new Date(req.query.to as string);
    toDate.setHours(23, 59, 59, 999); // Include entire day
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string), 100) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    service.getAllPayments({ tenantId, fromDate, toDate, limit, offset })
        .then((response: AllPaymentsResponse) => {
            sendResponse(res, response);
        })
        .catch(next);
};

/**
 * GET /tenants/:tenantId/billing-summary
 * Get consolidated billing summary for a tenant across all outlets
 */
let getTenantBillingSummary = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.tenantId)) {
        throw new RequestValidateError('Tenant ID format incorrect');
    }

    const tenantId: number = parseInt(req.params.tenantId);

    service.getTenantBillingSummary(tenantId)
        .then((response: TenantBillingSummaryResponse) => {
            sendResponse(res, response);
        })
        .catch(next);
};

/**
 * GET /payments/upcoming/summary
 * Get summary counts of upcoming payments by status
 */
let getUpcomingPaymentsSummary = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }

    const days = req.query.days ? parseInt(req.query.days as string) : 30;

    service.getUpcomingPaymentsSummary(days)
        .then((response: UpcomingPaymentsSummaryResponse) => {
            sendResponse(res, response);
        })
        .catch(next);
};

/**
 * GET /payments/upcoming
 * Get paginated list of upcoming payments (grouped by tenant)
 */
let getUpcomingPayments = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }

    const days = req.query.days ? parseInt(req.query.days as string) : 30;
    const status = (req.query.status as string) || 'all';
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string), 100) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    // Validate status parameter
    if (!['active', 'grace', 'expired', 'all'].includes(status)) {
        res.status(400).json({ error: 'Invalid status. Must be one of: active, grace, expired, all' });
        return;
    }

    service.getUpcomingPayments({ days, status: status as 'active' | 'grace' | 'expired' | 'all', limit, offset })
        .then((response: UpcomingPaymentsResponse) => {
            sendResponse(res, response);
        })
        .catch(next);
};

/**
 * GET /tenantOverview
 * Get tenant overview statistics
 */
let getTenantOverview = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }

    service.getTenantOverview()
        .then((response: TenantOverviewResponse) => {
            sendResponse(res, response);
        })
        .catch(next);
};



// Forgot Password (Force Reset)
let forgotTenantUserPassword = (req: NetworkRequest<{}>, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError('User not authenticated');

    if (!validator.isNumeric(req.params.tenantId) || !validator.isNumeric(req.params.userId)) {
        throw new RequestValidateError('ID format incorrect');
    }

    const tenantId = parseInt(req.params.tenantId);
    const userId = parseInt(req.params.userId);

    service.forgotTenantUserPassword(tenantId, userId)
        .then((response: any) => {
            sendResponse(res, response);
        })
        .catch(next);
}

//routes
router.get('/tenantDetails/:id', getTenantDetails)
router.get('/getAllTenantSubscription', getAllTenantSubscription)
router.get('/tenantOverview', getTenantOverview)
router.get('/tenantDevices/:tenantId', getTenantDevices)
router.post('/signup', createTenant)
router.post('/createTenantUser/:tenantId', createTenantUser)
router.delete('/tenants/:tenantId/users/:userId', deleteTenantUser)
router.get('/tenants/:tenantId/users', getTenantUsers)

router.post('/tenants/:tenantId/users/:userId/forgot-password', forgotTenantUserPassword)

// device quota routes
router.post('/addDeviceQuota/:tenantId', addDeviceQuotaForTenant)
router.post('/reduceDeviceQuota/:tenantId', reduceDeviceQuotaForTenant)

// subscription plan routes
router.put('/tenants/:tenantId/changePlan', changeTenantPlan)

// warehouse routes
router.post('/tenants/:tenantId/warehouses', createWarehouse)
router.delete('/tenants/:tenantId/warehouses/:id', deleteWarehouse)
router.get('/tenants/:tenantId/warehouses', getTenantWarehouses)

// payment management routes
router.post('/tenants/:tenantId/outlets/:outletId/payments', recordPayment)
router.get('/tenants/:tenantId/payments', getTenantPayments)
router.get('/payments', getAllPayments)
router.get('/tenants/:tenantId/billing-summary', getTenantBillingSummary)
router.get('/payments/upcoming/summary', getUpcomingPaymentsSummary)
router.get('/payments/upcoming', getUpcomingPayments)

export = router