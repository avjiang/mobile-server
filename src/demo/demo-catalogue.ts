/**
 * Demo catalogue definitions — the "shop" each demo tenant is stocked with.
 *
 * Split out of demo-seed.service.ts so the seed logic stays readable; this file is
 * pure data. Prices are in IDR (whole rupiah, no minor unit). `weight` biases how
 * often an item is picked at sale time — a warung sells far more Air Mineral than
 * Beras, and a flat distribution makes the demo's top-items chart look fake.
 */

export type DemoVertical = 'retail' | 'laundry' | 'fnb';

export interface DemoCategory {
    name: string;
    description: string;
    /** F&B: the menu tile's food icon (a name from the app's food icon set). */
    icon?: string;
    /** F&B: index into FNB_STATIONS (which kitchen station makes it). */
    station?: number;
}

export interface DemoItemDef {
    name: string;
    code: string;
    /** Index into the vertical's `categories` array. */
    category: number;
    cost: number;
    price: number;
    unitOfMeasure: string;
    /** Sale-time pick weight (relative). */
    weight: number;
    /** Opening stock. 0 / omitted → not stock-tracked (services). */
    opening?: number;
    reorderThreshold?: number;
    itemType?: string;
    brand?: string;
    /** Laundry wash services only — machine load size. Null/absent = "jasa" (non-wash). */
    defaultLoadWeightKg?: number;
    includesIroning?: boolean;
    /** Max units per line at sale time (default 3). */
    maxQty?: number;
    /** Laundry: how PRICE becomes a line total — mirrors `item.pricingMode`. */
    pricingMode?: 'per_kg' | 'per_piece' | 'flat_per_load';
    /** Laundry `per_kg` services: the weighed kg range a sale draws from. */
    kgRange?: [number, number];
    /** Laundry services: supplies consumed per sale (`item_consumable`). F&B dishes:
     *  the recipe per portion (`recipe` rows; `rate` in the supply's unit, basis 'perLoad'). */
    recipe?: { supply: string; rate: number; basis: 'perKg' | 'perLoad' }[];
    /** F&B: option groups (FNB_MODIFIER_GROUPS names) this dish offers. */
    groups?: string[];
}

export const DEMO_SUPPLIER = {
    retail: {
        companyName: 'CV Sumber Rejeki Distribusi',
        personInChargeFirstName: 'Hendra',
        personInChargeLastName: 'Wijaya',
        mobile: '081234567890',
        email: 'sales@sumberrejeki.example.id',
        companyCity: 'Bandung',
        companyState: 'Jawa Barat',
    },
    fnb: {
        companyName: 'UD Pangan Segar Aceh',
        personInChargeFirstName: 'Teuku',
        personInChargeLastName: 'Rizal',
        mobile: '081265432198',
        email: 'order@pangansegar.example.id',
        companyCity: 'Banda Aceh',
        companyState: 'Aceh',
    },
    laundry: {
        companyName: 'PT Kimia Bersih Nusantara',
        personInChargeFirstName: 'Ratna',
        personInChargeLastName: 'Sari',
        mobile: '081298765432',
        email: 'order@kimiabersih.example.id',
        companyCity: 'Surabaya',
        companyState: 'Jawa Timur',
    },
} as const;

export const RETAIL_CATEGORIES: DemoCategory[] = [
    { name: 'Minuman', description: 'Air, teh, kopi, dan susu siap minum' },
    { name: 'Makanan Ringan', description: 'Keripik, biskuit, dan wafer' },
    { name: 'Sembako', description: 'Kebutuhan pokok harian' },
    { name: 'Perawatan Diri', description: 'Sabun, sampo, dan pasta gigi' },
    { name: 'Rumah Tangga', description: 'Kebutuhan kebersihan rumah' },
];

