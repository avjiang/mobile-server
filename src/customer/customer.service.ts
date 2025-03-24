import { PrismaClient, Customer } from "@prisma/client"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { getTenantPrisma } from '../db';

let getAll = async (databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const customers = await tenantPrisma.customer.findMany()
        return customers
    }
    catch (error) {
        throw error
    }
}

let getById = async (databaseName: string, id: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const customer = await tenantPrisma.customer.findUnique({
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

let createMany = async (databaseName: string, customers: Customer[]) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const newCustomers = await tenantPrisma.customer.createMany({
            data: customers
        })

        return newCustomers.count
    }
    catch (error) {
        throw error
    }
}

let update = async (databaseName: string, customer: Customer) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const updatedCustomer = await tenantPrisma.customer.update({
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

let remove = async (databaseName: string, id: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const updatedCustomer = await tenantPrisma.customer.update({
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