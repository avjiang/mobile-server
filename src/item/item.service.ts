import { PrismaClient, Item, Prisma } from "../../prisma/client/generated/client"
import { Decimal } from 'decimal.js';
import { NotFoundError, BusinessLogicError } from "../api-helpers/error"
import salesService from "../sales/sales.service"
import { ItemDto, ItemSoldObject, ItemSoldRankingResponseBody } from "./item.response"
import { plainToInstance } from "class-transformer"
import { getTenantPrisma } from '../db';
import { SyncRequest } from "./item.request"
import SimpleCacheService from '../cache/simple-cache.service';

/**
 * Convert string to Title Case to prevent duplicate attribute values
 * Examples: "green" → "Green", "rose gold" → "Rose Gold", "256gb" → "256gb"
 */
function toTitleCase(str: string): string {
    if (!str) return str;
    return str
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Helper to process variant attributes with user-friendly error handling
 * Handles: validation, upsert of attribute value, junction table management
 */
async function processVariantAttribute(
    tx: any,
    variantId: number,
    attr: { definitionKey: string; value: string; displayValue?: string; sortOrder?: number }
) {
    // Validate input
    if (!attr.value || typeof attr.value !== 'string' || attr.value.trim() === '') {
        throw new BusinessLogicError(`Attribute value is required for ${attr.definitionKey || 'unknown attribute'}`);
    }
    if (!attr.definitionKey || typeof attr.definitionKey !== 'string') {
        throw new BusinessLogicError('Attribute type (definitionKey) is required');
    }

    const normalizedValue = toTitleCase(attr.value.trim());
    const normalizedDisplayValue = attr.displayValue
        ? toTitleCase(attr.displayValue.trim())
        : normalizedValue;

    try {
        // Upsert VariantAttributeValue (shared across items)
        const attrValue = await tx.variantAttributeValue.upsert({
            where: {
                definitionKey_value: {
                    definitionKey: attr.definitionKey,
                    value: normalizedValue,
                },
            },
            create: {
                definitionKey: attr.definitionKey,
                value: normalizedValue,
                displayValue: normalizedDisplayValue,
                sortOrder: attr.sortOrder || 0,
            },
            update: {},
        });

        // Check if junction already exists
        const existingJunction = await tx.itemVariantAttribute.findUnique({
            where: {
                itemVariantId_variantAttributeValueId: {
                    itemVariantId: variantId,
                    variantAttributeValueId: attrValue.id,
                },
            },
        });

        if (existingJunction && !existingJunction.deleted) {
            return attrValue;  // Already exists, skip silently (idempotent)
        }

        if (existingJunction?.deleted) {
            // Restore soft-deleted junction
            await tx.itemVariantAttribute.update({
                where: { id: existingJunction.id },
                data: { deleted: false, deletedAt: null },
            });
        } else {
            // Create new junction
            await tx.itemVariantAttribute.create({
                data: {
                    itemVariantId: variantId,
                    variantAttributeValueId: attrValue.id,
                },
            });
        }

        // Invalidate cache when new attribute is created
        SimpleCacheService.invalidate('variant:attributes');

        return attrValue;
    } catch (error: any) {
        // Re-throw BusinessLogicError as-is
        if (error instanceof BusinessLogicError) {
            throw error;
        }
        // Handle Prisma unique constraint errors
        if (error.code === 'P2002') {
            throw new BusinessLogicError(
                `The attribute "${attr.definitionKey}: ${normalizedValue}" could not be added. Please try again.`
            );
        }
        throw error;
    }
}

/**
 * Create StockBalance and StockMovement records for item variants
 * Matches the pattern used for base item creation (lines 420-442)
 * Uses batch operations for optimal performance
 */
async function createVariantStockRecords(
    tx: any,
    itemId: number,
    variantIds: number[],
    outletId: number = 1
): Promise<void> {
    if (variantIds.length === 0) return;

    // Create StockBalance for each variant (batch insert)
    await tx.stockBalance.createMany({
        data: variantIds.map(variantId => ({
            itemId,
            outletId,
            itemVariantId: variantId,
            availableQuantity: 0,
            onHandQuantity: 0,
            reorderThreshold: null,
            deleted: false,
        })),
        skipDuplicates: true,
    });

    // Create StockMovement for each variant (audit trail)
    await tx.stockMovement.createMany({
        data: variantIds.map(variantId => ({
            itemId,
            outletId,
            itemVariantId: variantId,
            previousAvailableQuantity: 0,
            previousOnHandQuantity: 0,
            availableQuantityDelta: 0,
            onHandQuantityDelta: 0,
            documentId: 0,
            movementType: "Create Variant",
            reason: "",
            remark: "",
            deleted: false,
        })),
    });
}

let getAll = async (
    databaseName: string,
    syncRequest: SyncRequest
): Promise<{ items: any[]; total: number; serverTimestamp: string }> => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { lastSyncTimestamp, lastVersion, skip = 0, take = 100 } = syncRequest;

    try {
        let where: any;

        // If lastSyncTimestamp is null, get all data (first sync)
        if (!lastSyncTimestamp || lastSyncTimestamp === 'null') {
            where = lastVersion
                ? { version: { gt: lastVersion } }
                : {}; // No filtering - get all records
        } else {
            // Parse last sync timestamp for incremental sync
            const lastSync = new Date(lastSyncTimestamp);

            where = lastVersion
                ? { version: { gt: lastVersion } }
                : {
                    OR: [
                        { createdAt: { gte: lastSync } },
                        { updatedAt: { gte: lastSync } },
                        { deletedAt: { gte: lastSync } },
                    ],
                };
        }

        // Count total changes
        const total = await tenantPrisma.item.count({ where });

        // Fetch paginated items with variants and stock balances (optimized query)
        const items = await tenantPrisma.item.findMany({
            where,
            skip,
            take,
            include: {
                stockBalance: {
                    where: { deleted: false },
                    select: {
                        availableQuantity: true,
                        itemVariantId: true, // To match with variants
                    },
                },
                variants: {
                    where: { deleted: false },
                    include: {
                        variantAttributes: {
                            where: { deleted: false },
                            include: {
                                variantAttributeValue: true,
                            },
                        },
                        stockBalances: {
                            where: { deleted: false },
                            select: {
                                availableQuantity: true,
                            },
                        },
                    },
                },
            },
        });

        // Map to DTO and transform variants with stock quantities
        const response = items.map((item) => {
            // Calculate total stock quantity for base item (non-variant items)
            const baseItemStock = item.stockBalance
                .filter(sb => sb.itemVariantId === null)
                .reduce((sum, sb) => sum + Number(sb.availableQuantity), 0);

            const transformedVariants = item.variants?.map(variant => {
                // Calculate stock quantity for this variant
                const variantStockQuantity = variant.stockBalances
                    .reduce((sum, sb) => sum + Number(sb.availableQuantity), 0);

                return {
                    ...variant,
                    stockQuantity: variantStockQuantity, // Add stock quantity for frontend
                    attributes: variant.variantAttributes.map(va => ({
                        definitionKey: va.variantAttributeValue.definitionKey,
                        value: va.variantAttributeValue.value,
                        displayValue: va.variantAttributeValue.displayValue,
                        sortOrder: va.variantAttributeValue.sortOrder,
                    })),
                    variantAttributes: undefined,
                    stockBalances: undefined, // Remove raw field
                };
            });

            return {
                ...item,
                stockQuantity: baseItemStock, // Add stock quantity for base item
                stockBalance: undefined, // Remove raw field
                variants: transformedVariants,
            };
        });
        // Return with server timestamp
        return {
            items: response,
            total,
            serverTimestamp: new Date().toISOString(),
        };
    } catch (error) {
        throw error;
    }
};

