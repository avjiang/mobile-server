/**
 * Data Validator for Import CLI
 * Validates parsed Excel data before import
 */

// Valid attribute types (hardcoded in the system)
const VALID_ATTRIBUTE_TYPES = [
  'Color', 'Size', 'Storage', 'Material', 'Style',
  'Weight', 'Length', 'Width', 'Height', 'Capacity'
];

// Standardized UOM values (English capitalized full names)
const VALID_UOM_VALUES = [
  'Piece', 'Pair', 'Box', 'Meter', 'Dozen', 'Set', 'Pack',
  'Milliliter', 'Liter', 'Gram', 'Kilogram'
];

/**
 * Validation result structure
 */
class ValidationResult {
  constructor() {
    this.isValid = true;
    this.errors = [];
    this.warnings = [];
  }

  addError(sheet, row, field, value, message) {
    this.isValid = false;
    this.errors.push({ sheet, row, field, value, message });
  }

  addWarning(sheet, row, field, value, message) {
    this.warnings.push({ sheet, row, field, value, message });
  }
}

/**
 * Check if a value is empty
 */
function isEmpty(value) {
  return value === undefined || value === null || value === '';
}

/**
 * Check if a value is a valid number
 */
function isValidNumber(value) {
  if (isEmpty(value)) return false;
  const num = Number(value);
  return !isNaN(num) && isFinite(num);
}

/**
 * Check if a value is a valid positive number
 */
function isValidPositiveNumber(value) {
  if (!isValidNumber(value)) return false;
  return Number(value) >= 0;
}

/**
 * Validate categories
 */
function validateCategories(categories, result) {
  const categoryNames = new Set();

  categories.forEach((category, index) => {
    const row = category._rowNumber || index + 2;

    // Required: name
    if (isEmpty(category.name)) {
      result.addError('Categories', row, 'name', category.name, 'Category name is required');
    } else {
      // Check for duplicates within the file
      if (categoryNames.has(category.name.toLowerCase())) {
        result.addWarning('Categories', row, 'name', category.name, `Duplicate category name "${category.name}" found in file`);
      }
      categoryNames.add(category.name.toLowerCase());
    }
  });

  return categoryNames;
}

/**
 * Validate suppliers
 */
function validateSuppliers(suppliers, result) {
  const supplierNames = new Set();

  suppliers.forEach((supplier, index) => {
    const row = supplier._rowNumber || index + 2;

    // Required: companyName
    if (isEmpty(supplier.companyName)) {
      result.addError('Suppliers', row, 'companyName', supplier.companyName, 'Company name is required');
    } else {
      // Check for duplicates within the file
      if (supplierNames.has(supplier.companyName.toLowerCase())) {
        result.addWarning('Suppliers', row, 'companyName', supplier.companyName, `Duplicate supplier name "${supplier.companyName}" found in file`);
      }
      supplierNames.add(supplier.companyName.toLowerCase());
    }

    // Required: hasTax (boolean)
    if (isEmpty(supplier.hasTax)) {
      result.addWarning('Suppliers', row, 'hasTax', supplier.hasTax, 'hasTax not specified, defaulting to false');
    }

    // Validate email format if provided
    if (!isEmpty(supplier.email) && !isValidEmail(supplier.email)) {
      result.addWarning('Suppliers', row, 'email', supplier.email, 'Invalid email format');
    }
  });

  return supplierNames;
}

/**
 * Validate items
 */
