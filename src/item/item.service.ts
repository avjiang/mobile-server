import { PrismaClient, Item, Prisma } from "../../prisma/client/generated/client"
import { Decimal } from 'decimal.js';
import { NotFoundError, BusinessLogicError } from "../api-helpers/error"
import salesService from "../sales/sales.service"
import { ItemDto, ItemSoldObject, ItemSoldRankingResponseBody } from "./item.response"
import { plainToInstance } from "class-transformer"
import { getTenantPrisma } from '../db';
import { SyncRequest } from "./item.request"
import SimpleCacheService from '../cache/simple-cache.service';

// One entry of the client's `suppliers[]` payload on an item create/update.
// Local (not exported) — this module uses `export =`, which forbids other exports.
interface ItemSupplierInput {
    supplierId: number;
    isPreferred?: boolean;
    supplierItemCode?: string | null;
    cost?: number | null;
    leadTimeDays?: number | null;
}

/**
 * Reconcile an item's `item_supplier` rows against the client's `suppliers[]` payload.
 *
 * Contract:
 *  - `suppliers` undefined/null  → legacy payload. The junction's MEMBERSHIP is left
 *    untouched (older binaries and replayed outbox entries predate the field; they must
 *    not wipe a tenant's suppliers), but the scalar `supplierId` they did send is
 *    honoured by re-pointing which row is preferred. See [syncLegacyPreferredSupplier].
 *  - `suppliers` present         → it is the COMPLETE set. Rows not in it are soft-deleted.
 *
 * Gating: ONE supplier is available on every plan (it is a required field and always has
 * been). Only the SECOND and beyond require Pro. Gating the whole junction would stop
 * Basic tenants from saving an item at all.
 *
 * Invariant: exactly one live row is preferred, and `item.supplierId` mirrors it. Both are
 * written inside the caller's transaction so they can never diverge.
 *
 * Returns the effective preferred supplier id, for the caller to write onto the item.
 */
async function syncItemSuppliers(
    tx: Prisma.TransactionClient,
    itemId: number,
    suppliers: ItemSupplierInput[] | undefined | null,
    fallbackSupplierId: number | undefined,
    planName: string | null | undefined,
): Promise<number | undefined> {
    if (suppliers === undefined || suppliers === null) {
        return syncLegacyPreferredSupplier(tx, itemId, fallbackSupplierId);
    }

    // De-dupe defensively — the unique index would throw a raw Prisma error otherwise.
    const seen = new Set<number>();
    const rows = suppliers.filter(s => {
        if (s?.supplierId == null || seen.has(s.supplierId)) return false;
        seen.add(s.supplierId);
        return true;
    });

    if (rows.length === 0) return fallbackSupplierId;

    const isPro = (planName ?? '').toLowerCase() === 'pro';
    if (rows.length > 1 && !isPro) {
        throw new BusinessLogicError(
            'Multiple suppliers per item is a Pro feature. Upgrade to add more than one supplier.'
        );
    }

    // Exactly one preferred: honour the client's flag, else keep the first row.
    const preferredIdx = Math.max(0, rows.findIndex(s => s.isPreferred === true));
    const preferredSupplierId = rows[preferredIdx].supplierId;

    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const data = {
            isPreferred: i === preferredIdx,
            supplierItemCode: r.supplierItemCode ?? null,
            cost: r.cost != null ? new Decimal(r.cost) : null,
            leadTimeDays: r.leadTimeDays ?? null,
            deleted: false,
            deletedAt: null,
        };
        // Upsert on the unique pair so re-adding a previously removed supplier revives
        // the soft-deleted row instead of colliding with the unique index.
        await tx.itemSupplier.upsert({
            where: { itemId_supplierId: { itemId, supplierId: r.supplierId } },
            update: { ...data, version: { increment: 1 } },
            create: { itemId, supplierId: r.supplierId, ...data, version: 1 },
        });
    }

    // Soft-delete rows the client dropped (mirrors the variants strategy — the BE stays
    // source of truth and the FE flags stale rows rather than hard-deleting them).
    await tx.itemSupplier.updateMany({
        where: { itemId, deleted: false, supplierId: { notIn: rows.map(r => r.supplierId) } },
        data: { deleted: true, deletedAt: new Date() },
    });

    return preferredSupplierId;
}

/**
 * Legacy-payload path for [syncItemSuppliers]: the client sent no `suppliers[]`, only the
 * scalar `supplierId`. Pre-multi-supplier binaries and outbox entries queued before the
 * feature shipped look like this, so this runs for the whole BE-deployed / APK-not-yet-
 * shipped window.
 *
 * Without this, an old binary changing an item's supplier moved `item.supplierId` while
 * the junction kept pointing at the OLD supplier. Since the PO/quotation item picker and
 * `supplier.itemCount` both read the junction, the item would keep appearing under the
 * old supplier and never under the new one — silently, until someone re-saved it from a
 * new binary.
 *
 * What it does NOT do: change membership. A Pro tenant's extra suppliers are kept (the old
 * binary has no idea they exist and must not be able to drop them) — only the `isPreferred`
 * flag moves. As a side effect this also heals an item with no junction rows at all, which
 * the migration backfill could leave behind for an item whose `SUPPLIER_ID` was dangling.
 *
 * Returns the effective preferred supplier id, for the caller to write onto the item.
 */
