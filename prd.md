# PRODUCT REQUIREMENTS DOCUMENT (PRD)
# SmartInventory Gudang - Sistem Manajemen Stok & Inventaris Pergudangan

================================================================================
ZONA ATAS: SPESIFIKASI KEBUTUHAN PRODUK (BLUEPRINT AWAL)
================================================================================

## 1. NAMA PROJEK & PROBLEM STATEMENT
- **Nama Projek:** SmartInventory Gudang
- **Problem Statement:** 
  Pencatatan inventaris pergudangan secara manual atau lembaran fisik sering memicu selisih stok, lambatnya pelacakan keluar-masuk barang dari supplier ke operasional, serta ketiadaan peringatan dini saat barang penting menipis. Pemilik dan Kepala Gudang kesulitan mengontrol mutasi barang secara real-time dari perangkat apapun tanpa biaya infrastruktur server yang mahal.
- **Solusi:**
  Aplikasi web manajemen inventaris gudang berbasis Google Apps Script dan Google Sheets yang responsif (layar HP & PC), memiliki sistem multi-peran (Pemilik, Kepala Gudang, Operator), fitur persetujuan mutasi, deteksi otomatis stok menipis (*Low Stock Alert*), serta ekspor data ke Excel.

---

## 2. PERAN PENGGUNA (USER ROLES)
1. **Pemilik (Owner):**
   - Memantau ringkasan metrik dashboard (Total Item, Total Nilai Aset Stok, Mutasi Masuk/Keluar Bulan Ini).
   - Melihat laporan riwayat transaksi barang masuk dan keluar.
   - Ekspor rekap inventaris dan mutasi ke format Excel (.xlsx / .csv).
2. **Kepala Gudang (Supervisor):**
   - Mengelola data master barang (Tambah, Edit, Nonaktifkan item, atur batas minimal stok).
   - Memverifikasi dan menyetujui (*Approval*) mutasi barang masuk & keluar yang diajukan operator.
   - Memantau peringatan stok menipis dan status perputaran barang.
3. **Operator Lapangan (Staff Gudang):**
   - Menginput transaksi penerimaan Barang Masuk (dari supplier).
   - Menginput transaksi pengeluaran Barang Keluar (untuk operasional/distribusi).
   - Melakukan pencarian instan dan cek ketersediaan stok aktual di rak gudang.

---

## 3. ARSITEKTUR & LINGKUNGAN KERJA
- **Platform:** Google Workspace Ecosystem (Google Apps Script & Google Sheets).
- **Hosting & Backend:** Google Apps Script Web App (Serverless, kuota gratis Google, zero maintenance).
- **Database:** Google Sheets Spreadsheet (Relasional sederhana, multi-tab sheet tanpa underscore).
- **Frontend:** Single Page Application (SPA) modern terintegrasi di `index.html` dengan filosofi Human-Crafted Aesthetic (Anti-AI Design) menggunakan Tailwind CSS via CDN dan Inline SVG Icons.
- **Tipe Arsitektur:** Monolith Terstruktur (3 berkas utama: `code.gs`, `setup.gs`, `index.html`) agar instalasi instan dan mudah dipasang oleh pemula tanpa build step rumit.
- **Viewport:** Responsif Universal (Optimal untuk genggaman ponsel operator lapangan dan monitor desktop PC untuk manajemen).

---

## 4. ALUR KERJA APLIKASI (USER FLOW)
1. **Akses & Inisialisasi:**
   - Pengguna membuka Web App URL. Sistem memuat master data barang ke dalam browser memory cache (*Client-Side In-Memory Cache*).
2. **Katalog & Master Barang:**
   - Kepala Gudang dapat mendaftarkan barang baru. ID otomatis dibuat dengan format `BRG-001`, `BRG-002`, dst.
   - Sistem menampilkan status warna stok: Normal (Hijau), Menipis (Kuning/Oranye jika Stok <= Stok Minimal), dan Kosong (Merah).
3. **Pencatatan Barang Masuk (Supplier -> Gudang):**
   - Operator membuka form "Barang Masuk", sistem mengunci penomoran ID otomatis sekuensial `IN-YYYYMM-XXX`.
   - Operator memilih barang dari dropdown pencarian, memasukkan jumlah masuk, nama supplier, nomor PO/Faktur, dan tanggal terima.
   - Setelah disetujui (atau otomatis approved sesuai role), stok barang di tabel master otomatis bertambah secara real-time.
