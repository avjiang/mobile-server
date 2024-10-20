import { Declaration, PrismaClient } from "@prisma/client"
import { NotFoundError } from "../api-helpers/error"
import { CloseSessionRequest, OpenSessionRequest } from "./session.request"

const prisma = new PrismaClient()
let getDeclarationsBySessionID = async (sessionID: number) => {
    try {
        const session = await prisma.session.findUnique({
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

let getSessionByID = async (sessionID: number) => {
    try {
        const session = await prisma.session.findUnique({
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

let createSession = async (openSessionRequest: OpenSessionRequest) => {
    try {
        const createdSession = await prisma.session.create({
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

let createDeclarations = async (declarations: Declaration[]) => {
    try {
        const createdDeclarations = await prisma.declaration.createMany({
            data: declarations
        })

        return createdDeclarations.count
    }
    catch (error) {
        throw error
    }
}

let closeSession = async (closeSessionRequest: CloseSessionRequest) => {
    try {
        var isSuccess = false
        await prisma.$transaction(async (tx) => {
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