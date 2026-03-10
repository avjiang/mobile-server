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
    const categoryMap = new Map(existingCategories.map(c => [c.name.toLowerCase(), c]));
    const supplierMap = new Map(existingSuppliers.map(s => [s.companyName.toLowerCase(), s]));
    const itemCodeMap = new Map(existingItems.map(i => [i.itemCode.toLowerCase(), i]));
    const variantSkuMap = new Map(existingVariants.map(v => [v.variantSku.toLowerCase(), v]));

    // 1. Import Categories
    if (data.categories.length > 0) {
      const progress = createProgressBar('Categories');
      progress.start(data.categories.length, 0);

      for (const category of data.categories) {
        const existing = categoryMap.get(category.name.toLowerCase());
        if (existing) {
          categoryMap.set(category.name.toLowerCase(), existing);
          results.categories.existing++;
        } else {
          const created = await prisma.category.create({
            data: {
              name: category.name,
              description: category.description || '',
            }
          });
          categoryMap.set(category.name.toLowerCase(), created);
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
        const existing = supplierMap.get(supplier.companyName.toLowerCase());
        if (existing) {
          supplierMap.set(supplier.companyName.toLowerCase(), existing);
          results.suppliers.existing++;
        } else {
          const created = await prisma.supplier.create({
            data: {
              companyName: supplier.companyName,
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
          supplierMap.set(supplier.companyName.toLowerCase(), created);
          results.suppliers.created++;
        }
        progress.increment();
      }

      progress.stop();
      console.log(chalk.green(`  Suppliers: ${results.suppliers.created} created, ${results.suppliers.existing} existing ✅`));
    }

    // Also create any categories/suppliers referenced in items but not in sheets
    await createMissingDependencies(data.items, categoryMap, supplierMap, prisma);

    // 3. Import Items
    if (data.items.length > 0) {
      const progress = createProgressBar('Items    ');
      progress.start(data.items.length, 0);

      for (const item of data.items) {
        const existing = itemCodeMap.get(item.itemCode.toLowerCase());
        if (existing) {
          itemCodeMap.set(item.itemCode.toLowerCase(), existing);
          results.items.existing++;
        } else {
          const category = categoryMap.get(item.categoryName.toLowerCase());
          const supplier = supplierMap.get(item.supplierName.toLowerCase());

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
              itemName: item.itemName,
              itemCode: item.itemCode.toString(),
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

          itemCodeMap.set(item.itemCode.toLowerCase(), created);
          results.items.created++;

          // Create stock records if item has stock, no variants, and tracks stock
          const stockQty = parseFloat(item.stockQuantity) || 0;
          if (stockQty > 0 && !hasVariants && trackStock !== false) {
            const targetOutletId = parseInt(item.outletId) || outletId;
            await createStockRecords(prisma, created.id, null, targetOutletId, stockQty, parseFloat(item.cost) || 0, results);
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
        const existing = variantSkuMap.get(variant.variantSku.toLowerCase());
        if (existing) {
          variantSkuMap.set(variant.variantSku.toLowerCase(), existing);
          results.variants.existing++;
        } else {
          const parentItem = itemCodeMap.get(variant.parentItemCode.toLowerCase());
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
              variantSku: variant.variantSku.toString(),
              variantName: variant.variantName,
              cost: variant.cost ? parseFloat(variant.cost) : null,
              price: variant.price ? parseFloat(variant.price) : null,
              barcode: variant.barcode || null,
            }
          });

          variantSkuMap.set(variant.variantSku.toLowerCase(), created);
          results.variants.created++;

          // Create variant attributes
          await createVariantAttributes(prisma, created.id, variant, attrValueMap);

          // Create stock records for variant
          const stockQty = parseFloat(variant.stockQuantity) || 0;
          if (stockQty > 0) {
            const targetOutletId = parseInt(variant.outletId) || outletId;
            const cost = variant.cost ? parseFloat(variant.cost) : parseFloat(parentItem.cost) || 0;
            await createStockRecords(prisma, parentItem.id, created.id, targetOutletId, stockQty, cost, results);
          }
        }
        progress.increment();
      }

      progress.stop();
      console.log(chalk.green(`  Variants: ${results.variants.created} created, ${results.variants.existing} existing ✅`));
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
    if (item.categoryName && !categoryMap.has(item.categoryName.toLowerCase())) {
      missingCategories.add(item.categoryName);
    }
    if (item.supplierName && !supplierMap.has(item.supplierName.toLowerCase())) {
      missingSuppliers.add(item.supplierName);
    }
  }

  // Create missing categories
  for (const name of missingCategories) {
    const created = await prisma.category.create({
      data: { name, description: '' }
    });
    categoryMap.set(name.toLowerCase(), created);
    console.log(chalk.yellow(`  Auto-created category: ${name}`));
  }

  // Create missing suppliers
  for (const name of missingSuppliers) {
    const created = await prisma.supplier.create({
      data: { companyName: name, hasTax: false }
    });
    supplierMap.set(name.toLowerCase(), created);
    console.log(chalk.yellow(`  Auto-created supplier: ${name}`));
  }
}

/**
 * Create stock records for item/variant
 */
async function createStockRecords(prisma, itemId, itemVariantId, outletId, quantity, cost, results) {
  // Create StockBalance
  await prisma.stockBalance.create({
    data: {
      itemId,
      outletId,
      itemVariantId,
      availableQuantity: quantity,
      onHandQuantity: quantity,
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
