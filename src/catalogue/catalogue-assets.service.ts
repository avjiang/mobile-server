import { getTenantPrisma } from "../db";
import { BusinessLogicError } from "../api-helpers/error";
import {
  listStorageObjects,
  deleteStorageObject,
  getStorageUsage,
  CATALOGUE_STORAGE_LIMIT_BYTES,
  ImageTargetKind,
} from "./catalogue-storage.service";

/**
 * Catalogue ASSET MANAGEMENT — the merchant-facing "Catalogue Storage" screen.
 *
 * Lists every photo a tenant has stored in R2, mapped back to the owning
 * item/variant so the merchant sees product names (not opaque keys), and lets
 * them delete photos to reclaim space. Critically, it also surfaces ORPHANS —
 * objects whose owning item/variant was deleted (or had its photo pointer
 * cleared) — which still count against the storage cap but are unreachable
 * from any product screen. Cleaning those up is the only way to recover that
 * space.
 *
 * See docs/future/ONLINE_CATALOGUE.md (asset-management addendum).
 */

export interface CatalogueAsset {
  key: string; // R2 object key, e.g. "11/items/42.webp"
  kind: ImageTargetKind; // 'item' | 'variant'
  targetId: number; // owning item/variant id parsed from the key
  name: string | null; // product/variant name, or null when orphaned
  sizeBytes: number;
  imageUrl: string; // public URL for thumbnail display
  orphan: boolean; // true → no live item/variant references this object
  lastModified?: string;
}

export interface CatalogueStorageReport {
  assets: CatalogueAsset[]; // sorted largest-first
  storageUsedBytes: number;
  storageLimitBytes: number;
  orphanCount: number;
  orphanBytes: number;
}

interface ParsedKey {
  kind: ImageTargetKind;
  targetId: number;
}

/** Parse a tenant's image key → kind + target id, or null if it isn't one. */
function parseAssetKey(tenantId: number, key: string): ParsedKey | null {
  const re = new RegExp(`^${tenantId}/(items|variants)/(\\d+)\\.webp$`);
  const m = key.match(re);
  if (!m) return null;
  return {
    kind: m[1] === "variants" ? "variant" : "item",
    targetId: Number(m[2]),
  };
}

function buildKey(tenantId: number, kind: ImageTargetKind, targetId: number) {
  const folder = kind === "variant" ? "variants" : "items";
  return `${tenantId}/${folder}/${targetId}.webp`;
}

