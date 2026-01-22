# POS Import CLI Tool

Bulk import data from Excel files to the POS system.

## Quick Start

```bash
# 1. Install dependencies
cd tools/import-cli
npm install

# 2. Generate template (only needed once)
npm run generate-template

# 3. Fill in your data in templates/import_template.xlsx
#    (Delete the example rows, keep the headers)

# 4. Validate
./validate.sh --file=templates/import_template.xlsx

# 5. Import
./import.sh --file=templates/import_template.xlsx --tenant-id=123
```

## Usage Options

### Shell Scripts (Recommended - no `--` needed)

```bash
# Validate
./validate.sh --file=templates/import_template.xlsx

# Import
./import.sh --file=templates/import_template.xlsx --tenant-id=123
```

### NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run validate -- --file=FILE` | Validate Excel file |
| `npm run import:direct -- --file=FILE --tenant-id=ID` | Import via direct DB |
| `npm run import:api -- --file=FILE --api=URL --token=TOKEN` | Import via API |
| `npm run generate-template` | Generate Excel template |

**Note:** The `--` is required before passing arguments when using npm scripts.

## Import Modes

### Direct Database Mode (Recommended)

Connects directly to tenant database. Faster, supports full variant import with stock.

```bash
./import.sh --file=data.xlsx --tenant-id=123
# or by tenant name
./import.sh --file=data.xlsx --tenant-name="customer_abc"
```

### API Mode

Uses existing REST API endpoints with batching. Limited variant support.

```bash
npm run import:api -- --file=data.xlsx --api=https://your-api.com --token=YOUR_TOKEN
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--file, -f` | Excel file path (required) | - |
| `--tenant-id` | Tenant ID (direct mode) | - |
| `--tenant-name` | Tenant name (direct mode) | - |
| `--api` | API base URL (API mode) | - |
| `--token` | Auth token (API mode) | - |
| `--batch-size, -b` | Items per batch | 20 |
| `--outlet-id` | Default outlet for stock | 1 |
| `--dry-run` | Validate without importing | false |

## File Path

The `--file` option accepts any path:

```bash
# Use template directly
./import.sh --file=templates/import_template.xlsx --tenant-id=123

# Use file from anywhere
./import.sh --file=/Users/you/Desktop/customer_data.xlsx --tenant-id=123
```

## Excel Template Sheets

Each sheet has a `--- NOTES ---` section at the bottom. This is automatically ignored during import.

### Categories
| Column | Required | Notes |
|--------|----------|-------|
| name | Yes | Unique category name |
| description | No | |
| parentCategory | No | For subcategories |

### Suppliers
| Column | Required | Notes |
|--------|----------|-------|
| companyName | Yes | Unique |
| hasTax | Yes | TRUE/FALSE |
| mobile, email | No | |
| companyStreet, companyCity, etc. | No | Address |

### Items
| Column | Required | Notes |
|--------|----------|-------|
| itemName | Yes | |
| itemCode | Yes | Unique SKU |
| categoryName | Yes | Must exist in Categories |
| supplierName | Yes | Must exist in Suppliers |
| cost | Yes | Purchase cost |
| price | Yes | Selling price |
| stockQuantity | No | Opening stock (non-variant items only) |
| hasVariants | No | TRUE if has variants |
| barcode, unitOfMeasure, hasTax | No | |

### Item_Variants
| Column | Required | Notes |
|--------|----------|-------|
| parentItemCode | Yes | Copy from Items.itemCode |
| variantSku | Yes | Unique |
| variantName | Yes | e.g., "Red - Large" |
| cost, price | No | Overrides parent if set |
| stockQuantity | No | Opening stock for variant |
| attribute1Type, attribute1Value | No | e.g., Color, Red |
| attribute2Type, attribute2Value | No | e.g., Size, Large |
| attribute3Type, attribute3Value | No | Optional third attribute |

**Valid attribute types:** Color, Size, Storage, Material, Style, Weight, Length, Width, Height, Capacity

### Customers
| Column | Required | Notes |
|--------|----------|-------|
| firstName | Yes | |
| lastName | Yes | |
| mobile, email | No | |
| billStreet, billCity, etc. | No | Billing address |
| shipStreet, shipCity, etc. | No | Shipping address |

## Flexible Column Names

The parser accepts alternate column names:

| Standard | Also accepts |
|----------|--------------|
| itemName | name, product_name, nama_produk |
| itemCode | sku, code, kode_produk |
| cost | buy_price, harga_beli, modal |
| price | sell_price, harga_jual, harga |
| stockQuantity | stock, qty, stok, jumlah |

## Troubleshooting

**"GLOBAL_DB_URL not found" or "TENANT_DATABASE_URL not found"**
- The CLI automatically reads `../../.env` (main project's .env)
- Ensure the main project's `.env` file exists

**"Tenant not found"**
- Verify tenant ID/name exists in global database
- Check spelling if using `--tenant-name`

**"Category/Supplier not found"**
- Add missing entries to Categories/Suppliers sheets first
- Or let the CLI auto-create them (shows a warning)

**API payload too large**
- Use direct mode for large imports
- Or reduce `--batch-size` to 10-15
