/**
 * Direct Database Importer
 * Imports data directly to database using Prisma
 */

import { PrismaClient as GlobalPrismaClient } from '../../../prisma/global-client/generated/global/index.js';
import { PrismaClient as TenantPrismaClient } from '../../../prisma/client/generated/client/index.js';
import cliProgress from 'cli-progress';
import chalk from 'chalk';

// UOM normalization map: common variations → standardized English key
const UOM_NORMALIZATION_MAP = {
  'pcs': 'Piece', 'Pcs': 'Piece', 'PCS': 'Piece', 'piece': 'Piece', 'Buah': 'Piece', 'buah': 'Piece',
  'pair': 'Pair', 'Pasang': 'Pair', 'pasang': 'Pair',
  'box': 'Box', 'Kotak': 'Box', 'kotak': 'Box',
  'meter': 'Meter', 'm': 'Meter', 'M': 'Meter',
  'dozen': 'Dozen', 'Lusin': 'Dozen', 'lusin': 'Dozen',
  'set': 'Set',
  'pack': 'Pack', 'Paket': 'Pack', 'paket': 'Pack',
  'kg': 'Kilogram', 'Kg': 'Kilogram', 'KG': 'Kilogram', 'kilogram': 'Kilogram',
  'g': 'Gram', 'G': 'Gram', 'gram': 'Gram',
  'l': 'Liter', 'L': 'Liter', 'liter': 'Liter',
  'ml': 'Milliliter', 'ML': 'Milliliter', 'Ml': 'Milliliter', 'milliliter': 'Milliliter',
};

function normalizeUOM(value) {
  if (!value) return '';
  return UOM_NORMALIZATION_MAP[value] || value;
}

// Normalize a name used as a lookup key: trim surrounding whitespace + lowercase.
// Without the trim, "Minuman" and "Minuman " resolve to different keys and the
// importer silently creates duplicate categories/suppliers. Used consistently
// for BOTH map construction and lookups so they always agree.
function norm(value) {
  return (value ?? '').toString().trim().toLowerCase();
}

/**
 * Look up tenant database name from Global DB
 * @param {number|null} tenantId - Tenant ID to look up
 * @param {string|null} tenantName - Tenant name to look up
 * @returns {Promise<string>} - Database name
 */
async function getTenantDbName(tenantId, tenantName) {
  const globalDbUrl = process.env.GLOBAL_DB_URL;
  if (!globalDbUrl) {
    throw new Error('GLOBAL_DB_URL not found in environment variables');
  }

  const globalPrisma = new GlobalPrismaClient({
    datasources: { db: { url: globalDbUrl } }
  });

  try {
    const where = tenantId ? { id: tenantId } : { tenantName };
    const tenant = await globalPrisma.tenant.findFirst({ where });

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId ? `ID ${tenantId}` : `name "${tenantName}"`}`);
    }

    if (!tenant.databaseName) {
      throw new Error(`Tenant ${tenant.tenantName} does not have a database configured`);
    }

    console.log(chalk.green(`✅ Found tenant: ${tenant.tenantName} (DB: ${tenant.databaseName})`));
    return tenant.databaseName;

  } finally {
    await globalPrisma.$disconnect();
  }
}

/**
 * Resolve the tenant's plan name from the Global DB and refuse a multi-supplier import
 * on anything but Pro.
 *
 * Multiple suppliers per item is a Pro feature, gated in `syncItemSuppliers`
 * (src/item/item.service.ts) on the SECOND link — one supplier is available on every
 * plan. This importer writes raw Prisma and never goes through that service, so
 * without this check an operator-run import would silently hand a Basic/Trial tenant a
 * Pro feature. Mirrors `getTenantSubscriptionInfo` in src/auth/auth.service.ts:
 * active/trial subscriptions of active outlets, Pro wins over Basic.
 *
 * Called BEFORE the dry-run early-return so `--dry-run` catches the problem too.
 *
 * @param {number|null} tenantId
 * @param {string|null} tenantName
 * @param {number} extraLinkCount - number of rows on the Item_Suppliers sheet
 */
async function assertProPlanForExtraSuppliers(tenantId, tenantName, extraLinkCount) {
  if (extraLinkCount === 0) return;

  const globalDbUrl = process.env.GLOBAL_DB_URL;
  if (!globalDbUrl) {
    throw new Error('GLOBAL_DB_URL not found in environment variables');
  }

  const globalPrisma = new GlobalPrismaClient({
    datasources: { db: { url: globalDbUrl } }
  });

  try {
    const where = tenantId ? { id: tenantId } : { tenantName };
    const tenant = await globalPrisma.tenant.findFirst({ where });
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId ? `ID ${tenantId}` : `name "${tenantName}"`}`);
    }

    const outlets = await globalPrisma.tenantOutlet.findMany({
      where: { tenantId: tenant.id, isActive: true },
      include: {
        subscriptions: {
          where: { status: { in: ['Active', 'active', 'trial'] } },
          include: { subscriptionPlan: true },
        },
      },
    });

    let planName = null;
    for (const outlet of outlets) {
      for (const subscription of outlet.subscriptions) {
        const name = subscription.subscriptionPlan?.planName;
        if (!name) continue;
        if (name.toLowerCase() === 'pro') { planName = name; break; }
        if (!planName) planName = name;
      }
      if (planName?.toLowerCase() === 'pro') break;
    }

    if ((planName ?? '').toLowerCase() !== 'pro') {
      throw new Error(
        `Multiple suppliers per item is a Pro feature, but tenant "${tenant.tenantName}" is on ` +
        `plan "${planName ?? 'none'}". The file has ${extraLinkCount} extra supplier link(s) on the ` +
        `Item_Suppliers ("Pemasok Produk") sheet. Remove that sheet's rows, or upgrade the tenant to Pro.`
      );
    }

    console.log(chalk.green(`✅ Plan check: ${tenant.tenantName} is on "${planName}" — extra suppliers allowed`));
  } finally {
    await globalPrisma.$disconnect();
  }
}

