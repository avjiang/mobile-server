// Wholesale pricing — customer price levels ("Grosir", "Reseller").
// Plan: FE docs/modules/ITEM.md § Wholesale pricing data model. A small delta-synced
// master list (like categories); Customer.priceLevelId and ItemPriceTier.priceLevelId
// point here. Rows are only ever soft-deleted.

import { PrismaClient } from "../../prisma/client/generated/client";
import { BusinessLogicError, ErrorCode, NotFoundError, RequestValidateError } from "../api-helpers/error";
import { getTenantPrisma } from "../db";
import { SyncRequest } from "../item/item.request";

/** Matches `price_level.NAME` (VARCHAR(32)). */
export const PRICE_LEVEL_NAME_MAX = 32;

/** Trim + validate a level name (pure). */
export function normalizePriceLevelName(raw: unknown): string {
    const name = (raw ?? '').toString().trim();
    if (name === '') throw new RequestValidateError('Price level name is required');
    if (name.length > PRICE_LEVEL_NAME_MAX) {
        throw new RequestValidateError(`Price level name is longer than ${PRICE_LEVEL_NAME_MAX} characters`);
    }
    return name;
}

const toPayload = (l: { id: number; name: string; deleted: boolean; createdAt: Date | null; updatedAt: Date | null; deletedAt: Date | null; version: number | null }) => ({
    id: l.id,
    name: l.name,
    deleted: l.deleted,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
    deletedAt: l.deletedAt,
    version: l.version,
});

/**
 * Delta sync. Unlike categories, deleted rows ARE returned (inside the window), so a
 * device learns about a removed level and stops offering it.
 */
let getAll = async (databaseName: string, syncRequest: SyncRequest) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const { lastSyncTimestamp, lastVersion, skip = 0, take = 100 } = syncRequest;
    let where: any;
    if (lastVersion) {
        where = { version: { gt: lastVersion } };
    } else if (!lastSyncTimestamp || lastSyncTimestamp === 'null') {
        where = { deleted: false }; // first sync: live rows only
    } else {
        const lastSync = new Date(lastSyncTimestamp);
        where = {
            OR: [
                { createdAt: { gte: lastSync } },
                { updatedAt: { gte: lastSync } },
                { deletedAt: { gte: lastSync } },
            ],
        };
    }
    const total = await tenantPrisma.priceLevel.count({ where });
    const rows = await tenantPrisma.priceLevel.findMany({ where, skip, take, orderBy: { id: 'asc' } });
    return { priceLevels: rows.map(toPayload), total, serverTimestamp: new Date().toISOString() };
};

let getById = async (databaseName: string, id: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const level = await tenantPrisma.priceLevel.findUnique({ where: { id } });
    if (!level) throw new NotFoundError("Price level");
    return toPayload(level);
};

async function assertNameFree(tenantPrisma: PrismaClient, name: string, excludeId?: number) {
    // The table collation is case-insensitive, so "grosir" collides with "Grosir".
    const clash = await tenantPrisma.priceLevel.findFirst({
        where: { name, deleted: false, ...(excludeId !== undefined ? { id: { not: excludeId } } : {}) },
        select: { id: true },
    });
    if (clash) throw new BusinessLogicError(`Price level "${name}" already exists`, ErrorCode.PriceLevelNameTaken, { name });
}

let createMany = async (databaseName: string, levels: Array<{ name?: unknown }>) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    if (!Array.isArray(levels) || levels.length === 0) {
        throw new RequestValidateError('priceLevels must be a non-empty array');
    }
    const names = levels.map(l => normalizePriceLevelName(l?.name));
    const lower = names.map(n => n.toLowerCase());
    if (new Set(lower).size !== lower.length) {
        const dup = names.find((n, i) => lower.indexOf(n.toLowerCase()) !== i) ?? names[0];
        throw new BusinessLogicError('The same price level name is used twice', ErrorCode.PriceLevelNameTaken, { name: dup });
    }
    for (const n of names) await assertNameFree(tenantPrisma, n);
    const created = await tenantPrisma.$transaction(
        names.map(name => tenantPrisma.priceLevel.create({ data: { name, deleted: false, version: 1 } })),
    );
    return created.map(toPayload);
};

