import express, { NextFunction, Response } from "express"
import validator from "validator"
import { RequestValidateError, NotFoundError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { AuthRequest } from "../middleware/auth-request"
import { getTenantPrisma } from "../db"
import { requirePlan } from "../middleware/require-plan.middleware"

// F&B kitchen tickets for the KDS (docs/modules/FNB.md, P5, Pro): what each
// station must make, and its status. Per outlet (X-Outlet-ID). The list
// includes deleted tickets (a cancelled bill's) so a delta can drop them.
const router = express.Router()
const STATUSES = ["NEW", "PREPARING", "READY", "SERVED"]

/** GET /kitchen/tickets?since=ISO&stationId=n — tickets changed since, newest first (max 200). */
router.get("/tickets", requirePlan("Pro"), (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    if (!req.outletId) throw new RequestValidateError("Outlet is required")
    const since = typeof req.query.since === "string" && req.query.since ? new Date(req.query.since) : new Date(Date.now() - 12 * 3600_000)
    if (isNaN(since.getTime())) throw new RequestValidateError("since is not a valid date")
    const station = req.query.stationId
    const stationFilter = station === undefined || station === "" ? {}
        : station === "none" ? { stationId: null }
        : { stationId: parseInt(String(station)) }
    const prisma = getTenantPrisma(req.user.databaseName)
    const serverTimestamp = new Date().toISOString()
    prisma.kitchenTicket.findMany({
        where: { outletId: req.outletId, updatedAt: { gte: since }, ...stationFilter },
        orderBy: { createdAt: "desc" },
        take: 200,
    }).then((tickets) => sendResponse(res, { data: tickets, total: tickets.length, serverTimestamp })).catch(next)
})

/** PUT /kitchen/tickets/:id/status {status} — the KDS moves a ticket along. */
router.put("/tickets/:id/status", requirePlan("Pro"), (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new RequestValidateError("User not authenticated")
    if (!validator.isNumeric(req.params.id ?? "")) throw new RequestValidateError("ID format incorrect")
    const status = String(req.body?.status ?? "")
    if (!STATUSES.includes(status)) throw new RequestValidateError(`status must be one of ${STATUSES.join(", ")}`)
    const id = parseInt(req.params.id)
    const prisma = getTenantPrisma(req.user.databaseName)
    prisma.kitchenTicket.findFirst({ where: { id, outletId: req.outletId, deleted: false } })
        .then((t) => {
            if (!t) throw new NotFoundError("Kitchen ticket")
            return prisma.kitchenTicket.update({ where: { id }, data: { status, version: { increment: 1 } } })
        })
        .then((t) => sendResponse(res, t))
        .catch(next)
})

export = router
