import XLSX from 'xlsx';
import path from 'path';

// Column name mappings - maps expected column names to alternate names
const COLUMN_MAPPINGS = {
  // Category columns
  name: ['name', 'category_name', 'categoryname', 'nama', 'nama_kategori'],
  description: ['description', 'desc', 'deskripsi', 'keterangan'],
  parentCategory: ['parentcategory', 'parent_category', 'parent', 'kategori_induk'],

  // Supplier columns
  companyName: ['companyname', 'company_name', 'company', 'supplier', 'vendor', 'nama_supplier', 'nama_pemasok', 'pemasok'],
  companyStreet: ['companystreet', 'company_street', 'street', 'address', 'alamat', 'jalan'],
  companyCity: ['companycity', 'company_city', 'city', 'kota'],
  companyState: ['companystate', 'company_state', 'state', 'province', 'provinsi'],
  companyPostalCode: ['companypostalcode', 'company_postal_code', 'postal_code', 'postalcode', 'zip', 'kode_pos'],
  companyCountry: ['companycountry', 'company_country', 'country', 'negara'],
  companyRegisterNumber: ['companyregisternumber', 'company_register_number', 'register_number', 'npwp', 'tax_id'],
  personInChargeFirstName: ['personinchargefirstname', 'person_in_charge_first_name', 'pic_first_name', 'contact_first_name', 'nama_depan_pic'],
  personInChargeLastName: ['personinchargelastname', 'person_in_charge_last_name', 'pic_last_name', 'contact_last_name', 'nama_belakang_pic'],
  mobile: ['mobile', 'phone', 'telephone', 'hp', 'handphone', 'no_hp', 'nomor_hp'],
  email: ['email', 'e-mail', 'email_address'],
  remark: ['remark', 'remarks', 'note', 'notes', 'catatan'],
  hasTax: ['hastax', 'has_tax', 'taxable', 'kena_pajak'],

  // Item columns
  itemName: ['itemname', 'item_name', 'name', 'product_name', 'product', 'nama_produk', 'nama_barang', 'nama_item'],
  itemCode: ['itemcode', 'item_code', 'sku', 'code', 'kode', 'kode_produk', 'kode_barang'],
  itemType: ['itemtype', 'item_type', 'type', 'tipe', 'jenis'],
  itemModel: ['itemmodel', 'item_model', 'model'],
  itemBrand: ['itembrand', 'item_brand', 'brand', 'merek', 'merk'],
  itemDescription: ['itemdescription', 'item_description', 'description', 'desc', 'deskripsi'],
  categoryName: ['categoryname', 'category_name', 'category', 'kategori', 'nama_kategori'],
  supplierName: ['suppliername', 'supplier_name', 'supplier', 'vendor', 'pemasok', 'nama_supplier'],
  cost: ['cost', 'buy_price', 'purchase_price', 'harga_beli', 'modal', 'hpp'],
  price: ['price', 'sell_price', 'selling_price', 'harga_jual', 'harga'],
  currency: ['currency', 'mata_uang'],
  unitOfMeasure: ['unitofmeasure', 'unit_of_measure', 'unit', 'uom', 'satuan'],
  barcode: ['barcode', 'alternatelookup', 'alternate_lookup', 'alternate_look_up'],
  stockQuantity: ['stockquantity', 'stock_quantity', 'stock', 'qty', 'quantity', 'stok', 'jumlah', 'opening_stock', 'initial_stock'],
  outletId: ['outletid', 'outlet_id', 'outlet', 'store_id', 'store'],
  reorderThreshold: ['reorderthreshold', 'reorder_threshold', 'reorder_level', 'min_stock', 'minimum_stock'],
  hasVariants: ['hasvariants', 'has_variants', 'with_variants', 'ada_varian'],

  // Variant columns
  parentItemCode: ['parentitemcode', 'parent_item_code', 'parent_sku', 'parent_code', 'item_code', 'kode_induk'],
  variantSku: ['variantsku', 'variant_sku', 'sku', 'variant_code', 'kode_varian'],
  variantName: ['variantname', 'variant_name', 'variant', 'nama_varian'],
  attribute1Type: ['attribute1type', 'attribute1_type', 'attr1_type', 'attribute_type_1', 'tipe_atribut_1'],
  attribute1Value: ['attribute1value', 'attribute1_value', 'attr1_value', 'attribute_value_1', 'nilai_atribut_1'],
  attribute2Type: ['attribute2type', 'attribute2_type', 'attr2_type', 'attribute_type_2', 'tipe_atribut_2'],
  attribute2Value: ['attribute2value', 'attribute2_value', 'attr2_value', 'attribute_value_2', 'nilai_atribut_2'],
  attribute3Type: ['attribute3type', 'attribute3_type', 'attr3_type', 'attribute_type_3', 'tipe_atribut_3'],
  attribute3Value: ['attribute3value', 'attribute3_value', 'attr3_value', 'attribute_value_3', 'nilai_atribut_3'],

  // Customer columns
  firstName: ['firstname', 'first_name', 'nama_depan'],
  lastName: ['lastname', 'last_name', 'nama_belakang'],
  salutation: ['salutation', 'title', 'sapaan'],
  gender: ['gender', 'jenis_kelamin'],
  billStreet: ['billstreet', 'bill_street', 'billing_street', 'alamat_tagihan'],
  billCity: ['billcity', 'bill_city', 'billing_city', 'kota_tagihan'],
  billState: ['billstate', 'bill_state', 'billing_state', 'provinsi_tagihan'],
  billPostalCode: ['billpostalcode', 'bill_postal_code', 'billing_postal_code', 'kode_pos_tagihan'],
  billCountry: ['billcountry', 'bill_country', 'billing_country', 'negara_tagihan'],
  shipStreet: ['shipstreet', 'ship_street', 'shipping_street', 'alamat_pengiriman'],
  shipCity: ['shipcity', 'ship_city', 'shipping_city', 'kota_pengiriman'],
  shipState: ['shipstate', 'ship_state', 'shipping_state', 'provinsi_pengiriman'],
  shipPostalCode: ['shippostalcode', 'ship_postal_code', 'shipping_postal_code', 'kode_pos_pengiriman'],
  shipCountry: ['shipcountry', 'ship_country', 'shipping_country', 'negara_pengiriman'],
};

