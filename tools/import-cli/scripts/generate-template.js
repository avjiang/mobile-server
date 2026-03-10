#!/usr/bin/env node

/**
 * Generate Excel Template for Import CLI
 * Run this script to create the import_template.xlsx file
 *
 * Usage: node scripts/generate-template.js
 */

import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define sheet structures
const sheets = {
  Categories: {
    headers: ['name', 'description', 'parentCategory'],
    examples: [
      ['Beverages', 'Cold and hot drinks', ''],
      ['Electronics', 'Electronic devices', ''],
      ['Smartphones', 'Mobile phones', 'Electronics'],
    ],
    notes: [
      '* name (Required): Category name, must be unique',
      '* description (Optional): Category description',
      '* parentCategory (Optional): Parent category name for subcategories',
    ]
  },

  Suppliers: {
    headers: [
      'companyName', 'companyStreet', 'companyCity', 'companyState',
      'companyPostalCode', 'companyCountry', 'companyRegisterNumber',
      'personInChargeFirstName', 'personInChargeLastName',
      'mobile', 'email', 'remark', 'hasTax'
    ],
    examples: [
      ['ABC Supplies', 'Jl. Sudirman 123', 'Jakarta', 'DKI Jakarta', '12345', 'Indonesia', '123456789', 'John', 'Doe', '+62812345678', 'john@abc.com', 'Main supplier', 'TRUE'],
      ['XYZ Trading', 'Jl. Gatot Subroto 456', 'Bandung', 'West Java', '40123', 'Indonesia', '', '', '', '+62898765432', '', '', 'FALSE'],
    ],
    notes: [
      '* companyName (Required): Supplier company name, must be unique',
      '* hasTax (Required): TRUE or FALSE - whether supplier charges tax',
      '* All other fields are optional',
    ]
  },

  Items: {
    headers: [
      'itemName', 'itemCode', 'categoryName', 'supplierName',
      'cost', 'price', 'stockQuantity', 'outletId',
      'itemType', 'itemModel', 'itemBrand', 'itemDescription',
      'unitOfMeasure', 'barcode', 'hasTax', 'hasVariants', 'trackStock', 'reorderThreshold'
    ],
    examples: [
      ['Coca Cola 330ml', 'COC001', 'Beverages', 'ABC Supplies', 5000, 8000, 100, 1, '', '', 'Coca Cola', 'Cold drink', 'Piece', '8901234567890', 'TRUE', 'FALSE', 'TRUE', 10],
      ['Basic T-Shirt', 'TSHIRT001', 'Apparel', 'XYZ Trading', 45000, 80000, 0, 1, 'Clothing', '', 'Local Brand', 'Cotton t-shirt', 'Piece', '', 'FALSE', 'TRUE', 'TRUE', 5],
      ['Detergent', 'DET001', 'Supplies', 'ABC Supplies', 50000, 10000, 5000, 1, '', '', 'CleanBrand', 'Liquid detergent', 'Milliliter', '', 'FALSE', 'FALSE', 'TRUE', 500],
      ['Folding + Ironing', 'SVC001', 'Services', 'ABC Supplies', 5000, 15000, 0, 1, 'Service', '', '', 'Laundry service', '', '', 'FALSE', 'FALSE', 'FALSE', 0],
    ],
    notes: [
      '* itemName (Required): Product name',
      '* itemCode (Required): Unique product code/SKU',
      '* categoryName (Required): Must match a category in Categories sheet',
      '* supplierName (Required): Must match a supplier in Suppliers sheet',
      '* cost (Required): Purchase cost (number)',
      '* price (Required): Selling price (number)',
      '* stockQuantity (Optional): Initial stock quantity. For items WITH variants, leave empty (set stock on variants instead)',
      '* outletId (Optional): Outlet ID for stock, defaults to 1',
      '* hasVariants (Optional): TRUE if this item has variants (sizes, colors, etc.)',
      '* trackStock (Optional): TRUE (default) to track stock for this item. Set FALSE for service items that have no physical inventory (e.g. Folding + Ironing)',
      '* unitOfMeasure (Optional): Unit of measure for the item',
      '* Other fields are optional',
      '',
      'Valid unitOfMeasure values: Piece, Pair, Box, Meter, Dozen, Set, Pack, Milliliter, Liter, Gram, Kilogram',
      '',
      'TIP: Copy category name from Categories sheet column A and paste into categoryName column',
      'TIP: Copy supplier company name from Suppliers sheet column A and paste into supplierName column',
    ]
  },

  Item_Variants: {
    headers: [
      'parentItemCode', 'variantSku', 'variantName',
      'cost', 'price', 'stockQuantity', 'outletId', 'barcode',
      'attribute1Type', 'attribute1Value',
      'attribute2Type', 'attribute2Value',
      'attribute3Type', 'attribute3Value'
    ],
    examples: [
      ['TSHIRT001', 'TSHIRT001-RED-S', 'Red - Small', 45000, 80000, 25, 1, '8901234567891', 'Color', 'Red', 'Size', 'S', '', ''],
      ['TSHIRT001', 'TSHIRT001-RED-M', 'Red - Medium', 45000, 80000, 30, 1, '8901234567892', 'Color', 'Red', 'Size', 'M', '', ''],
      ['TSHIRT001', 'TSHIRT001-BLUE-S', 'Blue - Small', 45000, 85000, 20, 1, '8901234567893', 'Color', 'Blue', 'Size', 'S', '', ''],
    ],
    notes: [
      '* parentItemCode (Required): Copy itemCode from Items sheet (must have hasVariants=TRUE)',
      '* variantSku (Required): Unique SKU for this variant',
      '* variantName (Required): Display name for this variant',
      '* cost/price (Optional): Override parent item cost/price, leave empty to inherit',
      '* stockQuantity (Optional): Initial stock for this variant',
      '',
      'TIP: Copy itemCode from Items sheet column B and paste into parentItemCode column',
      '',
      'Attribute Types (up to 3 per variant):',
      '  Valid types: Color, Size, Storage, Material, Style, Weight, Length, Width, Height, Capacity',
    ]
  },

  Customers: {
    headers: [
      'firstName', 'lastName', 'salutation', 'mobile', 'email', 'gender',
      'billStreet', 'billCity', 'billState', 'billPostalCode', 'billCountry',
      'shipStreet', 'shipCity', 'shipState', 'shipPostalCode', 'shipCountry'
    ],
    examples: [
      ['John', 'Doe', 'Mr.', '+62812345678', 'john@example.com', 'Male', 'Jl. Example 123', 'Jakarta', 'DKI Jakarta', '12345', 'Indonesia', '', '', '', '', ''],
      ['Jane', 'Smith', 'Ms.', '+62898765432', 'jane@example.com', 'Female', '', '', '', '', '', '', '', '', '', ''],
    ],
    notes: [
      '* firstName (Required): Customer first name',
      '* lastName (Required): Customer last name',
      '* All other fields are optional',
      '* If shipping address is empty, billing address will be used',
    ]
  },

  Instructions: {
    headers: ['Instructions'],
    examples: [
      ['=== POS Import Template Instructions ==='],
      [''],
      ['1. Fill in each sheet with your data'],
      ['2. Start with Categories and Suppliers sheets'],
      ['3. Then fill Items sheet, referencing category and supplier names'],
      ['4. If items have variants, set hasVariants=TRUE and fill Item_Variants sheet'],
      ['5. Optionally fill Customers sheet'],
      [''],
      ['=== Column Requirements ==='],
      [''],
      ['CATEGORIES:'],
      ['  - name: Required, must be unique'],
      ['  - description: Optional'],
      ['  - parentCategory: Optional, for subcategories'],
      [''],
      ['SUPPLIERS:'],
      ['  - companyName: Required, must be unique'],
      ['  - hasTax: Required (TRUE/FALSE)'],
      ['  - All other fields optional'],
      [''],
      ['ITEMS:'],
      ['  - itemName, itemCode, categoryName, supplierName, cost, price: Required'],
      ['  - stockQuantity: Optional, initial stock (only for non-variant items)'],
      ['  - hasVariants: TRUE if item has variants'],
      [''],
      ['ITEM_VARIANTS:'],
      ['  - parentItemCode: Required, must match itemCode from Items sheet'],
      ['  - variantSku, variantName: Required'],
      ['  - cost, price: Optional (inherits from parent if empty)'],
      ['  - stockQuantity: Optional, initial stock for this variant'],
      ['  - Up to 3 attribute pairs (type/value)'],
      [''],
      ['CUSTOMERS:'],
      ['  - firstName, lastName: Required'],
      ['  - All other fields optional'],
      [''],
      ['=== Tips ==='],
      [''],
      ['- Delete example rows before importing'],
      ['- Column names are case-insensitive'],
      ['- TRUE/FALSE can also be written as true/false or 1/0'],
      ['- Numbers should not include currency symbols'],
      ['- Validate file before importing: node index.js validate --file=your_file.xlsx'],
    ],
    notes: []
  }
};

