import { Declaration, PrismaClient } from "../../prisma/client/generated/client"
import { NotFoundError } from "../api-helpers/error"
import { CloseSessionRequest, OpenSessionRequest } from "./session.request"
import { getTenantPrisma } from '../db';

let getDeclarationsBySessionID = async (sessionID: number, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const session = await tenantPrisma.session.findUnique({
            where: {
                id: sessionID
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

let getSessionByID = async (sessionID: number, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const session = await tenantPrisma.session.findUnique({
            where: {
                id: sessionID
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

let createSession = async (openSessionRequest: OpenSessionRequest, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // Idempotency guard: if an open session already exists for this (outlet, cashier),
        // return it instead of creating a duplicate. Protects against double-tap and
        // multi-device races where the client hasn't yet hydrated from getOpenSession.
        const existing = await tenantPrisma.session.findFirst({
            where: {
                outletId: openSessionRequest.outletId,
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
                outletId: openSessionRequest.outletId,
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

let createDeclarations = async (declarations: Declaration[], databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const createdDeclarations = await tenantPrisma.declaration.createMany({
            data: declarations
        })

        return createdDeclarations.count
    }
    catch (error) {
        throw error
    }
}

let closeSession = async (closeSessionRequest: CloseSessionRequest, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        var isSuccess = false
        await tenantPrisma.$transaction(async (tx) => {
            var session = await tx.session.findUnique({
                where: {
                    id: closeSessionRequest.id
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

export = {
    getDeclarationsBySessionID,
    getSessionByID,
    getOpenSession,
    createSession,
    createDeclarations,
    closeSession
}