export const RETAIL_ITEMS: DemoItemDef[] = [
    // Minuman — the fastest movers in a warung.
    { name: 'Air Mineral 600ml', code: 'MIN-001', category: 0, cost: 2400, price: 4000, unitOfMeasure: 'Piece', weight: 22, opening: 175, reorderThreshold: 48, brand: 'Segar', maxQty: 4 },
    { name: 'Teh Kotak 250ml', code: 'MIN-002', category: 0, cost: 3500, price: 5500, unitOfMeasure: 'Piece', weight: 16, opening: 180, reorderThreshold: 36, brand: 'Sosro' },
    { name: 'Kopi Sachet 20g', code: 'MIN-003', category: 0, cost: 1200, price: 2000, unitOfMeasure: 'Piece', weight: 18, opening: 210, reorderThreshold: 60, brand: 'Kapal Api', maxQty: 5 },
    { name: 'Susu UHT Coklat 250ml', code: 'MIN-004', category: 0, cost: 5000, price: 7500, unitOfMeasure: 'Piece', weight: 11, opening: 120, reorderThreshold: 24, brand: 'Ultra' },

    // Makanan Ringan
    { name: 'Keripik Singkong 100g', code: 'SNK-001', category: 1, cost: 6000, price: 10000, unitOfMeasure: 'Piece', weight: 10, opening: 96, reorderThreshold: 20, brand: 'Qtela' },
    { name: 'Biskuit Kelapa 120g', code: 'SNK-002', category: 1, cost: 5500, price: 9000, unitOfMeasure: 'Piece', weight: 8, opening: 84, reorderThreshold: 18, brand: 'Roma' },
    { name: 'Wafer Coklat 50g', code: 'SNK-003', category: 1, cost: 2500, price: 4000, unitOfMeasure: 'Piece', weight: 12, opening: 118, reorderThreshold: 30, brand: 'Tango', maxQty: 4 },

    // Sembako — high ticket, low frequency. These carry the revenue chart.
    { name: 'Beras Premium 5kg', code: 'SMB-001', category: 2, cost: 62000, price: 75000, unitOfMeasure: 'Piece', weight: 5, opening: 40, reorderThreshold: 8, brand: 'Ramos', maxQty: 2 },
    { name: 'Minyak Goreng 2L', code: 'SMB-002', category: 2, cost: 32000, price: 38000, unitOfMeasure: 'Piece', weight: 7, opening: 60, reorderThreshold: 12, brand: 'Bimoli', maxQty: 2 },
    { name: 'Gula Pasir 1kg', code: 'SMB-003', category: 2, cost: 14000, price: 17500, unitOfMeasure: 'Piece', weight: 8, opening: 72, reorderThreshold: 15, brand: 'Gulaku', maxQty: 3 },
    { name: 'Telur Ayam 1kg', code: 'SMB-004', category: 2, cost: 25000, price: 30000, unitOfMeasure: 'Kilogram', weight: 9, opening: 55, reorderThreshold: 12, brand: '', maxQty: 3 },

    // Perawatan Diri
    { name: 'Sabun Mandi Batang', code: 'PRW-001', category: 3, cost: 3500, price: 5500, unitOfMeasure: 'Piece', weight: 9, opening: 110, reorderThreshold: 24, brand: 'Lifebuoy' },
    { name: 'Sampo Sachet 12ml', code: 'PRW-002', category: 3, cost: 800, price: 1500, unitOfMeasure: 'Piece', weight: 14, opening: 155, reorderThreshold: 50, brand: 'Sunsilk', maxQty: 6 },
    { name: 'Pasta Gigi 75g', code: 'PRW-003', category: 3, cost: 11000, price: 15000, unitOfMeasure: 'Piece', weight: 6, opening: 64, reorderThreshold: 14, brand: 'Pepsodent' },

    // Rumah Tangga
    { name: 'Sabun Cuci Piring 800ml', code: 'RMT-001', category: 4, cost: 14000, price: 19000, unitOfMeasure: 'Piece', weight: 6, opening: 58, reorderThreshold: 12, brand: 'Sunlight', maxQty: 2 },
    { name: 'Deterjen Bubuk 800g', code: 'RMT-002', category: 4, cost: 17000, price: 23000, unitOfMeasure: 'Piece', weight: 6, opening: 52, reorderThreshold: 12, brand: 'Rinso', maxQty: 2 },
];

