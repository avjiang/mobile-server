import express, { Response, NextFunction } from 'express';
import service from './subscription-package.service';
import { sendResponse } from '../api-helpers/network';
import { RequestValidateError } from '../api-helpers/error';
import { AuthRequest } from '../middleware/auth-request';
import { UserInfo } from '../middleware/authorize-middleware';
import { requireLoyalty } from '../middleware/loyalty-gate.middleware';

const router = express.Router();

// ============================================
// Package CRUD
// ============================================

const getPackages = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const result = await service.getPackages(user.databaseName);
        sendResponse(res, result);
    } catch (error) { next(error); }
};

const getPackageById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const packageId = parseInt(req.params.id);
        if (isNaN(packageId)) throw new RequestValidateError('Invalid package ID');
        const result = await service.getPackageById(user.databaseName, packageId);
        sendResponse(res, result);
    } catch (error) { next(error); }
};

const createPackage = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const { name, packageType, price, totalQuota, quotaUnit, durationDays, discountPercentage, discountAmount, validityDays, categoryIds } = req.body;
        if (!name || !packageType || price === undefined) {
            throw new RequestValidateError('name, packageType, and price are required');
        }
        const result = await service.createPackage(user.databaseName, {
            name, packageType, price, totalQuota, quotaUnit, durationDays,
            discountPercentage, discountAmount, validityDays, categoryIds,
        });
        sendResponse(res, result);
    } catch (error) { next(error); }
};

const updatePackage = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const packageId = parseInt(req.params.id);
        if (isNaN(packageId)) throw new RequestValidateError('Invalid package ID');
        const result = await service.updatePackage(user.databaseName, packageId, req.body);
        sendResponse(res, result);
    } catch (error) { next(error); }
};

const deletePackage = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const packageId = parseInt(req.params.id);
        if (isNaN(packageId)) throw new RequestValidateError('Invalid package ID');
        await service.deletePackage(user.databaseName, packageId);
        sendResponse(res, { success: true, message: 'Package deleted' });
    } catch (error) { next(error); }
};

// ============================================
// Customer Subscriptions
// ============================================

const subscribeCustomer = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const { customerId, subscriptionPackageId, paidAmount } = req.body;
        if (!customerId || !subscriptionPackageId || paidAmount === undefined) {
            throw new RequestValidateError('customerId, subscriptionPackageId, and paidAmount are required');
        }
        const result = await service.subscribeCustomer(user.databaseName, {
            customerId, subscriptionPackageId, paidAmount,
        });
        sendResponse(res, result);
    } catch (error) { next(error); }
};

const getCustomerSubscriptions = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const customerId = parseInt(req.params.id);
        if (isNaN(customerId)) throw new RequestValidateError('Invalid customer ID');
        const result = await service.getCustomerSubscriptions(user.databaseName, customerId);
        sendResponse(res, result);
    } catch (error) { next(error); }
};

const getSubscriptionById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const subscriptionId = parseInt(req.params.id);
        if (isNaN(subscriptionId)) throw new RequestValidateError('Invalid subscription ID');
        const result = await service.getSubscriptionById(user.databaseName, subscriptionId);
        sendResponse(res, result);
    } catch (error) { next(error); }
};

const cancelSubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const subscriptionId = parseInt(req.params.id);
        if (isNaN(subscriptionId)) throw new RequestValidateError('Invalid subscription ID');
        const result = await service.cancelSubscription(user.databaseName, subscriptionId);
        sendResponse(res, result);
    } catch (error) { next(error); }
};

const recordUsage = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const { customerSubscriptionId, salesId, quantityUsed } = req.body;
        if (!customerSubscriptionId || !salesId) {
            throw new RequestValidateError('customerSubscriptionId and salesId are required');
        }
        const result = await service.recordUsage(
            user.databaseName,
            { customerSubscriptionId, salesId, quantityUsed },
            user.username
        );
        sendResponse(res, result);
    } catch (error) { next(error); }
};

// ============================================
// Routes — All gated on advanced loyalty (add-on required)
// ============================================

// Package CRUD
router.get('/package', requireLoyalty('advanced'), getPackages);
router.get('/package/:id', requireLoyalty('advanced'), getPackageById);
router.post('/package', requireLoyalty('advanced'), createPackage);
router.put('/package/:id', requireLoyalty('advanced'), updatePackage);
router.delete('/package/:id', requireLoyalty('advanced'), deletePackage);

// Customer subscriptions
router.post('/subscribe', requireLoyalty('advanced'), subscribeCustomer);
router.get('/customer/:id', requireLoyalty('advanced'), getCustomerSubscriptions);
router.get('/subscription/:id', requireLoyalty('advanced'), getSubscriptionById);
router.put('/cancel/:id', requireLoyalty('advanced'), cancelSubscription);

// Usage tracking
router.post('/usage', requireLoyalty('advanced'), recordUsage);

module.exports = router;
