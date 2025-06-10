import { User, PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { getTenantPrisma } from '../db';

let getAll = async (databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const users = await tenantPrisma.user.findMany()
        return users
    }
    catch (error) {
        throw error
    }
}

let getById = async (databaseName: string, id: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const user = await tenantPrisma.user.findUnique({
            where: {
                id: id
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

let create = async (databaseName: string, user: User) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const newUser = await tenantPrisma.user.create({
            data: {
                username: user.username,
                password: bcrypt.hashSync(user.password, 10),
                lastName: user.lastName,
                firstName: user.firstName,
                mobile: user.mobile,
                email: user.email,
                // role: user.role
            }
        })
        return newUser
    }
    catch (error) {
        throw error
    }
}

let update = async (databaseName: string, user: User) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const updatedUser = await tenantPrisma.user.update({
            where: {
                id: user.id
            },
            data: {
                lastName: user.lastName,
                firstName: user.firstName,
                mobile: user.mobile,
                email: user.email,
                // role: user.role
            }
        })
        return updatedUser
    }
    catch (error) {
        throw error
    }
}

let remove = async (databaseName: string, id: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const updatedUser = await tenantPrisma.user.update({
            where: {
                id: id
            },
            data: {
                deleted: true
            }
        })
        return updatedUser
    }
    catch (error) {
        throw error
    }
}

let changePassword = async (databaseName: string, userId: number, currentPassword: string, newPassword: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const user = await getById(databaseName, userId)

        //check if current password mismatched, throw error
        if (!bcrypt.compareSync(currentPassword, user.password)) {
            throw new RequestValidateError('Password is incorrect')
        }

        const updatedUser = await tenantPrisma.user.update({
            where: {
                id: user.id
            },
            data: {
                password: bcrypt.hashSync(newPassword, 10)
            }
        })
        return updatedUser
    }
    catch (error) {
        throw error
    }
}

// let createUser = async (username: string, password: string, lastName: string, firstName: string, mobile: string, email: string, role: string) => {
//     try {
//         const user = await prisma.user.create({
//             data: {
//                 username: username,
//                 password: bcrypt.hashSync(password, 10),
//                 lastName: lastName,
//                 firstName: firstName,
//                 mobile: mobile,
//                 email: email,
//                 role: role
//             }
//         })
//         return user
//     }
//     catch (error) {
//         throw error
//     }
// }

export = { getAll, getById, create, update, remove, changePassword }