export const LAUNDRY_CATEGORIES: DemoCategory[] = [
    { name: 'Cuci Kiloan', description: 'Cuci dan setrika, dihitung per kilogram' },
    { name: 'Cuci Satuan', description: 'Bed cover, selimut, dan sprei per buah' },
    { name: 'Jasa Lainnya', description: 'Setrika, cuci sepatu, dan cuci tas' },
    { name: 'Layanan Ekspres', description: 'Selesai dalam 1 hari' },
    { name: 'Perlengkapan', description: 'Deterjen, pewangi, pelicin, dan kemasan' },
];

/**
 * Laundry — a typical Indonesian *laundry kiloan*, priced the way the app's own
 * starter pack prices it (FE `laundry_starter_pack_sheet.dart`): kiloan services are
 * `per_kg` (rate × weighed kg), bed covers/selimut/sprei are `per_piece`, shoes/bags
 * are flat Jasa. Keep the two in step, so the demo shop looks like the shop a new
 * owner gets from the starter pack.
 *
 * `defaultLoadWeightKg` is what separates a **wash** service (counts as a
 * "muatan"/load and contributes kg to laundryOps) from **jasa** (ironing, shoes, bags)
 * — report.service keys off `defaultLoadWeightKg !== null` exactly. A weighed or
 * per-piece wash carries 0 (not null), exactly like the starter pack.
 *
 * `recipe` is the service's bill of materials (`item_consumable`): every sale draws
 * those supplies down, so Stock Management, the low-supplies card and the report's
 * supplies block all move. Supplies (`itemType: 'supply'`) are never sold as lines.
 */
