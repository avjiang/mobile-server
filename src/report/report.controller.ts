import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./report.service"
import { Supplier } from "../../prisma/client"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { AuthRequest } from "src/middleware/auth-request"

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

    service.generateReport(req.user.databaseName, parseInt(sessionId.toString()))
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

    service.generateOutletReport(
        req.user.databaseName,
        parseInt(outletId.toString()),
        parsedStartDate,
        parsedEndDate
    )
        .then((reportData) => sendResponse(res, reportData))
        .catch(next)
}

// routes
router.get('/generate', generateReport)
router.get('/generateOutletReport', generateOutletReport)
export = router