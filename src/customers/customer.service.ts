import { PrismaClient, Customer } from "@prisma/client"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"

const prisma = new PrismaClient()

let getAll = async () => {
    try {
        const customers = await prisma.customer.findMany()
        return customers
    }
    catch (error) {
        throw error
    }
}

let getById = async (id: number) => {
    try {
        const customer = await prisma.customer.findUnique({
            where: {
                id: id
            }
        })
        if (!customer) {
            throw new NotFoundError("Customer") 
        }
        return customer
    }
    catch (error) {
        throw error
    }
}

let createMany = async (customers: Customer[]) => {
    try {
        const newCustomers = await prisma.customer.createMany({
            data: customers
        })

        return newCustomers.count
    }
    catch (error) {
        throw error
    }
}

let update = async (customer: Customer) => {
    try {
        const updatedCustomer = await prisma.customer.update({
            where: {
                id: customer.id
            },
            data: customer
        })
        return updatedCustomer
    }
    catch (error) {
        throw error
    }
}

let remove = async (id: number) => {
    try {
        const updatedCustomer = await prisma.customer.update({
            where: {
                id: id
            },
            data: {
                deleted: true
            }
        })
        return updatedCustomer
    }
    catch (error) {
        throw error
    }
}

export = { getAll, getById, createMany, update, remove }