function validateItems(items, categoryNames, supplierNames, result) {
  const itemCodes = new Set();
  const itemsWithVariants = new Set();

  items.forEach((item, index) => {
    const row = item._rowNumber || index + 2;

    // Required: itemName
    if (isEmpty(item.itemName)) {
      result.addError('Items', row, 'itemName', item.itemName, 'Item name is required');
    }

    // Required: itemCode
    if (isEmpty(item.itemCode)) {
      result.addError('Items', row, 'itemCode', item.itemCode, 'Item code is required');
    } else {
      // Check for duplicates
      const code = item.itemCode.toString().toLowerCase();
      if (itemCodes.has(code)) {
        result.addError('Items', row, 'itemCode', item.itemCode, `Duplicate item code "${item.itemCode}" found in file`);
      }
      itemCodes.add(code);

      // Track items with variants
      if (item.hasVariants === true || item.hasVariants === 'true' || item.hasVariants === 'TRUE') {
        itemsWithVariants.add(code);
      }
    }

    // Required: categoryName
    if (isEmpty(item.categoryName)) {
      result.addError('Items', row, 'categoryName', item.categoryName, 'Category name is required');
    } else if (!categoryNames.has(item.categoryName.toLowerCase())) {
      result.addWarning('Items', row, 'categoryName', item.categoryName, `Category "${item.categoryName}" not found in Categories sheet, will be created`);
    }

    // Required: supplierName
    if (isEmpty(item.supplierName)) {
      result.addError('Items', row, 'supplierName', item.supplierName, 'Supplier name is required');
    } else if (!supplierNames.has(item.supplierName.toLowerCase())) {
      result.addWarning('Items', row, 'supplierName', item.supplierName, `Supplier "${item.supplierName}" not found in Suppliers sheet, will be created`);
    }

    // Required: cost (must be a valid positive number)
    if (isEmpty(item.cost)) {
      result.addError('Items', row, 'cost', item.cost, 'Cost is required');
    } else if (!isValidPositiveNumber(item.cost)) {
      result.addError('Items', row, 'cost', item.cost, 'Cost must be a valid positive number');
    }

    // Required: price (must be a valid positive number)
    if (isEmpty(item.price)) {
      result.addError('Items', row, 'price', item.price, 'Price is required');
    } else if (!isValidPositiveNumber(item.price)) {
      result.addError('Items', row, 'price', item.price, 'Price must be a valid positive number');
    }

    // Optional: stockQuantity (if provided, must be a valid positive number)
    if (!isEmpty(item.stockQuantity) && !isValidPositiveNumber(item.stockQuantity)) {
      result.addError('Items', row, 'stockQuantity', item.stockQuantity, 'Stock quantity must be a valid positive number');
    }

    // Optional: outletId (if provided, must be a valid positive number)
    if (!isEmpty(item.outletId) && !isValidPositiveNumber(item.outletId)) {
      result.addError('Items', row, 'outletId', item.outletId, 'Outlet ID must be a valid positive number');
    }

    // Warning: stockQuantity on item with variants
    if (item.hasVariants && !isEmpty(item.stockQuantity) && Number(item.stockQuantity) > 0) {
      result.addWarning('Items', row, 'stockQuantity', item.stockQuantity, 'Item has variants - stock should be set on variants instead');
    }

    // Validate unitOfMeasure if provided
    if (!isEmpty(item.unitOfMeasure) && !VALID_UOM_VALUES.includes(item.unitOfMeasure)) {
      result.addWarning('Items', row, 'unitOfMeasure', item.unitOfMeasure, `"${item.unitOfMeasure}" is not a standardized UOM value. Valid values: ${VALID_UOM_VALUES.join(', ')}. It will be auto-normalized if possible.`);
    }
  });

  return { itemCodes, itemsWithVariants };
}

/**
 * Validate variants
 */
function validateVariants(variants, itemCodes, itemsWithVariants, result) {
  const variantSkus = new Set();

  variants.forEach((variant, index) => {
    const row = variant._rowNumber || index + 2;

    // Required: parentItemCode
    if (isEmpty(variant.parentItemCode)) {
      result.addError('Item_Variants', row, 'parentItemCode', variant.parentItemCode, 'Parent item code is required');
    } else {
      const parentCode = variant.parentItemCode.toString().toLowerCase();
      if (!itemCodes.has(parentCode)) {
        result.addError('Item_Variants', row, 'parentItemCode', variant.parentItemCode, `Parent item code "${variant.parentItemCode}" not found in Items sheet`);
      } else if (!itemsWithVariants.has(parentCode)) {
        result.addWarning('Item_Variants', row, 'parentItemCode', variant.parentItemCode, `Parent item "${variant.parentItemCode}" doesn't have hasVariants=true, will be updated`);
      }
    }

    // Required: variantSku
    if (isEmpty(variant.variantSku)) {
      result.addError('Item_Variants', row, 'variantSku', variant.variantSku, 'Variant SKU is required');
    } else {
      const sku = variant.variantSku.toString().toLowerCase();
      if (variantSkus.has(sku)) {
        result.addError('Item_Variants', row, 'variantSku', variant.variantSku, `Duplicate variant SKU "${variant.variantSku}" found in file`);
      }
      variantSkus.add(sku);
    }

    // Required: variantName
    if (isEmpty(variant.variantName)) {
      result.addError('Item_Variants', row, 'variantName', variant.variantName, 'Variant name is required');
    }

    // Optional: cost (if provided, must be a valid positive number)
    if (!isEmpty(variant.cost) && !isValidPositiveNumber(variant.cost)) {
      result.addError('Item_Variants', row, 'cost', variant.cost, 'Cost must be a valid positive number');
    }

    // Optional: price (if provided, must be a valid positive number)
    if (!isEmpty(variant.price) && !isValidPositiveNumber(variant.price)) {
      result.addError('Item_Variants', row, 'price', variant.price, 'Price must be a valid positive number');
    }

    // Optional: stockQuantity (if provided, must be a valid positive number)
    if (!isEmpty(variant.stockQuantity) && !isValidPositiveNumber(variant.stockQuantity)) {
      result.addError('Item_Variants', row, 'stockQuantity', variant.stockQuantity, 'Stock quantity must be a valid positive number');
    }

    // Validate attribute types
    validateVariantAttributes(variant, row, result);
  });
}

