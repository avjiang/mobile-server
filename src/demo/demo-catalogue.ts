/**
 * Demo catalogue definitions — the "shop" each demo tenant is stocked with.
 *
 * Split out of demo-seed.service.ts so the seed logic stays readable; this file is
 * pure data. Prices are in IDR (whole rupiah, no minor unit). `weight` biases how
 * often an item is picked at sale time — a warung sells far more Air Mineral than
 * Beras, and a flat distribution makes the demo's top-items chart look fake.
 */

export type DemoVertical = 'retail' | 'laundry';

export interface DemoCategory {
    name: string;
    description: string;
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
    { name: 'Cuci Kiloan', description: 'Layanan cuci per muatan mesin' },
    { name: 'Cuci Satuan', description: 'Selimut, bed cover, dan barang besar' },
    { name: 'Jasa Lainnya', description: 'Setrika, cuci sepatu, dan cuci tas' },
    { name: 'Layanan Ekspres', description: 'Selesai di hari yang sama' },
    { name: 'Perlengkapan', description: 'Deterjen, pewangi, dan kemasan' },
];

/**
 * Laundry. `defaultLoadWeightKg` is what separates a **wash** service (counts as a
 * "muatan"/load and contributes kg to laundryOps) from **jasa** (ironing, shoes, bags)
 * — report.service keys off `defaultLoadWeightKg !== null` exactly. Supplies
 * (`itemType: 'supply'`) are stocked but never sold as lines; they exist so Stock
 * Management and the supply screens have something real in them.
 */
export const LAUNDRY_ITEMS: DemoItemDef[] = [
    // Wash services — carry defaultLoadWeightKg.
    { name: 'Cuci Kering Lipat', code: 'CKL-006', category: 0, cost: 14000, price: 42000, unitOfMeasure: 'Piece', weight: 26, itemType: 'service', defaultLoadWeightKg: 6, maxQty: 1 },
    { name: 'Cuci Kering Setrika', code: 'CKS-006', category: 0, cost: 18000, price: 54000, unitOfMeasure: 'Piece', weight: 24, itemType: 'service', defaultLoadWeightKg: 6, includesIroning: true, maxQty: 1 },
    { name: 'Cuci Ekspres 6 Jam', code: 'EXP-006', category: 3, cost: 22000, price: 72000, unitOfMeasure: 'Piece', weight: 8, itemType: 'service', defaultLoadWeightKg: 6, includesIroning: true, maxQty: 1 },
    { name: 'Cuci Selimut', code: 'SAT-001', category: 1, cost: 15000, price: 45000, unitOfMeasure: 'Piece', weight: 7, itemType: 'service', defaultLoadWeightKg: 4, maxQty: 1 },
    { name: 'Cuci Bed Cover', code: 'SAT-002', category: 1, cost: 19000, price: 55000, unitOfMeasure: 'Piece', weight: 6, itemType: 'service', defaultLoadWeightKg: 5, maxQty: 1 },

    // Jasa — no defaultLoadWeightKg, so they never inflate kg/loads.
    { name: 'Setrika Saja (per kg)', code: 'JSA-001', category: 2, cost: 2500, price: 8000, unitOfMeasure: 'Kilogram', weight: 14, itemType: 'service', maxQty: 6 },
    { name: 'Cuci Sepatu', code: 'JSA-002', category: 2, cost: 12000, price: 35000, unitOfMeasure: 'Piece', weight: 8, itemType: 'service', maxQty: 2 },
    { name: 'Cuci Tas', code: 'JSA-003', category: 2, cost: 14000, price: 40000, unitOfMeasure: 'Piece', weight: 5, itemType: 'service', maxQty: 2 },

    // Supplies — stocked master data, never sold.
    { name: 'Deterjen Cair', code: 'SUP-001', category: 4, cost: 45, price: 0, unitOfMeasure: 'Milliliter', weight: 0, opening: 20000, reorderThreshold: 5000, itemType: 'supply' },
    { name: 'Pewangi Pakaian', code: 'SUP-002', category: 4, cost: 38, price: 0, unitOfMeasure: 'Milliliter', weight: 0, opening: 15000, reorderThreshold: 4000, itemType: 'supply' },
    { name: 'Pemutih Pakaian', code: 'SUP-003', category: 4, cost: 30, price: 0, unitOfMeasure: 'Milliliter', weight: 0, opening: 8000, reorderThreshold: 2000, itemType: 'supply' },
    { name: 'Plastik Kemasan', code: 'SUP-004', category: 4, cost: 900, price: 0, unitOfMeasure: 'Piece', weight: 0, opening: 500, reorderThreshold: 100, itemType: 'supply' },
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
 * payment breakdown chart has more than one slice in it.
 */
export const PAYMENT_MIX: { method: string; weight: number }[] = [
    { method: 'Cash', weight: 55 },
    { method: 'E-Wallet', weight: 25 },
    { method: 'Bank Transfer', weight: 14 },
    { method: 'Card', weight: 6 },
];