let getByIdRaw = async (databaseName: string, id: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const item = await tenantPrisma.item.findUnique({
            where: {
                id: id
            },
            include: {
                stockBalance: true,
                stockMovements: true
            }
        })
        return item
    }
    catch (error) {
        throw error
    }
}

let getAllBySupplierId = async (databaseName: string, supplierId: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const items = await tenantPrisma.item.findMany({
            where: {
                supplierId: supplierId
            },
            include: {
                stockBalance: {
                    select: {
                        availableQuantity: true,
                        reorderThreshold: true
                    }
                }
            }
        })
        const response = items.map(({ stockBalance, ...item }) => ({
            ...item,
            stockQuantity: stockBalance[0]?.availableQuantity || 0,
            reorderThreshold: stockBalance[0]?.reorderThreshold || 0,
        }));
        return response;
    }
    catch (error) {
        throw error
    }
}

let getAllByCategoryId = async (databaseName: string, categoryId: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const items = await tenantPrisma.item.findMany({
            where: {
                categoryId: categoryId
            },
            include: {
                stockBalance: {
                    select: {
                        availableQuantity: true,
                        reorderThreshold: true
                    }
                }
            }
        })
        const response = items.map(({ stockBalance, ...item }) => ({
            ...item,
            stockQuantity: stockBalance[0]?.availableQuantity || 0,
            reorderThreshold: stockBalance[0]?.reorderThreshold || 0,
        }));
        return response;
    }
    catch (error) {
        throw error
    }
}

