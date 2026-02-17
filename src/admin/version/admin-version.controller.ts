
import express, { NextFunction, Request, Response } from "express"
import service from "../../version/version.service"
import { sendResponse } from "../../api-helpers/network"
import { RequestValidateError } from "../../api-helpers/error"
import { AuthRequest } from "../../middleware/auth-request"

const router = express.Router()

const getVersions = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        // if (!req.user) {
        //     throw new RequestValidateError('User not authenticated');
        // }
        const versions = await service.getVersions();
        sendResponse(res, versions);
    } catch (error) {
        next(error);
    }
}

const updateVersion = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        // if (!req.user) {
        //     throw new RequestValidateError('User not authenticated');
        // }
        const { platform, minVersion, latestVersion, title, message, storeUrl } = req.body;

        if (!platform || !minVersion || !latestVersion) {
            throw new RequestValidateError('Missing required fields: platform, minVersion, latestVersion');
        }

        const version = await service.updateVersion(platform, {
            minVersion,
            latestVersion,
            title,
            message,
            storeUrl
        });
        sendResponse(res, version);
    } catch (error) {
        next(error);
    }
}

router.get('/versions', getVersions);
router.put('/versions', updateVersion);

export = router