export const LAUNDRY_ITEMS: DemoItemDef[] = [
    // Kiloan — weighed at the counter, rate per kg.
    { name: 'Cuci Kering Lipat', code: 'CKL-001', category: 0, cost: 2000, price: 6000, unitOfMeasure: 'Piece', weight: 30, itemType: 'service', pricingMode: 'per_kg', defaultLoadWeightKg: 0, kgRange: [2.5, 8],
      recipe: [{ supply: 'SUP-001', rate: 18, basis: 'perKg' }, { supply: 'SUP-002', rate: 6, basis: 'perKg' }, { supply: 'SUP-004', rate: 1, basis: 'perLoad' }] },
    { name: 'Cuci Setrika', code: 'CKS-001', category: 0, cost: 2800, price: 8000, unitOfMeasure: 'Piece', weight: 34, itemType: 'service', pricingMode: 'per_kg', defaultLoadWeightKg: 0, includesIroning: true, kgRange: [2.5, 8],
      recipe: [{ supply: 'SUP-001', rate: 18, basis: 'perKg' }, { supply: 'SUP-002', rate: 6, basis: 'perKg' }, { supply: 'SUP-003', rate: 4, basis: 'perKg' }, { supply: 'SUP-004', rate: 1, basis: 'perLoad' }] },
    { name: 'Cuci Kilat 1 Hari', code: 'EXP-001', category: 3, cost: 3500, price: 12000, unitOfMeasure: 'Piece', weight: 8, itemType: 'service', pricingMode: 'per_kg', defaultLoadWeightKg: 0, includesIroning: true, kgRange: [2, 5],
      recipe: [{ supply: 'SUP-001', rate: 18, basis: 'perKg' }, { supply: 'SUP-002', rate: 6, basis: 'perKg' }, { supply: 'SUP-003', rate: 4, basis: 'perKg' }, { supply: 'SUP-004', rate: 1, basis: 'perLoad' }] },
    { name: 'Setrika Saja', code: 'STR-001', category: 2, cost: 1500, price: 5000, unitOfMeasure: 'Piece', weight: 10, itemType: 'service', pricingMode: 'per_kg', includesIroning: true, kgRange: [2, 6],
      recipe: [{ supply: 'SUP-003', rate: 4, basis: 'perKg' }, { supply: 'SUP-004', rate: 1, basis: 'perLoad' }] },

    // Satuan — one price per piece washed.
    { name: 'Bed Cover', code: 'SAT-001', category: 1, cost: 11000, price: 35000, unitOfMeasure: 'Piece', weight: 6, itemType: 'service', pricingMode: 'per_piece', defaultLoadWeightKg: 0,
      recipe: [{ supply: 'SUP-001', rate: 60, basis: 'perLoad' }, { supply: 'SUP-002', rate: 20, basis: 'perLoad' }, { supply: 'SUP-004', rate: 1, basis: 'perLoad' }] },
    { name: 'Selimut', code: 'SAT-002', category: 1, cost: 8000, price: 25000, unitOfMeasure: 'Piece', weight: 6, itemType: 'service', pricingMode: 'per_piece', defaultLoadWeightKg: 0,
      recipe: [{ supply: 'SUP-001', rate: 45, basis: 'perLoad' }, { supply: 'SUP-002', rate: 15, basis: 'perLoad' }, { supply: 'SUP-004', rate: 1, basis: 'perLoad' }] },
    { name: 'Sprei', code: 'SAT-003', category: 1, cost: 5000, price: 15000, unitOfMeasure: 'Piece', weight: 5, itemType: 'service', pricingMode: 'per_piece', defaultLoadWeightKg: 0,
      recipe: [{ supply: 'SUP-001', rate: 30, basis: 'perLoad' }, { supply: 'SUP-002', rate: 10, basis: 'perLoad' }, { supply: 'SUP-004', rate: 1, basis: 'perLoad' }] },

    // Jasa — flat price, no machine, so they never inflate kg/loads.
    { name: 'Cuci Sepatu', code: 'JSA-001', category: 2, cost: 9000, price: 30000, unitOfMeasure: 'Piece', weight: 6, itemType: 'service', maxQty: 2 },
    { name: 'Cuci Tas', code: 'JSA-002', category: 2, cost: 11000, price: 35000, unitOfMeasure: 'Piece', weight: 3, itemType: 'service', maxQty: 1 },

    // Supplies — stocked master data, drawn down by the recipes above. Pewangi opens
    // low on purpose: ten days of trading (~2.850 ml) push it under its reorder
    // threshold, so the dashboard's low-supplies card (and the sales tour's
    // "bahan-menipis" shot) has something to say. 6000 landed at ~3.155 — above 3000.
    { name: 'Deterjen Cair', code: 'SUP-001', category: 4, cost: 25, price: 0, unitOfMeasure: 'Milliliter', weight: 0, opening: 25000, reorderThreshold: 5000, itemType: 'supply' },
    { name: 'Pewangi Pakaian', code: 'SUP-002', category: 4, cost: 30, price: 0, unitOfMeasure: 'Milliliter', weight: 0, opening: 5000, reorderThreshold: 3000, itemType: 'supply' },
    { name: 'Pelicin Setrika', code: 'SUP-003', category: 4, cost: 20, price: 0, unitOfMeasure: 'Milliliter', weight: 0, opening: 6000, reorderThreshold: 1500, itemType: 'supply' },
    { name: 'Plastik Kemasan', code: 'SUP-004', category: 4, cost: 400, price: 0, unitOfMeasure: 'Piece', weight: 0, opening: 400, reorderThreshold: 100, itemType: 'supply' },
];

