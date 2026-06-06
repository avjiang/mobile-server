import { getGlobalPrisma, getTenantPrisma } from "../db";
import { NotFoundError } from "../api-helpers/error";

/**
 * Public (tokenless) online-catalogue read service.
 *
 * Resolves a public `slug` (the <slug>.bayaryuk.net subdomain key) → the tenant's
 * database in the GLOBAL db, then returns ONLY catalogue-safe fields for in-stock,
 * non-deleted items (+ variants) from that tenant's db. This path deliberately
 * bypasses auth, so it is read-only and strictly field-whitelisted — it must NEVER
 * expose cost, supplier, internal flags, or any other tenant's data.
 *
 * See docs/future/ONLINE_CATALOGUE.md.
 */

// One-level DNS label: lowercase alnum + hyphens, 1–63 chars, no leading/trailing hyphen.
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export interface PublicCatalogueVariant {
  id: number;
  name: string;
  price: number;
  imageUrl: string | null;
  inStock: boolean;
}

export interface PublicCatalogueItem {
  id: number;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  categoryName: string | null;
  hasVariants: boolean;
  variants: PublicCatalogueVariant[];
}

export interface PublicCatalogue {
  business: { name: string; slug: string; whatsappNumber: string | null };
  // NOTE: deliberately named `products`, NOT `items` — NetworkResponse magic-unwraps
  // any payload containing an `items` array and drops sibling keys (e.g. `business`).
  products: PublicCatalogueItem[];
}

function imageOrNull(v: string | null | undefined): string | null {
  return v && v.length > 0 ? v : null;
}

// Prisma Decimal | number | null -> number
function toNumber(v: any): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v.toString());
}

export async function getPublicCatalogue(slugRaw: string): Promise<PublicCatalogue> {
  const slug = (slugRaw || "").toLowerCase().trim();
  if (!SLUG_RE.test(slug)) {
    // Don't leak whether a slug is malformed vs missing — both are "not found".
    throw new NotFoundError("Catalogue");
  }

  const tenant = await getGlobalPrisma().tenant.findUnique({
    where: { slug },
    select: {
      databaseName: true,
      tenantName: true,
      whatsappNumber: true,
      catalogueEnabled: true,
    },
  });
  if (!tenant || tenant.catalogueEnabled !== true || !tenant.databaseName) {
    throw new NotFoundError("Catalogue");
  }

  const prisma = getTenantPrisma(tenant.databaseName);
  const rows = await prisma.item.findMany({
    where: { deleted: false },
    select: {
      id: true,
      itemName: true,
      itemDescription: true,
      price: true,
      image: true,
      hasVariants: true,
      trackStock: true,
      category: { select: { name: true } },
      stockBalance: {
        where: { deleted: false },
        select: { itemVariantId: true, availableQuantity: true },
      },
      variants: {
        where: { deleted: false },
        select: {
          id: true,
          variantName: true,
          price: true,
          image: true,
          stockBalances: {
            where: { deleted: false },
            select: { availableQuantity: true },
          },
        },
      },
    },
    orderBy: { itemName: "asc" },
  });

  const items: PublicCatalogueItem[] = [];
  for (const r of rows) {
    const untracked = r.trackStock === false; // trackStock=false → always considered available

    const variants: PublicCatalogueVariant[] = (r.variants ?? []).map((v) => ({
      id: v.id,
      name: v.variantName,
      price: v.price != null ? toNumber(v.price) : toNumber(r.price),
      imageUrl: imageOrNull(v.image),
      inStock:
        untracked ||
        (v.stockBalances ?? []).some((sb) => toNumber(sb.availableQuantity) > 0),
    }));

    // Item-level stock = rows with no itemVariantId (variant rows are handled above).
    const itemLevelInStock =
      untracked ||
      (r.stockBalance ?? []).some(
        (sb) => sb.itemVariantId == null && toNumber(sb.availableQuantity) > 0
      );

    const include = r.hasVariants
      ? untracked || variants.some((v) => v.inStock)
      : itemLevelInStock;
    if (!include) continue;

    items.push({
      id: r.id,
      name: r.itemName,
      description: r.itemDescription && r.itemDescription.length > 0 ? r.itemDescription : null,
      price: toNumber(r.price),
      imageUrl: imageOrNull(r.image),
      categoryName: r.category?.name ?? null,
      hasVariants: r.hasVariants,
      variants: r.hasVariants ? variants : [],
    });
  }

  return {
    business: {
      name: tenant.tenantName,
      slug,
      whatsappNumber: tenant.whatsappNumber ?? null,
    },
    products: items,
  };
}
