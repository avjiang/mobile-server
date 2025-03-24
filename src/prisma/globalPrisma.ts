export * from '../../node_modules/.prisma/global-client';
import { PrismaClient } from '../../node_modules/.prisma/global-client';
import { getGlobalPrisma, getTenantPrisma, initializeTenantDatabase } from '../db';
export const prisma: PrismaClient = getGlobalPrisma()