/** Twelve regulars. Shared by both verticals — a laundry has repeat customers too. */
export const DEMO_CUSTOMERS = [
    { salutation: 'Bapak', firstName: 'Budi', lastName: 'Santoso', mobile: '081211110001', gender: 'Male', city: 'Bandung' },
    { salutation: 'Ibu', firstName: 'Siti', lastName: 'Rahayu', mobile: '081211110002', gender: 'Female', city: 'Bandung' },
    { salutation: 'Bapak', firstName: 'Agus', lastName: 'Setiawan', mobile: '081211110003', gender: 'Male', city: 'Cimahi' },
    { salutation: 'Ibu', firstName: 'Dewi', lastName: 'Lestari', mobile: '081211110004', gender: 'Female', city: 'Bandung' },
    { salutation: 'Bapak', firstName: 'Eko', lastName: 'Prasetyo', mobile: '081211110005', gender: 'Male', city: 'Bandung' },
    { salutation: 'Ibu', firstName: 'Rina', lastName: 'Marlina', mobile: '081211110006', gender: 'Female', city: 'Cimahi' },
    { salutation: 'Bapak', firstName: 'Joko', lastName: 'Susilo', mobile: '081211110007', gender: 'Male', city: 'Bandung' },
    { salutation: 'Ibu', firstName: 'Ayu', lastName: 'Wulandari', mobile: '081211110008', gender: 'Female', city: 'Bandung' },
    { salutation: 'Bapak', firstName: 'Rudi', lastName: 'Hartono', mobile: '081211110009', gender: 'Male', city: 'Soreang' },
    { salutation: 'Ibu', firstName: 'Maya', lastName: 'Puspita', mobile: '081211110010', gender: 'Female', city: 'Bandung' },
    { salutation: 'Bapak', firstName: 'Dedi', lastName: 'Kurniawan', mobile: '081211110011', gender: 'Male', city: 'Cimahi' },
    { salutation: 'Ibu', firstName: 'Nia', lastName: 'Anggraini', mobile: '081211110012', gender: 'Female', city: 'Bandung' },
];

/**
 * Payment mix. Cash still dominates in a UMKM, but the demo should show that the
 * payment breakdown chart has more than one slice in it. Only the methods the app's
 * payment screen can actually record (`payment_screen.dart`: Cash, Bank Transfer) —
 * anything else has no localized label and shows up raw ("E-Wallet") in Indonesian.
 */
export const PAYMENT_MIX: { method: string; weight: number }[] = [
    { method: 'Cash', weight: 70 },
    { method: 'Bank Transfer', weight: 30 },
];

/**
 * The laundry demo's shop identity — what its receipts, nota PDFs and WhatsApp
 * messages print. Upserted into `setting` (a preserved table), so a reseed keeps it
 * current instead of leaving the placeholder defaults ("Laundry Saya" and its generic
 * footer) that the app falls back to.
 */
export const LAUNDRY_SHOP = {
    ownerFirstName: 'Andi',
    ownerLastName: 'Pratama',
    outletName: 'Outlet Utama',
    street: 'Jl. Merdeka No. 18',
    city: 'Bandung',
    warehouseName: 'Gudang Utama',
    settings: {
        company_name: 'Laundry Wangi Bersih',
        receipt_address: 'Jl. Merdeka No. 18, Bandung',
        receipt_phone: '0812-2000-1818',
        receipt_footer: 'Terima kasih, cucian Anda kami rawat sepenuh hati.',
        // USER scope — without it the app falls back to the definition default ('en')
        // and flips to English right after login.
        language: 'id',
        receipt_terms: 'Cucian yang tidak diambil lebih dari 30 hari di luar tanggung jawab kami. Komplain maksimal 1x24 jam setelah pengambilan.',
    } as Record<string, string>,
};

/** Laundry prepaid packages (`subscription_package`, USAGE) and who bought one. */
export const LAUNDRY_PACKAGES = [
    { name: 'Paket Hemat 10x Cuci', price: 90000, totalQuota: 10, quotaUnit: 'sesi', validityDays: 60, categories: [0] },
    { name: 'Paket Keluarga 20x Cuci', price: 170000, totalQuota: 20, quotaUnit: 'sesi', validityDays: 90, categories: [0, 1] },
];
/** [customer index into DEMO_CUSTOMERS, package index, sessions already used]. */
export const LAUNDRY_PACKAGE_BUYERS: [number, number, number][] = [
    [1, 0, 3],
    [5, 0, 7],
    [3, 1, 4],
];

