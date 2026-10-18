/**
 * SISTEM PENGURUSAN KELAYAKAN RMT — SEMUA KOD DALAM SATU FAIL
 *
 * Gabungan automatik fail dalam apps-script/. JANGAN EDIT DI SINI —
 * edit di apps-script/ kemudian jalankan scripts/bina-kod-gs.sh.
 *
 * Rujukan kelayakan: Surat Pekeliling Kewangan Bil. 1 Tahun 2026
 * (KPM.100-1/4/2 Jld.6), bertarikh 5 Februari 2026.
 *
 * Sumber: https://github.com/EiznieJoe/sistem-rmt
 */

/* =============================================================
   00_Konfig.gs
   ============================================================= */

/**
 * Sistem Pengurusan Kelayakan RMT
 * Rujukan: Surat Pekeliling Kewangan Bil. 1 Tahun 2026 (KPM.100-1/4/2 Jld.6)
 *
 * Data murid diimport dari eksport iDME. Guru kelas membetulkan data
 * kelasnya kalau perlu. Kelayakan dikira dari peraturan pekeliling.
 * Penyelaras melihat keseluruhan dan menghasilkan senarai untuk JBPS.
 *
 * Tiada rahsia dalam fail ini. PEPPER dan SPREADSHEET_ID dalam Script
 * Properties.
 */

var HELAIAN = {
  SEKOLAH:       'Sekolah',
  KELAS:         'Kelas',
  STAF:          'Staf',
  SESI_LOGIN:    'SesiLogin',
  RESET_KOD:     'ResetKod',
  MURID:         'Murid',
  AUDIT:         'Audit',
  TETAPAN:       'Tetapan',
  HAD:           'Had',
  IMPORT_MENTAH: 'ImportMentah',
  IMPORT_LOG:    'ImportLog'
};

/**
 * Lajur Murid.
 *
 * Eksport iDME ada 61 lajur. Kami import 17 sahaja — PDPA Prinsip
 * Am/Minimization: jangan kumpul apa yang tidak diperlukan. Yang SENGAJA
 * TIDAK diimport: alamat, poskod, bandar, daerah, no. akaun bank, nama
 * bank, pekerjaan dan majikan penjaga, kaum, agama, jantina, tarikh lahir,
 * no. telefon pejabat. Tiada satu pun diperlukan untuk menilai kelayakan
 * RMT di bawah perenggan 4.1.
 */
var LAJUR = {
  Sekolah: ['Kod', 'Nama', 'Jenis', 'Negeri', 'Aktif'],

  // Identiti kelas sebenar = Tahun + NamaKelas. NamaKelas sahaja TIDAK unik:
  // dalam eksport sebenar, "GIGIH" wujud merentas enam tahun berbeza.
  Kelas: ['KelasId', 'Tahun', 'NamaKelas', 'SekolahKod',
          'GuruEmel', 'GuruNamaImport', 'Sesi', 'Aktif'],

  Staf: ['Emel', 'Nama', 'Peranan', 'SekolahKod', 'Aktif',
         'Salt', 'KataLaluanHash', 'DiciptaPada'],

  SesiLogin: ['Token', 'Emel', 'Peranan', 'SekolahKod', 'DiciptaPada', 'TamatPada'],

  Murid: [
    'IdMurid',              // kunci utama — unik, dan wujud untuk SEMUA murid
    'Nama',
    'NoPengenalan',         // boleh jadi sijil lahir / pasport / tiada dokumen
    'JenisPengenalan',
    'Tahun',
    'NamaKelas',
    'KelasId',
    'SekolahKod',
    'Warganegara',          // perenggan 4.1(a)
    'StatusAsrama',         // perenggan 4.2 — penafian mutlak
    'StatusOku',            // perenggan 4.1(f)
    'PenjagaNama',          // konteks untuk guru kelas
    'HubunganPenjaga',
    'PenjagaTelefon',
    'PendapatanPenjaga1',   // perenggan 3.7 — PIR
    'PendapatanPenjaga2',
    'Tanggungan',           // perenggan 3.6 — ibu bapa/penjaga + anak-anak
    /*
     * LEGASI — pengesahan guru dibuang, digantikan penghantaran dokumen.
     * Lajur dikekalkan kerana memadamnya akan menggeser setiap kepala
     * selepasnya sambil baris data kekal, menyebabkan kepala duduk atas
     * data yang salah. Tiada kod membaca atau menulisnya lagi.
     */
    'Disahkan',
    'DisahkanOleh',
    'DisahkanPada',
    'MedanDiubah',          // senarai medan yang guru ubah, dipisah koma
    'CatatanGuru',
    'Sesi',                 // sesi/tahun import ini
    'Aktif',                // false = tiada dalam import terkini (bertukar sekolah)
    'DiimportPada',
    'DikemaskiniPada',

    /*
     * Penghantaran dokumen sokongan. DITAMBAH DI HUJUNG dengan sengaja.
     *
     * Lajur dipetakan mengikut nama kepala, tetapi pasang() menulis kepala
     * ke kedudukan 1..n. Menyelit lajur di tengah akan menggeser setiap
     * kepala selepasnya sambil baris data kekal di tempat asal — kepala
     * baharu akan duduk atas data lama. Menambah di hujung tidak menggeser
     * apa-apa.
     */
    'StatusDokumen',        // '' | LENGKAP | TIDAK_LENGKAP
    'TarikhHantarDokumen',
    'CatatanDokumen',
    'DokumenOleh',
    'DokumenPada'
  ],

  Audit: ['Masa', 'IdMurid', 'PelakuEmel', 'PelakuLabel', 'Tindakan',
          'Sebab', 'Perubahan'],

  /* Kod reset kata laluan. Kod disimpan sebagai hash, bukan teks biasa —
     sesiapa yang dapat baca helaian ini tetap tidak boleh menggunakannya. */
  ResetKod:  ['Emel', 'Salt', 'KodHash', 'TamatPada', 'Cuba', 'DiciptaPada'],

  Tetapan:   ['Kunci', 'Nilai', 'Nota'],
  Had:       ['Kunci', 'Bil', 'ResetPada'],
  ImportLog: ['Masa', 'PelakuEmel', 'BarisDibaca', 'Baharu', 'Dikemaskini',
              'Dilangkau', 'Konflik', 'Amaran']
};

/**
 * Status penghantaran dokumen sokongan.
 *
 * Ini TIDAK mempengaruhi kelayakan. Kelayakan ditentukan oleh kriteria SPK
 * semata-mata; penghantaran dokumen ialah lapisan pentadbiran di atasnya.
 * Murid layak yang belum hantar dokumen tetap layak.
 */
var STATUS_DOKUMEN = {
  BELUM:         '',
  LENGKAP:       'LENGKAP',
  TIDAK_LENGKAP: 'TIDAK_LENGKAP'
};

var STATUS_DOKUMEN_SAH = ['', 'LENGKAP', 'TIDAK_LENGKAP'];

/** Medan yang guru kelas dibenarkan ubah. Selain ini, import yang menang. */
var MEDAN_BOLEH_DIUBAH = [
  'PendapatanPenjaga1', 'PendapatanPenjaga2', 'Tanggungan',
  'Warganegara', 'StatusAsrama', 'StatusOku',
  'PenjagaNama', 'HubunganPenjaga', 'PenjagaTelefon'
];

var MEDAN_NOMBOR = ['PendapatanPenjaga1', 'PendapatanPenjaga2', 'Tanggungan'];

var PERANAN = { GURU: 'guru', PENYELARAS: 'penyelaras', ADMIN: 'admin' };

/** Tahun yang termasuk "Murid" di bawah perenggan 3.1 dan 4.1(b). */
var TAHUN_RMT = ['TAHUN SATU', 'TAHUN DUA', 'TAHUN TIGA',
                 'TAHUN EMPAT', 'TAHUN LIMA', 'TAHUN ENAM'];

/** Jenis sekolah yang memberi kelayakan automatik — perenggan 4.1(d), (e). */
var SEKOLAH_ORANG_ASLI = ['ORANG ASLI', 'PENAN'];
var SEKOLAH_SBJK = 'SBJK';

var HASH_PUSINGAN       = 500;
var SESI_JAM            = 8;
var HAD_LOGIN_CUBAAN    = 8;
var HAD_LOGIN_TEMPOH    = 300;
var PANJANG_TEKS_MAKS   = 1000;

/* Reset kata laluan */
var RESET_TEMPOH_MINIT  = 30;   // tempoh hayat kod
var RESET_HAD_MINTA     = 3;    // permintaan kod per emel per jam
var RESET_HAD_CUBAAN    = 5;    // percubaan kod salah sebelum kod dibatalkan
var KATALALUAN_MIN      = 10;

/**
 * Tetapan lalai.
 *
 * pgk_miskin_tegar: PGK Makanan nasional, HIES 2024 (DOSM) = RM1,236.
 * Perenggan 3.7 dan 4.1(c) merujuk "PGK Nasional SEMASA dalam kategori
 * miskin tegar", jadi angka ini berubah. Sahkan dengan PPD/JPN sebelum
 * menghantar senarai, dan kemas kini di helaian Tetapan — bukan dalam kod.
 *
 * kadar_sehari: perenggan 5.1 — RM4.00 untuk Sabah, Sarawak dan Labuan;
 * RM3.50 untuk Semenanjung.
 */
var TETAPAN_LALAI = [
  ['pgk_miskin_tegar',      '1236',
   'RM sebulan. PIR di bawah nilai ini = layak (perenggan 4.1c). ' +
   'Sumber lalai: PGK Makanan nasional HIES 2024, DOSM. Sahkan dengan PPD/JPN.'],
  ['pgk_per_kapita',        '',
   'RM sebulan. Peringkat 2: dipakai HANYA jika PIR melebihi PGK. ' +
   'Per kapita = PIR / bilangan tanggungan (ibu bapa + anak-anak, perenggan 3.6). ' +
   'Kosong = peringkat 2 dimatikan. SAHKAN HAD INI DENGAN PPD/JPN.'],
  ['kadar_sehari',          '4.00',
   'Perenggan 5.1: RM4.00 Sabah/Sarawak/Labuan, RM3.50 Semenanjung'],
  ['hari_persekolahan',     '190',
   'Anggaran hari persekolahan setahun untuk kiraan peruntukan'],
  ['kira_kelas_khas',       'tidak',
   'Masukkan KELAS KHAS RENDAH dalam penilaian? Perenggan 4.1(f) memberi ' +
   'laluan kepada MBPK pemegang Kad OKU tanpa ujian pendapatan. ' +
   'Tukar kepada "ya" jika sekolah mahu menilai mereka.'],
  ['kira_prasekolah',       'tidak',
   'Perenggan 3.1 mentakrifkan Murid sebagai Tahun 1 hingga 6 sahaja'],
  ['sesi',                  '',
   'Sesi/tahun semasa. Kosong = guna tahun semasa secara automatik'],
  ['had_percubaan_semak',   '5',  'Simpanan untuk kegunaan masa hadapan']
];

function Ralat(mesej) {
  var e = new Error(mesej);
  e.mesra = true;
  return e;
}

/* =============================================================
   01_Helaian.gs
   ============================================================= */

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

/* =============================================================
   02_Auth.gs
   ============================================================= */

/**
 * Kata laluan, sesi, dan kebenaran.
 *
 * Had yang perlu difahami: Apps Script tiada bcrypt atau Argon2. Yang ada
 * ialah SHA-256 berulang dengan salt per-pengguna dan satu pepper rahsia
 * dari Script Properties. Lebih baik dari SHA-256 tunggal, tetapi masih
 * lebih lemah dari bcrypt kerana tiada memory-hardness. Risikonya terhad
 * kerana hanya guru dan penyelaras ada akaun — tiada akaun orang awam.
 */

function _pepper() {
  var p = PropertiesService.getScriptProperties();
  var nilai = p.getProperty('PEPPER');
  if (!nilai) {
    // Dijana sekali, kekal selamanya. Kalau ini berubah, semua kata
    // laluan sedia ada jadi tidak sah.
    nilai = Utilities.getUuid() + Utilities.getUuid();
    p.setProperty('PEPPER', nilai);
  }
  return nilai;
}

