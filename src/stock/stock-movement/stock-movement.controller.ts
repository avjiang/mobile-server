import express, { NextFunction, Response } from "express"
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

const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000; // ~12 months — the in-app picker cap

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
        throw new RequestValidateError('Date range exceeds the 12-month maximum');
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

//routes
router.get('/find', getStockChecksByItemIdAndOutlet)
router.get('/report/summary', getMovementSummary)
router.get('/report/by-type', getMovementByType)
router.get('/report/by-type-detail', getMovementByTypeDetail)
router.get('/report/card', getStockCard)
router.get('/report/insights', getInsights)
export = router
