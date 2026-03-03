import express, { Response, NextFunction } from 'express';
import service from './loyalty.service';
import { sendResponse } from '../api-helpers/network';
import { RequestValidateError } from '../api-helpers/error';
import { AuthRequest } from '../middleware/auth-request';
import { UserInfo } from '../middleware/authorize-middleware';
import { requireLoyalty } from '../middleware/loyalty-gate.middleware';

const router = express.Router();

// ============================================
// Program CRUD — gated on basic loyalty (Pro plan)
// ============================================

const getProgram = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const result = await service.getProgram(user.databaseName);
        sendResponse(res, result);
    } catch (error) { next(error); }
};

const createProgram = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const { name, pointsPerCurrency, currencyPerPoint, pointsExpiryDays, minRedeemPoints } = req.body;
        if (!name || !pointsPerCurrency || !currencyPerPoint) {
            throw new RequestValidateError('name, pointsPerCurrency, and currencyPerPoint are required');
        }
        const result = await service.createProgram(user.databaseName, {
            name, pointsPerCurrency, currencyPerPoint, pointsExpiryDays, minRedeemPoints,
        });
        sendResponse(res, result);
    } catch (error) { next(error); }
};

const updateProgram = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const programId = parseInt(req.params.id);
        if (isNaN(programId)) throw new RequestValidateError('Invalid program ID');
        const result = await service.updateProgram(user.databaseName, programId, req.body);
        sendResponse(res, result);
    } catch (error) { next(error); }
};

// ============================================
// Customer Enrollment
// ============================================

const enrollCustomer = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const { customerId, loyaltyProgramId } = req.body;
        if (!customerId || !loyaltyProgramId) {
            throw new RequestValidateError('customerId and loyaltyProgramId are required');
        }
        const result = await service.enrollCustomer(user.databaseName, { customerId, loyaltyProgramId });
        sendResponse(res, result);
    } catch (error) { next(error); }
};

// ============================================
// Account Lookup
// ============================================

const getAccountByCustomerId = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const customerId = parseInt(req.params.id);
        if (isNaN(customerId)) throw new RequestValidateError('Invalid customer ID');
        const result = await service.getAccountByCustomerId(user.databaseName, customerId);
        sendResponse(res, result);
    } catch (error) { next(error); }
};

// ============================================
// Points Operations
// ============================================

const earnPoints = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const accountId = parseInt(req.params.id);
        if (isNaN(accountId)) throw new RequestValidateError('Invalid account ID');
        const { points, salesId, description } = req.body;
        if (!points || points <= 0) throw new RequestValidateError('points must be a positive number');
        const result = await service.earnPoints(
            user.databaseName, accountId,
            { points, salesId, description },
            user.username
        );
        sendResponse(res, result);
    } catch (error) { next(error); }
};

const redeemPoints = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const accountId = parseInt(req.params.id);
        if (isNaN(accountId)) throw new RequestValidateError('Invalid account ID');
        const { points, salesId, description } = req.body;
        if (!points || points <= 0) throw new RequestValidateError('points must be a positive number');
        const result = await service.redeemPoints(
            user.databaseName, accountId,
            { points, salesId, description },
            user.username
        );
        sendResponse(res, result);
    } catch (error) { next(error); }
};

const adjustPoints = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const accountId = parseInt(req.params.id);
        if (isNaN(accountId)) throw new RequestValidateError('Invalid account ID');
        const { points, description } = req.body;
        if (points === undefined || points === 0) throw new RequestValidateError('points must be non-zero');
        if (!description) throw new RequestValidateError('description is required for manual adjustments');
        const result = await service.adjustPoints(
            user.databaseName, accountId,
            { points, description },
            user.username
        );
        sendResponse(res, result);
    } catch (error) { next(error); }
};

// ============================================
// Transaction History
// ============================================

