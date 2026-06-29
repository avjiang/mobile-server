# 📋 Panduan Pengisian Data Toko — Bayar Yuk!

Halo! 👋

File Excel ini dipakai untuk memasukkan data toko kamu (kategori, pemasok/supplier, produk, stok awal, dan pelanggan) **sekaligus**, biar nggak perlu input satu-satu di aplikasi.

Ada **2 file**:

| File | Fungsi |
|---|---|
| **`TEMPLATE_KOSONG.xlsx`** | ✅ Ini yang kamu **ISI** lalu kirim balik ke kami. |
| **`CONTOH_TERISI.xlsx`** | 👀 Cuma **CONTOH**, buat lihat bentuk isian yang benar. Jangan dikirim. |

Buka `TEMPLATE_KOSONG.xlsx` pakai **Excel** atau **WPS Office**. Di bagian bawah ada tab sheet: **Kategori, Pemasok, Produk, Varian Produk, Pelanggan**.

> 💡 **Saran:** pakai Excel atau WPS Office di HP/laptop. Kalau buka lewat Google Sheets, daftar pilihan (dropdown) kadang nggak muncul sempurna.

---

## ⚠️ Aturan paling penting (baca dulu ya!)

1. **Judul kolom warna ORANYE = WAJIB diisi.** Warna biru = boleh dikosongkan.
2. **Tulis angka tanpa titik, koma, atau "Rp".**
   - ✅ Benar: `12000`
   - ❌ Salah: `12.000` / `Rp 12.000` / `12,000`
3. **Jangan ubah** nama judul kolom dan nama tab sheet. Cukup isi barisnya.
4. **Isi urut:** Kategori dulu → Pemasok → baru Produk. (Pas isi Produk, kategori & pemasok dipilih dari daftar yang sudah kamu buat. Kalau belum ada, nggak akan muncul.)

---

## Langkah 1 — Isi sheet **Kategori**

Kategori = pengelompokan produk. Contoh: *Tepung & Gula*, *Bahan Tambahan*, *Kemasan*.

- **`nama_kategori`** (wajib) — nama kelompoknya, 1 baris per kategori
- `deskripsi` — penjelasan singkat (boleh kosong)
- `kategori_induk` — kosongkan saja kalau tidak perlu

---

## Langkah 2 — Isi sheet **Pemasok**

Pemasok = tempat kamu kulakan/beli barang.

- **`nama_pemasok`** (wajib) — nama toko/PT pemasok, 1 baris per pemasok
- **`kena_pajak`** (wajib) — pilih **Ya** / **Tidak** dari dropdown
- `kota`, `no_hp`, `email`, dll — isi kalau ada, boleh kosong

> Belum tahu pemasoknya? Buat satu saja — misalnya tulis **nama tokomu sendiri** sebagai pemasok, lalu pilih itu untuk semua produk.

---

## Langkah 3 — Isi sheet **Produk** (bagian utama)

Setiap baris = **1 produk** yang kamu jual.

Kolom dengan **tanda panah kecil** di pojok kanan sel = **dipilih dari daftar (dropdown)**, bukan diketik:

| Kolom dropdown | Pilih dari |
|---|---|
| `nama_kategori` | kategori yang kamu buat di Langkah 1 |
| `nama_pemasok` | pemasok yang kamu buat di Langkah 2 |
| `satuan` | Pcs, Pack, Kg, Gram, Liter, dll |
| `kena_pajak` | Ya / Tidak |
| `punya_varian` | Ya / Tidak |
| `lacak_stok` | Ya / Tidak |

Kolom yang **diketik sendiri**:

- **`nama_produk`** (wajib) — nama lengkap produk.
  💡 Kalau ukurannya beda-beda, tulis ukuran di nama (mis. *Tepung Terigu Segitiga Biru 1kg*, *Gula Pasir 1kg*). **Tiap ukuran = 1 baris produk sendiri.**
- **`kode_produk`** (wajib) — kode unik/SKU tiap produk (bebas, asal beda). Contoh: `TPG-SB-1KG`, `GLA-1KG`.
- **`harga_beli`** (wajib) — harga modal/beli (angka saja)
- **`harga_jual`** (wajib) — harga jual ke pembeli (angka saja)
- `stok_awal` — jumlah stok yang **ada sekarang**. Kosong = 0.
- `barcode` — **kosongkan** kalau belum punya. (Bisa dibuat & dicetak dari aplikasi nanti.)
- `lacak_stok` — **Ya** untuk barang biasa. **Tidak** hanya untuk jasa/layanan yang tidak punya stok.
- `stok_minimum` — batas stok menipis buat pengingat (boleh kosong)

---

## Langkah 4 — Sheet **Varian Produk** (opsional)

Isi **hanya** kalau ada produk yang punya varian (mis. 1 baju beda warna/ukuran) **dan** kamu sudah pilih `punya_varian = Ya` di sheet Produk.

Kalau semua produkmu dijual per kemasan/ukuran terpisah (seperti contoh bahan kue), **biarkan kosong** saja.

---

## Langkah 5 — Sheet **Pelanggan** (opsional)

Kalau punya daftar pelanggan langganan, isi di sini (`nama_depan` & `nama_belakang` wajib). Kalau belum ada, lewati saja.

---

## ✅ Selesai — Kirim balik ke kami

1. Cek lagi: kolom **oranye** sudah terisi semua? Angka tanpa titik/Rp?
2. **Simpan (Save)** tetap dalam format Excel (`.xlsx`).
3. Kirim file `TEMPLATE_KOSONG.xlsx` yang sudah terisi ke kami.

Nanti data tokomu kami masukkan ke sistem **Bayar Yuk!**, lengkap dengan stok awalnya. Kalau ada yang bingung, langsung tanya kami ya 🙂
