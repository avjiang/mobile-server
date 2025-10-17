import express, { NextFunction, Request, Response } from "express";
import service from "./settings.service";
import { Setting } from "../../prisma/client/generated/client";
import NetworkRequest from "../api-helpers/network-request";
import { RequestValidateError } from "../api-helpers/error";
import { sendResponse } from "../api-helpers/network";
import { AuthRequest } from "../middleware/auth-request";
import { SyncSettingsRequest, UpdateSettingRequest } from "./settings.request";

const router = express.Router();

/**
 * GET /settings
 * Get all settings with delta sync support
 * Supports initial sync and incremental updates
 */
let getAll = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }

    const syncRequest: SyncSettingsRequest = {
        lastSyncTimestamp: req.query.lastSyncTimestamp as string,
        outletId: req.query.outletId ? parseInt(req.query.outletId as string) : undefined,
        userId: req.query.userId ? parseInt(req.query.userId as string) : undefined,
        skip: req.query.skip ? parseInt(req.query.skip as string) : undefined,
        take: req.query.take ? parseInt(req.query.take as string) : undefined
    };

    service
        .getAll(req.user.databaseName, req.user.tenantId, syncRequest)
        .then((response) => sendResponse(res, response))
        .catch(next);
};

/**
 * PUT /settings
 * Update a single setting value
 */
let update = (req: NetworkRequest<UpdateSettingRequest>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }

    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty');
    }

    const updateRequest = req.body;

    if (!updateRequest.key) {
        throw new RequestValidateError('Setting key is required');
    }

    if (updateRequest.value === undefined || updateRequest.value === null) {
        throw new RequestValidateError('Setting value is required');
    }

    service
        .update(req.user.databaseName, req.user.tenantId, updateRequest)
        .then((setting: Setting) => sendResponse(res, setting))
        .catch(next);
};

// Routes
router.get('/', getAll);
router.put('/', update);

export = router;
