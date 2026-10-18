/**
 * Lapisan akses Google Sheets.
 *
 * Dua perkara yang Sheets tiada dan kena dibina sendiri di sini:
 *   1. Transaksi — dua tulisan serentak boleh merosakkan data.
 *      Setiap operasi tulis dibalut dgnKunci().
 *   2. Row Level Security — tiada konsep "baris ini hanya untuk kelas X".
 *      Penapisan ikut kelas/sekolah dibuat dalam kod sebelum data keluar.
 */

function _ss() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  var aktif = SpreadsheetApp.getActiveSpreadsheet();
  if (!aktif) throw Ralat('SPREADSHEET_ID belum ditetapkan dalam Script Properties.');
  return aktif;
}

function _helaian(nama) {
  var sh = _ss().getSheetByName(nama);
  if (!sh) throw Ralat('Helaian "' + nama + '" tiada. Jalankan pasang() dahulu.');
  return sh;
}

/** Formula injection: =, +, -, @ ditafsir sebagai formula oleh Sheets/Excel. */
function bersihUntukSheet(nilai) {
  if (nilai === null || nilai === undefined) return '';
  if (typeof nilai === 'boolean' || typeof nilai === 'number') return nilai;
  if (nilai instanceof Date) return nilai;
  var s = String(nilai);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s;
}

function bersihTeks(nilai, panjangMaks) {
  if (nilai === null || nilai === undefined) return '';
  var s = String(nilai).replace(/[\x00-\x1F\x7F]/g, '').trim();
  var had = panjangMaks || PANJANG_TEKS_MAKS;
  return s.length > had ? s.substring(0, had) : s;
}

/** Nombor dari sel Sheets yang mungkin teks, kosong, atau ada "RM". */
function keNombor(nilai) {
  if (nilai === null || nilai === undefined || nilai === '') return null;
  if (typeof nilai === 'number') return isFinite(nilai) ? nilai : null;
  var s = String(nilai).replace(/[^0-9.\-]/g, '');
  if (s === '' || s === '-' || s === '.') return null;
  var n = Number(s);
  return isFinite(n) ? n : null;
}

function dgnKunci(fn) {
  var kunci = LockService.getScriptLock();
  if (!kunci.tryLock(25000)) throw Ralat('Sistem sedang sibuk. Cuba lagi sebentar.');
  try { return fn(); } finally { kunci.releaseLock(); }
}

function bacaSemua(nama) {
  var sh = _helaian(nama);
  var baris = sh.getLastRow();
  if (baris < 2) return [];
  var kepala = LAJUR[nama];
  var nilai = sh.getRange(2, 1, baris - 1, kepala.length).getValues();
  return nilai.map(function (r, i) {
    var o = { _baris: i + 2 };
    for (var c = 0; c < kepala.length; c++) o[kepala[c]] = r[c];
    return o;
  });
}

/** Cari satu baris mengikut nilai lajur. TextFinder supaya tak baca 1,400 baris. */
function cariBaris(nama, namaLajur, nilai) {
  var sh = _helaian(nama);
  var kepala = LAJUR[nama];
  var idx = kepala.indexOf(namaLajur);
  if (idx < 0) throw Ralat('Lajur tidak dikenali: ' + namaLajur);
  var akhir = sh.getLastRow();
  if (akhir < 2) return null;
  var jumpa = sh.getRange(2, idx + 1, akhir - 1, 1)
    .createTextFinder(String(nilai)).matchEntireCell(true).matchCase(true).findNext();
  if (!jumpa) return null;
  var baris = jumpa.getRow();
  var nilaiBaris = sh.getRange(baris, 1, 1, kepala.length).getValues()[0];
  var o = { _baris: baris };
  for (var c = 0; c < kepala.length; c++) o[kepala[c]] = nilaiBaris[c];
  return o;
}

function tambahBaris(nama, objek) {
  var sh = _helaian(nama);
  sh.appendRow(LAJUR[nama].map(function (k) { return bersihUntukSheet(objek[k]); }));
  return sh.getLastRow();
}

/**
 * Tambah banyak baris dalam SATU panggilan setValues.
 * appendRow() satu-satu untuk 1,400 murid akan melebihi had masa Apps Script.
 */
function tambahBanyakBaris(nama, senarai) {
  if (!senarai.length) return 0;
  var sh = _helaian(nama);
  var kepala = LAJUR[nama];
  var matriks = senarai.map(function (o) {
    return kepala.map(function (k) { return bersihUntukSheet(o[k]); });
  });
  sh.getRange(sh.getLastRow() + 1, 1, matriks.length, kepala.length).setValues(matriks);
  return matriks.length;
}