/**
 * Loyalty baseline, both verticals: one points programme and a Rp 500rb reward rule.
 * Tiers only for laundry — Pro Laundry bundles Advanced Loyalty; Pro Retail needs the
 * add-on, which the demo tenant does not carry. All text Indonesian (the sales tour's
 * English guard fails on anything else). Numbers match the loyalty Instagram carousel:
 * Perak 5 %, Emas 10 % / 2× points, voucher 10 % at every Rp 500.000.
 */
export const DEMO_LOYALTY = {
    program: { name: 'Poin Pelanggan Setia', pointsPerCurrency: 0.001, currencyPerPoint: 10, pointsExpiryDays: 365, minRedeemPoints: 50 },
    tiers: [
        { name: 'Perunggu', minSpend: 0, discountPercentage: 0, pointsMultiplier: 1, sortOrder: 0 },
        { name: 'Perak', minSpend: 500000, discountPercentage: 5, pointsMultiplier: 1.5, sortOrder: 1 },
        { name: 'Emas', minSpend: 1000000, discountPercentage: 10, pointsMultiplier: 2, sortOrder: 2 },
    ],
    rewardRule: {
        name: 'Hadiah Belanja Rp 500rb', spendThreshold: 500000, isRepeatable: true,
        discountType: 'PERCENTAGE', discountPercentage: 10, expiryDays: 30,
        label: 'Hadiah Belanja Rp 500rb — Diskon 10%',
    },
    /** Description of the opening ADJUST row: balances carried over from the paper stamp card. */
    openingDescription: 'Saldo awal dari kartu stempel',
};

/**
 * Where three regulars END UP after the ten seeded days, so real-UI captures can cross a
 * threshold with one live sale. [DEMO_CUSTOMERS index, lifetime spend, points balance].
 * The part not explained by their seeded sales is an opening balance (see above).
 *   Rina  — Rp 460.000: one Rp 64.000 sale crosses the Rp 500.000 voucher (and Perak).
 *   Siti  — Rp 950.000: Perak, one sale from Emas.
 *   Dewi  — Rp 1.250.000: already Emas, with a voucher waiting.
 */
export const LOYALTY_TARGETS: [number, number, number][] = [
    [5, 460000, 240],
    [1, 950000, 820],
    [3, 1250000, 1400],
];

// ── F&B: a kedai kopi + makan (docs/modules/FNB.md, P7 demo) ───────────────

export const FNB_SHOP = {
    companyName: 'Kedai Kopi Nanggroe',
    /** The online address QR ordering points at (kedainanggroe.bayaryuk.net). */
    slug: 'kedainanggroe',
};

/** Kitchen stations; categories route to them. */
export const FNB_STATIONS = ['Dapur', 'Bar'];

export const FNB_CATEGORIES: DemoCategory[] = [
    { name: 'Kopi', description: 'Kopi Aceh dan kopi susu kekinian', icon: 'coffee', station: 1 },
    { name: 'Non-kopi', description: 'Teh, jus, dan minuman segar', icon: 'local_drink', station: 1 },
    { name: 'Makanan', description: 'Nasi, mie, dan lauk', icon: 'ramen_dining', station: 0 },
    { name: 'Camilan', description: 'Roti, gorengan, dan martabak', icon: 'bakery_dining', station: 0 },
    { name: 'Bahan', description: 'Bahan baku dapur (tidak dijual)', icon: 'kitchen' },
];