function _saltBaru() { return Utilities.getUuid().replace(/-/g, ''); }

function hashKataLaluan(katalaluan, salt) {
  var bahan = salt + '|' + katalaluan + '|' + _pepper();
  for (var i = 0; i < HASH_PUSINGAN; i++) {
    bahan = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bahan)
      .map(function (b) { return ((b + 256) % 256).toString(16).slice(-2); }).join('');
  }
  return bahan;
}

/** Perbandingan masa-tetap supaya masa respons tak membocorkan hash. */
function _samaSelamat(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  var beza = 0;
  for (var i = 0; i < a.length; i++) beza |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return beza === 0;
}

/** Jalankan dari editor untuk melaraskan HASH_PUSINGAN. */
function ujiKelajuanHash() {
  var mula = new Date().getTime();
  hashKataLaluan('ujian', _saltBaru());
  var ms = new Date().getTime() - mula;
  Logger.log(HASH_PUSINGAN + ' pusingan = ' + ms + ' ms.');
  Logger.log('Untuk sasaran 1500 ms, tetapkan HASH_PUSINGAN kira-kira ' +
             Math.round(HASH_PUSINGAN * 1500 / Math.max(ms, 1)) + '.');
  return ms;
}

/* ------------------------------------------------------------------ */

/**
 * Daftar atau kemas kini seorang pegawai. Dipanggil dari editor oleh
 * pentadbir sistem.
 *
 * Guru kelas bertukar setiap tahun, jadi akaun dan tugasan kelas sengaja
 * DIASINGKAN: akaun di sini, tugasan kelas melalui tugaskanGuru().
 * Tukar guru = tukar satu baris, tanpa import semula data murid.
 */
function daftarPegawai(emel, nama, peranan, kataLaluan, sekolahKod) {
  emel = String(emel || '').trim().toLowerCase();
  peranan = String(peranan || '').trim().toLowerCase();
  if (!emel) throw Ralat('Emel diperlukan.');
  if ([PERANAN.GURU, PERANAN.PENYELARAS, PERANAN.ADMIN].indexOf(peranan) < 0) {
    throw Ralat('Peranan mesti guru, penyelaras, atau admin.');
  }
  if (!kataLaluan || String(kataLaluan).length < 10) {
    throw Ralat('Kata laluan mesti sekurang-kurangnya 10 aksara.');
  }
  return dgnKunci(function () {
    var salt = _saltBaru();
    var hash = hashKataLaluan(String(kataLaluan), salt);
    var ada = cariBaris(HELAIAN.STAF, 'Emel', emel);
    if (ada) {
      kemasBaris(HELAIAN.STAF, ada._baris, {
        Nama: bersihTeks(nama, 150), Peranan: peranan,
        SekolahKod: bersihTeks(sekolahKod, 20), Aktif: true,
        Salt: salt, KataLaluanHash: hash
      });
      _batalkanSesiPegawai(emel);
      return 'Pegawai ' + emel + ' dikemas kini. Sesi lama dibatalkan.';
    }
    tambahBaris(HELAIAN.STAF, {
      Emel: emel, Nama: bersihTeks(nama, 150), Peranan: peranan,
      SekolahKod: bersihTeks(sekolahKod, 20), Aktif: true,
      Salt: salt, KataLaluanHash: hash, DiciptaPada: new Date()
    });
    return 'Pegawai ' + emel + ' (' + peranan + ') didaftarkan.';
  });
}

function nyahaktifPegawai(emel) {
  emel = String(emel || '').trim().toLowerCase();
  return dgnKunci(function () {
    var ada = cariBaris(HELAIAN.STAF, 'Emel', emel);
    if (!ada) throw Ralat('Pegawai tidak dijumpai.');
    kemasBaris(HELAIAN.STAF, ada._baris, { Aktif: false });
    _batalkanSesiPegawai(emel);
    return emel + ' dinyahaktifkan dan sesinya dibatalkan.';
  });
}

function _batalkanSesiPegawai(emel) {
  var sh = _helaian(HELAIAN.SESI_LOGIN);
  bacaSemua(HELAIAN.SESI_LOGIN)
    .filter(function (s) { return String(s.Emel).toLowerCase() === emel; })
    .sort(function (a, b) { return b._baris - a._baris; })  // bawah ke atas
    .forEach(function (s) { sh.deleteRow(s._baris); });
}

/* ------------------------------------------------------------------ */

function logMasuk(emel, katalaluan) {
  emel = String(emel || '').trim().toLowerCase();
  var kunciHad = 'login:' + emel;
  var cache = CacheService.getScriptCache();
  var bil = Number(cache.get(kunciHad) || 0);
  if (bil >= HAD_LOGIN_CUBAAN) {
    throw Ralat('Terlalu banyak percubaan. Cuba lagi dalam 5 minit.');
  }

  var staf = emel ? cariBaris(HELAIAN.STAF, 'Emel', emel) : null;
  var sah = false;
  if (staf && staf.Aktif === true && staf.Salt && staf.KataLaluanHash) {
    sah = _samaSelamat(hashKataLaluan(String(katalaluan || ''), String(staf.Salt)),
                       String(staf.KataLaluanHash));
  }
  if (!sah) {
    cache.put(kunciHad, String(bil + 1), HAD_LOGIN_TEMPOH);
    // Mesej SAMA untuk emel tiada, kata laluan salah, dan akaun tidak
    // aktif — jangan beritahu penyerang emel mana yang wujud.
    throw Ralat('Emel atau kata laluan salah.');
  }
  cache.remove(kunciHad);

  var token = Utilities.getUuid() + Utilities.getUuid();
  var tamat = new Date(new Date().getTime() + SESI_JAM * 3600 * 1000);
  dgnKunci(function () {
    tambahBaris(HELAIAN.SESI_LOGIN, {
      Token: token, Emel: staf.Emel, Peranan: staf.Peranan,
      SekolahKod: staf.SekolahKod, DiciptaPada: new Date(), TamatPada: tamat
    });
  });
  return {
    token: token, nama: String(staf.Nama), emel: String(staf.Emel),
    peranan: String(staf.Peranan), sekolahKod: String(staf.SekolahKod),
    tamatPada: tamat.toISOString()
  };
}

/**
 * Sesi disimpan dalam helaian, bukan CacheService sahaja: Cache berhad
 * 6 jam dan boleh dikosongkan tanpa amaran, dan log keluar perlu
 * benar-benar membatalkan token, bukan sekadar membuangnya dari browser.
 */
function _sahkanSesi(token) {
  if (!token || String(token).length < 32) return null;
  var sesi = cariBaris(HELAIAN.SESI_LOGIN, 'Token', String(token));
  if (!sesi) return null;
  var tamat = new Date(sesi.TamatPada).getTime();
  if (isNaN(tamat) || tamat < new Date().getTime()) {
    try { dgnKunci(function () { _helaian(HELAIAN.SESI_LOGIN).deleteRow(sesi._baris); }); }
    catch (e) {}
    return null;
  }
  // Semak semula terhadap helaian Staf setiap kali — pegawai yang
  // dinyahaktifkan mesti hilang akses serta-merta, bukan bila token tamat.
  var staf = cariBaris(HELAIAN.STAF, 'Emel', String(sesi.Emel).toLowerCase());
  if (!staf || staf.Aktif !== true) return null;
  return {
    emel: String(staf.Emel).toLowerCase(),
    label: String(staf.Nama),
    peranan: String(staf.Peranan),
    sekolahKod: String(staf.SekolahKod)
  };
}

function logKeluar(token) {
  if (!token) return { ok: true };
  var sesi = cariBaris(HELAIAN.SESI_LOGIN, 'Token', String(token));
  if (sesi) dgnKunci(function () { _helaian(HELAIAN.SESI_LOGIN).deleteRow(sesi._baris); });
  return { ok: true };
}

/**
 * Dipanggil pada SETIAP tindakan. URL web app bukan rahsia — sesiapa
 * boleh memanggilnya dari curl tanpa pernah membuka muka surat.
 */
function perluAuth(token, perananDibenarkan) {
  var sesi = _sahkanSesi(token);
  if (!sesi) throw Ralat('Sesi tamat atau tidak sah. Sila log masuk semula.');
  if (perananDibenarkan && perananDibenarkan.length &&
      perananDibenarkan.indexOf(sesi.peranan) < 0 &&
      sesi.peranan !== PERANAN.ADMIN) {
    throw Ralat('Peranan anda tiada kebenaran untuk tindakan ini.');
  }
  return sesi;
}

/**
 * Kelas yang pegawai ini dibenarkan lihat.
 *   guru       -> kelas yang ditugaskan kepadanya sahaja
 *   penyelaras -> semua kelas sekolahnya
 *   admin      -> semua kelas
 */
function kelasDibenarkan(sesi) {
  var semua = bacaSemua(HELAIAN.KELAS).filter(function (k) {
    return k.Aktif === true && String(k.Sesi) === sesiSemasa();
  });
  if (sesi.peranan === PERANAN.ADMIN) return semua;
  var ikutSekolah = semua.filter(function (k) {
    return String(k.SekolahKod) === String(sesi.sekolahKod);
  });
  if (sesi.peranan === PERANAN.PENYELARAS) return ikutSekolah;
  return ikutSekolah.filter(function (k) {
    return String(k.GuruEmel || '').toLowerCase() === sesi.emel;
  });
}

/* =============================================================
   03_Kelayakan.gs
   ============================================================= */

/**
 * Enjin kelayakan RMT.
 * Sumber tunggal: Surat Pekeliling Kewangan Bil. 1 Tahun 2026, perenggan
 * 3.1, 3.6, 3.7, 4.1 dan 4.2.
 *
 * UJIAN PENDAPATAN ADA DUA PERINGKAT.
 *
 * Peringkat 1 — PIR penuh lawan PGK miskin tegar.
 *   Perenggan 3.7 mentakrifkan PIR sebagai semua bentuk pendapatan ibu
 *   bapa/penjaga; perenggan 4.1(c) membandingkannya dengan PGK Nasional
 *   semasa dalam kategori miskin tegar. Lulus di sini = layak.
 *
 * Peringkat 2 — per kapita, HANYA jika peringkat 1 gagal.
 *   Pendapatan dibahagi bilangan tanggungan. Perenggan 3.6 mentakrifkan
 *   Tanggungan sebagai "keluarga asas yang terdiri daripada ibu
 *   bapa/penjaga dan anak-anak", jadi medan TANGGUNGAN iDME sudah
 *   termasuk ibu bapa — JANGAN tambah satu atau dua lagi.
 *
 * Nota jujur tentang sumber: peringkat 2 TIDAK tertulis dalam SPK Bil. 1
 * Tahun 2026. Perenggan 18.1 SPK itu menyatakan ia hendaklah dibaca
 * bersama GP Pengurusan Program RMT, dan peraturan per kapita difahami
 * datang dari GP tersebut. Kalau PPD/JPN kemudian menyatakan sebaliknya,
 * kosongkan tetapan pgk_per_kapita dan peringkat 2 akan berhenti
 * sepenuhnya tanpa sebarang perubahan kod.
 *
 * Kesan peringkat 2 besar: pada data sekolah ini ia boleh menambah
 * ratusan murid. Had per kapita WAJIB disahkan dengan PPD/JPN sebelum
 * senarai dihantar.
 *
 * Kelayakan TIDAK disimpan dalam helaian. Ia dikira setiap kali dari
 * data semasa, supaya menukar PGK dalam Tetapan terus mengemas kini
 * semua angka tanpa import semula.
 */

var STATUS_KELAYAKAN = {
  LAYAK:       'LAYAK',
  TIDAK_LAYAK: 'TIDAK_LAYAK',
  PERLU_SEMAK: 'PERLU_SEMAK',   // data tak cukup untuk memutuskan
  LUAR_SKOP:   'LUAR_SKOP'      // bukan Tahun 1-6
};

