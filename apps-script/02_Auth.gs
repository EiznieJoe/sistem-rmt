/**
 * Kata laluan, sesi, dan kebenaran.
 *
 * Had yang perlu difahami: Apps Script tiada bcrypt atau Argon2. Yang
 * ada di sini ialah SHA-256 berulang dengan salt per-pengguna dan satu
 * pepper rahsia dari Script Properties. Ia jauh lebih baik dari SHA-256
 * tunggal, tetapi masih lebih lemah dari bcrypt kerana tiada
 * memory-hardness. Untuk 1,500 pemohon awam ini memadai kerana PEMOHON
 * tidak ada akaun sama sekali — hanya segelintir pegawai sekolah yang
 * ada kata laluan.
 */

function _pepper() {
  var p = PropertiesService.getScriptProperties();
  var nilai = p.getProperty('PEPPER');
  if (!nilai) {
    // Dijana sekali, kekal selamanya. Kalau ini berubah, semua kata
    // laluan yang ada jadi tidak sah.
    nilai = Utilities.getUuid() + Utilities.getUuid();
    p.setProperty('PEPPER', nilai);
  }
  return nilai;
}

function _saltBaru() {
  return Utilities.getUuid().replace(/-/g, '');
}

function hashKataLaluan(katalaluan, salt) {
  var bahan = salt + '|' + katalaluan + '|' + _pepper();
  for (var i = 0; i < HASH_PUSINGAN; i++) {
    var mentah = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bahan);
    bahan = mentah.map(function (b) {
      return ((b + 256) % 256).toString(16).slice(-2);
    }).join('');
  }
  return bahan;
}

/** Perbandingan masa-tetap, supaya masa respons tak membocorkan hash. */
function _samaSelamat(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  var beza = 0;
  for (var i = 0; i < a.length; i++) beza |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return beza === 0;
}

/**
 * Ukur kelajuan hashing sebenar pada projek anda, kemudian laraskan
 * HASH_PUSINGAN dalam 00_Konfig.gs. Jalankan dari editor Apps Script.
 */
function ujiKelajuanHash() {
  var mula = new Date().getTime();
  hashKataLaluan('ujian-kata-laluan', _saltBaru());
  var ms = new Date().getTime() - mula;
  Logger.log(HASH_PUSINGAN + ' pusingan = ' + ms + ' ms.');
  Logger.log('Untuk sasaran 1500 ms, tetapkan HASH_PUSINGAN kira-kira ' +
             Math.round(HASH_PUSINGAN * 1500 / Math.max(ms, 1)) + '.');
  return ms;
}

/* ------------------------------------------------------------------ */

/** Tetapkan atau tukar kata laluan pegawai. Dipanggil dari editor. */
function tetapKataLaluan(emel, katalaluanBaru) {
  emel = String(emel || '').trim().toLowerCase();
  if (!emel) throw Ralat('Emel diperlukan.');
  if (!katalaluanBaru || String(katalaluanBaru).length < 10) {
    throw Ralat('Kata laluan mesti sekurang-kurangnya 10 aksara.');
  }
  return dgnKunci(function () {
    var staf = cariBaris(HELAIAN.STAF, 'Emel', emel);
    if (!staf) throw Ralat('Pegawai ' + emel + ' tiada dalam helaian Staf.');
    var salt = _saltBaru();
    kemasBaris(HELAIAN.STAF, staf._baris, {
      Salt: salt,
      KataLaluanHash: hashKataLaluan(String(katalaluanBaru), salt)
    });
    // Tukar kata laluan membatalkan semua sesi pegawai itu.
    bacaSemua(HELAIAN.SESI_LOGIN)
      .filter(function (s) { return String(s.Emel).toLowerCase() === emel; })
      .sort(function (a, b) { return b._baris - a._baris; })
      .forEach(function (s) { _helaian(HELAIAN.SESI_LOGIN).deleteRow(s._baris); });
    return 'Kata laluan untuk ' + emel + ' dikemas kini. Sesi lama dibatalkan.';
  });
}

/* ------------------------------------------------------------------ */

function logMasuk(emel, katalaluan) {
  emel = String(emel || '').trim().toLowerCase();
  var kunciHad = 'login:' + emel;

  // Had percubaan guna Cache — cukup untuk brute-force jangka pendek,
  // dan tak membebankan helaian dengan tulisan setiap kali login gagal.
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
    // Mesej yang sama untuk emel tiada, kata laluan salah, dan akaun
    // tidak aktif — jangan beritahu penyerang emel mana yang wujud.
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
    token: token,
    nama: staf.Nama,
    emel: staf.Emel,
    peranan: staf.Peranan,
    sekolahKod: staf.SekolahKod,
    tamatPada: tamat.toISOString()
  };
}

/**
 * Sesi disimpan dalam helaian, bukan hanya CacheService. CacheService
 * berhad kepada 6 jam dan boleh dikosongkan tanpa amaran; log keluar juga
 * perlu benar-benar membatalkan token, bukan sekadar membuangnya dari
 * browser.
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

  // Semak semula terhadap helaian Staf setiap kali. Pegawai yang
  // dinyahaktifkan selepas log masuk mesti hilang akses serta-merta,
  // bukan selepas tokennya tamat.
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
  if (sesi) {
    dgnKunci(function () { _helaian(HELAIAN.SESI_LOGIN).deleteRow(sesi._baris); });
  }
  return { ok: true };
}

/**
 * Dipanggil pada SETIAP tindakan pegawai. Tanpa ini, sesiapa yang ada URL
 * web app boleh memanggil fungsi ini terus dari curl — URL itu bukan
 * rahsia, ia endpoint awam.
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

/** Permohonan ini di bawah sekolah pegawai itu? Admin dikecualikan. */
function perluSekolahSama(sesi, permohonan) {
  if (sesi.peranan === PERANAN.ADMIN) return;
  if (String(permohonan.SekolahKod) !== String(sesi.sekolahKod)) {
    throw Ralat('Permohonan ini bukan di bawah sekolah anda.');
  }
}
