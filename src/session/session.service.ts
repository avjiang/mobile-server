import { Declaration, PrismaClient } from "@prisma/client"
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

let createSession = async (openSessionRequest: OpenSessionRequest, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const createdSession = await tenantPrisma.session.create({
            data: {
                outletId: openSessionRequest.outletId,
                businessDate: openSessionRequest.businessDate,
                openingDateTime: openSessionRequest.openingDateTime,
                openByUserID: openSessionRequest.openByUserID,
                openingAmount: openSessionRequest.openingAmount,
                totalSalesCount: 0,
                closeByUserID: 0
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
                    closeByUserID: closeSessionRequest.closeByUserID
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
    createSession,
    createDeclarations,
    closeSession
}