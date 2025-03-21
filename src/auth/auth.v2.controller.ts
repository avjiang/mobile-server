import express, { NextFunction, Request, Response } from "express";
import authService from "./auth.v2.service";
import authorizeMiddleware, { UserInfo } from "../middleware/authorize-middleware";
import NetworkRequest from "../api-helpers/network-request";
import { AuthenticateRequestBody, RefreshTokenRequestBody, TokenRequestBody } from "./auth.request";
import { TokenResponseBody, ValidateTokenResponseBody } from "./auth.response";
import { PrismaClient, TenantUser, RefreshToken, Tenant } from "../../node_modules/.prisma/global-client";
import { sendResponse } from "../api-helpers/network";
import { RequestValidateError } from "../api-helpers/error";
import validator from "validator";
import { AuthRequest } from "../middleware/auth-request";

const router = express.Router()

let authenticate = (req: NetworkRequest<AuthenticateRequestBody>, res: Response, next: NextFunction) => {
    const authenticateBody = req.body

    if (!authenticateBody) {
        throw new RequestValidateError('Login failed: body data missing')
    }
    if (!authenticateBody.username) {
        throw new RequestValidateError('Login failed: [username] not found')
    }
    if (!authenticateBody.password) {
        throw new RequestValidateError('Login failed: [password] not found')
    }
    const ipAddress = req.ip
    authService.authenticate(authenticateBody, ipAddress)
        .then((response: TokenResponseBody) => sendResponse(res, response))
        .catch(next)
}

let validateToken = (req: NetworkRequest<TokenRequestBody>, res: Response, next: NextFunction) => {
    const tokenBody = req.body

    if (!tokenBody) {
        throw new RequestValidateError('Validate failed: body data missing')
    }

    if (!tokenBody.token) {
        throw new RequestValidateError('Validate failed: [token] not found')
    }

    authService.validateToken(tokenBody)
        .then((userInfo: UserInfo) => {
            const response: ValidateTokenResponseBody = {
                verified: true,
                tenantUserId: userInfo.tenantUserId,
                userId: userInfo.userId,
                username: userInfo.username
            }
            sendResponse(res, response)
        })
        .catch(next)
}

let refreshToken = (req: NetworkRequest<RefreshTokenRequestBody>, res: Response, next: NextFunction) => {
    const tokenBody = req.body

    if (!tokenBody) {
        throw new RequestValidateError('Validate failed: body data missing')
    }

    if (!tokenBody.refreshToken) {
        throw new RequestValidateError('Validate failed: [refreshToken] not found')
    }

    const ipAddress = req.ip
    authService.refreshToken(tokenBody, ipAddress)
        .then((response: TokenResponseBody) => sendResponse(res, response))
        .catch(next)
}

let revokeToken = (req: NetworkRequest<RefreshTokenRequestBody>, res: Response, next: NextFunction) => {
    const tokenBody = req.body

    if (!tokenBody) {
        throw new RequestValidateError('Validate failed: body data missing')
    }

    if (!tokenBody.refreshToken) {
        throw new RequestValidateError('Validate failed: [refreshToken] not found')
    }

    authService.revokeToken(tokenBody)
        .then((revokedToken: RefreshToken) => sendResponse(res, revokedToken))
        .catch(next)
}

let getRefreshTokens = (req: Request, res: Response, next: NextFunction) => {
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('User ID format incorrect')
    }
    const userId: number = parseInt(req.params.id)
    authService.getRefreshTokens(userId)
        .then((refreshTokens: RefreshToken[]) => sendResponse(res, refreshTokens))
        .catch(next)
}


//routes
router.post('/login', authenticate)
router.post('/validate-token', validateToken)
router.post('/refresh-token', refreshToken)
router.post('/refresh-token', refreshToken)
router.post('/revoke-token', authorizeMiddleware, revokeToken)
router.get('/:id/refresh-tokens', authorizeMiddleware, getRefreshTokens)

export = router