let getById = async (databaseName: string, id: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const item = await tenantPrisma.item.findUnique({
            where: {
                id: id
            },
            include: {
                stockBalance: {
                    where: { deleted: false },
                    select: {
                        availableQuantity: true,
                        itemVariantId: true, // To match with variants
                        reorderThreshold: true,
                    }
                },
                variants: {
                    where: { deleted: false },
                    include: {
                        variantAttributes: {
                            where: { deleted: false },
                            include: {
                                variantAttributeValue: true,
                            },
                        },
                        stockBalances: {
                            where: { deleted: false },
                            select: {
                                availableQuantity: true,
                            },
                        },
                    },
                },
            }
        })
        if (!item) {
            throw new NotFoundError("Item")
        }

        // Calculate total stock quantity for base item (non-variant items)
        const baseItemStock = item.stockBalance
            .filter(sb => sb.itemVariantId === null)
            .reduce((sum, sb) => sum + Number(sb.availableQuantity), 0);

        // Get reorderThreshold from base item stock balance
        const baseItemReorderThreshold = item.stockBalance
            .find(sb => sb.itemVariantId === null)?.reorderThreshold ?? 0;

        // Transform variants to friendlier format with stock quantities
        const transformedVariants = item.variants?.map(variant => {
            // Calculate stock quantity for this variant
            const variantStockQuantity = variant.stockBalances
                .reduce((sum, sb) => sum + Number(sb.availableQuantity), 0);

            return {
                ...variant,
                stockQuantity: variantStockQuantity, // Add stock quantity for frontend
                attributes: variant.variantAttributes.map(va => ({
                    definitionKey: va.variantAttributeValue.definitionKey,
                    value: va.variantAttributeValue.value,
                    displayValue: va.variantAttributeValue.displayValue,
                    sortOrder: va.variantAttributeValue.sortOrder,
                })),
                variantAttributes: undefined,
                stockBalances: undefined, // Remove raw field
            };
        });

        const rawItemWithStock = {
            ...item,
            stockQuantity: baseItemStock,
            reorderThreshold: Number(baseItemReorderThreshold),
            stockBalance: undefined, // Remove raw field
            variants: transformedVariants,
        };
        return rawItemWithStock
    }
    catch (error) {
        throw error
    }
}

