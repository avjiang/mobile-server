import { Request, Response, NextFunction } from "express"
import { UserInfo } from "../middleware/authorize-middleware"

export interface AuthRequest extends Request {
    user?: UserInfo;
}
