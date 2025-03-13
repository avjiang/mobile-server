import { PrismaClient, Tenant, TenantUser, SubscriptionPlan } from "../../node_modules/.prisma/global-client";
import { plainToInstance } from "class-transformer"
import { TenantDto, TenantCreationDto } from "./tenant.response"
const { getGlobalPrisma, getTenantPrisma, initializeTenantDatabase } = require('../db');

const prisma: PrismaClient = getGlobalPrisma()

let getAll = async () => {
    try {
        const tenants = await prisma.tenant.findMany({
            include: {
                plan: {
                    select: {
                        planName: true
                    }
                }
            }
        })
        const tenantsObject = plainToInstance(TenantDto, tenants, { excludeExtraneousValues: true })
        return tenantsObject
    }
    catch (error) {
        throw error
    }
}

let create = async (tenant: Tenant) => {
    try {
        const databaseName = `${tenant.tenantName.toLowerCase().replace(/\s/g, '_')}_db`;
        tenant.databaseName = databaseName
        const newTenant = await prisma.tenant.create({
            data: tenant,
            include: {
                plan: true
            }
        })
        const username = tenant.tenantName.toLowerCase().replace(/\s/g, '_')
        const newTenantUser = await prisma.tenantUser.create({
            data: {
                tenantId: newTenant.id,
                username: username,
                password: username,
            }
        })
        await initializeTenantDatabase(databaseName);
        const tenantPrisma = getTenantPrisma(databaseName);
        const newUser = await tenantPrisma.user.create({
            data: {
                username: username,
                password: username,
                role: "Super Admin",
            }
        })
        const tenantDto = plainToInstance(TenantDto, newTenant, { excludeExtraneousValues: true });
        const tenantCreationDto = new TenantCreationDto(tenantDto, newTenantUser);
        return tenantCreationDto;
    }
    catch (error) {
        throw error
    }
}

export = {
    getAll,
    create
}