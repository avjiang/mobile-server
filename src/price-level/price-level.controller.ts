// Wholesale pricing — price level routes, mounted at /priceLevel.
// Reads are open (every device syncs the list). Writes are refused on Retail Lite
// (wholesale pricing is Basic and above, FE docs/modules/SALES.md § Wholesale pricing decisions (D5)) with the same
// rejectPlan('Lite') gate as customer create.
import express, { NextFunction, Response } from "express";
import validator from "validator";
import service from "./price-level.service";
import { RequestValidateError } from "../api-helpers/error";
import { sendResponse } from "../api-helpers/network";
import { AuthRequest } from "../middleware/auth-request";
import NetworkRequest from "../api-helpers/network-request";
import { rejectPlan } from "../middleware/require-plan.middleware";
import { SyncRequest } from "../item/item.request";

const router = express.Router();

let getAll = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError('User not authenticated');
    const syncRequest: SyncRequest = {
        lastSyncTimestamp: req.query.lastSyncTimestamp as string,
        lastVersion: req.query.lastVersion ? parseInt(req.query.lastVersion as string) : undefined,
        skip: req.query.skip ? parseInt(req.query.skip as string) : undefined,
        take: req.query.take ? parseInt(req.query.take as string) : undefined,
    };
    service.getAll(req.user.databaseName, syncRequest)
        .then(({ priceLevels, total, serverTimestamp }) => sendResponse(res, { data: priceLevels, total, serverTimestamp }))
        .catch(next);
};

let getById = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError('User not authenticated');
    if (!validator.isNumeric(req.params.id)) throw new RequestValidateError('ID format incorrect');
    service.getById(req.user.databaseName, parseInt(req.params.id))
        .then((level) => sendResponse(res, level))
        .catch(next);
};

let createMany = (req: NetworkRequest<{ priceLevels: Array<{ name?: unknown }> }>, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError('User not authenticated');
    if (!req.body || Object.keys(req.body).length === 0) throw new RequestValidateError('Request body is empty');
    service.createMany(req.user.databaseName, req.body.priceLevels)
        .then((levels) => sendResponse(res, levels))
        .catch(next);
};

let update = (req: NetworkRequest<{ id?: unknown; name?: unknown }>, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError('User not authenticated');
    if (!req.body || Object.keys(req.body).length === 0) throw new RequestValidateError('Request body is empty');
    service.update(req.user.databaseName, req.body)
        .then((level) => sendResponse(res, level))
        .catch(next);
};

let remove = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError('User not authenticated');
    if (!validator.isNumeric(req.params.id)) throw new RequestValidateError('ID format incorrect');
    service.remove(req.user.databaseName, parseInt(req.params.id))
        .then(() => sendResponse(res, "Successfully deleted"))
        .catch(next);
};

router.get('/sync', getAll);
router.get('/:id', getById);
router.post('/create', rejectPlan('Lite'), createMany);
router.put('/update', rejectPlan('Lite'), update);
router.delete('/:id', rejectPlan('Lite'), remove);
export = router;
