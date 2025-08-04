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

// routes
router.get('/generate', generateReport)
export = router