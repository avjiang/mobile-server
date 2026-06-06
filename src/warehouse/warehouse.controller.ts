import express, { NextFunction, Response } from "express";
import service from "./warehouse.service";
import * as stockService from "./warehouse-stock.service";
import { RequestValidateError } from "../api-helpers/error";
import { sendResponse } from "../api-helpers/network";
import { AuthRequest } from "../middleware/auth-request";
import { requirePlan } from "../middleware/require-plan.middleware";
import { SyncWarehouseRequest } from "./warehouse.request";
import {
    WarehouseStockReceiveBody,
    WarehouseStockAdjustment,
    WarehouseStockClearance,
} from "./warehouse-stock.request";
import validator from "validator";

const router = express.Router();

// Warehouse is a Pro-only feature — gate the entire router (closes audit gap G6).
router.use(requirePlan("Pro"));

const warehouseIdParam = (req: AuthRequest): number => {
    const id = parseInt(req.params.id);
    if (!id || isNaN(id)) throw new RequestValidateError("Valid warehouse ID is required");
    return id;
};

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

    const warehouseId = warehouseIdParam(req);

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

    const warehouseId = warehouseIdParam(req);

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

/**
 * POST /warehouses/:id/receive
 * Receive stock into a warehouse (self-service for Pro tenants).
 * Body: { items: [{ itemId, itemVariantId?, quantity, cost?, remark? }], reason? }
 */
let receiveStock = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated");
    const warehouseId = warehouseIdParam(req);

    const body: WarehouseStockReceiveBody = {
        warehouseId,
        items: req.body.items,
        reason: req.body.reason,
        performedBy: req.user.username,
    };

    stockService
        .receiveWarehouseStock(req.user.databaseName, body)
        .then((result) => sendResponse(res, { success: true, ...result }))
        .catch(next);
};

/**
 * POST /warehouses/:id/adjust
 * Adjust warehouse stock (+/- delta or absolute override).
 * Body: { adjustments: [{ itemId, itemVariantId?, adjustQuantity? | overrideQuantity?, cost?, reason?, remark? }] }
 */
let adjustStock = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated");
    const warehouseId = warehouseIdParam(req);

    const incoming: WarehouseStockAdjustment[] = Array.isArray(req.body.adjustments)
        ? req.body.adjustments
        : [];
    const adjustments = incoming.map((a) => ({
        ...a,
        warehouseId,
        performedBy: req.user!.username,
    }));

    stockService
        .adjustWarehouseStock(req.user.databaseName, adjustments)
        .then((result) => sendResponse(res, { success: true, ...result }))
        .catch(next);
};

/**
 * POST /warehouses/:id/clear
 * Clear a single warehouse balance to zero.
 * Body: { itemId, itemVariantId?, reason?, remark? }
 */
let clearStock = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated");
    const warehouseId = warehouseIdParam(req);

    const clearance: WarehouseStockClearance = {
        warehouseId,
        itemId: req.body.itemId,
        itemVariantId: req.body.itemVariantId ?? null,
        reason: req.body.reason,
        remark: req.body.remark,
        performedBy: req.user.username,
    };

    if (!clearance.itemId) throw new RequestValidateError("itemId is required");

    stockService
        .clearWarehouseStock(req.user.databaseName, clearance)
        .then((result) => sendResponse(res, { success: true, ...result }))
        .catch(next);
};

// Routes
router.get('/sync', getAllWarehouses);
router.get('/:id', getWarehouseById);
router.get('/:id/stock', getWarehouseStock);
router.post('/:id/receive', receiveStock);
router.post('/:id/adjust', adjustStock);
router.post('/:id/clear', clearStock);

export = router;
