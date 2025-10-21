import express, { NextFunction, Request, Response } from "express";
import service from "./settings.service";
import { Setting } from "../../prisma/client/generated/client";
import NetworkRequest from "../api-helpers/network-request";
import { RequestValidateError } from "../api-helpers/error";
import { sendResponse } from "../api-helpers/network";
import { AuthRequest } from "../middleware/auth-request";
import { SyncSettingsRequest, UpdateSettingRequest, BatchUpdateSettingsRequest } from "./settings.request";

const router = express.Router();

/**
 * GET /settings
 * Get all settings with delta sync support
 * Supports initial sync and incremental updates
 */
let getAllSettings = (req: AuthRequest, res: Response, next: NextFunction) => {
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
        .getAllSettings(req.user.databaseName, req.user.tenantId, syncRequest)
        .then(({ settings, total, serverTimestamp }) => sendResponse(res, { data: settings, total, serverTimestamp }))
        .catch(next);
};

let getAllSettingsDefinition = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    const lastSyncTimestamp = req.query.lastSyncTimestamp as string
    const skip = req.query.skip ? parseInt(req.query.skip as string) : undefined
    const take = req.query.take ? parseInt(req.query.take as string) : undefined

    service
        .getAllSettingDefinitions(lastSyncTimestamp, skip, take)
        .then(({ definitions, total, serverTimestamp }) => sendResponse(res, { data: definitions, total, serverTimestamp }))
        .catch(next);
};

/**
 * PUT /settings/batch
 * Batch update/create settings
 */
let batchUpdateSettings = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }

    const batchRequest: BatchUpdateSettingsRequest = req.body;

    if (!batchRequest.settings || !Array.isArray(batchRequest.settings) || batchRequest.settings.length === 0) {
        throw new RequestValidateError('Settings array is required and must not be empty');
    }

    // Validate each setting has either id or settingDefinitionId
    for (const setting of batchRequest.settings) {
        if (!setting.id && !setting.settingDefinitionId) {
            throw new RequestValidateError('Each setting must have either id or settingDefinitionId');
        }
    }

    service
        .batchUpdateSettings(req.user.databaseName, req.user.tenantId, batchRequest.settings)
        .then(({ updated, serverTimestamp }) => sendResponse(res, { data: updated, serverTimestamp }))
        .catch(next);
};

// Routes
router.get('/sync', getAllSettings);
router.get('/definition/sync', getAllSettingsDefinition);
router.put('/batchUpdate', batchUpdateSettings);

export = router;