/**
 * Find the matching column name from the header row
 * @param {string[]} headers - Array of column headers from Excel
 * @param {string} targetColumn - The target column name to find
 * @returns {string|null} - The actual header name that matches, or null
 */
function findColumnHeader(headers, targetColumn) {
  const normalizedHeaders = headers.map(h => h?.toString().toLowerCase().trim().replace(/\s+/g, '_'));
  const mappings = COLUMN_MAPPINGS[targetColumn] || [targetColumn.toLowerCase()];

  for (const mapping of mappings) {
    const index = normalizedHeaders.indexOf(mapping);
    if (index !== -1) {
      return headers[index];
    }
  }
  return null;
}

/**
 * Create a column mapping from actual headers to target field names
 * @param {string[]} headers - Array of column headers
 * @param {string[]} targetFields - Array of target field names
 * @returns {Object} - Mapping of actual header -> target field
 */
function createColumnMap(headers, targetFields) {
  const columnMap = {};
  for (const field of targetFields) {
    const actualHeader = findColumnHeader(headers, field);
    if (actualHeader) {
      columnMap[actualHeader] = field;
    }
  }
  return columnMap;
}

/**
 * Parse a sheet and map columns to target fields
 * @param {XLSX.WorkBook} workbook - The workbook
 * @param {string} sheetName - Name of the sheet
 * @param {string[]} targetFields - Array of target field names
 * @returns {Object[]} - Array of parsed rows with mapped field names
 */
function parseSheet(workbook, sheetName, targetFields) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return [];
  }

  // Get raw data as array of arrays
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rawData.length < 2) {
    return []; // No data rows (only header or empty)
  }

  const headers = rawData[0];
  const columnMap = createColumnMap(headers, targetFields);
  const rows = [];

  for (let i = 1; i < rawData.length; i++) {
    const rawRow = rawData[i];

    // Skip empty rows
    if (!rawRow || rawRow.every(cell => cell === '' || cell === null || cell === undefined)) {
      continue;
    }

    // Stop parsing when we hit the notes section
    const firstCell = rawRow[0]?.toString().trim() || '';
    if (
      firstCell === '--- NOTES ---' ||
      firstCell.startsWith('* ') ||
      firstCell.startsWith('NOTE:') ||
      firstCell.startsWith('Notes:')
    ) {
      break;
    }

    const row = { _rowNumber: i + 1 }; // Excel rows are 1-indexed, +1 for header

    headers.forEach((header, colIndex) => {
      const targetField = columnMap[header];
      if (targetField) {
        let value = rawRow[colIndex];

        // Convert boolean strings
        if (typeof value === 'string') {
          const lowerValue = value.toLowerCase().trim();
          if (lowerValue === 'true' || lowerValue === 'yes' || lowerValue === '1') {
            value = true;
          } else if (lowerValue === 'false' || lowerValue === 'no' || lowerValue === '0') {
            value = false;
          }
        }

        row[targetField] = value;
      }
    });

    rows.push(row);
  }

  return rows;
}

