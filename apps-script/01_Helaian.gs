/**
 * Lapisan akses Google Sheets.
 *
 * Dua perkara yang Sheets tiada dan kena dibina sendiri di sini:
 *
 *   1. Transaksi. Dua permohonan yang masuk serentak boleh kedua-duanya
 *      lulus semakan pendua, atau menulis atas satu sama lain. Setiap
 *      operasi tulis MESTI dibalut dengan dgnKunci().
 *
 *   2. Row Level Security. Tiada konsep "baris ini hanya untuk sekolah X".
 *      Penapisan ikut sekolah dilakukan dalam kod sebelum data dipulangkan,
 *      bukan di klien.
 */

function _ss() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  var aktif = SpreadsheetApp.getActiveSpreadsheet();
  if (!aktif) {
    throw Ralat('SPREADSHEET_ID belum ditetapkan dalam Script Properties.');
  }
  return aktif;
}

function _helaian(nama) {
  var sh = _ss().getSheetByName(nama);
  if (!sh) throw Ralat('Helaian "' + nama + '" tiada. Jalankan pasang() dahulu.');
  return sh;
}

/**
 * Formula injection: nilai yang bermula =, +, -, @ ditafsir sebagai formula
 * oleh Sheets dan oleh Excel bila CSV dieksport. Prefix apostrof
 * meneutralkannya menjadi teks.
 */
function bersihUntukSheet(nilai) {
  if (nilai === null || nilai === undefined) return '';
  if (typeof nilai === 'boolean' || typeof nilai === 'number') return nilai;
  if (nilai instanceof Date) return nilai;
  var s = String(nilai);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s;
}

/** Buang aksara kawalan, pangkas, hadkan panjang. */
function bersihTeks(nilai, panjangMaks) {
  if (nilai === null || nilai === undefined) return '';
  var s = String(nilai).replace(/[\x00-\x1F\x7F]/g, '').trim();
  var had = panjangMaks || PANJANG_TEKS_MAKS;
  return s.length > had ? s.substring(0, had) : s;
}

/**
 * Semua tulisan melalui kunci skrip. Tanpa ini, dua pengguna serentak
 * boleh merosakkan data dan semakan pendua boleh dipintas.
 */
function dgnKunci(fn) {
  var kunci = LockService.getScriptLock();
  if (!kunci.tryLock(20000)) {
    throw Ralat('Sistem sedang sibuk. Cuba lagi sebentar.');
  }
  try {
    return fn();
  } finally {
    kunci.releaseLock();
  }
}

/** Baca seluruh helaian sebagai array objek berkunci nama lajur. */
function bacaSemua(nama) {
  var sh = _helaian(nama);
  var baris = sh.getLastRow();
  if (baris < 2) return [];
  var lajur = LAJUR[nama].length;
  var nilai = sh.getRange(2, 1, baris - 1, lajur).getValues();
  var kepala = LAJUR[nama];
  return nilai.map(function (r, i) {
    var o = { _baris: i + 2 };
    for (var c = 0; c < kepala.length; c++) o[kepala[c]] = r[c];
    return o;
  });
}

/**
 * Cari satu baris mengikut nilai satu lajur. Guna TextFinder supaya tak
 * perlu baca 1,500 baris setiap kali hanya untuk cari satu permohonan.
 */
function cariBaris(nama, namaLajur, nilai) {
  var sh = _helaian(nama);
  var kepala = LAJUR[nama];
  var idx = kepala.indexOf(namaLajur);
  if (idx < 0) throw Ralat('Lajur tidak dikenali: ' + namaLajur);
  var akhir = sh.getLastRow();
  if (akhir < 2) return null;

  var jumpa = sh.getRange(2, idx + 1, akhir - 1, 1)
    .createTextFinder(String(nilai))
    .matchEntireCell(true)
    .matchCase(true)
    .findNext();
  if (!jumpa) return null;

  var baris = jumpa.getRow();
  var nilaiBaris = sh.getRange(baris, 1, 1, kepala.length).getValues()[0];
  var o = { _baris: baris };
  for (var c = 0; c < kepala.length; c++) o[kepala[c]] = nilaiBaris[c];
  return o;
}

