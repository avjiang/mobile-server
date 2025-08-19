import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./outlet.service"
import { Category } from "@tenant-prisma"
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

let getById = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }
    const categoryId: number = parseInt(req.params.id)
    service.getById(req.user.databaseName, categoryId)
        .then((category: Category) => sendResponse(res, category))
        .catch(next)
}

//routes
router.get("/", getAll)
router.get('/:id', getById)
export = router