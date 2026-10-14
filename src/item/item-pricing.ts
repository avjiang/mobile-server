// Wholesale pricing (grosir / ecer) — the item's sell units and price tiers.
// Plan: FE docs/future/MULTI_TIER_PRICING.md §2.2 (schema) and §2.3 (sync).
//
// Both lists ride INSIDE the item payload, the way `variants` and `suppliers` do:
//   - read:  `units[]` / `priceTiers[]` (non-deleted rows) on every item sync/getById;
//   - write: optional `units[]` / `priceTiers[]` on item create/update.
//
// Write contract (same as `suppliers`):
//   - key missing / null → leave the stored rows alone (older binaries, outbox replays);
//   - array present      → it is the COMPLETE set: rows with an `id` are updated, rows
//                          without one are created, stored rows not in it are
//                          SOFT-deleted (the FE mirrors that, like variants).
//
// ⚠ Children only reach devices inside their item's delta, so every write here bumps
// Item.updatedAt (plan §2.3 gotcha — it already bit consumables).

import { Prisma } from "../../prisma/client/generated/client";
import { Decimal } from "decimal.js";
import { BusinessLogicError, ErrorCode, PlanLimitError } from "../api-helpers/error";
import { isLitePlan } from "../middleware/require-plan.middleware";

/** Matches `item_unit.NAME` / `sales_item.UNIT_NAME` (VARCHAR(32)). */
export const UNIT_NAME_MAX = 32;

/** One entry of the client's `units[]` payload. */
export interface ItemUnitInput {
    id?: number | null;
    itemVariantId?: number | null;
    name?: string | null;
    factor?: number | string | null;
    price?: number | string | null;
    barcode?: string | null;
    sortOrder?: number | null;
}

/**
 * One entry of the client's `priceTiers[]` payload. A tier names its unit either by
 * `itemUnitId` (a stored unit) or by `unitName` (a unit created in the same request,
 * which has no id yet; names are unique per item). Neither = the base unit.
 */
export interface ItemPriceTierInput {
    id?: number | null;
    itemVariantId?: number | null;
    itemUnitId?: number | null;
    unitName?: string | null;
    priceLevelId?: number | null;
    minQuantity?: number | string | null;
    price?: number | string | null;
}

export interface NormalizedUnit {
    id: number | null;
    itemVariantId: number | null;
    name: string;
    factor: Decimal;
    price: Decimal;
    barcode: string | null;
    sortOrder: number;
}

export interface NormalizedTier {
    id: number | null;
    itemVariantId: number | null;
    itemUnitId: number | null;
    unitName: string | null;
    priceLevelId: number | null;
    minQuantity: Decimal;
    price: Decimal;
}

const optionalId = (v: unknown, field: string): number | null => {
    if (v === undefined || v === null) return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0) {
        throw new BusinessLogicError(`Invalid ${field}: ${String(v)}`);
    }
    return n;
};

const finiteDecimal = (v: unknown, field: string): Decimal => {
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
        throw new BusinessLogicError(`${field} is required`);
    }
    let d: Decimal;
    try {
        d = new Decimal(v as any);
    } catch {
        throw new BusinessLogicError(`${field} must be a number`);
    }
    if (!d.isFinite()) throw new BusinessLogicError(`${field} must be a number`);
    return d;
};

/**
 * Validate and normalise a `units[]` payload (pure; no DB). Rules:
 * name required, ≤ 32 chars and unique per item (case-insensitive); factor > 1;
 * price ≥ 0; barcode trimmed (empty → null) and unique within the payload.
 */
