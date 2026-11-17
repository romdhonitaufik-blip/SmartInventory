/**
 * SmartInventory Gudang - Sistem Manajemen Stok & Inventaris Pergudangan
 * Berkas: code.gs
 * Fungsi: Backend Controller, REST / RPC API, Business Logic, Database Mutation
 * Standar: ZettBOT Core v4.1 (by Zettbos)
 */

const APP_CONFIG = {
  TITLE: 'SmartInventory Gudang',
  TIMEZONE: 'Asia/Jakarta'
};

const SHEETS = {
  MASTER_MATERIAL: 'MasterMaterial',
  MATERIAL_MASUK: 'MaterialMasuk',
  MATERIAL_KELUAR: 'MaterialKeluar',
  PENGGUNA: 'Pengguna'
};

// Pemetaan Indeks Kolom Array 0-based (Index-Based Mapping)
// Mencegah bug string header name sensitivity
const COL_BARANG = {
  ID: 0,
  NAMA: 1,
  KATEGORI: 2,
  SATUAN: 3,
  STOK: 4,
  MIN_STOK: 5,
  RAK: 6,
  HARGA: 7,
  UPDATED: 8
};

const COL_MASUK = {
  ID: 0,
  TANGGAL: 1,
  ID_BARANG: 2,
  NAMA: 3,
  JUMLAH: 4,
  SUPPLIER: 5,
  NO_FAKTUR: 6,
  OPERATOR: 7,
  STATUS: 8,
  CATATAN: 9
};

const COL_KELUAR = {
  ID: 0,
  TANGGAL: 1,
  ID_BARANG: 2,
  NAMA: 3,
  JUMLAH: 4,
  PENERIMA: 5,
  DIVISI: 6,
  OPERATOR: 7,
  STATUS: 8,
  CATATAN: 9
};

const COL_USER = {
  ID: 0,
  NAMA: 1,
  ROLE: 2,
  PIN: 3,
  STATUS: 4
};

/**
 * Entry point Web App
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle(APP_CONFIG.TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Mengambil seluruh data awal untuk Client-Side In-Memory Cache
 */
function getInitialData() {
  const ss = getSpreadsheet_();
  
  // Ambil data menggunakan getDisplayValues() murni agar kebal distorsi timezone
  const dataBarang = getSheetDisplayData_(ss, SHEETS.MASTER_MATERIAL, COL_BARANG);
  const dataMasuk = getSheetDisplayData_(ss, SHEETS.MATERIAL_MASUK, COL_MASUK);
  const dataKeluar = getSheetDisplayData_(ss, SHEETS.MATERIAL_KELUAR, COL_KELUAR);
  const dataUser = getSheetDisplayData_(ss, SHEETS.PENGGUNA, COL_USER);

  return {
    success: true,
    data: {
      barang: dataBarang,
      masuk: dataMasuk,
      keluar: dataKeluar,
      pengguna: dataUser.map(u => ({
        id: u.ID,
        nama: u.NAMA,
        role: u.ROLE,
        status: u.STATUS
      })) // Hindari kirim PIN ke client
    }
  };
}

/**
 * Autentikasi Pengguna via PIN 6-digit
 */
function verifikasiPin(pin) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(SHEETS.PENGGUNA);
  if (!sheet || sheet.getLastRow() <= 1) {
    return { success: false, message: 'Data pengguna belum tersedia di sistem.' };
  }

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getDisplayValues();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[COL_USER.PIN]).trim() === String(pin).trim()) {
      if (row[COL_USER.STATUS] !== 'Aktif') {
        return { success: false, message: 'Akun Anda dinonaktifkan oleh administrator.' };
      }
      return {
        success: true,
        user: {
          id: row[COL_USER.ID],
          nama: row[COL_USER.NAMA],
          role: row[COL_USER.ROLE]
        }
      };
    }
  }
  return { success: false, message: 'PIN yang Anda masukkan tidak sesuai.' };
}

/**
 * Simpan atau Perbarui Data Master Barang
 */
