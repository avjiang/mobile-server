import { jwt_token_secret } from "../../config.json"
import jwt, { MyJwtPayload } from "jsonwebtoken"
import { PrismaClient, TenantUser, RefreshToken, Tenant } from "../../prisma/global-client/generated/global";
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { AuthenticateRequestBody, RefreshTokenRequestBody, TokenRequestBody } from "./auth.request"
import { TokenResponseBody } from "./auth.response"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { UserInfo } from "../middleware/authorize-middleware"
import { User } from "../../prisma/client/generated/client"
const { getGlobalPrisma, getTenantPrisma } = require('../db');

const prisma: PrismaClient = getGlobalPrisma()

let authenticate = async (req: AuthenticateRequestBody, ipAddress: string) => {
    try {
        // Find user based on username
        const tenantUser = await prisma.tenantUser.findFirst({
            where: {
                username: req.username,
            },
            include: {
                tenant: true,
            }
        })
        // Check if user not found or password mismatched, throw error
        if (!tenantUser || !tenantUser.password || !bcrypt.compareSync(req.password, tenantUser.password)) {
            throw new RequestValidateError('Username or password is incorrect')
        }
        try {
            const tenantPrisma = getTenantPrisma(tenantUser?.tenant?.databaseName || '');
            const customerUser = await tenantPrisma.user.findFirst({
                where: {
                    username: tenantUser.username
                }
            })
            await tenantPrisma.$disconnect();

            // Authentication successful so generate jwt & refresh tokens
            const jwtToken = generateJwtToken(tenantUser, customerUser, tenantUser?.tenant?.databaseName || '')
            const decodedToken = jwt.decode(jwtToken) as { exp?: number };
            const tokenExpiryDate = decodedToken.exp ? new Date(decodedToken.exp * 1000).toISOString() : null;
            const refreshToken = await generateRefreshToken(tenantUser, ipAddress)
            const response: TokenResponseBody = {
                token: jwtToken,
                tokenExpiryDate: tokenExpiryDate ?? "",
                refreshToken: refreshToken.token,
                tenantId: tenantUser?.id || 0,
                userId: customerUser?.id || 0,
            }
            return response
        } catch (error) {
            throw error
        }

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
        const tenantUser = await getById(refreshToken.tenantUserId)

        // Replace current refresh token with a new one
        const newRefreshToken = await generateRefreshToken(tenantUser, ipAddress)
        await revokeToken(req)

        const tenantPrisma = getTenantPrisma(tenantUser?.tenant?.databaseName || '');
        const customerUser = await tenantPrisma.user.findFirst({
            where: {
                username: tenantUser.username
            }
        })

        // Generate new jwt
        const jwtToken = generateJwtToken(tenantUser, customerUser, tenantUser.tenant?.databaseName ?? '')
        const decodedToken = jwt.decode(jwtToken) as { exp?: number };
        const tokenExpiryDate = decodedToken.exp ? new Date(decodedToken.exp * 1000).toISOString() : null;
        const response: TokenResponseBody = {
            token: jwtToken,
            tokenExpiryDate: tokenExpiryDate ?? "",
            refreshToken: newRefreshToken.token,
            tenantId: tenantUser?.id || 0,
            userId: customerUser?.id || 0
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
                tenantUserId: userId
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

let generateJwtToken = (tenantUser: TenantUser, user: User, db: string) => {
    // Create a jwt token containing the user info that expires in 15 minutes
    const userInfo: UserInfo = {
        tenantUserId: tenantUser.id,
        userId: user.id,
        username: tenantUser.username,
        databaseName: db,
        tenantId: tenantUser.tenantId,
        role: tenantUser.username === "avjiang" ? "admin" : "user"
    }
    // return jwt.sign({ user: userInfo }, jwt_token_secret, { expiresIn: '1d' }); // add expiration date
    return jwt.sign({ user: userInfo }, jwt_token_secret);
}

let generateRefreshToken = async (user: TenantUser, ipAddress: string) => {
    //create a refresh token that expires in 1 day
    try {
        var tokenExpiredDate = new Date()
        tokenExpiredDate.setDate(tokenExpiredDate.getDate() + 1)

        const refreshTokenObject = await prisma.refreshToken.create({
            data: {
                tenantUserId: user.id,
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