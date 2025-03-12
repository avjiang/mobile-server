import { PrismaClient, Tenant, TenantUser, SubscriptionPlan } from "../../node_modules/.prisma/global-client";
import { plainToInstance } from "class-transformer"
import { TenantDto } from "./tenant.response"
const { getGlobalPrisma } = require('../db');

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
        // const flattenedTenants = tenants.map(tenant => ({
        //     ...tenant,
        //     planName: tenant.plan?.planName}));
        const tenantsObject = plainToInstance(TenantDto, tenants, { excludeExtraneousValues: true })
        return tenantsObject
    }
    catch (error) {
        throw error
    }
}

export = {
    getAll
}