let createMany = async (databaseName: string, itemBodyArray: ItemDto[]) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const createdItems = await tenantPrisma.$transaction(async (tx) => {
            // Batch check all alternateLookup values in a single query
            const alternateLookups = itemBodyArray
                .map(item => item.alternateLookup)
                .filter((lookup): lookup is string => lookup !== undefined && lookup.trim() !== '');

            if (alternateLookups.length > 0) {
                const existingItems = await tx.item.findMany({
                    where: {
                        alternateLookUp: { in: alternateLookups },
                        deleted: false
                    },
                    select: {
                        id: true,
                        itemName: true,
                        alternateLookUp: true
                    }
                });

                if (existingItems.length > 0) {
                    const duplicates = existingItems.map(item =>
                        `"${item.alternateLookUp}" (Item ID: ${item.id}, Item Name: ${item.itemName})`
                    ).join(', ');
                    throw new BusinessLogicError(`Items with alternate lookup already exist: ${duplicates}`);
                }
            }

            // Create items with nested relations in parallel
            return Promise.all(
                itemBodyArray.map(async (itemBody) => {
                    const { stockQuantity, id, categoryId, supplierId, reorderThreshold, cost, alternateLookup, variants, ...itemWithoutId } = itemBody as any;

                    // Auto-flag hasVariants if variants array exists
                    const hasVariants = variants && Array.isArray(variants) && variants.length > 0;

                    const createdItem = await tx.item.create({
                        data: {
                            ...itemWithoutId,
                            alternateLookUp: alternateLookup, // Map DTO field to Prisma field
                            cost: cost || 0, // Use provided cost or default to 0
                            hasVariants, // Auto-set based on variants array
                            stockBalance: {
                                create: {
                                    outlet: { connect: { id: 1 } },
                                    availableQuantity: stockQuantity || 0,
                                    onHandQuantity: stockQuantity || 0,
                                    deleted: false,
                                    reorderThreshold: reorderThreshold || 0,
                                },
                            },
                            stockMovements: {
                                create: {
                                    previousAvailableQuantity: 0,
                                    previousOnHandQuantity: 0,
                                    availableQuantityDelta: stockQuantity || 0,
                                    onHandQuantityDelta: stockQuantity || 0,
                                    documentId: 0,
                                    movementType: "Create Item",
                                    reason: "",
                                    remark: "",
                                    outletId: 1,
                                    deleted: false,
                                },
                            },
                            supplier: {
                                connect: { id: supplierId },
                            },
                            category: {
                                connect: { id: categoryId },
                            },
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            version: 1,
                        },
                        include: {
                            stockBalance: true,
                        },
                    });

                    // Create StockReceipt if cost is provided and stockQuantity > 0
                    if (cost !== undefined && cost > 0 && stockQuantity > 0) {
                        await tx.stockReceipt.create({
                            data: {
                                itemId: createdItem.id,
                                outletId: 1,
                                quantity: stockQuantity,
                                cost: cost,
                                receiptDate: new Date(),
                                deleted: false,
                                version: 1,
                            },
                        });
                    }

                    // Create variants if provided
                    if (hasVariants && variants) {
                        const createdVariantIds: number[] = [];

                        for (const variantData of variants) {
                            const { attributes, ...variantFields } = variantData;

                            // Free up SKU if held by a soft-deleted variant on another item
                            if (variantFields.variantSku) {
                                const deletedWithSameSku = await tx.itemVariant.findFirst({
                                    where: {
                                        variantSku: variantFields.variantSku,
                                        deleted: true,
                                    },
                                });
                                if (deletedWithSameSku) {
                                    await tx.itemVariant.update({
                                        where: { id: deletedWithSameSku.id },
                                        data: { variantSku: `_deleted_${deletedWithSameSku.id}_${deletedWithSameSku.variantSku}` },
                                    });
                                }
                            }

                            // Create ItemVariant
                            const variant = await tx.itemVariant.create({
                                data: {
                                    itemId: createdItem.id,
                                    variantSku: variantFields.variantSku,
                                    variantName: variantFields.variantName,
                                    cost: variantFields.cost,
                                    price: variantFields.price,
                                    image: variantFields.image,
                                    barcode: variantFields.barcode,
                                    weight: variantFields.weight,
                                    length: variantFields.length,
                                    width: variantFields.width,
                                    height: variantFields.height,
                                },
                            });

                            createdVariantIds.push(variant.id);

                            // Create variant attributes using helper function
                            if (attributes && Array.isArray(attributes)) {
                                for (const attr of attributes) {
                                    await processVariantAttribute(tx, variant.id, attr);
                                }
                            }
                        }

                        // Create StockBalance and StockMovement for all variants (batch operation)
                        await createVariantStockRecords(tx, createdItem.id, createdVariantIds);
                    }

                    return createdItem;
                })
            );
        });

        const response = createdItems.map((item, index) => ({
            ...item,
            stockBalanceId: item.stockBalance[0]?.id || null,
            stockBalance: undefined,
            stockQuantity: itemBodyArray[index].stockQuantity || 0,
        }));

        return response;
    } catch (error) {
        throw error;
    } finally {
        await tenantPrisma.$disconnect();
    }
};

