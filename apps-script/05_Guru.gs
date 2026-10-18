/**
 * Tindakan guru kelas.
 *
 * Model kerja: data iDME berdiri sendiri. Guru kelas hanya perlu
 * membetulkan yang salah atau mengisi yang kosong. Tidak buat apa-apa
 * bermakna data import digunakan seadanya — itu kes biasa.
 */

/** Semak kelas ini memang di bawah pegawai ini. Guru terhad kepada kelasnya. */
function _kelasSaya(sesi, kelasIdPenuh) {
  var kid = bersihTeks(kelasIdPenuh, 130).toUpperCase();
  var dibenarkan = kelasDibenarkan(sesi);
  var padan = dibenarkan.filter(function (k) {
    return String(k.KelasId).toUpperCase() === kid;
  })[0];
  if (!padan) throw Ralat('Kelas ini bukan di bawah kebenaran anda.');
  return padan;
}

function _murid(sesi, idMurid) {
  var m = cariBaris(HELAIAN.MURID, 'IdMurid', bersihTeks(idMurid, 30));
  if (!m) throw Ralat('Murid tidak dijumpai.');
  _kelasSaya(sesi, String(m.KelasId));   // menguatkuasakan skop
  return m;
}

function _paparMurid(m, sekolahIkutKod, konteks) {
  var hasil = nilaiKelayakan(m, sekolahIkutKod[String(m.SekolahKod)], konteks);
  return {
    idMurid: String(m.IdMurid),
    nama: String(m.Nama),
    noPengenalan: String(m.NoPengenalan || ''),
    jenisPengenalan: String(m.JenisPengenalan || ''),
    tahun: String(m.Tahun),
    namaKelas: String(m.NamaKelas),
    kelasId: String(m.KelasId),
    warganegara: String(m.Warganegara || ''),
    statusAsrama: String(m.StatusAsrama || ''),
    statusOku: String(m.StatusOku || ''),
    penjagaNama: String(m.PenjagaNama || ''),
    hubunganPenjaga: String(m.HubunganPenjaga || ''),
    penjagaTelefon: String(m.PenjagaTelefon || ''),
    pendapatanPenjaga1: keNombor(m.PendapatanPenjaga1),
    pendapatanPenjaga2: keNombor(m.PendapatanPenjaga2),
    tanggungan: keNombor(m.Tanggungan),
    pir: hasil.pir,
    perKapita: hasil.perKapita,
    kelayakan: hasil.status,
    laluan: hasil.laluan,
    sebab: hasil.sebab,
    statusDokumen: _statusDokumen(m),
    tarikhHantarDokumen: _tarikhIso(m.TarikhHantarDokumen),
    catatanDokumen: String(m.CatatanDokumen || ''),
    dokumenOleh: String(m.DokumenOleh || ''),
    medanDiubah: String(m.MedanDiubah || '').split(',').map(function (s) {
      return s.trim();
    }).filter(Boolean),
    catatanGuru: String(m.CatatanGuru || ''),
    aktif: m.Aktif !== false
  };
}

/**
 * Nilai StatusDokumen yang tidak dikenali dibaca sebagai "belum hantar",
 * bukan dibiarkan bocor ke UI. Baris yang diimport sebelum lajur ini wujud
 * akan kosong, dan itu memang bermakna belum hantar.
 */
function _statusDokumen(m) {
  var v = String(m.StatusDokumen || '').trim().toUpperCase();
  return STATUS_DOKUMEN_SAH.indexOf(v) >= 0 ? v : STATUS_DOKUMEN.BELUM;
}

/** Tarikh -> 'YYYY-MM-DD' untuk <input type="date">. Kosong kekal kosong. */
function _tarikhIso(nilai) {
  if (!nilai) return '';
  var d = (nilai instanceof Date) ? nilai : new Date(nilai);
  if (isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, 'Asia/Kuala_Lumpur', 'yyyy-MM-dd');
}

function _sekolahIkutKod() {
  var peta = {};
  bacaSemua(HELAIAN.SEKOLAH).forEach(function (s) { peta[String(s.Kod)] = s; });
  return peta;
}

/* ------------------------------------------------------------------ */

