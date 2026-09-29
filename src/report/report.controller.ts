import express, { NextFunction, Request, Response } from "express"
import { clampHistoryStart } from "../middleware/require-plan.middleware"
import validator from "validator"
import service from "./report.service"
import monthlySummaryService from "./monthly-summary.service"
import { Supplier } from "../../prisma/client/generated/client"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { AuthRequest } from "src/middleware/auth-request"
import { requirePermission } from "../middleware/require-permission.middleware"
import { PERMISSION } from "../permission/permission-names"

const router = express.Router()

let generateReport = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }

    // Extract sessionId from query parameters
    const sessionId = req.query.sessionId;

    // Validate sessionId
    if (!sessionId || !validator.isNumeric(sessionId.toString())) {
        throw new RequestValidateError('Valid sessionId is required');
    }

    service.generateReport(req.user.databaseName, parseInt(sessionId.toString()), req.user.planType)
        .then((reportData) => sendResponse(res, reportData))
        .catch(next)
}

let generateOutletReport = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }

    const { outletId, startDate, endDate } = req.query;

    if (!outletId || !validator.isNumeric(outletId.toString())) {
        throw new RequestValidateError('Valid outletId is required');
    }

    // Parse startDate and endDate from query (ISO format)
    let parsedStartDate: Date | undefined = undefined;
    let parsedEndDate: Date | undefined = undefined;
    if (startDate) {
        const d = new Date(startDate.toString());
        if (isNaN(d.getTime())) {
            throw new RequestValidateError('Invalid startDate format');
        }
        parsedStartDate = d;
    }
    if (endDate) {
        const d = new Date(endDate.toString());
        if (isNaN(d.getTime())) {
            throw new RequestValidateError('Invalid endDate format');
        }
        parsedEndDate = d;
    }

    // Retail Lite reports cover the last 30 days only.
    parsedStartDate = clampHistoryStart(req.user.planName, parsedStartDate);

    service.generateOutletReport(
        req.user.databaseName,
        parseInt(outletId.toString()),
        parsedStartDate,
        parsedEndDate,
        req.user.planType
    )
        .then((reportData) => sendResponse(res, reportData))
        .catch(next)
}

let generateLaundryReport = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }

    const sessionId = req.query.sessionId;

    if (!sessionId || !validator.isNumeric(sessionId.toString())) {
        throw new RequestValidateError('Valid sessionId is required');
    }

    service.generateLaundryReport(req.user.databaseName, parseInt(sessionId.toString()))
        .then((reportData) => sendResponse(res, reportData))
        .catch(next)
}

// Monthly value summary (dashboard card): outletId + ISO startDate/endDate,
// the local month converted to UTC by the app, like generateOutletReport.
let generateMonthlySummary = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }

    const { outletId, startDate, endDate } = req.query;
    if (!outletId || !validator.isNumeric(outletId.toString())) {
        throw new RequestValidateError('Valid outletId is required');
    }
    const start = startDate ? new Date(startDate.toString()) : null;
    const end = endDate ? new Date(endDate.toString()) : null;
    if (!start || isNaN(start.getTime()) || !end || isNaN(end.getTime()) || start > end) {
        throw new RequestValidateError('Valid startDate and endDate are required');
    }

    // Retail Lite keeps 30 days of history, the same as its reports.
    const clampedStart = clampHistoryStart(req.user.planName, start) ?? start;

    monthlySummaryService.generateMonthlySummary(
        req.user.databaseName,
        parseInt(outletId.toString()),
        clampedStart,
        end,
        req.user.planType
    )
        .then((summary) => sendResponse(res, summary))
        .catch(next)
}

// routes
router.get('/generate', generateReport)
// Mirrors the frontend gate on the Function screen's "Reports" section
// (AppPermission.viewFinancialReports). Without this the FE gate only hid the
// button — any authenticated user of the tenant could call the endpoint and
// read outlet financials directly.
router.get('/generateOutletReport', requirePermission(PERMISSION.VIEW_FINANCIAL_REPORTS), generateOutletReport)
router.get('/generateLaundryReport', generateLaundryReport)
// Money figures → same permission as the outlet report.
router.get('/monthlySummary', requirePermission(PERMISSION.VIEW_FINANCIAL_REPORTS), generateMonthlySummary)
export = router