/**
 * Konfigurasi dan pemalar.
 *
 * Tiada rahsia dalam fail ini. Pepper kata laluan dan ID spreadsheet
 * disimpan dalam Script Properties, bukan di sini — fail .gs boleh
 * di-copy, di-share, dan masuk version control.
 */

var HELAIAN = {
  SEKOLAH:    'Sekolah',
  STAF:       'Staf',
  SESI_LOGIN: 'SesiLogin',
  PERMOHONAN: 'Permohonan',
  AUDIT:      'Audit',
  TETAPAN:    'Tetapan',
  KRITERIA:   'Kriteria',
  HAD:        'Had'
};

/** Baris pertama setiap helaian. Urutan di sini = urutan lajur sebenar. */
var LAJUR = {
  Sekolah:    ['Kod', 'Nama', 'Aktif'],

  Staf:       ['Emel', 'Nama', 'Peranan', 'SekolahKod', 'Aktif',
               'Salt', 'KataLaluanHash', 'DiciptaPada'],

  SesiLogin:  ['Token', 'Emel', 'Peranan', 'SekolahKod',
               'DiciptaPada', 'TamatPada'],

  Permohonan: ['NoRujukan', 'SekolahKod', 'Status', 'Sesi',
               'PenjagaNama', 'PenjagaTelefon', 'PenjagaHubungan',
               'MuridNama', 'MuridIC', 'MuridTahun', 'MuridKelas',
               'BilIsiRumah', 'PendapatanIsiRumah', 'PendapatanPerKapita',
               'EKasih', 'NoEKasih',
               'KaliDipulangkan', 'CatatanPenyemak', 'CatatanPelulus',
               'SebabTolak', 'PenyemakEmel', 'PelulusEmel',
               'TarikhHantar', 'TarikhSemakan', 'TarikhKeputusan',
               'TamatTempohBetul', 'PadamSelepas', 'Dianonimkan',
               'DikemaskiniPada'],

  Audit:      ['Masa', 'NoRujukan', 'PelakuEmel', 'PelakuLabel',
               'Tindakan', 'StatusDari', 'StatusKe', 'Sebab', 'Perubahan'],

  Tetapan:    ['Kunci', 'Nilai', 'Nota'],
  Kriteria:   ['Kunci', 'Nilai', 'Nota', 'BerkuatkuasaDari'],

  /** Kaunter had percubaan yang perlu kekal walaupun Cache dikosongkan. */
  Had:        ['Kunci', 'Bil', 'ResetPada']
};

var STATUS = {
  DIHANTAR:        'DIHANTAR',
  DALAM_SEMAKAN:   'DALAM_SEMAKAN',
  DIPULANGKAN:     'DIPULANGKAN',
  DALAM_KELULUSAN: 'DALAM_KELULUSAN',
  LULUS:           'LULUS',
  TOLAK:           'TOLAK',
  DITARIK_BALIK:   'DITARIK_BALIK',
  GUGUR:           'GUGUR'
};

var PERANAN = { PENYEMAK: 'penyemak', PELULUS: 'pelulus', ADMIN: 'admin' };

/** Tindakan semakan — digunakan untuk menguatkuasakan pengasingan tugas. */
var TINDAKAN_SEMAKAN = ['MULA_SEMAKAN', 'KE_KELULUSAN', 'PULANGKAN', 'TOLAK_TERUS'];

/**
 * Pusingan hashing kata laluan.
 *
 * Apps Script tiada bcrypt/Argon2. SHA-256 berulang ini memperlahankan
 * brute-force kira-kira HASH_PUSINGAN kali, tetapi MASIH lebih lemah dari
 * bcrypt kerana tiada memory-hardness. Jalankan ujiKelajuanHash() dalam
 * editor Apps Script untuk mengukur kelajuan sebenar pada projek anda,
 * kemudian naikkan nilai ini setinggi yang anda boleh terima (sasaran:
 * login ambil masa di bawah 2 saat).
 */
var HASH_PUSINGAN = 500;

var SESI_JAM            = 8;    // tempoh hayat token log masuk
var HAD_LOGIN_CUBAAN    = 8;    // percubaan log masuk gagal
var HAD_LOGIN_TEMPOH    = 300;  // ...dalam 5 minit
var HAD_SEMAK_CUBAAN    = 5;    // percubaan semak status gagal
var HAD_SEMAK_TEMPOH_MS = 15 * 60 * 1000;
var PANJANG_TEKS_MAKS   = 1000;

/** Nilai lalai tetapan. pasang() menulis ini ke helaian Tetapan. */
var TETAPAN_LALAI = [
  ['had_pulangan',                 '3',  'Berapa kali satu permohonan boleh dipulangkan kepada pemohon'],
  ['hari_tempoh_betul',            '14', 'Hari diberi kepada pemohon untuk betulkan sebelum GUGUR'],
  ['sla_hari_semakan',             '7',  'Sasaran hari untuk penyemak — papar bendera lewat bila melebihi'],
  ['sla_hari_kelulusan',           '5',  'Sasaran hari untuk pelulus'],
  ['tahun_retention',              '3',  'Tempoh simpanan sebelum data peribadi dianonimkan'],
  ['had_hantar_per_telefon_sehari','5',  'Perisai flood borang awam']
];

/**
 * Ralat yang SELAMAT dipapar kepada pengguna.
 *
 * Ralat yang kita lemparkan sendiri ditanda di sini. Ralat JS yang tak
 * dijangka (TypeError, had kuota, dan seumpamanya) tidak ditanda, jadi
 * doPost memulangkan mesej generik dan menulis butirannya ke log sahaja —
 * raw error boleh membocorkan nama lajur dan struktur dalaman.
 */
function Ralat(mesej) {
  var e = new Error(mesej);
  e.mesra = true;
  return e;
}