function _ya(nilai) {
  var s = String(nilai === null || nilai === undefined ? '' : nilai).trim().toUpperCase();
  return s !== '' && s !== 'TIDAK' && s !== 'TIADA' && s !== 'FALSE' && s !== '0' && s !== '-';
}

/** Tahun yang dinilai, ikut tetapan sekolah. */
function tahunDalamSkop() {
  var senarai = TAHUN_RMT.slice();
  if (tetapanYa('kira_kelas_khas')) senarai.push('KELAS KHAS RENDAH');
  if (tetapanYa('kira_prasekolah')) senarai.push('PRASEKOLAH');
  return senarai;
}

/**
 * Menilai seorang murid.
 * @param m       baris Murid
 * @param sekolah baris Sekolah (untuk perenggan 4.1(d) dan (e))
 * @param konteks { pgk, tahunSkop } — dibaca sekali oleh pemanggil supaya
 *                tidak membaca helaian Tetapan 1,400 kali.
 */
function nilaiKelayakan(m, sekolah, konteks) {
  var pgk = konteks.pgk;
  var jenisSekolah = String((sekolah && sekolah.Jenis) || '').trim().toUpperCase();

  // --- Perenggan 3.1 + 4.1(b): "Murid" bermaksud Tahun 1 hingga Tahun 6
  if (konteks.tahunSkop.indexOf(String(m.Tahun).trim().toUpperCase()) < 0) {
    return { status: STATUS_KELAYAKAN.LUAR_SKOP, laluan: '',
             sebab: 'Bukan Tahun 1-6 (perenggan 3.1)', pir: null, perKapita: null };
  }

  // --- Perenggan 4.2: penafian mutlak, mengatasi semua laluan lain
  if (_ya(m.StatusAsrama)) {
    return { status: STATUS_KELAYAKAN.TIDAK_LAYAK, laluan: '',
             sebab: 'Tinggal di asrama SK/SBK (perenggan 4.2)', pir: null, perKapita: null };
  }

  // --- Perenggan 4.1(d): semua murid Sekolah Orang Asli/Penan layak
  if (SEKOLAH_ORANG_ASLI.indexOf(jenisSekolah) >= 0) {
    return { status: STATUS_KELAYAKAN.LAYAK, laluan: '4.1(d)',
             sebab: 'Murid Sekolah Orang Asli/Penan', pir: null, perKapita: null };
  }

  // --- Perenggan 4.1(a): warganegara, berdasarkan dokumen pengenalan
  var wn = String(m.Warganegara || '').trim().toUpperCase();
  var jenisId = String(m.JenisPengenalan || '').trim().toUpperCase();
  var tiadaDokumen = jenisId === 'TANPA DOKUMEN' || jenisId === '';

  if (wn === 'BUKAN WARGANEGARA') {
    return { status: STATUS_KELAYAKAN.TIDAK_LAYAK, laluan: '',
             sebab: 'Bukan warganegara (perenggan 4.1a)', pir: null, perKapita: null };
  }

  // --- Perenggan 4.1(e): murid SBJK yang TELAH memiliki dokumen pengenalan
  if (jenisSekolah === SEKOLAH_SBJK) {
    if (tiadaDokumen) {
      return { status: STATUS_KELAYAKAN.PERLU_SEMAK, laluan: '',
               sebab: 'Murid SBJK belum ada dokumen pengenalan (perenggan 4.1e)', pir: null, perKapita: null };
    }
    return { status: STATUS_KELAYAKAN.LAYAK, laluan: '4.1(e)',
             sebab: 'Murid SBJK berdokumen', pir: null, perKapita: null };
  }

  // --- Perenggan 4.1(f): MBPK pemegang Kad OKU, tanpa ujian pendapatan
  if (_ya(m.StatusOku)) {
    return { status: STATUS_KELAYAKAN.LAYAK, laluan: '4.1(f)',
             sebab: 'MBPK pemegang Kad OKU', pir: null, perKapita: null };
  }

  // Warganegara belum disahkan: jangan tolak secara senyap — serahkan
  // kepada guru kelas. Murid tanpa dokumen selalunya yang paling miskin.
  if (wn !== 'WARGANEGARA' || tiadaDokumen) {
    return { status: STATUS_KELAYAKAN.PERLU_SEMAK, laluan: '',
             sebab: 'Status warganegara/dokumen pengenalan belum disahkan (perenggan 4.1a)',
             pir: null, perKapita: null };
  }

  // --- Perenggan 3.7 + 4.1(c): PIR dibanding PGK miskin tegar
  var p1 = keNombor(m.PendapatanPenjaga1);
  var p2 = keNombor(m.PendapatanPenjaga2);
  if (p1 === null && p2 === null) {
    return { status: STATUS_KELAYAKAN.PERLU_SEMAK, laluan: '',
             sebab: 'Tiada data pendapatan penjaga', pir: null, perKapita: null };
  }
  if (pgk === null) {
    return { status: STATUS_KELAYAKAN.PERLU_SEMAK, laluan: '',
             sebab: 'PGK miskin tegar belum ditetapkan dalam Tetapan',
             pir: (p1 || 0) + (p2 || 0), perKapita: null };
  }

  var pir = (p1 || 0) + (p2 || 0);

  // --- Peringkat 1: PIR penuh lawan PGK miskin tegar
  if (pir < pgk) {
    return { status: STATUS_KELAYAKAN.LAYAK, laluan: '4.1(c)',
             sebab: 'PIR RM' + pir.toFixed(2) + ' di bawah PGK miskin tegar RM' + pgk.toFixed(2),
             pir: pir, perKapita: null };
  }

  // --- Peringkat 2: per kapita, hanya bila peringkat 1 gagal
  var hadKapita = konteks.pgkPerKapita;
  if (hadKapita === null) {
    // Peringkat 2 dimatikan — tiada had ditetapkan.
    return { status: STATUS_KELAYAKAN.TIDAK_LAYAK, laluan: '',
             sebab: 'PIR RM' + pir.toFixed(2) + ' mencapai atau melebihi PGK RM' + pgk.toFixed(2),
             pir: pir, perKapita: null };
  }

  var tanggungan = keNombor(m.Tanggungan);
  if (tanggungan === null || tanggungan <= 0) {
    // Tak boleh dikira, dan murid ini gagal peringkat 1 — jangan tolak
    // secara senyap. Guru kelas perlu mengisi bilangan tanggungan.
    return { status: STATUS_KELAYAKAN.PERLU_SEMAK, laluan: '',
             sebab: 'PIR RM' + pir.toFixed(2) + ' melebihi PGK, dan bilangan ' +
                    'tanggungan tiada — per kapita tidak dapat dikira',
             pir: pir, perKapita: null };
  }

  var perKapita = Math.round((pir / tanggungan) * 100) / 100;
  if (perKapita < hadKapita) {
    return { status: STATUS_KELAYAKAN.LAYAK, laluan: 'per kapita',
             sebab: 'PIR RM' + pir.toFixed(2) + ' melebihi PGK, tetapi per kapita RM' +
                    perKapita.toFixed(2) + ' (bahagi ' + tanggungan + ' tanggungan) ' +
                    'di bawah had RM' + hadKapita.toFixed(2),
             pir: pir, perKapita: perKapita };
  }

  return { status: STATUS_KELAYAKAN.TIDAK_LAYAK, laluan: '',
           sebab: 'PIR RM' + pir.toFixed(2) + ' dan per kapita RM' + perKapita.toFixed(2) +
                  ' kedua-duanya mencapai atau melebihi had',
           pir: pir, perKapita: perKapita };
}

/** Baca tetapan sekali untuk menilai banyak murid. */
function konteksKelayakan() {
  return {
    pgk: tetapanNombor('pgk_miskin_tegar', null),
    pgkPerKapita: tetapanNombor('pgk_per_kapita', null),
    tahunSkop: tahunDalamSkop().map(function (t) { return t.toUpperCase(); }),
    kadarSehari: tetapanNombor('kadar_sehari', 4.0),
    hariPersekolahan: tetapanNombor('hari_persekolahan', 190)
  };
}

/** Ringkasan untuk satu set murid. */
function ringkasanKelayakan(senaraiMurid, sekolahIkutKod, konteks) {
  var kira = { LAYAK: 0, TIDAK_LAYAK: 0, PERLU_SEMAK: 0, LUAR_SKOP: 0 };
  var laluan = {};
  var dok = { LENGKAP: 0, TIDAK_LENGKAP: 0, BELUM: 0 };

  senaraiMurid.forEach(function (m) {
    var hasil = nilaiKelayakan(m, sekolahIkutKod[String(m.SekolahKod)], konteks);
    kira[hasil.status]++;
    if (hasil.laluan) laluan[hasil.laluan] = (laluan[hasil.laluan] || 0) + 1;
    dok[_statusDokumen(m) || 'BELUM']++;
  });

  var anggaran = kira.LAYAK * konteks.kadarSehari * konteks.hariPersekolahan;
  return {
    kira: kira,
    laluan: laluan,
    dokumen: dok,
    jumlahDinilai: senaraiMurid.length,
    pgk: konteks.pgk,
    kadarSehari: konteks.kadarSehari,
    hariPersekolahan: konteks.hariPersekolahan,
    anggaranPeruntukan: Math.round(anggaran * 100) / 100,
    // Dipapar bersama setiap jumlah supaya tiada siapa tertanya-tanya
    // angka mana yang menghasilkannya.
    pgkPerKapita: konteks.pgkPerKapita,
    formula: 'Peringkat 1: PIR (penjaga 1 + 2) dibanding PGK miskin tegar RM' +
             (konteks.pgk === null ? '—' : konteks.pgk.toFixed(2)) +
             (konteks.pgkPerKapita === null
               ? '. Peringkat 2 (per kapita) dimatikan — had belum ditetapkan.'
               : '. Peringkat 2: jika PIR melebihi PGK, per kapita (PIR dibahagi ' +
                 'bilangan tanggungan) dibanding RM' + konteks.pgkPerKapita.toFixed(2) + '.')
  };
}

/* =============================================================
   04_Import.gs
   ============================================================= */

/**
 * Import dari eksport iDME.
 *
 * Cara guna: pentadbir menampal keseluruhan eksport iDME (termasuk baris
 * tajuk laporan) ke helaian "ImportMentah", kemudian menjalankan
 * importDariHelaian() dari editor Apps Script.
 *
 * Lajur dipadankan mengikut NAMA KEPALA, bukan kedudukan. Kalau iDME
 * menyusun semula lajurnya atau menambah lajur baharu, import tetap
 * berfungsi. Kalau kepala yang diperlukan hilang, import berhenti dan
 * menamakannya — ia tidak meneka.
 */

/** kepala iDME -> medan Murid. */
var PETA_IDME = {
  'ID MURID':                   'IdMurid',
  'NAMA':                       'Nama',
  'NO. PENGENALAN':             'NoPengenalan',
  'JENIS PENGENALAN':           'JenisPengenalan',
  'TAHUN / TINGKATAN':          'Tahun',
  'NAMA KELAS':                 'NamaKelas',
  'WARGANEGARA':                'Warganegara',
  'STATUS ASRAMA':              'StatusAsrama',
  'STATUS OKU':                 'StatusOku',
  'PENJAGA 1':                  'PenjagaNama',
  'HUBUNGAN PENJAGA 1':         'HubunganPenjaga',
  'NO. TEL. BIMBIT PENJAGA 1':  'PenjagaTelefon',
  'PENDAPATAN PENJAGA 1':       'PendapatanPenjaga1',
  'PENDAPATAN PENJAGA 2':       'PendapatanPenjaga2',
  'TANGGUNGAN':                 'Tanggungan'
};

/** Kepala yang WAJIB ada. Tanpa ini kelayakan tak boleh dinilai langsung. */
var KEPALA_WAJIB = ['ID MURID', 'NAMA', 'TAHUN / TINGKATAN', 'NAMA KELAS'];

/** Kepala tambahan yang dibaca tetapi tidak disimpan dalam Murid. */
var KEPALA_GURU   = 'NAMA GURU KELAS';
var KEPALA_STATUS = 'STATUS PENGAJIAN';

function _normalKepala(v) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/\s+/g, ' ').trim().toUpperCase();
}