4. **Pencatatan Barang Keluar (Gudang -> Distribusi/Divisi):**
   - Operator membuka form "Barang Keluar", sistem mengunci penomoran ID otomatis `OUT-YYYYMM-XXX`.
   - Operator memilih barang, memeriksa sisa stok (validasi otomatis: jumlah keluar tidak boleh melebihi stok yang ada).
   - Masukkan nama penerima/divisi dan keperluan. Stok master berkurang seketika setelah approval.
5. **Monitoring & Low Stock Alert:**
   - Halaman Dashboard menampilkan kartu metrik ringkas (Grid 3 kolom) dan tabel peringatan barang yang membutuhkan restock segera.
6. **Ekspor Laporan:**
   - Pengguna dapat mengekspor rekap master stok dan riwayat mutasi ke format CSV/Excel dengan 1 klik.

---

## 5. DESAIN BASIS DATA (GOOGLE SHEETS)
*Catatan Mutlak: Seluruh nama tab sheet TIDAK MENGGUNAKAN karakter underscore (`_`) sesuai standar baku ZettBOT.*

### A. Tab Sheet: `MasterMaterial`
| Kolom | Header Kolom | Tipe Data | Keterangan & Contoh |
| :--- | :--- | :--- | :--- |
| A | `IdMaterial` | String | Kode unik sekuensial (misal: `MAT-001`) |
| B | `NamaMaterial` | String | Nama material (misal: "Plat Besi 2mm x 1.2m x 2.4m") |
| C | `Kategori` | String | Kategori item (misal: "Logam", "Fastener", "Kimia") |
| D | `Satuan` | String | Satuan kuantitas (misal: "Lembar", "Batang", "Box", "Kg") |
| E | `StokSaatIni` | Number | Jumlah stok fisik aktual (misal: `180`) |
| F | `StokMinimal` | Number | Ambang batas peringatan stok menipis (misal: `50`) |
| G | `LokasiRak` | String | Posisi penyimpanan di gudang (misal: "Rak A-01") |
| H | `HargaSatuan` | Number | Estimasi nilai per unit (misal: `285000`) |
| I | `TanggalUpdate`| String | Timestamp pembaruan terakhir (`dd/MM/yyyy HH:mm:ss`) |

### B. Tab Sheet: `MaterialMasuk`
| Kolom | Header Kolom | Tipe Data | Keterangan & Contoh |
| :--- | :--- | :--- | :--- |
| A | `IdTransaksi` | String | Kode sekuensial otomatis (misal: `IN-202611-001`) |
| B | `Tanggal` | String | Tanggal penerimaan (`dd/MM/yyyy`) |
| C | `IdMaterial` | String | Relasi ke IdMaterial (misal: `MAT-001`) |
| D | `NamaMaterial` | String | Nama material tersalin untuk audit |
| E | `JumlahMasuk` | Number | Jumlah kuantitas diterima (misal: `100`) |
| F | `Supplier` | String | Nama pemasok / vendor (misal: "PT Baja Utama Mandiri") |
| G | `NomorFaktur` | String | Nomor referensi dokumen pengiriman/PO |
| H | `Operator` | String | Nama staf penerima di gudang |
| I | `Status` | String | `Approved` atau `Pending` |
| J | `Catatan` | String | Keterangan tambahan transaksi |

### C. Tab Sheet: `MaterialKeluar`
| Kolom | Header Kolom | Tipe Data | Keterangan & Contoh |
| :--- | :--- | :--- | :--- |
| A | `IdTransaksi` | String | Kode sekuensial otomatis (misal: `OUT-202611-001`) |
| B | `Tanggal` | String | Tanggal pengeluaran (`dd/MM/yyyy`) |
| C | `IdMaterial` | String | Relasi ke IdMaterial (misal: `MAT-001`) |
| D | `NamaMaterial` | String | Nama material tersalin |
| E | `JumlahKeluar`| Number | Kuantitas yang dikeluarkan (misal: `20`) |
| F | `Penerima` | String | Nama pemohon / bagian operasional |
| G | `TujuanDivisi`| String | Divisi / proyek penerima (misal: "Divisi Fabrikasi") |
| H | `Operator` | String | Nama staf pengeluar barang |
| I | `Status` | String | `Approved` atau `Pending` |
| J | `Catatan` | String | Keterangan tambahan |

### D. Tab Sheet: `Pengguna`
| Kolom | Header Kolom | Tipe Data | Keterangan & Contoh |
| :--- | :--- | :--- | :--- |
| A | `IdUser` | String | Kode pengguna (misal: `USR-001`) |
| B | `NamaLengkap` | String | Nama pengguna (misal: "Budi Santoso") |
| C | `Role` | String | `Pemilik`, `KepalaGudang`, atau `Operator` |
| D | `PinAkses` | String | PIN 6 digit untuk otentikasi login cepat |
| E | `Status` | String | `Aktif` / `Nonaktif` |

