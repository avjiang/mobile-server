import express, { NextFunction, Response } from "express"
import service from "./device.service"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { AuthRequest } from "../middleware/auth-request"

const router = express.Router()

/**
 * POST /device/register-terminal
 * Idempotent: returns this device's assigned terminal number (siteId),
 * assigning the lowest free one within the tenant on first call. Called by the
 * Flutter app right after login. Body: { clientDeviceId, deviceName?, deviceType?, appVersion? }
 */
const registerTerminal = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated')
    }
    const clientDeviceId = (req.body?.clientDeviceId ?? '').toString().trim()
    if (!clientDeviceId) {
        throw new RequestValidateError('clientDeviceId is required')
    }
    service
        .registerTerminal(req.user.databaseName, req.user.tenantId, {
            clientDeviceId,
            deviceName: req.body?.deviceName,
            deviceType: req.body?.deviceType,
            appVersion: req.body?.appVersion,
        })
        .then(result => sendResponse(res, result))
        .catch(next)
}

// routes
router.post('/register-terminal', registerTerminal)

export = router
