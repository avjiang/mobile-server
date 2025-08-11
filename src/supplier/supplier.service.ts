import { PrismaClient, Supplier } from "../../prisma/client"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { plainToInstance } from "class-transformer"
import { SupplierDto } from "./supplier.response"
import { getTenantPrisma } from '../db';
import { SyncRequest } from "src/item/item.request";

let getAll = async (databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const suppliers = await tenantPrisma.supplier.findMany();
        const supplierWithCounts = await Promise.all(suppliers.map(async supplier => {
            const itemCount = await tenantPrisma.item.count({
                where: { supplierId: supplier.id }
            }) || 0;

            // Return the supplier object with itemCount added directly
            return {
                ...supplier,
                itemCount
            };
        }));
        return supplierWithCounts;
    }
    catch (error) {
        throw error;
    }
}

let getAllSuppliers = async (
    databaseName: string,
    syncRequest: SyncRequest
): Promise<{ suppliers: any[]; total: number; serverTimestamp: string }> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { lastSyncTimestamp, lastVersion, skip = 0, take = 100 } = syncRequest;

    try {
        // Parse last sync timestamp or use a default (e.g., epoch start)
        const lastSync = (lastSyncTimestamp && lastSyncTimestamp !== 'null') ?
            new Date(lastSyncTimestamp) : new Date(0);

        // Build query conditions
        let where: any;

        if (lastVersion) {
            where = { version: { gt: lastVersion } };
        } else {
            // Delta change detection for suppliers only
            where = {
                OR: [
                    // Direct supplier changes
                    { createdAt: { gte: lastSync } },
                    { updatedAt: { gte: lastSync } },
                    { deletedAt: { gte: lastSync } }
                ],
                deleted: false
            };
        }

        // Count total matching records
        const total = await tenantPrisma.supplier.count({ where });

        // Fetch paginated suppliers with item count
        const suppliers = await tenantPrisma.supplier.findMany({
            where,
            skip,
            take,
            include: {
                _count: {
                    select: { items: true }
                }
            }
        });

        // Transform response to include itemCount at root level
        const transformedSuppliers = suppliers.map(supplier => ({
            ...supplier,
            itemCount: supplier._count.items,
            _count: undefined
        }));

        return {
            suppliers: transformedSuppliers,
            total,
            serverTimestamp: new Date().toISOString(),
        };
    } catch (error) {
        throw error;
    }
};

let getById = async (id: number, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const supplier = await tenantPrisma.supplier.findUnique({
            where: {
                id: id
            }
        });
        if (!supplier) {
            throw new NotFoundError("Supplier");
        }
        const itemCount = await tenantPrisma.item.count({
            where: {
                supplierId: id
            }
        }) || 0;

        // Return supplier with itemCount added
        return {
            ...supplier,
            itemCount
        };
    }
    catch (error) {
        throw error;
    }
}

let createMany = async (suppliers: Supplier[], databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);

    try {
        // Check for existing company names
        const companyNames = suppliers.map(supplier => supplier.companyName);
        const existingSuppliers = await tenantPrisma.supplier.findMany({
            where: {
                companyName: { in: companyNames },
                deleted: false
            }
        });

        if (existingSuppliers.length > 0) {
            const existingNames = existingSuppliers.map(s => s.companyName).join(', ');
            throw new RequestValidateError(`Company name(s) already exist: ${existingNames}`);
        }

        await tenantPrisma.supplier.createMany({
            data: suppliers,
        });
        const createdSuppliers = await tenantPrisma.supplier.findMany({
            where: {
                companyName: { in: suppliers.map(cat => cat.companyName) },
            },
        });
        return createdSuppliers;
    }
    catch (error) {
        throw error
    }
}

let update = async (supplier: Supplier, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // Extract itemCount before updating
        const { itemCount, ...supplierData } = supplier as Supplier & { itemCount?: number };

        // Check if company name already exists (excluding current supplier)
        if (supplierData.companyName) {
            const existingSupplier = await tenantPrisma.supplier.findFirst({
                where: {
                    companyName: supplierData.companyName,
                    id: { not: supplier.id },
                    deleted: false
                }
            });

            if (existingSupplier) {
                throw new RequestValidateError("Company name already exists");
            }
        }

        const updatedSupplier = await tenantPrisma.supplier.update({
            where: {
                id: supplier.id
            },
            data: supplierData
        });
        // Add itemCount back to the updatedSupplier object
        (updatedSupplier as any).itemCount = itemCount || 0;

        // Return the modified updatedSupplier
        return updatedSupplier;
    }
    catch (error) {
        throw error;
    }
}

let remove = async (id: number, databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const updatedSupplier = await tenantPrisma.supplier.update({
            where: {
                id: id
            },
            data: {
                deleted: true
            }
        })
        return updatedSupplier
    }
    catch (error) {
        throw error
    }
}

export = { getAll, getAllSuppliers, getById, createMany, update, remove }