function kemasBaris(nama, nomborBaris, tampalan) {
  var sh = _helaian(nama);
  var kepala = LAJUR[nama];
  Object.keys(tampalan).forEach(function (k) {
    var idx = kepala.indexOf(k);
    if (idx < 0) return;
    sh.getRange(nomborBaris, idx + 1).setValue(bersihUntukSheet(tampalan[k]));
  });
}

/** Tulis semula seluruh blok baris sekali gus — untuk import besar. */
function tulisBaris(nama, nomborBaris, objek) {
  var sh = _helaian(nama);
  var kepala = LAJUR[nama];
  sh.getRange(nomborBaris, 1, 1, kepala.length)
    .setValues([kepala.map(function (k) { return bersihUntukSheet(objek[k]); })]);
}

function tetapan(kunci, lalai) {
  var semua = bacaSemua(HELAIAN.TETAPAN);
  for (var i = 0; i < semua.length; i++) {
    if (String(semua[i].Kunci) === kunci) {
      var v = semua[i].Nilai;
      return (v === '' || v === null || v === undefined) ? lalai : v;
    }
  }
  return lalai;
}

function tetapanNombor(kunci, lalai) {
  var v = keNombor(tetapan(kunci, null));
  return v === null ? lalai : v;
}

function tetapanYa(kunci) {
  return String(tetapan(kunci, 'tidak')).trim().toLowerCase() === 'ya';
}

function sesiSemasa() {
  var t = String(tetapan('sesi', '')).trim();
  return t || Utilities.formatDate(new Date(), 'Asia/Kuala_Lumpur', 'yyyy');
}

/**
 * Jejak audit.
 *
 * Nota jujur: dalam pangkalan data sebenar, trigger boleh menghalang
 * UPDATE dan DELETE pada jadual audit sepenuhnya. Sheets tiada mekanisme
 * itu — kod hanya menambah dan pasang() meletakkan perlindungan amaran,
 * tetapi pemilik spreadsheet sentiasa boleh mengeditnya dengan tangan.
 */
function audit(idMurid, tindakan, sebab, perubahan, pelaku) {
  tambahBaris(HELAIAN.AUDIT, {
    Masa: new Date(),
    IdMurid: idMurid || '',
    PelakuEmel: (pelaku && pelaku.emel) || '',
    PelakuLabel: (pelaku && pelaku.label) || 'sistem',
    Tindakan: tindakan,
    Sebab: sebab ? bersihTeks(sebab) : '',
    Perubahan: perubahan ? JSON.stringify(perubahan).substring(0, 5000) : ''
  });
}

function auditBanyak(senarai) {
  tambahBanyakBaris(HELAIAN.AUDIT, senarai.map(function (a) {
    return {
      Masa: new Date(), IdMurid: a.idMurid || '',
      PelakuEmel: (a.pelaku && a.pelaku.emel) || '',
      PelakuLabel: (a.pelaku && a.pelaku.label) || 'sistem',
      Tindakan: a.tindakan, Sebab: a.sebab || '',
      Perubahan: a.perubahan ? JSON.stringify(a.perubahan).substring(0, 5000) : ''
    };
  }));
}

/**
 * Kaunter had percubaan, disimpan dalam helaian.
 *
 * Bukan CacheService: Cache boleh dikosongkan tanpa amaran, dan had yang
 * hilang senyap-senyap adalah had yang tidak wujud. Helaian Had
 * dibersihkan oleh sweepHarian().
 */
function kiraCubaan(kunci, tempohMs) {
  var sekarang = new Date().getTime();
  var ada = cariBaris(HELAIAN.HAD, 'Kunci', kunci);
  if (!ada) {
    tambahBaris(HELAIAN.HAD, {
      Kunci: kunci, Bil: 1, ResetPada: new Date(sekarang + tempohMs)
    });
    return 1;
  }
  var reset = new Date(ada.ResetPada).getTime();
  var tamat = isNaN(reset) || reset < sekarang;
  var bil = tamat ? 1 : Number(ada.Bil || 0) + 1;
  kemasBaris(HELAIAN.HAD, ada._baris, {
    Bil: bil,
    ResetPada: tamat ? new Date(sekarang + tempohMs) : ada.ResetPada
  });
  return bil;
}

function kosongkanCubaan(kunci) {
  var ada = cariBaris(HELAIAN.HAD, 'Kunci', kunci);
  if (ada) _helaian(HELAIAN.HAD).deleteRow(ada._baris);
}

/** Kunci kelas: Tahun + NamaKelas. NamaKelas sahaja TIDAK unik. */
function kelasId(tahun, namaKelas) {
  return bersihTeks(tahun, 60).toUpperCase() + ' | ' + bersihTeks(namaKelas, 60).toUpperCase();
}
