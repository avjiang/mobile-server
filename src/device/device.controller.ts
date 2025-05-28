import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./device.service"
import { Customer } from "@prisma/client"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { RegisterDeviceRequest } from "./device.request"
import { AuthRequest } from "../middleware/auth-request"

const router = express.Router()

let registerDevice = (req: NetworkRequest<RegisterDeviceRequest>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    const deviceRequest = req.body
    service.registerDevice(req.user.databaseName, deviceRequest)
        .then((siteId) => sendResponse(res, siteId))
        .catch(next)
}

//routes
router.post("/register", registerDevice)

export = router