# Product Variant API Guide for Frontend Team

**Version:** 3.1 (SYNC & STOCK OPTIMIZED)
**Last Updated:** 2025-11-17
**Status:** ✅ FULLY IMPLEMENTED

---

## 🎯 Quick Summary

**Variants are integrated into the existing Item API - NO separate endpoints needed!**

- Create items WITH variants in one API call
- Variants automatically flag `hasVariants = true`
- All existing `/item` endpoints now return variants
- ⭐ **NEW:** Sales service fully supports variant tracking
- Backward compatible - existing items work unchanged

---

## 📋 What You Need to Know

### 1. Database Changes (Auto-Applied After Migration)

**New Fields Added:**
- `Item.hasVariants` (boolean) - Auto-set to `true` when variants exist
- `SalesItem.itemVariantId`, `variantSku`, `variantName` - For sales tracking

**New Tables:**
- `ItemVariant` - Stores variant details
- `VariantAttributeValue` - Attribute definitions (auto-capitalized to prevent duplicates)
- `ItemVariantAttribute` - Links variants to attributes

**🎯 Auto-Capitalize Feature:**
- Backend automatically converts attribute values to **Title Case**
- "green" → "Green", "rose gold" → "Rose Gold", "256gb" → "256gb"
- **Prevents duplicates** and saves database space
- Frontend can send any case - backend normalizes it!

---

## 🚀 API Changes

### **POST /item** - Create Item with Variants

**Request Body (NEW): add `variants` array**

> **💡 Tip:** Attribute values are auto-capitalized to Title Case by the backend. You can send "green", "GREEN", or "Green" - all will be stored as "Green" to prevent duplicates!

```json
{
  "itemName": "Samsung Galaxy S24",
  "itemCode": "SGS24",
  "itemBrand": "Samsung",
  "categoryId": 1,
  "supplierId": 1,
  "price": 1200.00,
  "cost": 800.00,
  "stockQuantity": 0,
  "reorderThreshold": 5,
  "variants": [
    {
      "variantSku": "SGS24-GREEN-256GB",
      "variantName": "Green - 256GB",
      "cost": 800.00,
      "price": 1200.00,
      "image": "https://example.com/image.jpg",
      "barcode": "1234567890",
      "weight": 0.2,
      "attributes": [
        {
          "definitionKey": "Color",
          "value": "Green",
          "displayValue": "Green"
        },
        {
          "definitionKey": "Storage",
          "value": "256GB",
          "displayValue": "256GB"
        }
      ]
    },
    {
      "variantSku": "SGS24-BLACK-512GB",
      "variantName": "Black - 512GB",
      "cost": 900.00,
      "price": 1400.00,
      "attributes": [
        {
          "definitionKey": "Color",
          "value": "Black",
          "displayValue": "Black"
        },
        {
          "definitionKey": "Storage",
          "value": "512GB",
          "displayValue": "512GB"
        }
      ]
    }
  ]
}
```

**Response (NEW): includes variants with stock quantities**

```json
{
  "id": 123,
  "itemName": "Samsung Galaxy S24",
  "hasVariants": true,  // ← AUTO-SET
  "stockQuantity": 0,   // ← Base item stock (0 for variant items)
  "variants": [
    {
      "id": 1,
      "variantSku": "SGS24-GREEN-256GB",
      "variantName": "Green - 256GB",
      "cost": 800.00,
      "price": 1200.00,
      "stockQuantity": 25,  // ← NEW! Stock quantity for this variant
      "attributes": [
        {
          "definitionKey": "Color",
          "value": "Green",
          "displayValue": "Green",
          "sortOrder": 0
        },
        {
          "definitionKey": "Storage",
          "value": "256GB",
          "displayValue": "256GB",
          "sortOrder": 0
        }
      ]
    }
  ],
  ...
}
```

### **GET /item/:id** - Get Single Item

**Response (NEW): includes variants with stock quantities**

```json
{
  "id": 123,
  "itemName": "Samsung Galaxy S24",
  "hasVariants": true,
  "stockQuantity": 0,  // ← Base item stock (0 for variant items)
  "variants": [
    {
      "id": 1,
      "variantSku": "SGS24-GREEN-256GB",
      "variantName": "Green - 256GB",
      "cost": 800.00,
      "price": 1200.00,
      "stockQuantity": 25,  // ← Stock quantity for this variant
      "image": "https://...",
      "attributes": [
        {
          "definitionKey": "Color",
          "value": "Green",
          "displayValue": "Green"
        }
      ]
    }
  ]
}
```