/** Cari baris kepala di mana-mana dalam 30 baris pertama. */
function _cariKepala(matriks) {
  for (var i = 0; i < Math.min(matriks.length, 30); i++) {
    var normal = matriks[i].map(_normalKepala);
    if (normal.indexOf('ID MURID') >= 0) return { baris: i, kepala: normal };
  }
  return null;
}

function importDariHelaian() {
  var sh = _ss().getSheetByName(HELAIAN.IMPORT_MENTAH);
  if (!sh || sh.getLastRow() < 2) {
    throw Ralat('Helaian "' + HELAIAN.IMPORT_MENTAH + '" kosong. ' +
                'Tampal eksport iDME ke situ dahulu.');
  }
  var matriks = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  return _prosesImport(matriks, { emel: 'editor', label: 'pentadbir (editor)' });
}

function _prosesImport(matriks, pelaku) {
  var jumpa = _cariKepala(matriks);
  if (!jumpa) {
    throw Ralat('Tiada lajur "ID MURID" dijumpai dalam 30 baris pertama. ' +
                'Pastikan keseluruhan eksport iDME ditampal, termasuk baris kepala.');
  }

  var idx = {};
  jumpa.kepala.forEach(function (h, j) { if (h && !(h in idx)) idx[h] = j; });

  var hilang = KEPALA_WAJIB.filter(function (h) { return !(h in idx); });
  if (hilang.length) {
    throw Ralat('Lajur wajib tiada dalam eksport: ' + hilang.join(', ') + '.');
  }

  var amaran = [];
  Object.keys(PETA_IDME).forEach(function (h) {
    if (!(h in idx)) amaran.push('Lajur "' + h + '" tiada — medan ' +
                                 PETA_IDME[h] + ' akan dibiarkan kosong.');
  });

  var sesi = sesiSemasa();
  var sekolahKod = bersihTeks(tetapan('sekolah_kod', ''), 20);
  if (!sekolahKod) {
    var senaraiSekolah = bacaSemua(HELAIAN.SEKOLAH).filter(function (s) { return s.Aktif === true; });
    if (senaraiSekolah.length !== 1) {
      throw Ralat('Tetapkan "sekolah_kod" dalam helaian Tetapan — ' +
                  senaraiSekolah.length + ' sekolah aktif didaftarkan.');
    }
    sekolahKod = String(senaraiSekolah[0].Kod);
  }

  // --- Baca baris import
  var ambil = function (r, kepala) {
    var j = idx[kepala];
    return (j === undefined || j >= r.length) ? '' : r[j];
  };

  var masuk = [];
  var guruIkutKelas = {};
  var dilangkau = 0;

  for (var i = jumpa.baris + 1; i < matriks.length; i++) {
    var r = matriks[i];
    var id = String(ambil(r, 'ID MURID') || '').trim();
    if (!/^[0-9]+$/.test(id)) { continue; }   // baris tajuk/kosong/jumlah

    // Perenggan 3.1: hanya murid yang sedang bersekolah
    if (KEPALA_STATUS in idx) {
      var sp = _normalKepala(ambil(r, KEPALA_STATUS));
      if (sp && sp !== 'BERSEKOLAH') { dilangkau++; continue; }
    }

    var rec = { IdMurid: id };
    Object.keys(PETA_IDME).forEach(function (h) {
      var medan = PETA_IDME[h];
      var nilai = ambil(r, h);
      rec[medan] = MEDAN_NOMBOR.indexOf(medan) >= 0
        ? keNombor(nilai)
        : bersihTeks(nilai, 200);
    });
    rec.KelasId = kelasId(rec.Tahun, rec.NamaKelas);
    rec.SekolahKod = sekolahKod;
    rec.Sesi = sesi;

    if (KEPALA_GURU in idx) {
      var g = bersihTeks(ambil(r, KEPALA_GURU), 150);
      if (g && !guruIkutKelas[rec.KelasId]) guruIkutKelas[rec.KelasId] = g;
    }
    masuk.push(rec);
  }

  if (!masuk.length) throw Ralat('Tiada baris murid sah dijumpai dalam import.');

  var idUnik = {};
  var pendua = [];
  masuk.forEach(function (m) {
    if (idUnik[m.IdMurid]) pendua.push(m.IdMurid);
    idUnik[m.IdMurid] = true;
  });
  if (pendua.length) {
    amaran.push('ID MURID berulang dalam import (rekod terakhir digunakan): ' +
                pendua.slice(0, 5).join(', ') + (pendua.length > 5 ? ' ...' : ''));
  }

  // --- Gabung dengan data sedia ada
  return dgnKunci(function () {
    var sedia = bacaSemua(HELAIAN.MURID);
    var ikutId = {};
    sedia.forEach(function (m) { ikutId[String(m.IdMurid)] = m; });

    var baharu = 0, dikemaskini = 0, konflik = [];
    var sekarang = new Date();
    var jejak = [];

    masuk.forEach(function (rec) {
      var lama = ikutId[rec.IdMurid];
      if (!lama) {
        rec.MedanDiubah = ''; rec.CatatanGuru = ''; rec.Aktif = true;
        rec.StatusDokumen = ''; rec.TarikhHantarDokumen = '';
        rec.CatatanDokumen = ''; rec.DokumenOleh = ''; rec.DokumenPada = '';
        rec.DiimportPada = sekarang; rec.DikemaskiniPada = sekarang;
        ikutId[rec.IdMurid] = rec;
        sedia.push(rec);
        baharu++;
        return;
      }

      /**
       * Import semula TIDAK memadam pembetulan guru.
       * Medan yang guru dah ubah dikekalkan. Kalau import membawa nilai
       * berbeza untuk medan itu, ia dicatat sebagai konflik untuk
       * penyelaras tengok — bukan ditimpa senyap-senyap.
       */
      var diubah = String(lama.MedanDiubah || '').split(',')
        .map(function (s) { return s.trim(); }).filter(Boolean);
      var perubahan = {};

      Object.keys(PETA_IDME).forEach(function (h) {
        var medan = PETA_IDME[h];
        if (medan === 'IdMurid') return;
        var baru = rec[medan];
        if (diubah.indexOf(medan) >= 0) {
          var sama = String(lama[medan] === null ? '' : lama[medan]) ===
                     String(baru === null ? '' : baru);
          if (!sama) {
            konflik.push({ IdMurid: rec.IdMurid, medan: medan,
                           guru: lama[medan], import: baru });
          }
          return;  // nilai guru menang
        }
        var sediaAdaStr = String(lama[medan] === null ? '' : lama[medan]);
        var baruStr = String(baru === null ? '' : baru);
        if (sediaAdaStr !== baruStr) {
          perubahan[medan] = { dari: lama[medan], ke: baru };
          lama[medan] = baru;
        }
      });

      // Medan struktur sentiasa ikut import — guru tak boleh ubah kelas.
      ['Tahun', 'NamaKelas', 'KelasId', 'SekolahKod', 'Sesi'].forEach(function (k) {
        if (String(lama[k]) !== String(rec[k])) {
          perubahan[k] = { dari: lama[k], ke: rec[k] };
          lama[k] = rec[k];
        }
      });

      if (lama.Aktif !== true) { perubahan.Aktif = { dari: false, ke: true }; lama.Aktif = true; }

      if (Object.keys(perubahan).length) {
        lama.DikemaskiniPada = sekarang;
        dikemaskini++;
        jejak.push({ idMurid: rec.IdMurid, tindakan: 'IMPORT_KEMASKINI',
                     perubahan: perubahan, pelaku: pelaku });
      }
    });

    // Murid yang tiada lagi dalam import: tandakan tidak aktif, JANGAN padam.
    var tiadaLagi = 0;
    sedia.forEach(function (m) {
      if (!idUnik[String(m.IdMurid)] && m.Aktif !== false) {
        m.Aktif = false;
        m.DikemaskiniPada = sekarang;
        tiadaLagi++;
        jejak.push({ idMurid: String(m.IdMurid), tindakan: 'TIADA_DALAM_IMPORT',
                     sebab: 'Tidak hadir dalam eksport iDME terkini', pelaku: pelaku });
      }
    });

    _simpanSemuaMurid(sedia);
    _segarkanKelas(masuk, guruIkutKelas, sekolahKod, sesi, pelaku);

    if (jejak.length) auditBanyak(jejak.slice(0, 500));
    if (jejak.length > 500) {
      amaran.push(jejak.length + ' perubahan direkod; 500 pertama sahaja ditulis ke Audit.');
    }
    if (tiadaLagi) {
      amaran.push(tiadaLagi + ' murid tiada dalam import ini dan ditanda tidak aktif.');
    }
    if (konflik.length) {
      amaran.push(konflik.length + ' medan yang guru dah betulkan berbeza dari import. ' +
                  'Nilai guru dikekalkan. Lihat ImportLog.');
    }

    tambahBaris(HELAIAN.IMPORT_LOG, {
      Masa: sekarang, PelakuEmel: pelaku.emel,
      BarisDibaca: masuk.length, Baharu: baharu, Dikemaskini: dikemaskini,
      Dilangkau: dilangkau,
      Konflik: konflik.length ? JSON.stringify(konflik.slice(0, 50)) : '',
      Amaran: amaran.join(' | ')
    });

    /**
     * Kosongkan helaian staging selepas import berjaya.
     *
     * Tanpa ini: import berikutnya yang lebih kecil ditampal atas yang lama
     * meninggalkan baris murid lama di bawahnya. Baris itu dibaca semula
     * sebagai murid sah, jadi murid yang sudah bertukar sekolah kekal
     * "aktif" selama-lamanya dan tidak pernah ditanda tiada dalam import.
     * Kegagalan senyap yang hanya muncul pada import kedua.
     */
    var shMentah = _ss().getSheetByName(HELAIAN.IMPORT_MENTAH);
    if (shMentah && shMentah.getLastRow() > 0 && shMentah.getLastColumn() > 0) {
      shMentah.getRange(1, 1, shMentah.getLastRow(), shMentah.getLastColumn())
        .clearContent();
    }

    var ringkas = {
      barisDibaca: masuk.length, baharu: baharu, dikemaskini: dikemaskini,
      dilangkau: dilangkau, tiadaLagi: tiadaLagi, konflik: konflik.length,
      amaran: amaran,
      nota: 'Helaian ' + HELAIAN.IMPORT_MENTAH + ' dikosongkan supaya import ' +
            'berikutnya bermula bersih.'
    };
    Logger.log(JSON.stringify(ringkas, null, 2));
    return ringkas;
  });
}

/** Tulis seluruh blok Murid dalam satu setValues — 1,400 setValue terlalu lambat. */
function _simpanSemuaMurid(senarai) {
  var sh = _helaian(HELAIAN.MURID);
  var kepala = LAJUR[HELAIAN.MURID];
  if (!senarai.length) return;
  var matriks = senarai.map(function (o) {
    return kepala.map(function (k) { return bersihUntukSheet(o[k]); });
  });
  var akhir = sh.getLastRow();
  if (akhir > 1) sh.getRange(2, 1, akhir - 1, kepala.length).clearContent();
  sh.getRange(2, 1, matriks.length, kepala.length).setValues(matriks);
}

/**
 * Kemas kini senarai kelas dari import.
 *
 * GuruEmel SENGAJA tidak disentuh di sini. Guru kelas bertukar setiap
 * tahun dan ditugaskan oleh pentadbir melalui tugaskanGuru(). Import
 * hanya membawa NAMA guru dari iDME sebagai rujukan, supaya pentadbir
 * tahu nama mana belum ada akaun.
 */
