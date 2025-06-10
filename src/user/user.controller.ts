import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./user.service"
import { User } from "@prisma/client"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { ChangePasswordRequestBody } from "../auth/auth.request"
import { sendResponse } from "../api-helpers/network"
import { AuthRequest } from "src/middleware/auth-request"

const router = express.Router()

let getAll = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    service.getAll(req.user.databaseName)
        .then((users: User[]) => {
            const userList = users.map(user => basicDetails(user))
            sendResponse(res, userList)
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
    const userId: number = parseInt(req.params.id)
    service.getById(req.user.databaseName, userId)
        .then((user: User) => sendResponse(res, basicDetails(user)))
        .catch(next)
}

let create = (req: NetworkRequest<User>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }

    const user = req.body

    if (!user) {
        throw new RequestValidateError('Create failed: data missing')
    }

    if (!user.username) {
        throw new RequestValidateError('Create failed: [username] not found')
    }

    if (!user.password) {
        throw new RequestValidateError('Create failed: [password] not found')
    }

    if (isValidPassword(user.password)) {
        throw new RequestValidateError('Create failed: [password] format incorrect')
    }

    // if (!user.role) {
    //     throw new RequestValidateError('Create failed: [role] not found')
    // }

    if (user.email && !validator.isEmail(user.email)) {
        throw new RequestValidateError('Create failed: [email] format incorrect')
    }

    service.create(req.user.databaseName, user)
        .then((user: User) => sendResponse(res, basicDetails(user)))
        .catch(next)
}

let update = (req: NetworkRequest<User>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }

    const user = req.body

    if (!user) {
        throw new RequestValidateError('Update failed: data missing')
    }

    if (!user.id) {
        throw new RequestValidateError('Update failed: [id] not found')
    }

    if (user.email && !validator.isEmail(user.email)) {
        throw new RequestValidateError('Update failed: [email] format incorrect')
    }
    service.update(req.user.databaseName, user)
        .then((user: User) => sendResponse(res, "Successfully updated"))
        .catch(next)
}

let remove = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }

    const userId: number = parseInt(req.params.id)
    service.remove(req.user.databaseName, userId)
        .then((user: User) => sendResponse(res, "Successfully deleted"))
        .catch(next)
}


let changePassword = (req: NetworkRequest<ChangePasswordRequestBody>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }

    const changePasswordRequest = req.body

    if (!changePasswordRequest) {
        throw new RequestValidateError('Change password failed: body data missing')
    }

    if (!changePasswordRequest.userId) {
        throw new RequestValidateError('Change password failed: No user found')
    }

    if (!changePasswordRequest.currentPassword) {
        throw new RequestValidateError('Change password failed: current password not found')
    }

    if (!changePasswordRequest.newPassword) {
        throw new RequestValidateError('Change password failed: new password not found')
    }

    service.changePassword(req.user.databaseName, changePasswordRequest.userId, changePasswordRequest.currentPassword, changePasswordRequest.newPassword)
        .then((user: User) => sendResponse(res, { result: true }))
        .catch(next)
}


// helper function
let basicDetails = (user: User) => {
    const { id, firstName, lastName, mobile, email } = user;
    return { id, firstName, lastName, mobile, email, };
}

let isValidPassword = (password: string) => {
    return validator.isAlphanumeric(password) && validator.isLength(password, { min: 6 });
}

//routes
router.get("/", getAll)
router.get('/:id', getById)
router.post('/create', create)
router.put('/update', update)
router.delete('/:id', remove)
router.post('/change-password', changePassword)
export = router
