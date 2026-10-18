/**
 * Pemasangan. Jalankan pasang() SEKALI dari editor Apps Script.
 * Ia selamat dijalankan berulang — helaian yang sudah ada tidak disentuh.
 */
function pasang() {
  var ss = _ss();
  var log = [];

  Object.keys(LAJUR).forEach(function (nama) {
    var sh = ss.getSheetByName(nama);
    if (!sh) {
      sh = ss.insertSheet(nama);
      log.push('Helaian dicipta: ' + nama);
    }
    var kepala = LAJUR[nama];
    var adaKepala = sh.getLastRow() >= 1
      ? sh.getRange(1, 1, 1, kepala.length).getValues()[0]
      : [];
    if (String(adaKepala.join('|')) !== String(kepala.join('|'))) {
      sh.getRange(1, 1, 1, kepala.length).setValues([kepala]);
      sh.getRange(1, 1, 1, kepala.length).setFontWeight('bold');
      sh.setFrozenRows(1);
      log.push('Baris kepala ditetapkan: ' + nama);
    }
  });

  // Tetapan lalai
  var adaTetapan = bacaSemua(HELAIAN.TETAPAN).map(function (t) { return String(t.Kunci); });
  TETAPAN_LALAI.forEach(function (t) {
    if (adaTetapan.indexOf(t[0]) < 0) {
      tambahBaris(HELAIAN.TETAPAN, { Kunci: t[0], Nilai: t[1], Nota: t[2] });
      log.push('Tetapan: ' + t[0] + ' = ' + t[1]);
    }
  });

  // Pepper dijana sekarang supaya ia tak dijana semasa log masuk pertama.
  _pepper();
  log.push('PEPPER ada dalam Script Properties.');

  // Lindungi helaian yang tidak sepatutnya diedit dengan tangan.
  // Nota jujur: ini amaran, bukan halangan mutlak — pemilik spreadsheet
  // sentiasa boleh membuang perlindungan ini. Jejak audit dalam Sheets
  // memang lebih lemah dari versi pangkalan data.
  [HELAIAN.AUDIT, HELAIAN.SESI_LOGIN, HELAIAN.HAD].forEach(function (nama) {
    var sh = ss.getSheetByName(nama);
    if (!sh) return;
    var adaLindung = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    if (!adaLindung.length) {
      sh.protect()
        .setDescription(nama + ' — jangan edit dengan tangan; ditulis oleh skrip')
        .setWarningOnly(true);
      log.push('Perlindungan amaran: ' + nama);
    }
  });

  log.push('');
  log.push('LANGKAH SETERUSNYA:');
  log.push('1. Isi helaian Sekolah: Kod, Nama, Aktif (TRUE).');
  log.push('2. Isi helaian Staf: Emel, Nama, Peranan (penyemak/pelulus/admin),');
  log.push('   SekolahKod, Aktif (TRUE). Biarkan Salt dan KataLaluanHash kosong.');
  log.push('3. Jalankan tetapKataLaluan("emel@sekolah.edu.my", "KataLaluanPanjang")');
  log.push('   untuk setiap pegawai.');
  log.push('4. Jalankan pasangTrigger() untuk kerja harian.');
  log.push('5. Deploy -> New deployment -> Web app;');
  log.push('   Execute as: Me; Who has access: Anyone. Salin URL /exec.');
  log.push('6. Jalankan ujiKelajuanHash() dan laraskan HASH_PUSINGAN.');

  var teks = log.join('\n');
  Logger.log(teks);
  return teks;
}

/** Data contoh untuk mencuba sistem sebelum data sebenar dimasukkan. */
function pasangDataCubaan() {
  return dgnKunci(function () {
    if (!cariBaris(HELAIAN.SEKOLAH, 'Kod', 'ABA0001')) {
      tambahBaris(HELAIAN.SEKOLAH, { Kod: 'ABA0001', Nama: 'SK Contoh Satu', Aktif: true });
    }
    if (!cariBaris(HELAIAN.SEKOLAH, 'Kod', 'ABA0002')) {
      tambahBaris(HELAIAN.SEKOLAH, { Kod: 'ABA0002', Nama: 'SK Contoh Dua', Aktif: true });
    }
    return 'Dua sekolah contoh ditambah. Tambah pegawai dalam helaian Staf, ' +
           'kemudian jalankan tetapKataLaluan() untuk setiap seorang.';
  });
}

/**
 * KRITERIA KELAYAKAN — sengaja tidak diisi.
 *
 * Kelayakan RMT ditetapkan KPM dan terikat pada Jadual Paras Garis
 * Kemiskinan (PGK) Nasional, yang berubah dari semasa ke semasa. Angka
 * rasmi terkini tidak dapat disahkan, jadi ia tidak diletakkan di sini.
 * Dapatkan angka dari pekeliling KPM / PGK semasa, kemudian jalankan:
 *
 *   tetapKriteria(550, 'PGK per kapita, sumber: <rujukan anda>');
 *
 * Selagi kriteria tiada, saringan automatik tidak menanda apa-apa pada
 * pendapatan dan sistem tetap berfungsi sepenuhnya.
 */
function tetapKriteria(nilaiRM, nota) {
  var n = Number(nilaiRM);
  if (!isFinite(n) || n <= 0) throw Ralat('Nilai kriteria tidak sah.');
  return dgnKunci(function () {
    var ada = cariBaris(HELAIAN.KRITERIA, 'Kunci', 'pgk_per_kapita');
    if (ada) {
      kemasBaris(HELAIAN.KRITERIA, ada._baris, {
        Nilai: n, Nota: bersihTeks(nota, 300), BerkuatkuasaDari: new Date()
      });
    } else {
      tambahBaris(HELAIAN.KRITERIA, {
        Kunci: 'pgk_per_kapita', Nilai: n,
        Nota: bersihTeks(nota, 300), BerkuatkuasaDari: new Date()
      });
    }
    return 'pgk_per_kapita = RM' + n;
  });
}