function _segarkanKelas(masuk, guruIkutKelas, sekolahKod, sesi, pelaku) {
  var sedia = bacaSemua(HELAIAN.KELAS);
  var ikutId = {};
  sedia.forEach(function (k) { ikutId[String(k.KelasId) + '|' + String(k.Sesi)] = k; });

  var dilihat = {};
  masuk.forEach(function (m) { dilihat[m.KelasId] = m; });

  var baharu = [];
  Object.keys(dilihat).forEach(function (kid) {
    var m = dilihat[kid];
    var ada = ikutId[kid + '|' + sesi];
    if (ada) {
      var tampalan = {};
      if (ada.Aktif !== true) tampalan.Aktif = true;
      var namaGuru = guruIkutKelas[kid] || '';
      if (namaGuru && String(ada.GuruNamaImport) !== namaGuru) {
        tampalan.GuruNamaImport = namaGuru;
      }
      if (Object.keys(tampalan).length) kemasBaris(HELAIAN.KELAS, ada._baris, tampalan);
      return;
    }
    baharu.push({
      KelasId: kid, Tahun: m.Tahun, NamaKelas: m.NamaKelas,
      SekolahKod: sekolahKod, GuruEmel: '',
      GuruNamaImport: guruIkutKelas[kid] || '', Sesi: sesi, Aktif: true
    });
  });

  if (baharu.length) tambahBanyakBaris(HELAIAN.KELAS, baharu);

  // Kelas sesi ini yang tiada lagi dalam import
  sedia.forEach(function (k) {
    if (String(k.Sesi) === sesi && !dilihat[String(k.KelasId)] && k.Aktif !== false) {
      kemasBaris(HELAIAN.KELAS, k._baris, { Aktif: false });
    }
  });
}

/** Tugaskan guru kelas kepada satu kelas. Dipanggil pentadbir dari editor. */
function tugaskanGuru(kelasIdPenuh, emelGuru) {
  var kid = bersihTeks(kelasIdPenuh, 130).toUpperCase();
  var emel = String(emelGuru || '').trim().toLowerCase();
  return dgnKunci(function () {
    var sesi = sesiSemasa();
    var kelas = bacaSemua(HELAIAN.KELAS).filter(function (k) {
      return String(k.KelasId).toUpperCase() === kid && String(k.Sesi) === sesi;
    })[0];
    if (!kelas) throw Ralat('Kelas "' + kid + '" tiada untuk sesi ' + sesi + '.');
    if (emel) {
      var staf = cariBaris(HELAIAN.STAF, 'Emel', emel);
      if (!staf) throw Ralat('Pegawai ' + emel + ' belum didaftarkan. ' +
                             'Jalankan daftarPegawai() dahulu.');
      if (staf.Aktif !== true) throw Ralat('Pegawai ' + emel + ' tidak aktif.');
    }
    kemasBaris(HELAIAN.KELAS, kelas._baris, { GuruEmel: emel });
    audit('', 'TUGAS_GURU', kid + ' -> ' + (emel || '(dikosongkan)'), null,
          { emel: 'editor', label: 'pentadbir (editor)' });
    return kid + ' ditugaskan kepada ' + (emel || '(tiada)');
  });
}

/** Kelas yang belum ada akaun guru — senarai kerja untuk pentadbir. */
function kelasTanpaGuru() {
  var sesi = sesiSemasa();
  var senarai = bacaSemua(HELAIAN.KELAS).filter(function (k) {
    return k.Aktif === true && String(k.Sesi) === sesi && !String(k.GuruEmel || '').trim();
  }).map(function (k) {
    return k.KelasId + '   (nama dalam iDME: ' + (k.GuruNamaImport || '—') + ')';
  });
  Logger.log(senarai.length ? senarai.join('\n') : 'Semua kelas sudah ada guru.');
  return senarai;
}

/* =============================================================
   05_Guru.gs
   ============================================================= */

/**
 * Tindakan guru kelas.
 *
 * Model kerja: data iDME berdiri sendiri. Guru kelas hanya perlu
 * membetulkan yang salah atau mengisi yang kosong. Tidak buat apa-apa
 * bermakna data import digunakan seadanya — itu kes biasa.
 */

/** Semak kelas ini memang di bawah pegawai ini. Guru terhad kepada kelasnya. */
function _kelasSaya(sesi, kelasIdPenuh) {
  var kid = bersihTeks(kelasIdPenuh, 130).toUpperCase();
  var dibenarkan = kelasDibenarkan(sesi);
  var padan = dibenarkan.filter(function (k) {
    return String(k.KelasId).toUpperCase() === kid;
  })[0];
  if (!padan) throw Ralat('Kelas ini bukan di bawah kebenaran anda.');
  return padan;
}

function _murid(sesi, idMurid) {
  var m = cariBaris(HELAIAN.MURID, 'IdMurid', bersihTeks(idMurid, 30));
  if (!m) throw Ralat('Murid tidak dijumpai.');
  _kelasSaya(sesi, String(m.KelasId));   // menguatkuasakan skop
  return m;
}

function _paparMurid(m, sekolahIkutKod, konteks) {
  var hasil = nilaiKelayakan(m, sekolahIkutKod[String(m.SekolahKod)], konteks);
  return {
    idMurid: String(m.IdMurid),
    nama: String(m.Nama),
    noPengenalan: String(m.NoPengenalan || ''),
    jenisPengenalan: String(m.JenisPengenalan || ''),
    tahun: String(m.Tahun),
    namaKelas: String(m.NamaKelas),
    kelasId: String(m.KelasId),
    warganegara: String(m.Warganegara || ''),
    statusAsrama: String(m.StatusAsrama || ''),
    statusOku: String(m.StatusOku || ''),
    penjagaNama: String(m.PenjagaNama || ''),
    hubunganPenjaga: String(m.HubunganPenjaga || ''),
    penjagaTelefon: String(m.PenjagaTelefon || ''),
    pendapatanPenjaga1: keNombor(m.PendapatanPenjaga1),
    pendapatanPenjaga2: keNombor(m.PendapatanPenjaga2),
    tanggungan: keNombor(m.Tanggungan),
    pir: hasil.pir,
    perKapita: hasil.perKapita,
    kelayakan: hasil.status,
    laluan: hasil.laluan,
    sebab: hasil.sebab,
    statusDokumen: _statusDokumen(m),
    tarikhHantarDokumen: _tarikhIso(m.TarikhHantarDokumen),
    catatanDokumen: String(m.CatatanDokumen || ''),
    dokumenOleh: String(m.DokumenOleh || ''),
    medanDiubah: String(m.MedanDiubah || '').split(',').map(function (s) {
      return s.trim();
    }).filter(Boolean),
    catatanGuru: String(m.CatatanGuru || ''),
    aktif: m.Aktif !== false
  };
}

/**
 * Nilai StatusDokumen yang tidak dikenali dibaca sebagai "belum hantar",
 * bukan dibiarkan bocor ke UI. Baris yang diimport sebelum lajur ini wujud
 * akan kosong, dan itu memang bermakna belum hantar.
 */
function _statusDokumen(m) {
  var v = String(m.StatusDokumen || '').trim().toUpperCase();
  return STATUS_DOKUMEN_SAH.indexOf(v) >= 0 ? v : STATUS_DOKUMEN.BELUM;
}

/** Tarikh -> 'YYYY-MM-DD' untuk <input type="date">. Kosong kekal kosong. */
function _tarikhIso(nilai) {
  if (!nilai) return '';
  var d = (nilai instanceof Date) ? nilai : new Date(nilai);
  if (isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, 'Asia/Kuala_Lumpur', 'yyyy-MM-dd');
}

function _sekolahIkutKod() {
  var peta = {};
  bacaSemua(HELAIAN.SEKOLAH).forEach(function (s) { peta[String(s.Kod)] = s; });
  return peta;
}

/* ------------------------------------------------------------------ */

function guruKelasSaya(token) {
  var sesi = perluAuth(token, [PERANAN.GURU, PERANAN.PENYELARAS]);
  var konteks = konteksKelayakan();
  var sekolah = _sekolahIkutKod();
  /* Kelas luar skop RMT tidak dipaparkan — lihat nota dalam 06_Penyelaras.gs */
  var kelas = kelasDibenarkan(sesi).filter(function (k) {
    return konteks.tahunSkop.indexOf(String(k.Tahun).trim().toUpperCase()) >= 0;
  });
  var kidSet = {};
  kelas.forEach(function (k) { kidSet[String(k.KelasId)] = true; });

  var semua = bacaSemua(HELAIAN.MURID).filter(function (m) {
    return m.Aktif !== false && kidSet[String(m.KelasId)];
  });

  var ikutKelas = {};
  semua.forEach(function (m) {
    var kid = String(m.KelasId);
    if (!ikutKelas[kid]) {
      ikutKelas[kid] = { kelasId: kid, jumlah: 0,
                         dokLengkap: 0, dokTidakLengkap: 0, dokBelum: 0,
                         LAYAK: 0, TIDAK_LAYAK: 0, PERLU_SEMAK: 0, LUAR_SKOP: 0 };
    }
    var b = ikutKelas[kid];
    b.jumlah++;
    var sd = _statusDokumen(m);
    if (sd === STATUS_DOKUMEN.LENGKAP) b.dokLengkap++;
    else if (sd === STATUS_DOKUMEN.TIDAK_LENGKAP) b.dokTidakLengkap++;
    else b.dokBelum++;
    b[nilaiKelayakan(m, sekolah[String(m.SekolahKod)], konteks).status]++;
  });

  return {
    saya: { nama: sesi.label, emel: sesi.emel, peranan: sesi.peranan },
    konteks: {
      pgk: konteks.pgk, kadarSehari: konteks.kadarSehari,
      hariPersekolahan: konteks.hariPersekolahan, sesi: sesiSemasa()
    },
    kelas: kelas.map(function (k) {
      return {
        kelasId: String(k.KelasId), tahun: String(k.Tahun),
        namaKelas: String(k.NamaKelas),
        guruNamaImport: String(k.GuruNamaImport || ''),
        ringkasan: ikutKelas[String(k.KelasId)] ||
          { jumlah: 0, dokLengkap: 0, dokTidakLengkap: 0, dokBelum: 0,
            LAYAK: 0, TIDAK_LAYAK: 0, PERLU_SEMAK: 0, LUAR_SKOP: 0 }
      };
    })
  };
}

function guruSenaraiMurid(token, data) {
  var sesi = perluAuth(token, [PERANAN.GURU, PERANAN.PENYELARAS]);
  var kelas = _kelasSaya(sesi, data.kelasId);
  var konteks = konteksKelayakan();
  var sekolah = _sekolahIkutKod();

  var murid = bacaSemua(HELAIAN.MURID)
    .filter(function (m) {
      return m.Aktif !== false &&
             String(m.KelasId).toUpperCase() === String(kelas.KelasId).toUpperCase();
    })
    .map(function (m) { return _paparMurid(m, sekolah, konteks); })
    .sort(function (a, b) { return a.nama.localeCompare(b.nama); });

  return {
    kelas: { kelasId: String(kelas.KelasId), tahun: String(kelas.Tahun),
             namaKelas: String(kelas.NamaKelas) },
    murid: murid,
    konteks: { pgk: konteks.pgk, formula: ringkasanKelayakan([], {}, konteks).formula }
  };
}

/**
 * Guru membetulkan data seorang murid.
 * Hanya MEDAN_BOLEH_DIUBAH diterima. Setiap medan yang diubah direkod
 * dalam MedanDiubah supaya import akan datang tidak menimpanya.
 */
