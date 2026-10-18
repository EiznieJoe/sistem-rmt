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

  [HELAIAN.AUDIT, HELAIAN.SESI_LOGIN, HELAIAN.HAD, HELAIAN.IMPORT_LOG]
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
