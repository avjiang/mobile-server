export * from '../../prisma/global-client/generated/global';
import { PrismaClient } from '../../prisma/global-client/generated/global';
import { getGlobalPrisma, getTenantPrisma, initializeTenantDatabase } from '../db';
export const prisma: PrismaClient = getGlobalPrisma()