function guruKemasMurid(token, data) {
  var sesi = perluAuth(token, [PERANAN.GURU, PERANAN.PENYELARAS]);
  var perubahan = data.perubahan || {};
  var catatan = bersihTeks(data.catatan, 500);

  return dgnKunci(function () {
    var m = _murid(sesi, data.idMurid);
    var tampalan = {};
    var jejak = {};

    Object.keys(perubahan).forEach(function (medan) {
      if (MEDAN_BOLEH_DIUBAH.indexOf(medan) < 0) {
        throw Ralat('Medan "' + medan + '" tidak boleh diubah.');
      }
      var baru;
      if (MEDAN_NOMBOR.indexOf(medan) >= 0) {
        var n = keNombor(perubahan[medan]);
        if (perubahan[medan] !== '' && perubahan[medan] !== null && n === null) {
          throw Ralat('Nilai tidak sah untuk ' + medan + '.');
        }
        if (n !== null && (n < 0 || n > 1000000)) {
          throw Ralat('Nilai di luar julat untuk ' + medan + '.');
        }
        if (medan === 'Tanggungan' && n !== null && (n < 1 || n > 30)) {
          throw Ralat('Tanggungan mesti antara 1 dan 30.');
        }
        baru = n === null ? '' : n;
      } else {
        baru = bersihTeks(perubahan[medan], 200);
      }
      var lamaStr = String(m[medan] === null || m[medan] === undefined ? '' : m[medan]);
      if (lamaStr === String(baru)) return;
      jejak[medan] = { dari: m[medan], ke: baru };
      tampalan[medan] = baru;
    });

    if (catatan !== String(m.CatatanGuru || '')) tampalan.CatatanGuru = catatan;
    if (!Object.keys(tampalan).length) return { ralat: 'Tiada perubahan.' };

    var diubah = String(m.MedanDiubah || '').split(',')
      .map(function (s) { return s.trim(); }).filter(Boolean);
    Object.keys(jejak).forEach(function (medan) {
      if (diubah.indexOf(medan) < 0) diubah.push(medan);
    });

    tampalan.MedanDiubah = diubah.join(',');
    tampalan.DikemaskiniPada = new Date();
    kemasBaris(HELAIAN.MURID, m._baris, tampalan);

    audit(String(m.IdMurid), 'GURU_KEMASKINI', catatan || '', jejak, sesi);

    var segar = cariBaris(HELAIAN.MURID, 'IdMurid', String(m.IdMurid));
    return { murid: _paparMurid(segar, _sekolahIkutKod(), konteksKelayakan()) };
  });
}

/**
 * Guru mengemas kini penghantaran dokumen sokongan seorang murid.
 *
 * Berasingan daripada guruKemasMurid() kerana ini bukan pembetulan data
 * iDME: tiada MedanDiubah ditanda, jadi import semula tidak akan melaporkan
 * konflik untuk medan ini, dan status dokumen tidak pernah menimpa nilai
 * yang dibawa import.
 *
 * Tidak menyentuh kelayakan. Murid layak yang belum hantar dokumen tetap
 * layak — yang berubah hanyalah rekod pentadbiran.
 */
function guruKemasDokumen(token, data) {
  var sesi = perluAuth(token, [PERANAN.GURU, PERANAN.PENYELARAS]);

  var status = String(data.status || '').trim().toUpperCase();
  if (STATUS_DOKUMEN_SAH.indexOf(status) < 0) {
    throw Ralat('Status dokumen tidak sah.');
  }

  var tarikh = String(data.tarikh || '').trim();
  if (tarikh && !/^\d{4}-\d{2}-\d{2}$/.test(tarikh)) {
    throw Ralat('Tarikh mesti dalam bentuk YYYY-MM-DD.');
  }
  if (status !== STATUS_DOKUMEN.BELUM && !tarikh) {
    throw Ralat('Sila isi tarikh hantar.');
  }
  if (tarikh) {
    var d = new Date(tarikh + 'T00:00:00');
    if (isNaN(d.getTime())) throw Ralat('Tarikh tidak sah.');
    // Esok dibenarkan untuk zon waktu; selain itu tarikh hadapan ditolak.
    var esok = new Date(); esok.setDate(esok.getDate() + 1);
    if (d > esok) throw Ralat('Tarikh hantar tidak boleh pada masa hadapan.');
  }

  var catatan = bersihTeks(data.catatan, 300);

  return dgnKunci(function () {
    var m = _murid(sesi, data.idMurid);
    var lama = {
      status: _statusDokumen(m),
      tarikh: _tarikhIso(m.TarikhHantarDokumen),
      catatan: String(m.CatatanDokumen || '')
    };
    if (lama.status === status && lama.tarikh === tarikh &&
        lama.catatan === catatan) {
      return { ralat: 'Tiada perubahan.' };
    }

    // Status dikosongkan semula = rekod penghantaran ditarik balik penuh.
    var kosong = status === STATUS_DOKUMEN.BELUM;
    kemasBaris(HELAIAN.MURID, m._baris, {
      StatusDokumen:       status,
      TarikhHantarDokumen: kosong ? '' : tarikh,
      CatatanDokumen:      kosong ? '' : catatan,
      DokumenOleh:         kosong ? '' : sesi.emel,
      DokumenPada:         kosong ? '' : new Date(),
      DikemaskiniPada:     new Date()
    });

    audit(String(m.IdMurid), 'GURU_DOKUMEN', status || 'BELUM_HANTAR',
          { dari: lama, ke: { status: status, tarikh: tarikh, catatan: catatan } },
          sesi);

    return { status: status, tarikh: kosong ? '' : tarikh,
             catatan: kosong ? '' : catatan };
  });
}


/* =============================================================
   06_Penyelaras.gs
   ============================================================= */

/**
 * Papan pemuka penyelaras.
 *
 * Penyelaras melihat keseluruhan sekolah dan menghasilkan senarai murid
 * layak untuk dibawa ke JBPS (perenggan 7.1), yang kemudian dikemukakan
 * ke PPD/JPN (perenggan 8.2).
 *
 * Setiap jumlah dipapar bersama formula yang menghasilkannya. Tanpa itu,
 * tiada siapa dapat mengesan kalau had PGK tersilap tetapan — dan beza
 * antara tafsiran yang betul dan yang salah di sekolah ini ialah ratusan
 * murid.
 */

function penyelarasRingkasan(token) {
  var sesi = perluAuth(token, [PERANAN.PENYELARAS]);
  var konteks = konteksKelayakan();
  var sekolah = _sekolahIkutKod();
  var kelas = kelasDibenarkan(sesi);
  var kidSet = {};
  kelas.forEach(function (k) { kidSet[String(k.KelasId)] = true; });

  /**
   * Hanya tahun dalam skop dipaparkan. Prasekolah dan Kelas Khas Rendah
   * tidak dinilai untuk RMT (perenggan 3.1), jadi memaparkannya hanya
   * menambah bunyi pada setiap jumlah. Tetapan kira_kelas_khas dan
   * kira_prasekolah mengawal ini — hidupkan dan ia muncul semula.
   */
  var murid = bacaSemua(HELAIAN.MURID).filter(function (m) {
    return m.Aktif !== false && kidSet[String(m.KelasId)] &&
           konteks.tahunSkop.indexOf(String(m.Tahun).trim().toUpperCase()) >= 0;
  });

  var ringkas = ringkasanKelayakan(murid, sekolah, konteks);

  // Pecahan ikut tahun dan ikut kelas
  var ikutTahun = {}, ikutKelas = {};
  murid.forEach(function (m) {
    var hasil = nilaiKelayakan(m, sekolah[String(m.SekolahKod)], konteks);
    var t = String(m.Tahun), kid = String(m.KelasId);
    if (!ikutTahun[t]) ikutTahun[t] = { tahun: t, jumlah: 0, LAYAK: 0,
      TIDAK_LAYAK: 0, PERLU_SEMAK: 0, LUAR_SKOP: 0,
      dokLengkap: 0, dokTidakLengkap: 0, dokBelum: 0 };
    if (!ikutKelas[kid]) ikutKelas[kid] = { kelasId: kid, tahun: t,
      namaKelas: String(m.NamaKelas), jumlah: 0, LAYAK: 0, TIDAK_LAYAK: 0,
      PERLU_SEMAK: 0, LUAR_SKOP: 0,
      dokLengkap: 0, dokTidakLengkap: 0, dokBelum: 0, guru: '' };
    var sd = _statusDokumen(m);
    [ikutTahun[t], ikutKelas[kid]].forEach(function (b) {
      b.jumlah++; b[hasil.status]++;
      if (sd === STATUS_DOKUMEN.LENGKAP) b.dokLengkap++;
      else if (sd === STATUS_DOKUMEN.TIDAK_LENGKAP) b.dokTidakLengkap++;
      else b.dokBelum++;
    });
  });

  kelas = kelas.filter(function (k) {
    return konteks.tahunSkop.indexOf(String(k.Tahun).trim().toUpperCase()) >= 0;
  });
  kelas.forEach(function (k) {
    var b = ikutKelas[String(k.KelasId)];
    if (b) b.guru = String(k.GuruEmel || '') || ('(belum ditugaskan — iDME: ' +
                      (k.GuruNamaImport || '—') + ')');
  });

  var log = bacaSemua(HELAIAN.IMPORT_LOG);
  var importAkhir = log.length ? log[log.length - 1] : null;

  return {
    saya: { nama: sesi.label, emel: sesi.emel, peranan: sesi.peranan },
    sesi: sesiSemasa(),
    ringkasan: ringkas,
    ikutTahun: Object.keys(ikutTahun).map(function (k) { return ikutTahun[k]; }),
    ikutKelas: Object.keys(ikutKelas).map(function (k) { return ikutKelas[k]; })
      .sort(function (a, b) { return a.kelasId.localeCompare(b.kelasId); }),
    kelasTanpaGuru: kelas.filter(function (k) { return !String(k.GuruEmel || '').trim(); })
      .map(function (k) {
        return { kelasId: String(k.KelasId), guruNamaImport: String(k.GuruNamaImport || '') };
      }),
    importAkhir: importAkhir ? {
      masa: importAkhir.Masa ? new Date(importAkhir.Masa).toISOString() : null,
      barisDibaca: Number(importAkhir.BarisDibaca || 0),
      baharu: Number(importAkhir.Baharu || 0),
      dikemaskini: Number(importAkhir.Dikemaskini || 0),
      amaran: String(importAkhir.Amaran || '')
    } : null
  };
}

/**
 * Senarai penuh untuk semakan dan eksport.
 * Ditapis di SERVER mengikut kelas yang dibenarkan — jangan sekali-kali
 * pulangkan semua baris dan biar frontend menapis.
 */
function penyelarasSenarai(token, data) {
  var sesi = perluAuth(token, [PERANAN.PENYELARAS]);
  var konteks = konteksKelayakan();
  var sekolah = _sekolahIkutKod();
  var kelas = kelasDibenarkan(sesi);
  var kidSet = {};
  kelas.forEach(function (k) { kidSet[String(k.KelasId)] = true; });

  var tapisStatus = data && data.kelayakan ? String(data.kelayakan) : '';
  var tapisKelas = data && data.kelasId ? String(data.kelasId).toUpperCase() : '';

  var murid = bacaSemua(HELAIAN.MURID).filter(function (m) {
    if (m.Aktif === false || !kidSet[String(m.KelasId)]) return false;
    if (konteks.tahunSkop.indexOf(String(m.Tahun).trim().toUpperCase()) < 0) return false;
    if (tapisKelas && String(m.KelasId).toUpperCase() !== tapisKelas) return false;
    return true;
  }).map(function (m) {
    return _paparMurid(m, sekolah, konteks);
  }).filter(function (p) {
    return !tapisStatus || p.kelayakan === tapisStatus;
  }).sort(function (a, b) {
    return a.kelasId.localeCompare(b.kelasId) || a.nama.localeCompare(b.nama);
  });

  return {
    murid: murid,
    jumlah: murid.length,
    formula: ringkasanKelayakan([], {}, konteks).formula
  };
}

/** Tetapan yang penyelaras boleh ubah sendiri, dengan jejak audit. */
var TETAPAN_PENYELARAS = ['pgk_miskin_tegar', 'pgk_per_kapita', 'kadar_sehari',
                          'hari_persekolahan', 'kira_kelas_khas', 'kira_prasekolah'];

/**
 * Tambah baris TETAPAN_LALAI yang belum ada dalam helaian Tetapan.
 *
 * Tanpa ini, tetapan yang ditambah selepas helaian dicipta tidak akan
 * muncul langsung dalam UI — ia menapis baris yang wujud, dan baris itu
 * hanya ditulis semasa pasang(). Jadi penyelaras nampak tetapan hilang
 * tanpa sebab yang jelas.
 *
 * Hanya mengunci bila ada yang hilang, supaya bacaan biasa kekal murah.
 */
