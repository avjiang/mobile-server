import { PrismaClient, Supplier } from "../../prisma/client/generated/client"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { getTenantPrisma } from '../db';
import { SyncRequest } from "src/item/item.request";

let getAll = async (databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const suppliers = await tenantPrisma.supplier.findMany();
        const supplierWithCounts = await Promise.all(suppliers.map(async supplier => {
            // Counts via the junction, not item.supplierId — an item this supplier
            // supplies as a non-preferred source still counts. The scalar under-reports.
            const itemCount = await tenantPrisma.itemSupplier.count({
                where: { supplierId: supplier.id, deleted: false, item: { deleted: false } }
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
                    // Junction, not `items` — `items` only counts rows where this
                    // supplier is the PREFERRED one and so under-reports.
                    select: { itemSuppliers: true }
                }
            }
        });

        // Transform response to include itemCount at root level
        const transformedSuppliers = suppliers.map(supplier => ({
            ...supplier,
            itemCount: supplier._count.itemSuppliers,
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
        // Junction, not item.supplierId — see getAll.
        const itemCount = await tenantPrisma.itemSupplier.count({
            where: { supplierId: id, deleted: false, item: { deleted: false } }
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
        return await tenantPrisma.$transaction(async (tx) => {
            // Guard: refuse to delete a supplier that is some item's ONLY source. Doing so
            // would leave that item with an empty junction — invisible in every PO and
            // quotation item picker — and a dangling item.supplierId pointer.
            const soleSourced = await tx.$queryRaw<{ ID: number; ITEM_NAME: string }[]>`
                SELECT i.ID, i.ITEM_NAME
                FROM item_supplier s
                JOIN item i ON i.ID = s.ITEM_ID AND i.IS_DELETED = false
                WHERE s.SUPPLIER_ID = ${id} AND s.IS_DELETED = false
                  AND (SELECT COUNT(*) FROM item_supplier s2
                       WHERE s2.ITEM_ID = s.ITEM_ID AND s2.IS_DELETED = false) = 1
                LIMIT 5`;

            if (soleSourced.length > 0) {
                const names = soleSourced.map(r => `"${r.ITEM_NAME}" (ID: ${r.ID})`).join(', ');
                throw new RequestValidateError(
                    `Cannot delete this supplier — it is the only supplier for: ${names}. ` +
                    `Assign another supplier to those items first.`
                );
            }

            // Retire the supplier's remaining junction rows so it stops appearing as a
            // purchase source for items that have other suppliers. UPDATED_AT is bumped
            // on both the links and their items so the FE delta sync picks the change up
            // (junction rows only travel inside their parent item's payload).
            const affected = await tx.itemSupplier.findMany({
                where: { supplierId: id, deleted: false },
                select: { itemId: true },
            });
            const now = new Date();
            if (affected.length > 0) {
                await tx.itemSupplier.updateMany({
                    where: { supplierId: id, deleted: false },
                    data: { deleted: true, deletedAt: now, updatedAt: now },
                });
                await tx.item.updateMany({
                    where: { id: { in: [...new Set(affected.map(a => a.itemId))] } },
                    data: { updatedAt: now },
                });
            }

            // updatedAt must be set explicitly — delta sync keys off it, and a raw
            // `deleted: true` alone would never reach the clients.
            return await tx.supplier.update({
                where: { id: id },
                data: { deleted: true, deletedAt: now, updatedAt: now },
            });
        });
    }
    catch (error) {
        throw error
    }
}

export = { getAll, getAllSuppliers, getById, createMany, update, remove }