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

// One-level DNS label: lowercase alnum + hyphens, 3–63 chars, no leading/trailing
// hyphen. Kept IN SYNC with the write-path regex in catalogue-config.service.ts
// (a 1–2 char slug can never be created, so the read path must not serve one).
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/;

// Hard cap on catalogue items returned to an unauthenticated caller — bounds the
// response size (no per-plan product limit exists) and the work per cache-miss.
const MAX_PUBLIC_ITEMS = 1000;

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
  brand: string | null; // itemBrand — shown as a subtitle when present
  model: string | null; // itemModel — shown as a subtitle when present
  description: string | null;
  price: number;
  imageUrl: string | null;
  categoryName: string | null;
  hasVariants: boolean;
  variants: PublicCatalogueVariant[];
  inStock: boolean; // false → shown greyed with a "Habis" badge (not hidden)
}

export interface PublicCatalogue {
  business: {
    name: string;
    slug: string;
    whatsappNumber: string | null;
    logoUrl: string | null;
    coverUrl: string | null;
    currency: string; // ISO code from the tenant's default_currency setting (e.g. IDR, MYR)
    priceVisible: boolean; // false → catalogue hides all prices (+ price sort + WA price)
  };
  // NOTE: deliberately named `products`, NOT `items` — NetworkResponse magic-unwraps
  // any payload containing an `items` array and drops sibling keys (e.g. `business`).
  products: PublicCatalogueItem[];
}

function imageOrNull(v: string | null | undefined): string | null {
  // Only surface absolute HTTPS URLs (all catalogue images are R2 https URLs).
  // Rejects any non-https value a rogue tenant might store in item.image.
  return v && v.startsWith("https://") ? v : null;
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
      logoUrl: true,
      coverUrl: true,
      cataloguePriceVisible: true,
    },
  });
  if (!tenant || tenant.catalogueEnabled !== true || !tenant.databaseName) {
    throw new NotFoundError("Catalogue");
  }

  const prisma = getTenantPrisma(tenant.databaseName);

  // Currency is the tenant's CONFIGURED currency (default_currency setting),
  // NOT inferred from the WhatsApp number. SettingDefinition lives in the global
  // db; the value lives in the tenant db. Falls back to IDR.
  let currency = "IDR";
  try {
    const def = await getGlobalPrisma().settingDefinition.findUnique({
      where: { key: "default_currency" },
      select: { id: true, defaultValue: true },
    });
    if (def) {
      const setting = await prisma.setting.findFirst({
        where: { settingDefinitionId: def.id, deleted: false },
        select: { value: true },
        orderBy: { id: "asc" },
      });
      currency = (setting?.value || def.defaultValue || "IDR").toUpperCase();
    }
  } catch {
    /* keep IDR on any settings lookup failure */
  }

  const rows = await prisma.item.findMany({
    where: { deleted: false },
    select: {
      id: true,
      itemName: true,
      itemBrand: true,
      itemModel: true,
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
    take: MAX_PUBLIC_ITEMS,
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

    // Same rule the app's sales screen uses (warehouse aside): variant items are
    // available if any variant has stock; simple items by their own balance;
    // untracked items always. Sold-out items are NOT hidden — they render greyed
    // with a "Habis" badge, mirroring the sales grid.
    const inStock = r.hasVariants
      ? untracked || variants.some((v) => v.inStock)
      : itemLevelInStock;

    items.push({
      id: r.id,
      name: r.itemName,
      brand: r.itemBrand && r.itemBrand.length > 0 ? r.itemBrand : null,
      model: r.itemModel && r.itemModel.length > 0 ? r.itemModel : null,
      description: r.itemDescription && r.itemDescription.length > 0 ? r.itemDescription : null,
      price: toNumber(r.price),
      imageUrl: imageOrNull(r.image),
      categoryName: r.category?.name ?? null,
      hasVariants: r.hasVariants,
      variants: r.hasVariants ? variants : [],
      inStock,
    });
  }

  return {
    business: {
      name: tenant.tenantName,
      slug,
      whatsappNumber: tenant.whatsappNumber ?? null,
      logoUrl: imageOrNull(tenant.logoUrl),
      coverUrl: imageOrNull(tenant.coverUrl),
      currency,
      priceVisible: tenant.cataloguePriceVisible !== false, // default visible
    },
    products: items,
  };
}
