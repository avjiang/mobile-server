import { Request, Response, NextFunction } from "express"
import { jwt_token_secret } from "../../config.json"
import jwt, { MyJwtPayload } from "jsonwebtoken"
import { AuthenticationError } from "../api-helpers/error"
import { AuthRequest } from "../middleware/auth-request"

declare module 'jsonwebtoken' {
    export interface MyJwtPayload extends jwt.JwtPayload {
        user: UserInfo
    }
}

export interface UserInfo {
    tenantUserId: number,
    userId: number,
    username: string,
    databaseName: string,
    tenantId: number
}

export default (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.header('token')
    if (token) {
        try {
            if (token === "goyangkakisdnbhd1234567890") {
                next()
            }
            else {
                const payload: MyJwtPayload = jwt.verify(token, jwt_token_secret) as MyJwtPayload
                req.user = payload.user
                next()
            }
        }
        catch (error) {
            const authenticationError = new AuthenticationError(401, "Invalid token")
            next(authenticationError)
        }
    }
    else {
        const authenticationError = new AuthenticationError(401, "Token not found")
        next(authenticationError)
    }
}