---

## 6. ATURAN VALIDASI & LOGIKA KHUSUS
1. **Penomoran Otomatis Anti-Tabrakan (Unique ID Generator):**
   - Transaksi Barang Masuk: `IN-YYYYMM-XXX` (contoh: `IN-202611-001`).
   - Transaksi Barang Keluar: `OUT-YYYYMM-XXX` (contoh: `OUT-202611-001`).
   - Master Barang: `BRG-XXX` (contoh: `BRG-001`, `BRG-002`).
   - Dihitung dari angka urut tertinggi (`MAX + 1`) pada periode berjalan di database dan dilindungi `LockService.getScriptLock()` untuk mencegah duplikasi multi-user.
2. **Validasi Kuantitas Barang Keluar:**
   - Dilarang memproses Barang Keluar jika `JumlahKeluar > StokSaatIni`. Form otomatis menolak input dan memunculkan pesan peringatan jelas.
3. **Peringatan Stok Rendah (Low Stock Alert):**
   - Jika `StokSaatIni <= StokMinimal`, badge indikator berubah menjadi oranye/merah dan barang otomatis masuk ke daftar "Perlu Restock" di dashboard.
4. **Pencegahan Refresh & Benteng Anti-Macet:**
   - Seluruh form wajib menggunakan `event.preventDefault()`.
   - Tombol submit wajib dilindungi `.withFailureHandler()` yang mengaktifkan kembali tombol jika terjadi galat server.
5. **Indeks Kolom Array Murni (Index-Based Mapping):**
   - Backend membaca data Google Sheets berbasis indeks array angka tetap (`COL.ID_BARANG = 0`, `COL.NAMA = 1`, dst.) menggunakan `getDisplayValues()` agar kebal terhadap perubahan nama header dan distorsi tanggal/timezone.
6. **Eksekusi Penulisan Data Instan:**
   - Seluruh mutasi diakhiri dengan `SpreadsheetApp.flush()`.

---

## 7. RENCANA ANTARMUKA & DESAIN VISUAL (ANTI-AI AESTHETIC)
- **Filosofi Visual:** Clean, Modern & Professional (Human-Crafted Look & Feel).
  * Palet Warna: Slate/Zinc dengan aksen Deep Navy profesional (`#0f172a`), emerald lembut untuk penanda stok aman, dan amber lembut untuk peringatan stok.
  * Ikon: 100% Inline SVG Vektor tajam, tanpa emoji berlebihan pada tombol dan tabel.
  * Tipografi: Sans-serif modern (Inter / System Font), hierarki ukuran yang tegas.
- **Daftar Halaman & Komponen Antarmuka:**
  1. **Top Navbar & Role Indicator:** Menampilkan identitas sistem, peran aktif, serta dropdown ganti profil cepat.
  2. **Dashboard Overview:**
     - Kartu Ringkasan (Grid 3 Kolom): Total SKU Terdaftar, Total Unit Stok, dan Jumlah Item Kritis (Low Stock).
     - Widget Notifikasi Cepat: Daftar 5 barang paling menipis dengan tombol aksi langsung "Catat Masuk".
  3. **Menu Master Barang:**
     - Kotak pencarian instan dan filter kategori.
     - Tabel responsif (fluid typography, wrap baris gendut yang rapi agar data terbaca utuh).
     - Tombol aksi Tambah Barang, Edit Barang, dan Riwayat Mutasi.
  4. **Menu Barang Masuk:**
     - Riwayat penerimaan barang beserta filter rentang tanggal.
     - Modal form Tambah Barang Masuk dengan auto-suggest nama barang dan penomoran otomatis.
  5. **Menu Barang Keluar:**
     - Riwayat pengeluaran barang dan status.
     - Modal form Tambah Barang Keluar dengan indikator sisa stok fisik saat item dipilih.
  6. **Menu Laporan & Ekspor:**
     - Rekap mutasi stok masuk vs keluar.
     - Tombol ekspor ke Excel / CSV tanpa reload.

---

