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
    pgkPerKapita: konteks.pgkPerKapita,
    formula: 'Peringkat 1: PIR (penjaga 1 + 2) dibanding PGK miskin tegar RM' +
             (konteks.pgk === null ? '—' : konteks.pgk.toFixed(2)) +
             (konteks.pgkPerKapita === null
               ? '. Peringkat 2 (per kapita) dimatikan — had belum ditetapkan.'
               : '. Peringkat 2: jika PIR melebihi PGK, per kapita (PIR dibahagi ' +
                 'bilangan tanggungan) dibanding RM' + konteks.pgkPerKapita.toFixed(2) + '.')
  };
}