### **GET /item** - List Items (Paginated)

**Request:** Same as before
```
GET /item?skip=0&take=100&lastSyncTimestamp=2025-11-14T10:00:00Z
```

**Response (NEW): includes variants with stock quantities**

```json
{
  "items": [
    {
      "id": 123,
      "itemName": "Samsung Galaxy S24",
      "hasVariants": true,
      "stockQuantity": 0,  // ← Base item stock
      "variants": [
        {
          "id": 1,
          "variantSku": "SGS24-GREEN-256GB",
          "variantName": "Green - 256GB",
          "stockQuantity": 25,  // ← Variant stock quantity
          "attributes": [...]
        }
      ]
    },
    {
      "id": 124,
      "itemName": "Regular Item",
      "hasVariants": false,
      "stockQuantity": 50,  // ← Stock for simple items
      "variants": []  // ← Empty for items without variants
    }
  ],
  "total": 2,
  "serverTimestamp": "2025-11-17T12:00:00Z"
}
```

### **PUT /item/:id** - Update Item

**Request Body (NEW): can add/update variants**

```json
{
  "id": 123,
  "itemName": "Samsung Galaxy S24 (Updated)",
  "price": 1250.00,
  "variants": [
    {
      "id": 1,  // ← If ID exists, UPDATE variant
      "variantName": "Green - 256GB (Updated)",
      "price": 1250.00
    },
    {
      // ← If NO ID, CREATE new variant
      "variantSku": "SGS24-BLUE-1TB",
      "variantName": "Blue - 1TB",
      "cost": 1000.00,
      "price": 1600.00,
      "attributes": [
        {
          "definitionKey": "Color",
          "value": "Blue",
          "displayValue": "Blue"
        },
        {
          "definitionKey": "Storage",
          "value": "1TB",
          "displayValue": "1TB"
        }
      ]
    }
  ]
}
```

---

## 💰 Sales API with Variants ⭐ NEW!

### **POST /sales/complete** - Complete Sale with Variant

**IMPORTANT:** When selling variant items, you MUST include `itemVariantId`, `variantSku`, and `variantName` in each sales item.

**Request Body:**

```json
{
  "outletId": 1,
  "businessDate": "2025-11-17T00:00:00Z",
  "salesType": "TAKEOUT",
  "totalAmount": 1200.00,
  "salesItems": [
    {
      "itemId": 123,
      "itemVariantId": 1,        // ← REQUIRED for variant items
      "variantSku": "SGS24-GREEN-256GB",   // ← REQUIRED for variant items
      "variantName": "Green - 256GB",      // ← REQUIRED for variant items
      "itemName": "Samsung Galaxy S24",
      "itemCode": "SGS24",
      "quantity": 1,
      "price": 1200.00,
      "priceBeforeTax": 1200.00,
      "cost": 800.00
    }
  ],
  "payments": [
    {
      "method": "CASH",
      "tenderedAmount": 1200.00
    }
  ]
}
```

**Response:**

```json
{
  "id": 5001,
  "totalAmount": "1200.0000",
  "status": "Completed",
  "salesItems": [
    {
      "id": 10001,
      "itemId": 123,
      "itemVariantId": 1,           // ← Saved in database
      "variantSku": "SGS24-GREEN-256GB",
      "variantName": "Green - 256GB",
      "quantity": "1.0000",
      "price": "1200.0000"
    }
  ]
}
```

**What Happens Behind the Scenes:**

1. **Stock Validation** - Checks stock for specific variant, not base item
2. **FIFO Cost Calculation** - Uses variant-specific stock receipts
3. **Stock Deduction** - Reduces stock for the specific variant
4. **Stock Movement** - Records movement with `itemVariantId` for audit trail
5. **Sales Record** - Stores which variant was sold

**For Simple Items (No Variants):**

```json
{
  "salesItems": [
    {
      "itemId": 124,
      "itemVariantId": null,   // ← null for simple items
      "variantSku": null,
      "variantName": null,
      "itemName": "Regular Item",
      "quantity": 1,
      "price": 50.00
    }
  ]
}
```

---

## 🎨 Frontend Implementation

### Step 1: Update Item Creation Form