let update = async (databaseName: string, body: { id?: unknown; name?: unknown }) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id <= 0) throw new RequestValidateError('Update failed: [id] not found');
    const name = normalizePriceLevelName(body?.name);
    const existing = await tenantPrisma.priceLevel.findFirst({ where: { id, deleted: false } });
    if (!existing) throw new NotFoundError("Price level");
    await assertNameFree(tenantPrisma, name, id);
    const updated = await tenantPrisma.priceLevel.update({ where: { id }, data: { name } });
    return toPayload(updated);
};

/**
 * The delete rule (Phase 3, the safer of the two options): a level that live
 * customers still carry is NOT deleted — silently dropping "Toko Budi" back to ecer
 * would change what a shop charges a regular buyer without anyone deciding it. The
 * owner moves those customers first (customer form → Level harga). Pure; tagged so
 * the app says it in the user's language.
 */
export function assertLevelNotInUse(name: string, customerCount: number): void {
    if (customerCount > 0) {
        throw new BusinessLogicError(
            `Price level "${name}" is still used by ${customerCount} customer(s)`,
            ErrorCode.PriceLevelInUse,
            { name, count: String(customerCount) },
        );
    }
}

/**
 * Soft-delete a level that no live customer uses ([assertLevelNotInUse]). Its item
 * level prices go with it (they could never apply again) and are re-synced by bumping
 * their items' updatedAt (tiers travel inside the item delta). Soft-deleted customers
 * still pointing at it are cleared, so a restore never resurrects a dead level.
 */
let remove = async (databaseName: string, id: number) => {
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    return tenantPrisma.$transaction(async (tx) => {
        const existing = await tx.priceLevel.findFirst({ where: { id, deleted: false } });
        if (!existing) throw new NotFoundError("Price level");
        const inUse = await tx.customer.count({ where: { priceLevelId: id, deleted: false } });
        assertLevelNotInUse(existing.name, inUse);
        const now = new Date();
        const tiers = await tx.itemPriceTier.findMany({
            where: { priceLevelId: id, deleted: false },
            select: { itemId: true },
        });
        if (tiers.length > 0) {
            await tx.itemPriceTier.updateMany({
                where: { priceLevelId: id, deleted: false },
                data: { deleted: true, deletedAt: now, updatedAt: now },
            });
            const itemIds = [...new Set(tiers.map(t => t.itemId))];
            await tx.item.updateMany({ where: { id: { in: itemIds } }, data: { updatedAt: now } });
        }
        await tx.customer.updateMany({
            where: { priceLevelId: id },
            data: { priceLevelId: null, updatedAt: now },
        });
        const removed = await tx.priceLevel.update({
            where: { id },
            data: { deleted: true, deletedAt: now },
        });
        return toPayload(removed);
    });
};

/**
 * A customer's `priceLevelId`, when sent and not null, must name a live level. Used by
 * customer create/update so a bad id is a clear 400, not a raw foreign-key error.
 */
let assertLevelExists = async (databaseName: string, priceLevelId: unknown) => {
    if (priceLevelId === undefined || priceLevelId === null) return;
    const id = Number(priceLevelId);
    if (!Number.isInteger(id) || id <= 0) throw new BusinessLogicError(`Invalid priceLevelId: ${String(priceLevelId)}`);
    const tenantPrisma: PrismaClient = getTenantPrisma(databaseName);
    const level = await tenantPrisma.priceLevel.findFirst({ where: { id, deleted: false }, select: { id: true } });
    if (!level) throw new BusinessLogicError('The selected price level does not exist');
};

export default { getAll, getById, createMany, update, remove, assertLevelExists };