function _lengkapkanTetapan(semua) {
  var ada = semua.map(function (t) { return String(t.Kunci); });
  var hilang = TETAPAN_LALAI.filter(function (t) {
    return TETAPAN_PENYELARAS.indexOf(t[0]) >= 0 && ada.indexOf(t[0]) < 0;
  });
  if (!hilang.length) return semua;

  return dgnKunci(function () {
    // Baca semula di dalam kunci — proses lain mungkin sudah menambahnya.
    var kini = bacaSemua(HELAIAN.TETAPAN);
    var adaKini = kini.map(function (t) { return String(t.Kunci); });
    hilang.forEach(function (t) {
      if (adaKini.indexOf(t[0]) < 0) {
        tambahBaris(HELAIAN.TETAPAN, { Kunci: t[0], Nilai: t[1], Nota: t[2] });
        audit('', 'TETAPAN_DILENGKAPKAN', t[0], { nilai: t[1] }, null);
      }
    });
    return bacaSemua(HELAIAN.TETAPAN);
  });
}

function penyelarasTetapan(token) {
  perluAuth(token, [PERANAN.PENYELARAS]);
  var semua = _lengkapkanTetapan(bacaSemua(HELAIAN.TETAPAN));
  return {
    tetapan: semua.filter(function (t) {
      return TETAPAN_PENYELARAS.indexOf(String(t.Kunci)) >= 0;
    }).map(function (t) {
      return { kunci: String(t.Kunci), nilai: String(t.Nilai), nota: String(t.Nota || '') };
    })
  };
}

function penyelarasUbahTetapan(token, data) {
  var sesi = perluAuth(token, [PERANAN.PENYELARAS]);
  var kunci = bersihTeks(data.kunci, 60);
  if (TETAPAN_PENYELARAS.indexOf(kunci) < 0) {
    throw Ralat('Tetapan "' + kunci + '" tidak boleh diubah dari sini.');
  }
  var nilai = bersihTeks(data.nilai, 60);

  if (kunci === 'pgk_per_kapita' && nilai === '') {
    // Kosong dibenarkan — ia mematikan peringkat 2.
  } else if (kunci === 'pgk_miskin_tegar' || kunci === 'pgk_per_kapita' ||
      kunci === 'kadar_sehari' || kunci === 'hari_persekolahan') {
    var n = keNombor(nilai);
    if (n === null || n <= 0) throw Ralat('Nilai mesti nombor lebih besar dari sifar.');
    if (kunci === 'hari_persekolahan' && (n < 1 || n > 366)) {
      throw Ralat('Hari persekolahan mesti antara 1 dan 366.');
    }
  } else {
    nilai = nilai.toLowerCase();
    if (nilai !== 'ya' && nilai !== 'tidak') throw Ralat('Nilai mesti "ya" atau "tidak".');
  }

  return dgnKunci(function () {
    var ada = cariBaris(HELAIAN.TETAPAN, 'Kunci', kunci);
    var lama = ada ? String(ada.Nilai) : '';
    if (ada) kemasBaris(HELAIAN.TETAPAN, ada._baris, { Nilai: nilai });
    else tambahBaris(HELAIAN.TETAPAN, { Kunci: kunci, Nilai: nilai, Nota: '' });
    // Mengubah PGK mengubah setiap angka kelayakan dalam sistem.
    // Ia mesti meninggalkan jejak.
    audit('', 'UBAH_TETAPAN', kunci, { dari: lama, ke: nilai }, sesi);
    return { kunci: kunci, nilai: nilai };
  });
}

/** Jejak audit untuk seorang murid — penyelaras dan guru kelas berkenaan. */
function lihatAudit(token, data) {
  var sesi = perluAuth(token, [PERANAN.GURU, PERANAN.PENYELARAS]);
  var id = bersihTeks(data.idMurid, 30);
  if (id) _murid(sesi, id);   // menguatkuasakan skop kelas
  return {
    audit: bacaSemua(HELAIAN.AUDIT)
      .filter(function (a) { return String(a.IdMurid) === id; })
      .map(function (a) {
        return {
          masa: a.Masa ? new Date(a.Masa).toISOString() : null,
          tindakan: String(a.Tindakan), pelaku: String(a.PelakuLabel),
          sebab: String(a.Sebab || ''), perubahan: String(a.Perubahan || '')
        };
      })
      .sort(function (a, b) { return (b.masa || '').localeCompare(a.masa || ''); })
      .slice(0, 100)
  };
}

/* =============================================================
   07_Sweep.gs
   ============================================================= */

/**
 * Kerja berjadual. Pasang sekali melalui pasangTrigger().
 * Apps Script ada penjadual sendiri — tiada cron luar diperlukan.
 */
function sweepHarian() {
  var sekarang = new Date().getTime();
  var dibuang = 0;

  dgnKunci(function () {
    var shSesi = _helaian(HELAIAN.SESI_LOGIN);
    bacaSemua(HELAIAN.SESI_LOGIN)
      .filter(function (s) {
        var t = new Date(s.TamatPada).getTime();
        return isNaN(t) || t < sekarang;
      })
      .sort(function (a, b) { return b._baris - a._baris; })  // bawah ke atas
      .forEach(function (s) { shSesi.deleteRow(s._baris); dibuang++; });

    var shHad = _helaian(HELAIAN.HAD);
    bacaSemua(HELAIAN.HAD)
      .filter(function (h) {
        var t = new Date(h.ResetPada).getTime();
        return isNaN(t) || t < sekarang - 86400000;
      })
      .sort(function (a, b) { return b._baris - a._baris; })
      .forEach(function (h) { shHad.deleteRow(h._baris); });
  });

  Logger.log('sweepHarian: ' + dibuang + ' sesi tamat dibuang.');
  return { sesiDibuang: dibuang };
}

function pasangTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sweepHarian') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sweepHarian').timeBased().atHour(3).everyDays(1).create();
  return 'Trigger harian dipasang (lebih kurang 3 pagi).';
}

/* =============================================================
   08_Pemasangan.gs
   ============================================================= */

/**
 * Pemasangan. Jalankan pasang() SEKALI dari editor Apps Script.
 * Selamat dijalankan berulang — helaian sedia ada tidak disentuh.
 */
function pasang() {
  var ss = _ss();
  var log = [];

  Object.keys(LAJUR).forEach(function (nama) {
    var sh = ss.getSheetByName(nama);
    if (!sh) { sh = ss.insertSheet(nama); log.push('Helaian dicipta: ' + nama); }
    var kepala = LAJUR[nama];
    var ada = sh.getLastRow() >= 1
      ? sh.getRange(1, 1, 1, kepala.length).getValues()[0] : [];
    if (ada.join('|') !== kepala.join('|')) {
      sh.getRange(1, 1, 1, kepala.length).setValues([kepala])
        .setFontWeight('bold');
      sh.setFrozenRows(1);
      log.push('Baris kepala ditetapkan: ' + nama);
    }
  });

  // Helaian staging untuk tampal eksport iDME — tiada kepala tetap.
  if (!ss.getSheetByName(HELAIAN.IMPORT_MENTAH)) {
    ss.insertSheet(HELAIAN.IMPORT_MENTAH);
    log.push('Helaian dicipta: ' + HELAIAN.IMPORT_MENTAH + ' (tampal eksport iDME di sini)');
  }

  var adaTetapan = bacaSemua(HELAIAN.TETAPAN).map(function (t) { return String(t.Kunci); });
  TETAPAN_LALAI.forEach(function (t) {
    if (adaTetapan.indexOf(t[0]) < 0) {
      tambahBaris(HELAIAN.TETAPAN, { Kunci: t[0], Nilai: t[1], Nota: t[2] });
      log.push('Tetapan: ' + t[0] + ' = ' + t[1]);
    }
  });
  if (adaTetapan.indexOf('sekolah_kod') < 0) {
    tambahBaris(HELAIAN.TETAPAN, { Kunci: 'sekolah_kod', Nilai: '',
      Nota: 'Kod sekolah untuk import. Kosong = guna satu-satunya sekolah aktif.' });
  }

  _pepper();
  log.push('PEPPER ada dalam Script Properties.');

  [HELAIAN.AUDIT, HELAIAN.SESI_LOGIN, HELAIAN.HAD, HELAIAN.IMPORT_LOG,
     HELAIAN.RESET_KOD]
    .forEach(function (nama) {
      var sh = ss.getSheetByName(nama);
      if (sh && !sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).length) {
        sh.protect().setDescription(nama + ' — ditulis oleh skrip; jangan edit dengan tangan')
          .setWarningOnly(true);
        log.push('Perlindungan amaran: ' + nama);
      }
    });

  log.push('');
  log.push('LANGKAH SETERUSNYA');
  log.push('1. Isi helaian Sekolah: Kod, Nama, Jenis, Negeri, Aktif(TRUE).');
  log.push('   Jenis: SK, SBK, ORANG ASLI, PENAN, atau SBJK (perenggan 4.1d/4.1e).');
  log.push('2. Tampal eksport iDME ke helaian "' + HELAIAN.IMPORT_MENTAH + '".');
  log.push('3. Jalankan importDariHelaian().');
  log.push('4. daftarPegawai(emel, nama, "penyelaras"|"guru"|"admin", kataLaluan, kodSekolah)');
  log.push('5. kelasTanpaGuru() untuk lihat kelas mana belum ada guru.');
  log.push('6. tugaskanGuru("TAHUN SATU | GIGIH", "guru@sekolah.edu.my")');
  log.push('7. Sahkan pgk_miskin_tegar dalam Tetapan dengan PPD/JPN.');
  log.push('8. pasangTrigger(), kemudian Deploy > New deployment > Web app');
  log.push('   (Execute as: Me; Who has access: Anyone).');
  log.push('9. ujiKelajuanHash() dan laraskan HASH_PUSINGAN.');

  var teks = log.join('\n');
  Logger.log(teks);
  return teks;
}

/** Sekolah contoh untuk mencuba sebelum data sebenar. */
function pasangSekolahContoh() {
  return dgnKunci(function () {
    if (!cariBaris(HELAIAN.SEKOLAH, 'Kod', 'XBA0000')) {
      tambahBaris(HELAIAN.SEKOLAH, { Kod: 'XBA0000', Nama: 'SK Contoh',
        Jenis: 'SK', Negeri: 'SABAH', Aktif: true });
    }
    return 'Sekolah contoh XBA0000 ditambah.';
  });
}

/** Tetapkan PGK miskin tegar. Kekalkan sumber dalam Nota untuk audit. */
function tetapPgk(nilaiRM, nota) {
  var n = keNombor(nilaiRM);
  if (n === null || n <= 0) throw Ralat('Nilai PGK tidak sah.');
  return dgnKunci(function () {
    var ada = cariBaris(HELAIAN.TETAPAN, 'Kunci', 'pgk_miskin_tegar');
    var tampalan = { Nilai: n, Nota: bersihTeks(nota, 300) ||
      'Ditetapkan ' + Utilities.formatDate(new Date(), 'Asia/Kuala_Lumpur', 'dd-MM-yyyy') };
    if (ada) kemasBaris(HELAIAN.TETAPAN, ada._baris, tampalan);
    else tambahBaris(HELAIAN.TETAPAN, { Kunci: 'pgk_miskin_tegar',
      Nilai: n, Nota: tampalan.Nota });
    return 'pgk_miskin_tegar = RM' + n;
  });
}

/* =============================================================
   09_Main.gs
   ============================================================= */

/**
 * Titik masuk web app.
 *
 * URL /exec ialah endpoint API AWAM, bukan rahsia. Sesiapa boleh
 * memanggilnya dari curl tanpa pernah membuka muka surat. Sebab itu
 * SETIAP tindakan di bawah bermula dengan perluAuth() — tiada tindakan
 * tanpa token, kerana sistem ini tiada pengguna awam langsung.
 *
 * Nota CORS: Apps Script tidak menjawab preflight OPTIONS. Klien MESTI
 * POST dengan Content-Type: text/plain supaya ia kekal "simple request".
 * Badan tetap JSON dan dihurai di sini.
 */

/**
 * Tindakan AWAM — tiada token. Hanya ini. Semua yang lain perlukan sesi.
 * Kedua-duanya menjaga dirinya sendiri: had permintaan per emel, dan
 * jawapan yang sama tanpa mengira emel itu wujud atau tidak.
 */
