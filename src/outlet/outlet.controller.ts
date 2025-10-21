import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./outlet.service"
import { Category } from "../../prisma/client/generated/client"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { AuthRequest } from "../middleware/auth-request"

const router = express.Router()

let getAll = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    service.getAll(req.user.databaseName)
        .then((response: any) => {
            sendResponse(res, response);
        })
        .catch(next)
}

//routes
router.get("/", getAll)
export = router