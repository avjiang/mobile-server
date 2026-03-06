/**
 * API Importer
 * Imports data via existing REST API endpoints
 */

import axios from 'axios';
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
 * Create an API client with authorization
 * @param {string} apiUrl - Base API URL
 * @param {string} token - Authorization token
 * @returns {Object} - Axios instance
 */
function createApiClient(apiUrl, token) {
  const client = axios.create({
    baseURL: apiUrl,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'token': token,
    },
    timeout: 60000, // 60 second timeout
  });

  // Add response interceptor for error handling
  client.interceptors.response.use(
    response => response,
    error => {
      if (error.response) {
        const message = error.response.data?.message || error.response.statusText;
        throw new Error(`API Error ${error.response.status}: ${message}`);
      } else if (error.request) {
        throw new Error('API Error: No response received from server');
      } else {
        throw error;
      }
    }
  );

  return client;
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
 * Split array into batches
 */
function splitIntoBatches(array, batchSize) {
  const batches = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Fetch existing data from API
 */
async function fetchExistingData(client) {
  console.log(chalk.blue('📥 Fetching existing data from API...'));

  const [categoriesRes, suppliersRes, itemsRes] = await Promise.all([
    client.get('/category/').catch(() => ({ data: { data: [] } })),
    client.get('/supplier/').catch(() => ({ data: { data: [] } })),
    client.get('/item/sync').catch(() => ({ data: { data: [] } })),
  ]);

  // Handle different response formats
  const categories = categoriesRes.data?.data || categoriesRes.data || [];
  const suppliers = suppliersRes.data?.data || suppliersRes.data || [];
  const items = itemsRes.data?.data || itemsRes.data || [];

  console.log(chalk.green(`✅ Found existing: ${categories.length} categories, ${suppliers.length} suppliers, ${items.length} items`));

  return { categories, suppliers, items };
}

/**
 * Import data via API
 * @param {Object} data - Parsed data from Excel
 * @param {Object} options - Import options
 * @returns {Promise<Object>} - Import results
 */
export async function importViaApi(data, options) {
  const { apiUrl, token, batchSize = 20, dryRun = false, outletId = 1 } = options;

  if (!apiUrl) {
    throw new Error('API URL is required for API mode');
  }
  if (!token) {
    throw new Error('API token is required for API mode');
  }

  const client = createApiClient(apiUrl, token);

  if (dryRun) {
    console.log(chalk.yellow('\n🔍 DRY RUN - No data will be imported\n'));
    // Still fetch existing data to test connection
    await fetchExistingData(client);
    return { dryRun: true };
  }

  console.log(chalk.blue('\n📤 Starting import via API...\n'));

  const results = {
    categories: { created: 0, existing: 0, errors: 0 },
    suppliers: { created: 0, existing: 0, errors: 0 },
    items: { created: 0, existing: 0, errors: 0 },
    variants: { created: 0, existing: 0, errors: 0 },
    customers: { created: 0, existing: 0, errors: 0 },
  };

  // Fetch existing data for matching
  const existing = await fetchExistingData(client);

  // Create maps for lookups
  const categoryMap = new Map(existing.categories.map(c => [c.name.toLowerCase(), c]));
  const supplierMap = new Map(existing.suppliers.map(s => [s.companyName.toLowerCase(), s]));
  const itemCodeMap = new Map(existing.items.map(i => [i.itemCode.toLowerCase(), i]));

  // 1. Import Categories
  if (data.categories.length > 0) {
    const newCategories = data.categories.filter(
      c => !categoryMap.has(c.name.toLowerCase())
    );

    if (newCategories.length > 0) {
      const progress = createProgressBar('Categories');
      progress.start(newCategories.length, 0);

      const batches = splitIntoBatches(newCategories, batchSize);
      for (const batch of batches) {
        try {
          const payload = batch.map(c => ({
            name: c.name,
            description: c.description || '',
          }));
          const response = await client.post('/category/create', { categories: payload });
          const created = response.data?.data || response.data || [];

          // Update map with created categories
          for (const cat of (Array.isArray(created) ? created : [created])) {
            if (cat.name) {
              categoryMap.set(cat.name.toLowerCase(), cat);
            }
          }
          results.categories.created += batch.length;
        } catch (error) {
          console.log(chalk.red(`\n  Error creating categories: ${error.message}`));
          results.categories.errors += batch.length;
        }
        progress.increment(batch.length);
      }

      progress.stop();
    }

    results.categories.existing = data.categories.length - results.categories.created - results.categories.errors;
    console.log(chalk.green(`  Categories: ${results.categories.created} created, ${results.categories.existing} existing ✅`));
  }

  // 2. Import Suppliers
  if (data.suppliers.length > 0) {
    const newSuppliers = data.suppliers.filter(
      s => !supplierMap.has(s.companyName.toLowerCase())
    );

    if (newSuppliers.length > 0) {
      const progress = createProgressBar('Suppliers');
      progress.start(newSuppliers.length, 0);

      const batches = splitIntoBatches(newSuppliers, batchSize);
      for (const batch of batches) {
        try {
          const payload = batch.map(s => ({
            companyName: s.companyName,
            companyStreet: s.companyStreet || null,
            companyCity: s.companyCity || null,
            companyState: s.companyState || null,
            companyPostalCode: s.companyPostalCode || null,
            companyCountry: s.companyCountry || null,
            companyRegisterNumber: s.companyRegisterNumber || null,
            personInChargeFirstName: s.personInChargeFirstName || null,
            personInChargeLastName: s.personInChargeLastName || null,
            mobile: s.mobile || null,
            email: s.email || null,
            remark: s.remark || null,
            hasTax: s.hasTax === true || s.hasTax === 'true',
          }));
          const response = await client.post('/supplier/create', { suppliers: payload });
          const created = response.data?.data || response.data || [];

          // Update map with created suppliers
          for (const sup of (Array.isArray(created) ? created : [created])) {
            if (sup.companyName) {
              supplierMap.set(sup.companyName.toLowerCase(), sup);
            }
          }
          results.suppliers.created += batch.length;
        } catch (error) {
          console.log(chalk.red(`\n  Error creating suppliers: ${error.message}`));
          results.suppliers.errors += batch.length;
        }
        progress.increment(batch.length);
      }

      progress.stop();
    }

    results.suppliers.existing = data.suppliers.length - results.suppliers.created - results.suppliers.errors;
    console.log(chalk.green(`  Suppliers: ${results.suppliers.created} created, ${results.suppliers.existing} existing ✅`));
  }

  // Also create any categories/suppliers referenced in items but not yet created
  await createMissingDependencies(data.items, categoryMap, supplierMap, client, batchSize);

  // 3. Import Items
  if (data.items.length > 0) {
    const newItems = data.items.filter(
      i => !itemCodeMap.has(i.itemCode.toString().toLowerCase())
    );

    if (newItems.length > 0) {
      const progress = createProgressBar('Items    ');
      progress.start(newItems.length, 0);

      const batches = splitIntoBatches(newItems, batchSize);
      for (const batch of batches) {
        try {
          const payload = batch.map(item => {
            const category = categoryMap.get(item.categoryName.toLowerCase());
            const supplier = supplierMap.get(item.supplierName.toLowerCase());

            if (!category) {
              console.log(chalk.yellow(`\n  Warning: Category "${item.categoryName}" not found for item "${item.itemCode}"`));
              return null;
            }
            if (!supplier) {
              console.log(chalk.yellow(`\n  Warning: Supplier "${item.supplierName}" not found for item "${item.itemCode}"`));
              return null;
            }

            const hasVariants = item.hasVariants === true || item.hasVariants === 'true' || item.hasVariants === 'TRUE';

            return {
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
              alternateLookup: item.barcode || '',
              hasTax: item.hasTax === true || item.hasTax === 'true',
              hasVariants: hasVariants,
              // Stock quantity for non-variant items
              stockQuantity: !hasVariants && item.stockQuantity ? parseFloat(item.stockQuantity) : 0,
              reorderThreshold: item.reorderThreshold ? parseFloat(item.reorderThreshold) : 0,
            };
          }).filter(Boolean); // Remove null items

          if (payload.length > 0) {
            const response = await client.post('/item/create', { items: payload });
            const created = response.data?.data || response.data || [];

            // Update map with created items
            for (const item of (Array.isArray(created) ? created : [created])) {
              if (item.itemCode) {
                itemCodeMap.set(item.itemCode.toLowerCase(), item);
              }
            }
            results.items.created += payload.length;
          }
        } catch (error) {
          console.log(chalk.red(`\n  Error creating items: ${error.message}`));
          results.items.errors += batch.length;
        }
        progress.increment(batch.length);
      }

      progress.stop();
    }

    results.items.existing = data.items.length - results.items.created - results.items.errors;
    console.log(chalk.green(`  Items: ${results.items.created} created, ${results.items.existing} existing ✅`));
  }

  // 4. Import Variants (if there's an API endpoint for it)
  // Note: Variants typically need to be created alongside items
  // For now, we'll log a warning if variants exist but can't be imported via API
  if (data.variants.length > 0) {
    console.log(chalk.yellow(`  ⚠️  ${data.variants.length} variants found - variant import via API not implemented yet`));
    console.log(chalk.yellow(`     Consider using --direct mode for full variant support`));
    results.variants.existing = data.variants.length;
  }

  // 5. Import Customers
  if (data.customers.length > 0) {
    const progress = createProgressBar('Customers');
    progress.start(data.customers.length, 0);

    const batches = splitIntoBatches(data.customers, batchSize);
    for (const batch of batches) {
      try {
        const payload = batch.map(c => ({
          firstName: c.firstName,
          lastName: c.lastName,
          salutation: c.salutation || '',
          mobile: c.mobile || null,
          email: c.email || null,
          gender: c.gender || null,
          billStreet: c.billStreet || null,
          billCity: c.billCity || null,
          billState: c.billState || null,
          billPostalCode: c.billPostalCode || null,
          billCountry: c.billCountry || null,
          shipStreet: c.shipStreet || null,
          shipCity: c.shipCity || null,
          shipState: c.shipState || null,
          shipPostalCode: c.shipPostalCode || null,
          shipCountry: c.shipCountry || null,
        }));
        await client.post('/customer/create', { customers: payload });
        results.customers.created += batch.length;
      } catch (error) {
        console.log(chalk.red(`\n  Error creating customers: ${error.message}`));
        results.customers.errors += batch.length;
      }
      progress.increment(batch.length);
    }

    progress.stop();
    console.log(chalk.green(`  Customers: ${results.customers.created} created ✅`));
  }

  return results;
}

/**
 * Create missing categories and suppliers referenced in items
 */
async function createMissingDependencies(items, categoryMap, supplierMap, client, batchSize) {
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
  if (missingCategories.size > 0) {
    console.log(chalk.yellow(`  Auto-creating ${missingCategories.size} missing categories...`));
    const payload = Array.from(missingCategories).map(name => ({ name, description: '' }));
    try {
      const response = await client.post('/category/create', { categories: payload });
      const created = response.data?.data || response.data || [];
      for (const cat of (Array.isArray(created) ? created : [created])) {
        if (cat.name) {
          categoryMap.set(cat.name.toLowerCase(), cat);
        }
      }
    } catch (error) {
      console.log(chalk.red(`  Error creating missing categories: ${error.message}`));
    }
  }

  // Create missing suppliers
  if (missingSuppliers.size > 0) {
    console.log(chalk.yellow(`  Auto-creating ${missingSuppliers.size} missing suppliers...`));
    const payload = Array.from(missingSuppliers).map(name => ({ companyName: name, hasTax: false }));
    try {
      const response = await client.post('/supplier/create', { suppliers: payload });
      const created = response.data?.data || response.data || [];
      for (const sup of (Array.isArray(created) ? created : [created])) {
        if (sup.companyName) {
          supplierMap.set(sup.companyName.toLowerCase(), sup);
        }
      }
    } catch (error) {
      console.log(chalk.red(`  Error creating missing suppliers: ${error.message}`));
    }
  }
}