function guruKelasSaya(token) {
  var sesi = perluAuth(token, [PERANAN.GURU, PERANAN.PENYELARAS]);
  var konteks = konteksKelayakan();
  var sekolah = _sekolahIkutKod();
  /* Kelas luar skop RMT tidak dipaparkan — lihat nota dalam 06_Penyelaras.gs */
  var kelas = kelasDibenarkan(sesi).filter(function (k) {
    return konteks.tahunSkop.indexOf(String(k.Tahun).trim().toUpperCase()) >= 0;
  });
  var kidSet = {};
  kelas.forEach(function (k) { kidSet[String(k.KelasId)] = true; });

  var semua = bacaSemua(HELAIAN.MURID).filter(function (m) {
    return m.Aktif !== false && kidSet[String(m.KelasId)];
  });

  var ikutKelas = {};
  semua.forEach(function (m) {
    var kid = String(m.KelasId);
    if (!ikutKelas[kid]) {
      ikutKelas[kid] = { kelasId: kid, jumlah: 0,
                         dokLengkap: 0, dokTidakLengkap: 0, dokBelum: 0,
                         LAYAK: 0, TIDAK_LAYAK: 0, PERLU_SEMAK: 0, LUAR_SKOP: 0 };
    }
    var b = ikutKelas[kid];
    b.jumlah++;
    var sd = _statusDokumen(m);
    if (sd === STATUS_DOKUMEN.LENGKAP) b.dokLengkap++;
    else if (sd === STATUS_DOKUMEN.TIDAK_LENGKAP) b.dokTidakLengkap++;
    else b.dokBelum++;
    b[nilaiKelayakan(m, sekolah[String(m.SekolahKod)], konteks).status]++;
  });

  return {
    saya: { nama: sesi.label, emel: sesi.emel, peranan: sesi.peranan },
    konteks: {
      pgk: konteks.pgk, kadarSehari: konteks.kadarSehari,
      hariPersekolahan: konteks.hariPersekolahan, sesi: sesiSemasa()
    },
    kelas: kelas.map(function (k) {
      return {
        kelasId: String(k.KelasId), tahun: String(k.Tahun),
        namaKelas: String(k.NamaKelas),
        guruNamaImport: String(k.GuruNamaImport || ''),
        ringkasan: ikutKelas[String(k.KelasId)] ||
          { jumlah: 0, dokLengkap: 0, dokTidakLengkap: 0, dokBelum: 0,
            LAYAK: 0, TIDAK_LAYAK: 0, PERLU_SEMAK: 0, LUAR_SKOP: 0 }
      };
    })
  };
}

function guruSenaraiMurid(token, data) {
  var sesi = perluAuth(token, [PERANAN.GURU, PERANAN.PENYELARAS]);
  var kelas = _kelasSaya(sesi, data.kelasId);
  var konteks = konteksKelayakan();
  var sekolah = _sekolahIkutKod();

  var murid = bacaSemua(HELAIAN.MURID)
    .filter(function (m) {
      return m.Aktif !== false &&
             String(m.KelasId).toUpperCase() === String(kelas.KelasId).toUpperCase();
    })
    .map(function (m) { return _paparMurid(m, sekolah, konteks); })
    .sort(function (a, b) { return a.nama.localeCompare(b.nama); });

  return {
    kelas: { kelasId: String(kelas.KelasId), tahun: String(kelas.Tahun),
             namaKelas: String(kelas.NamaKelas) },
    murid: murid,
    konteks: { pgk: konteks.pgk, formula: ringkasanKelayakan([], {}, konteks).formula }
  };
}

/**
 * Guru membetulkan data seorang murid.
 * Hanya MEDAN_BOLEH_DIUBAH diterima. Setiap medan yang diubah direkod
 * dalam MedanDiubah supaya import akan datang tidak menimpanya.
 */
