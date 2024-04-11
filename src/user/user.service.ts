import { User, PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"

const prisma = new PrismaClient()

let getAll = async () => {
    try {
        const users = await prisma.user.findMany()
        return users
    }
    catch (error) {
        throw error
    }
}

let getById = async (id: number) => {
    try {
        const user = await prisma.user.findUnique({
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

let create = async (user: User) => {
    try {
        const newUser = await prisma.user.create({
            data: {
                username: user.username,
                password: bcrypt.hashSync(user.password, 10),
                lastName: user.lastName,
                firstName: user.firstName,
                mobile: user.mobile,
                email: user.email,
                role: user.role
            }
        })
        return newUser
    }
    catch (error) {
        throw error
    }
}

let update = async (user: User) => {
    try {
        const updatedUser = await prisma.user.update({
            where: {
                id: user.id
            },
            data: {
                lastName: user.lastName,
                firstName: user.firstName,
                mobile: user.mobile,
                email: user.email,
                role: user.role
            }
        })
        return updatedUser
    }
    catch (error) {
        throw error
    }
}

let remove = async (id: number) => {
    try {
        const updatedUser = await prisma.user.update({
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

let changePassword = async (userId: number, currentPassword: string, newPassword: string) => {
    try {
        const user = await getById(userId)

        //check if current password mismatched, throw error
        if (!bcrypt.compareSync(currentPassword, user.password)) {
            throw new RequestValidateError('Password is incorrect') 
        }

        const updatedUser = await prisma.user.update({
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