let update = async (databaseName: string, item: Item & { reorderThreshold?: number, variants?: any[] }) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // Extract id, version, and relation fields from the item object
        const { id, version, categoryId, supplierId, reorderThreshold, deleted, variants, ...updateData } = item as any;

        const updatedItem = await tenantPrisma.$transaction(async (tx) => {
            // Check if alternateLookUp is being updated and not empty
            if (updateData.alternateLookUp && updateData.alternateLookUp.trim() !== '') {
                const existingItem = await tx.item.findFirst({
                    where: {
                        alternateLookUp: updateData.alternateLookUp,
                        deleted: false,
                        id: { not: id } // Exclude current item from check
                    }
                });

                if (existingItem) {
                    throw new BusinessLogicError(`An item with alternate lookup "${updateData.alternateLookUp}" already exists (Item ID: ${existingItem.id}, Item Name: ${existingItem.itemName})`);
                }
            }

            // Prepare the item update data
            const itemUpdateData: any = {
                ...updateData,
                ...(categoryId && {
                    category: {
                        connect: { id: categoryId }
                    }
                }),
                ...(supplierId && {
                    supplier: {
                        connect: { id: supplierId }
                    }
                }),
                updatedAt: new Date(),
            };

            // If item is being soft-deleted, add deletion fields
            if (deleted === true) {
                itemUpdateData.deleted = true;
                itemUpdateData.deletedAt = new Date();
            }

            // Update the item
            const itemUpdate = await tx.item.update({
                where: {
                    id: id
                },
                data: itemUpdateData
            });

            // Update reorderThreshold in StockBalance if provided
            if (reorderThreshold !== undefined) {
                await tx.stockBalance.updateMany({
                    where: {
                        itemId: id,
                        deleted: false
                    },
                    data: {
                        reorderThreshold: reorderThreshold,
                        updatedAt: new Date()
                    }
                });
            }

            // If item is being soft-deleted, also soft-delete related records
            if (deleted === true) {
                const deletionDate = new Date();

                // Soft-delete all related StockBalance records
                await tx.stockBalance.updateMany({
                    where: {
                        itemId: id,
                        deleted: false
                    },
                    data: {
                        deleted: true,
                        deletedAt: deletionDate,
                        updatedAt: deletionDate
                    }
                });

                // Soft-delete all related StockMovement records
                await tx.stockMovement.updateMany({
                    where: {
                        itemId: id,
                        deleted: false
                    },
                    data: {
                        deleted: true,
                        updatedAt: deletionDate
                    }
                });

                // Soft-delete all related variants
                await tx.itemVariant.updateMany({
                    where: {
                        itemId: id,
                        deleted: false
                    },
                    data: {
                        deleted: true,
                        deletedAt: deletionDate,
                    }
                });
            }

            // Handle variants update/creation if provided
            if (variants && Array.isArray(variants)) {
                // ===== Batch validate variant ownership (security) =====
                // Performance: Single query validates ALL variant IDs at once
                const variantIdsToValidate = variants
                    .filter((v: any) => v.id !== undefined && v.id !== null)
                    .map((v: any) => v.id);

                if (variantIdsToValidate.length > 0) {
                    const existingVariants = await tx.itemVariant.findMany({
                        where: {
                            id: { in: variantIdsToValidate },
                            itemId: id,  // Must belong to THIS item
                            deleted: false
                        },
                        select: { id: true }
                    });
                    const validVariantIds = new Set(existingVariants.map(v => v.id));

                    // Check for invalid variant IDs
                    const invalidIds = variantIdsToValidate.filter((vid: number) => !validVariantIds.has(vid));
                    if (invalidIds.length > 0) {
                        throw new Error(`Invalid variant IDs: ${invalidIds.join(', ')}. Variants do not belong to this item or are already deleted.`);
                    }
                }
                // ===== END: Ownership validation =====

                // Track if any variants were deleted (for hasVariants check later)
                let variantDeleted = false;

                // Track new variant IDs for stock record creation
                const newVariantIds: number[] = [];

                // Auto-flag hasVariants if not already set
                if (!itemUpdate.hasVariants) {
                    await tx.item.update({
                        where: { id },
                        data: { hasVariants: true },
                    });
                }

                // Process each variant
                for (const variantData of variants) {
                    const { id: variantId, attributes, removeAttributes, ...variantFields } = variantData;

                    if (variantId) {
                        // Check if variant should be deleted
                        if (variantData.deleted === true) {
                            variantDeleted = true;  // Track deletion for hasVariants check
                            const deletionDate = new Date();

                            // 1. Soft-delete ItemVariant
                            await tx.itemVariant.update({
                                where: { id: variantId },
                                data: { deleted: true, deletedAt: deletionDate }
                            });

                            // 2. Soft-delete ItemVariantAttribute (junction table)
                            await tx.itemVariantAttribute.updateMany({
                                where: { itemVariantId: variantId, deleted: false },
                                data: { deleted: true, deletedAt: deletionDate }
                            });

                            // 3. Soft-delete StockBalance for this variant
                            await tx.stockBalance.updateMany({
                                where: { itemVariantId: variantId, deleted: false },
                                data: { deleted: true, deletedAt: deletionDate }
                            });

                            // 4. Soft-delete StockReceipt for this variant
                            await tx.stockReceipt.updateMany({
                                where: { itemVariantId: variantId, deleted: false },
                                data: { deleted: true, deletedAt: deletionDate }
                            });

                            // 5. Soft-delete WarehouseStockBalance for this variant
                            await tx.warehouseStockBalance.updateMany({
                                where: { itemVariantId: variantId, deleted: false },
                                data: { deleted: true, deletedAt: deletionDate }
                            });

                            // 6. Soft-delete WarehouseStockReceipt for this variant
                            await tx.warehouseStockReceipt.updateMany({
                                where: { itemVariantId: variantId, deleted: false },
                                data: { deleted: true, deletedAt: deletionDate }
                            });

                            // DO NOT delete: StockMovement, StockSnapshot, WarehouseStockMovement (audit trail)
                            // DO NOT delete: SalesItem, InvoiceItem, etc. (historical transactions)
                        } else {
                            // Update existing variant
                            await tx.itemVariant.update({
                                where: { id: variantId },
                                data: {
                                    variantSku: variantFields.variantSku,
                                    variantName: variantFields.variantName,
                                    cost: variantFields.cost,
                                    price: variantFields.price,
                                    image: variantFields.image,
                                    barcode: variantFields.barcode,
                                    weight: variantFields.weight,
                                    length: variantFields.length,
                                    width: variantFields.width,
                                    height: variantFields.height,
                                },
                            });

                            // Handle attribute REMOVAL for existing variants
                            if (removeAttributes && Array.isArray(removeAttributes) && removeAttributes.length > 0) {
                                // Find all ItemVariantAttribute records for this variant that match the definition keys
                                const attributesToRemove = await tx.itemVariantAttribute.findMany({
                                    where: {
                                        itemVariantId: variantId,
                                        deleted: false,
                                        variantAttributeValue: {
                                            definitionKey: { in: removeAttributes }
                                        }
                                    },
                                    select: { id: true }
                                });

                                // Soft-delete them
                                if (attributesToRemove.length > 0) {
                                    await tx.itemVariantAttribute.updateMany({
                                        where: {
                                            id: { in: attributesToRemove.map(a => a.id) }
                                        },
                                        data: {
                                            deleted: true,
                                            deletedAt: new Date()
                                        }
                                    });
                                }
                            }

                            // Handle attribute ADD/UPDATE for existing variants using helper function
                            if (attributes && Array.isArray(attributes)) {
                                for (const attr of attributes) {
                                    await processVariantAttribute(tx, variantId, attr);
                                }
                            }
                        }
                    } else {
                        // Check if a soft-deleted variant with the same SKU exists on this item
                        const existingSoftDeleted = variantFields.variantSku
                            ? await tx.itemVariant.findFirst({
                                where: {
                                    itemId: id,
                                    variantSku: variantFields.variantSku,
                                    deleted: true,
                                },
                            })
                            : null;

                        if (existingSoftDeleted) {
                            // Restore the soft-deleted variant with updated fields
                            // Use ?? null to reset optional fields not provided by frontend,
                            // preventing old deleted values from carrying over
                            await tx.itemVariant.update({
                                where: { id: existingSoftDeleted.id },
                                data: {
                                    deleted: false,
                                    deletedAt: null,
                                    variantName: variantFields.variantName,
                                    cost: variantFields.cost ?? null,
                                    price: variantFields.price ?? null,
                                    image: variantFields.image ?? null,
                                    barcode: variantFields.barcode ?? null,
                                    weight: variantFields.weight ?? null,
                                    length: variantFields.length ?? null,
                                    width: variantFields.width ?? null,
                                    height: variantFields.height ?? null,
                                },
                            });

                            newVariantIds.push(existingSoftDeleted.id);

                            // Process attributes (processVariantAttribute handles restoring soft-deleted junctions)
                            if (attributes && Array.isArray(attributes)) {
                                for (const attr of attributes) {
                                    await processVariantAttribute(tx, existingSoftDeleted.id, attr);
                                }
                            }
                        } else {
                            // Create new variant
                            const variant = await tx.itemVariant.create({
                                data: {
                                    itemId: id,
                                    variantSku: variantFields.variantSku,
                                    variantName: variantFields.variantName,
                                    cost: variantFields.cost,
                                    price: variantFields.price,
                                    image: variantFields.image,
                                    barcode: variantFields.barcode,
                                    weight: variantFields.weight,
                                    length: variantFields.length,
                                    width: variantFields.width,
                                    height: variantFields.height,
                                },
                            });

                            newVariantIds.push(variant.id);

                            // Create variant attributes using helper function
                            if (attributes && Array.isArray(attributes)) {
                                for (const attr of attributes) {
                                    await processVariantAttribute(tx, variant.id, attr);
                                }
                            }
                        }
                    }
                }

                // Create StockBalance and StockMovement for all new variants (batch operation)
                if (newVariantIds.length > 0) {
                    await createVariantStockRecords(tx, id, newVariantIds);
                }

                // ===== Reset hasVariants if all variants were deleted =====
                // Performance: Only runs count query if at least one variant was deleted
                if (variantDeleted) {
                    const activeVariantCount = await tx.itemVariant.count({
                        where: { itemId: id, deleted: false }
                    });

                    // Combine hasVariants reset with updatedAt touch in single query
                    await tx.item.update({
                        where: { id },
                        data: {
                            updatedAt: new Date(),
                            ...(activeVariantCount === 0 ? { hasVariants: false } : {})
                        }
                    });
                } else {
                    // Just touch updatedAt for sync API
                    await tx.item.update({
                        where: { id },
                        data: { updatedAt: new Date() },
                    });
                }
                // ===== END: hasVariants reset =====
            }

            return itemUpdate;
        });

        return updatedItem;
    }
    catch (error) {
        throw error;
    }
}