function publicUrl(key: string): string {
  const base = (process.env.R2_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
  return `${base}/${key}`;
}

/**
 * Build the storage report: every R2 object joined to its owning item/variant,
 * orphans flagged, sorted largest-first.
 */
export async function getCatalogueStorageReport(
  tenantId: number,
  databaseName: string
): Promise<CatalogueStorageReport> {
  const objects = await listStorageObjects(tenantId);

  // Collect the item/variant ids referenced by the keys so we can look up names
  // and liveness in a single query each.
  const itemIds: number[] = [];
  const variantIds: number[] = [];
  for (const obj of objects) {
    const parsed = parseAssetKey(tenantId, obj.key);
    if (!parsed) continue;
    if (parsed.kind === "item") itemIds.push(parsed.targetId);
    else variantIds.push(parsed.targetId);
  }

  const prisma = getTenantPrisma(databaseName);
  const [items, variants] = await Promise.all([
    itemIds.length
      ? prisma.item.findMany({
          where: { id: { in: itemIds } },
          select: { id: true, itemName: true, image: true, deleted: true },
        })
      : Promise.resolve([]),
    variantIds.length
      ? prisma.itemVariant.findMany({
          where: { id: { in: variantIds } },
          select: { id: true, variantName: true, image: true, deleted: true },
        })
      : Promise.resolve([]),
  ]);

  const itemById = new Map(items.map((i) => [i.id, i]));
  const variantById = new Map(variants.map((v) => [v.id, v]));

  const assets: CatalogueAsset[] = [];
  let usedBytes = 0;
  let orphanBytes = 0;

  const brandingRe = new RegExp(`^${tenantId}/branding/`);

  for (const obj of objects) {
    usedBytes += obj.sizeBytes;

    // Storefront logo/cover live under `<tenantId>/branding/` and are managed in
    // Catalogue Settings, not the photo manager. Count their bytes toward the
    // total but never list them here — otherwise "Clean up unused" would treat
    // them as orphans and delete the merchant's branding.
    if (brandingRe.test(obj.key)) continue;

    const parsed = parseAssetKey(tenantId, obj.key);

    // A key we can't attribute to an item/variant is, by definition, orphaned.
    if (!parsed) {
      orphanBytes += obj.sizeBytes;
      assets.push({
        key: obj.key,
        kind: "item",
        targetId: 0,
        name: null,
        sizeBytes: obj.sizeBytes,
        imageUrl: publicUrl(obj.key),
        orphan: true,
        lastModified: obj.lastModified,
      });
      continue;
    }

    const row =
      parsed.kind === "item"
        ? itemById.get(parsed.targetId)
        : variantById.get(parsed.targetId);
    const name =
      row == null
        ? null
        : parsed.kind === "item"
        ? (row as { itemName: string }).itemName
        : (row as { variantName: string }).variantName;
    // Orphan = no row, deleted row, or row whose photo pointer was cleared.
    const orphan =
      row == null || row.deleted === true || !row.image || row.image === "";
    if (orphan) orphanBytes += obj.sizeBytes;

    assets.push({
      key: obj.key,
      kind: parsed.kind,
      targetId: parsed.targetId,
      name: orphan ? null : name,
      sizeBytes: obj.sizeBytes,
      imageUrl: publicUrl(obj.key),
      orphan,
      lastModified: obj.lastModified,
    });
  }

  assets.sort((a, b) => b.sizeBytes - a.sizeBytes);
  const orphanCount = assets.filter((a) => a.orphan).length;

  return {
    assets,
    storageUsedBytes: usedBytes,
    storageLimitBytes: CATALOGUE_STORAGE_LIMIT_BYTES,
    orphanCount,
    orphanBytes,
  };
}

/**
 * Delete one catalogue photo: remove the R2 object AND clear the owning
 * item/variant's `image` pointer (best-effort — a no-op for orphans whose row
 * is gone). Accepts either an explicit `key` (storage manager, incl. orphans)
 * or `kind`+`targetId` (per-item "Remove photo"). Returns the post-delete
 * usage so the caller can refresh its meter.
 */
export async function deleteCatalogueAsset(
  tenantId: number,
  databaseName: string,
  input: { key?: string; kind?: ImageTargetKind; targetId?: number }
): Promise<{ storageUsedBytes: number; storageLimitBytes: number }> {
  let key: string;
  if (typeof input.key === "string" && input.key) {
    key = input.key;
    if (!key.startsWith(`${tenantId}/`)) {
      throw new BusinessLogicError("That photo does not belong to this account");
    }
  } else if (
    (input.kind === "item" || input.kind === "variant") &&
    Number.isInteger(input.targetId) &&
    (input.targetId as number) > 0
  ) {
    key = buildKey(tenantId, input.kind, input.targetId as number);
  } else {
    throw new BusinessLogicError("Provide either a key or kind + targetId");
  }

  await deleteStorageObject(tenantId, key);

  // Clear the DB pointer so the product no longer references a now-deleted
  // photo. updateMany keeps it a no-op when the row is already gone (orphan).
  const parsed = parseAssetKey(tenantId, key);
  if (parsed) {
    const prisma = getTenantPrisma(databaseName);
    try {
      if (parsed.kind === "item") {
        await prisma.item.updateMany({
          where: { id: parsed.targetId },
          data: { image: "" },
        });
      } else {
        await prisma.itemVariant.updateMany({
          where: { id: parsed.targetId },
          data: { image: null },
        });
      }
    } catch {
      // R2 object is already gone (space reclaimed); a stale DB pointer is
      // cosmetic and self-heals on the next edit. Don't fail the delete.
    }
  }

  return {
    storageUsedBytes: await getStorageUsage(tenantId),
    storageLimitBytes: CATALOGUE_STORAGE_LIMIT_BYTES,
  };
}
