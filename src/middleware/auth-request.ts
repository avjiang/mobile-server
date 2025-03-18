import { Request, Response, NextFunction } from "express"
import { UserInfo } from "../middleware/authorize-middleware"
import { getTenantPrisma } from '../db';
import { PrismaClient } from "@prisma/client"

export interface AuthRequest extends Request {
    user?: UserInfo;
}