export function normalizeUnits(units: unknown): NormalizedUnit[] {
    if (!Array.isArray(units)) throw new BusinessLogicError('units must be an array');
    const names = new Set<string>();
    const barcodes = new Set<string>();
    return units.map((raw: ItemUnitInput, index): NormalizedUnit => {
        const name = (raw?.name ?? '').toString().trim();
        if (name === '') throw new BusinessLogicError('Unit name is required');
        if (name.length > UNIT_NAME_MAX) {
            throw new BusinessLogicError(`Unit name "${name}" is longer than ${UNIT_NAME_MAX} characters`);
        }
        const key = name.toLowerCase();
        if (names.has(key)) throw new BusinessLogicError(`Unit name "${name}" is used twice on this item`);
        names.add(key);

        const factor = finiteDecimal(raw?.factor, `Unit "${name}" factor`);
        if (factor.lte(1)) {
            throw new BusinessLogicError(`Unit "${name}" must hold more than 1 base unit (factor > 1)`);
        }
        const price = finiteDecimal(raw?.price, `Unit "${name}" price`);
        if (price.isNegative()) throw new BusinessLogicError(`Unit "${name}" price cannot be negative`);

        const barcodeRaw = (raw?.barcode ?? '').toString().trim();
        const barcode = barcodeRaw === '' ? null : barcodeRaw;
        if (barcode !== null) {
            if (barcodes.has(barcode)) {
                throw new BusinessLogicError(`Barcode "${barcode}" is used by two units of this item`);
            }
            barcodes.add(barcode);
        }

        const sortOrder = raw?.sortOrder != null && Number.isInteger(Number(raw.sortOrder))
            ? Number(raw.sortOrder)
            : index;

        return {
            id: optionalId(raw?.id, 'unit id'),
            itemVariantId: optionalId(raw?.itemVariantId, 'unit itemVariantId'),
            name,
            factor,
            price,
            barcode,
            sortOrder,
        };
    });
}

/**
 * Validate and normalise a `priceTiers[]` payload (pure; no DB). Rules:
 * price ≥ 0; minQuantity > 0 (default 1); no two rows for the same
 * (variant, unit, level, minQuantity).
 */
export function normalizeTiers(tiers: unknown): NormalizedTier[] {
    if (!Array.isArray(tiers)) throw new BusinessLogicError('priceTiers must be an array');
    return tiers.map((raw: ItemPriceTierInput): NormalizedTier => {
        const price = finiteDecimal(raw?.price, 'Price tier price');
        if (price.isNegative()) throw new BusinessLogicError('Price tier price cannot be negative');
        const minQuantity = raw?.minQuantity === undefined || raw?.minQuantity === null
            ? new Decimal(1)
            : finiteDecimal(raw.minQuantity, 'Price tier minimum quantity');
        if (minQuantity.lte(0)) throw new BusinessLogicError('Price tier minimum quantity must be more than 0');
        const unitNameRaw = (raw?.unitName ?? '').toString().trim();
        return {
            id: optionalId(raw?.id, 'price tier id'),
            itemVariantId: optionalId(raw?.itemVariantId, 'price tier itemVariantId'),
            itemUnitId: optionalId(raw?.itemUnitId, 'price tier itemUnitId'),
            unitName: unitNameRaw === '' ? null : unitNameRaw,
            priceLevelId: optionalId(raw?.priceLevelId, 'price tier priceLevelId'),
            minQuantity,
            price,
        };
    });
}

/** Rejects a duplicate (variant, unit, level, minQuantity) once units are resolved to ids. */
export function assertNoDuplicateTiers(tiers: Array<NormalizedTier & { resolvedUnitId: number | null }>): void {
    const seen = new Set<string>();
    for (const t of tiers) {
        const key = `${t.itemVariantId ?? '-'}|${t.resolvedUnitId ?? '-'}|${t.priceLevelId ?? '-'}|${t.minQuantity.toString()}`;
        if (seen.has(key)) {
            throw new BusinessLogicError(`Two price tiers start at the same quantity (${t.minQuantity.toString()}) for the same unit and level`);
        }
        seen.add(key);
    }
}

/**
 * Retail Lite has no wholesale pricing (owner, 2026-10-14). Same rule as variants:
 * a step down blocks ADDING, never using — rows carried over from a higher plan
 * (they have ids) stay editable/removable; a new row is refused.
 */