/**
 * Validate variant attributes
 */
function validateVariantAttributes(variant, row, result) {
  for (let i = 1; i <= 3; i++) {
    const typeField = `attribute${i}Type`;
    const valueField = `attribute${i}Value`;
    const attrType = variant[typeField];
    const attrValue = variant[valueField];

    // If type is provided, value should also be provided
    if (!isEmpty(attrType) && isEmpty(attrValue)) {
      result.addError('Item_Variants', row, valueField, attrValue, `Attribute ${i} value is required when type is specified`);
    }

    // If value is provided, type should also be provided
    if (!isEmpty(attrValue) && isEmpty(attrType)) {
      result.addError('Item_Variants', row, typeField, attrType, `Attribute ${i} type is required when value is specified`);
    }

    // Validate attribute type is one of the valid types
    if (!isEmpty(attrType) && !VALID_ATTRIBUTE_TYPES.includes(attrType)) {
      result.addWarning('Item_Variants', row, typeField, attrType, `"${attrType}" is not a predefined attribute type. Valid types: ${VALID_ATTRIBUTE_TYPES.join(', ')}`);
    }
  }
}

/**
 * Validate customers
 */
function validateCustomers(customers, result) {
  customers.forEach((customer, index) => {
    const row = customer._rowNumber || index + 2;

    // Required: firstName
    if (isEmpty(customer.firstName)) {
      result.addError('Customers', row, 'firstName', customer.firstName, 'First name is required');
    }

    // Required: lastName
    if (isEmpty(customer.lastName)) {
      result.addError('Customers', row, 'lastName', customer.lastName, 'Last name is required');
    }

    // Validate email format if provided
    if (!isEmpty(customer.email) && !isValidEmail(customer.email)) {
      result.addWarning('Customers', row, 'email', customer.email, 'Invalid email format');
    }
  });
}

/**
 * Simple email validation
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Main validation function
 * @param {Object} data - Parsed data from parseExcel
 * @returns {ValidationResult} - Validation result with errors and warnings
 */
export function validate(data) {
  const result = new ValidationResult();

  // Validate each entity type and collect reference sets
  const categoryNames = validateCategories(data.categories, result);
  const supplierNames = validateSuppliers(data.suppliers, result);
  const { itemCodes, itemsWithVariants } = validateItems(data.items, categoryNames, supplierNames, result);
  validateVariants(data.variants, itemCodes, itemsWithVariants, result);
  validateCustomers(data.customers, result);

  return result;
}

/**
 * Format validation result for console output
 * @param {ValidationResult} result - Validation result
 * @returns {string} - Formatted output
 */
export function formatValidationResult(result) {
  let output = '';

  if (result.isValid && result.warnings.length === 0) {
    output += '✅ All data is valid!\n';
    return output;
  }

  if (result.errors.length > 0) {
    output += `\n❌ Found ${result.errors.length} error(s):\n`;
    result.errors.forEach((error, i) => {
      output += `   ${i + 1}. [${error.sheet}] Row ${error.row}: ${error.field} - ${error.message}`;
      if (error.value !== undefined && error.value !== '') {
        output += ` (value: "${error.value}")`;
      }
      output += '\n';
    });
  }

  if (result.warnings.length > 0) {
    output += `\n⚠️  Found ${result.warnings.length} warning(s):\n`;
    result.warnings.forEach((warning, i) => {
      output += `   ${i + 1}. [${warning.sheet}] Row ${warning.row}: ${warning.field} - ${warning.message}`;
      if (warning.value !== undefined && warning.value !== '') {
        output += ` (value: "${warning.value}")`;
      }
      output += '\n';
    });
  }

  return output;
}
