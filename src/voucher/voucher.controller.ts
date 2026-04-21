import express, { Response, NextFunction } from 'express';
import service from './voucher.service';
import { sendResponse } from '../api-helpers/network';
import { RequestValidateError } from '../api-helpers/error';
import { AuthRequest } from '../middleware/auth-request';
import { UserInfo } from '../middleware/authorize-middleware';
import { requireLoyalty } from '../middleware/loyalty-gate.middleware';

const router = express.Router();

// ============================================
// Reward Rule CRUD — gated on basic loyalty
// ============================================

const getRewardRules = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const result = await service.getRewardRules(user.databaseName);
        sendResponse(res, result);
    } catch (error) { next(error); }
};

const createRewardRule = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const { name, spendThreshold, isRepeatable, discountType, discountPercentage, discountAmount, expiryDays, minPurchaseAmount } = req.body;
        if (!name) throw new RequestValidateError('name is required');
        if (!discountType) throw new RequestValidateError('discountType is required');
        const result = await service.createRewardRule(user.databaseName, {
            name, spendThreshold, isRepeatable, discountType, discountPercentage, discountAmount, expiryDays, minPurchaseAmount,
        });
        sendResponse(res, result);
    } catch (error) { next(error); }
};

const updateRewardRule = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const ruleId = parseInt(req.params.id);
        if (isNaN(ruleId)) throw new RequestValidateError('Invalid rule ID');
        const result = await service.updateRewardRule(user.databaseName, ruleId, req.body);
        sendResponse(res, result);
    } catch (error) { next(error); }
};

const deleteRewardRule = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const ruleId = parseInt(req.params.id);
        if (isNaN(ruleId)) throw new RequestValidateError('Invalid rule ID');
        await service.deleteRewardRule(user.databaseName, ruleId);
        sendResponse(res, { success: true });
    } catch (error) { next(error); }
};

// ============================================
// Voucher Endpoints
// ============================================

const getVouchersByCustomerId = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const customerId = parseInt(req.params.customerId);
        if (isNaN(customerId)) throw new RequestValidateError('Invalid customer ID');
        const status = req.query.status as string | undefined;
        const result = await service.getVouchersByCustomerId(user.databaseName, customerId, status);
        sendResponse(res, result);
    } catch (error) { next(error); }
};

const issueVoucher = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const { customerId, discountType, discountPercentage, discountAmount, expiryDays, minPurchaseAmount, label } = req.body;
        if (!customerId) throw new RequestValidateError('customerId is required');
        if (!discountType) throw new RequestValidateError('discountType is required');
        if (!label) throw new RequestValidateError('label is required');
        if (!expiryDays) throw new RequestValidateError('expiryDays is required');
        const result = await service.issueVoucher(user.databaseName, {
            customerId, discountType, discountPercentage, discountAmount, expiryDays, minPurchaseAmount, label,
        });
        sendResponse(res, result);
    } catch (error) { next(error); }
};

// ============================================
// Route Registration
// ============================================

router.get('/rules', requireLoyalty('basic'), getRewardRules);
router.post('/rule', requireLoyalty('basic'), createRewardRule);
router.put('/rule/:id', requireLoyalty('basic'), updateRewardRule);
router.delete('/rule/:id', requireLoyalty('basic'), deleteRewardRule);
router.get('/customer/:customerId', requireLoyalty('basic'), getVouchersByCustomerId);
router.post('/issue', requireLoyalty('basic'), issueVoucher);

module.exports = router;