export function assertWholesaleAllowed(
    planName: string | null | undefined,
    units: unknown,
    tiers: unknown,
): void {
    if (!isLitePlan(planName)) return;
    const addsNew = (list: unknown) =>
        Array.isArray(list) && list.some((r: any) => r?.id === undefined || r?.id === null);
    if (addsNew(units) || addsNew(tiers)) {
        throw new PlanLimitError(
            'Wholesale pricing is not part of the Lite plan',
            ErrorCode.PlanFeatureLocked,
            { plan: 'Lite' },
        );
    }
}

/**
 * A barcode a unit uses may not be used anywhere else: item `alternateLookUp`, a
 * variant barcode, or another item's unit. Checked against the database (after the
 * item row itself was written, so this item's own new alternateLookUp is included).
 */
async function assertUnitBarcodesFree(
    tx: Prisma.TransactionClient,
    itemId: number,
    barcodes: string[],
): Promise<void> {
    if (barcodes.length === 0) return;
    const items = await tx.item.findMany({
        where: { alternateLookUp: { in: barcodes }, deleted: false },
        select: { id: true, itemName: true, alternateLookUp: true },
    });
    if (items.length > 0) {
        const dup = items.map(i => `"${i.alternateLookUp}" (Item ID: ${i.id}, Item Name: ${i.itemName})`).join(', ');
        throw new BusinessLogicError(`Barcode already used by item: ${dup}`);
    }
    const variants = await tx.itemVariant.findMany({
        where: { barcode: { in: barcodes }, deleted: false },
        select: { barcode: true, variantName: true, item: { select: { id: true, itemName: true } } },
    });
    if (variants.length > 0) {
        const dup = variants.map(v => `"${v.barcode}" (Item ID: ${v.item.id}, Item: ${v.item.itemName}, Variant: ${v.variantName})`).join(', ');
        throw new BusinessLogicError(`Barcode already used by variant: ${dup}`);
    }
    // This item's own units are excluded: the payload is their complete new set,
    // and uniqueness inside it was checked by normalizeUnits.
    const units = await tx.itemUnit.findMany({
        where: { barcode: { in: barcodes }, deleted: false, itemId: { not: itemId } },
        select: { barcode: true, name: true, item: { select: { id: true, itemName: true } } },
    });
    if (units.length > 0) {
        const dup = units.map(u => `"${u.barcode}" (Item ID: ${u.item.id}, Item: ${u.item.itemName}, Unit: ${u.name})`).join(', ');
        throw new BusinessLogicError(`Barcode already used by unit: ${dup}`);
    }
}

/**
 * The reverse direction of [assertUnitBarcodesFree]: an item barcode or variant
 * barcode being saved must not already be a unit's barcode (a scan would be
 * ambiguous). Called from item create/update next to the existing cross-table checks.
 */
export async function assertBarcodesNotUnitBarcodes(
    tx: Prisma.TransactionClient,
    barcodes: string[],
): Promise<void> {
    const list = barcodes.map(b => (b ?? '').trim()).filter(b => b !== '');
    if (list.length === 0) return;
    const units = await tx.itemUnit.findMany({
        where: { barcode: { in: list }, deleted: false },
        select: { barcode: true, name: true, item: { select: { id: true, itemName: true } } },
    });
    if (units.length > 0) {
        const dup = units.map(u => `"${u.barcode}" (Item ID: ${u.item.id}, Item: ${u.item.itemName}, Unit: ${u.name})`).join(', ');
        throw new BusinessLogicError(`Barcode already used by unit: ${dup}`);
    }
}

async function assertVariantsBelong(
    tx: Prisma.TransactionClient,
    itemId: number,
    variantIds: number[],
): Promise<void> {
    const ids = [...new Set(variantIds)];
    if (ids.length === 0) return;
    const found = await tx.itemVariant.findMany({
        where: { id: { in: ids }, itemId, deleted: false },
        select: { id: true },
    });
    if (found.length !== ids.length) {
        throw new BusinessLogicError('A unit or price tier points at a variant that is not on this item');
    }
}

