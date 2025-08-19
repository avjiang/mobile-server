export * from '@prisma/global-prisma';
import { PrismaClient } from '@prisma/global-prisma';
import { getGlobalPrisma, getTenantPrisma, initializeTenantDatabase } from '../db';
export const prisma: PrismaClient = getGlobalPrisma()