// Create workbook
const workbook = XLSX.utils.book_new();

// Track worksheets for adding data validation later
const worksheets = {};

// Add each sheet
for (const [sheetName, config] of Object.entries(sheets)) {
  const data = [];

  // Add headers
  data.push(config.headers);

  // Add example data
  for (const example of config.examples) {
    data.push(example);
  }

  // Add empty rows (more rows to allow for data entry)
  for (let i = 0; i < 100; i++) {
    data.push(new Array(config.headers.length).fill(''));
  }

  // Add notes at the bottom (if any)
  if (config.notes.length > 0) {
    data.push(new Array(config.headers.length).fill(''));
    data.push(['--- NOTES ---']);
    for (const note of config.notes) {
      data.push([note]);
    }
  }

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  const colWidths = config.headers.map(h => ({ wch: Math.max(h.length + 2, 15) }));
  worksheet['!cols'] = colWidths;

  // Store reference for data validation
  worksheets[sheetName] = worksheet;

  // Add to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
}

// Add data validations (dropdowns that reference other sheets)
// Items sheet: categoryName (column C) -> Categories!A:A
// Items sheet: supplierName (column D) -> Suppliers!A:A
// Item_Variants sheet: parentItemCode (column A) -> Items!B:B

// Helper function to add data validation
function addDataValidation(worksheet, column, startRow, endRow, formula) {
  if (!worksheet['!dataValidation']) {
    worksheet['!dataValidation'] = [];
  }
  worksheet['!dataValidation'].push({
    sqref: `${column}${startRow}:${column}${endRow}`,
    type: 'list',
    formula1: formula,
    showDropDown: true,
  });
}

// Items sheet validations
const itemsSheet = worksheets['Items'];
if (itemsSheet) {
  // categoryName is column C (index 2), data starts at row 2
  addDataValidation(itemsSheet, 'C', 2, 102, 'Categories!$A$2:$A$102');
  // supplierName is column D (index 3)
  addDataValidation(itemsSheet, 'D', 2, 102, 'Suppliers!$A$2:$A$102');
}

// Item_Variants sheet validations
const variantsSheet = worksheets['Item_Variants'];
if (variantsSheet) {
  // parentItemCode is column A (index 0), references Items!B (itemCode)
  addDataValidation(variantsSheet, 'A', 2, 102, 'Items!$B$2:$B$102');
}

// Write file
const outputPath = path.join(__dirname, '..', 'templates', 'import_template.xlsx');
XLSX.writeFile(workbook, outputPath);

console.log(`✅ Template generated: ${outputPath}`);
console.log('\nThe template includes:');
console.log('  - Categories sheet');
console.log('  - Suppliers sheet');
console.log('  - Items sheet');
console.log('  - Item_Variants sheet');
console.log('  - Customers sheet');
console.log('  - Instructions sheet');
console.log('\nDelete the example rows before importing your data.');