/**
 * Reconcile an item's units and price tiers against the client payload, inside the
 * caller's transaction. Returns true when anything was written (Item.updatedAt was
 * then bumped). Call it AFTER the item row was created/updated.
 */
export async function syncItemUnitsAndTiers(
    tx: Prisma.TransactionClient,
    itemId: number,
    unitsPayload: unknown,
    tiersPayload: unknown,
    planName: string | null | undefined,
): Promise<boolean> {
    const hasUnits = unitsPayload !== undefined && unitsPayload !== null;
    const hasTiers = tiersPayload !== undefined && tiersPayload !== null;
    if (!hasUnits && !hasTiers) return false;

    assertWholesaleAllowed(planName, unitsPayload, tiersPayload);
    const now = new Date();

    // ── Units ────────────────────────────────────────────────────────────────
    let removedUnitIds: number[] = [];
    if (hasUnits) {
        const units = normalizeUnits(unitsPayload);
        const stored = await tx.itemUnit.findMany({ where: { itemId, deleted: false }, select: { id: true } });
        const storedIds = new Set(stored.map(u => u.id));
        for (const u of units) {
            if (u.id !== null && !storedIds.has(u.id)) {
                throw new BusinessLogicError(`Unit ${u.id} does not belong to this item`);
            }
        }
        await assertVariantsBelong(tx, itemId, units.map(u => u.itemVariantId).filter((v): v is number => v !== null));
        await assertUnitBarcodesFree(tx, itemId, units.map(u => u.barcode).filter((b): b is string => b !== null));

        const keptIds = new Set<number>();
        for (const u of units) {
            const data = {
                itemVariantId: u.itemVariantId,
                name: u.name,
                factor: u.factor.toString(),
                price: u.price.toString(),
                barcode: u.barcode,
                sortOrder: u.sortOrder,
            };
            if (u.id !== null) {
                await tx.itemUnit.update({ where: { id: u.id }, data: { ...data, updatedAt: now } });
                keptIds.add(u.id);
            } else {
                const created = await tx.itemUnit.create({ data: { itemId, ...data, deleted: false, version: 1 } });
                keptIds.add(created.id);
            }
        }
        removedUnitIds = [...storedIds].filter(id => !keptIds.has(id));
        if (removedUnitIds.length > 0) {
            await tx.itemUnit.updateMany({
                where: { id: { in: removedUnitIds } },
                data: { deleted: true, deletedAt: now, updatedAt: now },
            });
        }
    }

    // ── Price tiers ──────────────────────────────────────────────────────────
    if (hasTiers) {
        const tiers = normalizeTiers(tiersPayload);
        const liveUnits = await tx.itemUnit.findMany({
            where: { itemId, deleted: false },
            select: { id: true, name: true },
        });
        const unitIdSet = new Set(liveUnits.map(u => u.id));
        const unitIdByName = new Map(liveUnits.map(u => [u.name.toLowerCase(), u.id]));

        const resolved = tiers.map(t => {
            let resolvedUnitId: number | null = null;
            if (t.itemUnitId !== null) {
                if (!unitIdSet.has(t.itemUnitId)) {
                    throw new BusinessLogicError(`Price tier points at unit ${t.itemUnitId}, which is not on this item`);
                }
                resolvedUnitId = t.itemUnitId;
            } else if (t.unitName !== null) {
                const id = unitIdByName.get(t.unitName.toLowerCase());
                if (id === undefined) {
                    throw new BusinessLogicError(`Price tier points at unit "${t.unitName}", which is not on this item`);
                }
                resolvedUnitId = id;
            }
            return { ...t, resolvedUnitId };
        });
        assertNoDuplicateTiers(resolved);
        await assertVariantsBelong(tx, itemId, resolved.map(t => t.itemVariantId).filter((v): v is number => v !== null));

        const levelIds = [...new Set(resolved.map(t => t.priceLevelId).filter((v): v is number => v !== null))];
        if (levelIds.length > 0) {
            const levels = await tx.priceLevel.findMany({
                where: { id: { in: levelIds }, deleted: false },
                select: { id: true },
            });
            if (levels.length !== levelIds.length) {
                throw new BusinessLogicError('A price tier points at a price level that does not exist');
            }
        }

        const stored = await tx.itemPriceTier.findMany({ where: { itemId, deleted: false }, select: { id: true } });
        const storedIds = new Set(stored.map(t => t.id));
        const keptIds = new Set<number>();
        for (const t of resolved) {
            const data = {
                itemVariantId: t.itemVariantId,
                itemUnitId: t.resolvedUnitId,
                priceLevelId: t.priceLevelId,
                minQuantity: t.minQuantity.toString(),
                price: t.price.toString(),
            };
            if (t.id !== null) {
                if (!storedIds.has(t.id)) {
                    throw new BusinessLogicError(`Price tier ${t.id} does not belong to this item`);
                }
                await tx.itemPriceTier.update({ where: { id: t.id }, data: { ...data, updatedAt: now } });
                keptIds.add(t.id);
            } else {
                const created = await tx.itemPriceTier.create({ data: { itemId, ...data, deleted: false, version: 1 } });
                keptIds.add(created.id);
            }
        }
        const dropped = [...storedIds].filter(id => !keptIds.has(id));
        if (dropped.length > 0) {
            await tx.itemPriceTier.updateMany({
                where: { id: { in: dropped } },
                data: { deleted: true, deletedAt: now, updatedAt: now },
            });
        }
    }

    // A removed unit takes its tiers with it (a units-only payload leaves the tier
    // list untouched otherwise, and a tier on a deleted unit would never apply).
    if (removedUnitIds.length > 0) {
        await tx.itemPriceTier.updateMany({
            where: { itemId, itemUnitId: { in: removedUnitIds }, deleted: false },
            data: { deleted: true, deletedAt: now, updatedAt: now },
        });
    }

    // Children only travel inside the item's delta → bump the parent.
    await tx.item.update({ where: { id: itemId }, data: { updatedAt: new Date() } });
    return true;
}

