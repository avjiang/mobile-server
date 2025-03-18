import { jwt_token_secret } from "../../config.json"
import jwt, { MyJwtPayload } from "jsonwebtoken"
import { PrismaClient, TenantUser, RefreshToken, Tenant } from "../../node_modules/.prisma/global-client";
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { AuthenticateRequestBody, RefreshTokenRequestBody, TokenRequestBody } from "./auth.request"
import { TokenResponseBody } from "./auth.response"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { UserInfo } from "../middleware/authorize-middleware"
const { getGlobalPrisma, getTenantPrisma, initializeTenantDatabase } = require('../db');

const prisma: PrismaClient = getGlobalPrisma()

let authenticate = async (req: AuthenticateRequestBody, ipAddress: string) => {
    try {
        // Find user based on username
        const user = await prisma.tenantUser.findFirst({
            where: {
                username: req.username,
            },
            include: {
                tenant: true,
            }
        })
        console.log("tenant_db_name: ", user?.tenant?.databaseName)
        // Check if user not found or password mismatched, throw error
        if (!user || !user.password || !bcrypt.compareSync(req.password, user.password)) {
            throw new RequestValidateError('Username or password is incorrect')
        }
        // Authentication successful so generate jwt & refresk tokens
        const jwtToken = generateJwtToken(user, user?.tenant?.databaseName || '')
        const refreshToken = await generateRefreshToken(user, ipAddress)
        const response: TokenResponseBody = {
            token: jwtToken,
            refreshToken: refreshToken.token
        }
        return response
    }
    catch (error) {
        throw error
    }
}

let validateToken = async (req: TokenRequestBody) => {
    try {
        const verified: MyJwtPayload = jwt.verify(req.token, jwt_token_secret) as MyJwtPayload
        const userInfo: UserInfo = verified.user
        return userInfo
    }
    catch (error) {
        throw error
    }
}

let refreshToken = async (req: RefreshTokenRequestBody, ipAddress: string) => {
    try {
        const refreshToken = await getRefreshToken(req.refreshToken)
        const user = await getById(refreshToken.userId)

        // Replace current refresh token with a new one
        const newRefreshToken = await generateRefreshToken(user, ipAddress)
        await revokeToken(req)

        // Generate new jwt
        const jwtToken = generateJwtToken(user, user.tenant?.databaseName ?? '')

        const response: TokenResponseBody = {
            token: jwtToken,
            refreshToken: newRefreshToken.token
        }
        return response
    }
    catch (error) {
        throw error
    }
}

let revokeToken = async (req: RefreshTokenRequestBody) => {
    try {
        const refreshToken = await getRefreshToken(req.refreshToken)

        //revoke token
        const revokedRefreshToken = await prisma.refreshToken.update({
            where: {
                id: refreshToken.id
            },
            data: {
                revoked: new Date(),
                deleted: true
            }
        })
        return revokedRefreshToken
    }
    catch (error) {
        throw error
    }
}

let getRefreshTokens = async (userId: number) => {
    try {
        // Return refresh tokens for user
        const refreshTokens = await prisma.refreshToken.findMany({
            where: {
                userId: userId
            }
        })
        return refreshTokens
    }
    catch (error) {
        throw error
    }
}

// Helper function
let getRefreshToken = async (token: string) => {
    const refreshToken = await prisma.refreshToken.findFirst({
        where: {
            token: token
        }
    })
    if (!refreshToken || !isTokenActive(refreshToken)) {
        throw new RequestValidateError('Invalid refresh token')
    }
    return refreshToken;
}

let randomTokenString = () => {
    return crypto.randomBytes(40).toString('hex');
}

let generateJwtToken = (user: TenantUser, db: string) => {
    // Create a jwt token containing the user info that expires in 15 minutes
    const userInfo: UserInfo = {
        userId: user.id,
        username: user.username,
        databaseName: db
    }
    return jwt.sign({ user: userInfo }, jwt_token_secret, { expiresIn: '1h' });
}

let generateRefreshToken = async (user: TenantUser, ipAddress: string) => {
    //create a refresh token that expires in 1 day
    try {
        var tokenExpiredDate = new Date()
        tokenExpiredDate.setDate(tokenExpiredDate.getDate() + 1)

        const refreshTokenObject = await prisma.refreshToken.create({
            data: {
                userId: user.id,
                token: randomTokenString(),
                expired: tokenExpiredDate,
                createdByIP: ipAddress
            }
        })
        return refreshTokenObject
    }
    catch (e) {
        throw e
    }
}

function isTokenActive(refreshToken: RefreshToken) {
    if (!refreshToken.expired) {
        return false
    }
    const isExpired = new Date() >= refreshToken.expired
    return !refreshToken.revoked && !isExpired
}

let getById = async (id: number) => {
    try {
        const user = await prisma.tenantUser.findUnique({
            where: {
                id: id
            },
            include: {
                tenant: true,
            }
        })
        if (!user) {
            throw new NotFoundError("User")
        }
        return user
    }
    catch (error) {
        throw error
    }
}

export = { authenticate, validateToken, revokeToken, refreshToken, getRefreshTokens }