function tambahBaris(nama, objek) {
  var sh = _helaian(nama);
  var kepala = LAJUR[nama];
  var baris = kepala.map(function (k) { return bersihUntukSheet(objek[k]); });
  sh.appendRow(baris);
  return sh.getLastRow();
}

/** Kemas kini hanya medan yang diberi, pada baris yang diberi. */
function kemasBaris(nama, nomborBaris, tampalan) {
  var sh = _helaian(nama);
  var kepala = LAJUR[nama];
  Object.keys(tampalan).forEach(function (k) {
    var idx = kepala.indexOf(k);
    if (idx < 0) return;
    sh.getRange(nomborBaris, idx + 1).setValue(bersihUntukSheet(tampalan[k]));
  });
}

function tetapan(kunci, lalai) {
  var semua = bacaSemua(HELAIAN.TETAPAN);
  for (var i = 0; i < semua.length; i++) {
    if (String(semua[i].Kunci) === kunci) return semua[i].Nilai;
  }
  return lalai;
}

function tetapanInt(kunci, lalai) {
  var v = parseInt(tetapan(kunci, lalai), 10);
  return isNaN(v) ? lalai : v;
}

function kriteria(kunci) {
  var semua = bacaSemua(HELAIAN.KRITERIA);
  for (var i = 0; i < semua.length; i++) {
    if (String(semua[i].Kunci) === kunci) {
      var n = Number(semua[i].Nilai);
      return isNaN(n) ? null : n;
    }
  }
  return null;
}

/**
 * Jejak audit. Dalam versi Postgres sistem ini, trigger menghalang UPDATE
 * dan DELETE sepenuhnya. Sheets tiada mekanisme itu — kod ini hanya
 * menambah, dan pasang() melindungi helaian Audit, tetapi pemilik
 * spreadsheet tetap boleh mengeditnya secara manual. Ini kelemahan nyata
 * stack ini, bukan sesuatu yang boleh ditampung dengan kod.
 */
function audit(noRujukan, tindakan, statusDari, statusKe, sebab, perubahan, pelaku) {
  tambahBaris(HELAIAN.AUDIT, {
    Masa:        new Date(),
    NoRujukan:   noRujukan || '',
    PelakuEmel:  (pelaku && pelaku.emel) || '',
    PelakuLabel: (pelaku && pelaku.label) || 'pemohon',
    Tindakan:    tindakan,
    StatusDari:  statusDari || '',
    StatusKe:    statusKe || '',
    Sebab:       sebab ? bersihTeks(sebab) : '',
    Perubahan:   perubahan ? JSON.stringify(perubahan).substring(0, 5000) : ''
  });
}

/** Had percubaan yang kekal dalam helaian — Cache boleh dikosongkan bila-bila. */
function kiraCubaan(kunci, tempohMs) {
  var sekarang = new Date().getTime();
  var ada = cariBaris(HELAIAN.HAD, 'Kunci', kunci);
  if (!ada) {
    tambahBaris(HELAIAN.HAD, { Kunci: kunci, Bil: 1, ResetPada: new Date(sekarang + tempohMs) });
    return 1;
  }
  var reset = new Date(ada.ResetPada).getTime();
  var bil = (isNaN(reset) || reset < sekarang) ? 1 : Number(ada.Bil) + 1;
  var resetBaru = (isNaN(reset) || reset < sekarang) ? new Date(sekarang + tempohMs) : ada.ResetPada;
  kemasBaris(HELAIAN.HAD, ada._baris, { Bil: bil, ResetPada: resetBaru });
  return bil;
}

function kosongkanCubaan(kunci) {
  var ada = cariBaris(HELAIAN.HAD, 'Kunci', kunci);
  if (ada) _helaian(HELAIAN.HAD).deleteRow(ada._baris);
}
