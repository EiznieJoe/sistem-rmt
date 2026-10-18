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
    'Disahkan',             // guru kelas sudah semak?
    'DisahkanOleh',
    'DisahkanPada',
    'MedanDiubah',          // senarai medan yang guru ubah, dipisah koma
    'CatatanGuru',
    'Sesi',                 // sesi/tahun import ini
    'Aktif',                // false = tiada dalam import terkini (bertukar sekolah)
    'DiimportPada',
    'DikemaskiniPada'
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