```dart
// Example: Adding variant support to item creation

class CreateItemScreen extends StatefulWidget {
  @override
  _CreateItemScreenState createState() => _CreateItemScreenState();
}

class _CreateItemScreenState extends State<CreateItemScreen> {
  List<VariantModel> variants = [];

  // Add variant button handler
  void addVariant() {
    setState(() {
      variants.add(VariantModel(
        variantSku: '',
        variantName: '',
        cost: 0,
        price: 0,
        attributes: [],
      ));
    });

    // Navigate to variant creation screen
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => CreateVariantScreen(
          onVariantCreated: (variant) {
            setState(() {
              variants.add(variant);
            });
          },
        ),
      ),
    );
  }

  // Submit item with variants
  Future<void> createItem() async {
    final itemData = {
      'itemName': itemNameController.text,
      'itemCode': itemCodeController.text,
      'categoryId': selectedCategoryId,
      'supplierId': selectedSupplierId,
      'price': priceController.text,
      'cost': costController.text,
      'variants': variants.map((v) => v.toJson()).toList(),  // ← ADD THIS
    };

    final response = await http.post(
      Uri.parse('$baseUrl/item'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(itemData),
    );

    if (response.statusCode == 201) {
      // Success!
      final createdItem = jsonDecode(response.body);
      print('Item created with ${createdItem['variants'].length} variants');
    }
  }
}
```

### Step 2: Display Variants in Item List

```dart
class ItemListTile extends StatelessWidget {
  final ItemModel item;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text(item.itemName),
      subtitle: item.hasVariants
        ? Text('${item.variants.length} variants')  // ← SHOW VARIANT COUNT
        : Text('No variants'),
      trailing: item.hasVariants
        ? Icon(Icons.chevron_right)
        : null,
      onTap: () {
        if (item.hasVariants) {
          // Navigate to variant selection
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => VariantListScreen(item: item),
            ),
          );
        }
      },
    );
  }
}
```

### Step 3: Variant Selection for Sales

```dart
class VariantSelectorDialog extends StatelessWidget {
  final ItemModel item;
  final Function(ItemVariant) onVariantSelected;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('Select Variant for ${item.itemName}'),
      content: Container(
        width: double.maxFinite,
        child: ListView.builder(
          shrinkWrap: true,
          itemCount: item.variants.length,
          itemBuilder: (context, index) {
            final variant = item.variants[index];
            return ListTile(
              title: Text(variant.variantName),
              subtitle: Text(
                variant.attributes
                  .map((attr) => '${attr.definitionKey}: ${attr.displayValue}')
                  .join(' • ')
              ),
              trailing: Text('\$${variant.price.toStringAsFixed(2)}'),
              onTap: () {
                Navigator.pop(context);
                onVariantSelected(variant);
              },
            );
          },
        ),
      ),
    );
  }
}
```

### Step 4: Update Sales Creation

```dart
// When creating a sale with a variant-enabled item:

class SalesItem {
  final int itemId;
  final int? itemVariantId;  // ← ADD THIS (nullable)
  final String? variantSku;  // ← ADD THIS (nullable)
  final String? variantName; // ← ADD THIS (nullable)
  final String itemName;
  final double quantity;
  final double price;

  Map<String, dynamic> toJson() {
    return {
      'itemId': itemId,
      'itemVariantId': itemVariantId,    // ← INCLUDE IN API CALL
      'variantSku': variantSku,          // ← INCLUDE IN API CALL
      'variantName': variantName,        // ← INCLUDE IN API CALL
      'itemName': itemName,
      'quantity': quantity,
      'price': price,
    };
  }
}
```

---

## 🔧 Hardcoded Variant Definition Types

Use these 10 predefined types in your app (stored in frontend, not database):

```dart
const List<String> VARIANT_DEFINITION_TYPES = [
  'Color',
  'Size',
  'Storage',
  'Material',
  'Style',
  'Flavor',
  'Volume',
  'Weight',
  'Pattern',
  'Scent',
];
```

**Dropdown Example:**
```dart
DropdownButton<String>(
  value: selectedDefinitionKey,
  items: VARIANT_DEFINITION_TYPES.map((type) {
    return DropdownMenuItem(
      value: type,
      child: Text(type),
    );
  }).toList(),
  onChanged: (value) {
    setState(() {
      selectedDefinitionKey = value;
    });
  },
)
```

---

## ✅ Checklist for Frontend Implementation

### Phase 1: Basic Variant Support
- [ ] Update `ItemModel` to include `hasVariants` and `variants` array
- [ ] Update item creation form to accept variants
- [ ] Display variant count in item list
- [ ] Show variants in item detail screen