// ── Read payload ─────────────────────────────────────────────────────────────

/** Prisma `include` fragments for the item read/sync queries. */
export const itemUnitsInclude = {
    where: { deleted: false },
    orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
    select: {
        id: true,
        itemVariantId: true,
        name: true,
        factor: true,
        price: true,
        barcode: true,
        sortOrder: true,
    },
};

export const itemPriceTiersInclude = {
    where: { deleted: false },
    orderBy: [{ id: 'asc' as const }],
    select: {
        id: true,
        itemVariantId: true,
        itemUnitId: true,
        priceLevelId: true,
        minQuantity: true,
        price: true,
    },
};

type UnitRow = { id: number; itemVariantId: number | null; name: string; factor: any; price: any; barcode: string | null; sortOrder: number };
type TierRow = { id: number; itemVariantId: number | null; itemUnitId: number | null; priceLevelId: number | null; minQuantity: any; price: any };

/** Flatten unit rows for the client (Decimal → number). */
export const toUnitPayload = (rows: UnitRow[] | undefined | null) =>
    (rows ?? []).map(u => ({
        id: u.id,
        itemVariantId: u.itemVariantId,
        name: u.name,
        factor: Number(u.factor),
        price: Number(u.price),
        barcode: u.barcode,
        sortOrder: u.sortOrder,
    }));

/** Flatten tier rows for the client (Decimal → number). */
export const toTierPayload = (rows: TierRow[] | undefined | null) =>
    (rows ?? []).map(t => ({
        id: t.id,
        itemVariantId: t.itemVariantId,
        itemUnitId: t.itemUnitId,
        priceLevelId: t.priceLevelId,
        minQuantity: Number(t.minQuantity),
        price: Number(t.price),
    }));
