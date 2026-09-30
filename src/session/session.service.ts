import { Declaration, PrismaClient } from "../../prisma/client/generated/client"
import { NotFoundError } from "../api-helpers/error"
import { CloseSessionRequest, OpenSessionRequest } from "./session.request"
import { getTenantPrisma } from '../db';

let getDeclarationsBySessionID = async (sessionID: number, databaseName: string, outletId?: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // Outlet-scoped read: findFirst({ id, outletId }) prevents cross-outlet IDOR (matches write-path scoping).
        const session = await tenantPrisma.session.findFirst({
            where: {
                id: sessionID,
                outletId: outletId
            },
            include: {
                declarations: true
            }
        })
        if (!session) {
            throw new NotFoundError("Session")
        }

        const { declarations, ...sessionWithoutDeclarations } = session
        return declarations
    }
    catch (error) {
        throw error
    }
}

let getSessionByID = async (sessionID: number, databaseName: string, outletId?: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // Outlet-scoped read: findFirst({ id, outletId }) prevents cross-outlet IDOR (matches write-path scoping).
        const session = await tenantPrisma.session.findFirst({
            where: {
                id: sessionID,
                outletId: outletId
            },
            include: {
                declarations: true
            }
        })
        if (!session) {
            throw new NotFoundError("Session")
        }
        return session
    }
    catch (error) {
        throw error
    }
}

// Returns the currently-open session for a given (outlet, cashier) pair, or null if none exists.
// Date-agnostic so sessions resume across calendar days and fresh installs.
let getOpenSession = async (outletId: number, openByUserID: number, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const session = await tenantPrisma.session.findFirst({
            where: {
                outletId,
                openByUserID,
                closingDateTime: null
            },
            include: {
                declarations: true
            },
            orderBy: {
                openingDateTime: 'desc'
            }
        })
        return session
    }
    catch (error) {
        throw error
    }
}

let createSession = async (openSessionRequest: OpenSessionRequest, databaseName: string, outletId: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // outletId is the authoritative source from req.outletId (header-driven,
        // validated against allowedOutletIds by the outlet-authz middleware).
        // We ignore openSessionRequest.outletId here to prevent body-vs-header
        // disagreement from creating a session in the wrong outlet.
        const outlet = await tenantPrisma.outlet.findUnique({
            where: { id: outletId },
            select: { id: true, deleted: true }
        });
        if (!outlet || outlet.deleted) {
            throw new NotFoundError("Outlet");
        }

        // Idempotency guard: if an open session already exists for this (outlet, cashier),
        // return it instead of creating a duplicate. Protects against double-tap and
        // multi-device races where the client hasn't yet hydrated from getOpenSession.
        const existing = await tenantPrisma.session.findFirst({
            where: {
                outletId: outletId,
                openByUserID: openSessionRequest.openByUserID,
                closingDateTime: null
            },
            orderBy: {
                openingDateTime: 'desc'
            }
        })
        if (existing) {
            return existing
        }
        const createdSession = await tenantPrisma.session.create({
            data: {
                outletId: outletId,
                businessDate: openSessionRequest.businessDate,
                openingDateTime: openSessionRequest.openingDateTime,
                openByUserID: openSessionRequest.openByUserID,
                openingAmount: openSessionRequest.openingAmount,
                totalSalesCount: 0,
                closeByUserID: 0,
                // Terminal attribution — the terminal that opened this session.
                siteId: openSessionRequest.siteId ?? null
            }
        })
        return createdSession
    }
    catch (error) {
        throw error
    }
}

let createDeclarations = async (declarations: Declaration[], databaseName: string, outletId: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // Declarations are outlet-scoped via their parent session. Every declared
        // session must belong to the requesting outlet — otherwise a user could
        // attach declarations to another outlet's session by guessing its id.
        const sessionIds = Array.from(new Set(declarations.map((d) => d.sessionID)));
        const ownedSessions = await tenantPrisma.session.findMany({
            where: { id: { in: sessionIds }, outletId: outletId },
            select: { id: true }
        });
        if (ownedSessions.length !== sessionIds.length) {
            throw new NotFoundError("Session");
        }
        const createdDeclarations = await tenantPrisma.declaration.createMany({
            data: declarations
        })

        return createdDeclarations.count
    }
    catch (error) {
        throw error
    }
}

let closeSession = async (closeSessionRequest: CloseSessionRequest, databaseName: string, outletId: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        var isSuccess = false
        await tenantPrisma.$transaction(async (tx) => {
            // Scope by outletId so closing another outlet's session by guessing
            // its id surfaces as 404.
            var session = await tx.session.findFirst({
                where: {
                    id: closeSessionRequest.id,
                    outletId: outletId
                }
            })
            if (!session) {
                throw new NotFoundError("Session")
            }

            await tx.session.update({
                where: {
                    id: session.id
                },
                data: {
                    closingDateTime: closeSessionRequest.closingDateTime,
                    totalSalesCount: closeSessionRequest.totalSalesCount,
                    closeByUserID: closeSessionRequest.closeByUserID,
                    // Terminal attribution — the terminal that closed this session.
                    closedBySiteId: closeSessionRequest.siteId ?? null
                }
            })
            isSuccess = true
        })
        return isSuccess

    }
    catch (error) {
        throw error
    }
}

// Latest sessions a user opened (newest first) with their sales count and total — the
// tablet User detail's "Recent sales sessions". Sale statuses counted as sales match
// getTotalSalesData: Completed / Partially Paid / Delivered (voided, returned and
// refunded sales are excluded).
let getRecentSessionsByUser = async (openByUserID: number, limit: number, databaseName: string, outletId?: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // Outlet-scoped like getSessionByID: only the requesting outlet's sessions
        // (outletId undefined → no filter, as for a token without outlet context).
        const sessions = await tenantPrisma.session.findMany({
            where: { openByUserID, outletId, deleted: false },
            orderBy: [{ openingDateTime: 'desc' }, { id: 'desc' }],
            take: limit,
        })
        if (sessions.length === 0) return []

        const totals = await tenantPrisma.sales.groupBy({
            by: ['sessionId'],
            where: {
                sessionId: { in: sessions.map((s) => s.id) },
                deleted: false,
                status: { in: ['Completed', 'Partially Paid', 'Delivered'] },
            },
            _sum: { totalAmount: true },
            _count: { _all: true },
        })
        const bySession = new Map(totals.map((t) => [t.sessionId, t]))

        return sessions.map((s) => {
            const t = bySession.get(s.id)
            return {
                id: s.id,
                outletId: s.outletId,
                businessDate: s.businessDate,
                openingDateTime: s.openingDateTime,
                closingDateTime: s.closingDateTime,
                salesCount: t?._count._all ?? 0,
                totalAmount: t?._sum.totalAmount ? Number(t._sum.totalAmount) : 0,
            }
        })
    }
    catch (error) {
        throw error
    }
}

export = {
    getRecentSessionsByUser,
    getDeclarationsBySessionID,
    getSessionByID,
    getOpenSession,
    createSession,
    createDeclarations,
    closeSession
}