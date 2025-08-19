import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./role.service"
import { Category, RolePermission, Role } from "@tenant-prisma"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { AuthRequest } from "../middleware/auth-request"
import { AssignRoleRequestBody, CreateRoleRequestBody } from "./role.request"
import { SyncRequest } from "src/item/item.request"

const router = express.Router()

let getAllRole = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    const syncRequest: SyncRequest = {
        lastSyncTimestamp: req.query.lastSyncTimestamp as string,
        lastVersion: req.query.lastVersion ? parseInt(req.query.lastVersion as string) : undefined,
        skip: req.query.skip ? parseInt(req.query.skip as string) : undefined,
        take: req.query.take ? parseInt(req.query.take as string) : undefined,
    };
    service
        .getAll(req.user.databaseName, syncRequest)
        .then(({ roles, total, serverTimestamp }) => sendResponse(res, { data: roles, total, serverTimestamp }))
        .catch(next);
}

let createRole = (req: NetworkRequest<CreateRoleRequestBody>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    const requestBody = req.body
    service.createMany(req.user.databaseName, requestBody)
        .then((response) => {
            sendResponse(res, response)
        })
        .catch(next)
}

let updateRole = (req: NetworkRequest<CreateRoleRequestBody>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }

    // const roleId = parseInt(req.params.roleId);
    // if (!roleId || isNaN(roleId)) {
    //     throw new RequestValidateError('Valid role ID is required');
    // }

    const requestBody = req.body
    service.updateRole(req.user.databaseName, requestBody)
        .then((response) => {
            sendResponse(res, response)
        })
        .catch(next)
}

let getRoleByUserId = (req: NetworkRequest<any>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }

    const userId = parseInt(req.params.userId);
    if (!userId || isNaN(userId)) {
        throw new RequestValidateError('Valid user ID is required');
    }

    // Parse sync parameters from query string (same pattern as permission controller)
    const { skip, take, lastSyncTimestamp } = req.query;
    const skipNum = skip && validator.isNumeric(skip as string) ? parseInt(skip as string) : 0;
    const takeNum = take && validator.isNumeric(take as string) ? parseInt(take as string) : 100;

    const syncRequest = {
        skip: skipNum,
        take: takeNum,
        lastSyncTimestamp: lastSyncTimestamp as string
    };

    service.getRoleByUserId(req.user.databaseName, userId, syncRequest)
        .then(({ data, total, serverTimestamp }) => {
            sendResponse(res, { data, total, serverTimestamp });
        })
        .catch(next);
}

let assignRole = (req: NetworkRequest<AssignRoleRequestBody>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }

    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty');
    }

    const userId = parseInt(req.params.userId);
    if (!userId || isNaN(userId)) {
        throw new RequestValidateError('Valid user ID is required');
    }

    const requestBody = req.body;
    if (!requestBody.roleIds || !Array.isArray(requestBody.roleIds) || requestBody.roleIds.length === 0) {
        throw new RequestValidateError('At least one role ID is required');
    }

    // Validate all role IDs are numbers
    for (const roleId of requestBody.roleIds) {
        if (!Number.isInteger(roleId) || roleId <= 0) {
            throw new RequestValidateError('All role IDs must be valid positive integers');
        }
    }

    service.assignRoleToUser(req.user.databaseName, userId, requestBody.roleIds)
        .then((response: any) => {
            sendResponse(res, response);
        })
        .catch(next);
}

let removeRole = (req: NetworkRequest<AssignRoleRequestBody>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }

    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty');
    }

    const userId = parseInt(req.params.userId);
    if (!userId || isNaN(userId)) {
        throw new RequestValidateError('Valid user ID is required');
    }

    const requestBody = req.body;
    if (!requestBody.roleIds || !Array.isArray(requestBody.roleIds) || requestBody.roleIds.length === 0) {
        throw new RequestValidateError('At least one role ID is required');
    }

    // Validate all role IDs are numbers
    for (const roleId of requestBody.roleIds) {
        if (!Number.isInteger(roleId) || roleId <= 0) {
            throw new RequestValidateError('All role IDs must be valid positive integers');
        }
    }
    service.removeRoleFromUser(req.user.databaseName, userId, requestBody.roleIds)
        .then((response: any) => {
            sendResponse(res, response);
        })
        .catch(next);
}

let getAllUsersByRoleID = (req: NetworkRequest<any>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    const roleId = parseInt(req.params.roleId);
    if (!roleId || isNaN(roleId)) {
        throw new RequestValidateError('Valid role ID is required');
    }
    service.getUsersByRoleId(req.user.databaseName, roleId)
        .then(({ data }) => {
            sendResponse(res, { data });
        })
        .catch(next);
}

//routes
router.get('/sync', getAllRole)
router.get('/user/:userId', getRoleByUserId)
router.get('/users/:roleId', getAllUsersByRoleID)
router.post('/create', createRole)
router.put('/update', updateRole)
router.post('/assign/:userId', assignRole)
router.post('/remove/:userId', removeRole)
export = router