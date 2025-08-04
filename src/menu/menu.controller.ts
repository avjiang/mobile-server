import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./menu.service"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { MenuProfile } from "../../prisma/client"
import { CreateMenuProfileRequestBody } from "./menu.request"

const router = express.Router()

let getAllMenuProfiles = (req: Request, res: Response, next: NextFunction) => {
    service.getAllMenuProfiles()
        .then((menuProfiles: MenuProfile[]) => sendResponse(res, menuProfiles))
        .catch(next)
}

let getMenuProfilesCountByOutletID = (req: Request, res: Response, next: NextFunction) => {
    const outletId = req.query.outletId as string
    if (!outletId) {
        return new RequestValidateError('outletId is required')
    }

    if (!validator.isInt(outletId)) {
        return next(new RequestValidateError("Outlet ID must be an integer"))
    }
    const outletID: number = parseInt(outletId)
    service.getMenuProfilesCountByOutletID(outletID)
        .then((count: number) => sendResponse(res, count))
        .catch(next)
}

let getMenuProfilesByOutletID = (req: Request, res: Response, next: NextFunction) => {
    const outletId = req.query.outletId as string
    if (!outletId) {
        return new RequestValidateError('outletId is required')
    }

    if (!validator.isInt(outletId)) {
        return next(new RequestValidateError("Outlet ID must be an integer"))
    }
    const outletID: number = parseInt(outletId)
    service.getMenuProfilesByOutletID(outletID)
        .then((menuProfiles: MenuProfile[]) => sendResponse(res, menuProfiles))
        .catch(next)
}

let createMenuProfile = (req: NetworkRequest<CreateMenuProfileRequestBody>, res: Response, next: NextFunction) => {
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }

    const menuProfileRequest = req.body

    if (!menuProfileRequest) {
        throw new RequestValidateError('Create failed: data missing')
    }

    service.createMenuProfile(menuProfileRequest.menuProfile)
        .then((isSuccess: boolean) => sendResponse(res, isSuccess))
        .catch(next)
}

let linkMenuProfileToOutlet = (req: Request, res: Response, next: NextFunction) => {
    const outletId = req.query.outletId as string
    const menuProfileId = req.query.menuProfileId as string
    if (!outletId) {
        return new RequestValidateError('outletId is required')
    }

    if (!menuProfileId) {
        return new RequestValidateError('menuProfileId is required')
    }

    if (!validator.isInt(outletId)) {
        return next(new RequestValidateError("Outlet ID must be an integer"))
    }

    if (!validator.isInt(menuProfileId)) {
        return next(new RequestValidateError("Menu Profile ID must be an integer"))
    }
    const outletID: number = parseInt(outletId)
    const menuProfileID: number = parseInt(menuProfileId)
    service.linkMenuProfileToOutlet(menuProfileID, outletID)
        .then((isSuccess: boolean) => sendResponse(res, isSuccess))
        .catch(next)
}

//routes
router.get("/", getAllMenuProfiles)
router.get("/getMenuProfilesCountByOutletID", getMenuProfilesCountByOutletID)
router.get("/getMenuProfilesByOutletID", getMenuProfilesByOutletID)
router.post('/create', createMenuProfile)
router.post('/linkMenuProfileToOutlet', linkMenuProfileToOutlet)
// router.put('/update', update)
export = router