### Phase 2: Variant Creation UI
- [ ] Create variant creation screen (manual mode)
- [ ] Add attribute selector dropdowns (use hardcoded 10 types)
- [ ] Add "Add Attribute" button to create attribute pairs
- [ ] Validate required fields (variantSku, variantName, attributes)

### Phase 3: Sales Integration ⭐ CRITICAL
- [ ] Show variant selector when item has `hasVariants = true`
- [ ] Update `SalesItem` model to include `itemVariantId`, `variantSku`, `variantName` fields
- [ ] **IMPORTANT:** Always pass `itemVariantId`, `variantSku`, `variantName` when selling variant items
- [ ] Handle null values for simple items (no variants)
- [ ] Display variant info in sales receipts/invoices
- [ ] Test stock deduction for specific variants
- [ ] Test void/return/refund with variant items

### Phase 4: Stock Management
- [ ] Show stock per variant (if backend team implements variant stock tracking)
- [ ] Update stock adjustment forms to select specific variants

---

## 📊 Database Migration

**IMPORTANT:** Backend team must run these commands BEFORE you test:

```bash
# Step 1: Install dependencies
npm install compression
npm install --save-dev @types/compression

# Step 2: Format Prisma schema
npx prisma format

# Step 3: Generate migration
npx prisma migrate dev --name add_product_variants

# Step 4: Generate Prisma Client
npx prisma generate

# Step 5: Restart server
npm run dev
```

---

## 🐛 Testing Checklist

### Test Case 1: Create Item with Variants
```
POST /item
{
  "itemName": "Test Product",
  "variants": [
    {
      "variantSku": "TEST-001",
      "variantName": "Red - Small",
      "cost": 10,
      "price": 20,
      "attributes": [
        {"definitionKey": "Color", "value": "Red", "displayValue": "Red"},
        {"definitionKey": "Size", "value": "S", "displayValue": "Small"}
      ]
    }
  ]
}

Expected:
- hasVariants = true (auto-set)
- variants array returned with IDs
```

### Test Case 2: Create Item WITHOUT Variants
```
POST /item
{
  "itemName": "Regular Product",
  "price": 50
}

Expected:
- hasVariants = false (auto-set)
- variants = []
```

### Test Case 3: Get Item with Variants
```
GET /item/123

Expected:
- variants array populated
- attributes transformed to friendly format
```

### Test Case 4: Update Item - Add New Variant
```
PUT /item/123
{
  "variants": [
    {
      "variantSku": "NEW-VARIANT",
      "variantName": "Blue - Large",
      "attributes": [...]
    }
  ]
}

Expected:
- New variant created
- hasVariants auto-set to true if not already
```

---

## ❓ FAQ

### Q: Do I need to manually set `hasVariants = true`?
**A:** No! Backend automatically sets it when variants array exists.

### Q: Can I create variants separately after item creation?
**A:** Yes! Use `PUT /item/:id` with variants array to add new variants.

### Q: How do I delete a variant?
**A:** Currently, soft-delete is handled by backend when item is deleted. Individual variant deletion can be added later if needed.

### Q: What if I want to show previously used attribute values?
**A:** Future enhancement - backend has `GET /variant/attributes/:definitionKey/values` endpoint ready (not currently exposed).

### Q: How do variants affect stock?
**A:** Each variant tracks its own stock separately. When creating sales, you MUST include `itemVariantId`, `variantSku`, and `variantName` to deduct from correct variant stock. The backend validates stock at variant level.

### Q: What happens if I don't include itemVariantId in sales for a variant item?
**A:** The sale will fail with "Stock balance not found" error because the backend looks for stock at variant level, not base item level.

### Q: Can I void/return sales with variants?
**A:** Yes! The backend automatically restores stock to the correct variant when you void, return, or refund a sale.

### Q: Does the sync API include variant updates?
**A:** Yes! When variants are created, updated, or deleted, the parent item's `updatedAt` timestamp is automatically updated. This ensures the sync API (`GET /item?lastSyncTimestamp=...`) will include items with variant changes.

### Q: How do I display stock quantity for variants?
**A:** Each variant in the API response now includes a `stockQuantity` field. For example:
```json
{
  "id": 1,
  "variantName": "Green - 256GB",
  "stockQuantity": 25  // ← Total stock across all outlets
}
```

---

## 📞 Support

**Backend Team Lead:** [Your Name]
**Questions:** Post in #backend-support Slack channel
**Issues:** Report at GitHub Issues

---

**Last Updated:** 2025-11-17
**Sales Integration:** ✅ Complete (v3.0)
**Next Review:** After frontend implementation complete
