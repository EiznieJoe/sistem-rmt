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
    disahkan: m.Disahkan === true,
    disahkanOleh: String(m.DisahkanOleh || ''),
    medanDiubah: String(m.MedanDiubah || '').split(',').map(function (s) {
      return s.trim();
    }).filter(Boolean),
    catatanGuru: String(m.CatatanGuru || ''),
    aktif: m.Aktif !== false
  };
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
      ikutKelas[kid] = { kelasId: kid, jumlah: 0, belumDisahkan: 0,
                         LAYAK: 0, TIDAK_LAYAK: 0, PERLU_SEMAK: 0, LUAR_SKOP: 0 };
    }
    var b = ikutKelas[kid];
    b.jumlah++;
    if (m.Disahkan !== true) b.belumDisahkan++;
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
          { jumlah: 0, belumDisahkan: 0, LAYAK: 0, TIDAK_LAYAK: 0,
            PERLU_SEMAK: 0, LUAR_SKOP: 0 }
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

/** Guru mengesahkan rekod seorang murid — data betul, sama ada diubah atau tidak. */
function guruSahkanMurid(token, data) {
  var sesi = perluAuth(token, [PERANAN.GURU, PERANAN.PENYELARAS]);
  return dgnKunci(function () {
    var m = _murid(sesi, data.idMurid);
    var sahkan = data.sahkan !== false;
    kemasBaris(HELAIAN.MURID, m._baris, {
      Disahkan: sahkan,
      DisahkanOleh: sahkan ? sesi.emel : '',
      DisahkanPada: sahkan ? new Date() : '',
      DikemaskiniPada: new Date()
    });
    audit(String(m.IdMurid), sahkan ? 'GURU_SAHKAN' : 'GURU_BATAL_SAHKAN', '', null, sesi);
    return { disahkan: sahkan };
  });
}

/**
 * Sahkan seluruh kelas sekali gus — "data import betul semua".
 * Murid yang berstatus PERLU_SEMAK sengaja TIDAK disahkan: itulah murid
 * yang memang perlu guru tengok satu-satu.
 */
function guruSahkanKelas(token, data) {
  var sesi = perluAuth(token, [PERANAN.GURU, PERANAN.PENYELARAS]);
  var kelas = _kelasSaya(sesi, data.kelasId);
  var konteks = konteksKelayakan();
  var sekolah = _sekolahIkutKod();

  return dgnKunci(function () {
    var murid = bacaSemua(HELAIAN.MURID).filter(function (m) {
      return m.Aktif !== false &&
             String(m.KelasId).toUpperCase() === String(kelas.KelasId).toUpperCase();
    });
    var bil = 0, dilangkau = 0;
    murid.forEach(function (m) {
      if (m.Disahkan === true) return;
      var hasil = nilaiKelayakan(m, sekolah[String(m.SekolahKod)], konteks);
      if (hasil.status === STATUS_KELAYAKAN.PERLU_SEMAK) { dilangkau++; return; }
      kemasBaris(HELAIAN.MURID, m._baris, {
        Disahkan: true, DisahkanOleh: sesi.emel,
        DisahkanPada: new Date(), DikemaskiniPada: new Date()
      });
      bil++;
    });
    audit('', 'GURU_SAHKAN_KELAS', String(kelas.KelasId),
          { disahkan: bil, dilangkau: dilangkau }, sesi);
    return {
      disahkan: bil, dilangkau: dilangkau,
      nota: dilangkau ? dilangkau + ' murid berstatus "Perlu semak" tidak disahkan ' +
                        'secara pukal — sila semak seorang demi seorang.' : ''
    };
  });
}
