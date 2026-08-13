#!/usr/bin/env node

/**
 * Generate the Indonesian, tenant-facing onboarding template (Retail).
 *
 * Produces TWO files in templates/:
 *   - TEMPLATE_KOSONG.xlsx  — headers + dropdowns, NO example rows. Send this to
 *                             the tenant to fill. (No example rows = nothing to
 *                             forget to delete, so no junk gets imported.)
 *   - CONTOH_TERISI.xlsx     — the same template pre-filled with a bahan-kue
 *                             example (Model B: each pack size is its own item).
 *                             Reference only — do NOT import this one.
 *
 * Uses exceljs (not the `xlsx` community build) because only exceljs reliably
 * WRITES data-validation dropdowns. The dropdowns are what keep category /
 * supplier references valid and typo-free.
 *
 * Tab + header names are Indonesian; the parser (src/parser.js) maps them back
 * to the canonical fields via SHEET_ALIASES + COLUMN_MAPPINGS.
 *
 * Usage: npm run generate-template-id
 */

import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_ROWS = 200;                 // blank entry rows
const LAST = DATA_ROWS + 1;            // last data row (1 header + 200)
const FILL_REQ = 'FFC55A11';           // orange = required
const FILL_OPT = 'FF1F4E78';           // blue = optional
const UOM = 'Pcs,Pack,Kg,Gram,Liter,ml,Box,Lusin,Set,Pasang,Meter';
const ATTR = 'Color,Size,Material,Style,Weight';
const YN = 'Ya,Tidak';

// header, required?, width
const SHEETS = {
  Kategori: [
    ['nama_kategori', true, 22], ['deskripsi', false, 30], ['kategori_induk', false, 20],
  ],
  Pemasok: [
    ['nama_pemasok', true, 26], ['kota', false, 16], ['provinsi', false, 16],
    ['negara', false, 14], ['nama_pic', false, 18], ['no_hp', false, 18],
    ['email', false, 24], ['kena_pajak', true, 12], ['catatan', false, 22],
  ],
  Produk: [
    ['nama_produk', true, 34], ['kode_produk', true, 16], ['nama_kategori', true, 20],
    ['nama_pemasok', true, 22], ['harga_beli', true, 12], ['harga_jual', true, 12],
    ['stok_awal', false, 12], ['satuan', false, 12], ['barcode', false, 18],
    ['merek', false, 16], ['kena_pajak', false, 11], ['punya_varian', false, 13],
    ['lacak_stok', false, 12], ['stok_minimum', false, 13],
  ],
  'Varian Produk': [
    ['kode_produk_induk', true, 18], ['kode_varian', true, 18], ['nama_varian', true, 18],
    ['harga_beli', false, 12], ['harga_jual', false, 12], ['stok_awal', false, 12],
    ['barcode', false, 16], ['tipe_atribut_1', false, 14], ['nilai_atribut_1', false, 14],
    ['tipe_atribut_2', false, 14], ['nilai_atribut_2', false, 14],
  ],
  // Extra suppliers per product (Pro only). The main supplier stays on the Produk tab —
  // this tab lists ONLY the additional ones, so a tenant with a single supplier per
  // product never has to touch it and older filled templates still import unchanged.
  'Pemasok Produk': [
    ['kode_produk', true, 18], ['nama_pemasok', true, 26],
    ['kode_produk_pemasok', false, 20], ['harga_beli', false, 14],
    ['lead_time_hari', false, 14],
  ],
  Pelanggan: [
    ['nama_depan', true, 16], ['nama_belakang', true, 16], ['no_hp', false, 18],
    ['email', false, 24], ['kota', false, 16],
  ],
};

