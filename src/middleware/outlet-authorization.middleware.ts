import { Request, Response, NextFunction } from "express";
import { ForbiddenError, RequestValidateError } from "../api-helpers/error";
import { AuthRequest } from "./auth-request";

export const requireOutletAccess = (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        // Extract outletId from body → query → params (in that order)
        const rawOutletId =
            req.body?.outletId ??
            req.query?.outletId ??
            req.params?.outletId ??
            req.headers['x-outlet-id'];

        // Some routes may not have an outlet context, but for those that do, we validate.
        if (rawOutletId !== undefined && rawOutletId !== null) {
            const requestedOutletId = parseInt(String(rawOutletId), 10);

            if (isNaN(requestedOutletId)) {
                throw new RequestValidateError("Invalid Outlet ID");
            }

            // Attach the requested outlet ID to the request for downstream use
            req.outletId = requestedOutletId;

            // Admin users bypass outlet restrictions
            if (req.user?.role !== "admin") {
                const allowedOutletIds = req.user?.allowedOutletIds || [];

                // Check if the user is authorized for this outlet
                if (!allowedOutletIds.includes(requestedOutletId)) {
                    throw new ForbiddenError("Outlet access denied");
                }
            }
        }

        next();
    } catch (error) {
        next(error);
    }
};