async function syncLegacyPreferredSupplier(
    tx: Prisma.TransactionClient,
    itemId: number,
    fallbackSupplierId: number | undefined,
): Promise<number | undefined> {
    // Nothing asserted about the supplier — a partial update that omits it entirely.
    if (fallbackSupplierId == null) return fallbackSupplierId;

    const live = await tx.itemSupplier.findMany({
        where: { itemId, deleted: false },
        select: { supplierId: true, isPreferred: true },
    });

    // Already consistent: exactly the intended row is preferred. Most updates land here,
    // so the common path costs one indexed read and no writes.
    const preferred = live.filter(r => r.isPreferred);
    if (preferred.length === 1 && preferred[0].supplierId === fallbackSupplierId) {
        return fallbackSupplierId;
    }

    // Promote the scalar's supplier. Upsert (not update) so a soft-deleted row revives and
    // an item with an empty junction gains its link.
    await tx.itemSupplier.upsert({
        where: { itemId_supplierId: { itemId, supplierId: fallbackSupplierId } },
        update: { isPreferred: true, deleted: false, deletedAt: null, version: { increment: 1 } },
        create: { itemId, supplierId: fallbackSupplierId, isPreferred: true, version: 1 },
    });

    // Demote every other live row — keeps the "exactly one preferred" invariant without
    // removing suppliers the old binary can't see.
    await tx.itemSupplier.updateMany({
        where: { itemId, deleted: false, isPreferred: true, supplierId: { not: fallbackSupplierId } },
        data: { isPreferred: false, version: { increment: 1 } },
    });

    return fallbackSupplierId;
}

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
    outletId: number = 1,
    variantStockData?: Map<number, { stockQuantity: number; cost: number }>,
    siteId: number | null = null
): Promise<void> {
    if (variantIds.length === 0) return;

    // Create StockBalance for each variant (batch insert)
    await tx.stockBalance.createMany({
        data: variantIds.map(variantId => {
            const stockData = variantStockData?.get(variantId);
            const qty = stockData?.stockQuantity || 0;
            return {
                itemId,
                outletId,
                itemVariantId: variantId,
                availableQuantity: qty,
                onHandQuantity: qty,
                reorderThreshold: null,
                deleted: false,
            };
        }),
        skipDuplicates: true,
    });

    // Create StockMovement for each variant (audit trail)
    await tx.stockMovement.createMany({
        data: variantIds.map(variantId => {
            const stockData = variantStockData?.get(variantId);
            const qty = stockData?.stockQuantity || 0;
            return {
                itemId,
                outletId,
                itemVariantId: variantId,
                previousAvailableQuantity: 0,
                previousOnHandQuantity: 0,
                availableQuantityDelta: qty,
                onHandQuantityDelta: qty,
                documentId: 0,
                movementType: "Create Variant",
                reason: "",
                remark: "",
                // Terminal attribution — the terminal that created the variant.
                siteId: siteId,
                deleted: false,
            };
        }),
    });

    // Create StockReceipt for variants with initial stock and cost (FIFO costing)
    if (variantStockData) {
        const receiptData = variantIds
            .filter(variantId => {
                const stockData = variantStockData.get(variantId);
                return stockData && stockData.cost > 0 && stockData.stockQuantity > 0;
            })
            .map(variantId => {
                const stockData = variantStockData.get(variantId)!;
                return {
                    itemId,
                    outletId,
                    itemVariantId: variantId,
                    quantity: stockData.stockQuantity,
                    cost: stockData.cost,
                    receiptDate: new Date(),
                    deleted: false,
                    version: 1,
                };
            });

        if (receiptData.length > 0) {
            await tx.stockReceipt.createMany({ data: receiptData });
        }
    }
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
                // Laundry recipe lines (only present on service items).
                serviceConsumables: {
                    where: { deleted: false },
                    select: {
                        consumableItemId: true,
                        ratePerKg: true,
                        unit: true,
                        consumptionBasis: true,
                    },
                },
                // Every supplier this item can be purchased from. Sent in full on each
                // sync (not just changed rows) so the FE can soft-delete stale local
                // rows — same contract as `variants`.
                itemSuppliers: {
                    where: { deleted: false },
                    select: {
                        id: true,
                        supplierId: true,
                        isPreferred: true,
                        supplierItemCode: true,
                        cost: true,
                        leadTimeDays: true,
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
                // Flatten recipe lines for the client (drops raw relation field).
                // Only emit `consumables` for laundry service items so retail items
                // carry no recipe key (avoids a redundant local delete on each sync).
                consumables: item.itemType === 'service'
                    ? (item.serviceConsumables?.map(c => ({
                        consumableItemId: c.consumableItemId,
                        ratePerKg: Number(c.ratePerKg),
                        unit: c.unit,
                        consumptionBasis: c.consumptionBasis,
                    })) ?? [])
                    : undefined,
                serviceConsumables: undefined,
                // Flattened junction for the client. Always emitted (even for the
                // single-supplier case) so the FE can reconcile stale local rows.
                suppliers: (item.itemSuppliers ?? []).map(s => ({
                    id: s.id,
                    supplierId: s.supplierId,
                    isPreferred: s.isPreferred,
                    supplierItemCode: s.supplierItemCode,
                    cost: s.cost != null ? Number(s.cost) : null,
                    leadTimeDays: s.leadTimeDays,
                })),
                itemSuppliers: undefined,
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
        // Matches on the item_supplier junction, NOT item.supplierId — an item can be
        // purchased from several suppliers and must appear for every one of them, not
        // only the preferred one. Backfill guarantees each item has at least one row,
        // so this is never narrower than the old scalar comparison.
        const items = await tenantPrisma.item.findMany({
            where: {
                itemSuppliers: {
                    some: { supplierId: supplierId, deleted: false }
                }
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

/**
 * Current unit cost of each "supply" item, for the laundry recipe cost estimate.
 * A stock-tracked supply stores cost: 0 on the item row by design — its real cost
 * lives in StockReceipt (FIFO batches). We surface the LATEST receipt cost (most
 * recent purchase price) per supply, in the supply's stock unit (per-ml/g/tank),
 * which is the same unit the recipe rate is entered in — so the client can
 * estimate a line's cost as cost × rate with no conversion. Returns 0 for a
 * supply that has no receipts yet (no cost recorded). Always fresh (computed on
 * read), so it is immune to the delta-sync staleness that would affect item.cost.
 */
let getSupplyCosts = async (databaseName: string) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        const supplies = await tenantPrisma.item.findMany({
            where: { itemType: 'supply', deleted: false },
            select: { id: true },
        });
        if (supplies.length === 0) return [] as { itemId: number; cost: number }[];
        const ids = supplies.map(s => s.id);
        // Ordered latest-first; the first receipt seen per item is its current cost.
        const receipts = await tenantPrisma.stockReceipt.findMany({
            where: { itemId: { in: ids }, deleted: false },
            select: { itemId: true, cost: true },
            orderBy: [{ receiptDate: 'desc' }, { id: 'desc' }],
        });
        const costByItem: Record<number, number> = {};
        for (const r of receipts) {
            if (costByItem[r.itemId] === undefined) {
                costByItem[r.itemId] = Number(r.cost);
            }
        }
        return ids.map(id => ({ itemId: id, cost: costByItem[id] ?? 0 }));
    } catch (error) {
        throw error;
    }
};

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
                // Supplier links, so a single-item fetch carries the same shape as
                // the list sync. (The item form still hydrates them from Drift so it
                // works offline — this keeps the endpoint's payload complete.)
                itemSuppliers: {
                    where: { deleted: false },
                    select: {
                        id: true,
                        supplierId: true,
                        isPreferred: true,
                        supplierItemCode: true,
                        cost: true,
                        leadTimeDays: true,
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
            // Flattened junction — same key/shape the list sync emits.
            suppliers: (item.itemSuppliers ?? []).map(s => ({
                id: s.id,
                supplierId: s.supplierId,
                isPreferred: s.isPreferred,
                supplierItemCode: s.supplierItemCode,
                cost: s.cost != null ? Number(s.cost) : null,
                leadTimeDays: s.leadTimeDays,
            })),
            itemSuppliers: undefined,
        };
        return rawItemWithStock
    }
    catch (error) {
        throw error
    }
}

let createMany = async (databaseName: string, itemBodyArray: ItemDto[], planName?: string | null) => {
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

                // Cross-table check: alternateLookup must not exist as a variant barcode
                const variantsWithSameBarcode = await tx.itemVariant.findMany({
                    where: {
                        barcode: { in: alternateLookups },
                        deleted: false
                    },
                    select: {
                        id: true,
                        barcode: true,
                        variantName: true,
                        item: { select: { id: true, itemName: true } }
                    }
                });

                if (variantsWithSameBarcode.length > 0) {
                    const duplicates = variantsWithSameBarcode.map(v =>
                        `"${v.barcode}" (Item ID: ${v.item.id}, Item: ${v.item.itemName}, Variant: ${v.variantName})`
                    ).join(', ');
                    throw new BusinessLogicError(`Barcode already used by variant: ${duplicates}`);
                }
            }

            // Batch check all variant barcodes for uniqueness
            const allBarcodes = itemBodyArray
                .flatMap(item => (item as any).variants || [])
                .map((v: any) => v.barcode)
                .filter((barcode): barcode is string => barcode !== undefined && barcode !== null && barcode.trim() !== '');

            if (allBarcodes.length > 0) {
                const existingVariantsWithBarcode = await tx.itemVariant.findMany({
                    where: {
                        barcode: { in: allBarcodes },
                        deleted: false
                    },
                    select: {
                        id: true,
                        barcode: true,
                        variantName: true,
                        item: { select: { id: true, itemName: true } }
                    }
                });

                if (existingVariantsWithBarcode.length > 0) {
                    const duplicates = existingVariantsWithBarcode.map(v =>
                        `"${v.barcode}" (Item ID: ${v.item.id}, Item: ${v.item.itemName}, Variant: ${v.variantName})`
                    ).join(', ');
                    throw new BusinessLogicError(`Variants with barcode already exist: ${duplicates}`);
                }

                // Cross-table check: variant barcode must not exist as an item alternateLookup
                const itemsWithSameLookup = await tx.item.findMany({
                    where: {
                        alternateLookUp: { in: allBarcodes },
                        deleted: false
                    },
                    select: {
                        id: true,
                        itemName: true,
                        alternateLookUp: true
                    }
                });

                if (itemsWithSameLookup.length > 0) {
                    const duplicates = itemsWithSameLookup.map(item =>
                        `"${item.alternateLookUp}" (Item ID: ${item.id}, Item Name: ${item.itemName})`
                    ).join(', ');
                    throw new BusinessLogicError(`Barcode already used by item: ${duplicates}`);
                }
            }

            // Resolve fallback supplier/category for accounts that don't track them (e.g. laundry).
            // Item.supplierId and Item.categoryId are NOT NULL columns, so when the client omits
            // them we attach a tenant-level "Laundry" default (find-or-create by unique name).
            const needsDefaultSupplier = itemBodyArray.some((i: any) => !i.supplierId);
            const needsDefaultCategory = itemBodyArray.some((i: any) => !i.categoryId);

            let defaultSupplierId: number | undefined;
            if (needsDefaultSupplier) {
                const defaultSupplier = await tx.supplier.upsert({
                    where: { companyName: "Laundry" },
                    update: { deleted: false },
                    create: { companyName: "Laundry", hasTax: false, deleted: false },
                    select: { id: true },
                });
                defaultSupplierId = defaultSupplier.id;
            }

            let defaultCategoryId: number | undefined;
            if (needsDefaultCategory) {
                const defaultCategory = await tx.category.upsert({
                    where: { name: "Laundry" },
                    update: { deleted: false },
                    create: { name: "Laundry", deleted: false },
                    select: { id: true },
                });
                defaultCategoryId = defaultCategory.id;
            }

            // Create items with nested relations in parallel
            return Promise.all(
                itemBodyArray.map(async (itemBody) => {
                    // siteId is destructured OUT so it never spreads into tx.item.create
                    // (Item has no siteId column); it's stamped on the stock movements only.
                    // `suppliers` is the item_supplier junction payload — destructured OUT
                    // so it never spreads into tx.item.create (Item has no such column);
                    // it's written via syncItemSuppliers after the item exists.
                    const { stockQuantity, id, categoryId, supplierId, reorderThreshold, cost, alternateLookup, variants, consumables, suppliers, siteId, ...itemWithoutId } = itemBody as any;

                    // Fall back to the tenant default when supplier/category were not provided.
                    // When a suppliers[] array is present, its preferred entry wins.
                    const preferredFromList = Array.isArray(suppliers) && suppliers.length > 0
                        ? (suppliers.find((s: any) => s?.isPreferred === true) ?? suppliers[0])?.supplierId
                        : undefined;
                    const effectiveSupplierId = preferredFromList || supplierId || defaultSupplierId;
                    const effectiveCategoryId = categoryId || defaultCategoryId;

                    // Auto-flag hasVariants if variants array exists
                    const hasVariants = variants && Array.isArray(variants) && variants.length > 0;

                    const shouldTrackStock = (itemBody as any).trackStock !== false;

                    // Validate: reject negative stock quantities
                    if (stockQuantity !== undefined && stockQuantity < 0) {
                        throw new BusinessLogicError(
                            `Initial stock quantity cannot be negative for item "${itemWithoutId.itemName}"`
                        );
                    }

                    // Base item stock should be 0 when variants handle stock individually
                    const baseStockQuantity = hasVariants ? 0 : (stockQuantity || 0);

                    const createdItem = await tx.item.create({
                        data: {
                            ...itemWithoutId,
                            alternateLookUp: alternateLookup, // Map DTO field to Prisma field
                            cost: shouldTrackStock ? 0 : (cost || 0), // Stock-tracked: cost lives in StockReceipt (FIFO); non-stock: cost lives here
                            hasVariants, // Auto-set based on variants array
                            ...(shouldTrackStock ? {
                                stockBalance: {
                                    create: {
                                        outlet: { connect: { id: 1 } },
                                        availableQuantity: baseStockQuantity,
                                        onHandQuantity: baseStockQuantity,
                                        deleted: false,
                                        reorderThreshold: reorderThreshold || 0,
                                    },
                                },
                                stockMovements: {
                                    create: {
                                        previousAvailableQuantity: 0,
                                        previousOnHandQuantity: 0,
                                        availableQuantityDelta: baseStockQuantity,
                                        onHandQuantityDelta: baseStockQuantity,
                                        documentId: 0,
                                        movementType: "Create Item",
                                        reason: "",
                                        remark: "",
                                        outletId: 1,
                                        siteId: siteId ?? null,
                                        deleted: false,
                                    },
                                },
                            } : {}),
                            supplier: {
                                connect: { id: effectiveSupplierId },
                            },
                            category: {
                                connect: { id: effectiveCategoryId },
                            },
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            version: 1,
                        },
                        include: {
                            stockBalance: true,
                        },
                    });

                    // Junction rows. Always write at least the preferred one so no item is
                    // ever left without a supplier link — an item with an empty junction is
                    // invisible in the PO/quotation item picker.
                    await syncItemSuppliers(
                        tx,
                        createdItem.id,
                        Array.isArray(suppliers) && suppliers.length > 0
                            ? suppliers
                            : [{ supplierId: effectiveSupplierId, isPreferred: true }],
                        effectiveSupplierId,
                        planName,
                    );

                    // Create StockReceipt if cost is provided and stockQuantity > 0 (only for stock-tracked simple items)
                    if (shouldTrackStock && cost !== undefined && cost > 0 && baseStockQuantity > 0) {
                        await tx.stockReceipt.create({
                            data: {
                                itemId: createdItem.id,
                                outletId: 1,
                                quantity: baseStockQuantity,
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
                        const variantStockDataMap = new Map<number, { stockQuantity: number; cost: number }>();

                        for (const variantData of variants) {
                            const { attributes, stockQuantity: variantStockQty, ...variantFields } = variantData;

                            // Validate: reject negative stock quantities
                            if (variantStockQty !== undefined && variantStockQty < 0) {
                                throw new BusinessLogicError(
                                    `Initial stock quantity cannot be negative for variant "${variantFields.variantSku || variantFields.variantName}"`
                                );
                            }

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
                                    cost: shouldTrackStock ? 0 : (variantFields.cost || 0), // Stock-tracked: cost lives in StockReceipt (FIFO)
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

                            // Track per-variant stock data for batch creation
                            if (variantStockQty || variantFields.cost) {
                                variantStockDataMap.set(variant.id, {
                                    stockQuantity: variantStockQty || 0,
                                    cost: variantFields.cost || 0,
                                });
                            }

                            // Create variant attributes using helper function
                            if (attributes && Array.isArray(attributes)) {
                                for (const attr of attributes) {
                                    await processVariantAttribute(tx, variant.id, attr);
                                }
                            }
                        }

                        // Create StockBalance, StockMovement, and StockReceipt for all variants (batch operation)
                        if (shouldTrackStock) {
                            await createVariantStockRecords(tx, createdItem.id, createdVariantIds, 1, variantStockDataMap, siteId ?? null);
                        }
                    }

                    // Laundry: create recipe lines (bill-of-materials) for a service item.
                    // consumableItemId references already-persisted "supply" items (created
                    // inline by the client just before the service). Distinct from F&B Recipe.
                    if (Array.isArray(consumables) && consumables.length > 0) {
                        await tx.itemConsumable.createMany({
                            data: consumables.map((c: any) => ({
                                serviceItemId: createdItem.id,
                                consumableItemId: c.consumableItemId,
                                ratePerKg: c.ratePerKg ?? 0,
                                unit: c.unit || "Milliliter",
                                consumptionBasis: c.consumptionBasis || "perKg",
                                deleted: false,
                            })),
                            skipDuplicates: true,
                        });
                    }

                    return createdItem;
                })
            );
        });

        const response = createdItems.map((item, index) => {
            const inputItem = itemBodyArray[index] as any;
            const hasVariants = inputItem.variants && Array.isArray(inputItem.variants) && inputItem.variants.length > 0;
            return {
                ...item,
                stockBalanceId: item.stockBalance[0]?.id || null,
                stockBalance: undefined,
                stockQuantity: hasVariants ? 0 : (inputItem.stockQuantity || 0),
            };
        });

        return response;
    } catch (error) {
        throw error;
    } finally {
        await tenantPrisma.$disconnect();
    }
};

let update = async (
    databaseName: string,
    item: Item & { reorderThreshold?: number, variants?: any[] },
    planName?: string | null,
) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    try {
        // Extract id, version, and relation fields from the item object
        // stockQuantity is a virtual field (not a DB column) — must be extracted to prevent Prisma errors
        // siteId is destructured OUT so it never spreads into tx.item.update
        // (Item has no siteId column); it's stamped on the stock movements only.
        // suppliers is the item_supplier junction payload — written via syncItemSuppliers.
        const { id, version, categoryId, supplierId, reorderThreshold, deleted, variants, stockQuantity, consumables, suppliers, siteId, ...updateData } = item as any;

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

                // Cross-table check: alternateLookUp must not exist as a variant barcode
                const variantWithSameBarcode = await tx.itemVariant.findFirst({
                    where: {
                        barcode: updateData.alternateLookUp,
                        deleted: false
                    },
                    select: {
                        id: true,
                        barcode: true,
                        variantName: true,
                        item: { select: { id: true, itemName: true } }
                    }
                });

                if (variantWithSameBarcode) {
                    throw new BusinessLogicError(`Barcode already used by variant: "${variantWithSameBarcode.barcode}" (Item ID: ${variantWithSameBarcode.item.id}, Item: ${variantWithSameBarcode.item.itemName}, Variant: ${variantWithSameBarcode.variantName})`);
                }
            }

            // Detect trackStock transition
            const currentItem = await tx.item.findUnique({
                where: { id },
                select: { trackStock: true, cost: true, hasVariants: true, itemType: true, unitOfMeasure: true }
            });
            const oldTrackStock = currentItem!.trackStock;
            const newTrackStock = updateData.trackStock;
            const turningOff = newTrackStock !== undefined && oldTrackStock === true && newTrackStock === false;
            const turningOn = newTrackStock !== undefined && oldTrackStock === false && newTrackStock === true;

            // Reconcile the item_supplier junction BEFORE updating the item, so the
            // preferred row it resolves can be written onto item.supplierId in the same
            // statement — the scalar pointer and the junction can never diverge.
            // A missing `suppliers` key leaves the junction untouched and falls back to
            // the scalar (old binaries + outbox entries queued before this shipped).
            const preferredSupplierId = await syncItemSuppliers(
                tx, id, suppliers, supplierId, planName,
            );

            // Prepare the item update data
            const itemUpdateData: any = {
                ...updateData,
                ...(categoryId && {
                    category: {
                        connect: { id: categoryId }
                    }
                }),
                ...(preferredSupplierId && {
                    supplier: {
                        connect: { id: preferredSupplierId }
                    }
                }),
                updatedAt: new Date(),
            };

            // Cost routing: when turning ON stock tracking, Item.cost must be 0 (FIFO is the cost source)
            if (turningOn) {
                itemUpdateData.cost = 0;
            }

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

            // Laundry: a supply's unit (Liquid/Weight/Tabung/Piece) is echoed onto
            // every recipe line that consumes it as a DISPLAY label — the consumption
            // math uses ratePerKg + consumptionBasis, never the unit. When the supply's
            // unit changes, cascade it onto those recipe lines so the recipe builder and
            // reports don't show a stale unit. Quantities/rates are intentionally left
            // as-is (units across dimensions don't auto-convert; the FE warns the user).
            if (currentItem!.itemType === 'supply' &&
                itemUpdate.unitOfMeasure !== currentItem!.unitOfMeasure) {
                const affected = await tx.itemConsumable.findMany({
                    where: { consumableItemId: id, deleted: false },
                    select: { serviceItemId: true },
                });
                await tx.itemConsumable.updateMany({
                    where: { consumableItemId: id, deleted: false },
                    data: { unit: itemUpdate.unitOfMeasure, updatedAt: new Date() },
                });
                // Bump the owning service items' updatedAt so the relabelled recipe
                // lines re-sync to clients — consumables only travel inside their
                // parent service item's delta-sync payload, never on their own.
                const serviceIds = [...new Set(affected.map(a => a.serviceItemId))];
                if (serviceIds.length > 0) {
                    await tx.item.updateMany({
                        where: { id: { in: serviceIds } },
                        data: { updatedAt: new Date() },
                    });
                }
            }

            // Laundry: replace recipe lines when the client sends a consumables array.
            // Hard delete + recreate keeps the @@unique(serviceItemId, consumableItemId)
            // constraint clean. The item.update above bumped updatedAt, so the service
            // re-syncs to clients with its new recipe.
            if (consumables !== undefined && Array.isArray(consumables)) {
                await tx.itemConsumable.deleteMany({ where: { serviceItemId: id } });
                if (consumables.length > 0) {
                    await tx.itemConsumable.createMany({
                        data: consumables.map((c: any) => ({
                            serviceItemId: id,
                            consumableItemId: c.consumableItemId,
                            ratePerKg: c.ratePerKg ?? 0,
                            unit: c.unit || "Milliliter",
                            consumptionBasis: c.consumptionBasis || "perKg",
                            deleted: false,
                        })),
                        skipDuplicates: true,
                    });
                }
            }

            // ===== trackStock transition: ON → OFF =====
            if (turningOff) {
                const now = new Date();

                // Soft-delete outlet StockReceipts
                await tx.stockReceipt.updateMany({
                    where: { itemId: id, deleted: false },
                    data: { deleted: true, deletedAt: now }
                });

                // Soft-delete outlet StockBalances
                await tx.stockBalance.updateMany({
                    where: { itemId: id, deleted: false },
                    data: { deleted: true, deletedAt: now, updatedAt: now }
                });

                // Soft-delete warehouse StockReceipts
                await tx.warehouseStockReceipt.updateMany({
                    where: { itemId: id, deleted: false },
                    data: { deleted: true, deletedAt: now }
                });

                // Soft-delete warehouse StockBalances
                await tx.warehouseStockBalance.updateMany({
                    where: { itemId: id, deleted: false },
                    data: { deleted: true, deletedAt: now, updatedAt: now }
                });

                // Audit trail
                await tx.stockMovement.create({
                    data: {
                        itemId: id, outletId: 1,
                        previousAvailableQuantity: 0, previousOnHandQuantity: 0,
                        availableQuantityDelta: 0, onHandQuantityDelta: 0,
                        documentId: 0,
                        movementType: "Stock Tracking Disabled",
                        reason: "trackStock changed from on to off",
                        remark: "", deleted: false, siteId: siteId ?? null,
                    }
                });
            }
            // ===== END: trackStock ON → OFF =====

            // ===== trackStock transition: OFF → ON (simple items) =====
            if (turningOn && !currentItem!.hasVariants) {
                const qty = stockQuantity || 0;

                // Create StockBalance
                await tx.stockBalance.create({
                    data: {
                        itemId: id, outletId: 1,
                        availableQuantity: qty, onHandQuantity: qty,
                        reorderThreshold: reorderThreshold || 0,
                        deleted: false,
                    }
                });

                // Audit trail
                await tx.stockMovement.create({
                    data: {
                        itemId: id, outletId: 1,
                        previousAvailableQuantity: 0, previousOnHandQuantity: 0,
                        availableQuantityDelta: qty, onHandQuantityDelta: qty,
                        documentId: 0,
                        movementType: "Stock Tracking Enabled",
                        reason: "trackStock changed from off to on",
                        remark: "", deleted: false, siteId: siteId ?? null,
                    }
                });

                // Create StockReceipt if cost > 0 AND qty > 0
                // updateData.cost is the ORIGINAL frontend value (untouched by the zeroing of itemUpdateData.cost)
                const originalCost = updateData.cost || 0;
                if (originalCost > 0 && qty > 0) {
                    await tx.stockReceipt.create({
                        data: {
                            itemId: id, outletId: 1,
                            quantity: qty, cost: originalCost,
                            receiptDate: new Date(),
                            deleted: false, version: 1,
                        }
                    });
                }
            }
            // ===== END: trackStock OFF → ON (simple items) =====

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

            // Handle variants update/creation if provided.
            // NOTE: an EMPTY array means "no variant changes" — never enter the
            // block, or the auto-flag below wrongly sets hasVariants=true on a
            // variant-less item (e.g. saving its spec/photo from the details
            // dialog, which round-trips the item with `variants: []`). Deletions
            // are sent as `[{id, deleted:true}]`, so a real change is length > 0.
            if (variants && Array.isArray(variants) && variants.length > 0) {
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

                // ===== Batch validate barcode uniqueness =====
                const barcodesToValidate = variants
                    .filter((v: any) => !v.deleted && v.barcode !== undefined && v.barcode !== null && v.barcode.trim() !== '')
                    .map((v: any) => ({ id: v.id || null, barcode: v.barcode as string }));

                if (barcodesToValidate.length > 0) {
                    const barcodeValues = barcodesToValidate.map(b => b.barcode);
                    const variantIdsBeingUpdated = barcodesToValidate.filter(b => b.id !== null).map(b => b.id);

                    const existingWithBarcode = await tx.itemVariant.findMany({
                        where: {
                            barcode: { in: barcodeValues },
                            deleted: false,
                            ...(variantIdsBeingUpdated.length > 0 ? { id: { notIn: variantIdsBeingUpdated } } : {})
                        },
                        select: {
                            id: true,
                            barcode: true,
                            variantName: true,
                            item: { select: { id: true, itemName: true } }
                        }
                    });

                    if (existingWithBarcode.length > 0) {
                        const duplicates = existingWithBarcode.map(v =>
                            `"${v.barcode}" (Item ID: ${v.item.id}, Item: ${v.item.itemName}, Variant: ${v.variantName})`
                        ).join(', ');
                        throw new BusinessLogicError(`Variants with barcode already exist: ${duplicates}`);
                    }

                    // Cross-table check: variant barcode must not exist as an item alternateLookup
                    const itemsWithSameLookup = await tx.item.findMany({
                        where: {
                            alternateLookUp: { in: barcodeValues },
                            deleted: false
                        },
                        select: {
                            id: true,
                            itemName: true,
                            alternateLookUp: true
                        }
                    });

                    if (itemsWithSameLookup.length > 0) {
                        const duplicates = itemsWithSameLookup.map(item =>
                            `"${item.alternateLookUp}" (Item ID: ${item.id}, Item Name: ${item.itemName})`
                        ).join(', ');
                        throw new BusinessLogicError(`Barcode already used by item: ${duplicates}`);
                    }
                }
                // ===== END: Barcode uniqueness validation =====

                // Track if any variants were deleted (for hasVariants check later)
                let variantDeleted = false;

                // Track new variant IDs and stock data for stock record creation
                const newVariantIds: number[] = [];
                const variantStockDataMap = new Map<number, { stockQuantity: number; cost: number }>();

                // Auto-flag hasVariants if not already set
                if (!itemUpdate.hasVariants) {
                    await tx.item.update({
                        where: { id },
                        data: { hasVariants: true },
                    });
                }

                // Process each variant
                for (const variantData of variants) {
                    const { id: variantId, attributes, removeAttributes, stockQuantity: variantStockQty, ...variantFields } = variantData;

                    // Validate: reject negative stock quantities for new variants
                    if (!variantId && variantStockQty !== undefined && variantStockQty < 0) {
                        throw new BusinessLogicError(
                            `Initial stock quantity cannot be negative for variant "${variantFields.variantSku || variantFields.variantName}"`
                        );
                    }

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
                                    cost: (itemUpdate.trackStock !== false) ? 0 : (variantFields.cost || 0),
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
                                    cost: (itemUpdate.trackStock !== false) ? 0 : (variantFields.cost ?? null),
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

                            // Track per-variant stock data for batch creation
                            if (variantStockQty || variantFields.cost) {
                                variantStockDataMap.set(existingSoftDeleted.id, {
                                    stockQuantity: variantStockQty || 0,
                                    cost: variantFields.cost || 0,
                                });
                            }

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
                                    cost: (itemUpdate.trackStock !== false) ? 0 : (variantFields.cost || 0),
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

                            // Track per-variant stock data for batch creation
                            if (variantStockQty || variantFields.cost) {
                                variantStockDataMap.set(variant.id, {
                                    stockQuantity: variantStockQty || 0,
                                    cost: variantFields.cost || 0,
                                });
                            }

                            // Create variant attributes using helper function
                            if (attributes && Array.isArray(attributes)) {
                                for (const attr of attributes) {
                                    await processVariantAttribute(tx, variant.id, attr);
                                }
                            }
                        }
                    }
                }

                // Create StockBalance, StockMovement, and StockReceipt for all new variants (only for stock-tracked items)
                // Skip when turningOn — step 6 below handles ALL variants during off→on transition
                if (newVariantIds.length > 0 && itemUpdate.trackStock !== false && !turningOn) {
                    await createVariantStockRecords(tx, id, newVariantIds, 1, variantStockDataMap, siteId ?? null);
                }

                // ===== trackStock transition: OFF → ON (variant items) =====
                if (turningOn && currentItem!.hasVariants) {
                    // Query ALL active variants (includes newly created ones from the loop above)
                    const allActiveVariants = await tx.itemVariant.findMany({
                        where: { itemId: id, deleted: false },
                        select: { id: true }
                    });

                    // Build stock data map from variants array (for EXISTING variants with IDs)
                    // New variants created during this update won't have v.id in the input → they get qty=0
                    // This is correct by design: new variants via update always start at qty=0
                    const variantStockDataMap = new Map<number, { stockQuantity: number; cost: number }>();
                    if (variants && Array.isArray(variants)) {
                        for (const v of variants) {
                            if (v.id && v.stockQuantity !== undefined) {
                                variantStockDataMap.set(v.id, {
                                    stockQuantity: v.stockQuantity || 0,
                                    cost: v.cost || 0,
                                });
                            }
                        }
                    }

                    // Create StockBalance + StockMovement + StockReceipt for all variants
                    await createVariantStockRecords(
                        tx, id,
                        allActiveVariants.map(v => v.id),
                        1,
                        variantStockDataMap,
                        siteId ?? null
                    );

                    // Zero out ALL variant costs (FIFO is now the cost source)
                    // This catches variants NOT in the update payload too
                    await tx.itemVariant.updateMany({
                        where: { itemId: id, deleted: false },
                        data: { cost: 0 }
                    });

                    // Audit trail
                    await tx.stockMovement.create({
                        data: {
                            itemId: id, outletId: 1,
                            previousAvailableQuantity: 0, previousOnHandQuantity: 0,
                            availableQuantityDelta: 0, onHandQuantityDelta: 0,
                            documentId: 0,
                            movementType: "Stock Tracking Enabled",
                            reason: "trackStock changed from off to on",
                            remark: "", deleted: false, siteId: siteId ?? null,
                        }
                    });
                }
                // ===== END: trackStock OFF → ON (variant items) =====

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
            // Laundry: cascade-clean recipe lines (item_consumable) that touch
            // this item — whether it was a supply (consumableItemId) or a service
            // (serviceItemId). Leaving them orphaned makes the app reference a
            // deleted supply and false-trip the sale-time "stok bahan tidak cukup"
            // check. Matches the client-side cleanup in DeleteItemCubit.
            tenantPrisma.itemConsumable.updateMany({
                where: {
                    deleted: false,
                    OR: [{ consumableItemId: id }, { serviceItemId: id }],
                },
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
    getSupplyCosts,
}