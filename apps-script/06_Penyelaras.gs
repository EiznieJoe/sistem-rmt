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

  var murid = bacaSemua(HELAIAN.MURID).filter(function (m) {
    return m.Aktif !== false && kidSet[String(m.KelasId)];
  });

  var ringkas = ringkasanKelayakan(murid, sekolah, konteks);

  // Pecahan ikut tahun dan ikut kelas
  var ikutTahun = {}, ikutKelas = {};
  murid.forEach(function (m) {
    var hasil = nilaiKelayakan(m, sekolah[String(m.SekolahKod)], konteks);
    var t = String(m.Tahun), kid = String(m.KelasId);
    if (!ikutTahun[t]) ikutTahun[t] = { tahun: t, jumlah: 0, LAYAK: 0,
      TIDAK_LAYAK: 0, PERLU_SEMAK: 0, LUAR_SKOP: 0, belumDisahkan: 0 };
    if (!ikutKelas[kid]) ikutKelas[kid] = { kelasId: kid, tahun: t,
      namaKelas: String(m.NamaKelas), jumlah: 0, LAYAK: 0, TIDAK_LAYAK: 0,
      PERLU_SEMAK: 0, LUAR_SKOP: 0, belumDisahkan: 0, guru: '' };
    [ikutTahun[t], ikutKelas[kid]].forEach(function (b) {
      b.jumlah++; b[hasil.status]++;
      if (m.Disahkan !== true) b.belumDisahkan++;
    });
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
var TETAPAN_PENYELARAS = ['pgk_miskin_tegar', 'kadar_sehari',
                          'hari_persekolahan', 'kira_kelas_khas', 'kira_prasekolah'];

function penyelarasTetapan(token) {
  perluAuth(token, [PERANAN.PENYELARAS]);
  var semua = bacaSemua(HELAIAN.TETAPAN);
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

  if (kunci === 'pgk_miskin_tegar' || kunci === 'kadar_sehari' ||
      kunci === 'hari_persekolahan') {
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
