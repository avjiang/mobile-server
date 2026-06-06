import { getGlobalPrisma } from "../db";
import { BusinessLogicError } from "../api-helpers/error";
import {
  getStorageUsage,
  CATALOGUE_STORAGE_LIMIT_BYTES,
} from "./catalogue-storage.service";

/**
 * Per-tenant online-catalogue configuration, stored on the GLOBAL Tenant row
 * (so the tokenless public endpoint can resolve it): slug, whatsappNumber,
 * catalogueEnabled. This is separate from the per-tenant AppSettings store.
 *
 * See docs/future/ONLINE_CATALOGUE.md.
 */

// Slug rules: 3–63 chars, lowercase alnum + hyphens, no leading/trailing hyphen.
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/;

// Subdomains we must not let tenants claim.
const RESERVED_SLUGS = new Set([
  "www", "api", "app", "admin", "images", "image", "public", "catalogue",
  "catalog", "assets", "static", "cdn", "mail", "ftp", "bayaryuk", "status",
  "blog", "shop", "store", "help", "support", "dashboard",
]);

export interface CatalogueConfig {
  slug: string | null;
  whatsappNumber: string | null;
  catalogueEnabled: boolean;
  storageUsedBytes: number;
  storageLimitBytes: number;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-") // non-alnum → hyphen
    .replace(/^-+|-+$/g, "") // trim hyphens
    .slice(0, 63);
}

// International digits only; Indonesian leading 0 → 62.
function normalizeWhatsapp(v: string | null | undefined): string | null {
  if (v == null) return null;
  const digits = v.replace(/[^0-9]/g, "");
  if (digits.length === 0) return null;
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  return digits;
}

export async function getCatalogueConfig(tenantId: number): Promise<CatalogueConfig> {
  const t = await getGlobalPrisma().tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true, whatsappNumber: true, catalogueEnabled: true },
  });
  if (!t) throw new BusinessLogicError("Tenant not found");
  return {
    slug: t.slug,
    whatsappNumber: t.whatsappNumber,
    catalogueEnabled: t.catalogueEnabled === true,
    storageUsedBytes: await getStorageUsage(tenantId),
    storageLimitBytes: CATALOGUE_STORAGE_LIMIT_BYTES,
  };
}

export async function updateCatalogueConfig(
  tenantId: number,
  input: { slug?: string; whatsappNumber?: string | null; catalogueEnabled?: boolean }
): Promise<CatalogueConfig> {
  const data: {
    slug?: string;
    whatsappNumber?: string | null;
    catalogueEnabled?: boolean;
  } = {};

  if (input.slug !== undefined) {
    const slug = slugify(input.slug);
    if (!SLUG_RE.test(slug)) {
      throw new BusinessLogicError(
        "Link must be 3–63 characters: lowercase letters, numbers and hyphens."
      );
    }
    if (RESERVED_SLUGS.has(slug)) {
      throw new BusinessLogicError(`'${slug}' is reserved. Please choose another link.`);
    }
    const clash = await getGlobalPrisma().tenant.findFirst({
      where: { slug, id: { not: tenantId } },
      select: { id: true },
    });
    if (clash) {
      throw new BusinessLogicError(`The link '${slug}' is already taken.`);
    }
    data.slug = slug;
  }

  if (input.whatsappNumber !== undefined) {
    data.whatsappNumber = normalizeWhatsapp(input.whatsappNumber);
  }

  if (input.catalogueEnabled !== undefined) {
    data.catalogueEnabled = input.catalogueEnabled === true;
  }

  // Can't enable a catalogue with no public link.
  if (data.catalogueEnabled === true) {
    const current = await getGlobalPrisma().tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });
    const finalSlug = data.slug ?? current?.slug;
    if (!finalSlug) {
      throw new BusinessLogicError("Set a catalogue link before enabling it.");
    }
  }

  const updated = await getGlobalPrisma().tenant.update({
    where: { id: tenantId },
    data,
    select: { slug: true, whatsappNumber: true, catalogueEnabled: true },
  });
  return {
    slug: updated.slug,
    whatsappNumber: updated.whatsappNumber,
    catalogueEnabled: updated.catalogueEnabled === true,
    storageUsedBytes: await getStorageUsage(tenantId),
    storageLimitBytes: CATALOGUE_STORAGE_LIMIT_BYTES,
  };
}