/**
 * Construct tenant database URL
 * @param {string} databaseName - The database name
 * @returns {string} - Full database URL
 */
function constructTenantDbUrl(databaseName) {
  const templateUrl = process.env.TENANT_DATABASE_URL;
  if (!templateUrl) {
    throw new Error('TENANT_DATABASE_URL not found in environment variables');
  }

  return templateUrl.replace('{tenant_db_name}', databaseName);
}

/**
 * Create progress bar
 */
function createProgressBar(label) {
  return new cliProgress.SingleBar({
    format: `  ${label}: [{bar}] {percentage}% | {value}/{total}`,
    barCompleteChar: '█',
    barIncompleteChar: '░',
    hideCursor: true
  }, cliProgress.Presets.shades_classic);
}

/**
 * Import data directly to database
 * @param {Object} data - Parsed data from Excel
 * @param {Object} options - Import options
 * @returns {Promise<Object>} - Import results
 */
export async function importDirectToDB(data, options) {
  const { tenantId, tenantName, batchSize = 100, dryRun = false, outletId = 1 } = options;

  if (!tenantId && !tenantName) {
    throw new Error('Either tenantId or tenantName must be provided');
  }

  // Look up tenant database
  const databaseName = await getTenantDbName(tenantId, tenantName);
  const tenantDbUrl = constructTenantDbUrl(databaseName);

  // Pro gate — before the dry-run return so --dry-run surfaces it too.
  await assertProPlanForExtraSuppliers(tenantId, tenantName, (data.itemSuppliers || []).length);

  if (dryRun) {
    console.log(chalk.yellow('\n🔍 DRY RUN - No data will be imported\n'));
    return { dryRun: true, databaseName };
  }

  console.log(chalk.blue('\n📤 Starting import...\n'));

  const prisma = new TenantPrismaClient({
    datasources: { db: { url: tenantDbUrl } }
  });

  const results = {
    categories: { created: 0, existing: 0 },
    suppliers: { created: 0, existing: 0 },
    items: { created: 0, existing: 0 },
    variants: { created: 0, existing: 0 },
    itemSuppliers: { created: 0, existing: 0, skipped: 0 },
    customers: { created: 0, existing: 0 },
    stockBalances: { created: 0 },
    stockMovements: { created: 0 },
    stockReceipts: { created: 0 }
  };

  try {
    // Get existing records for matching
    const existingCategories = await prisma.category.findMany({ where: { deleted: false } });
    const existingSuppliers = await prisma.supplier.findMany({ where: { deleted: false } });
    const existingItems = await prisma.item.findMany({ where: { deleted: false } });
    const existingVariants = await prisma.itemVariant.findMany({ where: { deleted: false } });

    // Create maps for lookups
    const categoryMap = new Map(existingCategories.map(c => [norm(c.name), c]));
    const supplierMap = new Map(existingSuppliers.map(s => [norm(s.companyName), s]));
    const itemCodeMap = new Map(existingItems.map(i => [norm(i.itemCode), i]));
    const variantSkuMap = new Map(existingVariants.map(v => [norm(v.variantSku), v]));

    // 1. Import Categories
    if (data.categories.length > 0) {
      const progress = createProgressBar('Categories');
      progress.start(data.categories.length, 0);

      for (const category of data.categories) {
        const key = norm(category.name);
        const existing = categoryMap.get(key);
        if (existing) {
          categoryMap.set(key, existing);
          results.categories.existing++;
        } else {
          const created = await prisma.category.create({
            data: {
              name: category.name.toString().trim(),
              description: category.description || '',
            }
          });
          categoryMap.set(key, created);
          results.categories.created++;
        }
        progress.increment();
      }

      progress.stop();
      console.log(chalk.green(`  Categories: ${results.categories.created} created, ${results.categories.existing} existing ✅`));
    }

    // 2. Import Suppliers
    if (data.suppliers.length > 0) {
      const progress = createProgressBar('Suppliers');
      progress.start(data.suppliers.length, 0);

      for (const supplier of data.suppliers) {
        const key = norm(supplier.companyName);
        const existing = supplierMap.get(key);
        if (existing) {
          supplierMap.set(key, existing);
          results.suppliers.existing++;
        } else {
          const created = await prisma.supplier.create({
            data: {
              companyName: supplier.companyName.toString().trim(),
              companyStreet: supplier.companyStreet || null,
              companyCity: supplier.companyCity || null,
              companyState: supplier.companyState || null,
              companyPostalCode: supplier.companyPostalCode || null,
              companyCountry: supplier.companyCountry || null,
              companyRegisterNumber: supplier.companyRegisterNumber || null,
              personInChargeFirstName: supplier.personInChargeFirstName || null,
              personInChargeLastName: supplier.personInChargeLastName || null,
              mobile: supplier.mobile || null,
              email: supplier.email || null,
              remark: supplier.remark || null,
              hasTax: supplier.hasTax === true || supplier.hasTax === 'true',
            }
          });
          supplierMap.set(key, created);
          results.suppliers.created++;
        }
        progress.increment();
      }

      progress.stop();
      console.log(chalk.green(`  Suppliers: ${results.suppliers.created} created, ${results.suppliers.existing} existing ✅`));
    }

    // Also create any categories/suppliers referenced in items but not in sheets.
    // Item_Suppliers rows are included so a supplier named only there is auto-created
    // too (those rows carry no categoryName, so the category half just skips them).
    await createMissingDependencies(
      [...data.items, ...(data.itemSuppliers || [])], categoryMap, supplierMap, prisma
    );

    // 3. Import Items
    if (data.items.length > 0) {
      const progress = createProgressBar('Items    ');
      progress.start(data.items.length, 0);

      for (const item of data.items) {
        const itemKey = norm(item.itemCode);
        const existing = itemCodeMap.get(itemKey);
        if (existing) {
          itemCodeMap.set(itemKey, existing);
          results.items.existing++;
        } else {
          const category = categoryMap.get(norm(item.categoryName));
          const supplier = supplierMap.get(norm(item.supplierName));

          if (!category) {
            console.log(chalk.yellow(`\n  Warning: Category "${item.categoryName}" not found for item "${item.itemCode}"`));
            progress.increment();
            continue;
          }
          if (!supplier) {
            console.log(chalk.yellow(`\n  Warning: Supplier "${item.supplierName}" not found for item "${item.itemCode}"`));
            progress.increment();
            continue;
          }

          const hasVariants = item.hasVariants === true || item.hasVariants === 'true' || item.hasVariants === 'TRUE';
          const trackStock = item.trackStock === undefined || item.trackStock === '' ? true : (item.trackStock === true || item.trackStock === 'true' || item.trackStock === 'TRUE');

          const created = await prisma.item.create({
            data: {
              itemName: item.itemName.toString().trim(),
              itemCode: item.itemCode.toString().trim(),
              itemType: item.itemType || '',
              itemModel: item.itemModel || '',
              itemBrand: item.itemBrand || '',
              itemDescription: item.itemDescription || '',
              categoryId: category.id,
              supplierId: supplier.id,
              cost: parseFloat(item.cost) || 0,
              price: parseFloat(item.price) || 0,
              currency: item.currency || 'IDR',
              unitOfMeasure: normalizeUOM(item.unitOfMeasure),
              alternateLookUp: item.barcode || '',
              hasTax: item.hasTax === true || item.hasTax === 'true',
              hasVariants: hasVariants,
              trackStock: trackStock,
            }
          });

          // item_supplier junction row. REQUIRED — the PO/quotation item picker matches
          // on this table, so an imported item with no link is invisible to every
          // supplier. This importer writes raw Prisma and bypasses item.service.ts, so
          // the link has to be created explicitly here.
          await prisma.itemSupplier.upsert({
            where: { itemId_supplierId: { itemId: created.id, supplierId: supplier.id } },
            update: { isPreferred: true, deleted: false, deletedAt: null },
            create: { itemId: created.id, supplierId: supplier.id, isPreferred: true, deleted: false },
          });

          itemCodeMap.set(itemKey, created);
          results.items.created++;

          const reorder = (item.reorderThreshold !== undefined && item.reorderThreshold !== '' && !isNaN(parseFloat(item.reorderThreshold)))
            ? parseFloat(item.reorderThreshold)
            : null;
          const targetOutletId = parseInt(item.outletId) || outletId;

          // Create stock records if item has stock, no variants, and tracks stock
          const stockQty = parseFloat(item.stockQuantity) || 0;
          if (stockQty > 0 && !hasVariants && trackStock !== false) {
            await createStockRecords(prisma, created.id, null, targetOutletId, stockQty, parseFloat(item.cost) || 0, results, reorder);
          } else if (reorder !== null && !hasVariants) {
            // No opening stock but a reorder threshold was supplied — create a
            // zero-quantity StockBalance so the low-stock alert level (which lives
            // on StockBalance, not Item) isn't silently dropped.
            await prisma.stockBalance.create({
              data: {
                itemId: created.id,
                outletId: targetOutletId,
                itemVariantId: null,
                availableQuantity: 0,
                onHandQuantity: 0,
                reorderThreshold: reorder,
              }
            });
            results.stockBalances.created++;
          }
        }
        progress.increment();
      }

      progress.stop();
      console.log(chalk.green(`  Items: ${results.items.created} created, ${results.items.existing} existing ✅`));
    }

    // 4. Import Variants
    if (data.variants.length > 0) {
      // First, load existing attribute values
      const existingAttrValues = await prisma.variantAttributeValue.findMany({ where: { deleted: false } });
      const attrValueMap = new Map(existingAttrValues.map(a => [`${a.definitionKey}:${a.value}`.toLowerCase(), a]));

      const progress = createProgressBar('Variants ');
      progress.start(data.variants.length, 0);

      for (const variant of data.variants) {
        const variantKey = norm(variant.variantSku);
        const existing = variantSkuMap.get(variantKey);
        if (existing) {
          variantSkuMap.set(variantKey, existing);
          results.variants.existing++;
        } else {
          const parentItem = itemCodeMap.get(norm(variant.parentItemCode));
          if (!parentItem) {
            console.log(chalk.yellow(`\n  Warning: Parent item "${variant.parentItemCode}" not found for variant "${variant.variantSku}"`));
            progress.increment();
            continue;
          }

          // Ensure parent item has hasVariants = true
          if (!parentItem.hasVariants) {
            await prisma.item.update({
              where: { id: parentItem.id },
              data: { hasVariants: true }
            });
          }

          const created = await prisma.itemVariant.create({
            data: {
              itemId: parentItem.id,
              variantSku: variant.variantSku.toString().trim(),
              variantName: variant.variantName,
              cost: variant.cost ? parseFloat(variant.cost) : null,
              price: variant.price ? parseFloat(variant.price) : null,
              barcode: variant.barcode || null,
            }
          });

          variantSkuMap.set(variantKey, created);
          results.variants.created++;

          // Create variant attributes
          await createVariantAttributes(prisma, created.id, variant, attrValueMap);

          // Create stock records for variant
          const stockQty = parseFloat(variant.stockQuantity) || 0;
          if (stockQty > 0) {
            const targetOutletId = parseInt(variant.outletId) || outletId;
            const cost = variant.cost ? parseFloat(variant.cost) : parseFloat(parentItem.cost) || 0;
            await createStockRecords(prisma, parentItem.id, created.id, targetOutletId, stockQty, cost, results, null);
          }
        }
        progress.increment();
      }

      progress.stop();
      console.log(chalk.green(`  Variants: ${results.variants.created} created, ${results.variants.existing} existing ✅`));
    }

    // 4b. Import extra item→supplier links (Pro; gated above by assertProPlanForExtraSuppliers).
    //
    // Deliberately its OWN pass rather than part of the item-creation branch above: that
    // branch is skipped wholesale for an item code that already exists, so nesting these
    // writes there would make "send an updated sheet to add a supplier to the existing
    // catalogue" — the most likely real use — a silent no-op. Resolving against
    // itemCodeMap (which is seeded with the tenant's existing items) means this sheet
    // also works on its own, with the Items sheet left empty.
    //
    // The preferred link is NOT touched here. It is written with the item from the Items
    // sheet's own supplier column, which keeps the one-preferred-row invariant structural.
    if ((data.itemSuppliers || []).length > 0) {
      const progress = createProgressBar('Item sup');
      progress.start(data.itemSuppliers.length, 0);

      for (const link of data.itemSuppliers) {
        const item = itemCodeMap.get(norm(link.itemCode));
        const supplier = supplierMap.get(norm(link.supplierName));

        if (!item) {
          console.log(chalk.yellow(`\n  Warning: Item "${link.itemCode}" not found — skipping extra supplier "${link.supplierName}"`));
          results.itemSuppliers.skipped++;
          progress.increment();
          continue;
        }
        if (!supplier) {
          console.log(chalk.yellow(`\n  Warning: Supplier "${link.supplierName}" not found — skipping link for item "${link.itemCode}"`));
          results.itemSuppliers.skipped++;
          progress.increment();
          continue;
        }

        const cost = (link.cost !== undefined && link.cost !== '' && !isNaN(parseFloat(link.cost)))
          ? parseFloat(link.cost)
          : null;
        const leadTimeDays = (link.leadTimeDays !== undefined && link.leadTimeDays !== '' && !isNaN(parseInt(link.leadTimeDays)))
          ? parseInt(link.leadTimeDays)
          : null;

        // A row naming the item's own preferred supplier must not demote it, so
        // isPreferred is only ever set on create — never forced to false on update.
        const existingLink = await prisma.itemSupplier.findUnique({
          where: { itemId_supplierId: { itemId: item.id, supplierId: supplier.id } },
        });

        const payload = {
          supplierItemCode: link.supplierItemCode ? link.supplierItemCode.toString().trim() : null,
          cost,
          leadTimeDays,
          deleted: false,
          deletedAt: null,
        };

        if (existingLink) {
          await prisma.itemSupplier.update({
            where: { id: existingLink.id },
            data: { ...payload, version: { increment: 1 } },
          });
          results.itemSuppliers.existing++;
        } else {
          await prisma.itemSupplier.create({
            data: { itemId: item.id, supplierId: supplier.id, isPreferred: false, ...payload, version: 1 },
          });
          results.itemSuppliers.created++;
        }

        progress.increment();
      }

      progress.stop();
      console.log(chalk.green(`  Extra suppliers: ${results.itemSuppliers.created} created, ${results.itemSuppliers.existing} updated, ${results.itemSuppliers.skipped} skipped ✅`));
    }

    // 5. Import Customers
    if (data.customers.length > 0) {
      const progress = createProgressBar('Customers');
      progress.start(data.customers.length, 0);

      for (const customer of data.customers) {
        const created = await prisma.customer.create({
          data: {
            firstName: customer.firstName,
            lastName: customer.lastName,
            salutation: customer.salutation || '',
            mobile: customer.mobile || null,
            email: customer.email || null,
            gender: customer.gender || null,
            billStreet: customer.billStreet || null,
            billCity: customer.billCity || null,
            billState: customer.billState || null,
            billPostalCode: customer.billPostalCode || null,
            billCountry: customer.billCountry || null,
            shipStreet: customer.shipStreet || null,
            shipCity: customer.shipCity || null,
            shipState: customer.shipState || null,
            shipPostalCode: customer.shipPostalCode || null,
            shipCountry: customer.shipCountry || null,
          }
        });
        results.customers.created++;
        progress.increment();
      }

      progress.stop();
      console.log(chalk.green(`  Customers: ${results.customers.created} created ✅`));
    }

    // Print stock summary
    if (results.stockBalances.created > 0) {
      console.log(chalk.green(`  Stock Balances: ${results.stockBalances.created} created ✅`));
      console.log(chalk.green(`  Stock Movements: ${results.stockMovements.created} created ✅`));
      console.log(chalk.green(`  Stock Receipts: ${results.stockReceipts.created} created ✅`));
    }

    return results;

  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Create missing categories and suppliers referenced in items
 */
async function createMissingDependencies(items, categoryMap, supplierMap, prisma) {
  // Find unique category and supplier names from items that don't exist
  const missingCategories = new Set();
  const missingSuppliers = new Set();

  for (const item of items) {
    if (item.categoryName && !categoryMap.has(norm(item.categoryName))) {
      missingCategories.add(item.categoryName.toString().trim());
    }
    if (item.supplierName && !supplierMap.has(norm(item.supplierName))) {
      missingSuppliers.add(item.supplierName.toString().trim());
    }
  }

  // Create missing categories
  for (const name of missingCategories) {
    const created = await prisma.category.create({
      data: { name, description: '' }
    });
    categoryMap.set(norm(name), created);
    console.log(chalk.yellow(`  Auto-created category: ${name}`));
  }

  // Create missing suppliers
  for (const name of missingSuppliers) {
    const created = await prisma.supplier.create({
      data: { companyName: name, hasTax: false }
    });
    supplierMap.set(norm(name), created);
    console.log(chalk.yellow(`  Auto-created supplier: ${name}`));
  }
}

/**
 * Create stock records for item/variant
 */
async function createStockRecords(prisma, itemId, itemVariantId, outletId, quantity, cost, results, reorderThreshold = null) {
  // Create StockBalance (reorderThreshold lives here, per-outlet — not on Item)
  await prisma.stockBalance.create({
    data: {
      itemId,
      outletId,
      itemVariantId,
      availableQuantity: quantity,
      onHandQuantity: quantity,
      reorderThreshold: reorderThreshold,
      lastRestockDate: new Date(),
    }
  });
  results.stockBalances.created++;

  // Create StockMovement
  await prisma.stockMovement.create({
    data: {
      itemId,
      outletId,
      itemVariantId,
      previousAvailableQuantity: 0,
      previousOnHandQuantity: 0,
      availableQuantityDelta: quantity,
      onHandQuantityDelta: quantity,
      movementType: 'Import Opening Balance',
      documentId: 0,
      reason: 'Initial stock from bulk import',
      remark: '',
    }
  });
  results.stockMovements.created++;

  // Create StockReceipt for FIFO tracking
  await prisma.stockReceipt.create({
    data: {
      itemId,
      outletId,
      itemVariantId,
      quantity,
      cost,
      receiptDate: new Date(),
    }
  });
  results.stockReceipts.created++;
}

/**
 * Create variant attributes
 */
async function createVariantAttributes(prisma, variantId, variant, attrValueMap) {
  for (let i = 1; i <= 3; i++) {
    const attrType = variant[`attribute${i}Type`];
    const attrValue = variant[`attribute${i}Value`];

    if (!attrType || !attrValue) continue;

    const key = `${attrType}:${attrValue}`.toLowerCase();
    let attributeValue = attrValueMap.get(key);

    // Create attribute value if it doesn't exist
    if (!attributeValue) {
      attributeValue = await prisma.variantAttributeValue.create({
        data: {
          definitionKey: attrType,
          value: attrValue.toString(),
          displayValue: attrValue.toString(),
          sortOrder: 0,
        }
      });
      attrValueMap.set(key, attributeValue);
    }

    // Link variant to attribute value
    await prisma.itemVariantAttribute.create({
      data: {
        itemVariantId: variantId,
        variantAttributeValueId: attributeValue.id,
      }
    });
  }
}
