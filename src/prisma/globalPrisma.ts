export * from 'prisma/global-client';
import { PrismaClient } from 'prisma/global-client';
import { getGlobalPrisma, getTenantPrisma, initializeTenantDatabase } from '../db';
export const prisma: PrismaClient = getGlobalPrisma()