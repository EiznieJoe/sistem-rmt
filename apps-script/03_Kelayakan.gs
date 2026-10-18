/**
 * Enjin kelayakan RMT.
 * Sumber tunggal: Surat Pekeliling Kewangan Bil. 1 Tahun 2026, perenggan
 * 3.1, 3.6, 3.7, 4.1 dan 4.2.
 *
 * PENTING — kriteria ini BUKAN pendapatan per kapita.
 * Perenggan 3.7 mentakrifkan PIR sebagai "semua bentuk pendapatan ibu
 * bapa/penjaga di bawah PGK Nasional semasa dalam kategori miskin tegar".
 * Perenggan 4.1(c) membandingkan PIR itu terus dengan PGK. Tiada
 * pembahagian dengan bilangan isi rumah di mana-mana.
 *
 * Pada data sebenar, beza antara dua tafsiran ini ialah 756 murid dari
 * 1,307 — lebih kurang RM575,000 peruntukan. Jangan tukar kepada per
 * kapita tanpa arahan bertulis dari KPM.
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
             sebab: 'Bukan Tahun 1-6 (perenggan 3.1)', pir: null };
  }

  // --- Perenggan 4.2: penafian mutlak, mengatasi semua laluan lain
  if (_ya(m.StatusAsrama)) {
    return { status: STATUS_KELAYAKAN.TIDAK_LAYAK, laluan: '',
             sebab: 'Tinggal di asrama SK/SBK (perenggan 4.2)', pir: null };
  }

  // --- Perenggan 4.1(d): semua murid Sekolah Orang Asli/Penan layak
  if (SEKOLAH_ORANG_ASLI.indexOf(jenisSekolah) >= 0) {
    return { status: STATUS_KELAYAKAN.LAYAK, laluan: '4.1(d)',
             sebab: 'Murid Sekolah Orang Asli/Penan', pir: null };
  }

  // --- Perenggan 4.1(a): warganegara, berdasarkan dokumen pengenalan
  var wn = String(m.Warganegara || '').trim().toUpperCase();
  var jenisId = String(m.JenisPengenalan || '').trim().toUpperCase();
  var tiadaDokumen = jenisId === 'TANPA DOKUMEN' || jenisId === '';

  if (wn === 'BUKAN WARGANEGARA') {
    return { status: STATUS_KELAYAKAN.TIDAK_LAYAK, laluan: '',
             sebab: 'Bukan warganegara (perenggan 4.1a)', pir: null };
  }

  // --- Perenggan 4.1(e): murid SBJK yang TELAH memiliki dokumen pengenalan
  if (jenisSekolah === SEKOLAH_SBJK) {
    if (tiadaDokumen) {
      return { status: STATUS_KELAYAKAN.PERLU_SEMAK, laluan: '',
               sebab: 'Murid SBJK belum ada dokumen pengenalan (perenggan 4.1e)', pir: null };
    }
    return { status: STATUS_KELAYAKAN.LAYAK, laluan: '4.1(e)',
             sebab: 'Murid SBJK berdokumen', pir: null };
  }

  // --- Perenggan 4.1(f): MBPK pemegang Kad OKU, tanpa ujian pendapatan
  if (_ya(m.StatusOku)) {
    return { status: STATUS_KELAYAKAN.LAYAK, laluan: '4.1(f)',
             sebab: 'MBPK pemegang Kad OKU', pir: null };
  }

  // Warganegara belum disahkan: jangan tolak secara senyap — serahkan
  // kepada guru kelas. Murid tanpa dokumen selalunya yang paling miskin.
  if (wn !== 'WARGANEGARA' || tiadaDokumen) {
    return { status: STATUS_KELAYAKAN.PERLU_SEMAK, laluan: '',
             sebab: 'Status warganegara/dokumen pengenalan belum disahkan (perenggan 4.1a)',
             pir: null };
  }

  // --- Perenggan 3.7 + 4.1(c): PIR dibanding PGK miskin tegar
  var p1 = keNombor(m.PendapatanPenjaga1);
  var p2 = keNombor(m.PendapatanPenjaga2);
  if (p1 === null && p2 === null) {
    return { status: STATUS_KELAYAKAN.PERLU_SEMAK, laluan: '',
             sebab: 'Tiada data pendapatan penjaga', pir: null };
  }
  if (pgk === null) {
    return { status: STATUS_KELAYAKAN.PERLU_SEMAK, laluan: '',
             sebab: 'PGK miskin tegar belum ditetapkan dalam Tetapan', pir: (p1 || 0) + (p2 || 0) };
  }

  var pir = (p1 || 0) + (p2 || 0);
  if (pir < pgk) {
    return { status: STATUS_KELAYAKAN.LAYAK, laluan: '4.1(c)',
             sebab: 'PIR RM' + pir.toFixed(2) + ' di bawah PGK miskin tegar RM' + pgk.toFixed(2),
             pir: pir };
  }
  return { status: STATUS_KELAYAKAN.TIDAK_LAYAK, laluan: '',
           sebab: 'PIR RM' + pir.toFixed(2) + ' mencapai atau melebihi PGK RM' + pgk.toFixed(2),
           pir: pir };
}

/** Baca tetapan sekali untuk menilai banyak murid. */
function konteksKelayakan() {
  return {
    pgk: tetapanNombor('pgk_miskin_tegar', null),
    tahunSkop: tahunDalamSkop().map(function (t) { return t.toUpperCase(); }),
    kadarSehari: tetapanNombor('kadar_sehari', 4.0),
    hariPersekolahan: tetapanNombor('hari_persekolahan', 190)
  };
}

/** Ringkasan untuk satu set murid. */
function ringkasanKelayakan(senaraiMurid, sekolahIkutKod, konteks) {
  var kira = { LAYAK: 0, TIDAK_LAYAK: 0, PERLU_SEMAK: 0, LUAR_SKOP: 0 };
  var laluan = {};
  var belumDisahkan = 0;

  senaraiMurid.forEach(function (m) {
    var hasil = nilaiKelayakan(m, sekolahIkutKod[String(m.SekolahKod)], konteks);
    kira[hasil.status]++;
    if (hasil.laluan) laluan[hasil.laluan] = (laluan[hasil.laluan] || 0) + 1;
    if (m.Disahkan !== true) belumDisahkan++;
  });

  var anggaran = kira.LAYAK * konteks.kadarSehari * konteks.hariPersekolahan;
  return {
    kira: kira,
    laluan: laluan,
    belumDisahkan: belumDisahkan,
    jumlahDinilai: senaraiMurid.length,
    pgk: konteks.pgk,
    kadarSehari: konteks.kadarSehari,
    hariPersekolahan: konteks.hariPersekolahan,
    anggaranPeruntukan: Math.round(anggaran * 100) / 100,
    // Dipapar bersama setiap jumlah supaya tiada siapa tertanya-tanya
    // angka mana yang menghasilkannya.
    formula: 'Perenggan 4.1(c): PIR (pendapatan penjaga 1 + 2) dibanding ' +
             'PGK miskin tegar RM' + (konteks.pgk === null ? '—' : konteks.pgk.toFixed(2)) +
             '. Bukan pendapatan per kapita.'
  };
}