let remove = async (databaseName: string, id: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const updatedItem = await tenantPrisma.$transaction([
            // Soft-delete the Item
            tenantPrisma.item.update({
                where: { id: id },
                data: {
                    deleted: true,
                    deletedAt: new Date(),
                },
            }),
            // Soft-delete all related StockBalance records
            tenantPrisma.stockBalance.updateMany({
                where: { id },
                data: {
                    deleted: true,
                    deletedAt: new Date(),
                },
            }),
        ]);

        return updatedItem[0];
    }
    catch (error) {
        throw error
    }
}

let getLowStockItemCount = async (databaseName: string, lowStockQuantity: number, isIncludedZeroStock: boolean) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const lowStockItems = await tenantPrisma.stockBalance.groupBy({
            by: ['itemId'],
            where: {
                deleted: false,
                outletId: 1, // Ensure the StockBalance is for the main outlet
                item: { deleted: false }, // Ensure the Item is not soft-deleted
            },
            _sum: {
                availableQuantity: true,
            },
            having: {
                availableQuantity: {
                    _sum: {
                        lt: lowStockQuantity, // Total availableQuantity < threshold
                    },
                },
            },
        });
        return lowStockItems.length;
    }
    catch (error) {
        throw error
    }
}

let getLowStockItems = async (databaseName: string, lowStockQuantity: number, isIncludedZeroStock: boolean) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const lowStockItems = await tenantPrisma.stockBalance.groupBy({
            by: ['itemId'],
            where: {
                deleted: false,
                outletId: 1, // Ensure the StockBalance is for the main outlet
                item: { deleted: false },
            },
            _sum: {
                availableQuantity: true,
            },
            having: {
                availableQuantity: {
                    _sum: {
                        lt: lowStockQuantity,
                    },
                },
            },
        });
        const itemIds = lowStockItems.map((item) => item.itemId);
        const items = await tenantPrisma.item.findMany({
            where: {
                id: { in: itemIds },
                deleted: false,
            },
            include: {
                stockBalance: {
                    where: {
                        deleted: false,
                        outletId: 1,
                    },
                },
                category: true,
                supplier: true
            },
        });

        // Create a map for O(1) lookup of stock quantities
        const stockQuantityMap = new Map(
            lowStockItems.map((ls) => [ls.itemId, ls._sum.availableQuantity || 0])
        );

        // Enrich items with data (no additional queries needed - supplier is already loaded)
        const enrichedItems = items.map((item) => {
            return {
                ...item,
                stockBalance: undefined,
                category: undefined,
                supplier: undefined,
                lastRestockDate: item.stockBalance[0]?.updatedAt || null,
                supplierName: item.supplier?.companyName || "",
                stockQuantity: stockQuantityMap.get(item.id) || 0,
            };
        });
        return enrichedItems;
    }
    catch (error) {
        throw error
    }
}

