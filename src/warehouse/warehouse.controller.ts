import express, { NextFunction, Response } from "express";
import service from "./warehouse.service";
import { RequestValidateError } from "../api-helpers/error";
import { sendResponse } from "../api-helpers/network";
import { AuthRequest } from "../middleware/auth-request";
import { SyncWarehouseRequest } from "./warehouse.request";
import validator from "validator";

const router = express.Router();

/**
 * GET /warehouses/sync
 * Get all warehouses for customer with delta sync support
 */
let getAllWarehouses = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }

    const syncRequest: SyncWarehouseRequest = {
        lastSyncTimestamp: req.query.lastSyncTimestamp as string,
        skip: req.query.skip ? parseInt(req.query.skip as string) : undefined,
        take: req.query.take ? parseInt(req.query.take as string) : undefined,
    };

    service
        .getAll(req.user.databaseName, syncRequest)
        .then(({ warehouses, total, serverTimestamp }) =>
            sendResponse(res, { data: warehouses, total, serverTimestamp })
        )
        .catch(next);
};

/**
 * GET /warehouses/:id
 * Get single warehouse by ID
 */
let getWarehouseById = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }

    const warehouseId = parseInt(req.params.id);
    if (!warehouseId || isNaN(warehouseId)) {
        throw new RequestValidateError('Valid warehouse ID is required');
    }

    service
        .getById(req.user.databaseName, warehouseId)
        .then((warehouse) => sendResponse(res, warehouse))
        .catch(next);
};

/**
 * GET /warehouses/:id/stock
 * Get warehouse stock balance
 */
let getWarehouseStock = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }

    const warehouseId = parseInt(req.params.id);
    if (!warehouseId || isNaN(warehouseId)) {
        throw new RequestValidateError('Valid warehouse ID is required');
    }

    const { skip, take } = req.query;
    const skipNum = skip && validator.isNumeric(skip as string) ? parseInt(skip as string) : 0;
    const takeNum = take && validator.isNumeric(take as string) ? parseInt(take as string) : 100;

    service
        .getWarehouseStock(req.user.databaseName, warehouseId, skipNum, takeNum)
        .then(({ data, total, serverTimestamp }) =>
            sendResponse(res, { data, total, serverTimestamp })
        )
        .catch(next);
};

// Routes
router.get('/sync', getAllWarehouses);
router.get('/:id', getWarehouseById);
router.get('/:id/stock', getWarehouseStock);

export = router;