/** Option groups (the modifier library). price in IDR. */
export const FNB_MODIFIER_GROUPS: { name: string; min: number; max: number; free?: number; options: { name: string; price?: number; isDefault?: boolean }[] }[] = [
    { name: 'Es / Panas', min: 1, max: 1, options: [{ name: 'Es', isDefault: true }, { name: 'Panas' }] },
    { name: 'Gula', min: 1, max: 1, options: [{ name: 'Normal', isDefault: true }, { name: 'Kurang manis' }, { name: 'Tanpa gula' }] },
    { name: 'Topping', min: 0, max: 2, free: 1, options: [{ name: 'Boba', price: 5000 }, { name: 'Cincau', price: 3000 }, { name: 'Keju', price: 5000 }] },
    { name: 'Level pedas', min: 1, max: 1, options: [{ name: 'Tidak pedas' }, { name: 'Sedang', isDefault: true }, { name: 'Pedas' }, { name: 'Level 3' }] },
    { name: 'Tambahan', min: 0, max: 3, options: [{ name: 'Telur', price: 4000 }, { name: 'Kerupuk', price: 2000 }, { name: 'Ayam suwir', price: 6000 }] },
];

export const FNB_ITEMS: DemoItemDef[] = [
    // Kopi (Bar)
    { name: 'Kopi Sanger', code: 'KOP-001', category: 0, cost: 0, price: 15000, unitOfMeasure: 'Piece', weight: 18, groups: ['Es / Panas', 'Gula'],
      recipe: [{ supply: 'BHN-001', rate: 18, basis: 'perLoad' }, { supply: 'BHN-002', rate: 40, basis: 'perLoad' }] },
    { name: 'Kopi Hitam Aceh', code: 'KOP-002', category: 0, cost: 0, price: 10000, unitOfMeasure: 'Piece', weight: 14, groups: ['Es / Panas', 'Gula'],
      recipe: [{ supply: 'BHN-001', rate: 15, basis: 'perLoad' }] },
    { name: 'Es Kopi Susu Aren', code: 'KOP-003', category: 0, cost: 0, price: 22000, unitOfMeasure: 'Piece', weight: 20, groups: ['Gula', 'Topping'],
      recipe: [{ supply: 'BHN-001', rate: 18, basis: 'perLoad' }, { supply: 'BHN-003', rate: 150, basis: 'perLoad' }, { supply: 'BHN-004', rate: 25, basis: 'perLoad' }] },
    // Non-kopi (Bar)
    { name: 'Teh Tarik', code: 'NKP-001', category: 1, cost: 0, price: 12000, unitOfMeasure: 'Piece', weight: 12, groups: ['Es / Panas', 'Gula'],
      recipe: [{ supply: 'BHN-002', rate: 40, basis: 'perLoad' }] },
    { name: 'Jus Alpukat', code: 'NKP-002', category: 1, cost: 0, price: 18000, unitOfMeasure: 'Piece', weight: 7, groups: ['Gula'] },
    // Makanan (Dapur)
    { name: 'Mie Aceh Goreng', code: 'MKN-001', category: 2, cost: 0, price: 25000, unitOfMeasure: 'Piece', weight: 16, groups: ['Level pedas', 'Tambahan'],
      recipe: [{ supply: 'BHN-005', rate: 150, basis: 'perLoad' }, { supply: 'BHN-006', rate: 1, basis: 'perLoad' }] },
    { name: 'Nasi Goreng Kampung', code: 'MKN-002', category: 2, cost: 0, price: 23000, unitOfMeasure: 'Piece', weight: 15, groups: ['Level pedas', 'Tambahan'],
      recipe: [{ supply: 'BHN-007', rate: 180, basis: 'perLoad' }, { supply: 'BHN-006', rate: 1, basis: 'perLoad' }] },
    { name: 'Ayam Penyet', code: 'MKN-003', category: 2, cost: 0, price: 28000, unitOfMeasure: 'Piece', weight: 10, groups: ['Level pedas'],
      recipe: [{ supply: 'BHN-007', rate: 150, basis: 'perLoad' }] },
    // Camilan (Dapur)
    { name: 'Roti Canai', code: 'CML-001', category: 3, cost: 0, price: 12000, unitOfMeasure: 'Piece', weight: 9 },
    { name: 'Martabak Telur', code: 'CML-002', category: 3, cost: 0, price: 20000, unitOfMeasure: 'Piece', weight: 6,
      recipe: [{ supply: 'BHN-006', rate: 2, basis: 'perLoad' }] },
    // Bahan (supplies: stock-tracked, never sold on their own; cost per unit of measure)
    { name: 'Biji Kopi Arabika Gayo', code: 'BHN-001', category: 4, cost: 260, price: 0, unitOfMeasure: 'Gram', weight: 0, opening: 9000, reorderThreshold: 2000, itemType: 'supply' },
    { name: 'Susu Kental Manis', code: 'BHN-002', category: 4, cost: 32, price: 0, unitOfMeasure: 'Milliliter', weight: 0, opening: 12000, reorderThreshold: 3000, itemType: 'supply' },
    { name: 'Susu Segar', code: 'BHN-003', category: 4, cost: 22, price: 0, unitOfMeasure: 'Milliliter', weight: 0, opening: 20000, reorderThreshold: 5000, itemType: 'supply' },
    { name: 'Gula Aren Cair', code: 'BHN-004', category: 4, cost: 40, price: 0, unitOfMeasure: 'Milliliter', weight: 0, opening: 5000, reorderThreshold: 1000, itemType: 'supply' },
    { name: 'Mie Kuning', code: 'BHN-005', category: 4, cost: 18, price: 0, unitOfMeasure: 'Gram', weight: 0, opening: 15000, reorderThreshold: 3000, itemType: 'supply' },
    { name: 'Telur Ayam', code: 'BHN-006', category: 4, cost: 2200, price: 0, unitOfMeasure: 'Piece', weight: 0, opening: 300, reorderThreshold: 60, itemType: 'supply' },
    { name: 'Beras', code: 'BHN-007', category: 4, cost: 14, price: 0, unitOfMeasure: 'Gram', weight: 0, opening: 25000, reorderThreshold: 5000, itemType: 'supply' },
];