const EXAMPLES = {
  Kategori: [
    ['Tepung & Gula', 'Bahan pokok kue', ''],
    ['Bahan Tambahan', 'Ragi, perasa, pengembang', ''],
    ['Kemasan', 'Dus, mika, cup kue', ''],
  ],
  Pemasok: [
    ['PT Bogasari Mitra', 'Jakarta', 'DKI Jakarta', 'Indonesia', 'Sari', '+628123456789', 'sari@bogasari.co.id', 'Ya', ''],
    ['CV Sumber Rejeki', 'Bandung', 'Jawa Barat', 'Indonesia', 'Budi', '+628987654321', 'budi@sumberrejeki.co.id', 'Tidak', 'Pemasok cadangan'],
  ],
  Produk: [
    ['Tepung Terigu Segitiga Biru 1kg', 'TPG-SB-1KG', 'Tepung & Gula', 'PT Bogasari Mitra', 12000, 14000, 50, 'Pack', '2000000000018', 'Segitiga Biru', 'Tidak', 'Tidak', 'Ya', 10],
    ['Gula Pasir 1kg', 'GLA-1KG', 'Tepung & Gula', 'PT Bogasari Mitra', 13000, 15000, 40, 'Pack', '', 'Gulaku', 'Tidak', 'Tidak', 'Ya', 10],
    ['Ragi Instan Fermipan 11g', 'RAG-11G', 'Bahan Tambahan', 'PT Bogasari Mitra', 4000, 6000, 100, 'Pcs', '', 'Fermipan', 'Tidak', 'Tidak', 'Ya', 20],
  ],
  'Varian Produk': [],
  'Pemasok Produk': [
    ['TPG-SB-1KG', 'CV Sumber Rejeki', 'SR-TERIGU-1', 12500, 3],
    ['GLA-1KG', 'CV Sumber Rejeki', 'SR-GULA-1', 13200, 3],
  ],
  Pelanggan: [
    ['Andi', 'Wijaya', '+628111222333', 'andi@mail.com', 'Jakarta'],
  ],
};

// col index (1-based) -> dropdown formula, per sheet
const DROPDOWNS = {
  Produk: {
    3: `Kategori!$A$2:$A$${LAST}`,    // nama_kategori
    4: `Pemasok!$A$2:$A$${LAST}`,     // nama_pemasok
    8: `"${UOM}"`,                    // satuan
    11: `"${YN}"`,                    // kena_pajak
    12: `"${YN}"`,                    // punya_varian
    13: `"${YN}"`,                    // lacak_stok
  },
  Pemasok: {
    8: `"${YN}"`,                     // kena_pajak
  },
  'Pemasok Produk': {
    1: `Produk!$B$2:$B$${LAST}`,      // kode_produk
    2: `Pemasok!$A$2:$A$${LAST}`,     // nama_pemasok
  },
  'Varian Produk': {
    1: `Produk!$B$2:$B$${LAST}`,      // kode_produk_induk
    8: `"${ATTR}"`,                   // tipe_atribut_1
    10: `"${ATTR}"`,                  // tipe_atribut_2
  },
};

function colLetter(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; }
  return s;
}

function buildWorkbook(withExamples) {
  const wb = new ExcelJS.Workbook();

  for (const [sheetName, cols] of Object.entries(SHEETS)) {
    const ws = wb.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 1 }] });

    cols.forEach(([header, required, width], i) => {
      const col = ws.getColumn(i + 1);
      col.width = width;
      const cell = ws.getCell(1, i + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: required ? FILL_REQ : FILL_OPT } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    if (withExamples) {
      (EXAMPLES[sheetName] || []).forEach((row, r) => {
        row.forEach((val, c) => {
          const cell = ws.getCell(r + 2, c + 1);
          cell.value = val;
          cell.font = { italic: true, color: { argb: 'FF9C5700' } };
        });
      });
    }

    // Apply dropdowns to the full data range (rows 2..LAST)
    const dvs = DROPDOWNS[sheetName] || {};
    for (const [colIdx, formula] of Object.entries(dvs)) {
      const letter = colLetter(parseInt(colIdx));
      for (let r = 2; r <= LAST; r++) {
        ws.getCell(`${letter}${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [formula],
          showErrorMessage: true,
          errorStyle: 'warning',
          errorTitle: 'Tidak valid',
          error: 'Pilih nilai dari daftar.',
        };
      }
    }
  }
  return wb;
}

const outDir = path.join(__dirname, '..', 'templates');
const targets = [
  ['TEMPLATE_KOSONG.xlsx', false],
  ['CONTOH_TERISI.xlsx', true],
];

for (const [name, withExamples] of targets) {
  const wb = buildWorkbook(withExamples);
  const out = path.join(outDir, name);
  await wb.xlsx.writeFile(out);
  console.log(`✅ ${name} -> ${out}`);
}

console.log('\nKirim TEMPLATE_KOSONG.xlsx ke tenant untuk diisi.');
console.log('CONTOH_TERISI.xlsx hanya sebagai contoh — jangan diimpor.');