const getTransactions = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const accountId = parseInt(req.params.id);
        if (isNaN(accountId)) throw new RequestValidateError('Invalid account ID');
        const cursor = req.query.cursor ? parseInt(req.query.cursor as string) : undefined;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
        const result = await service.getTransactions(user.databaseName, accountId, { cursor, limit });
        sendResponse(res, result);
    } catch (error) { next(error); }
};

// ============================================
// Tier Management (Advanced only)
// ============================================

const createTier = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const { loyaltyProgramId, name, minSpend, discountPercentage, pointsMultiplier, sortOrder } = req.body;
        if (!loyaltyProgramId || !name || minSpend === undefined) {
            throw new RequestValidateError('loyaltyProgramId, name, and minSpend are required');
        }
        const result = await service.createTier(user.databaseName, {
            loyaltyProgramId, name, minSpend, discountPercentage, pointsMultiplier, sortOrder,
        });
        sendResponse(res, result);
    } catch (error) { next(error); }
};

const updateTier = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const tierId = parseInt(req.params.id);
        if (isNaN(tierId)) throw new RequestValidateError('Invalid tier ID');
        const result = await service.updateTier(user.databaseName, tierId, req.body);
        sendResponse(res, result);
    } catch (error) { next(error); }
};

const deleteTier = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const tierId = parseInt(req.params.id);
        if (isNaN(tierId)) throw new RequestValidateError('Invalid tier ID');
        await service.deleteTier(user.databaseName, tierId);
        sendResponse(res, { success: true, message: 'Tier deleted' });
    } catch (error) { next(error); }
};

const assignTier = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const accountId = parseInt(req.params.id);
        if (isNaN(accountId)) throw new RequestValidateError('Invalid account ID');
        const { loyaltyTierId, isManualTier } = req.body;
        const result = await service.assignTier(user.databaseName, accountId, { loyaltyTierId, isManualTier });
        sendResponse(res, result);
    } catch (error) { next(error); }
};

// ============================================
// Tier List (standalone)
// ============================================

const getTiersByProgramId = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const programId = parseInt(req.params.programId);
        if (isNaN(programId)) throw new RequestValidateError('Invalid program ID');
        const result = await service.getTiersByProgramId(user.databaseName, programId);
        sendResponse(res, result);
    } catch (error) { next(error); }
};

// ============================================
// Expiring Points Preview
// ============================================

const getExpiringPoints = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as UserInfo;
        const accountId = parseInt(req.params.id);
        if (isNaN(accountId)) throw new RequestValidateError('Invalid account ID');
        const days = req.query.days ? parseInt(req.query.days as string) : 30;
        const result = await service.getExpiringPoints(user.databaseName, accountId, days);
        sendResponse(res, result);
    } catch (error) { next(error); }
};

// ============================================
// Routes
// ============================================

// Basic loyalty routes (Pro plan required)
router.get('/program', requireLoyalty('basic'), getProgram);
router.post('/program', requireLoyalty('basic'), createProgram);
router.put('/program/:id', requireLoyalty('basic'), updateProgram);
router.post('/enroll', requireLoyalty('basic'), enrollCustomer);
router.get('/account/customer/:id', requireLoyalty('basic'), getAccountByCustomerId);
router.post('/account/:id/earn', requireLoyalty('basic'), earnPoints);
router.post('/account/:id/redeem', requireLoyalty('basic'), redeemPoints);
router.post('/account/:id/adjust', requireLoyalty('basic'), adjustPoints);
router.get('/account/:id/transactions', requireLoyalty('basic'), getTransactions);
router.get('/account/:id/expiring', requireLoyalty('basic'), getExpiringPoints);

// Advanced loyalty routes (add-on required)
router.get('/tier/program/:programId', requireLoyalty('advanced'), getTiersByProgramId);
router.post('/tier', requireLoyalty('advanced'), createTier);
router.put('/tier/:id', requireLoyalty('advanced'), updateTier);
router.delete('/tier/:id', requireLoyalty('advanced'), deleteTier);
router.put('/account/:id/tier', requireLoyalty('advanced'), assignTier);

module.exports = router;
