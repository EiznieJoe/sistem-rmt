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