function guruKemasMurid(token, data) {
  var sesi = perluAuth(token, [PERANAN.GURU, PERANAN.PENYELARAS]);
  var perubahan = data.perubahan || {};
  var catatan = bersihTeks(data.catatan, 500);

  return dgnKunci(function () {
    var m = _murid(sesi, data.idMurid);
    var tampalan = {};
    var jejak = {};

    Object.keys(perubahan).forEach(function (medan) {
      if (MEDAN_BOLEH_DIUBAH.indexOf(medan) < 0) {
        throw Ralat('Medan "' + medan + '" tidak boleh diubah.');
      }
      var baru;
      if (MEDAN_NOMBOR.indexOf(medan) >= 0) {
        var n = keNombor(perubahan[medan]);
        if (perubahan[medan] !== '' && perubahan[medan] !== null && n === null) {
          throw Ralat('Nilai tidak sah untuk ' + medan + '.');
        }
        if (n !== null && (n < 0 || n > 1000000)) {
          throw Ralat('Nilai di luar julat untuk ' + medan + '.');
        }
        if (medan === 'Tanggungan' && n !== null && (n < 1 || n > 30)) {
          throw Ralat('Tanggungan mesti antara 1 dan 30.');
        }
        baru = n === null ? '' : n;
      } else {
        baru = bersihTeks(perubahan[medan], 200);
      }
      var lamaStr = String(m[medan] === null || m[medan] === undefined ? '' : m[medan]);
      if (lamaStr === String(baru)) return;
      jejak[medan] = { dari: m[medan], ke: baru };
      tampalan[medan] = baru;
    });

    if (catatan !== String(m.CatatanGuru || '')) tampalan.CatatanGuru = catatan;
    if (!Object.keys(tampalan).length) return { ralat: 'Tiada perubahan.' };

    var diubah = String(m.MedanDiubah || '').split(',')
      .map(function (s) { return s.trim(); }).filter(Boolean);
    Object.keys(jejak).forEach(function (medan) {
      if (diubah.indexOf(medan) < 0) diubah.push(medan);
    });

    tampalan.MedanDiubah = diubah.join(',');
    tampalan.DikemaskiniPada = new Date();
    kemasBaris(HELAIAN.MURID, m._baris, tampalan);

    audit(String(m.IdMurid), 'GURU_KEMASKINI', catatan || '', jejak, sesi);

    var segar = cariBaris(HELAIAN.MURID, 'IdMurid', String(m.IdMurid));
    return { murid: _paparMurid(segar, _sekolahIkutKod(), konteksKelayakan()) };
  });
}

/**
 * Guru mengemas kini penghantaran dokumen sokongan seorang murid.
 *
 * Berasingan daripada guruKemasMurid() kerana ini bukan pembetulan data
 * iDME: tiada MedanDiubah ditanda, jadi import semula tidak akan melaporkan
 * konflik untuk medan ini, dan status dokumen tidak pernah menimpa nilai
 * yang dibawa import.
 *
 * Tidak menyentuh kelayakan. Murid layak yang belum hantar dokumen tetap
 * layak — yang berubah hanyalah rekod pentadbiran.
 */
function guruKemasDokumen(token, data) {
  var sesi = perluAuth(token, [PERANAN.GURU, PERANAN.PENYELARAS]);

  var status = String(data.status || '').trim().toUpperCase();
  if (STATUS_DOKUMEN_SAH.indexOf(status) < 0) {
    throw Ralat('Status dokumen tidak sah.');
  }

  var tarikh = String(data.tarikh || '').trim();
  if (tarikh && !/^\d{4}-\d{2}-\d{2}$/.test(tarikh)) {
    throw Ralat('Tarikh mesti dalam bentuk YYYY-MM-DD.');
  }
  if (status !== STATUS_DOKUMEN.BELUM && !tarikh) {
    throw Ralat('Sila isi tarikh hantar.');
  }
  if (tarikh) {
    var d = new Date(tarikh + 'T00:00:00');
    if (isNaN(d.getTime())) throw Ralat('Tarikh tidak sah.');
    // Esok dibenarkan untuk zon waktu; selain itu tarikh hadapan ditolak.
    var esok = new Date(); esok.setDate(esok.getDate() + 1);
    if (d > esok) throw Ralat('Tarikh hantar tidak boleh pada masa hadapan.');
  }

  var catatan = bersihTeks(data.catatan, 300);

  return dgnKunci(function () {
    var m = _murid(sesi, data.idMurid);
    var lama = {
      status: _statusDokumen(m),
      tarikh: _tarikhIso(m.TarikhHantarDokumen),
      catatan: String(m.CatatanDokumen || '')
    };
    if (lama.status === status && lama.tarikh === tarikh &&
        lama.catatan === catatan) {
      return { ralat: 'Tiada perubahan.' };
    }

    // Status dikosongkan semula = rekod penghantaran ditarik balik penuh.
    var kosong = status === STATUS_DOKUMEN.BELUM;
    kemasBaris(HELAIAN.MURID, m._baris, {
      StatusDokumen:       status,
      TarikhHantarDokumen: kosong ? '' : tarikh,
      CatatanDokumen:      kosong ? '' : catatan,
      DokumenOleh:         kosong ? '' : sesi.emel,
      DokumenPada:         kosong ? '' : new Date(),
      DikemaskiniPada:     new Date()
    });

    audit(String(m.IdMurid), 'GURU_DOKUMEN', status || 'BELUM_HANTAR',
          { dari: lama, ke: { status: status, tarikh: tarikh, catatan: catatan } },
          sesi);

    return { status: status, tarikh: kosong ? '' : tarikh,
             catatan: kosong ? '' : catatan };
  });
}