let getSoldItemsBySessionId = async (databaseName: string, sessionId: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // Get all sales IDs for the specified session - only completed sales
        const salesWithSession = await tenantPrisma.sales.findMany({
            where: {
                sessionId: sessionId,
                status: "Completed", // Only include completed sales
                deleted: false
            },
            select: {
                id: true
            }
        });

        const salesIDArray = salesWithSession.map(sales => sales.id);
        if (salesIDArray.length === 0) {
            return {
                topSoldItems: [],
                leastSoldItem: null
            };
        }

        // Get the top 5 sales items for these sales and group them by itemId
        const topSoldItemsData = await tenantPrisma.salesItem.groupBy({
            by: ['itemId'],
            _count: {
                itemId: true,
            },
            _sum: {
                quantity: true,
            },
            where: {
                salesId: {
                    in: salesIDArray,
                },
                deleted: false
            },
            orderBy: {
                _sum: {
                    quantity: 'desc',
                },
            },
            take: 5,
        });

        if (topSoldItemsData.length === 0) {
            return {
                topSoldItems: [],
            };
        }

        // Collect all itemIds for bulk query
        const itemIds = topSoldItemsData.map(soldItem => soldItem.itemId);

        // Single bulk query to fetch all items at once
        const items = await tenantPrisma.item.findMany({
            where: {
                id: { in: itemIds }
            },
            include: {
                stockBalance: {
                    select: {
                        availableQuantity: true
                    }
                }
            }
        });

        // Create a map for O(1) lookup
        const itemMap = new Map(items.map(item => [item.id, item]));

        // Build the result array
        const topSoldItems = topSoldItemsData.map(soldItem => {
            const item = itemMap.get(soldItem.itemId);
            if (!item) return null;

            const itemDetails = {
                ...item,
                stockQuantity: item.stockBalance[0]?.availableQuantity || 0
            };

            const quantitySold = soldItem._sum.quantity ? new Decimal(soldItem._sum.quantity) : new Decimal(0);
            const itemPrice = itemDetails.price ? new Decimal(itemDetails.price) : new Decimal(0);

            return {
                item: itemDetails,
                quantitySold: quantitySold.toNumber(),
                totalRevenue: itemPrice.mul(quantitySold)
            };
        }).filter(item => item !== null);

        return {
            topSoldItems,
        };
    }
    catch (error) {
        console.error("Error in getSoldItemsBySessionId:", error);
        throw error;
    }
}

