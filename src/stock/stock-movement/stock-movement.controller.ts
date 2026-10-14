import express, { NextFunction, Response } from "express"
import { rejectPlan } from "../../middleware/require-plan.middleware"
import validator from "validator"
import service from "./stock-movement.service"
import { RequestValidateError } from "../../api-helpers/error"
import { sendResponse } from "../../api-helpers/network"
import { AuthRequest } from "src/middleware/auth-request"

const router = express.Router()

let getStockChecksByItemIdAndOutlet = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated')
    }

    const outletId = parseInt(req.query.outletId as string)
    const itemId = req.query.itemId as string
    const itemVariantId = req.query.itemVariantId as string | undefined

    if (!validator.isNumeric(itemId)) {
        throw new RequestValidateError('Item ID format incorrect')
    }

    // Parse itemVariantId: "null" string means null, numeric string means number, undefined means don't filter
    let parsedVariantId: number | null | undefined = undefined;
    if (itemVariantId !== undefined) {
        if (itemVariantId === 'null') {
            parsedVariantId = null;
        } else if (validator.isNumeric(itemVariantId)) {
            parsedVariantId = parseInt(itemVariantId);
        } else {
            throw new RequestValidateError('Item Variant ID format incorrect');
        }
    }

    service.getStockChecksByItemIdAndOutlet(req.user.databaseName, parseInt(itemId), outletId, parsedVariantId)
        .then((stockCheck: any[]) => sendResponse(res, stockCheck))
        .catch(next)
}

// ── Stock Movement Report ────────────────────────────────────────────────────

// 31 days — the longest range the app can ask for (a calendar month, or the
// Stock Card / by-type From–To picker, which caps at 31 days). The extra hour
// absorbs a daylight-saving shift inside a 31-day local range.
const MAX_RANGE_DAYS = 31;
const MAX_RANGE_MS = (MAX_RANGE_DAYS * 24 + 1) * 60 * 60 * 1000;

/** Validate + parse a bounded outlet + date-range request shared by all 3 report endpoints. */
function parsePeriod(req: AuthRequest): { outletId: number; gte: Date; lte: Date } {
    const outletIdRaw = req.query.outletId as string;
    if (!outletIdRaw || !validator.isNumeric(outletIdRaw)) {
        throw new RequestValidateError('Valid outletId is required');
    }
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    if (!startDate || !validator.isISO8601(startDate) || !endDate || !validator.isISO8601(endDate)) {
        throw new RequestValidateError('Valid ISO8601 startDate and endDate are required');
    }
    const gte = new Date(startDate);
    const lte = new Date(endDate);
    if (gte.getTime() > lte.getTime()) {
        throw new RequestValidateError('startDate must be before endDate');
    }
    // Reject ranges wider than the picker allows — keeps every query bounded (single
    // period) and the report against live data only (older data is backoffice).
    if (lte.getTime() - gte.getTime() > MAX_RANGE_MS) {
        throw new RequestValidateError(`Date range exceeds the ${MAX_RANGE_DAYS}-day maximum`);
    }
    return { outletId: parseInt(outletIdRaw), gte, lte };
}

/** Parse itemVariantId: "null" → null, numeric → number, absent → undefined (don't filter). */
function parseVariantId(req: AuthRequest): number | null | undefined {
    const raw = req.query.itemVariantId as string | undefined;
    if (raw === undefined) return undefined;
    if (raw === 'null') return null;
    if (validator.isNumeric(raw)) return parseInt(raw);
    throw new RequestValidateError('Item Variant ID format incorrect');
}

let getMovementSummary = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError('User not authenticated');
    const { outletId, gte, lte } = parsePeriod(req);
    service.getMovementSummary(req.user.databaseName, outletId, gte, lte)
        .then(data => sendResponse(res, data))
        .catch(next);
}

let getMovementByType = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError('User not authenticated');
    const { outletId, gte, lte } = parsePeriod(req);
    service.getMovementByType(req.user.databaseName, outletId, gte, lte)
        .then(data => sendResponse(res, data))
        .catch(next);
}

let getMovementByTypeDetail = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError('User not authenticated');
    const { outletId, gte, lte } = parsePeriod(req);

    const movementType = req.query.movementType as string;
    if (!movementType || movementType.trim().length === 0) {
        throw new RequestValidateError('movementType is required');
    }

    // Bounded pagination — default 50, hard cap 200 (no unbounded full-table reads).
    const skip = req.query.skip && validator.isNumeric(req.query.skip as string) ? parseInt(req.query.skip as string) : 0;
    let take = req.query.take && validator.isNumeric(req.query.take as string) ? parseInt(req.query.take as string) : 50;
    if (take > 200) take = 200;
    if (take < 1) take = 50;

    service.getMovementByTypeDetail(req.user.databaseName, outletId, movementType, gte, lte, skip, take)
        .then(data => sendResponse(res, data))
        .catch(next);
}

let getStockCard = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError('User not authenticated');
    const { outletId, gte, lte } = parsePeriod(req);

    const itemIdRaw = req.query.itemId as string;
    if (!itemIdRaw || !validator.isNumeric(itemIdRaw)) {
        throw new RequestValidateError('Valid itemId is required');
    }
    const variantId = parseVariantId(req);

    // Bounded pagination — default 50, hard cap 200 (no unbounded full-table reads).
    const skip = req.query.skip && validator.isNumeric(req.query.skip as string) ? parseInt(req.query.skip as string) : 0;
    let take = req.query.take && validator.isNumeric(req.query.take as string) ? parseInt(req.query.take as string) : 50;
    if (take > 200) take = 200;
    if (take < 1) take = 50;

    service.getStockCard(req.user.databaseName, outletId, parseInt(itemIdRaw), variantId, gte, lte, skip, take)
        .then(data => sendResponse(res, data))
        .catch(next);
}

let getInsights = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError('User not authenticated');
    const { outletId, gte, lte } = parsePeriod(req);
    service.getInsights(req.user.databaseName, outletId, gte, lte)
        .then(data => sendResponse(res, data))
        .catch(next);
}

// Laundry supplies currently below zero at the outlet (a supply never blocks a
// wash — see sales.service completeNewSales). No plan gate: any tenant with
// supplies can run short. See docs/modules/STOCK_AND_COST.md.
let getSupplyShortages = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError('User not authenticated');
    const outletIdRaw = req.query.outletId as string;
    if (!outletIdRaw || !validator.isNumeric(outletIdRaw)) {
        throw new RequestValidateError('Valid outletId is required');
    }
    service.getSupplyShortages(req.user.databaseName, parseInt(outletIdRaw))
        .then(data => sendResponse(res, data))
        .catch(next);
}

//routes
router.get('/find', getStockChecksByItemIdAndOutlet)
router.get('/supply-shortages', getSupplyShortages)
router.get('/report/summary', rejectPlan('Lite'), getMovementSummary)
router.get('/report/by-type', rejectPlan('Lite'), getMovementByType)
router.get('/report/by-type-detail', rejectPlan('Lite'), getMovementByTypeDetail)
router.get('/report/card', rejectPlan('Lite'), getStockCard)
router.get('/report/insights', rejectPlan('Lite'), getInsights)
export = router