/** Order types an F&B demo sale draws from. */
export const FNB_ORDER_TYPES: { type: string; weight: number }[] = [
    { type: 'Dine-In', weight: 60 },
    { type: 'Take Away', weight: 30 },
    { type: 'Delivery', weight: 10 },
];

/** The floor: areas + tables (logical 1000x700 canvas), markers included. */
export const FNB_FLOOR = {
    areas: ['Dalam', 'Teras'],
    tables: [
        { area: 0, name: '1', x: 80, y: 80, shape: 'round', seats: 2, w: 100, h: 100 },
        { area: 0, name: '2', x: 260, y: 80, shape: 'square', seats: 4, w: 110, h: 110 },
        { area: 0, name: '3', x: 440, y: 80, shape: 'square', seats: 4, w: 110, h: 110 },
        { area: 0, name: '4', x: 80, y: 260, shape: 'round', seats: 2, w: 100, h: 100 },
        { area: 0, name: '5', x: 260, y: 260, shape: 'square', seats: 4, w: 110, h: 110 },
        { area: 0, name: '6', x: 440, y: 260, shape: 'rect', seats: 6, w: 200, h: 100 },
        { area: 0, name: '7', x: 260, y: 440, shape: 'square', seats: 4, w: 110, h: 110 },
        { area: 0, name: '8', x: 80, y: 440, shape: 'round', seats: 2, w: 100, h: 100 },
        { area: 0, name: 'Kasir', x: 760, y: 60, shape: 'marker', seats: 1, w: 160, h: 60 },
        { area: 0, name: 'Dapur', x: 760, y: 160, shape: 'marker', seats: 1, w: 160, h: 80 },
        { area: 0, name: 'Pintu masuk', x: 440, y: 600, shape: 'marker', seats: 1, w: 180, h: 60 },
        { area: 1, name: 'T1', x: 80, y: 80, shape: 'square', seats: 4, w: 110, h: 110 },
        { area: 1, name: 'T2', x: 260, y: 80, shape: 'square', seats: 4, w: 110, h: 110 },
        { area: 1, name: 'T3', x: 440, y: 80, shape: 'rect', seats: 6, w: 200, h: 100 },
    ],
};

