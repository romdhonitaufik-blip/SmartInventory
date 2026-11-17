/**
 * SmartInventory Gudang - Sistem Manajemen Stok & Inventaris Material
 * Berkas: setup.gs
 * Fungsi: Inisialisasi basis data Google Sheets secara Idempoten & Non-Destruktif (Safe Migration)
 * Standar: ZettBOT Core v4.1 (by Zettbos)
 */

const SETUP_SHEETS = {
  MASTER_MATERIAL: 'MasterMaterial',
  MATERIAL_MASUK: 'MaterialMasuk',
  MATERIAL_KELUAR: 'MaterialKeluar',
  PENGGUNA: 'Pengguna'
};

/**
 * Jalankan fungsi ini SATU KALI saat pertama kali memasang aplikasi di Google Sheets.
 * Aman dijalankan berulang kali (Safe Migration) karena tidak akan menghapus data riil pengguna.
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Spreadsheet aktif tidak ditemukan. Pastikan script ini terhubung ke file Google Spreadsheet.');
  }

  // 1. Inisialisasi Sheet MasterMaterial
  const headersMaterial = [
    'IdMaterial', 'NamaMaterial', 'Kategori', 'Satuan', 
    'StokSaatIni', 'StokMinimal', 'LokasiRak', 'HargaSatuan', 'TanggalUpdate'
  ];
  const initialDummyMaterial = [
    ['MAT-001', 'Plat Besi 2mm x 1.2m x 2.4m', 'Logam', 'Lembar', 180, 50, 'Rak A-01', 285000, getFormattedDate_()],
    ['MAT-002', 'Pipa Galvanis 2 Inch (6m)', 'Logam', 'Batang', 12, 15, 'Rak A-02', 145000, getFormattedDate_()],
    ['MAT-003', 'Baut Hex M12x50 Baja Hitam', 'Fastener', 'Box', 8, 20, 'Rak A-03', 75000, getFormattedDate_()],
    ['MAT-004', 'Kawat Las E6013 2.6mm', 'Consumables', 'Kg', 25, 10, 'Rak B-01', 35000, getFormattedDate_()],
    ['MAT-005', 'Cat Primer Anti-Karat 20L', 'Kimia', 'Pail', 40, 10, 'Area C-Gudang', 650000, getFormattedDate_()]
  ];
  ensureSheetWithHeaders_(ss, SETUP_SHEETS.MASTER_MATERIAL, headersMaterial, initialDummyMaterial);

  // 2. Inisialisasi Sheet MaterialMasuk
  const headersMasuk = [
    'IdTransaksi', 'Tanggal', 'IdMaterial', 'NamaMaterial', 
    'JumlahMasuk', 'Supplier', 'NomorFaktur', 'Operator', 'Status', 'Catatan'
  ];
  const initialDummyMasuk = [
    ['IN-202611-001', getFormattedDateOnly_(), 'MAT-001', 'Plat Besi 2mm x 1.2m x 2.4m', 100, 'PT Baja Utama Mandiri', 'INV-BUM-8901', 'Operator Gudang', 'Approved', 'Restock material rutin'],
    ['IN-202611-002', getFormattedDateOnly_(), 'MAT-002', 'Pipa Galvanis 2 Inch (6m)', 20, 'CV Steelindo Abadi', 'INV-SA-3312', 'Operator Gudang', 'Approved', 'Material lolos QC']
  ];
  ensureSheetWithHeaders_(ss, SETUP_SHEETS.MATERIAL_MASUK, headersMasuk, initialDummyMasuk);

  // 3. Inisialisasi Sheet MaterialKeluar
  const headersKeluar = [
    'IdTransaksi', 'Tanggal', 'IdMaterial', 'NamaMaterial', 
    'JumlahKeluar', 'Penerima', 'TujuanDivisi', 'Operator', 'Status', 'Catatan'
  ];
  const initialDummyKeluar = [
    ['OUT-202611-001', getFormattedDateOnly_(), 'MAT-001', 'Plat Besi 2mm x 1.2m x 2.4m', 20, 'Dimas', 'Divisi Fabrikasi', 'Operator Gudang', 'Approved', 'Proyek perakitan tangki'],
    ['OUT-202611-002', getFormattedDateOnly_(), 'MAT-003', 'Baut Hex M12x50 Baja Hitam', 12, 'Andi', 'Divisi Assembly', 'Operator Gudang', 'Approved', 'Kebutuhan lini produksi']
  ];
  ensureSheetWithHeaders_(ss, SETUP_SHEETS.MATERIAL_KELUAR, headersKeluar, initialDummyKeluar);

  // 4. Inisialisasi Sheet Pengguna
  const headersPengguna = ['IdUser', 'NamaLengkap', 'Role', 'PinAkses', 'Status'];
  const initialDummyPengguna = [
    ['USR-001', 'Pak Hartanto', 'Pemilik', '123456', 'Aktif'],
    ['USR-002', 'Agus Salim', 'KepalaGudang', '234567', 'Aktif'],
    ['USR-003', 'Rian Hidayat', 'Operator', '345678', 'Aktif']
  ];
  ensureSheetWithHeaders_(ss, SETUP_SHEETS.PENGGUNA, headersPengguna, initialDummyPengguna);

  // Format visual header sheet agar rapi
  formatSheetsVisual_(ss);

  SpreadsheetApp.flush();
  Logger.log('Inisialisasi Database SmartInventory Material Berhasil & Aman (Safe Migration Idempoten).');
  return { success: true, message: 'Database SmartInventory Material berhasil dipersiapkan!' };
}

/**
 * Helper: Memastikan sheet ada, header selaras, dan mengisi data dummy jika sheet baru/kosong.
 */
function ensureSheetWithHeaders_(ss, sheetName, headers, dummyRows) {
  let sheet = ss.getSheetByName(sheetName);
  let isNew = false;

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    isNew = true;
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (isNew || lastRow === 0) {
    // Sheet baru kosong: tulis header dan dummy data
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    if (dummyRows && dummyRows.length > 0) {
      sheet.getRange(2, 1, dummyRows.length, dummyRows[0].length).setValues(dummyRows);
    }
  } else {
    // Sheet sudah ada data (Safe Migration): periksa header kolom
    const existingHeaders = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    
    // Cek kolom baru yang belum ada di spreadsheet riil, tambahkan di posisi paling kanan
    for (let i = 0; i < headers.length; i++) {
      const headerName = headers[i];
      if (!existingHeaders.includes(headerName)) {
        const nextColIndex = sheet.getLastColumn() + 1;
        sheet.getRange(1, nextColIndex).setValue(headerName);
      }
    }
  }
}

/**
 * Helper: Mempercantik tampilan header Google Sheets (warna navy, text tebal, freeze baris atas).
 */
function formatSheetsVisual_(ss) {
  const sheetNames = [
    SETUP_SHEETS.MASTER_MATERIAL,
    SETUP_SHEETS.MATERIAL_MASUK,
    SETUP_SHEETS.MATERIAL_KELUAR,
    SETUP_SHEETS.PENGGUNA
  ];

  sheetNames.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet && sheet.getLastColumn() > 0) {
      const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
      headerRange.setBackground('#0f172a'); // Navy modern
      headerRange.setFontColor('#ffffff');
      headerRange.setFontWeight('bold');
      headerRange.setHorizontalAlignment('center');
      sheet.setFrozenRows(1);
    }
  });
}

function getFormattedDate_() {
  return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd/MM/yyyy HH:mm:ss');
}

function getFormattedDateOnly_() {
  return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd/MM/yyyy');
}