/**
 * Parse categories from the workbook
 */
function parseCategories(workbook) {
  const targetFields = ['name', 'description', 'parentCategory'];
  return parseSheet(workbook, 'Categories', targetFields);
}

/**
 * Parse suppliers from the workbook
 */
function parseSuppliers(workbook) {
  const targetFields = [
    'companyName', 'companyStreet', 'companyCity', 'companyState',
    'companyPostalCode', 'companyCountry', 'companyRegisterNumber',
    'personInChargeFirstName', 'personInChargeLastName',
    'mobile', 'email', 'remark', 'hasTax'
  ];
  return parseSheet(workbook, 'Suppliers', targetFields);
}

/**
 * Parse items from the workbook
 */
function parseItems(workbook) {
  const targetFields = [
    'itemName', 'itemCode', 'itemType', 'itemModel', 'itemBrand',
    'itemDescription', 'categoryName', 'supplierName', 'cost', 'price',
    'currency', 'unitOfMeasure', 'barcode', 'stockQuantity', 'outletId',
    'reorderThreshold', 'hasTax', 'hasVariants'
  ];
  return parseSheet(workbook, 'Items', targetFields);
}

/**
 * Parse item variants from the workbook
 */
function parseVariants(workbook) {
  const targetFields = [
    'parentItemCode', 'variantSku', 'variantName', 'cost', 'price',
    'barcode', 'stockQuantity', 'outletId',
    'attribute1Type', 'attribute1Value',
    'attribute2Type', 'attribute2Value',
    'attribute3Type', 'attribute3Value'
  ];
  return parseSheet(workbook, 'Item_Variants', targetFields);
}

/**
 * Parse customers from the workbook
 */
function parseCustomers(workbook) {
  const targetFields = [
    'firstName', 'lastName', 'salutation', 'mobile', 'email', 'gender',
    'billStreet', 'billCity', 'billState', 'billPostalCode', 'billCountry',
    'shipStreet', 'shipCity', 'shipState', 'shipPostalCode', 'shipCountry'
  ];
  return parseSheet(workbook, 'Customers', targetFields);
}

/**
 * Main function to parse an Excel file
 * @param {string} filePath - Path to the Excel file
 * @returns {Object} - Parsed data from all sheets
 */
export function parseExcel(filePath) {
  const absolutePath = path.resolve(filePath);
  const workbook = XLSX.readFile(absolutePath);

  const sheetNames = workbook.SheetNames;
  console.log(`📂 Found sheets: ${sheetNames.join(', ')}`);

  const data = {
    categories: parseCategories(workbook),
    suppliers: parseSuppliers(workbook),
    items: parseItems(workbook),
    variants: parseVariants(workbook),
    customers: parseCustomers(workbook),
  };

  // Summary
  console.log(`✅ Parsed:`);
  console.log(`   - ${data.categories.length} categories`);
  console.log(`   - ${data.suppliers.length} suppliers`);
  console.log(`   - ${data.items.length} items`);
  console.log(`   - ${data.variants.length} variants`);
  console.log(`   - ${data.customers.length} customers`);

  return data;
}

/**
 * Get a summary of what was found in the file
 * @param {Object} data - Parsed data
 * @returns {Object} - Summary counts
 */
export function getDataSummary(data) {
  return {
    categories: data.categories.length,
    suppliers: data.suppliers.length,
    items: data.items.length,
    variants: data.variants.length,
    customers: data.customers.length,
    total: data.categories.length + data.suppliers.length + data.items.length +
           data.variants.length + data.customers.length
  };
}
