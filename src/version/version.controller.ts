
import express, { NextFunction, Request, Response } from "express"
import service from "./version.service"
import { sendResponse } from "../api-helpers/network"
import { RequestValidateError } from "../api-helpers/error"

const router = express.Router()

const checkVersion = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const platform = req.query.platform as string;
        if (!platform) {
            throw new RequestValidateError('Platform is required');
        }

        const version = await service.getVersion(platform);
        if (!version) {
            throw new RequestValidateError('Version info not found for this platform');
        }
        sendResponse(res, version);
    } catch (error) {
        next(error);
    }
}

router.get('/check', checkVersion);

export = router