/**
 * Get all variant attribute values with pagination and optional sync support
 * Returns all unique attribute values that can be reused across items
 */
let getVariantAttributeValues = async (
    databaseName: string,
    request: { skip?: number; take?: number; lastSyncTimestamp?: string }
): Promise<{ data: any[]; total: number; serverTimestamp: string }> => {
    const tenantPrisma = getTenantPrisma(databaseName);
    const { skip = 0, take = 100, lastSyncTimestamp } = request;

    // Build cache key based on pagination params
    const cacheKey = `variant:attributes:${databaseName}:${skip}:${take}:${lastSyncTimestamp || 'all'}`;

    // Check cache first (skip cache for sync requests with timestamp)
    if (!lastSyncTimestamp || lastSyncTimestamp === 'null') {
        const cached = SimpleCacheService.get(cacheKey);
        if (cached) {
            return cached;
        }
    }

    try {
        // Build where clause for sync support
        let where: any = { deleted: false };

        if (lastSyncTimestamp && lastSyncTimestamp !== 'null') {
            const lastSync = new Date(lastSyncTimestamp);
            where = {
                ...where,
                OR: [
                    { createdAt: { gte: lastSync } },
                    { updatedAt: { gte: lastSync } },
                ],
            };
        }

        // Count total
        const total = await tenantPrisma.variantAttributeValue.count({ where });

        // Fetch paginated values
        const values = await tenantPrisma.variantAttributeValue.findMany({
            where,
            select: {
                id: true,
                definitionKey: true,
                value: true,
                displayValue: true,
                sortOrder: true,
            },
            skip,
            take,
            orderBy: [
                { definitionKey: 'asc' },
                { sortOrder: 'asc' },
                { value: 'asc' },
            ],
        });

        const result = {
            data: values,
            total,
            serverTimestamp: new Date().toISOString(),
        };

        // Cache result (only for non-sync requests)
        if (!lastSyncTimestamp || lastSyncTimestamp === 'null') {
            SimpleCacheService.set(cacheKey, result);
        }

        return result;
    } finally {
        await tenantPrisma.$disconnect();
    }
};

export = {
    getByIdRaw,
    getAll,
    getAllBySupplierId,
    getById,
    createMany,
    update,
    remove,
    getSoldItemsBySessionId,
    getLowStockItemCount,
    getLowStockItems,
    getAllByCategoryId,
    getVariantAttributeValues,
}