## 8. KRITERIA PENGUJIAN (ACCEPTANCE CRITERIA)
- [ ] Berkas `setup.gs` berhasil dijalankan dan membuat 4 tab sheet (`MasterBarang`, `BarangMasuk`, `BarangKeluar`, `Pengguna`) secara idempoten tanpa menghapus data yang ada.
- [ ] Transaksi Barang Masuk berhasil menambahkan kuantitas `StokSaatIni` di sheet `MasterBarang` seketika (`SpreadsheetApp.flush()`).
- [ ] Transaksi Barang Keluar memvalidasi ketersediaan stok fisik dan mengurangi stok secara akurat.
- [ ] Penomoran otomatis menghasilkan format `BRG-XXX`, `IN-YYYYMM-XXX`, dan `OUT-YYYYMM-XXX` tanpa tabrakan.
- [ ] Badge "Stok Menipis" muncul otomatis ketika kuantitas berada di bawah `StokMinimal`.
- [ ] Tampilan antarmuka nyaman digunakan di layar HP smartphone maupun layar laptop tanpa teks terpotong.
- [ ] Pencarian dan pemfilteran bekerja instan tanpa reload browser.

================================================================================
ZONA BAWAH: MASTER CONTEXT & LOGIKA SISTEM TERKINI (LIVING CONTEXT)
================================================================================

### 1. Status Arsitektur & Lingkungan Aktif
- **Versi Sistem:** v1.0.0 (Kode Sumber Terpasang & Siap Deploy)
- **Status Kode:** Siap Uji & Deploy (`setup.gs`, `code.gs`, `index.html` telah dibuat sesuai SOP).
- **Engine Pembimbing:** ZettBOT Core v4.1 via Antigravity Skill.
- **Mekanisme Penyimpanan:** Google Sheets + Google Apps Script Web App.

### 2. Skema Kolom Database Terkini (Mapping Index Baku)
- **Tab `MasterMaterial`:**
  - `0`: IdMaterial
  - `1`: NamaMaterial
  - `2`: Kategori
  - `3`: Satuan
  - `4`: StokSaatIni
  - `5`: StokMinimal
  - `6`: LokasiRak
  - `7`: HargaSatuan
  - `8`: TanggalUpdate
- **Tab `MaterialMasuk`:**
  - `0`: IdTransaksi
  - `1`: Tanggal
  - `2`: IdMaterial
  - `3`: NamaMaterial
  - `4`: JumlahMasuk
  - `5`: Supplier
  - `6`: NomorFaktur
  - `7`: Operator
  - `8`: Status
  - `9`: Catatan
- **Tab `MaterialKeluar`:**
  - `0`: IdTransaksi
  - `1`: Tanggal
  - `2`: IdMaterial
  - `3`: NamaMaterial
  - `4`: JumlahKeluar
  - `5`: Penerima
  - `6`: TujuanDivisi
  - `7`: Operator
  - `8`: Status
  - `9`: Catatan
- **Tab `Pengguna`:**
  - `0`: IdUser
  - `1`: NamaLengkap
  - `2`: Role
  - `3`: PinAkses
  - `4`: Status

### 3. Logika Bisnis & Formula Hitung Aktif
- **Rumus Penambahan Stok:** `StokSaatIni (baru) = StokSaatIni (lama) + JumlahMasuk`.
- **Rumus Pengurangan Stok:** `StokSaatIni (baru) = StokSaatIni (lama) - JumlahKeluar` (Kondisi: `JumlahKeluar <= StokSaatIni`).
- **Status Stok:**
  - `KOSONG`: jika `StokSaatIni <= 0`
  - `MENIPIS`: jika `StokSaatIni <= StokMinimal` dan `StokSaatIni > 0`
  - `AMAN`: jika `StokSaatIni > StokMinimal`

### 4. Log Pembaruan Resmi
- *2026-11-16:* Inisialisasi PRD Blueprint Awal untuk SmartInventory Gudang berdasarkan wawancara terarah Jalur A.
- *2026-11-16 (Revisi Terminologi - Opsi A):* Mengubah seluruh sebutan 'Barang' menjadi 'Material' di antarmuka pengguna (`index.html`) dan pesan backend (`code.gs`).
- *2026-11-16 (Fitur Keamanan Layar Login PIN):* Menambahkan gerbang login resmi (Login Gate Screen) dengan input PIN 6-digit di awal aplikasi (`index.html`).
- *2026-11-16 (Rombak Total Pilihan 2 - Database Material 100%):* Menyelaraskan nama tab basis data di Google Sheets dan skrip backend (`setup.gs`, `code.gs`) menjadi `MasterMaterial`, `MaterialMasuk`, `MaterialKeluar`, dan `Pengguna`. Kolom diselaraskan menjadi `IdMaterial` & `NamaMaterial`, serta seluruh data dummy terupdate ke sampel material riil.