function simpanBarang(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // Kunci 10 detik agar anti-race condition
    const ss = getSpreadsheet_();
    let sheet = ss.getSheetByName(SHEETS.MASTER_MATERIAL);
    if (!sheet) {
      setupDatabase();
      sheet = ss.getSheetByName(SHEETS.MASTER_MATERIAL);
    }

    const lastRow = sheet.getLastRow();
    const rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getDisplayValues() : [];
    const nowStr = Utilities.formatDate(new Date(), APP_CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm:ss');

    let targetRowIndex = -1;
    let itemId = data.id;

    if (itemId) {
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][COL_BARANG.ID] === itemId) {
          targetRowIndex = i + 2; // Offset header baris ke-1
          break;
        }
      }
    }

    if (targetRowIndex > 0) {
      // Mode Edit: Update kolom barang
      sheet.getRange(targetRowIndex, COL_BARANG.NAMA + 1).setValue(data.nama);
      sheet.getRange(targetRowIndex, COL_BARANG.KATEGORI + 1).setValue(data.kategori);
      sheet.getRange(targetRowIndex, COL_BARANG.SATUAN + 1).setValue(data.satuan);
      sheet.getRange(targetRowIndex, COL_BARANG.MIN_STOK + 1).setValue(Number(data.minStok) || 0);
      sheet.getRange(targetRowIndex, COL_BARANG.RAK + 1).setValue(data.lokasiRak || '-');
      sheet.getRange(targetRowIndex, COL_BARANG.HARGA + 1).setValue(Number(data.harga) || 0);
      sheet.getRange(targetRowIndex, COL_BARANG.UPDATED + 1).setValue(nowStr);
    } else {
      // Mode Tambah Baru: Buat ID unik sekuensial MAT-XXX
      itemId = generateSequentialId_(rows, COL_BARANG.ID, 'MAT-', 3);
      const newRow = [
        itemId,
        data.nama,
        data.kategori,
        data.satuan,
        Number(data.stokAwal) || 0,
        Number(data.minStok) || 0,
        data.lokasiRak || '-',
        Number(data.harga) || 0,
        nowStr
      ];
      sheet.appendRow(newRow);
    }

    SpreadsheetApp.flush(); // Paksa tulis instan ke spreadsheet
    return { success: true, message: 'Data master material berhasil disimpan!', id: itemId };
  } catch (err) {
    return { success: false, message: 'Gagal menyimpan material: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Transaksi Material Masuk (Restock / Supplier -> Gudang)
 */
function simpanBarangMasuk(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = getSpreadsheet_();
    const sheetMasuk = ss.getSheetByName(SHEETS.MATERIAL_MASUK);
    const sheetBarang = ss.getSheetByName(SHEETS.MASTER_MATERIAL);

    if (!sheetMasuk || !sheetBarang) {
      throw new Error('Tab sheet tidak ditemukan. Jalankan setup terlebih dahulu.');
    }

    // 1. Validasi & Cari Material di Master
    const lastRowBarang = sheetBarang.getLastRow();
    if (lastRowBarang <= 1) {
      throw new Error('Data master material masih kosong.');
    }
    const rowsBarang = sheetBarang.getRange(2, 1, lastRowBarang - 1, sheetBarang.getLastColumn()).getDisplayValues();
    
    let rowIndexBarang = -1;
    let stokLama = 0;
    let namaBarang = data.namaBarang;

    for (let i = 0; i < rowsBarang.length; i++) {
      if (rowsBarang[i][COL_BARANG.ID] === data.idBarang) {
        rowIndexBarang = i + 2;
        stokLama = Number(rowsBarang[i][COL_BARANG.STOK]) || 0;
        namaBarang = rowsBarang[i][COL_BARANG.NAMA];
        break;
      }
    }

    if (rowIndexBarang === -1) {
      throw new Error('Material dengan kode ' + data.idBarang + ' tidak ditemukan.');
    }

    const jumlahMasuk = Number(data.jumlahMasuk);
    if (!jumlahMasuk || jumlahMasuk <= 0) {
      throw new Error('Jumlah material masuk harus lebih dari 0.');
    }

    // 2. Generate ID Transaksi IN-YYYYMM-XXX
    const lastRowMasuk = sheetMasuk.getLastRow();
    const rowsMasuk = lastRowMasuk > 1 ? sheetMasuk.getRange(2, 1, lastRowMasuk - 1, sheetMasuk.getLastColumn()).getDisplayValues() : [];
    const datePrefix = Utilities.formatDate(new Date(), APP_CONFIG.TIMEZONE, 'yyyyMM');
    const fullPrefix = 'IN-' + datePrefix + '-';
    const newTrxId = generateSequentialId_(rowsMasuk, COL_MASUK.ID, fullPrefix, 3);

    const tglMasuk = data.tanggal || Utilities.formatDate(new Date(), APP_CONFIG.TIMEZONE, 'dd/MM/yyyy');
    const nowStr = Utilities.formatDate(new Date(), APP_CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm:ss');

    // 3. Catat Riwayat di BarangMasuk
    const rowMasuk = [
      newTrxId,
      tglMasuk,
      data.idBarang,
      namaBarang,
      jumlahMasuk,
      data.supplier || '-',
      data.nomorFaktur || '-',
      data.operator || 'Operator Gudang',
      data.status || 'Approved',
      data.catatan || '-'
    ];
    sheetMasuk.appendRow(rowMasuk);

    // 4. Update Stok di MasterBarang
    const stokBaru = stokLama + jumlahMasuk;
    sheetBarang.getRange(rowIndexBarang, COL_BARANG.STOK + 1).setValue(stokBaru);
    sheetBarang.getRange(rowIndexBarang, COL_BARANG.UPDATED + 1).setValue(nowStr);

    SpreadsheetApp.flush();
    return {
      success: true,
      message: 'Material masuk berhasil dicatat! Stok terupdate menjadi ' + stokBaru + '.',
      trxId: newTrxId,
      stokBaru: stokBaru
    };
  } catch (err) {
    return { success: false, message: 'Gagal catat material masuk: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Transaksi Material Keluar (Gudang -> Distribusi/Divisi)
 */
function simpanBarangKeluar(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = getSpreadsheet_();
    const sheetKeluar = ss.getSheetByName(SHEETS.MATERIAL_KELUAR);
    const sheetBarang = ss.getSheetByName(SHEETS.MASTER_MATERIAL);

    if (!sheetKeluar || !sheetBarang) {
      throw new Error('Tab sheet tidak ditemukan. Jalankan setup terlebih dahulu.');
    }

    // 1. Validasi & Cek Stok Aktual
    const lastRowBarang = sheetBarang.getLastRow();
    if (lastRowBarang <= 1) {
      throw new Error('Data master material masih kosong.');
    }
    const rowsBarang = sheetBarang.getRange(2, 1, lastRowBarang - 1, sheetBarang.getLastColumn()).getDisplayValues();
    
    let rowIndexBarang = -1;
    let stokLama = 0;
    let namaBarang = data.namaBarang;

    for (let i = 0; i < rowsBarang.length; i++) {
      if (rowsBarang[i][COL_BARANG.ID] === data.idBarang) {
        rowIndexBarang = i + 2;
        stokLama = Number(rowsBarang[i][COL_BARANG.STOK]) || 0;
        namaBarang = rowsBarang[i][COL_BARANG.NAMA];
        break;
      }
    }

    if (rowIndexBarang === -1) {
      throw new Error('Material dengan kode ' + data.idBarang + ' tidak ditemukan.');
    }

    const jumlahKeluar = Number(data.jumlahKeluar);
    if (!jumlahKeluar || jumlahKeluar <= 0) {
      throw new Error('Jumlah material keluar harus lebih dari 0.');
    }

    // Cek kecukupan stok fisik (Kritis untuk konsistensi data)
    if (jumlahKeluar > stokLama) {
      throw new Error('Stok tidak mencukupi! Sisa stok fisik saat ini hanya ' + stokLama + ' unit.');
    }

    // 2. Generate ID Transaksi OUT-YYYYMM-XXX
    const lastRowKeluar = sheetKeluar.getLastRow();
    const rowsKeluar = lastRowKeluar > 1 ? sheetKeluar.getRange(2, 1, lastRowKeluar - 1, sheetKeluar.getLastColumn()).getDisplayValues() : [];
    const datePrefix = Utilities.formatDate(new Date(), APP_CONFIG.TIMEZONE, 'yyyyMM');
    const fullPrefix = 'OUT-' + datePrefix + '-';
    const newTrxId = generateSequentialId_(rowsKeluar, COL_KELUAR.ID, fullPrefix, 3);

    const tglKeluar = data.tanggal || Utilities.formatDate(new Date(), APP_CONFIG.TIMEZONE, 'dd/MM/yyyy');
    const nowStr = Utilities.formatDate(new Date(), APP_CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm:ss');

    // 3. Catat Riwayat di BarangKeluar
    const rowKeluar = [
      newTrxId,
      tglKeluar,
      data.idBarang,
      namaBarang,
      jumlahKeluar,
      data.penerima || '-',
      data.tujuanDivisi || '-',
      data.operator || 'Operator Gudang',
      data.status || 'Approved',
      data.catatan || '-'
    ];
    sheetKeluar.appendRow(rowKeluar);

    // 4. Potong Stok di MasterBarang
    const stokBaru = stokLama - jumlahKeluar;
    sheetBarang.getRange(rowIndexBarang, COL_BARANG.STOK + 1).setValue(stokBaru);
    sheetBarang.getRange(rowIndexBarang, COL_BARANG.UPDATED + 1).setValue(nowStr);

    SpreadsheetApp.flush();
    return {
      success: true,
      message: 'Material keluar berhasil dicatat! Sisa stok ' + stokBaru + '.',
      trxId: newTrxId,
      stokBaru: stokBaru
    };
  } catch (err) {
    return { success: false, message: 'Gagal catat material keluar: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Hapus Master Material secara Aman
 */
function hapusBarang(idBarang) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = getSpreadsheet_();
    const sheet = ss.getSheetByName(SHEETS.MASTER_MATERIAL);
    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: false, message: 'Data material tidak ditemukan.' };
    }

    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getDisplayValues();
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][COL_BARANG.ID] === idBarang) {
        sheet.deleteRow(i + 2);
        SpreadsheetApp.flush();
        return { success: true, message: 'Material ' + idBarang + ' berhasil dihapus.' };
      }
    }
    return { success: false, message: 'Material tidak ditemukan.' };
  } catch (err) {
    return { success: false, message: 'Gagal menghapus: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper: Ambil referensi spreadsheet
 */
function getSpreadsheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Spreadsheet aktif tidak ditemukan. Pastikan script ini terhubung ke file Google Spreadsheet.');
  }
  return ss;
}

/**
 * Helper: Membaca baris data sheet menjadi array of object berbasis index mapping
 */
function getSheetDisplayData_(ss, sheetName, colMapping) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return [];

  const rawValues = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getDisplayValues();
  return rawValues.map(row => {
    const item = {};
    for (const key in colMapping) {
      const idx = colMapping[key];
      item[key] = row[idx] !== undefined ? row[idx] : '';
    }
    return item;
  });
}

/**
 * Helper: Generator ID Sekuensial Anti-Tabrakan berbasis MAX ID
 */
function generateSequentialId_(rows, idColIndex, prefix, paddingLength) {
  let maxSeq = 0;
  for (let i = 0; i < rows.length; i++) {
    const currentId = String(rows[i][idColIndex] || '').trim();
    if (currentId.startsWith(prefix)) {
      const seqPart = currentId.substring(prefix.length);
      const seqNum = parseInt(seqPart, 10);
      if (!isNaN(seqNum) && seqNum > maxSeq) {
        maxSeq = seqNum;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  let seqStr = String(nextSeq);
  while (seqStr.length < paddingLength) {
    seqStr = '0' + seqStr;
  }
  return prefix + seqStr;
}
