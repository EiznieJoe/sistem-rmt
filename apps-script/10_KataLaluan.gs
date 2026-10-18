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