var TINDAKAN_AWAM = {
  mintaResetKod:   function (d) { return mintaResetKod(d); },
  sahkanResetKod:  function (d) { return sahkanResetKod(d); }
};

var TINDAKAN = {
  logKeluar:        function (t) { return logKeluar(t); },
  tukarKataLaluan:  function (t, d) { return tukarKataLaluan(t, d); },
  kelasSaya:        function (t) { return guruKelasSaya(t); },
  senaraiMurid:     function (t, d) { return guruSenaraiMurid(t, d); },
  kemasMurid:       function (t, d) { return guruKemasMurid(t, d); },
  kemasDokumen:     function (t, d) { return guruKemasDokumen(t, d); },
  ringkasan:        function (t) { return penyelarasRingkasan(t); },
  senaraiPenuh:     function (t, d) { return penyelarasSenarai(t, d); },
  tetapan:          function (t) { return penyelarasTetapan(t); },
  ubahTetapan:      function (t, d) { return penyelarasUbahTetapan(t, d); },
  audit:            function (t, d) { return lihatAudit(t, d); }
};

function _balas(objek) {
  return ContentService.createTextOutput(JSON.stringify(objek))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  // Tiada data didedahkan — hanya penanda bahawa deployment hidup.
  return _balas({ ok: true, sistem: 'Kelayakan RMT',
                  nota: 'Guna POST untuk semua tindakan.' });
}

function doPost(e) {
  var badan;
  try {
    badan = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return _balas({ ok: false, ralat: 'Permintaan tidak sah.' });
  }

  var tindakan = String(badan.tindakan || '');
  var data = badan.data || {};
  var token = badan.token ? String(badan.token) : '';

  try {
    if (tindakan === 'logMasuk') {
      return _balas({ ok: true, data: logMasuk(badan.emel, badan.katalaluan) });
    }
    if (TINDAKAN_AWAM[tindakan]) {
      return _balas({ ok: true, data: TINDAKAN_AWAM[tindakan](data) });
    }
    if (TINDAKAN[tindakan]) {
      return _balas({ ok: true, data: TINDAKAN[tindakan](token, data) });
    }
    return _balas({ ok: false, ralat: 'Tindakan tidak dikenali.' });
  } catch (err) {
    if (err && err.mesra) return _balas({ ok: false, ralat: String(err.message) });
    // Ralat tak dijangka: butiran penuh ke log sahaja, bukan ke klien.
    Logger.log('RALAT [' + tindakan + '] ' + (err && err.stack ? err.stack : err));
    return _balas({ ok: false,
      ralat: 'Ralat sistem. Sila cuba lagi atau hubungi pentadbir sistem.' });
  }
}

/* =============================================================
   10_KataLaluan.gs
   ============================================================= */

/**
 * Reset dan tukar kata laluan.
 *
 * Tiga laluan:
 *   1. mintaResetKod + sahkanResetKod — pengguna reset sendiri melalui emel.
 *   2. tukarKataLaluan — pengguna yang sudah log masuk menukar sendiri.
 *   3. resetKataLaluanPegawai — pentadbir reset dari editor, jaring keselamatan
 *      bila emel pegawai pun bermasalah.
 *
 * Dua endpoint pertama TIADA auth, jadi ia perlu lebih berhati-hati:
 *   - Jawapan sama tanpa mengira emel itu wujud atau tidak, supaya endpoint
 *     ini tidak boleh dipakai untuk menyenaraikan akaun yang wujud.
 *   - Had permintaan per emel, supaya ia tidak boleh dipakai untuk membanjiri
 *     peti masuk seseorang atau menghabiskan kuota emel harian.
 *   - Kod disimpan sebagai hash bersalt, sama seperti kata laluan.
 */

var MESEJ_RESET_AM = 'Jika emel itu berdaftar, kod reset telah dihantar. ' +
                     'Semak peti masuk dan folder spam.';

function _kodEnamAngka() {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, Utilities.getUuid());
  var n = 0;
  for (var i = 0; i < 6; i++) n = (n * 256 + ((b[i] + 256) % 256)) % 1000000;
  return ('00000' + n).slice(-6);
}

/** Tetapkan hash kata laluan baharu dan batalkan semua sesi pegawai itu. */
function _tetapKataLaluan(barisStaf, kataLaluanBaru) {
  if (!kataLaluanBaru || String(kataLaluanBaru).length < KATALALUAN_MIN) {
    throw Ralat('Kata laluan mesti sekurang-kurangnya ' + KATALALUAN_MIN + ' aksara.');
  }
  var salt = _saltBaru();
  kemasBaris(HELAIAN.STAF, barisStaf._baris, {
    Salt: salt, KataLaluanHash: hashKataLaluan(String(kataLaluanBaru), salt)
  });
  // Tukar kata laluan membatalkan setiap sesi lama — kalau akaun itu memang
  // dirampas, menukar kata laluan mesti menendang keluar penceroboh.
  _batalkanSesiPegawai(String(barisStaf.Emel).toLowerCase());
}

/* ---------------- 1. Reset sendiri melalui emel ---------------- */

function mintaResetKod(data) {
  var emel = String((data && data.emel) || '').trim().toLowerCase();
  if (!emel || emel.indexOf('@') < 0) {
    return { mesej: MESEJ_RESET_AM };   // jawapan sama, tiada maklumat bocor
  }

  var bil = dgnKunci(function () {
    return kiraCubaan('reset-minta:' + emel, 3600000);
  });
  if (bil > RESET_HAD_MINTA) {
    return { mesej: MESEJ_RESET_AM };   // senyap — jangan beritahu ia dihadkan
  }

  var staf = cariBaris(HELAIAN.STAF, 'Emel', emel);
  if (!staf || staf.Aktif !== true) return { mesej: MESEJ_RESET_AM };

  var kod = _kodEnamAngka();
  var salt = _saltBaru();
  var tamat = new Date(new Date().getTime() + RESET_TEMPOH_MINIT * 60000);

  dgnKunci(function () {
    var ada = cariBaris(HELAIAN.RESET_KOD, 'Emel', emel);
    var rekod = { Emel: emel, Salt: salt, KodHash: hashKataLaluan(kod, salt),
                  TamatPada: tamat, Cuba: 0, DiciptaPada: new Date() };
    if (ada) kemasBaris(HELAIAN.RESET_KOD, ada._baris, rekod);
    else tambahBaris(HELAIAN.RESET_KOD, rekod);
  });

  try {
    MailApp.sendEmail({
      to: emel,
      subject: 'Kod reset kata laluan — Sistem Kelayakan RMT',
      body: 'Salam,\n\n' +
            'Kod reset kata laluan anda ialah: ' + kod + '\n\n' +
            'Kod ini sah selama ' + RESET_TEMPOH_MINIT + ' minit.\n\n' +
            'Jika anda tidak meminta reset, abaikan emel ini. Kata laluan anda ' +
            'tidak berubah selagi kod ini tidak digunakan.\n\n' +
            'Sistem Pengurusan Kelayakan RMT'
    });
  } catch (e) {
    // Kuota emel habis atau MailApp gagal. Jangan dedahkan kepada pemanggil —
    // ia akan membocorkan bahawa emel itu memang wujud.
    Logger.log('MailApp gagal untuk ' + emel + ': ' + e.message);
  }

  return { mesej: MESEJ_RESET_AM };
}

function sahkanResetKod(data) {
  var emel = String((data && data.emel) || '').trim().toLowerCase();
  var kod = String((data && data.kod) || '').replace(/[^0-9]/g, '');
  var baru = String((data && data.kataLaluanBaru) || '');

  if (baru.length < KATALALUAN_MIN) {
    throw Ralat('Kata laluan baharu mesti sekurang-kurangnya ' + KATALALUAN_MIN + ' aksara.');
  }
  if (kod.length !== 6) throw Ralat('Kod mesti 6 angka.');

  return dgnKunci(function () {
    var rekod = cariBaris(HELAIAN.RESET_KOD, 'Emel', emel);
    if (!rekod) throw Ralat('Kod tidak sah atau sudah tamat tempoh.');

    var tamat = new Date(rekod.TamatPada).getTime();
    if (isNaN(tamat) || tamat < new Date().getTime()) {
      _helaian(HELAIAN.RESET_KOD).deleteRow(rekod._baris);
      throw Ralat('Kod tidak sah atau sudah tamat tempoh.');
    }

    var cuba = Number(rekod.Cuba || 0);
    if (cuba >= RESET_HAD_CUBAAN) {
      _helaian(HELAIAN.RESET_KOD).deleteRow(rekod._baris);
      throw Ralat('Terlalu banyak percubaan. Minta kod baharu.');
    }

    if (!_samaSelamat(hashKataLaluan(kod, String(rekod.Salt)), String(rekod.KodHash))) {
      kemasBaris(HELAIAN.RESET_KOD, rekod._baris, { Cuba: cuba + 1 });
      throw Ralat('Kod tidak sah atau sudah tamat tempoh.');
    }

    var staf = cariBaris(HELAIAN.STAF, 'Emel', emel);
    if (!staf || staf.Aktif !== true) throw Ralat('Akaun tidak aktif. Hubungi pentadbir.');

    _tetapKataLaluan(staf, baru);
    _helaian(HELAIAN.RESET_KOD).deleteRow(rekod._baris);
    kosongkanCubaan('reset-minta:' + emel);
    audit('', 'RESET_KATA_LALUAN', 'Melalui kod emel', null,
          { emel: emel, label: String(staf.Nama) });

    return { mesej: 'Kata laluan ditukar. Sila log masuk dengan kata laluan baharu.' };
  });
}

/* ---------------- 2. Tukar sendiri selepas log masuk ---------------- */

function tukarKataLaluan(token, data) {
  var sesi = perluAuth(token, null);
  var lama = String((data && data.kataLaluanLama) || '');
  var baru = String((data && data.kataLaluanBaru) || '');

  if (baru.length < KATALALUAN_MIN) {
    throw Ralat('Kata laluan baharu mesti sekurang-kurangnya ' + KATALALUAN_MIN + ' aksara.');
  }
  if (lama === baru) throw Ralat('Kata laluan baharu mesti berbeza dari yang lama.');

  return dgnKunci(function () {
    var staf = cariBaris(HELAIAN.STAF, 'Emel', sesi.emel);
    if (!staf) throw Ralat('Akaun tidak dijumpai.');
    if (!_samaSelamat(hashKataLaluan(lama, String(staf.Salt)), String(staf.KataLaluanHash))) {
      throw Ralat('Kata laluan lama salah.');
    }
    _tetapKataLaluan(staf, baru);
    audit('', 'TUKAR_KATA_LALUAN', '', null, sesi);
    return { mesej: 'Kata laluan ditukar. Sila log masuk semula.' };
  });
}

/* ---------------- 3. Jaring keselamatan pentadbir ---------------- */

/**
 * Reset kata laluan seorang pegawai dari editor Apps Script.
 * Gunakan bila emel pegawai itu sendiri bermasalah.
 * Kata laluan sementara dipaparkan SEKALI dalam log — salin dan serahkan
 * secara peribadi, kemudian minta dia tukar sendiri selepas log masuk.
 */
function resetKataLaluanPegawai(emel) {
  emel = String(emel || '').trim().toLowerCase();
  if (!emel) throw Ralat('Emel diperlukan.');
  return dgnKunci(function () {
    var staf = cariBaris(HELAIAN.STAF, 'Emel', emel);
    if (!staf) throw Ralat('Pegawai ' + emel + ' tiada dalam helaian Staf.');
    var sementara = 'RMT-' + _kodEnamAngka() + '-' + _kodEnamAngka();
    _tetapKataLaluan(staf, sementara);
    audit('', 'RESET_OLEH_PENTADBIR', emel, null,
          { emel: 'editor', label: 'pentadbir (editor)' });
    var teks = 'Kata laluan sementara untuk ' + emel + ':\n\n    ' + sementara +
               '\n\nSesi lamanya dibatalkan. Minta dia log masuk dan tukar sendiri.';
    Logger.log(teks);
    return teks;
  });
}

